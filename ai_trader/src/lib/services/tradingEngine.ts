// Trading Engine Service

import type { Position, Trade, AccountStatus, AIDecision } from '@/lib/types';
import crypto from 'crypto';

export class TradingEngine {
  private isSimulation = process.env.SIMULATION_MODE === 'true';
  private simulationBalance = 1000; // Start with $1000 for simulation
  private positions: Position[] = [];
  private trades: Trade[] = [];
  private binanceApiKey = process.env.BINANCE_TESTNET_API_KEY || '';
  private binanceApiSecret = process.env.BINANCE_TESTNET_API_SECRET || '';
  private binanceBaseUrl = process.env.USE_TESTNET === 'true' 
    ? 'https://testnet.binancefuture.com'
    : 'https://fapi.binance.com';
  private timeOffset = 0;
  private timeOffsetInitialized = false;

  private async syncServerTime(): Promise<void> {
    try {
      const response = await fetch(`${this.binanceBaseUrl}/fapi/v1/time`);
      const data = await response.json();
      const serverTime = data.serverTime;
      const localTime = Date.now();
      this.timeOffset = serverTime - localTime;
      this.timeOffsetInitialized = true;
      console.log(`[${new Date().toISOString()}] Time synced with Binance. Offset: ${this.timeOffset}ms`);
    } catch (error) {
      console.error('Time sync error:', error);
      this.timeOffset = 0;
    }
  }

  private async getTimestamp(): Promise<number> {
    if (!this.timeOffsetInitialized) {
      await this.syncServerTime();
    }
    return Date.now() + this.timeOffset;
  }

  private createSignature(queryString: string): string {
    return crypto
      .createHmac('sha256', this.binanceApiSecret)
      .update(queryString)
      .digest('hex');
  }

  private async binanceRequest(endpoint: string, params: Record<string, any> = {}, method: 'GET' | 'POST' = 'GET'): Promise<any> {
    const timestamp = await this.getTimestamp();
    const queryString = new URLSearchParams({ ...params, timestamp: timestamp.toString() }).toString();
    const signature = this.createSignature(queryString);
    const url = `${this.binanceBaseUrl}${endpoint}?${queryString}&signature=${signature}`;

    const response = await fetch(url, {
      method,
      headers: {
        'X-MBX-APIKEY': this.binanceApiKey,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Binance API error: ${error}`);
    }

    return response.json();
  }

  async getAccountStatus(): Promise<AccountStatus> {
    if (this.isSimulation) {
      return this.getSimulatedAccountStatus();
    }

    try {
      // Fetch real account data from Binance
      const accountData = await this.binanceRequest('/fapi/v2/account');
      
      const totalBalance = parseFloat(accountData.totalWalletBalance);
      const availableBalance = parseFloat(accountData.availableBalance);
      const totalMarginUsed = parseFloat(accountData.totalInitialMargin);
      const unrealizedPnL = parseFloat(accountData.totalUnrealizedProfit);

      // Get positions for count
      const positionsData = await this.binanceRequest('/fapi/v2/positionRisk');
      const openPositions = positionsData.filter((p: any) => parseFloat(p.positionAmt) !== 0);

      // Calculate daily PnL from recent trades
      const trades = await this.binanceRequest('/fapi/v1/userTrades', {
        symbol: process.env.TRADING_PAIR || 'BTCUSDT',
        limit: 100,
      });
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dailyPnL = trades
        .filter((t: any) => new Date(t.time) >= today)
        .reduce((sum: number, t: any) => sum + parseFloat(t.realizedPnl || '0'), 0);

      console.log(`[${new Date().toISOString()}] Binance Account Status:`);
      console.log(`  Total Balance: $${totalBalance.toFixed(2)}`);
      console.log(`  Available: $${availableBalance.toFixed(2)}`);
      console.log(`  Unrealized PnL: $${unrealizedPnL.toFixed(2)}`);
      console.log(`  Open Positions: ${openPositions.length}`);

      return {
        totalBalance,
        availableBalance,
        totalMarginUsed,
        marginUsagePercent: totalBalance > 0 ? (totalMarginUsed / totalBalance) * 100 : 0,
        unrealizedPnL,
        dailyPnL,
        positionCount: openPositions.length,
      };
    } catch (error) {
      console.error('Account status error:', error);
      return this.getSimulatedAccountStatus();
    }
  }

  private getSimulatedAccountStatus(): AccountStatus {
    const totalMarginUsed = this.positions.reduce((sum, p) => sum + (p.quantity * p.entryPrice) / p.leverage, 0);
    const unrealizedPnL = this.positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
    const totalBalance = this.simulationBalance + unrealizedPnL;

    return {
      totalBalance,
      availableBalance: totalBalance - totalMarginUsed,
      totalMarginUsed,
      marginUsagePercent: (totalMarginUsed / totalBalance) * 100,
      unrealizedPnL,
      dailyPnL: this.trades
        .filter((t) => {
          const tradeDate = new Date(t.closeTime);
          const today = new Date();
          return (
            tradeDate.getFullYear() === today.getFullYear() &&
            tradeDate.getMonth() === today.getMonth() &&
            tradeDate.getDate() === today.getDate()
          );
        })
        .reduce((sum, t) => sum + t.pnl, 0),
      positionCount: this.positions.length,
    };
  }

  async executeDecision(decision: AIDecision): Promise<{ success: boolean; error?: string }> {
    try {
      if (decision.action === 'HOLD') {
        return { success: true };
      }

      if (decision.action === 'CLOSE_LONG' || decision.action === 'CLOSE_SHORT') {
        return this.closePosition(decision.symbol || '');
      }

      if (decision.action === 'OPEN_LONG' || decision.action === 'OPEN_SHORT') {
        return this.openPosition(
          decision.symbol || '',
          decision.action === 'OPEN_LONG' ? 'LONG' : 'SHORT',
          decision.quantity || 0.1,
          decision.leverage || 5,
          decision.stopLoss || 0,
          decision.takeProfit || 0
        );
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Execution error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  private async openPosition(
    symbol: string,
    side: 'LONG' | 'SHORT',
    quantity: number,
    leverage: number,
    stopLoss: number,
    takeProfit: number
  ): Promise<{ success: boolean; error?: string; message?: string }> {
    if (this.isSimulation) {
      return this.openSimulatedPosition(symbol, side, quantity, leverage, stopLoss, takeProfit);
    }

    try {
      // Set leverage first
      await this.binanceRequest('/fapi/v1/leverage', {
        symbol,
        leverage: leverage.toString(),
      }, 'POST');

      // Set position mode to One-Way if needed (ignore errors if already set)
      try {
        await this.binanceRequest('/fapi/v1/positionSide/dual', {
          dualSidePosition: 'false',
        }, 'POST');
      } catch (error) {
        // Ignore if already in One-Way mode
        console.log('Position mode already set or error:', error);
      }

      // Place market order
      const timestamp = await this.getTimestamp();
      const orderParams = {
        symbol,
        side: side === 'LONG' ? 'BUY' : 'SELL',
        type: 'MARKET',
        quantity: quantity.toString(),
        positionSide: 'BOTH', // One-Way mode
        timestamp: timestamp.toString(),
      };

      const queryString = new URLSearchParams(orderParams).toString();
      const signature = this.createSignature(queryString);
      const url = `${this.binanceBaseUrl}/fapi/v1/order?${queryString}&signature=${signature}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-MBX-APIKEY': this.binanceApiKey,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Open position error:', error);
        return { success: false, error: `Failed to open position: ${error}` };
      }

      const orderData = await response.json();
      console.log(`[${new Date().toISOString()}] Opened ${side} position on ${symbol}: ${orderData.orderId}`);

      return { success: true, message: `Opened ${side} position on ${symbol}` };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Open position error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  private async openSimulatedPosition(
    symbol: string,
    side: 'LONG' | 'SHORT',
    quantity: number,
    leverage: number,
    stopLoss: number,
    takeProfit: number
  ): Promise<{ success: boolean; error?: string; message?: string }> {
    const existingPosition = this.positions.find((p) => p.symbol === symbol && p.side === side);
    if (existingPosition) {
      return { success: false, error: `Position already exists for ${symbol} ${side}` };
    }

    // Simulate fetching current price
    const currentPrice = 40000 + Math.random() * 5000; // Mock price

    const position: Position = {
      symbol,
      side,
      quantity,
      leverage,
      entryPrice: currentPrice,
      currentPrice,
      unrealizedPnL: 0,
      unrealizedPnLPercent: 0,
      openTime: new Date(),
      stopLoss,
      takeProfit,
    };

    this.positions.push(position);
    console.log(`[${new Date().toISOString()}] Simulated ${side} position opened on ${symbol}`);
    return { success: true, message: `Simulated ${side} position opened on ${symbol}` };
  }

  private async closePosition(symbol: string): Promise<{ success: boolean; error?: string; message?: string }> {
    if (this.isSimulation) {
      return this.closeSimulatedPosition(symbol);
    }

    try {
      // Get current position to determine side and quantity
      const positions = await this.getPositions();
      const position = positions.find((p) => p.symbol === symbol);
      
      if (!position) {
        return { success: false, error: `No position found for ${symbol}` };
      }

      // Close position by placing opposite order
      const timestamp = await this.getTimestamp();
      const orderParams = {
        symbol,
        side: position.side === 'LONG' ? 'SELL' : 'BUY',
        type: 'MARKET',
        quantity: position.quantity.toString(),
        positionSide: 'BOTH', // One-Way mode
        reduceOnly: 'true',
        timestamp: timestamp.toString(),
      };

      const queryString = new URLSearchParams(orderParams).toString();
      const signature = this.createSignature(queryString);
      const url = `${this.binanceBaseUrl}/fapi/v1/order?${queryString}&signature=${signature}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-MBX-APIKEY': this.binanceApiKey,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Close position error:', error);
        return { success: false, error: `Failed to close position: ${error}` };
      }

      const orderData = await response.json();
      console.log(`[${new Date().toISOString()}] Closed ${position.side} position on ${symbol}: PnL $${position.unrealizedPnL.toFixed(2)}`);

      return { success: true, message: `Closed ${position.side} position on ${symbol}` };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Close position error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  private async closeSimulatedPosition(symbol: string): Promise<{ success: boolean; error?: string; message?: string }> {
    const positionIndex = this.positions.findIndex((p) => p.symbol === symbol);
    if (positionIndex === -1) {
      return { success: false, error: `No position found for ${symbol}` };
    }

    const position = this.positions[positionIndex];
    const currentPrice = 40000 + Math.random() * 5000; // Mock price
    const priceDiff = position.side === 'LONG' ? currentPrice - position.entryPrice : position.entryPrice - currentPrice;
    const pnl = priceDiff * position.quantity * position.leverage;
    const pnlPercent = (priceDiff / position.entryPrice) * 100;

    const trade: Trade = {
      id: `${symbol}-${Date.now()}`,
      symbol,
      side: position.side,
      quantity: position.quantity,
      leverage: position.leverage,
      entryPrice: position.entryPrice,
      exitPrice: currentPrice,
      pnl,
      pnlPercent,
      openTime: position.openTime,
      closeTime: new Date(),
      duration: Math.round((new Date().getTime() - position.openTime.getTime()) / 60000),
    };

    this.trades.push(trade);
    this.simulationBalance += pnl;
    this.positions.splice(positionIndex, 1);

    console.log(`[${new Date().toISOString()}] Simulated position closed on ${symbol}: PnL $${pnl.toFixed(2)}`);
    return { success: true, message: `Simulated position closed on ${symbol}` };
  }

  async getPositions(): Promise<Position[]> {
    if (this.isSimulation) {
      return this.positions;
    }

    try {
      // Fetch real positions from Binance
      const positionsData = await this.binanceRequest('/fapi/v2/positionRisk');
      
      const openPositions: Position[] = [];
      
      for (const pos of positionsData) {
        const positionAmt = parseFloat(pos.positionAmt);
        if (positionAmt === 0) continue; // Skip closed positions

        const entryPrice = parseFloat(pos.entryPrice);
        const currentPrice = parseFloat(pos.markPrice);
        const leverage = parseInt(pos.leverage);
        const unrealizedPnL = parseFloat(pos.unRealizedProfit);
        
        const side = positionAmt > 0 ? 'LONG' : 'SHORT';
        const quantity = Math.abs(positionAmt);
        const priceDiff = side === 'LONG' ? currentPrice - entryPrice : entryPrice - currentPrice;
        const unrealizedPnLPercent = entryPrice > 0 ? (priceDiff / entryPrice) * 100 * leverage : 0;

        openPositions.push({
          symbol: pos.symbol,
          side,
          quantity,
          leverage,
          entryPrice,
          currentPrice,
          unrealizedPnL,
          unrealizedPnLPercent,
          openTime: new Date(parseInt(pos.updateTime || '0')),
          stopLoss: 0, // Binance doesn't provide this in positionRisk
          takeProfit: 0,
        });
      }

      console.log(`[${new Date().toISOString()}] Binance Positions: ${openPositions.length} open`);
      openPositions.forEach((pos, idx) => {
        console.log(`  ${idx + 1}. ${pos.symbol} ${pos.side} - PnL: $${pos.unrealizedPnL.toFixed(2)} (${pos.unrealizedPnLPercent.toFixed(2)}%)`);
      });

      return openPositions;
    } catch (error) {
      console.error('Get positions error:', error);
      return this.positions;
    }
  }

  async getRecentTrades(limit = 10): Promise<Trade[]> {
    if (this.isSimulation) {
      return this.trades.slice(-limit);
    }

    try {
      // Fetch recent trades from Binance
      const tradesData = await this.binanceRequest('/fapi/v1/userTrades', {
        symbol: process.env.TRADING_PAIR || 'BTCUSDT',
        limit: limit * 2, // Fetch more to account for both open and close
      });

      const trades: Trade[] = [];
      const tradeMap = new Map<string, any>();

      // Group trades into open/close pairs
      for (const t of tradesData) {
        const isBuy = t.side === 'BUY';
        const qty = parseFloat(t.qty);
        const price = parseFloat(t.price);
        const realizedPnl = parseFloat(t.realizedPnl || '0');

        if (realizedPnl !== 0) {
          // This is a closing trade
          const side = isBuy ? 'SHORT' : 'LONG'; // Closing a long means selling
          trades.push({
            id: t.id.toString(),
            symbol: t.symbol,
            side,
            quantity: qty,
            leverage: 1, // Not available in trade data
            entryPrice: price - realizedPnl / qty, // Approximate
            exitPrice: price,
            pnl: realizedPnl,
            pnlPercent: (realizedPnl / (qty * price)) * 100,
            openTime: new Date(t.time - 3600000), // Approximate
            closeTime: new Date(t.time),
            duration: 60, // Approximate
          });
        }
      }

      return trades.slice(-limit);
    } catch (error) {
      console.error('Get trades error:', error);
      return this.trades.slice(-limit);
    }
  }

  updatePositionPrices(marketData: Map<string, number>): void {
    for (const position of this.positions) {
      const newPrice = marketData.get(position.symbol);
      if (newPrice) {
        position.currentPrice = newPrice;
        const priceDiff = position.side === 'LONG' ? newPrice - position.entryPrice : position.entryPrice - newPrice;
        position.unrealizedPnL = priceDiff * position.quantity * position.leverage;
        position.unrealizedPnLPercent = (priceDiff / position.entryPrice) * 100;
      }
    }
  }
}

export const tradingEngine = new TradingEngine();
