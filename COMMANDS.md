# Quick Start Commands

## Installation

```powershell
# Install all dependencies
npm install

# Or with yarn
yarn install
```

## Development

```powershell
# Start in development mode (auto-reload on changes)
npm run dev

# Build TypeScript to JavaScript
npm run build

# Clean build artifacts
npm run clean
```

## Production

```powershell
# Build and run in production
npm run build
npm start
```

## Testing

```powershell
# Always start with testnet!
# Edit .env and set:
TRADING_MODE=testnet

# Then run
npm run dev
```

## Common Tasks

### View Real-time Dashboard
```powershell
# Start the system, then open browser:
http://localhost:3000
```

### Check Decision Logs
```powershell
# Logs are saved in:
ls decision_logs\

# View latest log:
Get-Content (Get-ChildItem decision_logs\trader_*\*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName | ConvertFrom-Json
```

### Check Database
```powershell
# Install SQLite viewer
npm install -g sqlite3

# Open database
sqlite3 data/performance.db

# View trades
SELECT * FROM trades ORDER BY close_time DESC LIMIT 10;

# View equity history
SELECT * FROM equity_snapshots ORDER BY timestamp DESC LIMIT 20;
```

### Reset Everything
```powershell
# Stop the system first (Ctrl+C)

# Remove database and logs
Remove-Item -Recurse -Force data
Remove-Item -Recurse -Force decision_logs

# Restart to create fresh database
npm run dev
```

## Environment Variables

```powershell
# Set environment variable (Windows PowerShell)
$env:TRADING_MODE = "testnet"
$env:BINANCE_TESTNET_API_KEY = "your_key"

# Or edit .env file directly
notepad .env
```

## Monitoring

### Watch Logs Live
```powershell
# The system outputs detailed logs to console
# Watch for:
# - 📈 Historical performance
# - 💰 Account status
# - 🔍 Position analysis
# - 🧠 AI decisions
# - ⚡ Trade execution
# - ✅ Cycle completion
```

### Check System Status
```powershell
# Make API call to check status
Invoke-RestMethod -Uri "http://localhost:3000/api/status"

# Check health
Invoke-RestMethod -Uri "http://localhost:3000/api/health"
```

## Troubleshooting

### Port Already in Use
```powershell
# Find process using port 3000
netstat -ano | findstr :3000

# Kill process (replace PID with actual process ID)
taskkill /PID <PID> /F

# Or change port in .env
DASHBOARD_PORT=3001
```

### Module Not Found
```powershell
# Reinstall dependencies
Remove-Item -Recurse -Force node_modules
npm install
```

### TypeScript Errors
```powershell
# Rebuild
npm run clean
npm run build
```

## Safety Tips

1. **Always use testnet first**
   ```powershell
   # In .env:
   TRADING_MODE=testnet
   ```

2. **Start with small amounts**
   - Test with $100-500 initially
   - Monitor for 24-48 hours

3. **Monitor closely**
   - Check dashboard every few hours
   - Review decision logs
   - Watch for unusual behavior

4. **Set up alerts** (optional)
   - Monitor equity drops
   - Track consecutive losses
   - Alert on API errors

## Useful Scripts

### Check Last 5 Trades
```powershell
# PowerShell script to view recent trades from database
$db = "data/performance.db"
sqlite3 $db "SELECT symbol, side, entry_price, exit_price, pnl, pnl_percent, datetime(close_time/1000, 'unixepoch') as close_time FROM trades WHERE status='closed' ORDER BY close_time DESC LIMIT 5;"
```

### Calculate Total PnL
```powershell
sqlite3 data/performance.db "SELECT SUM(pnl) as total_pnl, COUNT(*) as total_trades, SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins FROM trades WHERE status='closed';"
```

### Backup Data
```powershell
# Create backup folder with timestamp
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = "backup_$timestamp"

# Copy database and logs
Copy-Item -Recurse data $backupDir\data
Copy-Item -Recurse decision_logs $backupDir\decision_logs

Write-Host "Backup created: $backupDir"
```

## Advanced Usage

### Run Multiple Traders
```powershell
# You can run multiple instances with different configs
# Copy project folder and use different ports/API keys

# Instance 1 (port 3000)
cd ai-trading-os-1
npm run dev

# Instance 2 (port 3001)
cd ai-trading-os-2
# Edit .env: DASHBOARD_PORT=3001
npm run dev
```

### Custom Coin List
```powershell
# Edit src/services/MarketDataService.ts
# Modify getDefaultCoinPool() method
# Add your preferred trading pairs
```

### Adjust Decision Interval
```powershell
# In .env, change interval (in milliseconds)
DECISION_INTERVAL_MS=300000  # 5 minutes
DECISION_INTERVAL_MS=120000  # 2 minutes (more aggressive)
```

## Performance Optimization

### Reduce API Calls
- Use `COIN_SELECTION_MODE=default` (fewer coins)
- Increase `DECISION_INTERVAL_MS` (less frequent)

### Improve AI Response Time
- Use DeepSeek (faster than Qwen)
- Reduce `HISTORICAL_CYCLES_COUNT` (less data to analyze)

### Database Maintenance
```powershell
# Compact database
sqlite3 data/performance.db "VACUUM;"

# Archive old logs
$cutoffDate = (Get-Date).AddDays(-30)
Get-ChildItem decision_logs\*\*.json | Where-Object { $_.LastWriteTime -lt $cutoffDate } | Move-Item -Destination "archive\"
```

## Getting Help

1. Check `SETUP.md` for detailed setup instructions
2. Review `README.md` for feature overview
3. Check console logs for errors
4. Examine decision logs for AI reasoning
5. Verify `.env` configuration

## Exit/Stop System

```powershell
# Press Ctrl+C in terminal to stop gracefully
# The system will:
# - Stop the trading loop
# - Close database connections
# - Save final state
```

---

**Remember: Always test with testnet before using real funds!** 🚀
