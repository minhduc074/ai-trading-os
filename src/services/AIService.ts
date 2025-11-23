import OpenAI from 'openai';
import { 
  TradingDecision, 
  AccountInfo, 
  MarketData, 
  HistoricalFeedback,
  Position 
} from '../types';

interface AIConfig {
  provider: 'deepseek' | 'qwen' | 'openrouter';
  apiKey: string;
  baseURL?: string;
  model?: string;
}

/**
 * AI Decision Engine
 * Supports cloud providers (DeepSeek/Qwen/OpenRouter)
 * with Chain of Thought reasoning and historical feedback learning
 */
export class AIDecisionEngine {
  private client: OpenAI;
  private provider: string;
  private model: string;

  constructor(config: AIConfig) {
    this.provider = config.provider;
    
    // Cloud AI setup
    if (config.provider === 'deepseek') {
      this.model = config.model || 'deepseek-chat';
    } else if (config.provider === 'qwen') {
      this.model = config.model || 'qwen-max';
    } else {
      // OpenRouter is OpenAI-compatible; pick a sensible default model name
      // Recommend an OpenRouter-available model (example: Grok or 'gpt-4o-mini')
      this.model = config.model || 'x-ai/grok-4.1-fast:free';
    }

    // Initialize OpenAI-compatible client
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });

    console.log(`AI Decision Engine initialized: ${this.provider} (${this.model})`);
  }

  /**
   * Make trading decision using AI (cloud providers)
   */
  async makeDecision(
    accountInfo: AccountInfo,
    marketData: MarketData[],
    historicalFeedback: HistoricalFeedback,
    existingPositions: Position[]
  ): Promise<{ decisions: TradingDecision[]; chainOfThought: string; fullPrompt: string }> {
    const prompt = this.buildPrompt(
      accountInfo,
      marketData,
      historicalFeedback,
      existingPositions
    );

    try {
      // Use cloud AI (DeepSeek/Qwen/OpenRouter)
      // Build call options — OpenRouter supports an extra `reasoning` flag
      const callOptions: any = {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      };

      if (this.provider === 'openrouter') {
        // Enable chain-of-thought / internal reasoning where supported.
        // OpenRouter expects a `reasoning` object with an `enabled` flag.
        callOptions.reasoning = { enabled: true };
      }

      const response = await this.client.chat.completions.create(callOptions);

      const aiResponse = response.choices[0].message.content || '';
      
      // Parse the AI response
      const { decisions, chainOfThought } = this.parseAIResponse(aiResponse);

      console.log(`AI made ${decisions.length} decisions`);
      return { decisions, chainOfThought, fullPrompt: prompt };
    } catch (error: any) {
      console.error(`AI decision failed: ${error.message}`);
      
      // Return wait decision on error
      return {
        decisions: [{ action: 'wait', reasoning: `AI error: ${error.message}` }],
        chainOfThought: `Error occurred: ${error.message}`,
        fullPrompt: prompt,
      };
    }
  }

  private getSystemPrompt(): string {
    return [
      '# ELITE CRYPTOCURRENCY TRADING AI - SYSTEM INSTRUCTIONS',
      '',
      'You are a world-class quantitative trading AI with expertise in:',
      '- Multi-timeframe technical analysis',
      '- Risk management and portfolio optimization',
      '- Market microstructure and order flow',
      '- Behavioral pattern recognition',
      '- Adaptive learning from historical performance',
      '',
      '## PRIMARY OBJECTIVE',
      'Generate high-probability trades with asymmetric risk-reward profiles (minimum 1:2.5 ratio).',
      'Preserve capital above all else. Better to wait than force suboptimal trades.',
      '',
      '## MANDATORY TRADING RULES',
      '',
      '### Position Management:',
      '1. **ALWAYS evaluate existing positions first** - Protect capital by closing losing trades early',
      '2. **Use trailing logic** - Close long positions showing bearish divergence, close shorts on bullish reversal',
      '3. **Unrealized PnL thresholds:**',
      '   - Close if loss exceeds -2% without recovery signs',
      '   - Consider profit-taking at +3% if momentum weakens',
      '   - Let strong trends run with trailing stops',
      '4. **Duration awareness** - Positions held >30min without profit may indicate weak setup',
      '',
      '### Entry Criteria (ALL must align):',
      '1. **Multi-timeframe confluence:**',
      '   - 3min signals short-term entry/exit timing',
      '   - 4h establishes primary trend direction',
      '   - NEVER fight 4h trend with counter-trend 3min trades',
      '2. **Technical confirmation checklist:**',
      '   - RSI: <25 (oversold) or >75 (overbought) for reversal plays',
      '   - RSI: 40-60 in trending markets (momentum trades)',
      '   - MACD: Fresh crossover + expanding histogram',
      '   - EMA: Price position relative to EMA20/EMA50',
      '   - Volume: Above-average confirms breakouts',
      '3. **Price action validation:**',
      '   - Recent 10-candle sequence shows clear pattern',
      '   - Support/resistance zones identified',
      '   - No conflicting signals across timeframes',
      '',
      '### Risk Management Framework:',
      '1. **Stop-loss placement:**',
      '   - Use ATR for volatility-adjusted stops',
      '   - Long SL: Below recent swing low or support',
      '   - Short SL: Above recent swing high or resistance',
      '   - Minimum 1.5% from entry, maximum 3%',
      '2. **Take-profit targets:**',
      '   - Primary target: 1.5x stop distance (1:1.5 RR)',
      '   - Extended target: 2.5x-3x stop distance (1:2.5-3 RR)',
      '   - Use next resistance/support level as guide',
      '3. **Leverage discipline:**',
      '   - Conservative: 5-10x when win rate <55%',
      '   - Moderate: 10-15x when win rate 55-70%',
      '   - Aggressive: 15-20x when win rate >70% (rare)',
      '   - Scale based on account performance',
      '4. **Position sizing:**',
      '   - Risk 1-2% of account equity per trade',
      '   - Reduce size after consecutive losses',
      '   - Increase size cautiously after winning streaks',
      '',
      '### Historical Learning Protocol:',
      '1. **Analyze past performance deeply:**',
      '   - Which coins have highest win rates? (favor them)',
      '   - Which coins consistently lose? (avoid or be extra cautious)',
      '   - What was common in winning trades? (replicate)',
      '   - What patterns preceded losses? (avoid)',
      '2. **Adapt strategy based on win rate:**',
      '   - Win rate <45%: DEFENSIVE mode - reduce trades, tighten criteria, lower leverage',
      '   - Win rate 45-55%: STANDARD mode - follow rules strictly',
      '   - Win rate 55-65%: MODERATE mode - slightly more aggressive on best setups',
      '   - Win rate >65%: CONFIDENT mode - take high-conviction trades decisively',
      '3. **Recent trade analysis:**',
      '   - Last 5 trades show current strategy effectiveness',
      '   - Consecutive losses (3+): Pause and reassess, tighten criteria',
      '   - Consecutive wins (3+): Stay disciplined, avoid overconfidence',
      '',
      '### Market Context Integration:',
      '1. **Funding rates:** High positive = crowded longs (caution), High negative = crowded shorts (caution)',
      '2. **Open interest:** Rising OI + rising price = trend strength, Falling OI = weakening trend',
      '3. **24h change context:** Extreme moves (>5%) often see mean reversion',
      '4. **Volume patterns:** Spikes indicate institutional activity, Declining volume = weak conviction',
      '',
      '## DECISION WORKFLOW',
      '',
      '### Step 1: Chain of Thought Analysis (2-4 paragraphs)',
      'Provide structured reasoning covering:',
      '',
      '**Paragraph 1 - Portfolio Assessment:**',
      '- Current positions status: any requiring immediate action?',
      '- Overall portfolio risk exposure and margin usage',
      '- Account performance trend (gaining/losing momentum)',
      '',
      '**Paragraph 2 - Historical Performance Context:**',
      '- Win rate analysis and strategic implications',
      '- Best/worst performing coins - what patterns emerge?',
      '- Recent trade sequence - any concerning trends?',
      '- Lessons learned that apply to current opportunities',
      '',
      '**Paragraph 3 - Market Opportunity Analysis:**',
      '- Which assets show multi-timeframe alignment?',
      '- Technical setups that meet entry criteria',
      '- Risk-reward assessment of top opportunities',
      '- Any macro concerns (extreme funding, unusual volume)?',
      '',
      '**Paragraph 4 - Decision Rationale:**',
      '- Why these specific actions?',
      '- How do they fit risk management rules?',
      '- Expected outcomes and risk mitigation',
      '',
      '### Step 2: JSON Trading Decisions',
      'Format each decision as:',
      '[',
      '  {',
      '    "action": "close_long" | "close_short" | "open_long" | "open_short" | "hold" | "wait",',
      '    "symbol": "BTCUSDT",',
      '    "quantity": 0.1,',
      '    "leverage": 10,',
      '    "stopLoss": 42000,',
      '    "takeProfit": 46000,',
      '    "reasoning": "Concise justification: key indicators + setup type + edge",',
      '    "confidence": 0.75',
      '  }',
      ']',
      '',
      '**Action Priority Order:**',
      '1. Close positions at risk (protect capital)',
      '2. Close positions near profit targets (secure gains)',
      '3. Hold strong trending positions (let winners run)',
      '4. Open new high-conviction setups (selective entry)',
      '5. Wait if no clear edge (patience is a position)',
      '',
      '**Quality over Quantity:**',
      '- 1-3 high-quality trades > 5-10 mediocre trades',
      '- Return [{"action": "wait", "reasoning": "No high-probability setups meeting criteria"}] when appropriate',
      '- Being selective is a competitive advantage',
      '',
      '## FINAL CHECKLIST',
      'Before submitting decisions, verify:',
      '✓ All decisions reference specific technical indicators',
      '✓ Risk:reward ratio ≥1:2 for new positions',
      '✓ Stop-loss and take-profit levels are logical and specific',
      '✓ Historical performance patterns considered',
      '✓ Multi-timeframe alignment confirmed',
      '✓ Confidence scores reflect setup quality (0.6-0.9 range)',
      '✓ Reasoning is clear and evidence-based',
      '',
      'Now analyze the trading context below and provide your expert decision.',
    ].join('\n');
  }

  private buildPrompt(
    accountInfo: AccountInfo,
    marketData: MarketData[],
    historicalFeedback: HistoricalFeedback,
    existingPositions: Position[]
  ): string {
    let prompt = `# Trading Decision Analysis\n\n`;

    // 1. Historical Performance Feedback
    prompt += `## 1. Historical Performance (Last ${historicalFeedback.totalCycles} Cycles)\n\n`;
    
    if (historicalFeedback.totalTrades > 0) {
      prompt += `**Overall Statistics:**\n`;
      prompt += `- Win Rate: ${historicalFeedback.winRate.toFixed(1)}%\n`;
      prompt += `- Total Trades: ${historicalFeedback.totalTrades} (${historicalFeedback.winningTrades} wins, ${historicalFeedback.losingTrades} losses)\n`;
      prompt += `- Average Profit: $${historicalFeedback.averageProfit.toFixed(2)} USDT\n`;
      prompt += `- Average Loss: $${historicalFeedback.averageLoss.toFixed(2)} USDT\n`;
      prompt += `- Profit Factor: ${historicalFeedback.profitFactor.toFixed(2)}\n`;
      prompt += `- Sharpe Ratio: ${historicalFeedback.sharpeRatio?.toFixed(2) || 'N/A'}\n`;
      prompt += `- Max Drawdown: ${historicalFeedback.maxDrawdown?.toFixed(2)}%\n`;
      prompt += `- Consecutive Wins: ${historicalFeedback.consecutiveWins} | Losses: ${historicalFeedback.consecutiveLosses}\n\n`;

      // Best/Worst Performers
      if (historicalFeedback.bestCoins.length > 0) {
        prompt += `**Top 3 Best Performing Coins:**\n`;
        historicalFeedback.bestCoins.slice(0, 3).forEach(coin => {
          prompt += `- ${coin.symbol}: ${coin.winRate.toFixed(1)}% win rate, $${coin.totalPnl.toFixed(2)} total PnL (${coin.totalTrades} trades)\n`;
        });
        prompt += `\n`;
      }

      if (historicalFeedback.worstCoins.length > 0) {
        prompt += `**Top 3 Worst Performing Coins (AVOID):**\n`;
        historicalFeedback.worstCoins.slice(0, 3).forEach(coin => {
          prompt += `- ${coin.symbol}: ${coin.winRate.toFixed(1)}% win rate, $${coin.totalPnl.toFixed(2)} total PnL (${coin.totalTrades} trades)\n`;
        });
        prompt += `\n`;
      }

      // Recent Trades
      if (historicalFeedback.recentTrades.length > 0) {
        prompt += `**Last 5 Trades:**\n`;
        historicalFeedback.recentTrades.forEach((trade, i) => {
          const pnlSign = (trade.pnl || 0) >= 0 ? '+' : '';
          const duration = trade.holdingDuration 
            ? `${Math.floor(trade.holdingDuration / (1000 * 60))}min`
            : 'N/A';
          prompt += `${i + 1}. ${trade.symbol} ${trade.side}: ${pnlSign}$${trade.pnl?.toFixed(2)} (${trade.pnlPercent?.toFixed(2)}%) - ${duration} - ${trade.leverage}x leverage\n`;
        });
        prompt += `\n`;
      }
    } else {
      prompt += `No historical data yet. This is the first trading cycle.\n\n`;
    }

    // 2. Account Status
    prompt += `## 2. Current Account Status\n\n`;
    prompt += `- Total Equity: $${accountInfo.totalEquity.toFixed(2)} USDT\n`;
    prompt += `- Available Balance: $${accountInfo.availableBalance.toFixed(2)} USDT\n`;
    prompt += `- Total Margin Used: $${accountInfo.totalMarginUsed.toFixed(2)} (${(accountInfo.marginUsagePercent * 100).toFixed(1)}%)\n`;
    prompt += `- Total Unrealized PnL: $${accountInfo.totalUnrealizedPnl.toFixed(2)}\n`;
    prompt += `- Open Positions: ${accountInfo.totalPositions}\n`;
    if (accountInfo.dailyPnl !== undefined) {
      prompt += `- Daily PnL: $${accountInfo.dailyPnl.toFixed(2)}\n`;
    }
    prompt += `\n`;

    // 3. Existing Positions Analysis
    if (existingPositions.length > 0) {
      prompt += `## 3. Existing Positions - PRIORITY REVIEW\n\n`;
      prompt += `**ACTION REQUIRED:** Evaluate each position for hold vs. close decision.\n\n`;
      
      for (const pos of existingPositions) {
        const posMarketData = marketData.find(m => m.symbol === pos.symbol);
        
        prompt += `### ${pos.symbol} - ${pos.side.toUpperCase()} Position\n`;
        prompt += `**Performance:**\n`;
        prompt += `- Entry: $${pos.entryPrice.toFixed(2)} → Current: $${pos.currentPrice.toFixed(2)}\n`;
        prompt += `- Unrealized PnL: $${pos.unrealizedPnl.toFixed(2)} (${pos.unrealizedPnlPercent >= 0 ? '+' : ''}${pos.unrealizedPnlPercent.toFixed(2)}%)\n`;
        prompt += `- Position Size: ${pos.quantity} @ ${pos.leverage}x leverage\n`;
        prompt += `- Duration: ${pos.duration || 'N/A'}\n\n`;
        
        if (posMarketData) {
          prompt += `**Current Market Context:**\n`;
          
          // 3min analysis
          const rsi3m = posMarketData.indicators3m.rsi7;
          const macd3m = posMarketData.indicators3m.macd;
          const macdSignal3m = posMarketData.indicators3m.macdSignal;
          const rsiSignal3m = rsi3m < 30 ? '🔴 OVERSOLD' : rsi3m > 70 ? '🔴 OVERBOUGHT' : '⚪ NEUTRAL';
          const macdSignal3mCross = macd3m > macdSignal3m ? '🟢 BULLISH' : '🔴 BEARISH';
          
          prompt += `- 3min: RSI(7)=${rsi3m.toFixed(1)} ${rsiSignal3m} | MACD ${macdSignal3mCross}\n`;
          prompt += `  - MACD: ${macd3m.toFixed(4)} vs Signal: ${macdSignal3m.toFixed(4)} (Hist: ${posMarketData.indicators3m.macdHistogram.toFixed(4)})\n`;
          prompt += `  - Price vs EMA20: $${posMarketData.currentPrice.toFixed(2)} vs $${posMarketData.indicators3m.ema20.toFixed(2)}\n`;
          
          // 4h analysis
          const rsi4h = posMarketData.indicators4h.rsi14;
          const trend4h = posMarketData.indicators4h.trend || 'neutral';
          const rsiSignal4h = rsi4h < 30 ? '🔴 OVERSOLD' : rsi4h > 70 ? '🔴 OVERBOUGHT' : '⚪ NEUTRAL';
          const trendEmoji = trend4h === 'bullish' ? '🟢' : trend4h === 'bearish' ? '🔴' : '⚪';
          
          prompt += `- 4hour: RSI(14)=${rsi4h.toFixed(1)} ${rsiSignal4h} | Trend: ${trendEmoji} ${trend4h.toUpperCase()}\n`;
          prompt += `  - EMA20: $${posMarketData.indicators4h.ema20.toFixed(2)} | EMA50: $${posMarketData.indicators4h.ema50.toFixed(2)}\n`;
          prompt += `  - ATR: ${posMarketData.indicators4h.atr.toFixed(2)} (volatility reference)\n`;
          
          // Recent price action
          if (posMarketData.indicators3m.priceSequence && posMarketData.indicators3m.priceSequence.length >= 10) {
            const recent3m = posMarketData.indicators3m.priceSequence.slice(-10);
            const priceChange3m = ((recent3m[recent3m.length - 1] - recent3m[0]) / recent3m[0] * 100).toFixed(2);
            prompt += `- Recent 3min trend (10 candles): ${priceChange3m}% | [${recent3m.slice(-5).map(p => p.toFixed(2)).join(', ')}]\n`;
          }
          
          // Decision guidance
          prompt += `\n**Decision Guidance:**\n`;
          if (pos.side === 'LONG') {
            prompt += `- For LONG: Close if 3min MACD turns bearish + price breaks below EMA20 + 4h shows weakness\n`;
            prompt += `- Hold if: Trend remains bullish, RSI not overbought, price above EMAs\n`;
            if (pos.unrealizedPnlPercent < -2) {
              prompt += `- ⚠️ WARNING: Position down ${Math.abs(pos.unrealizedPnlPercent).toFixed(1)}% - consider stop-loss\n`;
            } else if (pos.unrealizedPnlPercent > 3) {
              prompt += `- 💰 PROFIT: Consider taking profit or trailing stop\n`;
            }
          } else {
            prompt += `- For SHORT: Close if 3min MACD turns bullish + price breaks above EMA20 + 4h shows strength\n`;
            prompt += `- Hold if: Trend remains bearish, RSI not oversold, price below EMAs\n`;
            if (pos.unrealizedPnlPercent < -2) {
              prompt += `- ⚠️ WARNING: Position down ${Math.abs(pos.unrealizedPnlPercent).toFixed(1)}% - consider stop-loss\n`;
            } else if (pos.unrealizedPnlPercent > 3) {
              prompt += `- 💰 PROFIT: Consider taking profit or trailing stop\n`;
            }
          }
        }
        
        prompt += `\n`;
      }
    } else {
      prompt += `## 3. Existing Positions\n\nNo open positions. Fresh opportunity to enter high-conviction trades.\n\n`;
    }

    // 4. New Opportunities
    prompt += `## 4. Market Opportunity Scan (${marketData.length} Candidates)\n\n`;
    prompt += `**Objective:** Identify assets with multi-timeframe confluence and strong technical setups.\n\n`;
    
    for (const data of marketData.slice(0, 15)) {
      // Calculate signal strengths
      const rsi3m = data.indicators3m.rsi7;
      const rsi4h = data.indicators4h.rsi14;
      const macd3m = data.indicators3m.macd;
      const macdSignal3m = data.indicators3m.macdSignal;
      const macdHist3m = data.indicators3m.macdHistogram;
      const trend4h = data.indicators4h.trend || 'neutral';
      const price = data.currentPrice;
      const ema20_3m = data.indicators3m.ema20;
      const ema20_4h = data.indicators4h.ema20;
      const ema50_4h = data.indicators4h.ema50;
      
      // Signal analysis
      const oversold3m = rsi3m < 30;
      const overbought3m = rsi3m > 70;
      const oversold4h = rsi4h < 30;
      const overbought4h = rsi4h > 70;
      const macdBullish = macd3m > macdSignal3m && macdHist3m > 0;
      const macdBearish = macd3m < macdSignal3m && macdHist3m < 0;
      const priceAboveEMA3m = price > ema20_3m;
      const priceAboveEMA4h = price > ema20_4h;
      const ema20Above50 = ema20_4h > ema50_4h;
      
      // Confluence score
      let signals: string[] = [];
      if (oversold3m || oversold4h) signals.push('OVERSOLD');
      if (overbought3m || overbought4h) signals.push('OVERBOUGHT');
      if (macdBullish) signals.push('MACD_BULL');
      if (macdBearish) signals.push('MACD_BEAR');
      if (trend4h === 'bullish') signals.push('4H_BULL');
      if (trend4h === 'bearish') signals.push('4H_BEAR');
      
      const signalStr = signals.length > 0 ? ` [${signals.join(' + ')}]` : '';
      
      prompt += `### ${data.symbol}${signalStr}\n`;
      prompt += `**Price & Performance:**\n`;
      prompt += `- Current: $${price.toFixed(2)} | 24h Change: ${data.priceChangePercent24h >= 0 ? '+' : ''}${data.priceChangePercent24h.toFixed(2)}%\n`;
      prompt += `- Volume 24h: $${(data.volume24h / 1000000).toFixed(2)}M`;
      if (data.openInterest) {
        prompt += ` | Open Interest: $${(data.openInterest / 1000000).toFixed(2)}M`;
      }
      if (data.fundingRate !== undefined) {
        const fundingPct = (data.fundingRate * 100).toFixed(4);
        const fundingSign = Math.abs(data.fundingRate) > 0.0001 ? (data.fundingRate > 0 ? ' (longs paying)' : ' (shorts paying)') : '';
        prompt += ` | Funding: ${fundingPct}%${fundingSign}`;
      }
      prompt += `\n\n`;
      
      // 3min timeframe
      prompt += `**3min Timeframe (Entry Timing):**\n`;
      prompt += `- RSI(7): ${rsi3m.toFixed(1)}`;
      if (oversold3m) prompt += ` 🔴 OVERSOLD`;
      else if (overbought3m) prompt += ` 🔴 OVERBOUGHT`;
      else if (rsi3m < 40) prompt += ` 🟢 Bullish zone`;
      else if (rsi3m > 60) prompt += ` 🔴 Bearish zone`;
      prompt += `\n`;
      
      prompt += `- MACD: ${macd3m.toFixed(4)} vs Signal: ${macdSignal3m.toFixed(4)}`;
      if (macdBullish) prompt += ` 🟢 BULLISH CROSS`;
      else if (macdBearish) prompt += ` 🔴 BEARISH CROSS`;
      prompt += `\n  Histogram: ${macdHist3m.toFixed(4)} (${macdHist3m > 0 ? 'expanding' : 'contracting'})\n`;
      
      prompt += `- Price vs EMA20: $${price.toFixed(2)} vs $${ema20_3m.toFixed(2)}`;
      if (priceAboveEMA3m) prompt += ` 🟢 Above (support)`;
      else prompt += ` 🔴 Below (resistance)`;
      prompt += `\n`;
      
      if (data.indicators3m.priceSequence && data.indicators3m.priceSequence.length >= 10) {
        const recent = data.indicators3m.priceSequence.slice(-10);
        const priceChange = ((recent[recent.length - 1] - recent[0]) / recent[0] * 100).toFixed(2);
        const trendDirection = parseFloat(priceChange) > 0 ? '🟢 UP' : parseFloat(priceChange) < 0 ? '🔴 DOWN' : '⚪ FLAT';
        prompt += `- 10-candle trend: ${trendDirection} ${priceChange}% | Recent: [${recent.slice(-5).map(p => p.toFixed(2)).join(', ')}]\n`;
      }
      prompt += `\n`;
      
      // 4hour timeframe
      prompt += `**4hour Timeframe (Trend Context):**\n`;
      prompt += `- RSI(14): ${rsi4h.toFixed(1)}`;
      if (oversold4h) prompt += ` 🔴 OVERSOLD`;
      else if (overbought4h) prompt += ` 🔴 OVERBOUGHT`;
      prompt += `\n`;
      
      const trendEmoji = trend4h === 'bullish' ? '🟢' : trend4h === 'bearish' ? '🔴' : '⚪';
      prompt += `- Trend: ${trendEmoji} ${trend4h.toUpperCase()}`;
      if (ema20Above50) prompt += ` (EMA20 > EMA50)`;
      else prompt += ` (EMA20 < EMA50)`;
      prompt += `\n`;
      
      prompt += `- EMA20: $${ema20_4h.toFixed(2)} | EMA50: $${ema50_4h.toFixed(2)}`;
      if (priceAboveEMA4h) prompt += ` | Price above both ✓`;
      else if (price < ema50_4h) prompt += ` | Price below both ✗`;
      else prompt += ` | Price between EMAs`;
      prompt += `\n`;
      
      prompt += `- ATR: ${data.indicators4h.atr.toFixed(2)} (use for stop-loss calculation)\n`;
      
      if (data.indicators4h.priceSequence && data.indicators4h.priceSequence.length >= 10) {
        const recent = data.indicators4h.priceSequence.slice(-10);
        const priceChange = ((recent[recent.length - 1] - recent[0]) / recent[0] * 100).toFixed(2);
        prompt += `- 10-candle trend: ${priceChange}% | Recent: [${recent.slice(-5).map(p => p.toFixed(2)).join(', ')}]\n`;
      }
      
      // Setup assessment
      prompt += `\n**Setup Quality Assessment:**\n`;
      let setupQuality = 0;
      const reasons: string[] = [];
      
      // Positive signals
      if ((oversold3m || oversold4h) && macdBullish && trend4h === 'bullish') {
        setupQuality += 3;
        reasons.push('Strong long setup: Oversold + MACD bullish + 4h uptrend');
      } else if ((overbought3m || overbought4h) && macdBearish && trend4h === 'bearish') {
        setupQuality += 3;
        reasons.push('Strong short setup: Overbought + MACD bearish + 4h downtrend');
      }
      
      if (priceAboveEMA3m && priceAboveEMA4h && ema20Above50) {
        setupQuality += 2;
        reasons.push('Price structure bullish: Above all EMAs');
      } else if (!priceAboveEMA3m && !priceAboveEMA4h && !ema20Above50) {
        setupQuality += 2;
        reasons.push('Price structure bearish: Below all EMAs');
      }
      
      if (Math.abs(data.priceChangePercent24h) > 5) {
        setupQuality -= 1;
        reasons.push('⚠️ Extreme 24h move - potential mean reversion risk');
      }
      
      if (setupQuality >= 3) {
        prompt += `✅ HIGH CONVICTION (Score: ${setupQuality}/5)\n`;
      } else if (setupQuality >= 1) {
        prompt += `⚡ MODERATE SETUP (Score: ${setupQuality}/5)\n`;
      } else {
        prompt += `⚪ WEAK/NO CLEAR SETUP (Score: ${setupQuality}/5)\n`;
      }
      
      reasons.forEach(r => prompt += `  - ${r}\n`);
      prompt += `\n`;
    }

    // 5. AI Decision Request
    prompt += `## 5. Your Expert Decision\n\n`;
    prompt += `Execute your decision-making protocol:\n\n`;
    prompt += `### STEP 1: Chain of Thought Analysis\n`;
    prompt += `Provide 4 structured paragraphs:\n\n`;
    prompt += `**1. Portfolio Assessment:**\n`;
    prompt += `- Review each open position: Is it in profit/loss? Should it be held or closed?\n`;
    prompt += `- Evaluate overall margin usage and risk exposure\n`;
    prompt += `- Assess account momentum (gaining or losing equity)\n\n`;
    prompt += `**2. Historical Context:**\n`;
    prompt += `- Current win rate interpretation (adjust strategy accordingly)\n`;
    prompt += `- Best/worst coins performance - what does this tell us?\n`;
    prompt += `- Recent trades pattern - any red flags or positive trends?\n`;
    prompt += `- Key lessons to apply from past mistakes/successes\n\n`;
    prompt += `**3. Market Opportunity Scan:**\n`;
    prompt += `- Identify assets with 3min + 4h timeframe alignment\n`;
    prompt += `- Which setups meet ALL entry criteria? (RSI, MACD, Volume, EMA)\n`;
    prompt += `- Calculate risk:reward for top 2-3 opportunities\n`;
    prompt += `- Note any concerns (high funding rates, extreme price moves, weak volume)\n\n`;
    prompt += `**4. Action Plan & Rationale:**\n`;
    prompt += `- Explain specific actions you will take (close X, open Y, wait)\n`;
    prompt += `- How each action aligns with risk management rules\n`;
    prompt += `- Expected probability of success for each trade\n`;
    prompt += `- Backup plan if trades go against you\n\n`;
    prompt += `### STEP 2: JSON Trading Decisions\n`;
    prompt += `Translate your analysis into precise trading decisions.\n\n`;
    prompt += `**Priority order:**\n`;
    prompt += `1. FIRST: Close any positions at significant risk or near targets\n`;
    prompt += `2. SECOND: Enter only the highest-conviction new positions (1-3 max)\n`;
    prompt += `3. DEFAULT: Wait if no clear high-probability setups exist\n\n`;
    prompt += `**Quality standards:**\n`;
    prompt += `- Each decision must reference specific indicators from the data\n`;
    prompt += `- Stop-loss and take-profit must have clear technical justification\n`;
    prompt += `- Confidence scores should reflect genuine setup quality (0.6-0.9)\n`;
    prompt += `- "reasoning" field should be concise but complete (10-20 words)\n\n`;
    prompt += `**Risk verification:**\n`;
    prompt += `- Verify risk:reward ratio ≥1:2.5 for all new positions\n`;
    prompt += `- Confirm stop-loss placement won't trigger on normal volatility\n`;
    prompt += `- Ensure leverage is appropriate for current win rate\n\n`;
    prompt += `Now provide your complete Chain of Thought analysis followed by your JSON decisions:`;

    return prompt;
  }

  private parseAIResponse(response: string): { decisions: TradingDecision[]; chainOfThought: string } {
    // Extract Chain of Thought (everything before JSON)
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    
    let chainOfThought = response;
    let decisions: TradingDecision[] = [];

    if (jsonMatch) {
      chainOfThought = response.substring(0, jsonMatch.index).trim();
      
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        decisions = Array.isArray(parsed) ? parsed : [parsed];
        
        // Validate and clean decisions
        decisions = decisions
          .filter(d => d.action && ['close_long', 'close_short', 'open_long', 'open_short', 'hold', 'wait'].includes(d.action))
          .map(d => ({
            action: d.action,
            symbol: d.symbol,
            quantity: d.quantity,
            leverage: d.leverage,
            stopLoss: d.stopLoss,
            takeProfit: d.takeProfit,
            reasoning: d.reasoning || '',
            confidence: d.confidence,
            riskRewardRatio: d.stopLoss && d.takeProfit && d.symbol
              ? this.calculateRiskReward(d.action, d.symbol, d.stopLoss, d.takeProfit)
              : undefined,
          }));
      } catch (error) {
        console.error(`Failed to parse AI JSON: ${error}`);
        decisions = [{ action: 'wait', reasoning: 'Failed to parse AI response' }];
      }
    } else {
      // No JSON found, default to wait
      decisions = [{ action: 'wait', reasoning: 'No clear trading signals' }];
    }

    return { decisions, chainOfThought };
  }

  private calculateRiskReward(
    action: string,
    symbol: string,
    stopLoss: number,
    takeProfit: number
  ): number {
    // This is a simplified calculation
    // In real implementation, you'd need entry price
    const risk = Math.abs(stopLoss - takeProfit) / 2;
    const reward = Math.abs(stopLoss - takeProfit) / 2;
    return reward / risk;
  }
}
