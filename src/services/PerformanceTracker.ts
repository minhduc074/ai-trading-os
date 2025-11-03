import sqlite3 from 'sqlite3';
import { Database } from 'sqlite3';
import { TradeRecord, HistoricalFeedback, CoinPerformance, EquitySnapshot } from '../types';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Performance Tracker - Manages trade history and performance analytics
 * Implements accurate PnL calculation with leverage consideration
 */
export class PerformanceTracker {
  private db: Database;
  private traderId: string;
  private dbPath: string;

  constructor(traderId: string, dbPath: string = './data/performance.db') {
    this.traderId = traderId;
    this.dbPath = dbPath;

    // Ensure data directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new sqlite3.Database(dbPath);
    this.initDatabase();
  }

  private initDatabase(): void {
    this.db.serialize(() => {
      // Trades table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS trades (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          trader_id TEXT NOT NULL,
          symbol TEXT NOT NULL,
          side TEXT NOT NULL,
          symbol_side TEXT NOT NULL,
          entry_price REAL NOT NULL,
          quantity REAL NOT NULL,
          leverage INTEGER NOT NULL,
          open_time INTEGER NOT NULL,
          open_order_id TEXT,
          exit_price REAL,
          close_time INTEGER,
          close_order_id TEXT,
          pnl REAL,
          pnl_percent REAL,
          holding_duration INTEGER,
          stop_loss REAL,
          take_profit REAL,
          status TEXT NOT NULL,
          close_reason TEXT,
          created_at INTEGER NOT NULL
        )
      `);

      // Equity snapshots table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS equity_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          trader_id TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          equity REAL NOT NULL,
          daily_pnl REAL NOT NULL,
          daily_pnl_percent REAL NOT NULL
        )
      `);

      // Create indexes
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_trades_trader_id ON trades(trader_id)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_trades_symbol_side ON trades(symbol_side)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_equity_trader_id ON equity_snapshots(trader_id)`);
    });

    console.log(`Performance tracker initialized for ${this.traderId}`);
  }

  /**
   * Record a new trade (position opened)
   */
  async recordOpenTrade(trade: TradeRecord): Promise<number> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO trades (
          trader_id, symbol, side, symbol_side, entry_price, quantity, leverage,
          open_time, open_order_id, stop_loss, take_profit, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        this.traderId,
        trade.symbol,
        trade.side,
        `${trade.symbol}_${trade.side}`, // symbol_side prevents long/short conflicts
        trade.entryPrice,
        trade.quantity,
        trade.leverage,
        trade.openTime,
        trade.openOrderId || null,
        trade.stopLoss || null,
        trade.takeProfit || null,
        'open',
        Date.now(),
        function (this: any, err: Error | null) {
          if (err) {
            console.error(`Failed to record open trade: ${err.message}`);
            reject(err);
          } else {
            console.log(`Recorded open trade: ${trade.symbol} ${trade.side} @ ${trade.entryPrice}`);
            resolve(this.lastID);
          }
        }
      );

      stmt.finalize();
    });
  }

  /**
   * Close a trade and calculate PnL with leverage
   */
  async recordCloseTrade(
    symbol: string,
    side: 'LONG' | 'SHORT',
    exitPrice: number,
    closeOrderId?: string,
    closeReason: string = 'ai_decision'
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const symbolSide = `${symbol}_${side}`;

      // Find the most recent open trade for this symbol_side
      this.db.get(
        `SELECT * FROM trades WHERE trader_id = ? AND symbol_side = ? AND status = 'open' ORDER BY open_time DESC LIMIT 1`,
        [this.traderId, symbolSide],
        (err, row: any) => {
          if (err) {
            console.error(`Failed to find open trade: ${err.message}`);
            reject(err);
            return;
          }

          if (!row) {
            console.warn(`No open trade found for ${symbolSide}`);
            resolve();
            return;
          }

          const closeTime = Date.now();
          const holdingDuration = closeTime - row.open_time;

          // Calculate PnL with leverage
          // PnL = Position Value × Price Change % × Leverage
          const positionValue = row.quantity * row.entry_price;
          const priceChangePercent = side === 'LONG'
            ? (exitPrice - row.entry_price) / row.entry_price
            : (row.entry_price - exitPrice) / row.entry_price;
          
          const pnl = positionValue * priceChangePercent * row.leverage;
          const pnlPercent = priceChangePercent * row.leverage * 100;

          // Update trade record
          this.db.run(
            `UPDATE trades SET 
              exit_price = ?, 
              close_time = ?, 
              close_order_id = ?,
              pnl = ?, 
              pnl_percent = ?, 
              holding_duration = ?,
              status = 'closed',
              close_reason = ?
            WHERE id = ?`,
            [exitPrice, closeTime, closeOrderId || null, pnl, pnlPercent, holdingDuration, closeReason, row.id],
            (err) => {
              if (err) {
                console.error(`Failed to close trade: ${err.message}`);
                reject(err);
              } else {
                console.log(`Closed trade: ${symbol} ${side}, PnL: $${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)`);
                resolve();
              }
            }
          );
        }
      );
    });
  }

  /**
   * Get historical feedback for AI learning
   */
  async getHistoricalFeedback(cyclesCount: number = 20): Promise<HistoricalFeedback> {
    return new Promise((resolve, reject) => {
      // Get recent closed trades
      this.db.all(
        `SELECT * FROM trades WHERE trader_id = ? AND status = 'closed' ORDER BY close_time DESC LIMIT ?`,
        [this.traderId, cyclesCount],
        async (err, rows: any[]) => {
          if (err) {
            console.error(`Failed to get historical feedback: ${err.message}`);
            reject(err);
            return;
          }

          if (rows.length === 0) {
            resolve(this.getEmptyFeedback());
            return;
          }

          // Calculate overall statistics
          const totalTrades = rows.length;
          const winningTrades = rows.filter(r => r.pnl > 0).length;
          const losingTrades = rows.filter(r => r.pnl < 0).length;
          const winRate = (winningTrades / totalTrades) * 100;

          const totalProfit = rows.filter(r => r.pnl > 0).reduce((sum, r) => sum + r.pnl, 0);
          const totalLoss = Math.abs(rows.filter(r => r.pnl < 0).reduce((sum, r) => sum + r.pnl, 0));
          const averageProfit = winningTrades > 0 ? totalProfit / winningTrades : 0;
          const averageLoss = losingTrades > 0 ? totalLoss / losingTrades : 0;
          const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 999 : 0;

          // Calculate Sharpe ratio
          const returns = rows.map(r => r.pnl_percent);
          const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
          const stdDev = Math.sqrt(
            returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
          );
          const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

          // Calculate max drawdown
          const maxDrawdown = await this.calculateMaxDrawdown();

          // Per-coin statistics
          const perCoinStats = await this.calculatePerCoinStats();
          const bestCoins = perCoinStats.slice(0, 5);
          const worstCoins = perCoinStats.slice(-5).reverse();

          // Recent trades
          const recentTrades: TradeRecord[] = rows.slice(0, 5).map(r => ({
            id: r.id,
            traderId: r.trader_id,
            symbol: r.symbol,
            side: r.side,
            symbolSide: r.symbol_side,
            entryPrice: r.entry_price,
            quantity: r.quantity,
            leverage: r.leverage,
            openTime: r.open_time,
            openOrderId: r.open_order_id,
            exitPrice: r.exit_price,
            closeTime: r.close_time,
            closeOrderId: r.close_order_id,
            pnl: r.pnl,
            pnlPercent: r.pnl_percent,
            holdingDuration: r.holding_duration,
            stopLoss: r.stop_loss,
            takeProfit: r.take_profit,
            status: r.status,
            closeReason: r.close_reason,
          }));

          // Pattern analysis
          const consecutiveLosses = this.calculateConsecutivePattern(rows, false);
          const consecutiveWins = this.calculateConsecutivePattern(rows, true);

          // Identify coins to avoid/favor
          const avoidSymbols = worstCoins
            .filter(c => c.winRate < 30 && c.totalTrades >= 3)
            .map(c => c.symbol);
          
          const favorSymbols = bestCoins
            .filter(c => c.winRate > 70 && c.totalTrades >= 3)
            .map(c => c.symbol);

          resolve({
            totalCycles: totalTrades,
            winRate,
            totalTrades,
            winningTrades,
            losingTrades,
            averageProfit,
            averageLoss,
            profitFactor,
            sharpeRatio,
            maxDrawdown,
            perCoinStats,
            bestCoins,
            worstCoins,
            recentTrades,
            consecutiveLosses,
            consecutiveWins,
            avoidSymbols,
            favorSymbols,
          });
        }
      );
    });
  }

  private getEmptyFeedback(): HistoricalFeedback {
    return {
      totalCycles: 0,
      winRate: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      averageProfit: 0,
      averageLoss: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      perCoinStats: [],
      bestCoins: [],
      worstCoins: [],
      recentTrades: [],
      consecutiveLosses: 0,
      consecutiveWins: 0,
      avoidSymbols: [],
      favorSymbols: [],
    };
  }

  private async calculatePerCoinStats(): Promise<CoinPerformance[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT 
          symbol,
          COUNT(*) as total_trades,
          SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
          AVG(pnl) as avg_pnl,
          SUM(pnl) as total_pnl,
          MAX(pnl) as best_trade,
          MIN(pnl) as worst_trade
        FROM trades
        WHERE trader_id = ? AND status = 'closed'
        GROUP BY symbol
        ORDER BY total_pnl DESC`,
        [this.traderId],
        (err, rows: any[]) => {
          if (err) {
            reject(err);
            return;
          }

          const coinStats: CoinPerformance[] = rows.map(r => ({
            symbol: r.symbol,
            totalTrades: r.total_trades,
            winRate: (r.winning_trades / r.total_trades) * 100,
            averagePnl: r.avg_pnl,
            totalPnl: r.total_pnl,
            bestTrade: r.best_trade,
            worstTrade: r.worst_trade,
          }));

          resolve(coinStats);
        }
      );
    });
  }

  private calculateConsecutivePattern(rows: any[], isWin: boolean): number {
    let maxConsecutive = 0;
    let currentConsecutive = 0;

    for (const row of rows) {
      const matches = isWin ? row.pnl > 0 : row.pnl < 0;
      
      if (matches) {
        currentConsecutive++;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else {
        currentConsecutive = 0;
      }
    }

    return maxConsecutive;
  }

  private async calculateMaxDrawdown(): Promise<number> {
    return new Promise((resolve) => {
      this.db.all(
        `SELECT equity FROM equity_snapshots WHERE trader_id = ? ORDER BY timestamp ASC`,
        [this.traderId],
        (err, rows: any[]) => {
          if (err || rows.length === 0) {
            resolve(0);
            return;
          }

          let maxEquity = rows[0].equity;
          let maxDrawdown = 0;

          for (const row of rows) {
            if (row.equity > maxEquity) {
              maxEquity = row.equity;
            }
            
            const drawdown = ((maxEquity - row.equity) / maxEquity) * 100;
            maxDrawdown = Math.max(maxDrawdown, drawdown);
          }

          resolve(maxDrawdown);
        }
      );
    });
  }

  /**
   * Record equity snapshot for tracking
   */
  async recordEquitySnapshot(equity: number, dailyPnl: number, dailyPnlPercent: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO equity_snapshots (trader_id, timestamp, equity, daily_pnl, daily_pnl_percent)
         VALUES (?, ?, ?, ?, ?)`,
        [this.traderId, Date.now(), equity, dailyPnl, dailyPnlPercent],
        (err) => {
          if (err) {
            console.error(`Failed to record equity snapshot: ${err.message}`);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * Get equity history for charts
   */
  async getEquityHistory(limit: number = 1000): Promise<EquitySnapshot[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM equity_snapshots WHERE trader_id = ? ORDER BY timestamp DESC LIMIT ?`,
        [this.traderId, limit],
        (err, rows: any[]) => {
          if (err) {
            reject(err);
            return;
          }

          const snapshots: EquitySnapshot[] = rows.map(r => ({
            timestamp: r.timestamp,
            traderId: r.trader_id,
            equity: r.equity,
            dailyPnl: r.daily_pnl,
            dailyPnlPercent: r.daily_pnl_percent,
          }));

          resolve(snapshots.reverse());
        }
      );
    });
  }

  /**
   * Get open positions from database
   */
  async getOpenTrades(): Promise<TradeRecord[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM trades WHERE trader_id = ? AND status = 'open' ORDER BY open_time DESC`,
        [this.traderId],
        (err, rows: any[]) => {
          if (err) {
            reject(err);
            return;
          }

          const trades: TradeRecord[] = rows.map(r => ({
            id: r.id,
            traderId: r.trader_id,
            symbol: r.symbol,
            side: r.side,
            symbolSide: r.symbol_side,
            entryPrice: r.entry_price,
            quantity: r.quantity,
            leverage: r.leverage,
            openTime: r.open_time,
            openOrderId: r.open_order_id,
            stopLoss: r.stop_loss,
            takeProfit: r.take_profit,
            status: 'open',
          }));

          resolve(trades);
        }
      );
    });
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close((err) => {
      if (err) {
        console.error(`Error closing database: ${err.message}`);
      } else {
        console.log(`Database closed for ${this.traderId}`);
      }
    });
  }
}
