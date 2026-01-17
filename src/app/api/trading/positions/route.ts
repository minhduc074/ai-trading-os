import { tradingEngine } from '@/lib/services/tradingEngine';
import type { Position } from '@/lib/types';
import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse<Position[]>> {
  const positions = await tradingEngine.getPositions();
  return NextResponse.json(positions);
}
