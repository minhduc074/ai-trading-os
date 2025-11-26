// @ts-ignore - @binance/connector doesn't have TypeScript definitions
import { Spot } from '@binance/connector';
import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { BaseTrader } from './BaseTrader';
import { Position, Order, AccountInfo, Kline, ExecutionResult } from '../types';

interface BinanceConfig {
  apiKey: string;
  apiSecret: string;
  isTestnet?: boolean;
}

/**
 * Binance Futures trader implementation
 * Supports both mainnet and testnet
 */
export class BinanceTrader extends BaseTrader {
  name: string;
  isTestnet: boolean;
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;
  private client: AxiosInstance;
  private exchangeInfo: any = null;
  private exchangeInfoCache: Map<string, any> = new Map();
  private timeOffset: number = 0; // Time offset from server

  constructor(config: BinanceConfig) {
    super();
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.isTestnet = config.isTestnet || false;
    this.name = this.isTestnet ? 'Binance Futures Testnet' : 'Binance Futures';
    
    // Set base URL based on environment
    // Testnet: https://testnet.binancefuture.com
    // Mainnet: https://fapi.binance.com
    this.baseUrl = this.isTestnet 
      ? 'https://testnet.binancefuture.com'
      : 'https://fapi.binance.com';

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'X-MBX-APIKEY': this.apiKey,
      },
    });

  this.log(`Initialized ${this.name} at ${this.baseUrl}`);
  }

  // Sync time with server
  private async syncServerTime(): Promise<void> {
    try {
      const localTime = Date.now();
      const response = await this.client.get('/fapi/v1/time');
      const serverTime = response.data.serverTime;
      this.timeOffset = serverTime - localTime;
      this.log(`Time synced. Offset: ${this.timeOffset}ms`);
    } catch (error: any) {
      this.log(`Failed to sync time: ${error.message}`, 'error');
    }
  }

  // Get timestamp adjusted for server time
  private getTimestamp(): number {
    return Date.now() + this.timeOffset;
  }

  // Signature helper for authenticated requests
  private sign(params: any): string {
    const queryString = Object.keys(params)
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  private getPrecision(value: number): number {
    if (!Number.isFinite(value) || value === 0) {
      return 0;
    }

    const text = value.toString();
    if (text.includes('e-')) {
      const parts = text.split('e-');
      const baseDecimals = parts[0].includes('.') ? parts[0].split('.')[1].length : 0;
      const exponentValue = parseInt(parts[1], 10);
      return exponentValue + baseDecimals;
    }

    const decimalPart = text.split('.')[1];
    return decimalPart ? decimalPart.length : 0;
  }

  // Get exchange info (cached)
  private async getExchangeInfo(): Promise<any> {
    if (this.exchangeInfo) {
      return this.exchangeInfo;
    }

    const response = await this.client.get('/fapi/v1/exchangeInfo');
    this.exchangeInfo = response.data;
    return this.exchangeInfo;
  }

  async getSymbolInfo(symbol: string): Promise<any> {
    if (this.exchangeInfoCache.has(symbol)) {
      return this.exchangeInfoCache.get(symbol);
    }

    const exchangeInfo = await this.getExchangeInfo();
    const symbolInfo = exchangeInfo.symbols.find((s: any) => s.symbol === symbol);
    
    if (symbolInfo) {
      this.exchangeInfoCache.set(symbol, symbolInfo);
    }
    
    return symbolInfo;
  }

  async formatQuantity(symbol: string, quantity: number): Promise<string> {
    const symbolInfo = await this.getSymbolInfo(symbol);
    if (!symbolInfo) {
      throw new Error(`Symbol ${symbol} not found`);
    }

    const lotSizeFilter = symbolInfo.filters.find((f: any) => f.filterType === 'MARKET_LOT_SIZE')
      || symbolInfo.filters.find((f: any) => f.filterType === 'LOT_SIZE');
    if (!lotSizeFilter) {
      return quantity.toFixed(3);
    }

    const stepSize = parseFloat(lotSizeFilter.stepSize);
    const minQty = parseFloat(lotSizeFilter.minQty || '0');
    const precision = this.getPrecision(stepSize);

    const steps = Math.floor(quantity / stepSize + 1e-9);
    let roundedQty = steps * stepSize;

    if (minQty > 0 && roundedQty < minQty) {
      roundedQty = minQty;
    }

    return roundedQty.toFixed(precision);
  }

  async formatPrice(symbol: string, price: number): Promise<string> {
    const symbolInfo = await this.getSymbolInfo(symbol);
    if (!symbolInfo) {
      throw new Error(`Symbol ${symbol} not found`);
    }

    const priceFilter = symbolInfo.filters.find((f: any) => f.filterType === 'PRICE_FILTER');
    if (!priceFilter) {
      return price.toFixed(2);
    }

    const tickSize = parseFloat(priceFilter.tickSize);
    const precision = tickSize.toString().split('.')[1]?.length || 0;
    
    return price.toFixed(precision);
  }

  async setDualPositionMode(enabled: boolean = true): Promise<void> {
    try {
      const timestamp = this.getTimestamp();
      const params = { dualSidePosition: enabled.toString(), timestamp };
      const signature = this.sign(params);

      await this.client.post('/fapi/v1/positionSide/dual', null, {
        params: { ...params, signature },
      });

      this.log(`Set dual position mode to ${enabled ? 'HEDGE' : 'ONE-WAY'}`);
    } catch (error: any) {
      // Ignore if already set
      if (!error.response?.data?.msg?.includes('No need to change position side')) {
        this.log(`Failed to set position mode: ${error.message}`, 'warn');
      }
    }
  }

  async getAccountInfo(): Promise<AccountInfo> {
    try {
      // Sync time on first call
      if (this.timeOffset === 0) {
        await this.syncServerTime();
        // Set to hedge mode (dual position) for LONG/SHORT support
        await this.setDualPositionMode(true);
      }

      const timestamp = this.getTimestamp();
      const params = { timestamp };
      const signature = this.sign(params);

      this.log(`Requesting account info: GET /fapi/v2/account`);
      
      const response = await this.client.get('/fapi/v2/account', {
        params: { ...params, signature },
      });

      const data = response.data;
      const positions = await this.getPositions();

      return {
        totalEquity: parseFloat(data.totalWalletBalance) + parseFloat(data.totalUnrealizedProfit),
        availableBalance: parseFloat(data.availableBalance),
        totalMarginUsed: parseFloat(data.totalInitialMargin),
        marginUsagePercent: parseFloat(data.totalInitialMargin) / parseFloat(data.totalWalletBalance),
        totalUnrealizedPnl: parseFloat(data.totalUnrealizedProfit),
        totalPositions: positions.length,
        positions,
      };
    } catch (error: any) {
      const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      this.log(`❌ Failed to get account info: ${errorMsg}`, 'error');
      this.log(`URL: ${this.baseUrl}/fapi/v2/account`, 'error');
      this.log(`API Key: ${this.apiKey.substring(0, 10)}...`, 'error');
      throw error;
    }
  }

  async getPositions(): Promise<Position[]> {
    try {
      const timestamp = this.getTimestamp();
      const params = { timestamp };
      const signature = this.sign(params);

      const response = await this.client.get('/fapi/v2/positionRisk', {
        params: { ...params, signature },
      });

      const positions: Position[] = [];
      
      for (const pos of response.data) {
        const posAmt = parseFloat(pos.positionAmt);
        if (posAmt === 0) continue;

        const entryPrice = parseFloat(pos.entryPrice);
        const markPrice = parseFloat(pos.markPrice);
        const leverage = parseInt(pos.leverage);
        const unrealizedPnl = parseFloat(pos.unRealizedProfit);

        positions.push({
          symbol: pos.symbol,
          side: posAmt > 0 ? 'LONG' : 'SHORT',
          quantity: Math.abs(posAmt),
          entryPrice,
          currentPrice: markPrice,
          leverage,
          unrealizedPnl,
          unrealizedPnlPercent: (unrealizedPnl / (Math.abs(posAmt) * entryPrice / leverage)) * 100,
          liquidationPrice: parseFloat(pos.liquidationPrice),
          marginType: pos.marginType.toLowerCase() as 'isolated' | 'cross',
          openTime: parseInt(pos.updateTime),
          duration: this.calculatePositionDuration(parseInt(pos.updateTime)),
        });
      }

      return positions;
    } catch (error: any) {
      this.log(`Failed to get positions: ${error.message}`, 'error');
      throw error;
    }
  }

  async getOpenOrders(symbol?: string): Promise<Order[]> {
    try {
      const timestamp = this.getTimestamp();
      const params: any = { timestamp };
      if (symbol) params.symbol = symbol;
      const signature = this.sign(params);

      const response = await this.client.get('/fapi/v1/openOrders', {
        params: { ...params, signature },
      });

      return response.data.map((order: any) => ({
        orderId: order.orderId.toString(),
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        positionSide: order.positionSide,
        quantity: parseFloat(order.origQty),
        price: order.price ? parseFloat(order.price) : undefined,
        stopPrice: order.stopPrice ? parseFloat(order.stopPrice) : undefined,
        status: order.status,
        executedQty: parseFloat(order.executedQty),
        executedPrice: order.avgPrice ? parseFloat(order.avgPrice) : undefined,
        timestamp: order.time,
      }));
    } catch (error: any) {
      this.log(`Failed to get open orders: ${error.message}`, 'error');
      throw error;
    }
  }

  async getMarketPrice(symbol: string): Promise<number> {
    try {
      const response = await this.client.get('/fapi/v1/ticker/price', {
        params: { symbol },
      });
      return parseFloat(response.data.price);
    } catch (error: any) {
      this.log(`Failed to get market price for ${symbol}: ${error.message}`, 'error');
      throw error;
    }
  }

  async getKlines(symbol: string, interval: string, limit: number = 100): Promise<Kline[]> {
    try {
      const response = await this.client.get('/fapi/v1/klines', {
        params: { symbol, interval, limit },
      });

      return response.data.map((k: any[]) => ({
        openTime: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
        closeTime: k[6],
        quoteAssetVolume: parseFloat(k[7]),
        numberOfTrades: k[8],
      }));
    } catch (error: any) {
      this.log(`Failed to get klines for ${symbol}: ${error.message}`, 'error');
      throw error;
    }
  }

  async getOpenInterest(symbol: string): Promise<number> {
    try {
      const response = await this.client.get('/fapi/v1/openInterest', {
        params: { symbol },
      });
      
      // Get current price to convert to USD
      const price = await this.getMarketPrice(symbol);
      const oi = parseFloat(response.data.openInterest);
      
      return oi * price; // Return in USD
    } catch (error: any) {
      this.log(`Failed to get open interest for ${symbol}: ${error.message}`, 'error');
      if (error.response) {
        this.log(`Response data: ${JSON.stringify(error.response.data)}`, 'error');
      }
      return 0;
    }
  }

  async getFundingRate(symbol: string): Promise<number> {
    try {
      const response = await this.client.get('/fapi/v1/premiumIndex', {
        params: { symbol },
      });
      return parseFloat(response.data.lastFundingRate);
    } catch (error: any) {
      this.log(`Failed to get funding rate for ${symbol}: ${error.message}`, 'error');
      return 0;
    }
  }

  async setLeverage(symbol: string, leverage: number): Promise<void> {
    try {
      const timestamp = this.getTimestamp();
      const params = { symbol, leverage, timestamp };
      const signature = this.sign(params);

      await this.client.post('/fapi/v1/leverage', null, {
        params: { ...params, signature },
      });

      this.log(`Set leverage for ${symbol} to ${leverage}x`);
    } catch (error: any) {
      // Ignore if leverage is already set
      if (!error.response?.data?.msg?.includes('No need to change leverage')) {
        this.log(`Failed to set leverage for ${symbol}: ${error.message}`, 'warn');
      }
    }
  }

  async setMarginType(symbol: string, marginType: 'ISOLATED' | 'CROSSED'): Promise<void> {
    try {
      const timestamp = this.getTimestamp();
      const params = { symbol, marginType, timestamp };
      const signature = this.sign(params);

      await this.client.post('/fapi/v1/marginType', null, {
        params: { ...params, signature },
      });

      this.log(`Set margin type for ${symbol} to ${marginType}`);
    } catch (error: any) {
      // Ignore if margin type is already set
      if (!error.response?.data?.msg?.includes('No need to change margin type')) {
        this.log(`Failed to set margin type for ${symbol}: ${error.message}`, 'warn');
      }
    }
  }

  async openPosition(
    symbol: string,
    side: 'LONG' | 'SHORT',
    quantity: number,
    leverage: number,
    stopLoss?: number,
    takeProfit?: number
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // Set leverage first
      await this.setLeverage(symbol, leverage);
      await this.setMarginType(symbol, 'CROSSED');

      // Format quantity
      const formattedQty = await this.formatQuantity(symbol, quantity);

      // Open market order
      const timestamp = this.getTimestamp();
      const orderParams: any = {
        symbol,
        side: side === 'LONG' ? 'BUY' : 'SELL',
        positionSide: side,
        type: 'MARKET',
        quantity: formattedQty,
        timestamp,
      };

      const signature = this.sign(orderParams);
      const orderResponse = await this.client.post('/fapi/v1/order', null, {
        params: { ...orderParams, signature },
      });

      const orderId = orderResponse.data.orderId.toString();
      const avgPrice = parseFloat(orderResponse.data.avgPrice);

      this.log(`Opened ${side} position on ${symbol}: ${formattedQty} @ ${avgPrice} (${leverage}x)`);

      // Set stop loss and take profit
      if (stopLoss || takeProfit) {
        await this.setStopLossAndTakeProfit(symbol, side, parseFloat(formattedQty), stopLoss, takeProfit);
      }

      return {
        decision: {
          action: side === 'LONG' ? 'open_long' : 'open_short',
          symbol,
          position_size_usd: parseFloat(formattedQty) * avgPrice, // Calculate position size from quantity and price
          profit_target: takeProfit,
          stop_loss: stopLoss,
          reasoning: '',
        },
        success: true,
        orderId,
        executedPrice: avgPrice,
        executedQuantity: parseFloat(formattedQty),
        timestamp: startTime,
      };
    } catch (error: any) {
      this.log(`Failed to open ${side} position on ${symbol}: ${error.response?.data?.msg || error.message}`, 'error');
      
      return {
        decision: {
          action: side === 'LONG' ? 'open_long' : 'open_short',
          symbol,
          position_size_usd: 0, // Not executed, so no position size
          profit_target: takeProfit,
          stop_loss: stopLoss,
          reasoning: '',
        },
        success: false,
        error: error.response?.data?.msg || error.message,
        timestamp: startTime,
      };
    }
  }

  private async setStopLossAndTakeProfit(
    symbol: string,
    side: 'LONG' | 'SHORT',
    quantity: number,
    stopLoss?: number,
    takeProfit?: number
  ): Promise<void> {
    try {
      const formattedQty = await this.formatQuantity(symbol, quantity);

      // Set stop loss
      if (stopLoss) {
        const formattedStopLoss = await this.formatPrice(symbol, stopLoss);
        const timestamp = this.getTimestamp();
        const slParams: any = {
          symbol,
          side: side === 'LONG' ? 'SELL' : 'BUY',
          positionSide: side,
          type: 'STOP_MARKET',
          stopPrice: formattedStopLoss,
          reduceOnly: true,
          workingType: 'MARK_PRICE',
          quantity: formattedQty,
          timestamp,
        };

        const signature = this.sign(slParams);
        await this.client.post('/fapi/v1/order', null, {
          params: { ...slParams, signature },
        });

        this.log(`Set stop loss for ${symbol} at ${formattedStopLoss}`);
      }

      // Set take profit
      if (takeProfit) {
        const formattedTakeProfit = await this.formatPrice(symbol, takeProfit);
        const timestamp = this.getTimestamp();
        const tpParams: any = {
          symbol,
          side: side === 'LONG' ? 'SELL' : 'BUY',
          positionSide: side,
          type: 'TAKE_PROFIT_MARKET',
          stopPrice: formattedTakeProfit,
          reduceOnly: true,
          workingType: 'MARK_PRICE',
          quantity: formattedQty,
          timestamp,
        };

        const signature = this.sign(tpParams);
        await this.client.post('/fapi/v1/order', null, {
          params: { ...tpParams, signature },
        });

        this.log(`Set take profit for ${symbol} at ${formattedTakeProfit}`);
      }
    } catch (error: any) {
      this.log(`Failed to set SL/TP for ${symbol}: ${error.response?.data?.msg || error.message}`, 'warn');
    }
  }

  async closePosition(
    symbol: string,
    side: 'LONG' | 'SHORT',
    quantity?: number
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // Cancel all pending orders first
      await this.cancelAllOrders(symbol);

      // Get current position if quantity not specified
      if (!quantity) {
        const positions = await this.getPositions();
        const position = positions.find(p => p.symbol === symbol && p.side === side);
        
        if (!position) {
          throw new Error(`No ${side} position found for ${symbol}`);
        }
        
        quantity = position.quantity;
      }

      // Format quantity
      const formattedQty = await this.formatQuantity(symbol, quantity);

      // Close with market order
      const timestamp = this.getTimestamp();
      const orderParams: any = {
        symbol,
        side: side === 'LONG' ? 'SELL' : 'BUY',
        positionSide: side,
        type: 'MARKET',
        quantity: formattedQty,
        timestamp,
      };

      const signature = this.sign(orderParams);
      const orderResponse = await this.client.post('/fapi/v1/order', null, {
        params: { ...orderParams, signature },
      });

      const orderId = orderResponse.data.orderId.toString();
      const avgPrice = parseFloat(orderResponse.data.avgPrice);

      this.log(`Closed ${side} position on ${symbol}: ${formattedQty} @ ${avgPrice}`);

      return {
        decision: {
          action: side === 'LONG' ? 'close_long' : 'close_short',
          symbol,
          quantity: parseFloat(formattedQty),
          position_size_usd: parseFloat(formattedQty) * avgPrice, // Calculate position size
          reasoning: '',
        },
        success: true,
        orderId,
        executedPrice: avgPrice,
        executedQuantity: parseFloat(formattedQty),
        timestamp: startTime,
      };
    } catch (error: any) {
      this.log(`Failed to close ${side} position on ${symbol}: ${error.response?.data?.msg || error.message}`, 'error');
      
      return {
        decision: {
          action: side === 'LONG' ? 'close_long' : 'close_short',
          symbol,
          quantity: quantity || 0,
          position_size_usd: 0, // Not executed
          reasoning: '',
        },
        success: false,
        error: error.response?.data?.msg || error.message,
        timestamp: startTime,
      };
    }
  }

  async cancelAllOrders(symbol?: string): Promise<void> {
    try {
      const timestamp = this.getTimestamp();
      const params: any = { timestamp };
      if (symbol) params.symbol = symbol;
      const signature = this.sign(params);

      await this.client.delete('/fapi/v1/allOpenOrders', {
        params: { ...params, signature },
      });

      this.log(`Cancelled all orders${symbol ? ` for ${symbol}` : ''}`);
    } catch (error: any) {
      this.log(`Failed to cancel orders: ${error.message}`, 'warn');
    }
  }
}
