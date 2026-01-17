// Performance Service - Standalone Version
// Trading Statistics and Performance Calculations

class PerformanceService {
  calculateMetrics(trades) {
    if (trades.length === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        profitFactor: 1.0,
        averageProfitUSDT: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        bestPerformingAssets: [],
        worstPerformingAssets: [],
      };
    }

    // Calculate basic metrics
    const winningTrades = trades.filter((t) => t.pnl > 0);
    const losingTrades = trades.filter((t) => t.pnl <= 0);
    const winRate = trades.length > 0 ? winningTrades.length / trades.length : 0;

    // Calculate profit factor
    const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 1.0;

    // Calculate average profit
    const totalProfit = trades.reduce((sum, t) => sum + t.pnl, 0);
    const averageProfitUSDT = totalProfit / trades.length;

    // Calculate Sharpe ratio
    const returns = trades.map((t) => t.pnl);
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(252) : 0; // Annualized

    // Calculate max drawdown
    let maxDrawdown = 0;
    let runningMax = 0;
    let cumulativePnL = 0;
    for (const trade of trades) {
      cumulativePnL += trade.pnl;
      if (cumulativePnL > runningMax) {
        runningMax = cumulativePnL;
      }
      const drawdown = Math.abs((cumulativePnL - runningMax) / (runningMax || 1));
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    // Find best and worst performing assets
    const assetStats = this.getAssetStats(trades);
    const sortedAssets = Array.from(assetStats.entries()).sort((a, b) => b[1].pnl - a[1].pnl);
    const bestPerformingAssets = sortedAssets.slice(0, 5).map(([asset]) => asset);
    const worstPerformingAssets = sortedAssets.slice(-5).map(([asset]) => asset);

    return {
      totalTrades: trades.length,
      winRate,
      profitFactor,
      averageProfitUSDT,
      sharpeRatio,
      maxDrawdown,
      bestPerformingAssets,
      worstPerformingAssets,
    };
  }

  getAssetStats(trades) {
    const assetStats = new Map();

    for (const trade of trades) {
      const current = assetStats.get(trade.symbol) || { pnl: 0, count: 0 };
      current.pnl += trade.pnl;
      current.count += 1;
      assetStats.set(trade.symbol, current);
    }

    return assetStats;
  }

  getWinRatePercentage(trades) {
    if (trades.length === 0) return 0;
    const winningTrades = trades.filter((t) => t.pnl > 0).length;
    return (winningTrades / trades.length) * 100;
  }

  getTotalProfitLoss(trades) {
    return trades.reduce((sum, t) => sum + t.pnl, 0);
  }

  getAverageTradeTime(trades) {
    if (trades.length === 0) return 0;
    const totalDuration = trades.reduce((sum, t) => sum + t.duration, 0);
    return totalDuration / trades.length;
  }

  getConsecutiveWins(trades) {
    let maxConsecutive = 0;
    let currentConsecutive = 0;

    for (const trade of trades) {
      if (trade.pnl > 0) {
        currentConsecutive += 1;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else {
        currentConsecutive = 0;
      }
    }

    return maxConsecutive;
  }

  getConsecutiveLosses(trades) {
    let maxConsecutive = 0;
    let currentConsecutive = 0;

    for (const trade of trades) {
      if (trade.pnl <= 0) {
        currentConsecutive += 1;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else {
        currentConsecutive = 0;
      }
    }

    return maxConsecutive;
  }
}

module.exports = { PerformanceService };
