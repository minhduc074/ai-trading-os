import { tradingEngine } from '@/lib/services/tradingEngine';
import { aiService } from '@/lib/services/aiService';
import { marketDataService } from '@/lib/services/marketDataService';
import type { AIDecision, PerformanceMetrics } from '@/lib/types';
import { NextResponse } from 'next/server';

export async function POST(): Promise<NextResponse<AIDecision>> {
  try {
    console.log(`\n[${new Date().toISOString()}] ===== TRADING DECISION REQUESTED =====`);
    
    const accountStatus = await tradingEngine.getAccountStatus();
    console.log(`[${new Date().toISOString()}] Account Status fetched`);
    
    const positions = await tradingEngine.getPositions();
    console.log(`[${new Date().toISOString()}] Positions fetched: ${positions.length}`);
    
    const coins = await marketDataService.getDefaultCoinPool();
    console.log(`[${new Date().toISOString()}] Fetching market data for ${coins.length} coins...`);
    
    const marketData = await marketDataService.getMarketData(coins);
    console.log(`[${new Date().toISOString()}] Market data fetched: ${marketData.length} coins`);
    
    // Log sample data
    if (marketData.length > 0) {
      const sample = marketData[0];
      console.log(`[${new Date().toISOString()}] Sample data for ${sample.symbol}:`);
      console.log(`  Price: $${sample.currentPrice}, RSI14: ${sample.rsi14.toFixed(2)}, Volume: $${sample.volume24h.toFixed(0)}`);
    }

    const minLiquidity = parseFloat(process.env.NEXT_PUBLIC_MIN_LIQUIDITY_USD || '10000000');
    const filteredData = marketData.filter((m) => m.liquidityUSD > minLiquidity);
    console.log(`[${new Date().toISOString()}] Filtered to ${filteredData.length} coins with liquidity > $${minLiquidity.toLocaleString()}`);

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

    console.log(`[${new Date().toISOString()}] Calling AI service...`);
    const decision = await aiService.getTradeDecision(
      accountStatus,
      positions,
      filteredData.length > 0 ? filteredData : marketData.slice(0, 10), // Use top 10 if filtering removes all
      performanceMetrics
    );

    console.log(`[${new Date().toISOString()}] Decision: ${decision.action} ${decision.symbol ? 'for ' + decision.symbol : ''}`);
    console.log(`[${new Date().toISOString()}] Reasoning: ${decision.reasoning.substring(0, 100)}...`);
    console.log(`[${new Date().toISOString()}] Confidence: ${(decision.confidence * 100).toFixed(0)}%`);

    return NextResponse.json(decision);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${new Date().toISOString()}] Decision error:`, error);
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
