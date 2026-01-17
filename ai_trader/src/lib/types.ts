// Trading types and interfaces

export interface Position {
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  leverage: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  openTime: Date;
  stopLoss: number;
  takeProfit: number;
}

export interface Trade {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  leverage: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPercent: number;
  openTime: Date;
  closeTime: Date;
  duration: number; // in minutes
}

export interface AccountStatus {
  totalBalance: number;
  availableBalance: number;
  totalMarginUsed: number;
  marginUsagePercent: number;
  unrealizedPnL: number;
  dailyPnL: number;
  positionCount: number;
}

export interface MarketData {
  symbol: string;
  currentPrice: number;
  priceChange24h: number;
  volume24h: number;
  highPrice24h: number;
  lowPrice24h: number;
  openInterest: number;
  liquidityUSD: number;
  fundingRate: number;
  rsi7: number;
  rsi14: number;
  ema20_3m: number;
  ema50_4h: number;
  macd: number;
  histogram: number;
  atr: number;
}

export interface AIDecision {
  action: 'HOLD' | 'CLOSE_LONG' | 'CLOSE_SHORT' | 'OPEN_LONG' | 'OPEN_SHORT' | 'WAIT';
  symbol?: string;
  quantity?: number;
  leverage?: number;
  stopLoss?: number;
  takeProfit?: number;
  reasoning: string;
  confidence: number;
  chainOfThought: string;
  aiAgent?: string;
  // Support for multiple decisions
  decisions?: AIDecisionItem[];
}

export interface AIDecisionItem {
  action: 'CLOSE_LONG' | 'CLOSE_SHORT' | 'OPEN_LONG' | 'OPEN_SHORT';
  symbol: string;
  quantity?: number;
  leverage?: number;
  stopLoss?: number;
  takeProfit?: number;
  reasoning: string;
  confidence: number;
  priority?: number; // 1 = highest priority, higher numbers execute first
}

export interface PerformanceMetrics {
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  averageProfitUSDT: number;
  sharpeRatio: number;
  maxDrawdown: number;
  bestPerformingAssets: string[];
  worstPerformingAssets: string[];
}

export interface DecisionLog {
  cycleNumber: number;
  timestamp: Date;
  accountSnapshot: AccountStatus;
  positions: Position[];
  marketData: MarketData[];
  aiDecision: AIDecision;
  executionResult: {
    success: boolean;
    orderIds: string[];
    error?: string;
  };
  performance: PerformanceMetrics;
}

export interface TradingState {
  isRunning: boolean;
  currentCycle: number;
  lastDecisionTime: Date;
  accountStatus: AccountStatus;
  positions: Position[];
  recentTrades: Trade[];
  performance: PerformanceMetrics;
  lastError?: string;
}
