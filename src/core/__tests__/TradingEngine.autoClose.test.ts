import { TradingEngine } from '../../core/TradingEngine';
import { TradingDecision, AccountInfo, Position } from '../../types';

// Minimal mock trader implementing only needed methods
class MockTrader {
  name = 'MockTrader';
  isTestnet = true;
  closePositionCalls: any[] = [];
  openOrders: any[] = [];
  constructor(public positions: Position[]) {}
  async getAccountInfo() {
    return {
      totalEquity: 10000,
      availableBalance: 9000,
      totalMarginUsed: 1000,
      marginUsagePercent: 0.1,
      totalUnrealizedPnl: 0,
      totalPositions: this.positions.length,
      positions: this.positions,
    };
  }
  async getPositions() { return this.positions; }
  async getOpenOrders(symbol?: string) { return this.openOrders; }
  async closePosition(symbol: string, side: 'LONG'|'SHORT', quantity?: number) {
    this.closePositionCalls.push({ symbol, side, quantity });
    return {
      decision: { action: side === 'LONG' ? 'close_long' : 'close_short', symbol, quantity },
      success: true,
      orderId: 'mock-close-order',
      executedPrice: this.positions.find(p => p.symbol === symbol)?.currentPrice || 0,
      executedQuantity: quantity || 0,
      timestamp: Date.now(),
    };
  }
  // Minimal stubs for abstract interface
  async getMarketPrice(symbol: string) { const p = this.positions.find(p => p.symbol === symbol); return p?.currentPrice ?? 0; }
  async getKlines() { return []; }
  async getOpenInterest() { return 0; }
  async getFundingRate() { return 0; }
  async openPosition() { return { success: false, decision: {} }; }
  async cancelAllOrders() { return; }
  async setLeverage() { return; }
  async setMarginType() { return; }
  async getSymbolInfo() { return {}; }
  async formatQuantity(symbol: string, quantity: number) { return String(quantity); }
  async formatPrice(symbol: string, price: number) { return String(price); }
}

describe('TradingEngine.autoClosePositionsByTakeProfit', () => {
  test('should auto-close a LONG position when current price >= takeProfit and no TP order exists', async () => {
    const pos: Position = {
      symbol: 'BTCUSDT',
      side: 'LONG',
      quantity: 1,
      entryPrice: 100,
      currentPrice: 105,
      leverage: 1,
      unrealizedPnl: 5,
      unrealizedPnlPercent: 5,
      marginType: 'cross',
      openTime: Date.now() - 1000,
    };

    const mockTrader = new MockTrader([pos]);
    const aiEngineStub: any = { makeDecision: async () => ({ decisions: [], chainOfThought: '', fullPrompt: '' }) };

    const config: any = {
      mode: 'testnet', decisionInterval: 100000, maxPositions: 5,
      maxLeverageAltcoin: 20, maxLeverageMajor: 50, maxPositionSizeAltcoinMultiplier: 1.5, maxPositionSizeMajorMultiplier: 10,
      maxMarginUsage: 0.9, minRiskRewardRatio: 2.0, minLiquidityUSD: 15000000, coinSelectionMode: 'default', topAI500Count: 20, topOICount: 20, aiProvider: 'qwen', historicalCyclesCount: 20,
    };

    const engine = new TradingEngine(mockTrader as any, aiEngineStub, config as any, 'test-trader');

    // Create an open trade in the engine's PerformanceTracker for that symbol with takeProfit 103
    const perf = (engine as any).performanceTracker;
    await perf.recordOpenTrade({
      traderId: 'test-trader', symbol: 'BTCUSDT', side: 'LONG', symbolSide: 'BTCUSDT_LONG',
      entryPrice: 100, quantity: 1, leverage: 1, openTime: Date.now(), openOrderId: 'order-1', stopLoss: 98, takeProfit: 103, status: 'open'
    });

    // Call auto-close
    await (engine as any).autoClosePositionsByTakeProfit([pos], await mockTrader.getAccountInfo());

    expect(mockTrader.closePositionCalls.length).toBeGreaterThanOrEqual(1);
    expect(mockTrader.closePositionCalls[0].symbol).toBe('BTCUSDT');
  });
});
