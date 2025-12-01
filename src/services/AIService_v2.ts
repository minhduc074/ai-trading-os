import OpenAI from 'openai';
import { TradingDecision, AccountInfo, MarketData, HistoricalFeedback, Position } from '../types';

interface AIConfig {
  provider: 'deepseek' | 'qwen' | 'openrouter';
  apiKey: string;
  baseURL?: string;
  model?: string;
}

export class AIDecisionEngine {
  private client: OpenAI;
  private provider: string;
  private model: string;

  constructor(config: AIConfig) {
    this.provider = config.provider;
    if (config.provider === 'deepseek') {
      this.model = config.model || 'deepseek-chat';
    } else if (config.provider === 'qwen') {
      this.model = config.model || 'qwen-max';
    } else {
      this.model = config.model || 'x-ai/grok-4.1-fast:free';
    }
    this.client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
    console.log(`AI Decision Engine initialized: ${this.provider} (${this.model})`);
  }

  async makeDecision(
    accountInfo: AccountInfo,
    marketData: MarketData[],
    historicalFeedback: HistoricalFeedback,
    existingPositions: Position[]
  ): Promise<{ decisions: TradingDecision[]; chainOfThought: string; fullPrompt: string }> {
    const coinSymbols = marketData.map(d => d.symbol);
    const prompt = this.buildPrompt(accountInfo, marketData, historicalFeedback, existingPositions);
    try {
      const callOptions: any = {
        model: this.model,
        messages: [
          { role: 'system', content: this.getSystemPrompt() },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      };
      if (this.provider === 'openrouter') callOptions.reasoning = { enabled: true };
      const response = await this.client.chat.completions.create(callOptions);
      const aiResponse = response.choices?.[0]?.message?.content || '';
      const { decisions, chainOfThought } = this.parseAIResponse(aiResponse, marketData);
      return { decisions, chainOfThought, fullPrompt: prompt };
    } catch (error: any) {
      console.error(`AI decision failed: ${error?.message || error}`);
      return {
        decisions: [{ action: 'wait', reasoning: `AI error: ${error?.message || error}` }],
        chainOfThought: `Error occurred: ${error?.message || error}`,
        fullPrompt: prompt,
      };
    }
  }

  private getSystemPrompt(): string {
    return [
      'Role: You are a conservative quantitative trading analyst specializing in cryptocurrency markets. Your PRIMARY goal is CAPITAL PRESERVATION. You only take trades with exceptional setups.',
      '',
      'CRITICAL MINDSET: It is better to miss 10 good trades than to take 1 bad trade. Losing money is UNACCEPTABLE. When in doubt, DO NOT TRADE.',
      '',
      'Objective: Analyze market data and execute ONLY high-probability trades. Actions: OPEN LONG, OPEN SHORT, CLOSE LONG, CLOSE SHORT, or NO TRADE (default).',
      '',
      '⚠️ STRICT RISK MANAGEMENT (NEVER VIOLATE):',
      '- Confidence MUST be >= 85% (not 75%)',
      '- Risk-Reward ratio MUST be >= 3:1 (not 2:1)',
      '- Maximum leverage: 5x for altcoins, 10x for BTC/ETH',
      '- Maximum risk per trade: 0.5% of account equity',
      '- NEVER trade against the 4H trend direction',
      '- NEVER trade in sideways/choppy markets (RSI 40-60 on 4H)',
      '- If win rate < 50%, reduce position sizes by 50%',
      '- If account is down > 5% today, STOP TRADING (return [])',
      '',
      'TREND RULES (MANDATORY):',
      '- LONG only when: Price > EMA20_4h > EMA50_4h (uptrend)',
      '- SHORT only when: Price < EMA20_4h < EMA50_4h (downtrend)',
      '- NO TRADE when EMAs are flat or crossing (consolidation)',
      '',
      'ENTRY CONFIRMATION REQUIRED (ALL must be true):',
      '- 4H trend aligned with trade direction',
      '- 3m pullback to support/resistance level',
      '- RSI not overbought (>70) for longs or oversold (<30) for shorts',
      '- MACD histogram confirming momentum direction',
      '- Clear stop loss level with < 1% distance from entry',
      '',
      'POSITION MANAGEMENT:',
      '- Close winning trades at 2:1 profit minimum, let winners run to 3:1',
      '- Close losing trades IMMEDIATELY if stop loss is hit',
      '- If position is -1% or worse, CLOSE IT (cut losses fast)',
      '- If position is +2% or better, consider partial profit taking',
      '',
      'DEFAULT ACTION: Return empty array [] unless setup is PERFECT. Missing trades is fine, losing money is not.',
    ].join('\n');
  }

  private buildPrompt(
    accountInfo: AccountInfo,
    marketData: MarketData[],
    historicalFeedback: HistoricalFeedback,
    existingPositions: Position[]
  ): string {
    const lines: string[] = [];
    lines.push('# Trading Decision - CAPITAL PRESERVATION FIRST');
    lines.push('');
    lines.push('⚠️ REMINDER: It is better to miss trades than to lose money. Default action is NO TRADE.');
    lines.push('');
    const winRateWarning = historicalFeedback.winRate < 50 ? ' ⚠️ LOW WIN RATE - BE EXTRA CAUTIOUS' : '';
    lines.push(`Context: Win Rate ${historicalFeedback.winRate.toFixed(1)}%${winRateWarning} | Equity $${accountInfo.totalEquity.toFixed(2)} | Open Positions ${accountInfo.totalPositions}`);
    lines.push('');
    if (historicalFeedback.winRate < 40) {
      lines.push('🚨 CRITICAL: Win rate below 40%. Only take PERFECT setups with 90%+ confidence.');
      lines.push('');
    }
    lines.push(`Analyzing ${marketData.length} candidates - reject any that don\'t meet ALL criteria.`);
    lines.push('');

    if (existingPositions.length > 0) {
      lines.push('📊 EXISTING POSITIONS (Review for exit signals):');
      for (const pos of existingPositions) {
        const pnl = pos.unrealizedPnlPercent;
        let action = '';
        if (pnl <= -1) action = ' 🚨 CONSIDER CLOSING - Loss exceeds 1%';
        else if (pnl <= -0.5) action = ' ⚠️ WATCH CLOSELY - Approaching stop';
        else if (pnl >= 3) action = ' ✅ TAKE PROFIT - 3:1 reached';
        else if (pnl >= 2) action = ' 💰 Consider partial profit';
        lines.push(`- ${pos.symbol} ${pos.side}: Entry $${pos.entryPrice.toFixed(2)}, Current $${pos.currentPrice.toFixed(2)}, P&L ${pnl.toFixed(2)}%, Lev ${pos.leverage}x${action}`);
      }
      lines.push('');
    }
    for (const data of marketData) {
      lines.push(`Symbol: ${data.symbol}`);
      lines.push('Timeframe: 3-minute (entry) / 4-hour (trend)');
      lines.push(`Current Price: $${data.currentPrice.toFixed(2)}`);
      if (data.indicators3m.priceSequence && data.indicators3m.priceSequence.length > 0) {
        const seq = data.indicators3m.priceSequence.slice(-30);
        lines.push(`Data (3m closes, last ${seq.length}): [${seq.map(p => p.toFixed(2)).join(', ')}]`);
      }
      if (data.indicators4h.priceSequence && data.indicators4h.priceSequence.length > 0) {
        const seq4 = data.indicators4h.priceSequence.slice(-30);
        lines.push(`Data (4h closes, last ${seq4.length}): [${seq4.map(p => p.toFixed(2)).join(', ')}]`);
      }
      lines.push('Indicator Values:');
      lines.push(`- EMA(20) 3m: $${data.indicators3m.ema20.toFixed(2)} | EMA(20) 4h: $${data.indicators4h.ema20.toFixed(2)} | EMA(50) 4h: $${data.indicators4h.ema50.toFixed(2)}`);
      lines.push(`- RSI(3m): ${data.indicators3m.rsi7.toFixed(1)} | RSI(4h): ${data.indicators4h.rsi14.toFixed(1)}`);
      lines.push(`- MACD(3m): Line ${data.indicators3m.macd.toFixed(4)}, Signal ${data.indicators3m.macdSignal.toFixed(4)}, Hist ${data.indicators3m.macdHistogram.toFixed(4)}`);
      lines.push('- VWAP: N/A');
      if (data.indicators4h.priceSequence && data.indicators4h.priceSequence.length > 0) {
        const seq4 = data.indicators4h.priceSequence;
        lines.push(`- Key Support: $${Math.min(...seq4).toFixed(2)} | Key Resistance: $${Math.max(...seq4).toFixed(2)}`);
      } else {
        lines.push('- Key Support: N/A | Key Resistance: N/A');
      }
      lines.push(`- 24h Change: ${data.priceChangePercent24h >= 0 ? '+' : ''}${data.priceChangePercent24h.toFixed(2)}% | Volume 24h: $${(data.volume24h / 1000000).toFixed(2)}M`);
      lines.push('');
    }
    lines.push('OUTPUT INSTRUCTIONS:');
    lines.push('');
    lines.push('STEP 1 - TREND CHECK (If ANY fail, return []):');
    lines.push('- Is 4H trend clear? (Price vs EMA20 vs EMA50 aligned)');
    lines.push('- Is RSI_4H NOT in neutral zone (40-60)?');
    lines.push('- Is there clear momentum (MACD histogram growing)?');
    lines.push('');
    lines.push('STEP 2 - ENTRY VALIDATION (ALL must pass):');
    lines.push('- Is there a pullback to a key level on 3m?');
    lines.push('- Is risk-reward >= 3:1?');
    lines.push('- Is stop loss < 1% from entry?');
    lines.push('- Is confidence >= 85%?');
    lines.push('');
    lines.push('STEP 3 - POSITION REVIEW:');
    lines.push('- Any position with P&L <= -1%? → CLOSE IT');
    lines.push('- Any position with P&L >= +3%? → TAKE PROFIT');
    lines.push('');
    lines.push('FINAL JSON DECISION: Return [] unless setup is PERFECT.');
    lines.push('');
    lines.push('JSON Format:');
    lines.push('```json');
    lines.push('[');
    lines.push('  {');
    lines.push('    "action": "open_long | open_short | close_long | close_short",');
    lines.push('    "symbol": "BTCUSDT",');
    lines.push('    "position_size_usd": 500,');
    lines.push('    "leverage": 5,');
    lines.push('    "profit_target": 61500,');
    lines.push('    "stop_loss": 60800,');
    lines.push('    "invalidation_condition": "Price closes below EMA20_3m",');
    lines.push('    "confidence": 88,');
    lines.push('    "risk_usd": 25,');
    lines.push('    "reasoning": "4H uptrend confirmed. 3m pullback to EMA20 support. RSI bouncing from 45. 3.5:1 R:R."');
    lines.push('  }');
    lines.push(']');
    lines.push('```');
    lines.push('');
    lines.push('STRICT RULES:');
    lines.push('- Confidence MUST be >= 85 (not 75)');
    lines.push('- Leverage: MAX 5x altcoins, MAX 10x BTC/ETH');
    lines.push('- Risk: MAX 0.5% of equity per trade');
    lines.push('- Risk-Reward: MINIMUM 3:1');
    lines.push('- If unsure, return [] - missing trades is OK, losing money is NOT');
    lines.push('');
    lines.push('Provide brief analysis then JSON. Default to [] if ANY doubt exists.');
    return lines.join('\n');
  }

  private parseAIResponse(response: string, marketData: MarketData[]): { decisions: TradingDecision[]; chainOfThought: string } {
    // Helper: Extract JSON candidate and its index from response. Handles fenced codeblocks and nested brackets.
    
    console.debug('AI Response:', response);
    
    const extractJSONCandidate = (text: string): { candidate: string; index: number } | null => {
      // 1) If there is a fenced code block, capture full content between the first pair of ``` fences
      const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenced && fenced[1]) return { candidate: fenced[1].trim(), index: fenced.index ?? text.indexOf(fenced[0]) };

      // 2) Bracket-aware matching for the first object/array in the text
      const openers = ['[', '{'];
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (!openers.includes(ch)) continue;
        const openCh = ch;
        const closeCh = openCh === '[' ? ']' : '}';
        let depth = 0;
        for (let j = i; j < text.length; j++) {
          const c = text[j];
          if (c === openCh) depth++;
          else if (c === closeCh) depth--;
          if (depth === 0) {
            const cand = text.slice(i, j + 1);
            return { candidate: cand.trim(), index: i };
          }
        }
      }
      return null;
    };

    const found = extractJSONCandidate(response);
    let chainOfThought = response;
    if (!found) return { decisions: [], chainOfThought };
    const candidateRaw = found.candidate;
    chainOfThought = response.substring(0, found.index).trim();
    try {
      let candidate = String(candidateRaw).trim();
  // Sanitize common issues from AI outputs: trailing commas before object/array end, stray tabs, CRLF
    // Sanitize common issues from AI outputs: trailing commas before object/array end
  candidate = candidate.replace(/,\s*\]/g, ']');
  candidate = candidate.replace(/,\s*\}/g, '}');
  candidate = candidate.replace(/\t/g, ' ');
  candidate = candidate.replace(/\r/g, '');
    const parsed = JSON.parse(candidate);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      if (arr.length === 0) return { decisions: [], chainOfThought };
      
      const decisions: TradingDecision[] = [];
      for (const d of arr) {
        if (!d || !d.action) continue;
        const action = String(d.action).toLowerCase();
        if (action === 'no_trade') continue;
        
        if (action === 'open_long' || action === 'open_short' || action === 'close_long' || action === 'close_short') {
          const confidence = typeof d.confidence === 'number' ? d.confidence : (parseFloat(d.confidence) || 0);
          // Require 85%+ confidence for new positions, 70%+ for closing (to protect capital)
          const isCloseAction = action === 'close_long' || action === 'close_short';
          const minConfidence = isCloseAction ? 70 : 85;
          if (confidence < minConfidence) continue;
          const symbol = d.symbol;
          const market = marketData.find(m => m.symbol === symbol);
          const entryPrice = market?.currentPrice;
          const position_size_usd = Number(d.position_size_usd) || 0;
          const stop_loss = d.stop_loss !== undefined ? Number(d.stop_loss) : undefined;
          let risk_usd = d.risk_usd !== undefined ? Number(d.risk_usd) : undefined;
          if (!risk_usd && entryPrice && stop_loss) {
            const priceDiff = Math.abs(entryPrice - stop_loss);
            risk_usd = Math.round(position_size_usd * (priceDiff / entryPrice));
          }
          const leverage = d.leverage !== undefined ? Number(d.leverage) : 1;
          const mapped: TradingDecision = {
            action: action as any,
            symbol: d.symbol,
            position_size_usd: position_size_usd || undefined,
            leverage: leverage,
            profit_target: d.profit_target !== undefined ? Number(d.profit_target) : undefined,
            stop_loss: stop_loss !== undefined ? Number(stop_loss) : undefined,
            invalidation_condition: d.invalidation_condition || undefined,
            confidence: confidence,
            risk_usd: risk_usd !== undefined ? Number(risk_usd) : undefined,
            reasoning: d.reasoning || '',
          };
          decisions.push(mapped);
        } else if (['wait', 'hold', 'close_long', 'close_short'].includes(action)) {
          const mapped: TradingDecision = {
            action: action as any,
            symbol: d.symbol,
            position_size_usd: d.position_size_usd || undefined,
            leverage: d.leverage !== undefined ? Number(d.leverage) : undefined,
            profit_target: d.profit_target || undefined,
            stop_loss: d.stop_loss || undefined,
            invalidation_condition: d.invalidation_condition || undefined,
            confidence: d.confidence || undefined,
            risk_usd: d.risk_usd || undefined,
            reasoning: d.reasoning || '',
          };
          decisions.push(mapped);
        }
      }
      
      return { decisions, chainOfThought };
    } catch (e) {
      console.error('Failed to parse AI JSON:', e);
      console.error('JSON candidate that failed parse:', found ? (found.candidate) : 'N/A');
      return { decisions: [], chainOfThought };
    }
  }
}
