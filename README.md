# AI Trading Operating System v2.0.3

A professional AI-powered trading system with self-learning capabilities, supporting cloud AI providers, multiple exchanges, and comprehensive risk management.

## 🚀 Key Features

- **Cloud AI Integration**: Supports DeepSeek and Qwen AI models
- **Full Trading Support**: Long/short, leverage up to 50x, stop-loss/take-profit
- **AI Self-Learning**: Analyzes last 20 trading cycles, learns from mistakes, reinforces successes
- **Multi-Exchange Support**: Binance (mainnet/testnet), Hyperliquid, Aster DEX
- **Universal Market Data**: Multi-timeframe analysis (3min + 4hour), technical indicators
- **Unified Risk Control**: Position limits, margin management, anti-stacking protection
- **Professional Dashboard**: Real-time equity curves, performance charts, complete decision logs

## 📦 Installation

```bash
npm install
```

## ⚙️ Configuration

1. Copy `.env.example` to `.env`
2. Choose AI provider: Set `AI_PROVIDER=deepseek` or `qwen` and add API keys
3. Fill in your Binance API keys
4. Choose trading mode (testnet/mainnet)

## 🏃 Running

```bash
# Development mode with auto-reload
npm run dev

# Production build
npm run build
npm start
```

## 📊 Dashboard

Access the monitoring dashboard at `http://localhost:3000`

- Real-time equity curves
- Multi-agent performance comparison
- Complete Chain of Thought decision logs
- Position tracking with P/L
- 5-second data refresh

## 🧠 AI Decision Flow

The system executes a 7-step intelligent process every 3-5 minutes:

1. **Analyze Historical Performance** (last 20 cycles)
2. **Get Account Status** (equity, margin, positions)
3. **Analyze Existing Positions** (hold or close decisions)
4. **Evaluate New Opportunities** (candidate coins with filtering)
5. **AI Comprehensive Decision** (DeepSeek/Qwen with CoT reasoning)
6. **Execute Trades** (with automatic precision handling)
7. **Record Logs & Update Performance** (complete tracking)

## 🎯 Risk Management

- Position Limits: Altcoins ≤1.5x equity, BTC/ETH ≤10x equity
- Leverage: Configurable 1x-50x based on asset class
- Margin Usage: AI-controlled up to 90%
- Risk-Reward: Mandatory ≥1:2 stop-loss to take-profit ratio
- Anti-Stacking: Prevents duplicate positions

## 📁 Project Structure

```
src/
├── index.ts                    # Main entry point
├── core/
│   ├── TradingEngine.ts       # Main trading loop orchestrator
│   ├── AIDecisionEngine.ts    # AI decision making
│   └── RiskManager.ts         # Risk control
├── exchanges/
│   ├── BaseTrader.ts          # Abstract trader interface
│   ├── BinanceTrader.ts       # Binance implementation
│   ├── HyperliquidTrader.ts   # Hyperliquid implementation
│   └── AsterTrader.ts         # Aster DEX implementation
├── services/
│   ├── MarketDataService.ts   # Multi-exchange market data
│   ├── PerformanceTracker.ts  # Historical performance tracking
│   ├── IndicatorService.ts    # Technical indicators
│   └── AIService.ts           # AI model integration
├── dashboard/
│   ├── server.ts              # Express + WebSocket server
│   └── public/                # Frontend files
└── types/
    └── index.ts               # TypeScript interfaces
```

## 📝 License

MIT
