import { ITrader } from '../exchanges/BaseTrader';
import { MarketDataService } from '../services/MarketDataService';
import { PerformanceTracker } from '../services/PerformanceTracker';
import { AIDecisionEngine } from '../services/AIService_v2';
import { RiskManager } from './RiskManager';
import { 
  TradingConfig, 
  DecisionLog, 
  ExecutionResult,
  TradingDecision,
  Position,
  AccountInfo
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
   * Auto-close positions when the recorded take-profit target is reached.
   * This helps ensure positions are closed even if an exchange TP order is missing or failed.
   */
  private async autoClosePositionsByTakeProfit(existingPositions: Position[], accountInfo: AccountInfo): Promise<void> {
    if (!existingPositions || existingPositions.length === 0) return;

    for (const pos of existingPositions) {
      try {
        const openTrade = await this.performanceTracker.getOpenTrade(pos.symbol, pos.side);
        if (!openTrade || openTrade.takeProfit === null || openTrade.takeProfit === undefined) continue;
        const tp = Number(openTrade.takeProfit);
        const currentPrice = pos.currentPrice;

        const reachedTP = (pos.side === 'LONG' && currentPrice >= tp) || (pos.side === 'SHORT' && currentPrice <= tp);
        if (!reachedTP) continue;

        // Check for an existing exchange TP order; if it's present and matches the TP price, skip manual close.
        const openOrders = await this.trader.getOpenOrders(pos.symbol);
        const hasTPOrder = openOrders.some(o =>
          o.type === 'TAKE_PROFIT_MARKET' && o.positionSide === pos.side && o.stopPrice !== undefined && Math.abs((o.stopPrice as number) - tp) < 1e-6
        );

        if (hasTPOrder) {
          console.log(`   ↪ Exchange has TP order for ${pos.symbol} ${pos.side} @ ${tp} — skipping manual close`);
          continue;
        }

        // Risk check before closing
        const closeCheck = await this.riskManager.checkClosePosition(pos.symbol, pos.side, accountInfo);
        if (!closeCheck.allowed) {
          console.log(`   ⚠️ Auto-close blocked for ${pos.symbol}: ${closeCheck.reason}`);
          continue;
        }

        console.log(`   🎯 Auto-closing ${pos.symbol} ${pos.side} due to take-profit reached (${currentPrice} >= ${tp})`);
        const closeResult = await this.trader.closePosition(pos.symbol, pos.side, pos.quantity);
        if (closeResult.success) {
          await this.performanceTracker.recordCloseTrade(
            pos.symbol,
            pos.side,
            closeResult.executedPrice ?? currentPrice,
            closeResult.orderId,
            'take_profit'
          );
        } else {
          console.log(`   ❌ Auto-close failed for ${pos.symbol}: ${closeResult.error}`);
        }
      } catch (err: any) {
        console.log(`   ❌ Error while auto-closing for ${pos.symbol}: ${err.message}`);
        continue;
      }
    }
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

      // Auto-close positions that reached their take-profit target
      await this.autoClosePositionsByTakeProfit(existingPositions, accountInfo);

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
      if (!decision.symbol || (decision.position_size_usd === undefined && decision.quantity === undefined)) {
        continue;
      }

      let requestedQuantity: number;
      let leverage = 1; // Default leverage

      // Calculate quantity from position_size_usd if provided
      if (decision.position_size_usd !== undefined) {
        // Get current price to calculate quantity
        const currentPrice = await this.trader.getMarketPrice(decision.symbol);
        if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
          console.log(`   ❌ Unable to fetch valid market price for ${decision.symbol}`);
          results.push({
            decision,
            success: false,
            error: 'Unable to fetch market price for position size calculation',
            timestamp: Date.now(),
          });
          continue;
        }
        requestedQuantity = decision.position_size_usd / currentPrice;
        console.log(`   💰 Position size: $${decision.position_size_usd}, Price: $${currentPrice.toFixed(2)}, Quantity: ${requestedQuantity.toFixed(6)}`);
      } else {
        requestedQuantity = Number(decision.quantity);
      }

      if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
        console.log(`   ⚠️  Skipping ${decision.symbol || 'unknown'} open: invalid quantity ${requestedQuantity}`);
        results.push({
          decision,
          success: false,
          error: 'Invalid quantity specified',
          timestamp: Date.now(),
        });
        continue;
      }

      if (!Number.isFinite(leverage) || leverage <= 0) {
        console.log(`   ⚠️  Skipping ${decision.symbol || 'unknown'} open: invalid leverage ${decision.leverage}`);
        results.push({
          decision,
          success: false,
          error: 'Invalid leverage specified',
          timestamp: Date.now(),
        });
        continue;
      }

      const side = decision.action === 'open_long' ? 'LONG' : 'SHORT';
      
      console.log(`   Opening ${side} position on ${decision.symbol}...`);

      // Get current price
      const currentPrice = await this.trader.getMarketPrice(decision.symbol);

      if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
        console.log(`   ❌ Unable to fetch valid market price for ${decision.symbol}`);
        results.push({
          decision,
          success: false,
          error: 'Unable to fetch market price',
          timestamp: Date.now(),
        });
        continue;
      }

      // Ensure quantity satisfies exchange minimums (min notional / step size)
      const { quantity: normalizedQuantity, minNotional, adjusted } = await this.ensureMinimumQuantity(
        decision.symbol,
        requestedQuantity,
        currentPrice
      );

      if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
        console.log(`   ❌ Unable to determine valid quantity for ${decision.symbol}`);
        results.push({
          decision,
          success: false,
          error: 'Quantity failed minimum notional checks',
          timestamp: Date.now(),
        });
        continue;
      }

      if (adjusted) {
        console.log(
          `   ↪ Adjusted quantity to ${normalizedQuantity} to satisfy minimum notional $${minNotional.toFixed(2)}`
        );
      }

      // Use normalized quantity for downstream checks/execution
      decision.quantity = normalizedQuantity;
      decision.leverage = leverage;
      let finalQuantity = normalizedQuantity;
      const finalLeverage = leverage;

      // Risk checks
      let riskCheck = await this.riskManager.checkNewPosition(
        decision.symbol,
        side,
        finalQuantity,
        finalLeverage,
        currentPrice,
        accountInfo
      );

      if (!riskCheck.allowed) {
        const fallbackQuantity = riskCheck.adjustedQuantity;

        if (fallbackQuantity && fallbackQuantity > 0 && fallbackQuantity < finalQuantity) {
          console.log(`   ⚠️  Risk warning: ${riskCheck.reason}`);
          console.log(`   ↪ Retrying with 30% size (${fallbackQuantity}) to remain within margin limits`);

          finalQuantity = fallbackQuantity;
          decision.quantity = finalQuantity;

          riskCheck = await this.riskManager.checkNewPosition(
            decision.symbol,
            side,
            finalQuantity,
            finalLeverage,
            currentPrice,
            accountInfo
          );
        }

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
      }

      // Validate SL/TP
      const slTpValidation = this.riskManager.validateStopLossTakeProfit(
        side,
        currentPrice,
        decision.stop_loss,
        decision.profit_target
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
        finalQuantity,
        finalLeverage,
        decision.stop_loss,
        decision.profit_target
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
          quantity: result.executedQuantity ?? finalQuantity,
          leverage: finalLeverage,
          openTime: Date.now(),
          openOrderId: result.orderId,
          stopLoss: decision.stop_loss,
          takeProfit: decision.profit_target,
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
   * Ensure requested quantity satisfies Binance minimum notional/lot size rules
   */
  private async ensureMinimumQuantity(
    symbol: string,
    desiredQuantity: number,
    price: number
  ): Promise<{ quantity: number; minNotional: number; adjusted: boolean }> {
    const FALLBACK_MIN_NOTIONAL = 5;

    if (!Number.isFinite(desiredQuantity) || desiredQuantity <= 0 || !Number.isFinite(price) || price <= 0) {
      return { quantity: 0, minNotional: FALLBACK_MIN_NOTIONAL, adjusted: false };
    }

    let minNotional = FALLBACK_MIN_NOTIONAL;
    let stepSize: number | undefined;
    let minQty: number | undefined;

    try {
      const symbolInfo: any = await this.trader.getSymbolInfo(symbol);
      const filters: any[] = Array.isArray(symbolInfo?.filters) ? symbolInfo.filters : [];

      const minNotionalFilter = filters.find(
        f => f?.filterType === 'MIN_NOTIONAL' || f?.filterType === 'NOTIONAL'
      );
      if (minNotionalFilter) {
        const candidates = [
          minNotionalFilter.notional,
          minNotionalFilter.minNotional,
          minNotionalFilter.notionalFloor,
          minNotionalFilter.threshold,
        ];
        for (const candidate of candidates) {
          const numeric = typeof candidate === 'string' ? parseFloat(candidate) : Number(candidate);
          if (Number.isFinite(numeric) && numeric > 0) {
            minNotional = Math.max(minNotional, numeric);
            break;
          }
        }
      }

      const lotSizeFilter = filters.find(f => f?.filterType === 'MARKET_LOT_SIZE')
        || filters.find(f => f?.filterType === 'LOT_SIZE');

      if (lotSizeFilter) {
        const stepCandidate = typeof lotSizeFilter.stepSize === 'string'
          ? parseFloat(lotSizeFilter.stepSize)
          : Number(lotSizeFilter.stepSize);
        const minQtyCandidate = typeof lotSizeFilter.minQty === 'string'
          ? parseFloat(lotSizeFilter.minQty)
          : Number(lotSizeFilter.minQty);

        if (Number.isFinite(stepCandidate) && stepCandidate > 0) {
          stepSize = stepCandidate;
        }
        if (Number.isFinite(minQtyCandidate) && minQtyCandidate > 0) {
          minQty = minQtyCandidate;
        }
      }
    } catch (error: any) {
      console.warn(`Failed to load symbol info for ${symbol}: ${error.message}`);
    }

    let quantity = desiredQuantity;

    if (Number.isFinite(minQty) && minQty! > 0 && quantity < minQty!) {
      quantity = minQty!;
    }

    const minQtyByNotional = minNotional / price;
    if (quantity < minQtyByNotional) {
      quantity = minQtyByNotional;
    }

    if (stepSize && stepSize > 0) {
      const precision = this.getPrecision(stepSize);
      const steps = Math.ceil(quantity / stepSize - 1e-9);
      quantity = steps * stepSize;
      quantity = parseFloat(quantity.toFixed(precision));
    }

    const adjusted = Math.abs(quantity - desiredQuantity) > 1e-12;
    return { quantity, minNotional, adjusted };
  }

  private getPrecision(value: number): number {
    if (!Number.isFinite(value) || value === 0) {
      return 0;
    }

    const text = value.toString();
    if (text.includes('e-')) {
      const [base, exp] = text.split('e-');
      const baseDecimals = base.includes('.') ? base.split('.')[1].length : 0;
      return parseInt(exp, 10) + baseDecimals;
    }

    const decimals = text.split('.')[1];
    return decimals ? decimals.length : 0;
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
