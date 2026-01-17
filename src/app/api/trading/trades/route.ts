import { tradingEngine } from '@/lib/services/tradingEngine';
import type { Trade } from '@/lib/types';
import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse<Trade[]>> {
  const trades = await tradingEngine.getRecentTrades(20);
  return NextResponse.json(trades);
}
