// AI Service - Integration with OpenRouter or RapidAPI

import type { AIDecision, MarketData, Position, PerformanceMetrics, AccountStatus } from '@/lib/types';

export class AIService {
  private providers: Array<{
    name: string;
    apiKey: string;
    baseURL: string;
    model: string;
  }>;
  private currentProviderIndex: number = 0;

  constructor() {
    // Initialize provider queue: Claude -> Gemini Pro -> OpenRouter -> RapidAPI -> Gemini Flash
    this.providers = [
      {
        name: 'CLIProxyAPI (Claude)',
        apiKey: process.env.CLI_PROXYAPI_API_KEY || '',
        baseURL: process.env.CLI_PROXYAPI_BASE_URL || 'http://localhost:8317/v1',
        model: process.env.CLI_PROXYAPI_MODEL || 'gemini-claude-sonnet-4-5',
      },
      {
        name: 'CLIProxyAPI (Gemini Pro)',
        apiKey: process.env.CLI_PROXYAPI_API_KEY || '',
        baseURL: process.env.CLI_PROXYAPI_BASE_URL || 'http://localhost:8317/v1',
        model: process.env.CLI_PROXYAPI_GEMINI_PRO_MODEL || 'gemini-2.5-pro',
      },
      {
        name: 'OpenRouter',
        apiKey: process.env.OPENROUTER_API_KEY || '',
        baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
        model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
      },
      {
        name: 'RapidAPI',
        apiKey: process.env.RAPIDAPI_KEY || '',
        baseURL: 'https://chatgpt-api8.p.rapidapi.com/',
        model: 'ChatGPT',
      },
      {
        name: 'CLIProxyAPI (Gemini Flash)',
        apiKey: process.env.CLI_PROXYAPI_API_KEY || '',
        baseURL: process.env.CLI_PROXYAPI_BASE_URL || 'http://localhost:8317/v1',
        model: process.env.CLI_PROXYAPI_GEMINI_FLASH_MODEL || 'gemini-2.5-flash',
      },
    ].filter(p => p.apiKey); // Only include providers with API keys

    console.log(`[AIService] Initialized with ${this.providers.length} providers:`,
      this.providers.map(p => p.name).join(' -> '));
  }

  async getTradeDecision(
    accountStatus: AccountStatus,
    positions: Position[],
    marketData: MarketData[],
    performanceMetrics: PerformanceMetrics
  ): Promise<AIDecision> {
    const prompt = this.buildPrompt(accountStatus, positions, marketData, performanceMetrics);

    console.log(`\n[${new Date().toISOString()}] ===== AI REQUEST =====`);
    console.log(`Prompt length: ${prompt.length} characters`);
    console.log(`Prompt preview (first 500 chars):\n${prompt.substring(0, 500)}...`);

    // Try each provider in queue until one succeeds
    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];
      console.log(`\n[${new Date().toISOString()}] Trying provider ${i + 1}/${this.providers.length}: ${provider.name}`);
      console.log(`Model: ${provider.model}`);

      try {
        const response = await this.callAI(prompt, provider);

        console.log(`\n[${new Date().toISOString()}] ===== AI RESPONSE =====`);
        console.log(`Provider: ${provider.name} ✓`);
        console.log(`Response length: ${response.length} characters`);
        console.log(`Full response:\n${response}`);
        console.log(`===== END AI RESPONSE =====\n`);

        const decision = this.parseDecision(response, provider.model);
        return decision;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[${provider.name}] Failed: ${errorMsg}`);

        // If this is the last provider, return error decision
        if (i === this.providers.length - 1) {
          console.error('❌ All providers failed!');
          return {
            action: 'WAIT',
            reasoning: `All AI providers failed. Last error: ${errorMsg}`,
            confidence: 0,
            chainOfThought: '',
            aiAgent: 'None (all failed)',
          };
        }

        // Otherwise, continue to next provider
        console.log(`⏭️  Switching to next provider...`);
      }
    }

    // Fallback (should never reach here)
    return {
      action: 'WAIT',
      reasoning: 'No providers available',
      confidence: 0,
      chainOfThought: '',
      aiAgent: 'None',
    };
  }

  private buildPrompt(
    accountStatus: AccountStatus,
    positions: Position[],
    marketData: MarketData[],
    performanceMetrics: PerformanceMetrics
  ): string {
    // Sort by volume and liquidity for best opportunities
    const sortedData = [...marketData]
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, 5); // Reduced from 10 to 5 for shorter prompt

    return `You are a crypto futures trading AI. Analyze and provide trading decision(s) in JSON format.

ACCOUNT STATUS:
Balance: $${accountStatus.totalBalance.toFixed(2)} | Available: $${accountStatus.availableBalance.toFixed(2)} | Margin: ${accountStatus.marginUsagePercent.toFixed(1)}% | PnL: $${accountStatus.unrealizedPnL.toFixed(2)}

POSITIONS: ${positions.length > 0 ? positions.map((p) => `${p.symbol} ${p.side} @ $${p.entryPrice.toFixed(2)} (${p.unrealizedPnLPercent.toFixed(1)}%)`).join(', ') : 'None'}

PERFORMANCE: WinRate ${(performanceMetrics.winRate * 100).toFixed(0)}% | ProfitFactor ${performanceMetrics.profitFactor.toFixed(1)}

TOP 5 MARKETS:
${sortedData.map((m) => {
      const rsi = m.rsi14 < 30 ? 'OVERSOLD' : m.rsi14 > 70 ? 'OVERBOUGHT' : 'NEUTRAL';
      const trend = m.currentPrice > m.ema20_3m ? 'UP' : 'DOWN';
      const macd = m.histogram > 0 ? 'BULL' : 'BEAR';

      return `${m.symbol}: $${m.currentPrice.toFixed(2)} (${m.priceChange24h > 0 ? '+' : ''}${m.priceChange24h.toFixed(1)}%) | RSI14:${m.rsi14.toFixed(0)} ${rsi} | Trend:${trend} | MACD:${macd} | Vol:$${(m.volume24h / 1000000).toFixed(0)}M | ATR:$${m.atr.toFixed(2)}`;
    }).join('\n')}

RULES:
- Max 90% margin usage
- Use 1.5x ATR for stop loss
- 1:2 risk/reward ratio minimum
- Avoid overbought assets (RSI>70)
- Look for trend + RSI + MACD confluence
- You can make MULTIPLE decisions if multiple good opportunities exist
- Prioritize closing losing positions and opening new winning positions

OUTPUT ONLY VALID JSON (no explanation before or after):

SINGLE DECISION (backward compatible):
{
  "action": "OPEN_LONG|OPEN_SHORT|CLOSE_LONG|CLOSE_SHORT|WAIT",
  "symbol": "BTCUSDT",
  "quantity": 0.01,
  "leverage": 5,
  "stopLoss": 45000,
  "takeProfit": 55000,
  "reasoning": "Brief technical analysis",
  "confidence": 0.85
}

MULTIPLE DECISIONS (use when beneficial):
{
  "action": "MULTIPLE",
  "reasoning": "Overall strategy summary",
  "confidence": 0.85,
  "decisions": [
    {
      "action": "CLOSE_LONG",
      "symbol": "BTCUSDT",
      "reasoning": "Stop loss hit",
      "confidence": 0.9,
      "priority": 1
    },
    {
      "action": "OPEN_SHORT",
      "symbol": "ETHUSDT",
      "quantity": 0.5,
      "leverage": 5,
      "stopLoss": 2100,
      "takeProfit": 1900,
      "reasoning": "Strong bearish signal",
      "confidence": 0.85,
      "priority": 2
    }
  ]
}`;
  }

  private async callAI(prompt: string, provider: { name: string; apiKey: string; baseURL: string; model: string }): Promise<string> {
    if (provider.name === 'RapidAPI') {
      return await this.callRapidAPI(prompt, provider);
    } else {
      return await this.callOpenRouterCompatible(prompt, provider);
    }
  }

  private async callOpenRouterCompatible(prompt: string, provider: { name: string; apiKey: string; baseURL: string; model: string }): Promise<string> {
    const requestBody = {
      model: provider.model,
      messages: [
        {
          role: 'system',
          content: 'You are a crypto trading AI. RESPOND ONLY WITH VALID JSON. No explanations, no markdown, no code blocks. Just raw JSON starting with { and ending with }.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1, // Very low for deterministic JSON
      max_tokens: 300, // Just enough for JSON response
      response_format: { type: 'json_object' }, // Force JSON mode if supported
    };

    console.log(`[${new Date().toISOString()}] Calling ${provider.name} API...`);
    console.log(`URL: ${provider.baseURL}/chat/completions`);
    console.log(`Model: ${provider.model}`);

    // Add timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(`${provider.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`${provider.name} API error (${response.status}):`, errorText);
        throw new Error(`${provider.name} API error (${response.status}): ${errorText}`);
      }

      const data = await response.json() as any;
      console.log(`${provider.name} response structure:`, JSON.stringify(data, null, 2));

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error(`Invalid ${provider.name} response structure:`, data);
        throw new Error(`Invalid response structure from ${provider.name}`);
      }

      const message = data.choices[0].message;
      const finishReason = data.choices[0].finish_reason;

      // Check if response was truncated or using reasoning mode
      if (finishReason === 'length') {
        console.warn(`⚠️ ${provider.name} response truncated - hit token limit`);
        throw new Error('Response truncated - hit token limit');
      }

      // Try to get content from either content or reasoning field
      let content = message.content || message.reasoning || '';

      // If content is empty or just reasoning without JSON, try next provider
      if (!content || content.trim().length === 0 || !content.includes('{')) {
        console.error(`❌ ${provider.name} model used reasoning mode without outputting JSON`);
        throw new Error('Model output only reasoning, no JSON content');
      }

      console.log(`✅ Got response content (${content.length} chars)`);
      return content;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`${provider.name} request timeout after 30 seconds`);
      }
      throw error;
    }
  }

  private async callRapidAPI(prompt: string, provider: { name: string; apiKey: string; baseURL: string; model: string }): Promise<string> {
    console.log(`[${new Date().toISOString()}] Calling RapidAPI...`);

    const response = await fetch(provider.baseURL, {
      method: 'POST',
      headers: {
        'x-rapidapi-key': provider.apiKey,
        'x-rapidapi-host': 'chatgpt-api8.p.rapidapi.com',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          content: 'You are a crypto trading AI. Output ONLY valid JSON. No explanations.',
          role: 'system',
        },
        {
          content: prompt,
          role: 'user',
        },
      ]),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`RapidAPI error (${response.status}):`, errorText);
      throw new Error(`RapidAPI error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.text();
    console.log(`RapidAPI response (${data.length} chars):`, data.substring(0, 500));
    return data;
  }

  private parseDecision(response: string, modelName: string): AIDecision {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('❌ No JSON found in AI response!');
        console.error('Response content:', response);
        throw new Error('No JSON found in response');
      }

      console.log(`✅ JSON extracted from response: ${jsonMatch[0]}`);
      let parsed = JSON.parse(jsonMatch[0]);
      console.log(`✅ JSON parsed successfully:`, parsed);

      // Handle RapidAPI's wrapper format: { "text": "{actual JSON}", ... }
      if (parsed.text && typeof parsed.text === 'string') {
        console.log('📦 Detected RapidAPI wrapper format, extracting inner JSON...');
        parsed = JSON.parse(parsed.text);
        console.log(`✅ Inner JSON extracted:`, parsed);
      }

      // Check if this is a multiple decisions response
      if (parsed.action === 'MULTIPLE' && parsed.decisions && Array.isArray(parsed.decisions)) {
        console.log(`✅ Multiple decisions detected: ${parsed.decisions.length} decisions`);

        // Sort decisions by priority (lower number = higher priority)
        const sortedDecisions = [...parsed.decisions].sort((a, b) =>
          (a.priority || 999) - (b.priority || 999)
        );

        return {
          action: 'WAIT', // Main action is WAIT when using multiple decisions
          reasoning: parsed.reasoning || 'Multiple decisions strategy',
          confidence: parsed.confidence || 0.5,
          chainOfThought: response,
          aiAgent: modelName,
          decisions: sortedDecisions.map((d: any) => ({
            action: d.action,
            symbol: d.symbol,
            quantity: d.quantity,
            leverage: d.leverage,
            stopLoss: d.stopLoss,
            takeProfit: d.takeProfit,
            reasoning: d.reasoning || '',
            confidence: d.confidence || 0.5,
            priority: d.priority || 999,
          })),
        };
      }

      // Single decision (backward compatible)
      return {
        action: parsed.action || 'WAIT',
        symbol: parsed.symbol,
        quantity: parsed.quantity,
        leverage: parsed.leverage,
        stopLoss: parsed.stopLoss,
        takeProfit: parsed.takeProfit,
        reasoning: parsed.reasoning || '',
        confidence: parsed.confidence || 0.5,
        chainOfThought: response,
        aiAgent: modelName,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('❌ Parse error:', errorMsg);
      console.error('Raw response was:', response.substring(0, 1000));
      return {
        action: 'WAIT',
        reasoning: `Failed to parse AI response: ${errorMsg}`,
        confidence: 0,
        chainOfThought: response,
        aiAgent: modelName,
      };
    }
  }
}

export const aiService = new AIService();
