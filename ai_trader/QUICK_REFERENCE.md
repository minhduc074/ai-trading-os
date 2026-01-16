# AI Trader - Quick Reference Card

## 🚀 Quick Start (5 minutes)

### Step 1: Configure
```bash
cd g:\AI\test_ai\ai_trader
# Edit .env.local with your API keys:
# - BINANCE_TESTNET_API_KEY
# - BINANCE_TESTNET_API_SECRET  
# - OPENROUTER_API_KEY
```

### Step 2: Run
```bash
npm run dev
# Opens: http://localhost:3000
```

### Step 3: Test
- Click "Make Decision Now" button
- Check browser console (F12) for logs
- Verify account status displays

---

## 📊 Dashboard Overview

### Status Bar
- 🟢 **RUNNING** - System is trading
- 🔴 **STOPPED** - System paused
- **Cycle Count** - Number of decisions made
- **Mode** - TESTNET or MAINNET

### Account Status Card
- Total Balance
- Available Balance  
- Margin Usage %
- Unrealized P&L
- Daily P&L

### Open Positions Table
Shows all active trades:
- Symbol (BTCUSDT, ETHUSDT, etc)
- Side (LONG or SHORT)
- Entry & Current Price
- Leverage & Quantity
- Unrealized P&L

### Recent Trades Table
Shows last 10 closed trades:
- Entry & Exit Price
- P&L in USDT
- P&L %
- Trade Duration

---

## 🎯 API Quick Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/trading/account` | GET | Account balance |
| `/api/trading/positions` | GET | Open positions |
| `/api/trading/trades` | GET | Trade history |
| `/api/trading/decision` | POST | Get AI decision |
| `/api/trading/execute` | POST | Execute trade |

### Example Request
```bash
curl -X POST http://localhost:3000/api/trading/decision
```

### Example Response
```json
{
  "action": "OPEN_LONG",
  "symbol": "BTCUSDT",
  "quantity": 0.01,
  "leverage": 5,
  "stopLoss": 40000,
  "takeProfit": 45000,
  "confidence": 0.85
}
```

---

## ⚙️ Configuration Parameters

### Risk Management
```env
MAX_LEVERAGE_ALTCOIN=50          # Altcoin max leverage
MAX_LEVERAGE_MAJOR=50            # BTC/ETH max leverage
MAX_POSITION_SIZE_ALTCOIN=1.5    # Max 1.5x equity
MAX_POSITION_SIZE_MAJOR=10       # Max 10x equity
MAX_MARGIN_USAGE=0.90            # 90% max margin
MIN_RISK_REWARD_RATIO=1.0        # Min 1:1 SL:TP ratio
```

### Market Data
```env
MIN_LIQUIDITY_USD=15000000       # Min $15M liquidity
COIN_SELECTION_MODE=advanced     # advanced or default
TOP_AI500_COUNT=20               # Top coins to analyze
TOP_OI_COUNT=20                  # Top by open interest
```

### Trading
```env
DECISION_INTERVAL_MS=3600000     # 1 hour between decisions
MAX_POSITIONS=5                  # Max 5 open positions
WS_UPDATE_INTERVAL_MS=5000       # Dashboard refresh rate
```

---

## 🔑 Key Concepts

### Position
- Long (buy) or Short (sell)
- With leverage (1-50x)
- Stop-loss and take-profit
- Unrealized P&L updates in real-time

### Trade
- Closed position
- Has entry and exit price
- Calculates actual P&L
- Records duration

### Decision
- AI analysis of market + account
- Action: HOLD, WAIT, OPEN_LONG, OPEN_SHORT, CLOSE_LONG, CLOSE_SHORT
- Includes reasoning and confidence

### Margin Usage
- Total balance × leverage used / total balance
- Must stay ≤ 90%
- System prevents over-leverage

---

## 🎓 Trading Flow

```
1. ANALYZE        → Review last 20 trades
   ↓
2. GET STATUS     → Check account & positions
   ↓
3. ANALYZE POS    → Evaluate each open trade
   ↓
4. EVALUATE COINS → Scan top coins for signals
   ↓
5. AI DECISION    → Get action + reasoning
   ↓
6. EXECUTE        → Open/close positions
   ↓
7. LOG RESULTS    → Record everything
```

---

## 📈 Performance Metrics

### Calculated Automatically
- **Win Rate** - % of profitable trades
- **Profit Factor** - Gross profit / Gross loss
- **Sharpe Ratio** - Risk-adjusted returns
- **Max Drawdown** - Largest peak-to-trough
- **Avg Profit** - Average P&L per trade
- **Best Assets** - Top 5 performing coins
- **Worst Assets** - Bottom 5 performing coins

---

## ⚠️ Risk Management Checks

Before opening a position:
1. ✓ Position size ≤ limit (1.5x or 10x equity)
2. ✓ Margin usage + new position ≤ 90%
3. ✓ No duplicate position (same coin + direction)
4. ✓ Risk-reward ≥ 1:2
5. ✓ Liquidity > $15M
6. ✓ Balance available

---

## 🐛 Troubleshooting

### Dashboard Won't Load
```
1. Check: npm run dev is running
2. Check: http://localhost:3000 accessible
3. Check: No errors in console (F12)
4. Check: .env.local has API keys
```

### API Keys Error
```
1. Verify format (no extra spaces)
2. Check testnet vs mainnet keys match mode
3. Regenerate key in Binance
4. Restart: npm run dev
```

### No Market Data
```
1. Check internet connection
2. Check Binance API status
3. Verify API key has read permissions
4. Check rate limits (1200/min)
```

### Trades Not Executing
```
1. Check available balance
2. Check margin usage < 90%
3. Check coin liquidity > $15M
4. Check API key has trading permissions
```

---

## 📝 File Editing Guide

### Change Risk Parameters
```bash
# Edit .env.local
NEXT_PUBLIC_MAX_LEVERAGE_ALTCOIN=50
```

### Modify AI Prompt
```bash
# Edit src/lib/services/aiService.ts
# Function: buildPrompt()
```

### Add Market Data Indicator
```bash
# Edit src/lib/services/marketDataService.ts
# Function: fetchSymbolData()
```

### Update Dashboard UI
```bash
# Edit src/app/page.tsx
# Change JSX and styling
```

---

## 🔗 Important Links

- **Dashboard**: http://localhost:3000
- **Binance Testnet**: https://testnet.binancefuture.com/
- **OpenRouter API**: https://openrouter.ai/
- **Binance API Docs**: https://binance-docs.github.io/apidocs/

---

## ✅ Daily Checklist

- [ ] Dashboard accessible
- [ ] Account balance showing
- [ ] No error messages
- [ ] Real-time updates working
- [ ] AI decisions generating
- [ ] Trades executing correctly
- [ ] Margin usage < 80%
- [ ] No console errors

---

## 🎯 Next Actions

### First Hour
1. Get Binance testnet funds
2. Add API keys to .env.local
3. npm run dev
4. Test "Make Decision Now"

### First Day
1. Monitor dashboard for 4+ hours
2. Review decision logs
3. Verify P&L calculations
4. Check for errors

### Before Going Live
1. Test for 24-48 hours
2. Review all decisions
3. Verify profitability
4. Adjust risk if needed
5. Update .env.local to mainnet
6. Start with $100-500

---

## 💾 Files to Remember

| File | Purpose |
|------|---------|
| `.env.local` | API keys and settings (SECRET) |
| `src/app/page.tsx` | Dashboard UI |
| `src/lib/services/aiService.ts` | AI logic |
| `README.md` | Full documentation |
| `SETUP_GUIDE.md` | Deployment guide |
| `API_DOCS.md` | API reference |

---

## 🚨 Emergency Stop

If something goes wrong:

```bash
# Stop the server
Ctrl+C

# Disable API key in Binance
# Go to Binance API Management → Disable

# Check what happened
# Review console logs and decision logs

# Before restarting, fix the issue
```

---

## 📊 Example Decisions

### Decision 1: OPEN_LONG
```json
{
  "action": "OPEN_LONG",
  "symbol": "BTCUSDT",
  "quantity": 0.01,
  "leverage": 5,
  "stopLoss": 42000,
  "takeProfit": 47000,
  "reasoning": "Strong trend + high volume",
  "confidence": 0.88
}
```

### Decision 2: CLOSE_SHORT
```json
{
  "action": "CLOSE_SHORT",
  "symbol": "ETHUSDT",
  "reasoning": "Target reached, lock profit",
  "confidence": 0.95
}
```

### Decision 3: HOLD
```json
{
  "action": "HOLD",
  "reasoning": "No clear signal, wait for confirmation",
  "confidence": 0.60
}
```

---

## 🎓 Learning Resources

### In This Project
1. `README.md` - Feature overview
2. `SETUP_GUIDE.md` - Deployment
3. `API_DOCS.md` - API reference
4. `PROJECT_SUMMARY.md` - Architecture
5. `FILE_STRUCTURE.md` - Code organization

### External Resources
1. [Next.js Docs](https://nextjs.org)
2. [Binance API](https://binance-docs.github.io)
3. [OpenRouter Docs](https://openrouter.ai)
4. [TypeScript Handbook](https://www.typescriptlang.org)

---

**Last Updated**: January 17, 2026  
**Status**: ✅ Production Ready  
**Version**: 1.0.0
