import { EMA, MACD, RSI, ATR } from 'technicalindicators';

export interface IndicatorData {
  rsi7?: number;
  rsi14?: number;
  ema20?: number;
  ema50?: number;
  macd?: number;
  macdSignal?: number;
  macdHistogram?: number;
  atr?: number;
}

export class IndicatorService {
  /**
   * Calculate RSI (Relative Strength Index)
   */
  static calculateRSI(prices: number[], period: number = 14): number | undefined {
    if (prices.length < period + 1) return undefined;

    try {
      const rsiValues = RSI.calculate({
        values: prices,
        period,
      });

      return rsiValues[rsiValues.length - 1];
    } catch (error) {
      console.error(`Failed to calculate RSI: ${error}`);
      return undefined;
    }
  }

  /**
   * Calculate EMA (Exponential Moving Average)
   */
  static calculateEMA(prices: number[], period: number = 20): number | undefined {
    if (prices.length < period) return undefined;

    try {
      const emaValues = EMA.calculate({
        values: prices,
        period,
      });

      return emaValues[emaValues.length - 1];
    } catch (error) {
      console.error(`Failed to calculate EMA: ${error}`);
      return undefined;
    }
  }

  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   */
  static calculateMACD(
    prices: number[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
  ): { macd?: number; signal?: number; histogram?: number } {
    if (prices.length < slowPeriod + signalPeriod) {
      return {};
    }

    try {
      const macdValues = MACD.calculate({
        values: prices,
        fastPeriod,
        slowPeriod,
        signalPeriod,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
      });

      const latest = macdValues[macdValues.length - 1];
      if (!latest) return {};

      return {
        macd: latest.MACD,
        signal: latest.signal,
        histogram: latest.histogram,
      };
    } catch (error) {
      console.error(`Failed to calculate MACD: ${error}`);
      return {};
    }
  }

  /**
   * Calculate ATR (Average True Range)
   */
  static calculateATR(
    high: number[],
    low: number[],
    close: number[],
    period: number = 14
  ): number | undefined {
    if (high.length < period + 1 || low.length < period + 1 || close.length < period + 1) {
      return undefined;
    }

    try {
      const atrValues = ATR.calculate({
        high,
        low,
        close,
        period,
      });

      return atrValues[atrValues.length - 1];
    } catch (error) {
      console.error(`Failed to calculate ATR: ${error}`);
      return undefined;
    }
  }

  /**
   * Calculate all indicators for 3-minute timeframe
   */
  static calculate3MinIndicators(
    prices: number[],
    volumes: number[]
  ): {
    rsi7?: number;
    ema20?: number;
    macd?: number;
    macdSignal?: number;
    macdHistogram?: number;
    volume?: number;
  } {
    const macdData = this.calculateMACD(prices);

    return {
      rsi7: this.calculateRSI(prices, 7),
      ema20: this.calculateEMA(prices, 20),
      macd: macdData.macd,
      macdSignal: macdData.signal,
      macdHistogram: macdData.histogram,
      volume: volumes[volumes.length - 1],
    };
  }

  /**
   * Calculate all indicators for 4-hour timeframe
   */
  static calculate4HourIndicators(
    high: number[],
    low: number[],
    close: number[]
  ): {
    rsi14?: number;
    ema20?: number;
    ema50?: number;
    atr?: number;
    trend?: 'bullish' | 'bearish' | 'neutral';
  } {
    const rsi14 = this.calculateRSI(close, 14);
    const ema20 = this.calculateEMA(close, 20);
    const ema50 = this.calculateEMA(close, 50);
    const atr = this.calculateATR(high, low, close, 14);

    // Determine trend based on EMA crossover
    let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (ema20 && ema50) {
      if (ema20 > ema50) {
        trend = 'bullish';
      } else if (ema20 < ema50) {
        trend = 'bearish';
      }
    }

    return {
      rsi14,
      ema20,
      ema50,
      atr,
      trend,
    };
  }

  /**
   * Detect volume surge (current volume vs average)
   */
  static detectVolumeSurge(volumes: number[], threshold: number = 2.0): boolean {
    if (volumes.length < 20) return false;

    const currentVolume = volumes[volumes.length - 1];
    const avgVolume = volumes.slice(-20, -1).reduce((a, b) => a + b, 0) / 19;

    return currentVolume > avgVolume * threshold;
  }

  /**
   * Calculate volatility (standard deviation of returns)
   */
  static calculateVolatility(prices: number[], period: number = 20): number | undefined {
    if (prices.length < period) return undefined;

    const recentPrices = prices.slice(-period);
    const returns = [];
    
    for (let i = 1; i < recentPrices.length; i++) {
      returns.push((recentPrices[i] - recentPrices[i - 1]) / recentPrices[i - 1]);
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  /**
   * Calculate trend strength (0-100)
   */
  static calculateTrendStrength(prices: number[], period: number = 14): number {
    if (prices.length < period) return 0;

    const recentPrices = prices.slice(-period);
    const firstPrice = recentPrices[0];
    const lastPrice = recentPrices[recentPrices.length - 1];
    
    // Calculate how consistently prices moved in one direction
    let upMoves = 0;
    let downMoves = 0;
    
    for (let i = 1; i < recentPrices.length; i++) {
      if (recentPrices[i] > recentPrices[i - 1]) {
        upMoves++;
      } else if (recentPrices[i] < recentPrices[i - 1]) {
        downMoves++;
      }
    }

    const consistency = Math.abs(upMoves - downMoves) / (period - 1);
    const magnitude = Math.abs((lastPrice - firstPrice) / firstPrice);
    
    return Math.min(100, (consistency * 50 + magnitude * 5000));
  }
}
