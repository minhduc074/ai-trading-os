// Market Data Service

import type { MarketData } from '@/lib/types';

export class MarketDataService {
  private baseURL = 'https://fapi.binance.com';

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

      // Mock technical indicators (in real implementation, calculate from K-lines)
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
        rsi7: 50 + Math.random() * 30 - 15, // Mock RSI
        rsi14: 50 + Math.random() * 40 - 20,
        ema20_3m: parseFloat(ticker.lastPrice) * (0.95 + Math.random() * 0.1),
        ema50_4h: parseFloat(ticker.lastPrice) * (0.93 + Math.random() * 0.14),
        macd: Math.random() - 0.5,
        histogram: Math.random() - 0.5,
        atr: parseFloat(ticker.lastPrice) * 0.02,
      };
    } catch (error) {
      console.error(`Error fetching data for ${symbol}:`, error);
      return null;
    }
  }

  async getDefaultCoinPool(): Promise<string[]> {
    // Top major coins
    return ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'MATICUSDT', 'LINKUSDT', 'AVAXUSDT'];
  }

  async getTopCoins(): Promise<string[]> {
    // Fetch top coins by various metrics
    // This is a simplified version - in real implementation, use CoinGecko or similar
    return [
      'BTCUSDT',
      'ETHUSDT',
      'BNBUSDT',
      'SOLUSDT',
      'XRPUSDT',
      'ADAUSDT',
      'DOGEUSDT',
      'MATICUSDT',
      'LTCUSDT',
      'BCHUSDT',
      'LINKUSDT',
      'UNIUSDT',
      'XLMUSDT',
      'DOTUSDT',
      'TRXUSDT',
      'ATOMUSDT',
      'FILUSDT',
      'ETCUSDT',
      'NEARUSDT',
      'FTMUSDT',
    ];
  }
}

export const marketDataService = new MarketDataService();
