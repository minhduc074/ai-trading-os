# AI Trading System - Setup & Deployment Guide

## System Requirements

- **Node.js**: 18.17.0 or higher
- **npm**: 9.0.0 or higher
- **RAM**: 2GB minimum
- **Disk Space**: 500MB for dependencies and data
- **Network**: Stable internet connection (trading)

## Installation Steps

### 1. Environment Setup

```bash
# Navigate to project directory
cd g:\AI\test_ai\ai_trader

# Install all dependencies
npm install

# Verify installation
npm --version
node --version
```

### 2. Configure API Keys

Create/edit `.env.local`:

```env
# ===== TRADING MODE (IMPORTANT) =====
NEXT_PUBLIC_TRADING_MODE=testnet  # Always start with testnet!

# ===== BINANCE TESTNET KEYS =====
# Get free testnet keys from: https://testnet.binancefuture.com/
BINANCE_TESTNET_API_KEY=your_testnet_key_here
BINANCE_TESTNET_API_SECRET=your_testnet_secret_here

# ===== BINANCE MAINNET (Real Money - Use Carefully) =====
BINANCE_API_KEY=your_mainnet_key_here
BINANCE_API_SECRET=your_mainnet_secret_here

# ===== AI PROVIDER CONFIGURATION =====
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-your-key-here
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Optional: RapidAPI as fallback
RAPIDAPI_KEY=your_rapidapi_key_here

# ===== TRADING PARAMETERS =====
NEXT_PUBLIC_DECISION_INTERVAL_MS=3600000  # 1 hour
NEXT_PUBLIC_MAX_POSITIONS=5

# ===== RISK MANAGEMENT =====
NEXT_PUBLIC_MAX_LEVERAGE_ALTCOIN=50
NEXT_PUBLIC_MAX_LEVERAGE_MAJOR=50
NEXT_PUBLIC_MAX_POSITION_SIZE_ALTCOIN=1.5
NEXT_PUBLIC_MAX_POSITION_SIZE_MAJOR=10
NEXT_PUBLIC_MAX_MARGIN_USAGE=0.90
NEXT_PUBLIC_MIN_RISK_REWARD_RATIO=1.0

# ===== MARKET DATA =====
NEXT_PUBLIC_MIN_LIQUIDITY_USD=15000000
NEXT_PUBLIC_COIN_SELECTION_MODE=advanced
NEXT_PUBLIC_TOP_AI500_COUNT=20
NEXT_PUBLIC_TOP_OI_COUNT=20

# ===== DASHBOARD SETTINGS =====
NEXT_PUBLIC_WS_UPDATE_INTERVAL_MS=5000
```

### 3. Getting API Keys

#### Binance Testnet (Recommended First Step)

1. Go to https://testnet.binancefuture.com/
2. Create account (separate from mainnet)
3. Request testnet funds (free daily limit)
4. API Management → Create API Key
5. Copy Key and Secret to `.env.local`

#### Binance Mainnet

1. Go to https://www.binance.com/
2. Create or login to account
3. Account → API Management
4. Create API Key with:
   - ✅ Futures Trading (Read & Write)
   - ❌ Withdraw (Disable for safety)
   - ✅ IP Whitelist (Recommended)
5. Copy Key and Secret to `.env.local`

#### OpenRouter AI (Free Tier)

1. Go to https://openrouter.ai/
2. Sign up with GitHub/email
3. Dashboard → Keys
4. Create new key
5. Copy to `OPENROUTER_API_KEY`

### 4. Verify Configuration

```bash
# Check environment variables are loaded
npm run dev

# Open browser: http://localhost:3000
# Should show dashboard with account status
```

## Running the Application

### Development Mode

```bash
# Start with hot reload
npm run dev

# Access dashboard at http://localhost:3000
# Logs appear in terminal
```

### Production Mode

```bash
# Build for production
npm run build

# Start production server
npm run start

# Access at http://localhost:3000
```

## Testing on Testnet

### 1. Initial Setup (Day 1)

```bash
# 1. Ensure NEXT_PUBLIC_TRADING_MODE=testnet in .env.local
# 2. Get testnet funds from Binance faucet
# 3. npm run dev
# 4. Open http://localhost:3000
```

### 2. Monitor Dashboard

Check these metrics:
- Account balance appears correctly
- Can view open positions (if any)
- Recent trades show
- Margin usage is calculated
- Real-time updates every 5 seconds

### 3. Make Manual Decisions

Click "Make Decision Now" button:
1. AI analyzes market data
2. Decision is logged
3. Trade executes (simulated on testnet)
4. Position appears in dashboard
5. P&L updates in real-time

### 4. Review Decision Logs

Check browser console (F12) for:
- AI reasoning
- Market data analyzed
- Decision made
- Execution result
- Any errors

## Transitioning to Mainnet

**⚠️ IMPORTANT: Only after 24-48 hours of successful testing**

1. **Backup Everything**
   ```bash
   # Backup .env.local file
   copy .env.local .env.local.backup
   ```

2. **Update Configuration**
   ```env
   NEXT_PUBLIC_TRADING_MODE=mainnet
   # Use mainnet API keys instead
   ```

3. **Start With Small Amount**
   - Begin with $100-500 USDT
   - Monitor closely for 24 hours
   - Watch for unusual behavior

4. **Scale Gradually**
   - Only increase after profitable week
   - Never add more than 50% at once
   - Review all decision logs

## Deployment Options

### Option 1: Vercel (Recommended)

```bash
# 1. Push code to GitHub
git init
git add .
git commit -m "Initial commit"
git push origin main

# 2. Connect to Vercel
# Go to vercel.com
# Import project from GitHub
# Set environment variables
# Deploy

# 3. Application runs at https://your-domain.vercel.app
```

### Option 2: Self-Hosted (VPS/Server)

```bash
# 1. SSH into server
ssh user@your-server.com

# 2. Clone repository
git clone https://github.com/your-repo.git
cd ai_trader

# 3. Install dependencies
npm install

# 4. Configure .env.local
nano .env.local

# 5. Build
npm run build

# 6. Start with PM2 (process manager)
npm install -g pm2
pm2 start "npm run start" --name "ai-trader"
pm2 save

# 7. Access at http://your-server.com:3000
```

### Option 3: Docker

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
```

```bash
# Build and run
docker build -t ai-trader .
docker run -p 3000:3000 --env-file .env.local ai-trader
```

## Troubleshooting

### Issue: "API key invalid"
**Solution:**
- Verify key format (should not have spaces)
- Check testnet vs mainnet keys match trading mode
- Regenerate key in Binance

### Issue: "Cannot fetch market data"
**Solution:**
- Check internet connection
- Verify Binance API status
- Check rate limits (default 1200 requests/minute)
- Review console errors (F12)

### Issue: "Dashboard shows loading forever"
**Solution:**
- Open browser console (F12)
- Look for network errors
- Check `.env.local` configuration
- Restart dev server

### Issue: "Positions not updating"
**Solution:**
- Verify API key has trading permissions
- Check margin usage is below 90%
- Review execution logs
- Ensure sufficient balance

### Issue: "High latency/slow trades"
**Solution:**
- Check network ping to Binance
- Reduce decision interval in `.env.local`
- Use closer server location if deploying
- Monitor server resources

## Monitoring & Maintenance

### Daily Checklist

- [ ] Dashboard accessible
- [ ] Account balance visible
- [ ] Open positions show correctly
- [ ] Recent trades display
- [ ] No error messages in console
- [ ] Margin usage below 80%

### Weekly Tasks

- [ ] Review decision logs
- [ ] Check win rate
- [ ] Analyze P&L trends
- [ ] Backup .env.local
- [ ] Update API keys if needed
- [ ] Check error logs

### Monthly Tasks

- [ ] Review performance metrics
- [ ] Adjust risk parameters if needed
- [ ] Update dependencies: `npm update`
- [ ] Security audit of API keys
- [ ] Database cleanup (if using SQLite)

## Performance Optimization

### Reduce API Calls
```env
# Increase interval to reduce calls
NEXT_PUBLIC_DECISION_INTERVAL_MS=7200000  # 2 hours instead of 1
```

### Optimize Market Data
```env
# Reduce coin selection for faster analysis
NEXT_PUBLIC_TOP_AI500_COUNT=10
NEXT_PUBLIC_TOP_OI_COUNT=10
```

### Database Optimization
```typescript
// Limit historical trades in database
const recentTrades = trades.slice(-100);
```

## Security Best Practices

1. **API Keys**
   - Never commit `.env.local` to GitHub
   - Use environment variables
   - Regenerate keys regularly

2. **IP Whitelisting**
   - Add server IP to Binance whitelist
   - Restrict API access to specific IPs

3. **Monitoring**
   - Set up withdrawal alerts
   - Review login history
   - Monitor unusual trading patterns

4. **Backup**
   - Regular backups of configuration
   - Database backups if using SQLite
   - Code backups in GitHub

## Support & Resources

### Documentation
- [Next.js Docs](https://nextjs.org/docs)
- [Binance API Docs](https://binance-docs.github.io/apidocs/)
- [OpenRouter API](https://openrouter.ai/docs)

### Getting Help
1. Check browser console (F12)
2. Review application logs
3. Check Binance API status
4. Read error messages carefully

## Disaster Recovery

### If Trading Goes Wrong

1. **STOP IMMEDIATELY**
   ```bash
   # Kill the process
   Ctrl+C in terminal
   # Or: pm2 stop ai-trader
   ```

2. **Assess Situation**
   - Check Binance account
   - Review recent trades
   - Calculate current P&L

3. **Prevent Further Loss**
   - Disable API key
   - Close all positions manually
   - Adjust risk parameters

4. **Review & Learn**
   - Check decision logs
   - Identify what went wrong
   - Adjust strategy

## Conclusion

You now have a professional AI trading system. Remember:

✅ Start with testnet  
✅ Monitor closely  
✅ Start small  
✅ Be patient  
✅ Never risk more than you can afford  

Good luck with your trading! 🚀
