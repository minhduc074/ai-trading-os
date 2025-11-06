import OpenAI from 'openai';
import axios from 'axios';
import { 
  TradingDecision, 
  AccountInfo, 
  MarketData, 
  HistoricalFeedback,
  Position 
} from '../types';

interface AIConfig {
  provider: 'local' | 'deepseek' | 'qwen';
  apiKey?: string;
  baseURL?: string;
  model?: string;
  // Local AI server config
  localUrl?: string;
  localEmail?: string;
  localPassword?: string;
  localPlatform?: 'deepseek' | 'chatgpt';
}

/**
 * AI Decision Engine
 * Supports local AI server or cloud providers (DeepSeek/Qwen)
 * with Chain of Thought reasoning and historical feedback learning
 */
export class AIDecisionEngine {
  private client?: OpenAI;
  private provider: string;
  private model?: string;
  private sessionId?: string;
  
  // Local AI config
  private localUrl?: string;
  private localEmail?: string;
  private localPassword?: string;
  private localPlatform: 'deepseek' | 'chatgpt' = 'deepseek';
  private isLoggedIn: boolean = false;

  constructor(config: AIConfig) {
    this.provider = config.provider;
    
    if (config.provider === 'local') {
      // Local AI server setup
      this.localUrl = config.localUrl || 'http://localhost:5000';
      this.localEmail = config.localEmail;
      this.localPassword = config.localPassword;
      this.sessionId = `trading_ai_${Date.now()}`;
      this.localPlatform = config.localPlatform || 'deepseek';
      
      console.log(`AI Decision Engine initialized: Local server at ${this.localUrl} (${this.localPlatform})`);
    } else {
      // Cloud AI setup
      if (config.provider === 'deepseek') {
        this.model = config.model || 'deepseek-chat';
      } else {
        this.model = config.model || 'qwen-max';
      }

      // Initialize OpenAI-compatible client
      this.client = new OpenAI({
        apiKey: config.apiKey!,
        baseURL: config.baseURL,
      });

      console.log(`AI Decision Engine initialized: ${this.provider} (${this.model})`);
    }
  }

  /**
   * Initialize local AI session
   */
  private async initLocalSession(): Promise<void> {
    if (!this.localUrl || this.isLoggedIn) return;
    
    try {
      const payload: Record<string, any> = {
        platform: this.localPlatform,
        session_id: this.sessionId,
      };

      if (this.localEmail) {
        payload.email = this.localEmail;
      }

      if (this.localPassword) {
        payload.password = this.localPassword;
      }

      console.log(`[Local AI] Initializing session (${this.localPlatform}) at ${this.localUrl}`);

  const response = await axios.post(`${this.localUrl}/api/chat/login`, payload, { timeout: 20000 });
      
      if (response.status === 200) {
        this.isLoggedIn = true;
        console.log(`Local AI session initialized: ${response.data?.message || 'login/handshake successful'}`);
      }
    } catch (error: any) {
      console.warn(`Local AI login attempt: ${error.message}`);
      // Continue anyway - login may not be required
    }
  }

  /**
   * Close local AI session
   */
  async closeLocalSession(): Promise<void> {
    if (!this.localUrl || !this.sessionId) return;
    
    try {
      await axios.post(`${this.localUrl}/api/chat/close`, {
        platform: this.localPlatform,
        session_id: this.sessionId,
      }, { timeout: 3000 });
      console.log('Local AI session closed');
    } catch (error: any) {
      console.warn(`Failed to close local AI session: ${error.message}`);
    }
  }

  /**
   * Make trading decision using AI (local or cloud)
   */
  async makeDecision(
    accountInfo: AccountInfo,
    marketData: MarketData[],
    historicalFeedback: HistoricalFeedback,
    existingPositions: Position[]
  ): Promise<{ decisions: TradingDecision[]; chainOfThought: string; fullPrompt: string }> {
    const includeChainOfThought = this.provider !== 'local';
    const prompt = this.buildPrompt(
      accountInfo,
      marketData,
      historicalFeedback,
      existingPositions,
      includeChainOfThought
    );

    try {
      let aiResponse: string;
      
      if (this.provider === 'local') {
        // Use local AI server
        aiResponse = await this.callLocalAI(prompt);
      } else {
        // Use cloud AI (DeepSeek/Qwen)
        const response = await this.client!.chat.completions.create({
          model: this.model!,
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt(false),
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        });

        aiResponse = response.choices[0].message.content || '';
      }
      
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

  /**
   * Call local AI server
   */
  private async callLocalAI(message: string): Promise<string> {
    if (!this.localUrl) {
      throw new Error('Local AI URL not configured');
    }

    // Initialize session if needed (only once)
    await this.initLocalSession();

    // Prepare full message with system prompt
  const fullMessage = this.getSystemPrompt(false) + '\n\n' + message;
    
    console.log(`[Local AI] Sending message (${fullMessage.length} chars)...`);

    try {
      // Send message to local AI
      const response = await axios.post(`${this.localUrl}/api/chat/send`, {
        platform: this.localPlatform,
        message: fullMessage,
        session_id: this.sessionId,
      }, { 
        timeout: 90000 // 90s timeout for AI processing
      });

      if (response.status === 200 && response.data.response) {
        console.log(`[Local AI] Received response (${response.data.response.length} chars)`);
        return response.data.response;
      } else {
        throw new Error('Local AI did not return a valid response');
      }
    } catch (error: any) {
      // Handle 401 Unauthorized - re-login and retry
      if (error.response && error.response.status === 401) {
        console.warn('[Local AI] Session expired (401), re-authenticating...');
        this.isLoggedIn = false;
        await this.initLocalSession();
        
        // Retry the request
        const retryResponse = await axios.post(`${this.localUrl}/api/chat/send`, {
          platform: this.localPlatform,
          message: fullMessage,
          session_id: this.sessionId,
        }, { 
          timeout: 90000
        });

        if (retryResponse.status === 200 && retryResponse.data.response) {
          console.log(`[Local AI] Received response after re-auth (${retryResponse.data.response.length} chars)`);
          return retryResponse.data.response;
        } else {
          throw new Error('Local AI did not return a valid response after re-authentication');
        }
      }
      
      // Re-throw other errors
      throw error;
    }
  }

  private getSystemPrompt(includeChainOfThought: boolean): string {
    if (this.provider === 'local') {
      return [
        'You are an expert cryptocurrency trading AI.',
        'Respond with ONLY a JSON array of trading decisions using this shape:',
        '[',
        '  {',
        '    "action": "close_long" | "close_short" | "open_long" | "open_short" | "hold" | "wait",',
        '    "symbol": "BTCUSDT",',
        '    "quantity": 0.1,',
        '    "leverage": 10,',
        '    "stopLoss": 42000,',
        '    "takeProfit": 46000,',
        '    "reasoning": "Brief justification",',
        '    "confidence": 0.75',
        '  }',
        ']',
        'All numeric fields must be numbers.',
        'Return an empty array when no trade is recommended.',
      ].join('\n');
    }

    if (!includeChainOfThought) {
      return [
        'You are an expert cryptocurrency trading AI.',
        'Analyze the context and output ONLY a JSON array of trading decisions.',
        'Each decision must use this structure:',
        '[',
        '  {',
        '    "action": "close_long" | "close_short" | "open_long" | "open_short" | "hold" | "wait",',
        '    "symbol": "BTCUSDT",',
        '    "quantity": 0.1,',
        '    "leverage": 10,',
        '    "stopLoss": 42000,',
        '    "takeProfit": 46000,',
        '    "reasoning": "Brief justification",',
        '    "confidence": 0.75',
        '  }',
        ']',
        'Provide no text outside of the JSON array.',
        'Return [] if no trades are recommended.',
      ].join('\n');
    }

    return [
      'You are an expert cryptocurrency trading AI with advanced technical analysis capabilities.',
      'Goals: maximize profit, control risk, learn from historical performance.',
      '',
      'Critical rules:',
      '1. Provide Chain of Thought reasoning before the JSON decisions.',
      '2. Reference historical performance to avoid repeating mistakes.',
      '3. Evaluate complete price sequences, not just latest values.',
      '4. Enforce stop-loss to take-profit ratio ≥ 1:2.',
      '5. Avoid duplicate positions (same symbol + direction).',
      '6. Stay conservative when win rate < 50%; increase aggressiveness when > 65%.',
      '',
      'Analysis toolkit:',
      '- Multi-timeframe synthesis: 3min (short-term) + 4h (trend).',
      '- Technical indicators: RSI, MACD, EMA crossovers, ATR.',
      '- Volume and sentiment: spikes, accumulation, funding, open interest.',
      '- Historical pattern recognition: contrast recent wins vs losses.',
      '',
      'Output format:',
      '1. Provide detailed Chain of Thought reasoning (2-3 paragraphs).',
      '2. Follow with the JSON array of decisions formatted as:',
      '[',
      '  {',
      '    "action": "close_long" | "close_short" | "open_long" | "open_short" | "hold" | "wait",',
      '    "symbol": "BTCUSDT",',
      '    "quantity": 0.1,',
      '    "leverage": 10,',
      '    "stopLoss": 42000,',
      '    "takeProfit": 46000,',
      '    "reasoning": "Brief reason for this specific decision",',
      '    "confidence": 0.75',
      '  }',
      ']',
      'Return [{"action": "wait", "reasoning": "Why waiting is better"}] when no trades meet criteria.',
    ].join('\n');
  }

  private buildPrompt(
    accountInfo: AccountInfo,
    marketData: MarketData[],
    historicalFeedback: HistoricalFeedback,
    existingPositions: Position[],
    includeChainOfThought: boolean
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
      prompt += `## 3. Existing Positions Analysis\n\n`;
      
      for (const pos of existingPositions) {
        const posMarketData = marketData.find(m => m.symbol === pos.symbol);
        
        prompt += `### ${pos.symbol} - ${pos.side} Position\n`;
        prompt += `- Entry: $${pos.entryPrice.toFixed(2)} | Current: $${pos.currentPrice.toFixed(2)}\n`;
        prompt += `- Quantity: ${pos.quantity} | Leverage: ${pos.leverage}x\n`;
        prompt += `- Unrealized PnL: $${pos.unrealizedPnl.toFixed(2)} (${pos.unrealizedPnlPercent.toFixed(2)}%)\n`;
        prompt += `- Duration: ${pos.duration || 'N/A'}\n`;
        
        if (posMarketData) {
          prompt += `- Current Price: $${posMarketData.currentPrice.toFixed(2)}\n`;
          prompt += `- 3min RSI(7): ${posMarketData.indicators3m.rsi7.toFixed(2)}\n`;
          prompt += `- 3min MACD: ${posMarketData.indicators3m.macd.toFixed(4)} (Signal: ${posMarketData.indicators3m.macdSignal.toFixed(4)})\n`;
          prompt += `- 4hour RSI(14): ${posMarketData.indicators4h.rsi14.toFixed(2)}\n`;
          prompt += `- 4hour Trend: ${posMarketData.indicators4h.trend}\n`;
          prompt += `- 4hour EMA20: $${posMarketData.indicators4h.ema20.toFixed(2)} | EMA50: $${posMarketData.indicators4h.ema50.toFixed(2)}\n`;
          
          // Include price sequences
          if (posMarketData.indicators3m.priceSequence) {
            const recent3m = posMarketData.indicators3m.priceSequence.slice(-10);
            prompt += `- Recent 3min prices: [${recent3m.map(p => p.toFixed(2)).join(', ')}]\n`;
          }
          
          if (posMarketData.indicators4h.priceSequence) {
            const recent4h = posMarketData.indicators4h.priceSequence.slice(-5);
            prompt += `- Recent 4hour prices: [${recent4h.map(p => p.toFixed(2)).join(', ')}]\n`;
          }
        }
        
        prompt += `**Decision: Should this position be held or closed?**\n\n`;
      }
    } else {
      prompt += `## 3. Existing Positions\n\nNo open positions.\n\n`;
    }

    // 4. New Opportunities
    prompt += `## 4. Market Opportunities (${marketData.length} Candidates)\n\n`;
    
  const marketDataLimit = this.provider === 'local' ? marketData.length : 15;

  for (const data of marketData.slice(0, marketDataLimit)) { // Limit entries for remote AI to avoid token limits
      prompt += `### ${data.symbol}\n`;
      prompt += `- Current Price: $${data.currentPrice.toFixed(2)} (24h: ${data.priceChangePercent24h >= 0 ? '+' : ''}${data.priceChangePercent24h.toFixed(2)}%)\n`;
      prompt += `- Volume 24h: $${(data.volume24h / 1000000).toFixed(2)}M\n`;
      if (data.openInterest) {
        prompt += `- Open Interest: $${(data.openInterest / 1000000).toFixed(2)}M\n`;
      }
      if (data.fundingRate !== undefined) {
        prompt += `- Funding Rate: ${(data.fundingRate * 100).toFixed(4)}%\n`;
      }
      
      // 3min indicators
      prompt += `- **3min Analysis:**\n`;
      prompt += `  - RSI(7): ${data.indicators3m.rsi7.toFixed(2)}\n`;
      prompt += `  - MACD: ${data.indicators3m.macd.toFixed(4)} | Signal: ${data.indicators3m.macdSignal.toFixed(4)} | Hist: ${data.indicators3m.macdHistogram.toFixed(4)}\n`;
      prompt += `  - EMA20: $${data.indicators3m.ema20.toFixed(2)}\n`;
      
      if (data.indicators3m.priceSequence && data.indicators3m.priceSequence.length > 0) {
        const recent = data.indicators3m.priceSequence.slice(-10);
        prompt += `  - Recent prices: [${recent.map(p => p.toFixed(2)).join(', ')}]\n`;
      }
      
      // 4hour indicators
      prompt += `- **4hour Analysis:**\n`;
      prompt += `  - RSI(14): ${data.indicators4h.rsi14.toFixed(2)}\n`;
      prompt += `  - EMA20: $${data.indicators4h.ema20.toFixed(2)} | EMA50: $${data.indicators4h.ema50.toFixed(2)}\n`;
      prompt += `  - ATR: ${data.indicators4h.atr.toFixed(2)}\n`;
      prompt += `  - Trend: ${data.indicators4h.trend}\n`;
      
      if (data.indicators4h.priceSequence && data.indicators4h.priceSequence.length > 0) {
        const recent = data.indicators4h.priceSequence.slice(-10);
        prompt += `  - Recent prices: [${recent.map(p => p.toFixed(2)).join(', ')}]\n`;
      }
      
      prompt += `\n`;
    }

    // 5. AI Decision Request
    prompt += `## 5. Your Decision\n\n`;
    if (includeChainOfThought) {
      prompt += `Based on the above analysis:\n`;
      prompt += `1. First, provide your Chain of Thought reasoning (analyze patterns, risks, opportunities)\n`;
      prompt += `2. Then, provide actionable decisions in JSON format\n`;
      prompt += `3. Prioritize closing existing positions over opening new ones\n`;
      prompt += `4. Consider historical performance - avoid coins with poor track record\n`;
      prompt += `5. Ensure all decisions follow risk management rules\n`;
      prompt += `6. Be conservative if win rate is below 50%, aggressive if above 65%\n\n`;
      prompt += `Provide your complete analysis and decisions now:`;
    } else {
      prompt += `Based on the above analysis, respond with a JSON array of decisions only. Follow these rules:\n`;
      prompt += `- Omit all explanations outside of the JSON array\n`;
      prompt += `- Include reasoning inside each decision object\n`;
      prompt += `- Prioritize closing risky positions before opening new ones\n`;
      prompt += `- Ensure each decision respects risk management constraints\n`;
      prompt += `Return [] if no trades should be taken.`;
    }

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

    if (!chainOfThought && this.provider === 'local') {
      chainOfThought = 'Local AI configured for JSON-only responses.';
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
