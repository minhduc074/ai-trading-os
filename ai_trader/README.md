# AI Trading Operating System - Next.js Edition

A professional AI-powered cryptocurrency trading system built with Next.js, featuring real-time portfolio management, intelligent decision making, and comprehensive trading analytics.

## Features

### 🤖 AI-Powered Trading
- **OpenRouter Integration**: Uses GPT-4 or other LLMs via OpenRouter API
- **Chain of Thought Reasoning**: Full decision logic transparency
- **Self-Learning**: Adapts strategy based on historical performance
- **Real-Time Decision Making**: Automatic trade decisions every 3-5 minutes

### 📊 Trading Capabilities
- **Long & Short Positions**: Full futures trading support
- **Configurable Leverage**: 1x-50x per asset class
- **Risk Management**: Stop-loss and take-profit on every trade
- **Margin Control**: Automatic position sizing with 90% max margin usage
- **Position Limits**: 1.5x equity for altcoins, 10x for BTC/ETH

### 📈 Professional Dashboard
- Real-time account status and P&L tracking
- Open positions monitor with unrealized gains/losses
- Trade history with detailed statistics
- Win rate and profit factor calculations
- Margin usage visualization

### 💾 Comprehensive Logging
- Complete decision chain logs
- Market data snapshots
- Execution results with order IDs
- Performance metrics per cycle
- SQLite database for historical tracking

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Binance testnet or mainnet API keys
- OpenRouter API key (free tier available)

### Installation

```bash
# Clone the repository
cd ai_trader

# Install dependencies
npm install

# Configure environment
# Copy .env.local and add your API keys
# Ensure NEXT_PUBLIC_TRADING_MODE=testnet for testing
```

### Configuration

Edit `.env.local`:

```env
# Trading Mode
NEXT_PUBLIC_TRADING_MODE=testnet  # Start with testnet!

# Binance API (Testnet)
BINANCE_TESTNET_API_KEY=your_testnet_key
BINANCE_TESTNET_API_SECRET=your_testnet_secret

# AI Provider
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=your_openrouter_key

# Risk Parameters
NEXT_PUBLIC_MAX_LEVERAGE_ALTCOIN=50
NEXT_PUBLIC_MAX_LEVERAGE_MAJOR=50
NEXT_PUBLIC_MAX_MARGIN_USAGE=0.90
```

### Running

```bash
# Development mode
npm run dev

# Open browser
# http://localhost:3000
```

## API Endpoints

### Trading API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/trading/account` | GET | Get account balance and margin info |
| `/api/trading/positions` | GET | List all open positions |
| `/api/trading/trades` | GET | Get recent trade history |
| `/api/trading/decision` | POST | Get AI trading decision |
| `/api/trading/execute` | POST | Execute a trading decision |

### Example Usage

```typescript
// Get trading decision
const response = await fetch('/api/trading/decision', { method: 'POST' });
const decision = await response.json();

// Execute decision
await fetch('/api/trading/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(decision),
});
```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── trading/        # API routes for trading operations
│   ├── page.tsx            # Main dashboard
│   └── layout.tsx          # Root layout
├── lib/
│   ├── services/
│   │   ├── aiService.ts    # AI decision making
│   │   ├── marketDataService.ts  # Market data fetching
│   │   └── tradingEngine.ts      # Position management
│   └── types.ts            # TypeScript interfaces
└── env.local               # Environment configuration
```

## The 7-Step Trading Cycle

1. **Analyze Performance**: Review last 20 trades for patterns
2. **Get Account Status**: Check balance, margin, positions
3. **Analyze Positions**: Evaluate each open position
4. **Evaluate Opportunities**: Scan top coins for entry signals
5. **AI Decision**: Get comprehensive trading decision from AI
6. **Execute Trades**: Priority: close existing → open new
7. **Log Results**: Record complete decision and execution logs

## Trading Parameters

### Position Sizing
- **Altcoins**: Max 1.5x equity per position
- **Major Coins (BTC/ETH)**: Max 10x equity per position
- **Maximum Margin Usage**: 90% of available balance

### Risk Management
- **Minimum Risk-Reward Ratio**: 1:2 (stop-loss to take-profit)
- **Leverage Range**: 1x-50x (configurable per asset)
- **Liquidity Filter**: $15M minimum USD open interest

### Market Data
- **Timeframes**: 3-minute and 4-hour K-lines
- **Indicators**: RSI, EMA, MACD, ATR
- **Coin Selection**: Top 20 major coins + Top 20 by open interest

## Dashboard Features

### Account Status Card
- Total balance tracking
- Available balance
- Margin usage percentage
- Unrealized PnL
- Daily PnL

### Quick Stats
- Win rate (last 20 trades)
- Average profit per trade
- Profit factor
- Sharpe ratio

### Open Positions Table
- Symbol and trading side
- Entry and current prices
- Leverage and quantity
- Unrealized PnL and percentage
- Position duration

### Recent Trades Table
- Historical trades
- Entry and exit prices
- PnL in USDT and percentage
- Trade duration

## Important Warnings ⚠️

1. **Always Start with Testnet**
   - Get free testnet funds from Binance testnet faucet
   - Practice for 24-48 hours before going live
   - Review all decision logs

2. **Monitor Closely**
   - Check dashboard regularly
   - Watch for unusual trading patterns
   - Keep error logs and debug info

3. **Start Small**
   - Use $100-500 initial capital
   - Never risk more than you can afford to lose
   - Scale gradually after profitable testing

4. **Understand the Risks**
   - Cryptocurrency trading is highly risky
   - Past performance ≠ future results
   - Markets can move extremely fast
   - Always have an exit plan

## Deployment

### Vercel (Recommended)

```bash
# Push to GitHub and connect to Vercel
# Set environment variables in Vercel dashboard
# Deploy automatically on push
```

### Self-Hosted

```bash
npm run build
npm run start
# Application runs on http://localhost:3000
```

## Development

### Adding Custom Indicators

Edit `src/lib/services/marketDataService.ts`:

```typescript
private async fetchSymbolData(symbol: string): Promise<MarketData> {
  // Add your custom indicator calculation here
  const customIndicator = calculateYourIndicator(priceData);
  // ...
}
```

### Modifying AI Strategy

Edit `src/lib/services/aiService.ts`:

```typescript
private buildPrompt(...): string {
  // Customize the AI prompt here
  // Add more context or change decision criteria
}
```

### Customizing Risk Parameters

Edit `.env.local`:

```env
NEXT_PUBLIC_MAX_LEVERAGE_ALTCOIN=50
NEXT_PUBLIC_MAX_MARGIN_USAGE=0.90
```

## Troubleshooting

### API Key Issues
- Verify keys in `.env.local`
- Check Binance API key permissions
- Ensure testnet keys for testnet mode

### Market Data Errors
- Check Binance API availability
- Verify coin symbols are correct
- Ensure adequate API rate limits

### Connection Issues
- Verify network connectivity
- Check API rate limiting
- Review browser console for errors

## Performance Optimization

- Real-time updates every 5 seconds
- Efficient batch API calls
- Client-side position tracking
- Optimized database queries

## License

MIT License - Use at your own risk. See LICENSE file for details.

## Disclaimer

This software is provided for **educational and research purposes only**. Cryptocurrency trading involves substantial risk of loss. The authors are not responsible for any financial losses. Always:

- Understand what the code does before running it
- Test thoroughly on testnet first
- Start with small amounts
- Never invest more than you can afford to lose
- Consult with financial advisors
- Comply with local regulations

## Support

For issues and questions:
1. Check console logs in browser
2. Review API endpoint responses
3. Verify `.env.local` configuration
4. Check Binance API status

---

**Trade safely and responsibly.** 🚀

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
