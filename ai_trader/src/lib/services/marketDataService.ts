// Market Data Service

import type { MarketData } from '@/lib/types';

export class MarketDataService {
  private baseURL = 'https://fapi.binance.com';

  // Helper: Calculate RSI
  private calculateRSI(prices: number[], period: number): number {
    if (prices.length < period + 1) return 50;
    
    const changes = prices.slice(1).map((price, i) => price - prices[i]);
    const gains = changes.map(change => change > 0 ? change : 0);
    const losses = changes.map(change => change < 0 ? -change : 0);
    
    const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  // Helper: Calculate EMA
  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];
    
    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    
    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }

  // Helper: Calculate MACD
  private calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macd = ema12 - ema26;
    
    // Calculate signal line (9-day EMA of MACD)
    const macdLine: number[] = [];
    for (let i = 26; i <= prices.length; i++) {
      const slice = prices.slice(0, i);
      const e12 = this.calculateEMA(slice, 12);
      const e26 = this.calculateEMA(slice, 26);
      macdLine.push(e12 - e26);
    }
    
    const signal = macdLine.length >= 9 ? this.calculateEMA(macdLine, 9) : macd;
    const histogram = macd - signal;
    
    return { macd, signal, histogram };
  }

  // Helper: Calculate ATR
  private calculateATR(highs: number[], lows: number[], closes: number[], period: number = 14): number {
    if (highs.length < period + 1) return 0;
    
    const trueRanges: number[] = [];
    for (let i = 1; i < highs.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trueRanges.push(tr);
    }
    
    return trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period;
  }

  async getMarketData(symbols: string[]): Promise<MarketData[]> {
    try {
      const data: MarketData[] = [];

      for (const symbol of symbols) {
        const marketData = await this.fetchSymbolData(symbol);
        if (marketData) {
          data.push(marketData);
        }
      }

      return data;
    } catch (error) {
      console.error('Market data fetch error:', error);
      return [];
    }
  }

  private async fetchSymbolData(symbol: string): Promise<MarketData | null> {
    try {
      // Fetch ticker data
      const tickerResponse = await fetch(`${this.baseURL}/fapi/v1/ticker/24hr?symbol=${symbol}`);
      const ticker = await tickerResponse.json() as any;

      // Fetch funding rate
      const fundingResponse = await fetch(`${this.baseURL}/fapi/v1/fundingRate?symbol=${symbol}&limit=1`);
      const fundingData = await fundingResponse.json() as any[];

      // Fetch open interest
      const oiResponse = await fetch(`${this.baseURL}/fapi/v1/openInterest?symbol=${symbol}`);
      const oiData = await oiResponse.json() as any;

      // Fetch K-line data for technical indicators
      // 1h candles for RSI and short-term indicators (last 50 candles)
      const klines1hResponse = await fetch(`${this.baseURL}/fapi/v1/klines?symbol=${symbol}&interval=1h&limit=100`);
      const klines1h = await klines1hResponse.json() as any[];
      
      // 4h candles for EMA50 (last 100 candles)
      const klines4hResponse = await fetch(`${this.baseURL}/fapi/v1/klines?symbol=${symbol}&interval=4h&limit=100`);
      const klines4h = await klines4hResponse.json() as any[];

      // Extract price data from K-lines
      const closes1h = klines1h.map(k => parseFloat(k[4])); // Close prices
      const highs1h = klines1h.map(k => parseFloat(k[2])); // High prices
      const lows1h = klines1h.map(k => parseFloat(k[3])); // Low prices
      const closes4h = klines4h.map(k => parseFloat(k[4]));

      // Calculate real technical indicators
      const rsi7 = this.calculateRSI(closes1h, 7);
      const rsi14 = this.calculateRSI(closes1h, 14);
      const ema20_3m = this.calculateEMA(closes1h, 20);
      const ema50_4h = this.calculateEMA(closes4h, 50);
      const macdData = this.calculateMACD(closes1h);
      const atr = this.calculateATR(highs1h, lows1h, closes1h, 14);

      return {
        symbol,
        currentPrice: parseFloat(ticker.lastPrice),
        priceChange24h: parseFloat(ticker.priceChangePercent),
        volume24h: parseFloat(ticker.quoteAssetVolume),
        highPrice24h: parseFloat(ticker.highPrice),
        lowPrice24h: parseFloat(ticker.lowPrice),
        openInterest: parseFloat(oiData.openInterest),
        liquidityUSD: parseFloat(oiData.openInterest) * parseFloat(ticker.lastPrice),
        fundingRate: fundingData[0] ? parseFloat(fundingData[0].fundingRate) : 0,
        rsi7,
        rsi14,
        ema20_3m,
        ema50_4h,
        macd: macdData.macd,
        histogram: macdData.histogram,
        atr,
      };
    } catch (error) {
      console.error(`Error fetching data for ${symbol}:`, error);
      return null;
    }
  }

  async getDefaultCoinPool(): Promise<string[]> {
    // Top major coins
    return [
      'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 
      'ADAUSDT', 'DOGEUSDT', 'MATICUSDT', 'LINKUSDT', 'AVAXUSDT',
      'DOTUSDT', 'LTCUSDT', 'BCHUSDT', 'UNIUSDT', 'ATOMUSDT',
      'XLMUSDT', 'NEARUSDT', 'APTUSDT', 'ARBUSDT', 'OPUSDT',
      'TRXUSDT', 'ICPUSDT', 'WLDUSDT', 'PEPEUSDT', 'RENDERUSDT'
    ];
  }

  async getTopCoins(): Promise<string[]> {
    // Fetch top coins by various metrics
    // This is a simplified version - in real implementation, use CoinGecko or similar
    return [
      'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
      'ADAUSDT', 'DOGEUSDT', 'MATICUSDT', 'LTCUSDT', 'BCHUSDT',
      'LINKUSDT', 'UNIUSDT', 'XLMUSDT', 'DOTUSDT', 'TRXUSDT',
      'ATOMUSDT', 'FILUSDT', 'ETCUSDT', 'NEARUSDT', 'FTMUSDT',
      'AVAXUSDT', 'ICPUSDT', 'APTUSDT', 'ARBUSDT', 'OPUSDT',
      'SUIUSDT', 'INJUSDT', 'WLDUSDT', 'SEIUSDT', 'TIAUSDT',
      'JUPUSDT', 'STXUSDT', 'RNDRUSDT', 'TAOUSDT', 'PENDLEUSDT',
      'RUNEUSDT', 'POLUSDT', 'PYTHUSDT', 'DYMUSDT', 'WIFUSDT',
      'PEPEUSDT', 'SHIBUSDT', 'FLOKIUSDT', 'BONKUSDT', 'ORDIUSDT',
      'AAVEUSDT', 'MKRUSDT', 'LDOUSDT', 'GMXUSDT', 'GRTUSDT',
    ];
  }
}

export const marketDataService = new MarketDataService();
