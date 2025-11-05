import { ITrader } from '../exchanges/BaseTrader';
import { MarketDataService } from '../services/MarketDataService';
import { PerformanceTracker } from '../services/PerformanceTracker';
import { AIDecisionEngine } from '../services/AIService';
import { RiskManager } from './RiskManager';
import { 
  TradingConfig, 
  DecisionLog, 
  ExecutionResult,
  TradingDecision 
} from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Trading Engine - Orchestrates the 7-step AI decision flow
 * 
 * The Decision Cycle (every 3-5 minutes):
 * 1. Analyze Historical Performance
 * 2. Get Account Status
 * 3. Analyze Existing Positions
 * 4. Evaluate New Opportunities
 * 5. AI Comprehensive Decision
 * 6. Execute Trades
 * 7. Record Logs & Update Performance
 */
export class TradingEngine {
  private trader: ITrader;
  private marketDataService: MarketDataService;
  private performanceTracker: PerformanceTracker;
  private aiEngine: AIDecisionEngine;
  private riskManager: RiskManager;
  private config: TradingConfig;
  private traderId: string;
  private cycleNumber: number = 0;
  private isRunning: boolean = false;
  private intervalId?: NodeJS.Timeout;
  private lastAccountInfo?: any;
  private recentActions: Array<{timestamp: number; action: string; symbol?: string; details?: string}> = [];
  private cycleHistory: Array<{cycle: number; equity: number; decisions: number; timestamp: number}> = [];

  constructor(
    trader: ITrader,
    aiEngine: AIDecisionEngine,
    config: TradingConfig,
    traderId: string = 'default'
  ) {
    this.trader = trader;
    this.aiEngine = aiEngine;
    this.config = config;
    this.traderId = traderId;

    // Initialize services
    this.marketDataService = new MarketDataService(trader, config.minLiquidityUSD);
    this.performanceTracker = new PerformanceTracker(traderId);
    this.riskManager = new RiskManager(config);

    console.log(`Trading Engine initialized for trader: ${traderId}`);
  }

  /**
   * Start the trading loop
   */
  start(): void {
    if (this.isRunning) {
      console.log('Trading engine is already running');
      return;
    }

    this.isRunning = true;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 Starting AI Trading Operating System`);
    console.log(`Trader: ${this.traderId}`);
    console.log(`Exchange: ${this.trader.name}`);
    console.log(`Decision Interval: ${this.config.decisionInterval / 1000}s`);
    console.log(`${'='.repeat(60)}\n`);

    // Run first cycle immediately
    this.runDecisionCycle().catch(err => {
      console.error(`Error in initial cycle: ${err.message}`);
    });

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.runDecisionCycle().catch(err => {
        console.error(`Error in decision cycle: ${err.message}`);
      });
    }, this.config.decisionInterval);
  }

  /**
   * Stop the trading loop
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('Trading engine is not running');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.isRunning = false;
    console.log('\n🛑 Trading engine stopped\n');
  }

  /**
   * Run a single decision cycle (7 steps)
   */
  private async runDecisionCycle(): Promise<void> {
    this.cycleNumber++;
    const cycleStart = Date.now();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 Cycle #${this.cycleNumber} - ${new Date().toISOString()}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      // Step 1: Analyze Historical Performance
      console.log('📈 Step 1: Analyzing historical performance...');
      const historicalFeedback = await this.performanceTracker.getHistoricalFeedback(
        this.config.historicalCyclesCount
      );
      
      if (historicalFeedback.totalTrades > 0) {
        console.log(`   Win Rate: ${historicalFeedback.winRate.toFixed(1)}% | ` +
                    `Profit Factor: ${historicalFeedback.profitFactor.toFixed(2)} | ` +
                    `Trades: ${historicalFeedback.totalTrades}`);
      } else {
        console.log('   No historical data yet');
      }

      // Step 2: Get Account Status
      console.log('\n💰 Step 2: Getting account status...');
      const accountInfo = await this.trader.getAccountInfo();
      this.lastAccountInfo = accountInfo; // Store for dashboard
      console.log(`   Equity: $${accountInfo.totalEquity.toFixed(2)} | ` +
                  `Available: $${accountInfo.availableBalance.toFixed(2)} | ` +
                  `Positions: ${accountInfo.totalPositions}`);
      console.log(`   ${this.riskManager.getRiskSummary(accountInfo)}`);

      // Step 3: Analyze Existing Positions
      console.log('\n🔍 Step 3: Analyzing existing positions...');
      const existingPositions = accountInfo.positions;
      
      if (existingPositions.length > 0) {
        for (const pos of existingPositions) {
          console.log(`   ${pos.symbol} ${pos.side}: $${pos.unrealizedPnl.toFixed(2)} ` +
                      `(${pos.unrealizedPnlPercent.toFixed(2)}%) - ${pos.duration}`);
        }
      } else {
        console.log('   No open positions');
      }

      // Get market data for existing positions
      const positionMarketData = existingPositions.length > 0
        ? await this.marketDataService.getMarketDataForPositions(existingPositions)
        : new Map();

      // Step 4: Evaluate New Opportunities
      console.log('\n🎯 Step 4: Evaluating new opportunities...');
      const candidateCoins = await this.marketDataService.getCandidateCoins(
        this.config.coinSelectionMode
      );
      console.log(`   Found ${candidateCoins.length} candidate coins`);

      const filteredCoins = await this.marketDataService.filterByLiquidity(candidateCoins);
      console.log(`   After liquidity filter: ${filteredCoins.length} coins`);

      const opportunityData = await this.marketDataService.batchGetMarketData(filteredCoins);
      const rankedOpportunities = this.marketDataService.analyzeOpportunities(opportunityData);

      // Combine position data with opportunity data
      const allMarketData = [
        ...Array.from(positionMarketData.values()),
        ...rankedOpportunities,
      ];

      // Step 5: AI Comprehensive Decision
      console.log('\n🧠 Step 5: AI making comprehensive decision...');
      const { decisions, chainOfThought, fullPrompt } = await this.aiEngine.makeDecision(
        accountInfo,
        allMarketData,
        historicalFeedback,
        existingPositions
      );

      console.log(`\n   Chain of Thought:\n   ${chainOfThought.split('\n').join('\n   ')}\n`);
      console.log(`   AI Decisions: ${decisions.length} actions`);
      
      decisions.forEach((d, i) => {
        console.log(`   ${i + 1}. ${d.action.toUpperCase()}${d.symbol ? ` ${d.symbol}` : ''} - ${d.reasoning}`);
        // Track decision as action
        this.recentActions.push({
          timestamp: Date.now(),
          action: d.action,
          symbol: d.symbol,
          details: d.reasoning
        });
      });

      // Step 6: Execute Trades
      console.log('\n⚡ Step 6: Executing trades...');
      const executionResults = await this.executeDecisions(decisions, accountInfo);

      // Step 7: Record Logs & Update Performance
      console.log('\n📝 Step 7: Recording logs and updating performance...');
      await this.recordDecisionLog({
        timestamp: cycleStart,
        traderId: this.traderId,
        cycleNumber: this.cycleNumber,
        accountSnapshot: accountInfo,
        marketDataSnapshot: allMarketData,
        historicalFeedback,
        chainOfThought,
        decision: decisions,
        aiPrompt: fullPrompt,
        aiResponse: chainOfThought,
        executionResults,
        postExecutionEquity: 0, // Will be updated
      });

      // Update equity snapshot
      const finalAccountInfo = await this.trader.getAccountInfo();
      
      // Track cycle history for dashboard
      this.cycleHistory.push({
        cycle: this.cycleNumber,
        equity: finalAccountInfo.totalEquity,
        decisions: decisions.length,
        timestamp: Date.now()
      });
      // Keep only last 100 cycles
      if (this.cycleHistory.length > 100) {
        this.cycleHistory.shift();
      }
      await this.performanceTracker.recordEquitySnapshot(
        finalAccountInfo.totalEquity,
        finalAccountInfo.dailyPnl || 0,
        0 // Calculate percentage
      );

      const cycleDuration = ((Date.now() - cycleStart) / 1000).toFixed(1);
      console.log(`\n✅ Cycle #${this.cycleNumber} completed in ${cycleDuration}s`);
      console.log(`${'='.repeat(60)}\n`);

    } catch (error: any) {
      console.error(`\n❌ Error in cycle #${this.cycleNumber}: ${error.message}`);
      console.error(error.stack);
    }
  }

  /**
   * Execute trading decisions with priority and risk checks
   */
  private async executeDecisions(
    decisions: TradingDecision[],
    accountInfo: any
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];

    // Separate close and open decisions
    const closeDecisions = decisions.filter(d => 
      d.action === 'close_long' || d.action === 'close_short'
    );
    const openDecisions = decisions.filter(d => 
      d.action === 'open_long' || d.action === 'open_short'
    );

    // Priority 1: Close existing positions
    for (const decision of closeDecisions) {
      if (!decision.symbol) continue;

      const side = decision.action === 'close_long' ? 'LONG' : 'SHORT';
      
      console.log(`   Closing ${side} position on ${decision.symbol}...`);
      
      // Risk check
      const riskCheck = await this.riskManager.checkClosePosition(
        decision.symbol,
        side,
        accountInfo
      );

      if (!riskCheck.allowed) {
        console.log(`   ⚠️  Close blocked: ${riskCheck.reason}`);
        results.push({
          decision,
          success: false,
          error: riskCheck.reason,
          timestamp: Date.now(),
        });
        continue;
      }

      // Execute close
      const result = await this.trader.closePosition(decision.symbol, side, decision.quantity);
      results.push(result);

      if (result.success) {
        // Record closed trade in performance tracker
        await this.performanceTracker.recordCloseTrade(
          decision.symbol,
          side,
          result.executedPrice || 0,
          result.orderId,
          'ai_decision'
        );
        console.log(`   ✅ Closed successfully at $${result.executedPrice?.toFixed(2)}`);
      } else {
        console.log(`   ❌ Close failed: ${result.error}`);
      }

      // Small delay between orders
      await this.sleep(500);
    }

    // Priority 2: Open new positions
    for (const decision of openDecisions) {
      if (!decision.symbol || !decision.quantity || !decision.leverage) continue;

      const side = decision.action === 'open_long' ? 'LONG' : 'SHORT';
      
      console.log(`   Opening ${side} position on ${decision.symbol}...`);

      // Get current price
      const currentPrice = await this.trader.getMarketPrice(decision.symbol);

      // Risk checks
      const riskCheck = await this.riskManager.checkNewPosition(
        decision.symbol,
        side,
        decision.quantity,
        decision.leverage,
        currentPrice,
        accountInfo
      );

      if (!riskCheck.allowed) {
        console.log(`   ⚠️  Open blocked: ${riskCheck.reason}`);
        results.push({
          decision,
          success: false,
          error: riskCheck.reason,
          timestamp: Date.now(),
        });
        continue;
      }

      // Validate SL/TP
      const slTpValidation = this.riskManager.validateStopLossTakeProfit(
        side,
        currentPrice,
        decision.stopLoss,
        decision.takeProfit
      );

      if (!slTpValidation.valid) {
        console.log(`   ⚠️  SL/TP invalid: ${slTpValidation.reason}`);
        results.push({
          decision,
          success: false,
          error: slTpValidation.reason,
          timestamp: Date.now(),
        });
        continue;
      }

      // Execute open
      const result = await this.trader.openPosition(
        decision.symbol,
        side,
        decision.quantity,
        decision.leverage,
        decision.stopLoss,
        decision.takeProfit
      );
      results.push(result);

      if (result.success) {
        // Record opened trade in performance tracker
        await this.performanceTracker.recordOpenTrade({
          traderId: this.traderId,
          symbol: decision.symbol,
          side,
          symbolSide: `${decision.symbol}_${side}`,
          entryPrice: result.executedPrice || currentPrice,
          quantity: result.executedQuantity || decision.quantity,
          leverage: decision.leverage,
          openTime: Date.now(),
          openOrderId: result.orderId,
          stopLoss: decision.stopLoss,
          takeProfit: decision.takeProfit,
          status: 'open',
        });
        console.log(`   ✅ Opened successfully at $${result.executedPrice?.toFixed(2)}`);
      } else {
        console.log(`   ❌ Open failed: ${result.error}`);
      }

      // Small delay between orders
      await this.sleep(500);
    }

    return results;
  }

  /**
   * Record complete decision log to file
   */
  private async recordDecisionLog(log: DecisionLog): Promise<void> {
    try {
      const logDir = path.join(process.cwd(), 'decision_logs', this.traderId);
      
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const fileName = `cycle_${this.cycleNumber}_${Date.now()}.json`;
      const filePath = path.join(logDir, fileName);

      fs.writeFileSync(filePath, JSON.stringify(log, null, 2));
      console.log(`   Saved decision log: ${fileName}`);
    } catch (error: any) {
      console.error(`   Failed to save decision log: ${error.message}`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current status
   */
  getStatus(): { 
    isRunning: boolean; 
    cycleNumber: number; 
    traderId: string;
    accountInfo?: any;
    recentActions: Array<{timestamp: number; action: string; symbol?: string; details?: string}>;
    cycleHistory: Array<{cycle: number; equity: number; decisions: number; timestamp: number}>;
  } {
    return {
      isRunning: this.isRunning,
      cycleNumber: this.cycleNumber,
      traderId: this.traderId,
      accountInfo: this.lastAccountInfo,
      recentActions: this.recentActions.slice(-20), // Last 20 actions
      cycleHistory: this.cycleHistory.slice(-50), // Last 50 cycles
    };
  }
}
