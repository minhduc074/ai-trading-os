'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import type { AccountStatus, Position, Trade } from '@/lib/types';

// Decision interval from env or default 1 hour (3600000ms)
const DECISION_INTERVAL = parseInt(process.env.NEXT_PUBLIC_DECISION_INTERVAL_MS || '3600000', 10);

export default function Dashboard() {
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isRunning, setIsRunning] = useState(true); // Auto-start on load
  const [cycleCount, setCycleCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastDecisionTime, setLastDecisionTime] = useState<Date | null>(null);
  const [nextDecisionIn, setNextDecisionIn] = useState<string>('');
  const [lastDecision, setLastDecision] = useState<{ action: string; reasoning: string; confidence: number } | null>(null);
  const tradingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);

  // Fetch dashboard data
  const fetchData = useCallback(async () => {
    try {
      const [accountRes, positionsRes, tradesRes] = await Promise.all([
        fetch('/api/trading/account'),
        fetch('/api/trading/positions'),
        fetch('/api/trading/trades'),
      ]);

      const account = (await accountRes.json()) as AccountStatus;
      const pos = (await positionsRes.json()) as Position[];
      const trd = (await tradesRes.json()) as Trade[];

      setAccountStatus(account);
      setPositions(pos);
      setTrades(trd);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Execute trading decision
  const executeDecision = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      console.log(`[${new Date().toISOString()}] Starting trading cycle...`);
      
      const response = await fetch('/api/trading/decision', { method: 'POST' });
      const decision = await response.json();
      
      
      // Update last decision state
      setLastDecision({
        action: decision.action,
        reasoning: decision.reasoning,
        confidence: decision.confidence || 0,
      });
      console.log(`[${new Date().toISOString()}] AI Decision:`, decision);

      // Execute the decision
      const execResult = await fetch('/api/trading/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(decision),
      });
      
      const result = await execResult.json();
      console.log(`[${new Date().toISOString()}] Execution result:`, result);

      setCycleCount((prev) => prev + 1);
      setLastDecisionTime(new Date());

      // Refresh data after execution
      await fetchData();
    } catch (error) {
      console.error('Decision error:', error);
    } finally {
      isProcessingRef.current = false;
    }
  }, [fetchData]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
    const dataInterval = setInterval(fetchData, 5000);
    return () => clearInterval(dataInterval);
  }, [fetchData]);

  // Auto-trading loop
  useEffect(() => {
    if (isRunning) {
      // Execute first decision immediately on start
      executeDecision();
      
      // Set up interval for subsequent decisions
      tradingIntervalRef.current = setInterval(() => {
        executeDecision();
      }, DECISION_INTERVAL);

      console.log(`[${new Date().toISOString()}] Trading started. Interval: ${DECISION_INTERVAL}ms`);
    } else {
      // Stop trading
      if (tradingIntervalRef.current) {
        clearInterval(tradingIntervalRef.current);
        tradingIntervalRef.current = null;
      }
      console.log(`[${new Date().toISOString()}] Trading stopped.`);
    }

    return () => {
      if (tradingIntervalRef.current) {
        clearInterval(tradingIntervalRef.current);
      }
    };
  }, [isRunning, executeDecision]);

  // Update countdown timer
  useEffect(() => {
    if (!isRunning || !lastDecisionTime) {
      setNextDecisionIn('--:--');
      return;
    }

    const updateCountdown = () => {
      const now = new Date().getTime();
      const nextTime = lastDecisionTime.getTime() + DECISION_INTERVAL;
      const remaining = Math.max(0, nextTime - now);
      
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setNextDecisionIn(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateCountdown();
    const countdownInterval = setInterval(updateCountdown, 1000);
    return () => clearInterval(countdownInterval);
  }, [isRunning, lastDecisionTime]);

  // Check position PnL every 5 minutes
  useEffect(() => {
    const logPositionPnL = () => {
      if (positions.length === 0) {
        console.log(`\n[${new Date().toISOString()}] ===== POSITION CHECK =====`);
        console.log('No open positions');
        return;
      }

      console.log(`\n[${new Date().toISOString()}] ===== POSITION CHECK =====`);
      console.log(`Total Positions: ${positions.length}`);
      
      let totalPnL = 0;
      positions.forEach((pos, idx) => {
        totalPnL += pos.unrealizedPnL;
        console.log(`\nPosition ${idx + 1}:`);
        console.log(`  Symbol: ${pos.symbol}`);
        console.log(`  Side: ${pos.side}`);
        console.log(`  Entry: $${pos.entryPrice.toFixed(2)}`);
        console.log(`  Current: $${pos.currentPrice.toFixed(2)}`);
        console.log(`  PnL: $${pos.unrealizedPnL.toFixed(2)} (${pos.unrealizedPnLPercent.toFixed(2)}%)`);
        console.log(`  Leverage: ${pos.leverage}x`);
      });
      
      console.log(`\nTotal Unrealized PnL: $${totalPnL.toFixed(2)}`);
      if (accountStatus) {
        console.log(`Account Balance: $${accountStatus.totalBalance.toFixed(2)}`);
        console.log(`Daily PnL: $${accountStatus.dailyPnL.toFixed(2)}`);
      }
      console.log('=====================================\n');
    };

    // Log immediately
    logPositionPnL();
    
    // Then log every 5 minutes
    const pnlCheckInterval = setInterval(logPositionPnL, 300000); // 5 minutes
    return () => clearInterval(pnlCheckInterval);
  }, [positions, accountStatus]);

  const handleStart = () => {
    setIsRunning(true);
  };

  const handleStop = () => {
    setIsRunning(false);
  };

  const handleDecision = async () => {
    await executeDecision();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">AI Trading Dashboard</h1>
        <div className="flex gap-4">
          {!isRunning ? (
            <button
              onClick={handleStart}
              className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg font-semibold transition"
            >
              Start Trading
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-lg font-semibold transition"
            >
              Stop Trading
            </button>
          )}
          <button
            onClick={handleDecision}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-semibold transition"
          >
            Make Decision Now
          </button>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-slate-800 rounded-lg p-4 mb-8 border border-slate-700">
        <div className="grid grid-cols-5 gap-4">
          <div>
            <p className="text-slate-400 text-sm">Status</p>
            <p className="text-xl font-semibold">{isRunning ? '🟢 RUNNING' : '🔴 STOPPED'}</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Cycle Count</p>
            <p className="text-xl font-semibold">{cycleCount}</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Next Decision</p>
            <p className="text-xl font-semibold">{nextDecisionIn}</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Open Positions</p>
            <p className="text-xl font-semibold">{positions.length}</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Mode</p>
            <p className="text-xl font-semibold">TESTNET</p>
          </div>
        </div>
      </div>

      {/* Account Status */}
      {accountStatus && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Account Status
            </h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Balance</span>
                <span className="font-semibold">${accountStatus.totalBalance.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Available Balance</span>
                <span className="font-semibold">${accountStatus.availableBalance.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Margin Usage</span>
                <span className={`font-semibold ${accountStatus.marginUsagePercent > 80 ? 'text-orange-400' : 'text-green-400'}`}>
                  {accountStatus.marginUsagePercent.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Unrealized PnL</span>
                <span className={`font-semibold flex items-center gap-1 ${accountStatus.unrealizedPnL > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {accountStatus.unrealizedPnL > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  ${accountStatus.unrealizedPnL.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Daily PnL</span>
                <span className={`font-semibold flex items-center gap-1 ${accountStatus.dailyPnL > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {accountStatus.dailyPnL > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  ${accountStatus.dailyPnL.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-lg font-semibold mb-4">Quick Stats</h2>
            <div className="space-y-3">
              <div className="bg-slate-900 rounded p-3">
                <p className="text-slate-400 text-sm">Win Rate (Last 20)</p>
                <p className="text-2xl font-bold">
                  {trades.length > 0 ? ((trades.filter((t) => t.pnl > 0).length / trades.length) * 100).toFixed(1) : '0'}%
                </p>
              </div>
              <div className="bg-slate-900 rounded p-3">
                <p className="text-slate-400 text-sm">Average Trade PnL</p>
                <p className="text-2xl font-bold">
                  ${trades.length > 0 ? (trades.reduce((sum, t) => sum + t.pnl, 0) / trades.length).toFixed(2) : '0'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Positions */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 mb-8">
        <h2 className="text-lg font-semibold mb-4">Open Positions ({positions.length})</h2>
        {positions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 px-4">Symbol</th>
                  <th className="text-left py-2 px-4">Side</th>
                  <th className="text-right py-2 px-4">Quantity</th>
                  <th className="text-right py-2 px-4">Entry Price</th>
                  <th className="text-right py-2 px-4">Current Price</th>
                  <th className="text-right py-2 px-4">Leverage</th>
                  <th className="text-right py-2 px-4">PnL</th>
                  <th className="text-right py-2 px-4">PnL %</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((position, index) => (
                  <tr key={index} className="border-b border-slate-700 hover:bg-slate-700 transition">
                    <td className="py-3 px-4 font-semibold">{position.symbol}</td>
                    <td className={`py-3 px-4 font-semibold ${position.side === 'LONG' ? 'text-green-400' : 'text-red-400'}`}>{position.side}</td>
                    <td className="text-right py-3 px-4">{position.quantity.toFixed(4)}</td>
                    <td className="text-right py-3 px-4">${position.entryPrice.toFixed(2)}</td>
                    <td className="text-right py-3 px-4">${position.currentPrice.toFixed(2)}</td>
                    <td className="text-right py-3 px-4">{position.leverage}x</td>
                    <td className={`text-right py-3 px-4 font-semibold ${position.unrealizedPnL > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ${position.unrealizedPnL.toFixed(2)}
                    </td>
                    <td className={`text-right py-3 px-4 font-semibold ${position.unrealizedPnLPercent > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {position.unrealizedPnLPercent.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-400 text-center py-8">No open positions</p>
        )}
      </div>

      {/* Recent Trades */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-lg font-semibold mb-4">Recent Trades</h2>
        {trades.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 px-4">Symbol</th>
                  <th className="text-left py-2 px-4">Side</th>
                  <th className="text-right py-2 px-4">Entry Price</th>
                  <th className="text-right py-2 px-4">Exit Price</th>
                  <th className="text-right py-2 px-4">PnL</th>
                  <th className="text-right py-2 px-4">PnL %</th>
                  <th className="text-right py-2 px-4">Duration</th>
                </tr>
              </thead>
              <tbody>
                {trades.slice(-10).map((trade, index) => (
                  <tr key={index} className="border-b border-slate-700 hover:bg-slate-700 transition">
                    <td className="py-3 px-4 font-semibold">{trade.symbol}</td>
                    <td className={`py-3 px-4 font-semibold ${trade.side === 'LONG' ? 'text-green-400' : 'text-red-400'}`}>{trade.side}</td>
                    <td className="text-right py-3 px-4">${trade.entryPrice.toFixed(2)}</td>
                    <td className="text-right py-3 px-4">${trade.exitPrice.toFixed(2)}</td>
                    <td className={`text-right py-3 px-4 font-semibold ${trade.pnl > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ${trade.pnl.toFixed(2)}
                    </td>
                    <td className={`text-right py-3 px-4 font-semibold ${trade.pnlPercent > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {trade.pnlPercent.toFixed(2)}%
                    </td>
                    <td className="text-right py-3 px-4">{trade.duration}m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-400 text-center py-8">No recent trades</p>
        )}
      </div>

      {/* Last AI Decision */}
      {lastDecision && (
        <div className="bg-slate-800 rounded-lg p-6 mt-8 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Last AI Decision
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">Confidence:</span>
              <span className={`font-semibold ${lastDecision.confidence >= 0.7 ? 'text-green-400' : lastDecision.confidence >= 0.4 ? 'text-yellow-400' : 'text-orange-400'}`}>
                {(lastDecision.confidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-slate-400 text-sm mb-1">Action</p>
              <p className={`text-2xl font-bold ${
                lastDecision.action === 'OPEN_LONG' ? 'text-green-400' : 
                lastDecision.action === 'OPEN_SHORT' ? 'text-red-400' : 
                lastDecision.action === 'CLOSE_LONG' || lastDecision.action === 'CLOSE_SHORT' ? 'text-yellow-400' : 
                'text-blue-400'
              }`}>
                {lastDecision.action}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-sm mb-1">Reasoning</p>
              <p className="text-slate-200 leading-relaxed">{lastDecision.reasoning}</p>
            </div>
            {lastDecisionTime && (
              <div>
                <p className="text-slate-400 text-sm">
                  Time: {lastDecisionTime.toLocaleTimeString()}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
