export { AIDecisionEngine } from './AIService_v2';

// NOTE: AIService.ts was a legacy file that has been superseded by AIService_v2.ts.
// We keep this short re-export as a compatibility wrapper for any old imports.
// Please update any direct imports to use AIService_v2.ts. If you truly want to
// remove this file from the repository, delete it using version control (git rm) and
// update tsconfig.json if necessary.
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
    prompt += `Now provide your complete Chain of Thought analysis followed by your JSON decisions in a markdown code block:\n\n`;
    prompt += `\`\`\`json\n`;
    prompt += `[\n`;
    prompt += `  {\n`;
    prompt += `    "action": "open_long",\n`;
    prompt += `    "symbol": "BCHUSDT",\n`;
    prompt += `    "position_size_usd": 1000,\n`;
    prompt += `    "profit_target": 450,\n`;
    prompt += `    "stop_loss": 380,\n`;
    prompt += `    "invalidation_condition": "Price drops below 400",\n`;
    prompt += `    "confidence": 75,\n`;
    prompt += `    "risk_usd": 60,\n`;
    prompt += `    "reasoning": "3min MACD bull cross + hist expand, above EMA20"\n`;
    prompt += `  }\n`;
    prompt += `]\n`;
    prompt += `\`\`\``;

    return prompt;
  }

  private parseAIResponse(response: string): { decisions: TradingDecision[]; chainOfThought: string } {
    // Extract Chain of Thought (everything before JSON)
    // Look for JSON in markdown code blocks first, then raw JSON
    let jsonMatch = response.match(/```(?:json)?\s*(\[[\s\S]*?\]|\{[\s\S]*?\})\s*```/);
    
    if (!jsonMatch) {
      // Fallback to raw JSON matching
      jsonMatch = response.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    }
    
    let chainOfThought = response;
    let decisions: TradingDecision[] = [];

    if (jsonMatch) {
      chainOfThought = response.substring(0, jsonMatch.index).trim();
      
      try {
        // Use the captured group (the actual JSON content)
        const jsonContent = jsonMatch[1] || jsonMatch[0];
        const parsed = JSON.parse(jsonContent);
        const decisionData = Array.isArray(parsed) ? parsed : [parsed];
        
        // Validate and clean decisions
        decisions = decisionData
          .filter(d => d.action && ['close_long', 'close_short', 'open_long', 'open_short', 'hold', 'wait'].includes(d.action))
          .map((d: any) => ({
            action: d.action,
            symbol: d.symbol,
            position_size_usd: d.position_size_usd,
            profit_target: d.profit_target,
            stop_loss: d.stop_loss,
            invalidation_condition: d.invalidation_condition,
            confidence: d.confidence,
            risk_usd: d.risk_usd,
            reasoning: d.reasoning || '',
          }));
      } catch (error) {
        console.error(`Failed to parse AI JSON: ${error}`);
        decisions = [{ 
          action: 'wait', 
          symbol: undefined,
          position_size_usd: 0,
          profit_target: undefined,
          stop_loss: undefined,
          invalidation_condition: 'Failed to parse AI response',
          confidence: 0,
          risk_usd: 0,
          reasoning: 'Failed to parse AI response' 
        }];
      }
    } else {
      // No JSON found, default to wait
      decisions = [{ 
        action: 'wait', 
        symbol: undefined,
        position_size_usd: 0,
        profit_target: undefined,
        stop_loss: undefined,
        invalidation_condition: 'No JSON response from AI',
        confidence: 0,
        risk_usd: 0,
        reasoning: 'No clear trading signals' 
      }];
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
