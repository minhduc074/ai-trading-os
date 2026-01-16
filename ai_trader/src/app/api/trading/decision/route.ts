import { tradingEngine } from '@/lib/services/tradingEngine';
import { aiService } from '@/lib/services/aiService';
import { marketDataService } from '@/lib/services/marketDataService';
import type { AIDecision, PerformanceMetrics } from '@/lib/types';
import { NextResponse } from 'next/server';

export async function POST(): Promise<NextResponse<AIDecision>> {
  try {
    console.log(`\n[${new Date().toISOString()}] ===== TRADING DECISION REQUESTED =====`);
    const accountStatus = await tradingEngine.getAccountStatus();
    const positions = await tradingEngine.getPositions();
    const coins = await marketDataService.getDefaultCoinPool();
    const marketData = await marketDataService.getMarketData(coins);

    const performanceMetrics: PerformanceMetrics = {
      totalTrades: 0,
      winRate: 0.5,
      profitFactor: 1.0,
      averageProfitUSDT: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      bestPerformingAssets: [],
      worstPerformingAssets: [],
    };

    const decision = await aiService.getTradeDecision(
      accountStatus,
      positions,
      marketData.filter((m) => m.liquidityUSD > parseFloat(process.env.NEXT_PUBLIC_MIN_LIQUIDITY_USD || '15000000')),
      performanceMetrics
    );

    console.log(`[${new Date().toISOString()}] Decision: ${decision.action} ${decision.symbol ? 'for ' + decision.symbol : ''}`);
    console.log(`[${new Date().toISOString()}] Reasoning: ${decision.reasoning.substring(0, 100)}...`);

    return NextResponse.json(decision);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        action: 'WAIT',
        reasoning: `Error: ${message}`,
        confidence: 0,
        chainOfThought: '',
      },
      { status: 500 }
    );
  }
}
