import dotenv from 'dotenv';
import { BinanceTrader } from './exchanges/BinanceTrader';
import { AIDecisionEngine } from './services/AIService';
import { TradingEngine } from './core/TradingEngine';
import { TradingConfig } from './types';
import { startDashboardServer } from './dashboard/server';

// Load environment variables
dotenv.config();

/**
 * Main entry point for AI Trading Operating System
 */
async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🤖 AI Trading Operating System v2.0.2                      ║
║                                                               ║
║   Full Trading Support | AI Self-Learning | Multi-Exchange   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);

  // Load configuration
  const config: TradingConfig = {
    mode: (process.env.TRADING_MODE as 'mainnet' | 'testnet') || 'testnet',
    decisionInterval: parseInt(process.env.DECISION_INTERVAL_MS || '180000'),
    maxPositions: parseInt(process.env.MAX_POSITIONS || '5'),
    
    maxLeverageAltcoin: parseInt(process.env.MAX_LEVERAGE_ALTCOIN || '20'),
    maxLeverageMajor: parseInt(process.env.MAX_LEVERAGE_MAJOR || '50'),
    maxPositionSizeAltcoinMultiplier: parseFloat(process.env.MAX_POSITION_SIZE_ALTCOIN_MULTIPLIER || '1.5'),
    maxPositionSizeMajorMultiplier: parseFloat(process.env.MAX_POSITION_SIZE_MAJOR_MULTIPLIER || '10'),
    maxMarginUsage: parseFloat(process.env.MAX_MARGIN_USAGE || '0.90'),
    minRiskRewardRatio: parseFloat(process.env.MIN_RISK_REWARD_RATIO || '2.0'),
    
    minLiquidityUSD: parseInt(process.env.MIN_LIQUIDITY_USD || '15000000'),
    coinSelectionMode: (process.env.COIN_SELECTION_MODE as 'default' | 'advanced') || 'default',
    topAI500Count: parseInt(process.env.TOP_AI500_COUNT || '20'),
    topOICount: parseInt(process.env.TOP_OI_COUNT || '20'),
    
    aiProvider: (process.env.AI_PROVIDER as 'deepseek' | 'qwen' | 'openrouter') || 'deepseek',
    historicalCyclesCount: parseInt(process.env.HISTORICAL_CYCLES_COUNT || '20'),
  };

  console.log('\n📋 Configuration:');
  console.log(`   Trading Mode: ${config.mode.toUpperCase()}`);
  console.log(`   Decision Interval: ${config.decisionInterval / 1000}s`);
  console.log(`   Max Positions: ${config.maxPositions}`);
  console.log(`   AI Provider: ${config.aiProvider}`);
  console.log(`   Coin Selection: ${config.coinSelectionMode}`);
  console.log('');

  // Validate required environment variables
  const requiredVars = [
    config.mode === 'testnet' ? 'BINANCE_TESTNET_API_KEY' : 'BINANCE_API_KEY',
    config.mode === 'testnet' ? 'BINANCE_TESTNET_API_SECRET' : 'BINANCE_API_SECRET',
  ];

  // Add AI-specific validation
  if (config.aiProvider === 'deepseek') {
    requiredVars.push('DEEPSEEK_API_KEY');
  } else if (config.aiProvider === 'qwen') {
    requiredVars.push('QWEN_API_KEY');
  } else if (config.aiProvider === 'openrouter') {
    requiredVars.push('OPENROUTER_API_KEY');
  }

  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    console.error('Please check your .env file');
    process.exit(1);
  }

  try {
    // Initialize exchange trader
    console.log('🔌 Connecting to exchange...');
    const trader = new BinanceTrader({
      apiKey: config.mode === 'testnet' 
        ? process.env.BINANCE_TESTNET_API_KEY!
        : process.env.BINANCE_API_KEY!,
      apiSecret: config.mode === 'testnet'
        ? process.env.BINANCE_TESTNET_API_SECRET!
        : process.env.BINANCE_API_SECRET!,
      isTestnet: config.mode === 'testnet',
    });

    // Test connection
    const accountInfo = await trader.getAccountInfo();
    console.log(`✅ Connected to ${trader.name}`);
    console.log(`   Account Equity: $${accountInfo.totalEquity.toFixed(2)} USDT\n`);

    // Initialize AI engine
    console.log('🧠 Initializing AI engine...');
    
    const aiEngine = new AIDecisionEngine({
      provider: config.aiProvider,
      apiKey: config.aiProvider === 'deepseek'
        ? process.env.DEEPSEEK_API_KEY!
        : config.aiProvider === 'qwen'
          ? process.env.QWEN_API_KEY!
          : process.env.OPENROUTER_API_KEY!,
        baseURL: config.aiProvider === 'deepseek'
          ? process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
          : config.aiProvider === 'qwen'
            ? process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
            : process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    });
    
    console.log('✅ AI engine ready\n');

    // Initialize trading engine
    const tradingEngine = new TradingEngine(
      trader,
      aiEngine,
      config,
      `trader_${config.mode}_${Date.now()}`
    );

    // Start dashboard server
    console.log('📊 Starting dashboard server...');
    const dashboardPort = parseInt(process.env.DASHBOARD_PORT || '3000');
    await startDashboardServer(dashboardPort, tradingEngine);
    console.log(`✅ Dashboard available at http://localhost:${dashboardPort}\n`);

    // Start trading engine
    tradingEngine.start();

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n\n🛑 Received SIGINT, shutting down gracefully...');
      tradingEngine.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n\n🛑 Received SIGTERM, shutting down gracefully...');
      tradingEngine.stop();
      process.exit(0);
    });

  } catch (error: any) {
    console.error(`\n❌ Fatal error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Start the application
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
