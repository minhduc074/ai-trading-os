#!/usr/bin/env node
// =============================================================================
// AI Trader - Standalone Background Service
// =============================================================================
// This runs completely independently without Next.js web server.
// No browser or web UI required - just run: node standalone/index.js
// =============================================================================

require('dotenv').config({ path: '.env.local' });

const { TradingEngine } = require('./tradingEngine');
const { AIService } = require('./aiService');
const { MarketDataService } = require('./marketDataService');
const { PerformanceService } = require('./performanceService');

// Configuration from environment
const CONFIG = {
  decisionIntervalMs: parseInt(process.env.DECISION_INTERVAL_MS || '900000', 10), // 15 min default
  minLiquidityUsd: parseFloat(process.env.MIN_LIQUIDITY_USD || '10000000'),
  simulationMode: process.env.SIMULATION_MODE === 'true',
  tradingPair: process.env.TRADING_PAIR || 'BTCUSDT',
};

// Initialize services
const tradingEngine = new TradingEngine();
const aiService = new AIService();
const marketDataService = new MarketDataService();
const performanceService = new PerformanceService();

// Track cycle count
let cycleCount = 0;
let isRunning = true;

/**
 * Display startup banner
 */
function showBanner() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                                                              ║');
  console.log('║     🤖 AI TRADER - STANDALONE BACKGROUND SERVICE 🤖         ║');
  console.log('║                                                              ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║                                                              ║');
  console.log(`║  📊 Decision Interval: ${(CONFIG.decisionIntervalMs / 60000).toFixed(0).padStart(3)} minutes                          ║`);
  console.log(`║  💰 Min Liquidity: $${(CONFIG.minLiquidityUsd / 1000000).toFixed(0).padStart(4)}M                                  ║`);
  console.log(`║  🎮 Mode: ${CONFIG.simulationMode ? 'SIMULATION' : 'LIVE TRADING'}                                   ║`);
  console.log(`║  📈 Primary Pair: ${CONFIG.tradingPair.padEnd(10)}                             ║`);
  console.log('║                                                              ║');
  console.log('║  ⚠️  No web server required - runs independently!           ║');
  console.log('║                                                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
}

/**
 * Execute trading decision with support for multiple decisions
 */
async function executeDecisions(decision) {
  const results = [];

  // Check if this is a multiple decisions request
  if (decision.decisions && Array.isArray(decision.decisions) && decision.decisions.length > 0) {
    console.log(`\n[${new Date().toISOString()}] 📋 Executing ${decision.decisions.length} decisions...`);

    let successCount = 0;
    let failureCount = 0;

    // Execute each decision in priority order (already sorted)
    for (let i = 0; i < decision.decisions.length; i++) {
      const item = decision.decisions[i];
      console.log(`\n[${new Date().toISOString()}] ▶️  Decision ${i + 1}/${decision.decisions.length}: ${item.action} ${item.symbol}`);
      console.log(`   💭 Reasoning: ${item.reasoning}`);
      console.log(`   🎯 Confidence: ${(item.confidence * 100).toFixed(0)}%`);

      try {
        const result = await tradingEngine.executeDecision(item);
        results.push({ decision: item, result });

        if (result.success) {
          successCount++;
          console.log(`   ✅ Success: ${result.message || 'Executed successfully'}`);
        } else {
          failureCount++;
          console.log(`   ❌ Failed: ${result.error}`);
        }
      } catch (error) {
        failureCount++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`   ❌ Error: ${errorMsg}`);
        results.push({ decision: item, result: { success: false, error: errorMsg } });
      }
    }

    console.log(`\n[${new Date().toISOString()}] 📊 Multiple decisions: ${successCount} succeeded, ${failureCount} failed`);
    return { success: successCount > 0, results, successCount, failureCount };
  }

  // Single decision
  if (decision.action !== 'WAIT' && decision.action !== 'HOLD') {
    console.log(`\n[${new Date().toISOString()}] ⚡ Executing trade: ${decision.action} ${decision.symbol || ''}`);
    
    try {
      const result = await tradingEngine.executeDecision(decision);
      if (result.success) {
        console.log(`   ✅ ${result.message || 'Trade executed successfully'}`);
      } else {
        console.log(`   ❌ ${result.error}`);
      }
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`   ❌ Execution error: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }

  return { success: true, message: 'No action taken (WAIT/HOLD)' };
}

/**
 * Main trading decision cycle
 */
async function makeTradingDecision() {
  cycleCount++;
  const cycleStart = Date.now();
  
  console.log('');
  console.log('═'.repeat(70));
  console.log(`[${new Date().toISOString()}] 🔄 TRADING CYCLE #${cycleCount}`);
  console.log('═'.repeat(70));
  
  try {
    // Step 1: Get account status
    console.log(`\n[${new Date().toISOString()}] 📊 Fetching account status...`);
    const accountStatus = await tradingEngine.getAccountStatus();
    console.log(`   💰 Balance: $${accountStatus.totalBalance.toFixed(2)}`);
    console.log(`   📉 Available: $${accountStatus.availableBalance.toFixed(2)}`);
    console.log(`   📊 Margin Usage: ${accountStatus.marginUsagePercent.toFixed(1)}%`);
    console.log(`   📈 Unrealized PnL: $${accountStatus.unrealizedPnL.toFixed(2)}`);

    // Step 2: Get current positions
    console.log(`\n[${new Date().toISOString()}] 📍 Fetching positions...`);
    const positions = await tradingEngine.getPositions();
    if (positions.length > 0) {
      positions.forEach((pos, idx) => {
        const pnlColor = pos.unrealizedPnL >= 0 ? '🟢' : '🔴';
        console.log(`   ${idx + 1}. ${pos.symbol} ${pos.side} ${pnlColor} $${pos.unrealizedPnL.toFixed(2)} (${pos.unrealizedPnLPercent.toFixed(2)}%)`);
      });
    } else {
      console.log('   No open positions');
    }

    // Step 3: Get market data
    console.log(`\n[${new Date().toISOString()}] 📈 Fetching market data...`);
    const coins = marketDataService.getDefaultCoinPool();
    const marketData = await marketDataService.getMarketData(coins);
    console.log(`   Fetched data for ${marketData.length} symbols`);

    // Filter by liquidity
    const filteredData = marketData.filter(m => m.liquidityUSD > CONFIG.minLiquidityUsd);
    console.log(`   ${filteredData.length} symbols meet liquidity threshold`);

    // Check if we have any market data
    const dataToUse = filteredData.length > 0 ? filteredData : marketData.slice(0, 10);
    
    if (dataToUse.length === 0) {
      console.warn(`\n[${new Date().toISOString()}] ⚠️  No market data available - skipping AI call`);
      console.log(`⏰ Next decision in ${CONFIG.decisionIntervalMs / 60000} minutes`);
      return;
    }

    // Step 4: Get recent trades for performance metrics
    console.log(`\n[${new Date().toISOString()}] 📊 Calculating performance metrics...`);
    const recentTrades = await tradingEngine.getRecentTrades(50);
    const performanceMetrics = performanceService.calculateMetrics(recentTrades);
    console.log(`   📈 Win Rate: ${(performanceMetrics.winRate * 100).toFixed(1)}%`);
    console.log(`   💹 Profit Factor: ${performanceMetrics.profitFactor.toFixed(2)}`);
    console.log(`   📊 Total Trades: ${performanceMetrics.totalTrades}`);

    // Step 5: Get AI decision
    console.log(`\n[${new Date().toISOString()}] 🤖 Requesting AI trading decision...`);
    const decision = await aiService.getTradeDecision(
      accountStatus,
      positions,
      dataToUse,
      performanceMetrics
    );

    // Log decision summary
    console.log(`\n[${new Date().toISOString()}] 📋 DECISION SUMMARY:`);
    console.log(`   🎯 Action: ${decision.action}`);
    if (decision.symbol) {
      console.log(`   📊 Symbol: ${decision.symbol}`);
    }
    console.log(`   💭 Reasoning: ${decision.reasoning.substring(0, 100)}...`);
    console.log(`   🎯 Confidence: ${(decision.confidence * 100).toFixed(0)}%`);
    console.log(`   🤖 AI Agent: ${decision.aiAgent || 'Unknown'}`);
    
    if (decision.decisions && decision.decisions.length > 0) {
      console.log(`   📋 Sub-decisions: ${decision.decisions.length}`);
      decision.decisions.forEach((d, i) => {
        console.log(`      ${i + 1}. ${d.action} ${d.symbol} (${(d.confidence * 100).toFixed(0)}%)`);
      });
    }

    // Step 6: Execute decision(s)
    await executeDecisions(decision);

    // Cycle complete
    const cycleDuration = ((Date.now() - cycleStart) / 1000).toFixed(1);
    console.log(`\n[${new Date().toISOString()}] ✅ Cycle #${cycleCount} complete (${cycleDuration}s)`);
    console.log(`⏰ Next decision in ${CONFIG.decisionIntervalMs / 60000} minutes`);
    console.log('═'.repeat(70));

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`\n[${new Date().toISOString()}] ❌ Error in trading cycle:`, errorMsg);
    console.error(error.stack || error);
    console.log(`⏰ Will retry in ${CONFIG.decisionIntervalMs / 60000} minutes`);
    console.log('═'.repeat(70));
  }
}

/**
 * Graceful shutdown handler
 */
function shutdown(signal) {
  console.log(`\n[${new Date().toISOString()}] 📛 Received ${signal} signal`);
  console.log('🛑 Shutting down AI Trader Background Service...');
  isRunning = false;
  
  // Give a moment for any in-flight operations
  setTimeout(() => {
    console.log('👋 Goodbye!');
    process.exit(0);
  }, 1000);
}

/**
 * Main entry point
 */
async function main() {
  // Show banner
  showBanner();

  // Setup signal handlers for graceful shutdown
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  console.log(`[${new Date().toISOString()}] 🚀 Starting AI Trader Background Service...`);
  console.log('Press Ctrl+C to stop\n');

  // Run initial decision
  await makeTradingDecision();

  // Schedule recurring decisions
  const intervalId = setInterval(async () => {
    if (isRunning) {
      await makeTradingDecision();
    } else {
      clearInterval(intervalId);
    }
  }, CONFIG.decisionIntervalMs);

  console.log(`\n[${new Date().toISOString()}] ✅ Background trader is now running`);
}

// Run if this is the main module
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

module.exports = { main, makeTradingDecision };
