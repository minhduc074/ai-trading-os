// Core Trading Types
export interface Position {
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  leverage: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  liquidationPrice?: number;
  marginType: 'isolated' | 'cross';
  openTime: number; // timestamp
  duration?: string; // e.g., "2h 15min"
}

export interface Order {
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET' | 'STOP' | 'TAKE_PROFIT';
  positionSide: 'LONG' | 'SHORT' | 'BOTH';
  quantity: number;
  price?: number;
  stopPrice?: number;
  status: 'NEW' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELED' | 'REJECTED';
  executedQty: number;
  executedPrice?: number;
  timestamp: number;
}

export interface AccountInfo {
  totalEquity: number; // in USDT
  availableBalance: number;
  totalMarginUsed: number;
  marginUsagePercent: number;
  totalUnrealizedPnl: number;
  totalPositions: number;
  positions: Position[];
  dailyPnl?: number;
  maxDrawdown?: number;
}

export interface MarketData {
  symbol: string;
  currentPrice: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  volume24h: number;
  openInterest?: number; // in USD
  openInterestChange24h?: number;
  fundingRate?: number;
  nextFundingTime?: number;
  
  // Technical indicators - 3min timeframe
  indicators3m: {
    rsi7: number;
    macd: number;
    macdSignal: number;
    macdHistogram: number;
    ema20: number;
    volume: number;
    priceSequence?: number[]; // last N prices for AI analysis
    volumeSequence?: number[]; // last N volumes
  };
  
  // Technical indicators - 4hour timeframe
  indicators4h: {
    rsi14: number;
    ema20: number;
    ema50: number;
    atr: number;
    trend?: 'bullish' | 'bearish' | 'neutral';
    priceSequence?: number[]; // last N prices for AI analysis
  };
  
  timestamp: number;
}

export interface Kline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  quoteAssetVolume: number;
  numberOfTrades: number;
}

// Trading Decision Types
export interface TradingDecision {
  action: 'close_long' | 'close_short' | 'open_long' | 'open_short' | 'hold' | 'wait';
  symbol?: string;
  quantity?: number;
  leverage?: number;
  stopLoss?: number;
  takeProfit?: number;
  reasoning: string; // Chain of Thought
  confidence?: number;
  riskRewardRatio?: number;
}

export interface DecisionLog {
  timestamp: number;
  traderId: string;
  cycleNumber: number;
  
  // Input context
  accountSnapshot: AccountInfo;
  marketDataSnapshot: MarketData[];
  historicalFeedback: HistoricalFeedback;
  
  // AI Decision
  chainOfThought: string;
  decision: TradingDecision[];
  aiPrompt?: string;
  aiResponse?: string;
  
  // Execution results
  executionResults: ExecutionResult[];
  
  // Performance after execution
  postExecutionEquity: number;
}

export interface ExecutionResult {
  decision: TradingDecision;
  success: boolean;
  orderId?: string;
  executedPrice?: number;
  executedQuantity?: number;
  error?: string;
  timestamp: number;
}

// Performance Tracking Types
export interface TradeRecord {
  id?: number;
  traderId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  symbolSide: string; // "BTCUSDT_LONG" to prevent conflicts
  
  // Entry
  entryPrice: number;
  quantity: number;
  leverage: number;
  openTime: number;
  openOrderId?: string;
  
  // Exit
  exitPrice?: number;
  closeTime?: number;
  closeOrderId?: string;
  
  // Performance
  pnl?: number; // in USDT, calculated with leverage
  pnlPercent?: number;
  holdingDuration?: number; // in milliseconds
  
  // Metadata
  stopLoss?: number;
  takeProfit?: number;
  status: 'open' | 'closed';
  closeReason?: 'stop_loss' | 'take_profit' | 'manual' | 'ai_decision';
}

export interface HistoricalFeedback {
  totalCycles: number;
  winRate: number; // percentage
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  averageProfit: number; // in USDT
  averageLoss: number; // in USDT
  profitFactor: number; // gross profit / gross loss
  sharpeRatio?: number;
  maxDrawdown?: number;
  
  // Per-coin statistics
  perCoinStats: CoinPerformance[];
  
  // Best/Worst performers
  bestCoins: CoinPerformance[];
  worstCoins: CoinPerformance[];
  
  // Recent trades (last 5)
  recentTrades: TradeRecord[];
  
  // Pattern analysis
  consecutiveLosses?: number;
  consecutiveWins?: number;
  avoidSymbols?: string[]; // Symbols to avoid due to poor performance
  favorSymbols?: string[]; // Symbols with good performance
}

export interface CoinPerformance {
  symbol: string;
  totalTrades: number;
  winRate: number;
  averagePnl: number; // in USDT
  totalPnl: number;
  bestTrade: number;
  worstTrade: number;
}

export interface EquitySnapshot {
  timestamp: number;
  traderId: string;
  equity: number;
  dailyPnl: number;
  dailyPnlPercent: number;
}

// Exchange Trader Interface
export interface ITrader {
  name: string;
  isTestnet: boolean;
  
  // Account operations
  getAccountInfo(): Promise<AccountInfo>;
  getPositions(): Promise<Position[]>;
  getOpenOrders(symbol?: string): Promise<Order[]>;
  
  // Market operations
  getMarketPrice(symbol: string): Promise<number>;
  getKlines(symbol: string, interval: string, limit?: number): Promise<Kline[]>;
  getOpenInterest(symbol: string): Promise<number>;
  getFundingRate(symbol: string): Promise<number>;
  
  // Trading operations
  openPosition(
    symbol: string,
    side: 'LONG' | 'SHORT',
    quantity: number,
    leverage: number,
    stopLoss?: number,
    takeProfit?: number
  ): Promise<ExecutionResult>;
  
  closePosition(
    symbol: string,
    side: 'LONG' | 'SHORT',
    quantity?: number
  ): Promise<ExecutionResult>;
  
  cancelAllOrders(symbol?: string): Promise<void>;
  setLeverage(symbol: string, leverage: number): Promise<void>;
  setMarginType(symbol: string, marginType: 'ISOLATED' | 'CROSSED'): Promise<void>;
  
  // Precision helpers
  formatQuantity(symbol: string, quantity: number): Promise<string>;
  formatPrice(symbol: string, price: number): Promise<string>;
  getSymbolInfo(symbol: string): Promise<any>;
}

// Configuration Types
export interface TradingConfig {
  mode: 'mainnet' | 'testnet';
  decisionInterval: number; // milliseconds
  maxPositions: number;
  
  // Risk management
  maxLeverageAltcoin: number;
  maxLeverageMajor: number;
  maxPositionSizeAltcoinMultiplier: number;
  maxPositionSizeMajorMultiplier: number;
  maxMarginUsage: number; // 0-1
  minRiskRewardRatio: number;
  
  // Market data
  minLiquidityUSD: number;
  coinSelectionMode: 'default' | 'advanced';
  topAI500Count: number;
  topOICount: number;
  
  // AI
  aiProvider: 'deepseek' | 'qwen';
  historicalCyclesCount: number;
}

// Risk Management Types
export interface RiskCheckResult {
  allowed: boolean;
  reason?: string;
  adjustedQuantity?: number;
  adjustedLeverage?: number;
}

export interface PositionLimit {
  maxPositionValue: number; // in USDT
  maxLeverage: number;
  currentExposure: number;
  availableRoom: number;
}
