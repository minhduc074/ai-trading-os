import { tradingEngine } from '@/lib/services/tradingEngine';
import type { AIDecision } from '@/lib/types';
import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    console.log(`\n[${new Date().toISOString()}] ===== EXECUTING TRADE =====`);
    const decision: AIDecision = await request.json();

    // Check if this is a multiple decisions request
    if (decision.decisions && Array.isArray(decision.decisions) && decision.decisions.length > 0) {
      console.log(`[${new Date().toISOString()}] Executing ${decision.decisions.length} decisions...`);

      const results = [];
      let successCount = 0;
      let failureCount = 0;

      // Execute each decision in priority order
      for (let i = 0; i < decision.decisions.length; i++) {
        const item = decision.decisions[i];
        console.log(`\n[${new Date().toISOString()}] Executing decision ${i + 1}/${decision.decisions.length}: ${item.action} ${item.symbol}`);
        console.log(`  Reasoning: ${item.reasoning}`);
        console.log(`  Confidence: ${(item.confidence * 100).toFixed(0)}%`);

        // Convert decision item to full AIDecision format
        const singleDecision: AIDecision = {
          action: item.action,
          symbol: item.symbol,
          quantity: item.quantity,
          leverage: item.leverage,
          stopLoss: item.stopLoss,
          takeProfit: item.takeProfit,
          reasoning: item.reasoning,
          confidence: item.confidence,
          chainOfThought: '',
        };

        try {
          const result = await tradingEngine.executeDecision(singleDecision);
          results.push({
            decision: item,
            result,
          });

          if (result.success) {
            successCount++;
            console.log(`  ✅ Success: ${result.message || 'Executed successfully'}`);
          } else {
            failureCount++;
            console.log(`  ❌ Failed: ${result.error}`);
          }
        } catch (error) {
          failureCount++;
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`  ❌ Error: ${errorMsg}`);
          results.push({
            decision: item,
            result: {
              success: false,
              error: errorMsg,
            },
          });
        }
      }

      console.log(`\n[${new Date().toISOString()}] Multiple decisions executed: ${successCount} succeeded, ${failureCount} failed`);

      return NextResponse.json({
        success: successCount > 0,
        multipleDecisions: true,
        totalDecisions: decision.decisions.length,
        successCount,
        failureCount,
        results,
      });
    }

    // Single decision (backward compatible)
    const result = await tradingEngine.executeDecision(decision);
    console.log(`[${new Date().toISOString()}] Execution result:`, result);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
