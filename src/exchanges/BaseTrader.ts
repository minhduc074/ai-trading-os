import { ITrader, Position, Order, AccountInfo, Kline, ExecutionResult } from '../types';

// Re-export ITrader for convenience
export { ITrader };

/**
 * Abstract base class for all exchange traders
 * Provides unified interface for trading across different exchanges
 */
export abstract class BaseTrader implements ITrader {
  abstract name: string;
  abstract isTestnet: boolean;

  // Account operations
  abstract getAccountInfo(): Promise<AccountInfo>;
  abstract getPositions(): Promise<Position[]>;
  abstract getOpenOrders(symbol?: string): Promise<Order[]>;

  // Market operations
  abstract getMarketPrice(symbol: string): Promise<number>;
  abstract getKlines(symbol: string, interval: string, limit?: number): Promise<Kline[]>;
  abstract getOpenInterest(symbol: string): Promise<number>;
  abstract getFundingRate(symbol: string): Promise<number>;

  // Trading operations
  abstract openPosition(
    symbol: string,
    side: 'LONG' | 'SHORT',
    quantity: number,
    leverage: number,
    stopLoss?: number,
    takeProfit?: number
  ): Promise<ExecutionResult>;

  abstract closePosition(
    symbol: string,
    side: 'LONG' | 'SHORT',
    quantity?: number
  ): Promise<ExecutionResult>;

  abstract cancelAllOrders(symbol?: string): Promise<void>;
  abstract setLeverage(symbol: string, leverage: number): Promise<void>;
  abstract setMarginType(symbol: string, marginType: 'ISOLATED' | 'CROSSED'): Promise<void>;

  // Precision helpers
  abstract formatQuantity(symbol: string, quantity: number): Promise<string>;
  abstract formatPrice(symbol: string, price: number): Promise<string>;
  abstract getSymbolInfo(symbol: string): Promise<any>;

  // Utility methods
  protected calculatePositionDuration(openTime: number): string {
    const durationMs = Date.now() - openTime;
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}min`;
  }

  protected log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.name}]`;
    
    switch (level) {
      case 'info':
        console.log(`${prefix} ${message}`);
        break;
      case 'warn':
        console.warn(`${prefix} ⚠️  ${message}`);
        break;
      case 'error':
        console.error(`${prefix} ❌ ${message}`);
        break;
    }
  }
}
