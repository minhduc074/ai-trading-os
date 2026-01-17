# AI Trader - Standalone Background Service

## Overview

The standalone background service allows you to run the AI trading bot **without** needing the Next.js web server or any browser. This is perfect for:

- **Server deployments** - VPS, cloud instances, Raspberry Pi
- **Headless operation** - No GUI/browser required
- **Resource efficiency** - No React, no web server overhead
- **Production trading** - Set it and forget it

## Quick Start

### Windows (PowerShell)
```powershell
.\start-standalone.ps1
```

### Windows (Double-click)
```
start-standalone.bat
```

### Linux/Mac
```bash
chmod +x start-standalone.sh
./start-standalone.sh
```

### Using npm
```bash
npm run trader         # Normal mode
npm run trader:sim     # Simulation mode
npm run trader:fast    # 1-minute intervals
```

## Configuration

The standalone service uses the same `.env.local` configuration as the web version:

```env
# AI Providers (at least one required)
CLI_PROXYAPI_API_KEY=your_key
CLI_PROXYAPI_BASE_URL=http://localhost:8317/v1
CLI_PROXYAPI_MODEL=gemini-claude-sonnet-4-5

# Or OpenRouter
OPENROUTER_API_KEY=your_key

# Binance API
BINANCE_TESTNET_API_KEY=your_key
BINANCE_TESTNET_API_SECRET=your_secret
USE_TESTNET=true

# Trading Settings
DECISION_INTERVAL_MS=900000    # 15 minutes
SIMULATION_MODE=false
TRADING_PAIR=BTCUSDT
```

## Command Line Options

### PowerShell
```powershell
# Show help
.\start-standalone.ps1 -Help

# Force simulation mode
.\start-standalone.ps1 -Simulation

# Custom interval (5 minutes)
.\start-standalone.ps1 -IntervalMinutes 5

# Combine options
.\start-standalone.ps1 -Simulation -IntervalMinutes 1
```

### Bash
```bash
# Show help
./start-standalone.sh --help

# Force simulation
./start-standalone.sh --simulation

# Custom interval
./start-standalone.sh --interval 5
```

## What It Does

Every cycle (default: 15 minutes), the service:

1. 📊 **Fetches Account Status** - Balance, margin, unrealized PnL
2. 📍 **Gets Open Positions** - Current positions from Binance
3. 📈 **Fetches Market Data** - Prices, RSI, EMA, MACD, ATR for 24+ coins
4. 📊 **Calculates Performance** - Win rate, profit factor, Sharpe ratio
5. 🤖 **Gets AI Decision** - Asks AI for trading recommendations
6. ⚡ **Executes Trades** - Opens/closes positions on Binance

## Output Example

```
╔══════════════════════════════════════════════════════════════╗
║     🤖 AI TRADER - STANDALONE BACKGROUND SERVICE 🤖         ║
╚══════════════════════════════════════════════════════════════╝

[2024-01-17T10:30:00.000Z] 🚀 Starting AI Trader Background Service...

══════════════════════════════════════════════════════════════════
[2024-01-17T10:30:00.000Z] 🔄 TRADING CYCLE #1
══════════════════════════════════════════════════════════════════

[2024-01-17T10:30:00.100Z] 📊 Fetching account status...
   💰 Balance: $5000.00
   📉 Available: $4500.00
   📊 Margin Usage: 10.0%
   📈 Unrealized PnL: $50.00

[2024-01-17T10:30:01.000Z] 📍 Fetching positions...
   1. BTCUSDT LONG 🟢 $50.00 (2.50%)

[2024-01-17T10:30:02.000Z] 📈 Fetching market data...
   Fetched data for 24 symbols
   20 symbols meet liquidity threshold

[2024-01-17T10:30:03.000Z] 🤖 Requesting AI trading decision...

[2024-01-17T10:30:10.000Z] 📋 DECISION SUMMARY:
   🎯 Action: OPEN_LONG
   📊 Symbol: ETHUSDT
   💭 Reasoning: Strong bullish divergence on RSI...
   🎯 Confidence: 85%
   🤖 AI Agent: gemini-claude-sonnet-4-5

[2024-01-17T10:30:11.000Z] ⚡ Executing trade: OPEN_LONG ETHUSDT
   ✅ Opened LONG position on ETHUSDT

[2024-01-17T10:30:11.500Z] ✅ Cycle #1 complete (11.5s)
⏰ Next decision in 15 minutes
══════════════════════════════════════════════════════════════════
```

## Architecture

```
standalone/
├── index.js              # Main entry point and trading loop
├── aiService.js          # AI provider integration (Claude, Gemini, OpenRouter)
├── tradingEngine.js      # Binance API for trade execution
├── marketDataService.js  # Market data fetching and indicators
├── performanceService.js # Performance metrics calculation
└── types.js              # Type definitions (JSDoc)
```

## Comparison: Standalone vs Web UI

| Feature | Standalone | Web UI |
|---------|------------|--------|
| Browser required | ❌ No | ✅ Yes |
| Next.js server | ❌ No | ✅ Yes |
| Memory usage | ~50MB | ~200MB+ |
| Real-time charts | ❌ No | ✅ Yes |
| Manual controls | ❌ No | ✅ Yes |
| Server deployment | ✅ Perfect | ⚠️ Complex |
| Background operation | ✅ Native | ⚠️ Needs keep-alive |

## Running as a System Service

### Windows (Task Scheduler)
1. Open Task Scheduler
2. Create Basic Task
3. Set trigger (e.g., "At startup")
4. Action: Start a program
5. Program: `node`
6. Arguments: `G:\AI\test_ai\ai_trader\standalone\index.js`
7. Start in: `G:\AI\test_ai\ai_trader`

### Linux (systemd)
Create `/etc/systemd/system/ai-trader.service`:
```ini
[Unit]
Description=AI Trader Background Service
After=network.target

[Service]
Type=simple
User=your_user
WorkingDirectory=/path/to/ai_trader
ExecStart=/usr/bin/node standalone/index.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable ai-trader
sudo systemctl start ai-trader
sudo systemctl status ai-trader
```

### Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY .env.local .
COPY standalone/ ./standalone/
CMD ["node", "standalone/index.js"]
```

## Troubleshooting

### "No AI providers available"
- Check your `.env.local` has at least one API key configured
- Verify the CLIProxyAPI server is running (if using local proxy)

### "Binance API error"
- Verify your Binance API keys are correct
- Check if using testnet keys with `USE_TESTNET=true`
- Ensure IP whitelist includes your server IP

### "Market data fetch error"
- Check internet connectivity
- Binance API might be rate limiting - wait a few minutes

### Graceful Shutdown
Press `Ctrl+C` to stop the service safely. It will:
1. Stop accepting new cycles
2. Complete any in-progress operations
3. Exit cleanly

## Security Notes

⚠️ **Important Security Considerations**:

1. **Never commit `.env.local`** to version control
2. **Use testnet first** for at least 24-48 hours
3. **Start with small amounts** when going live
4. **Monitor logs regularly** for unusual activity
5. **Set up alerts** for critical events

## Support

For issues:
1. Check console output for errors
2. Verify `.env.local` configuration
3. Test API connectivity manually
4. Review the logs for detailed error messages

---

**Trade safely and responsibly!** 🚀
