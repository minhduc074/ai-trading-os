# Quick Reference - Local AI Trading System

## 🚀 Start Trading (3 Steps)

```bash
# Step 1: Start your local AI server
cd G:\free_ai
python app.py

# Step 2: Install dependencies (first time only)
cd G:\test_ai
npm install

# Step 3: Start trading system
npm start
```

Dashboard: **http://localhost:3000**

---

## ⚙️ Configuration (.env)

```env
# === TRADING MODE ===
TRADING_MODE=testnet        # Use testnet first!

# === AI PROVIDER ===
AI_PROVIDER=local           # Use local AI (free!)
LOCAL_AI_URL=http://localhost:5000
LOCAL_AI_EMAIL=your_email@example.com
LOCAL_AI_PASSWORD=your_password

# === BINANCE API ===
BINANCE_TESTNET_API_KEY=your_key
BINANCE_TESTNET_API_SECRET=your_secret

# === RISK SETTINGS ===
MAX_LEVERAGE_ALTCOIN=20
MAX_LEVERAGE_MAJOR=50
MAX_POSITIONS=5
MAX_MARGIN_USAGE=0.90
```

---

## 🧪 Testing

```bash
# Test local AI connection
npx ts-node test-local-ai.ts

# Build and run
npm run build
npm start

# Development mode (auto-reload)
npm run dev
```

---

## 📊 Monitoring

| Endpoint | Purpose |
|----------|---------|
| `http://localhost:3000` | Web dashboard |
| `http://localhost:3000/api/status` | JSON status |
| `http://localhost:3000/api/health` | Health check |

**Data Files:**
- `data/trading.db` - Trade history (SQLite)
- `data/decisions/*.json` - AI decision logs

---

## 🔄 Switching AI Providers

### Local AI (Current - Free)
```env
AI_PROVIDER=local
LOCAL_AI_URL=http://localhost:5000
```

### Cloud AI (Costs money)
```env
# DeepSeek
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-xxxxx

# Qwen
AI_PROVIDER=qwen
QWEN_API_KEY=sk-xxxxx
```

---

## 🛠️ Troubleshooting

| Error | Solution |
|-------|----------|
| "Connection refused" | Start AI server: `python app.py` |
| "Module not found" | Run: `npm install` |
| "Invalid API key" | Check `.env` file |
| "Port 3000 in use" | Change `DASHBOARD_PORT` |
| "TypeScript errors" | Run: `npm install` first |

---

## 📁 Important Files

```
test_ai/
├── .env                    # Your configuration
├── src/
│   ├── index.ts           # Main entry point
│   ├── services/
│   │   └── AIService.ts   # Local AI integration
│   └── core/
│       └── TradingEngine.ts
├── data/
│   ├── trading.db         # Trade history
│   └── decisions/         # AI logs
└── docs/
    ├── LOCAL_AI_SETUP.md
    └── READY_TO_USE.md
```

---

## 🎯 Key Commands

```bash
npm install         # Install dependencies
npm start          # Run trading system
npm run dev        # Development mode
npm run build      # Compile TypeScript
npm run clean      # Clean build files
```

---

## 📞 Quick Checks

**Is AI server running?**
```bash
curl http://localhost:5000/health
```

**Is trading system running?**
```bash
curl http://localhost:3000/api/health
```

**View recent decisions:**
```bash
ls data/decisions/ | tail -5
```

**Check database:**
```bash
sqlite3 data/trading.db "SELECT * FROM trades ORDER BY id DESC LIMIT 5;"
```

---

## ⚡ Tips

1. **Always start with testnet** - Get free funds from Binance testnet faucet
2. **Monitor first 24 hours** - Check dashboard frequently
3. **Review decisions** - Read AI logs in `data/decisions/`
4. **Backup regularly** - Copy `data/` folder
5. **Test AI first** - Run `npx ts-node test-local-ai.ts`

---

## 🔒 Security

- ✅ Keep `.env` file private (in `.gitignore`)
- ✅ Never share API keys
- ✅ Use testnet for testing
- ✅ Review all trades manually at first
- ✅ Set position limits conservatively

---

## 📊 Performance Metrics

**Dashboard shows:**
- Total equity & P/L
- Open positions
- Win rate & Sharpe ratio
- Recent trades
- AI decision logs
- Real-time updates (5s interval)

---

## 🎓 Learning Mode

System learns from history:
- Analyzes last 20 trading cycles
- Identifies best/worst performing coins
- Adjusts confidence based on win rate
- Logs Chain of Thought reasoning

---

## 🆘 Emergency Stop

**Keyboard:** Press `Ctrl+C` twice

**Graceful shutdown:**
- Closes all AI sessions
- Stops trading engine
- Saves all data
- Logs final state

---

**Need help?** Check full documentation:
- [LOCAL_AI_SETUP.md](LOCAL_AI_SETUP.md)
- [LOCAL_AI_INTEGRATION.md](LOCAL_AI_INTEGRATION.md)
- [READY_TO_USE.md](READY_TO_USE.md)
