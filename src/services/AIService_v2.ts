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
    console.log(`[AI Decision] Sending ${coinSymbols.length} coins to AI: ${coinSymbols.join(', ')}`);
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
      'Role: You are a senior quantitative trading analyst specializing in cryptocurrency markets. Your expertise is in identifying high-probability long and short setups using multi-timeframe analysis, technical indicators, and market structure.',
      '',
      'Objective: Analyze the provided market data and execute trading decisions. You can OPEN LONG, OPEN SHORT, CLOSE LONG, CLOSE SHORT, or NO TRADE. If a position already exists and you want to adjust leverage or size, first CLOSE the existing position, then OPEN a new one with the desired leverage.',
      '',
      'Risk Management Guidelines:',
      '- Only trade when confidence > 75 and risk-reward ratio > 2:1',
      '- Use conservative leverage (1-25x) for new positions',
      '- Never risk more than 1% of account equity per trade',
      '- Require strong multi-timeframe confirmation before entry',
      '',
      'Leverage Guidelines: Start with low leverage (1-3x) for new positions. If reopening a position that was recently closed due to stop-loss or take-profit, increase leverage by 1-2x (up to max 5x for altcoins, 3x for majors).',
      '',
      'Base your analysis only on the Input Data provided in the user prompt. Do not call external sources. If no high-confidence setup exists, return an empty list [].',
    ].join('\n');
  }

  private buildPrompt(
    accountInfo: AccountInfo,
    marketData: MarketData[],
    historicalFeedback: HistoricalFeedback,
    existingPositions: Position[]
  ): string {
    const lines: string[] = [];
    lines.push('# Trading Decision - Conservative Risk Management Protocol');
    lines.push('');
    lines.push(`Context: Win Rate ${historicalFeedback.winRate.toFixed(1)}% | Equity $${accountInfo.totalEquity.toFixed(2)} | Positions ${accountInfo.totalPositions}`);
    lines.push('');
    lines.push(`Candidates: ${marketData.length}`);
    lines.push('');
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
    lines.push('Chain of Thought Analysis:');
    lines.push('- Market Structure: Identify clear trend direction (bullish/bearish/sideways) with multi-timeframe confirmation.');
    lines.push('- Key Levels: Identify critical support/resistance levels and current price position relative to them.');
    lines.push('- Indicator Analysis: Assess EMA alignment, RSI levels, and MACD momentum with clear bullish/bearish signals.');
    lines.push('- Risk-Reward: Calculate minimum 2:1 reward-to-risk ratio before considering entry.');
    lines.push('- Trade Thesis: Only propose trades with strong confluence of factors and clear invalidation points.');
    lines.push('- Risk Assessment: Define strict stop loss levels and maximum acceptable risk per trade.');
    lines.push('');
    lines.push('FINAL JSON DECISION: Provide decisions as an array. Can include close_long, close_short, open_long, open_short, or no_trade. If no action needed, output [].');
    lines.push('');
    lines.push('Required JSON Format:');
    lines.push('```json');
    lines.push('[');
    lines.push('  {');
    lines.push('    "action": "open_long | open_short | no_trade",');
    lines.push('    "symbol": "BTCUSDT",');
    lines.push('    "position_size_usd": 1000,');
    lines.push('    "leverage": 3,');
    lines.push('    "profit_target": 61500,');
    lines.push('    "stop_loss": 60800,');
    lines.push('    "invalidation_condition": "Price breaks and closes below EMA20_3m at $61000.",');
    lines.push('    "confidence": 80,');
    lines.push('    "risk_usd": 30,');
    lines.push('    "reasoning": "Strong bullish EMA alignment with MACD momentum. 2:1 risk-reward ratio."');
    lines.push('  }');
    lines.push(']');
    lines.push('```');
    lines.push('');
    lines.push('Notes:');
    lines.push('- Confidence must be > 75 to propose a trade. Only trade high-probability setups with clear risk management.');
    lines.push('- Leverage: Use conservative 3x maximum for new positions.');
    lines.push('- Risk Management: Never risk more than 1% of account equity per trade.');
    lines.push('- Provide a concise Chain of Thought and then the JSON decisions in a markdown code block.');
    lines.push('');
    lines.push('Now provide your complete Chain of Thought analysis followed by your JSON decision in a markdown code block.');
    return lines.join('\n');
  }

  private parseAIResponse(response: string, marketData: MarketData[]): { decisions: TradingDecision[]; chainOfThought: string } {
    // Helper: Extract JSON candidate and its index from response. Handles fenced codeblocks and nested brackets.
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
        
        if (action === 'open_long' || action === 'open_short') {
          const confidence = typeof d.confidence === 'number' ? d.confidence : (parseFloat(d.confidence) || 0);
          if (confidence < 76) continue;
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
