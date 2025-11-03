# ⚡ Quick Start Guide - 5 Minutes to Trading

Get your AI Trading OS running in just 5 minutes!

## Step 1: Install (1 minute)

Open PowerShell in the project folder and run:

```powershell
.\install.ps1
```

This will:
- Install all dependencies
- Create `.env` file
- Build the TypeScript code
- Set up directories

## Step 2: Get API Keys (2 minutes)

### Binance Testnet (Required)
1. Go to: https://testnet.binancefuture.com/
2. Login with GitHub or email
3. Click "API Key" → "Generate HMAC_SHA256 Key"
4. Save the API Key and Secret Key

### DeepSeek AI (Required)
1. Go to: https://platform.deepseek.com/
2. Sign up for an account
3. Go to "API Keys" section
4. Create a new API key
5. Copy the key

## Step 3: Configure (1 minute)

Edit `.env` file:

```powershell
notepad .env
```

Fill in these required fields:

```env
# Trading Mode
TRADING_MODE=testnet

# Binance Testnet Keys
BINANCE_TESTNET_API_KEY=paste_your_testnet_key_here
BINANCE_TESTNET_API_SECRET=paste_your_testnet_secret_here

# DeepSeek AI Key
DEEPSEEK_API_KEY=paste_your_deepseek_key_here
```

Save and close.

## Step 4: Get Test Funds (30 seconds)

1. Go to Binance testnet: https://testnet.binancefuture.com/
2. Look for "Get Test Funds" or similar
3. Request USDT to your testnet account
4. You should get ~10,000 USDT test money

## Step 5: Start Trading (30 seconds)

```powershell
npm run dev
```

You should see:

```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🤖 AI Trading Operating System v2.0.2                      ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

🔌 Connecting to exchange...
✅ Connected to Binance Testnet
   Account Equity: $10000.00 USDT

🧠 Initializing AI engine...
✅ AI engine ready

📊 Starting dashboard server...
✅ Dashboard available at http://localhost:3000

🚀 Starting AI Trading Operating System
```

## Step 6: Monitor (Ongoing)

### Open Dashboard
Go to: http://localhost:3000

### Watch Console
The console shows:
- 📈 Historical performance
- 💰 Account status
- 🔍 Position analysis
- 🧠 AI decisions
- ⚡ Trade execution
- ✅ Cycle completion

### Check Logs
```powershell
# View latest decision log
ls decision_logs
```

## That's It! 🎉

Your AI trading system is now:
- ✅ Running on Binance testnet
- ✅ Analyzing markets every 3 minutes
- ✅ Making AI-powered decisions
- ✅ Executing trades automatically
- ✅ Logging everything

## What Happens Next?

Every 3 minutes, the system will:
1. Analyze your last 20 trades
2. Check your account balance
3. Review existing positions
4. Scan 20+ cryptocurrencies
5. Make AI-powered decisions
6. Execute trades (if opportunities found)
7. Log everything to files and database

## Common First-Run Issues

### ❌ "Module not found"
```powershell
npm install
```

### ❌ "API key invalid"
- Check your API key in `.env`
- Make sure you copied the full key
- Verify it's the testnet key (not mainnet)

### ❌ "Cannot find .env"
```powershell
Copy-Item .env.example .env
notepad .env
```

### ❌ "Port 3000 already in use"
Edit `.env`:
```env
DASHBOARD_PORT=3001
```

## What to Watch For

### First Cycle (3 minutes)
- System fetches market data
- AI analyzes opportunities
- May decide to "wait" (normal)

### After 5-10 Cycles (15-30 minutes)
- AI should have opened 1-2 positions
- Check dashboard for status
- Review decision logs for reasoning

### After 24 Hours
- You should have several trades
- Check win rate
- Review PnL
- Adjust settings if needed

## Stop the System

Press `Ctrl+C` in the terminal

The system will:
- Stop the trading loop
- Close database connections
- Save final state
- Exit gracefully

## Next Steps

Once comfortable with testnet:

1. **Read Full Documentation**
   - `SETUP.md` - Detailed setup
   - `COMMANDS.md` - All commands
   - `ARCHITECTURE.md` - How it works

2. **Optimize Settings**
   - Adjust risk parameters in `.env`
   - Customize coin list
   - Tune leverage limits

3. **Go Live (Optional)**
   - Test thoroughly on testnet first (24-48 hours minimum)
   - Start with small real money ($100-500)
   - Monitor closely
   - Never risk more than you can afford to lose

## Need Help?

1. Check console output for errors
2. Read decision logs in `decision_logs/`
3. Review `SETUP.md` for detailed help
4. Check `COMMANDS.md` for troubleshooting

## Pro Tips

1. **Let it run for 24 hours on testnet** before making changes
2. **Read the AI's reasoning** in decision logs to understand decisions
3. **Start conservative** - default settings are safe
4. **Monitor the first few hours** to ensure everything works
5. **Backup your data/** folder regularly

---

## Summary

✅ **Install**: `.\install.ps1`  
✅ **Configure**: Edit `.env` with API keys  
✅ **Start**: `npm run dev`  
✅ **Monitor**: http://localhost:3000  
✅ **Learn**: Read decision logs  

**You're ready to trade! 🚀**

Remember: This is testnet. No real money at risk. Perfect for learning!

---

**Total Time**: ~5 minutes  
**Difficulty**: Easy  
**Risk**: Zero (testnet)  
**Learning**: High  

Happy trading! 🎉
