// AI Service - Integration with OpenRouter or RapidAPI

import type { AIDecision, MarketData, Position, PerformanceMetrics, AccountStatus } from '@/lib/types';

export class AIService {
  private apiKey: string;
  private provider: string;
  private baseURL: string;
  private model: string;

  constructor() {
    this.provider = process.env.AI_PROVIDER || 'openrouter';
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.baseURL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    this.model = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
  }

  async getTradeDecision(
    accountStatus: AccountStatus,
    positions: Position[],
    marketData: MarketData[],
    performanceMetrics: PerformanceMetrics
  ): Promise<AIDecision> {
    const prompt = this.buildPrompt(accountStatus, positions, marketData, performanceMetrics);

    try {
      const response = await this.callAI(prompt);
      return this.parseDecision(response);
    } catch (error) {
      console.error('AI Service Error:', error);
      return {
        action: 'WAIT',
        reasoning: 'Error in AI decision making',
        confidence: 0,
        chainOfThought: '',
      };
    }
  }

  private buildPrompt(
    accountStatus: AccountStatus,
    positions: Position[],
    marketData: MarketData[],
    performanceMetrics: PerformanceMetrics
  ): string {
    return `You are an expert crypto futures trading AI. Analyze the following market data and account status, then provide a trading decision.

## Account Status
- Total Balance: $${accountStatus.totalBalance.toFixed(2)}
- Available Balance: $${accountStatus.availableBalance.toFixed(2)}
- Margin Usage: ${accountStatus.marginUsagePercent.toFixed(2)}%
- Unrealized PnL: $${accountStatus.unrealizedPnL.toFixed(2)}
- Daily PnL: $${accountStatus.dailyPnL.toFixed(2)}

## Current Positions (${positions.length})
${positions.map((p) => `- ${p.symbol} ${p.side}: ${p.quantity} @ $${p.entryPrice.toFixed(2)} (PnL: ${p.unrealizedPnLPercent.toFixed(2)}%)`).join('\n')}

## Recent Performance
- Win Rate: ${(performanceMetrics.winRate * 100).toFixed(2)}%
- Profit Factor: ${performanceMetrics.profitFactor.toFixed(2)}
- Average Profit: $${performanceMetrics.averageProfitUSDT.toFixed(2)}
- Sharpe Ratio: ${performanceMetrics.sharpeRatio.toFixed(2)}
- Max Drawdown: ${performanceMetrics.maxDrawdown.toFixed(2)}%

## Top Opportunities
${marketData
  .sort((a, b) => b.liquidityUSD - a.liquidityUSD)
  .slice(0, 5)
  .map((m) => `- ${m.symbol}: Price $${m.currentPrice.toFixed(2)}, RSI14: ${m.rsi14.toFixed(2)}, Volume: $${m.volume24h.toFixed(0)}`)
  .join('\n')}

## Decision Criteria
1. Only open new positions if total margin usage stays below 90%
2. Maintain 1:2 minimum risk-reward ratio (SL to TP)
3. Close positions with high unrealized gains (>10%) to lock profit
4. Avoid repeating bad trades from recent losing patterns
5. Prioritize closing over opening when margin is high

Provide a JSON response with:
{
  "action": "HOLD|CLOSE_LONG|CLOSE_SHORT|OPEN_LONG|OPEN_SHORT|WAIT",
  "symbol": "BTCUSDT" (if applicable),
  "quantity": 0.01 (if applicable),
  "leverage": 5 (if applicable),
  "stopLoss": 45000 (if applicable),
  "takeProfit": 55000 (if applicable),
  "reasoning": "Detailed explanation",
  "confidence": 0.85
}`;
  }

  private async callAI(prompt: string): Promise<string> {
    if (this.provider === 'openrouter') {
      try {
        return await this.callOpenRouter(prompt);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Check if error is rate limit (429) or token-related
        if (errorMessage.includes('429') || errorMessage.includes('rate limit') || 
            errorMessage.includes('quota') || errorMessage.includes('token')) {
          console.warn(`[${new Date().toISOString()}] OpenRouter failed (${errorMessage}). Switching to RapidAPI...`);
          this.model = 'RapidAPI ChatGPT'; // Update model name for display
          return await this.callRapidAPI(prompt);
        }
        
        // Re-throw if it's a different error
        throw error;
      }
    } else {
      return await this.callRapidAPI(prompt);
    }
  }

  private async callOpenRouter(prompt: string): Promise<string> {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert crypto trading AI that provides JSON-formatted decisions.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
    }

    const data = await response.json() as any;
    return data.choices[0].message.content;
  }

  private async callRapidAPI(prompt: string): Promise<string> {
    const response = await fetch('https://chatgpt-api8.p.rapidapi.com/', {
      method: 'POST',
      headers: {
        'x-rapidapi-key': process.env.RAPIDAPI_KEY || '',
        'x-rapidapi-host': 'chatgpt-api8.p.rapidapi.com',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          content: 'You are an expert crypto trading AI that provides JSON-formatted decisions.',
          role: 'system',
        },
        {
          content: prompt,
          role: 'user',
        },
      ]),
    });

    if (!response.ok) {
      throw new Error(`RapidAPI error: ${response.statusText}`);
    }

    const data = await response.text();
    return data;
  }

  private parseDecision(response: string): AIDecision {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        action: parsed.action || 'HOLD',
        symbol: parsed.symbol,
        quantity: parsed.quantity,
        leverage: parsed.leverage,
        stopLoss: parsed.stopLoss,
        takeProfit: parsed.takeProfit,
        reasoning: parsed.reasoning || '',
        confidence: parsed.confidence || 0.5,
        chainOfThought: response,
        aiAgent: this.model,
      };
    } catch (error) {
      console.error('Parse error:', error);
      return {
        action: 'WAIT',
        reasoning: 'Failed to parse AI response',
        confidence: 0,
        chainOfThought: response,
        aiAgent: this.model,
      };
    }
  }
}

export const aiService = new AIService();
