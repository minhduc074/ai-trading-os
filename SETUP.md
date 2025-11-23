# AI Trading Operating System - Setup Guide

## 🚀 Quick Start

### 1. Install Dependencies

```powershell
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```powershell
Copy-Item .env.example .env
```

Then edit `.env` with your API keys:

```env
# Choose your trading mode
TRADING_MODE=testnet  # Start with testnet!

# Binance API Keys
# Get testnet keys from: https://testnet.binancefuture.com/
BINANCE_TESTNET_API_KEY=your_testnet_key_here
BINANCE_TESTNET_API_SECRET=your_testnet_secret_here

# For mainnet (be careful!)
BINANCE_API_KEY=your_mainnet_key_here
BINANCE_API_SECRET=your_mainnet_secret_here

# AI Provider (choose one)
AI_PROVIDER=deepseek  # or qwen or openrouter

# DeepSeek API (recommended)
# Get key from: https://platform.deepseek.com/
DEEPSEEK_API_KEY=your_deepseek_key_here

# Or Qwen API
QWEN_API_KEY=your_qwen_key_here
```

### 3. Build the Project

```powershell
npm run build
```

### 4. Run the Trading System

**Development mode (with auto-reload):**
```powershell
npm run dev
```

**Production mode:**
```powershell
npm start
```

### 5. Access the Dashboard

Open your browser and go to:
```
http://localhost:3000
```

## 📋 Requirements

### API Keys Required

1. **Binance Futures API Key**
   - Testnet: https://testnet.binancefuture.com/
   - Mainnet: https://www.binance.com/en/my/settings/api-management
   - Required permissions: Enable Futures, Enable Reading, Enable Spot & Margin Trading

2. **AI Provider API Key** (choose one)
   - DeepSeek: https://platform.deepseek.com/ (recommended, cost-effective)
   - Qwen: https://dashscope.aliyuncs.com/
   - OpenRouter: https://openrouter.ai/ (OpenAI-compatible reverse proxy)

   ### OpenRouter usage example
   If you choose `openrouter`, the official OpenAI-compatible client can be used with a reasoning flag. Example:

   ```ts
   import OpenAI from 'openai';

   const client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: '<OPENROUTER_API_KEY>'
   });

   const r = await client.chat.completions.create({
      model: 'x-ai/grok-4.1-fast:free',
      messages: [{ role: 'user', content: 'How many r\'s are in "strawberry"?' }],
      reasoning: { enabled: true },
   });
   ```

### System Requirements

- Node.js v18 or higher
- 2GB RAM minimum
- Stable internet connection
- Windows/Linux/macOS

## 🔧 Configuration Options

Edit `.env` to customize behavior:

### Trading Settings

```env
DECISION_INTERVAL_MS=180000  # 3 minutes between decisions
MAX_POSITIONS=5              # Maximum concurrent positions
```

### Risk Management

```env
MAX_LEVERAGE_ALTCOIN=20      # Max leverage for altcoins
MAX_LEVERAGE_MAJOR=50        # Max leverage for BTC/ETH
MAX_POSITION_SIZE_ALTCOIN_MULTIPLIER=1.5  # 1.5x equity
MAX_POSITION_SIZE_MAJOR_MULTIPLIER=10     # 10x equity
MAX_MARGIN_USAGE=0.90        # Use up to 90% margin
MIN_RISK_REWARD_RATIO=2.0    # Minimum 1:2 SL:TP ratio
```

### Market Data

```env
MIN_LIQUIDITY_USD=15000000   # Filter coins with <15M OI
COIN_SELECTION_MODE=default  # or "advanced"
```

### Dashboard

```env
DASHBOARD_PORT=3000          # Dashboard web server port
```

## 🎯 Usage

### First Run (Testing)

1. **Always start with testnet!**
   ```env
   TRADING_MODE=testnet
   ```

2. **Start the system:**
   ```powershell
   npm run dev
   ```

3. **Monitor the logs:**
   - Watch the console for decision cycles
   - Check `decision_logs/` folder for AI reasoning
   - Access dashboard at http://localhost:3000

4. **Verify behavior:**
   - Let it run for a few cycles (15-30 minutes)
   - Check if positions open/close correctly
   - Review AI decision logs
   - Verify PnL calculations

### Going Live (Mainnet)

⚠️ **WARNING: Use real funds at your own risk!**

1. **Switch to mainnet:**
   ```env
   TRADING_MODE=mainnet
   BINANCE_API_KEY=your_real_key
   BINANCE_API_SECRET=your_real_secret
   ```

2. **Start with small capital:**
   - Test with $100-500 first
   - Monitor closely for 24-48 hours
   - Gradually increase if performance is good

3. **Monitor continuously:**
   - Check dashboard regularly
   - Review decision logs
   - Watch for unusual behavior

## 📊 Understanding the System

### Decision Cycle (Every 3 Minutes)

```
1. 📈 Analyze Historical Performance
   ↓ (Reviews last 20 cycles, win rate, PnL)
   
2. 💰 Get Account Status
   ↓ (Equity, margin, positions)
   
3. 🔍 Analyze Existing Positions
   ↓ (Should hold or close?)
   
4. 🎯 Evaluate New Opportunities
   ↓ (Scan market for signals)
   
5. 🧠 AI Comprehensive Decision
   ↓ (DeepSeek/Qwen/OpenRouter makes decisions)
   
6. ⚡ Execute Trades
   ↓ (Place orders with risk checks)
   
7. 📝 Record Logs & Update Performance
   ✅ (Save to database and files)
```

### File Structure

```
data/
  └── performance.db        # SQLite database with trade history

decision_logs/
  └── trader_xxx/
      ├── cycle_1_xxx.json  # Complete decision log
      ├── cycle_2_xxx.json  # Includes AI reasoning
      └── ...

src/
  ├── index.ts             # Main entry point
  ├── core/
  │   ├── TradingEngine.ts # Orchestrates decision cycles
  │   └── RiskManager.ts   # Risk control
  ├── exchanges/
  │   ├── BaseTrader.ts    # Exchange interface
  │   └── BinanceTrader.ts # Binance implementation
  ├── services/
  │   ├── AIService.ts     # AI decision engine
  │   ├── MarketDataService.ts
  │   ├── PerformanceTracker.ts
  │   └── IndicatorService.ts
  └── dashboard/
      └── server.ts        # Web dashboard
```

## 🐛 Troubleshooting

### "Cannot find module" errors

```powershell
# Delete node_modules and reinstall
Remove-Item -Recurse -Force node_modules
npm install
```

### "API key invalid" errors

- Check your API keys in `.env`
- Ensure Futures are enabled on Binance
- For testnet, get keys from https://testnet.binancefuture.com/

### "Insufficient balance" errors

- Check your account has USDT
- For testnet, request test funds from testnet faucet
- Reduce position sizes in AI decisions

### No trades executing

- Check console logs for errors
- Verify coin liquidity meets minimum (15M USD)
- Check if market conditions meet AI criteria
- Review decision logs to see AI reasoning

## 📈 Performance Monitoring

### Dashboard Metrics

- **System Status**: Engine running, cycle count
- **Real-time Updates**: Every 5 seconds via WebSocket
- Access at: http://localhost:3000

### Decision Logs

Each cycle creates a JSON log with:
- Complete AI Chain of Thought reasoning
- Input data (account, positions, market data)
- Decision details (action, symbol, quantity, leverage)
- Execution results (success/failure, prices)

Location: `decision_logs/[trader_id]/cycle_N_timestamp.json`

### Database Queries

```javascript
// Connect to SQLite database
const db = require('sqlite3').Database('./data/performance.db');

// Get all trades
db.all('SELECT * FROM trades ORDER BY close_time DESC LIMIT 10');

// Get equity history
db.all('SELECT * FROM equity_snapshots ORDER BY timestamp DESC LIMIT 100');
```

## 🔒 Security Best Practices

1. **Never commit `.env` file**
   - Already in `.gitignore`
   - Keep API keys private

2. **Use API restrictions**
   - Binance: Enable only Futures trading
   - Whitelist your IP address
   - Set withdrawal restrictions

3. **Start small**
   - Test with testnet first
   - Use small amounts initially
   - Monitor closely

4. **Regular backups**
   - Backup `data/` folder
   - Save decision logs
   - Export trade history

## 📚 Additional Resources

- Binance Futures API: https://binance-docs.github.io/apidocs/futures/en/
- DeepSeek API: https://platform.deepseek.com/docs
- Technical Indicators: https://github.com/anandanand84/technicalindicators

## ⚠️ Disclaimer

This software is for educational purposes. Trading cryptocurrencies carries significant risk. Past performance does not guarantee future results. Use at your own risk. The authors are not responsible for any financial losses.

## 🆘 Support

If you encounter issues:

1. Check logs in console
2. Review decision logs in `decision_logs/`
3. Verify `.env` configuration
4. Ensure API keys have correct permissions
5. Test with smaller position sizes

---

**Good luck trading! Start with testnet and always monitor your system closely.** 🚀
