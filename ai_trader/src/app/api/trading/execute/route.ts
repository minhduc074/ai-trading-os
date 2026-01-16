import { tradingEngine } from '@/lib/services/tradingEngine';
import type { AIDecision } from '@/lib/types';
import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    console.log(`\n[${new Date().toISOString()}] ===== EXECUTING TRADE =====`);
    const decision: AIDecision = await request.json();
    const result = await tradingEngine.executeDecision(decision);
    console.log(`[${new Date().toISOString()}] Execution result:`, result);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
