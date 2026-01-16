import { tradingEngine } from '@/lib/services/tradingEngine';
import { marketDataService } from '@/lib/services/marketDataService';
import type { AccountStatus } from '@/lib/types';
import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse<AccountStatus>> {
  const accountStatus = await tradingEngine.getAccountStatus();
  return NextResponse.json(accountStatus);
}
