import { ITrader } from '../exchanges/BaseTrader';
import { MarketData, Kline } from '../types';
import { IndicatorService } from './IndicatorService';

/**
 * Universal Market Data Service
 * Fetches and processes multi-timeframe data with technical indicators
 */
export class MarketDataService {
  private trader: ITrader;
  private minLiquidityUSD: number;

  constructor(trader: ITrader, minLiquidityUSD: number = 15000000) {
    this.trader = trader;
    this.minLiquidityUSD = minLiquidityUSD;
  }

  /**
   * Get default coin pool (major cryptocurrencies)
   */
  getDefaultCoinPool(): string[] {
    return [
      'BTCUSDT',
      'ETHUSDT',
      'SOLUSDT',
      'BNBUSDT',
      'XRPUSDT',
      'ADAUSDT',
      'DOGEUSDT',
      'DOTUSDT',
      'AVAXUSDT',
      'LINKUSDT',
      'UNIUSDT',
      'ATOMUSDT',
      'LTCUSDT',
      'NEARUSDT',
      'APTUSDT',
      'ARBUSDT',
      'OPUSDT',
      'INJUSDT',
      'SUIUSDT',
    ];
  }

  /**
   * Get advanced coin pool (AI500 top 20 + OI top 20)
   * This is a placeholder - in production, you'd fetch from actual data sources
   */
  async getAdvancedCoinPool(): Promise<string[]> {
    // In production, fetch from:
    // - AI500 API for top performing coins
    // - Exchange API for top open interest coins
    
    // For now, return extended default pool
    const defaultPool = this.getDefaultCoinPool();
    const additionalCoins = [
      'SEIUSDT',
      'TIAUSDT',
      'WLDUSDT',
      'RNDRUSDT',
      'PENDLEUSDT',
      'ARUSDT',
      'STXUSDT',
      'THETAUSDT',
      'GALAUSDT',
      'FETUSDT',
    ];
    
    return [...new Set([...defaultPool, ...additionalCoins])];
  }

  /**
   * Get candidate coins based on mode
   */
  async getCandidateCoins(mode: 'default' | 'advanced' = 'default'): Promise<string[]> {
    if (mode === 'default') {
      return this.getDefaultCoinPool();
    }
    
    return await this.getAdvancedCoinPool();
  }

  /**
   * Filter coins by liquidity (Open Interest)
   */
  async filterByLiquidity(symbols: string[]): Promise<string[]> {
    const filtered: string[] = [];

    for (const symbol of symbols) {
      try {
        const oi = await this.trader.getOpenInterest(symbol);
        
        if (oi >= this.minLiquidityUSD) {
          filtered.push(symbol);
        } else {
          console.log(`Filtered out ${symbol}: OI ${oi.toFixed(0)} < ${this.minLiquidityUSD}`);
        }
      } catch (error: any) {
        console.warn(`Failed to check liquidity for ${symbol}: ${error.message}`);
      }
    }

    return filtered;
  }

  /**
   * Fetch comprehensive market data for a symbol
   */
  async getMarketData(symbol: string): Promise<MarketData | null> {
    try {
      // Fetch data in parallel
      const [
        currentPrice,
        klines3m,
        klines4h,
        openInterest,
        fundingRate,
      ] = await Promise.all([
        this.trader.getMarketPrice(symbol),
        this.trader.getKlines(symbol, '3m', 100),
        this.trader.getKlines(symbol, '4h', 100),
        this.trader.getOpenInterest(symbol),
        this.trader.getFundingRate(symbol),
      ]);

      // Calculate 24h change
      const price24hAgo = klines4h.length >= 6 ? klines4h[klines4h.length - 6].close : klines4h[0].close;
      const priceChange24h = currentPrice - price24hAgo;
      const priceChangePercent24h = (priceChange24h / price24hAgo) * 100;

      // Calculate volume
      const volume24h = klines4h.slice(-6).reduce((sum, k) => sum + k.quoteAssetVolume, 0);

      // Extract price and volume sequences
      const prices3m = klines3m.map(k => k.close);
      const volumes3m = klines3m.map(k => k.volume);
      const prices4h = klines4h.map(k => k.close);
      const highs4h = klines4h.map(k => k.high);
      const lows4h = klines4h.map(k => k.low);

      // Calculate indicators
      const indicators3m = IndicatorService.calculate3MinIndicators(prices3m, volumes3m);
      const indicators4h = IndicatorService.calculate4HourIndicators(highs4h, lows4h, prices4h);

      // Get OI change (approximate)
      const oiChange24h = 0; // Would need historical OI data

      return {
        symbol,
        currentPrice,
        priceChange24h,
        priceChangePercent24h,
        volume24h,
        openInterest,
        openInterestChange24h: oiChange24h,
        fundingRate,
        nextFundingTime: Date.now() + 8 * 60 * 60 * 1000, // Approximate
        
        indicators3m: {
          rsi7: indicators3m.rsi7 || 0,
          macd: indicators3m.macd || 0,
          macdSignal: indicators3m.macdSignal || 0,
          macdHistogram: indicators3m.macdHistogram || 0,
          ema20: indicators3m.ema20 || 0,
          volume: indicators3m.volume || 0,
          priceSequence: prices3m.slice(-50), // Last 50 prices for AI
          volumeSequence: volumes3m.slice(-50),
        },
        
        indicators4h: {
          rsi14: indicators4h.rsi14 || 0,
          ema20: indicators4h.ema20 || 0,
          ema50: indicators4h.ema50 || 0,
          atr: indicators4h.atr || 0,
          trend: indicators4h.trend,
          priceSequence: prices4h.slice(-50), // Last 50 prices for AI
        },
        
        timestamp: Date.now(),
      };
    } catch (error: any) {
      console.error(`Failed to get market data for ${symbol}: ${error.message}`);
      return null;
    }
  }

  /**
   * Batch fetch market data for multiple symbols
   */
  async batchGetMarketData(symbols: string[]): Promise<MarketData[]> {
    console.log(`Fetching market data for ${symbols.length} symbols...`);
    
    const marketDataPromises = symbols.map(symbol => this.getMarketData(symbol));
    const results = await Promise.allSettled(marketDataPromises);

    const marketData: MarketData[] = [];
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled' && result.value) {
        marketData.push(result.value);
      } else if (result.status === 'rejected') {
        console.warn(`Failed to fetch data for ${symbols[i]}: ${result.reason}`);
      }
    }

    console.log(`Successfully fetched data for ${marketData.length}/${symbols.length} symbols`);
    return marketData;
  }

  /**
   * Get market data for existing positions
   */
  async getMarketDataForPositions(positions: any[]): Promise<Map<string, MarketData>> {
    const symbols = [...new Set(positions.map(p => p.symbol))];
    const marketDataList = await this.batchGetMarketData(symbols);
    
    const marketDataMap = new Map<string, MarketData>();
    for (const data of marketDataList) {
      marketDataMap.set(data.symbol, data);
    }
    
    return marketDataMap;
  }

  /**
   * Analyze market opportunities
   */
  analyzeOpportunities(marketData: MarketData[]): MarketData[] {
    return marketData
      .map(data => {
        // Calculate opportunity score (0-100)
        let score = 0;

        // Volume surge
        if (data.indicators3m.volumeSequence && data.indicators3m.volumeSequence.length > 1) {
          const volumes = data.indicators3m.volumeSequence;
          const currentVol = volumes[volumes.length - 1];
          const avgVol = volumes.slice(0, -1).reduce((a, b) => a + b, 0) / (volumes.length - 1);
          
          if (currentVol > avgVol * 2) {
            score += 20;
          }
        }

        // RSI conditions
        const rsi7 = data.indicators3m.rsi7;
        const rsi14 = data.indicators4h.rsi14;
        
        if (rsi7 < 30 || rsi14 < 30) {
          score += 15; // Oversold
        } else if (rsi7 > 70 || rsi14 > 70) {
          score += 15; // Overbought
        }

        // Trend alignment
        if (data.indicators4h.trend === 'bullish' && data.indicators3m.macdHistogram > 0) {
          score += 20;
        } else if (data.indicators4h.trend === 'bearish' && data.indicators3m.macdHistogram < 0) {
          score += 20;
        }

        // Volatility
        if (data.indicators4h.atr > 0) {
          const volatilityScore = Math.min(15, (data.indicators4h.atr / data.currentPrice) * 1000);
          score += volatilityScore;
        }

        // Strong momentum
        if (Math.abs(data.priceChangePercent24h) > 5) {
          score += 10;
        }

        return { ...data, opportunityScore: score };
      })
      .sort((a: any, b: any) => (b.opportunityScore || 0) - (a.opportunityScore || 0));
  }
}
