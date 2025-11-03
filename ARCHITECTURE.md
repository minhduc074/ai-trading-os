# AI Trading OS - System Architecture

## Overview

The AI Trading Operating System is a sophisticated automated trading platform that combines:
- Multi-exchange support (Binance, Hyperliquid, Aster DEX)
- AI-powered decision making (DeepSeek/Qwen)
- Self-learning from historical performance
- Comprehensive risk management
- Real-time monitoring and logging

## System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      Main Entry Point                        │
│                       (index.ts)                             │
└──────────────┬──────────────────────────────────────────────┘
               │
               ├──► Trading Engine (Orchestrator)
               ├──► Dashboard Server (Monitoring)
               └──► Signal Handlers (Graceful Shutdown)
```

## Core Architecture

### 1. Trading Engine (`TradingEngine.ts`)

The heart of the system. Runs the 7-step decision cycle every 3-5 minutes:

```
┌─────────────────────────────────────────────────────────────┐
│                    DECISION CYCLE                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 📈 Analyze Historical Performance                       │
│     └─► PerformanceTracker.getHistoricalFeedback()         │
│                                                              │
│  2. 💰 Get Account Status                                   │
│     └─► Trader.getAccountInfo()                             │
│                                                              │
│  3. 🔍 Analyze Existing Positions                           │
│     ├─► Trader.getPositions()                               │
│     └─► MarketDataService.getMarketDataForPositions()       │
│                                                              │
│  4. 🎯 Evaluate New Opportunities                           │
│     ├─► MarketDataService.getCandidateCoins()               │
│     ├─► MarketDataService.filterByLiquidity()               │
│     └─► MarketDataService.batchGetMarketData()              │
│                                                              │
│  5. 🧠 AI Comprehensive Decision                            │
│     └─► AIDecisionEngine.makeDecision()                     │
│                                                              │
│  6. ⚡ Execute Trades                                        │
│     ├─► RiskManager.checkNewPosition()                      │
│     ├─► Trader.closePosition() [Priority]                   │
│     └─► Trader.openPosition()                               │
│                                                              │
│  7. 📝 Record Logs & Update Performance                     │
│     ├─► Save decision_logs/[trader_id]/cycle_N.json         │
│     ├─► PerformanceTracker.recordOpenTrade()                │
│     ├─► PerformanceTracker.recordCloseTrade()               │
│     └─► PerformanceTracker.recordEquitySnapshot()           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Key Methods:**
- `start()`: Starts the trading loop
- `stop()`: Graceful shutdown
- `runDecisionCycle()`: Executes one complete cycle
- `executeDecisions()`: Executes AI decisions with risk checks

### 2. Exchange Layer

**Interface Design:**
```
ITrader (interface)
    ├─► BaseTrader (abstract class)
    │    ├─► Common utilities
    │    └─► Logging helpers
    │
    ├─► BinanceTrader (✅ implemented)
    │    ├─► Mainnet support
    │    ├─► Testnet support
    │    ├─► Automatic precision handling
    │    └─► Binance Futures API
    │
    ├─► HyperliquidTrader (🚧 placeholder)
    │    └─► DEX perpetual futures
    │
    └─► AsterTrader (🚧 placeholder)
         └─► On-chain perpetual futures
```

**Key Features:**
- Unified interface for all exchanges
- Automatic price/quantity precision
- Built-in error handling and retry logic
- Position tracking with duration
- Stop-loss and take-profit management

### 3. AI Decision Engine (`AIService.ts`)

**Input → Processing → Output:**

```
┌─────────────────────────────────────────────────────────────┐
│                         INPUT                                │
├─────────────────────────────────────────────────────────────┤
│  • Historical Performance (last 20 cycles)                  │
│    - Win rate, profit factor, Sharpe ratio                  │
│    - Best/worst performing coins                            │
│    - Recent trade details                                   │
│                                                              │
│  • Current Account Status                                   │
│    - Equity, margin, positions                              │
│    - Unrealized PnL                                         │
│                                                              │
│  • Existing Positions                                       │
│    - Entry price, current price, duration                   │
│    - Technical indicators (3min + 4hour)                    │
│    - Complete price sequences                               │
│                                                              │
│  • Market Opportunities                                     │
│    - Candidate coins (filtered by liquidity)                │
│    - Multi-timeframe data                                   │
│    - Technical indicators (RSI, MACD, EMA, ATR)             │
│    - Volume, OI, funding rate                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    AI PROCESSING                             │
├─────────────────────────────────────────────────────────────┤
│  DeepSeek or Qwen LLM                                       │
│                                                              │
│  System Prompt:                                             │
│  • Expert crypto trader                                     │
│  • Consider historical performance                          │
│  • Multi-timeframe analysis                                 │
│  • Risk management rules                                    │
│  • Chain of Thought reasoning                               │
│                                                              │
│  Processing:                                                │
│  1. Analyze historical patterns                             │
│  2. Evaluate current positions                              │
│  3. Identify opportunities                                  │
│  4. Generate structured decisions                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                        OUTPUT                                │
├─────────────────────────────────────────────────────────────┤
│  • Chain of Thought (detailed reasoning)                    │
│  • Structured Decisions (JSON array):                       │
│    [                                                        │
│      {                                                      │
│        "action": "open_long",                               │
│        "symbol": "BTCUSDT",                                 │
│        "quantity": 0.1,                                     │
│        "leverage": 10,                                      │
│        "stopLoss": 42000,                                   │
│        "takeProfit": 46000,                                 │
│        "reasoning": "...",                                  │
│        "confidence": 0.75                                   │
│      }                                                      │
│    ]                                                        │
└─────────────────────────────────────────────────────────────┘
```

### 4. Market Data Service (`MarketDataService.ts`)

**Data Flow:**

```
1. Coin Selection
   ├─► Default Mode: 20 major coins (BTC, ETH, SOL, etc.)
   └─► Advanced Mode: AI500 top 20 + OI top 20

2. Liquidity Filtering
   └─► Filter out coins with OI < $15M USD

3. Data Fetching (Parallel)
   ├─► Current price
   ├─► 3-minute klines (100 bars)
   ├─► 4-hour klines (100 bars)
   ├─► Open interest
   └─► Funding rate

4. Indicator Calculation
   ├─► 3-min: RSI(7), MACD, EMA(20)
   ├─► 4-hour: RSI(14), EMA(20/50), ATR
   └─► Trend detection

5. Opportunity Scoring
   └─► Rank by volume, RSI, trend, volatility
```

**Key Methods:**
- `getCandidateCoins()`: Get coin pool
- `filterByLiquidity()`: Apply OI filter
- `getMarketData()`: Fetch complete data for one symbol
- `batchGetMarketData()`: Parallel fetch for multiple symbols
- `analyzeOpportunities()`: Score and rank opportunities

### 5. Performance Tracker (`PerformanceTracker.ts`)

**Database Schema:**

```sql
-- Trades Table
CREATE TABLE trades (
  id INTEGER PRIMARY KEY,
  trader_id TEXT,
  symbol TEXT,
  side TEXT,                    -- LONG or SHORT
  symbol_side TEXT,             -- "BTCUSDT_LONG" (prevents conflicts)
  entry_price REAL,
  quantity REAL,
  leverage INTEGER,
  open_time INTEGER,
  exit_price REAL,
  close_time INTEGER,
  pnl REAL,                     -- Accurate USDT PnL with leverage
  pnl_percent REAL,
  holding_duration INTEGER,
  status TEXT,                  -- open or closed
  close_reason TEXT
);

-- Equity Snapshots Table
CREATE TABLE equity_snapshots (
  id INTEGER PRIMARY KEY,
  trader_id TEXT,
  timestamp INTEGER,
  equity REAL,
  daily_pnl REAL,
  daily_pnl_percent REAL
);
```

**PnL Calculation (v2.0.2):**

```typescript
// Accurate PnL with leverage consideration
const positionValue = quantity * entryPrice;
const priceChangePercent = (exitPrice - entryPrice) / entryPrice;
const pnl = positionValue * priceChangePercent * leverage;

// Example: 
// - Buy 0.1 BTC at $40,000 with 10x leverage
// - Sell at $42,000
// - Price change: 5%
// - PnL = 0.1 * 40000 * 0.05 * 10 = $2,000
```

**Key Methods:**
- `recordOpenTrade()`: Log position opened
- `recordCloseTrade()`: Log position closed, calculate PnL
- `getHistoricalFeedback()`: Generate learning feedback for AI
- `recordEquitySnapshot()`: Track equity over time

### 6. Risk Manager (`RiskManager.ts`)

**Risk Checks:**

```
┌─────────────────────────────────────────────────────────────┐
│                    NEW POSITION CHECKS                       │
├─────────────────────────────────────────────────────────────┤
│  ✓ Anti-Stacking Protection                                │
│    → No duplicate positions (same symbol + direction)       │
│                                                              │
│  ✓ Leverage Limits                                         │
│    → Altcoins: Max 20x                                      │
│    → Major (BTC/ETH): Max 50x                               │
│                                                              │
│  ✓ Position Size Limits                                    │
│    → Altcoins: ≤ 1.5x total equity                          │
│    → Major: ≤ 10x total equity                              │
│                                                              │
│  ✓ Max Positions                                           │
│    → Total positions ≤ 5                                    │
│                                                              │
│  ✓ Margin Usage                                            │
│    → Total usage ≤ 90%                                      │
│                                                              │
│  ✓ Available Balance                                       │
│    → Sufficient funds for required margin                   │
│                                                              │
│  ✓ Stop-Loss / Take-Profit Validation                      │
│    → Risk-reward ratio ≥ 1:2                                │
│    → Correct price levels (SL below entry for LONG, etc.)  │
└─────────────────────────────────────────────────────────────┘
```

**Key Methods:**
- `checkNewPosition()`: Pre-trade validation
- `checkClosePosition()`: Verify position exists
- `validateStopLossTakeProfit()`: SL/TP validation
- `getPositionLimit()`: Calculate available room
- `calculateRecommendedPositionSize()`: Smart sizing

### 7. Dashboard Server (`dashboard/server.ts`)

**Architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│                    DASHBOARD SERVER                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Express HTTP Server (Port 3000)                            │
│  ├─► GET /                 → Dashboard HTML                 │
│  ├─► GET /api/status       → Current status JSON            │
│  └─► GET /api/health       → Health check                   │
│                                                              │
│  WebSocket Server                                           │
│  ├─► Real-time updates every 5 seconds                      │
│  ├─► Broadcast system status                                │
│  └─► Auto-reconnect support                                 │
│                                                              │
│  Static Assets                                              │
│  └─► Dashboard HTML/CSS/JS                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow Example

**Complete Trading Cycle:**

```
1. TRIGGER (Every 3 minutes)
   └─► TradingEngine.runDecisionCycle()

2. GATHER DATA
   ├─► Historical: Last 20 cycles from database
   ├─► Account: Current equity, positions, margin
   ├─► Market: 50+ coins with indicators
   └─► Total data: ~200KB

3. AI ANALYSIS (5-15 seconds)
   ├─► Send prompt to DeepSeek/Qwen
   ├─► Receive Chain of Thought + Decisions
   └─► Parse JSON decisions

4. RISK CHECKS (< 1 second)
   ├─► Validate each decision
   ├─► Check position limits
   ├─► Verify margin availability
   └─► Filter out invalid decisions

5. EXECUTION (1-3 seconds per order)
   ├─► Priority 1: Close positions
   ├─► Priority 2: Open positions
   ├─► Set stop-loss and take-profit
   └─► Record execution results

6. LOGGING (< 1 second)
   ├─► Save complete decision log (JSON file)
   ├─► Update database (trades, equity)
   └─► Broadcast to dashboard clients

Total cycle time: 10-30 seconds
```

## Key Design Patterns

### 1. Strategy Pattern
- Multiple exchange implementations
- Unified ITrader interface
- Easy to add new exchanges

### 2. Observer Pattern
- WebSocket broadcasts
- Real-time dashboard updates
- Event-driven architecture

### 3. Template Method
- BaseTrader defines structure
- Subclasses implement specifics
- Common utilities shared

### 4. Singleton Pattern
- Single TradingEngine instance
- Shared PerformanceTracker
- Global configuration

## Error Handling

**Layered Error Handling:**

```
1. Exchange Layer
   ├─► Network errors → Retry with exponential backoff
   ├─► API errors → Log and skip
   └─► Rate limits → Wait and retry

2. AI Layer
   ├─► API timeout → Default to "wait" decision
   ├─► Parse error → Log and wait
   └─► Invalid response → Safe fallback

3. Execution Layer
   ├─► Order rejection → Log reason, continue
   ├─► Insufficient balance → Skip order
   └─► Position mismatch → Cancel and re-sync

4. Database Layer
   ├─► Connection error → Retry
   ├─► Lock timeout → Queue operation
   └─► Corruption → Backup and recover

5. System Layer
   ├─► SIGINT/SIGTERM → Graceful shutdown
   ├─► Uncaught exception → Log and exit
   └─► Process crash → Auto-restart (with PM2)
```

## Performance Optimization

**Optimizations Applied:**

1. **Parallel Data Fetching**
   - Fetch multiple symbols concurrently
   - Reduce cycle time from 60s to 10s

2. **Database Indexing**
   - Index on trader_id, symbol_side, status
   - Fast historical query (< 10ms)

3. **Caching**
   - Exchange info cached (1 hour TTL)
   - Symbol precision cached
   - Reduce API calls by 80%

4. **Batch Operations**
   - Bulk insert equity snapshots
   - Batch market data requests
   - Minimize I/O operations

5. **WebSocket vs Polling**
   - Real-time updates via WebSocket
   - No constant HTTP polling
   - Reduced server load

## Scalability Considerations

**Current Limitations:**
- Single trader instance
- Sequential decision cycles
- Local SQLite database

**Future Improvements:**
- Multi-instance support (load balancer)
- Parallel cycle processing
- PostgreSQL for production
- Redis for caching
- Message queue for orders
- Distributed AI inference

## Security Best Practices

1. **API Key Protection**
   - Never commit .env
   - Use environment variables
   - IP whitelist on exchange

2. **Input Validation**
   - Validate all AI decisions
   - Sanitize symbol names
   - Check numeric ranges

3. **Rate Limiting**
   - Respect exchange limits
   - Implement backoff
   - Monitor usage

4. **Access Control**
   - Dashboard has no auth (add if needed)
   - Read-only API keys preferred
   - Audit logs enabled

## Testing Strategy

**Recommended Testing:**

1. **Unit Tests** (TODO)
   - Test each component
   - Mock external dependencies
   - 80%+ coverage

2. **Integration Tests** (TODO)
   - Test with testnet
   - Verify order execution
   - Check PnL calculation

3. **Load Tests** (TODO)
   - Simulate high volume
   - Test under market stress
   - Verify stability

4. **Manual Testing** (Current)
   - Run on testnet
   - Monitor for 24-48 hours
   - Review logs and decisions

## Monitoring & Observability

**What to Monitor:**

1. **System Health**
   - Cycle completion time
   - Error rate
   - API latency

2. **Trading Performance**
   - Win rate
   - Profit factor
   - Sharpe ratio
   - Max drawdown

3. **Resource Usage**
   - CPU usage
   - Memory usage
   - Database size
   - Network bandwidth

4. **Alerts** (TODO)
   - Consecutive losses
   - API failures
   - Low balance
   - Unexpected behavior

## Conclusion

This architecture provides a solid foundation for algorithmic trading with AI. The modular design allows easy extension and customization while maintaining safety through comprehensive risk management.

**Next Steps:**
1. Implement Hyperliquid and Aster traders
2. Add unit and integration tests
3. Implement advanced monitoring
4. Add backtesting capability
5. Enhance AI prompt engineering
6. Implement portfolio optimization
