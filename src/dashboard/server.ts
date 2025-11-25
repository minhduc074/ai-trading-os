import express, { Request, Response } from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { TradingEngine } from '../core/TradingEngine';
import * as path from 'path';

/**
 * Dashboard Server
 * Express + WebSocket server for real-time trading monitoring
 */
export async function startDashboardServer(
  port: number,
  tradingEngine: TradingEngine
): Promise<Server> {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  // API Routes
  app.get('/api/status', (req: Request, res: Response) => {
    res.json({
      success: true,
      data: tradingEngine.getStatus(),
    });
  });

  app.post('/api/close-all-positions', async (req: Request, res: Response) => {
    try {
      const results = await tradingEngine.closeAllPositions();
      res.json({
        success: true,
        message: `Closed ${results.filter(r => r.success).length}/${results.length} positions`,
        data: results,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  });

  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'AI Trading OS is running',
      timestamp: Date.now(),
    });
  });

  // Serve dashboard HTML
  app.get('/', (req: Request, res: Response) => {
    res.send(getDashboardHTML());
  });

  // Create HTTP server
  const server = app.listen(port, () => {
    console.log(`   Dashboard server listening on port ${port}`);
  });

  // Setup WebSocket
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket) => {
    console.log('   Dashboard client connected');

    // Send initial status
    ws.send(JSON.stringify({
      type: 'status',
      data: tradingEngine.getStatus(),
    }));

    ws.on('close', () => {
      console.log('   Dashboard client disconnected');
    });
  });

  // Broadcast updates every 5 seconds
  setInterval(() => {
    const status = tradingEngine.getStatus();
    // console.log('   Broadcasting status - accountInfo:', !!status.accountInfo, 
    //             'positions:', status.accountInfo?.positions?.length || 0);
    
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'update',
          data: status,
          timestamp: Date.now(),
        }));
      }
    });
  }, 5000);

  return server;
}

/**
 * Dashboard HTML
 */
function getDashboardHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Trading OS v2.0.2 - Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #0a0e27;
      color: #e0e0e0;
      padding: 20px;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 30px;
      box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3);
    }

    .header h1 {
      font-size: 32px;
      margin-bottom: 8px;
      color: white;
    }

    .header p {
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
    }

    .status-card {
      background: #1a1f3a;
      border-radius: 12px;
      padding: 25px;
      margin-bottom: 20px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .status-card h2 {
      font-size: 20px;
      margin-bottom: 15px;
      color: #667eea;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
    }

    .status-item {
      background: rgba(255, 255, 255, 0.03);
      padding: 15px;
      border-radius: 8px;
      border-left: 3px solid #667eea;
    }

    .status-label {
      font-size: 12px;
      color: #888;
      text-transform: uppercase;
      margin-bottom: 5px;
    }

    .status-value {
      font-size: 22px;
      font-weight: bold;
      color: #fff;
    }

    .status-value.positive {
      color: #10dc60;
    }

    .status-value.negative {
      color: #f04141;
    }

    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: bold;
    }

    .status-badge.running {
      background: #10dc60;
      color: white;
    }

    .status-badge.stopped {
      background: #f04141;
      color: white;
    }

    .connection-status {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 10px 20px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: bold;
      z-index: 1000;
    }

    .connection-status.connected {
      background: #10dc60;
      color: white;
    }

    .connection-status.disconnected {
      background: #f04141;
      color: white;
    }

    .footer {
      text-align: center;
      margin-top: 40px;
      color: #666;
      font-size: 12px;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .pulse {
      animation: pulse 2s infinite;
    }

    .positions-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }

    .positions-table th {
      background: rgba(102, 126, 234, 0.2);
      padding: 12px;
      text-align: left;
      color: #667eea;
      font-weight: bold;
      border-bottom: 2px solid rgba(102, 126, 234, 0.3);
    }

    .positions-table td {
      padding: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .positions-table tr:hover {
      background: rgba(255, 255, 255, 0.02);
    }

    .position-side-long {
      background: #10dc60;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: bold;
    }

    .position-side-short {
      background: #f04141;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div id="connectionStatus" class="connection-status disconnected">
    🔴 Disconnected
  </div>

  <div class="container">
    <div class="header">
      <h1>🤖 AI Trading Operating System v2.0.2</h1>
      <p>Professional AI-powered trading with self-learning capabilities</p>
    </div>

    <div class="status-card">
      <h2>📊 System Status</h2>
      <div class="status-grid">
        <div class="status-item">
          <div class="status-label">Engine Status</div>
          <div class="status-value" id="engineStatus">
            <span class="status-badge stopped">STOPPED</span>
          </div>
        </div>
        <div class="status-item">
          <div class="status-label">Trader ID</div>
          <div class="status-value" id="traderId" style="font-size: 14px;">-</div>
        </div>
        <div class="status-item">
          <div class="status-label">Cycle Number</div>
          <div class="status-value" id="cycleNumber">0</div>
        </div>
        <div class="status-item">
          <div class="status-label">Last Update</div>
          <div class="status-value" id="lastUpdate" style="font-size: 14px;">-</div>
        </div>
      </div>
    </div>

    <div class="status-card">
      <h2>� Account Balance</h2>
      <div class="status-grid">
        <div class="status-item">
          <div class="status-label">Total Equity</div>
          <div class="status-value" id="totalEquity">$0.00</div>
        </div>
        <div class="status-item">
          <div class="status-label">Available Balance</div>
          <div class="status-value" id="availableBalance">$0.00</div>
        </div>
        <div class="status-item">
          <div class="status-label">Unrealized PnL</div>
          <div class="status-value" id="unrealizedPnl">$0.00</div>
        </div>
        <div class="status-item">
          <div class="status-label">Open Positions</div>
          <div class="status-value" id="openPositions">0</div>
        </div>
      </div>
    </div>

    <div class="status-card">
      <h2>�💡 Quick Stats</h2>
      <div class="status-grid">
        <div class="status-item">
          <div class="status-label">Total Cycles</div>
          <div class="status-value" id="totalCycles">0</div>
        </div>
        <div class="status-item">
          <div class="status-label">Uptime</div>
          <div class="status-value" id="uptime" style="font-size: 18px;">-</div>
        </div>
        <div class="status-item">
          <div class="status-label">Next Cycle</div>
          <div class="status-value" id="nextCycle" style="font-size: 16px;">-</div>
        </div>
      </div>
    </div>

    <div class="status-card">
      <h2>📈 Performance Charts</h2>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;">
        <div>
          <h3 style="color: #667eea; margin-bottom: 10px; font-size: 16px;">💰 Equity per Cycle</h3>
          <canvas id="equityChart" style="max-height: 250px;"></canvas>
        </div>
        <div>
          <h3 style="color: #667eea; margin-bottom: 10px; font-size: 16px;">🎯 Decisions per Cycle</h3>
          <canvas id="decisionsChart" style="max-height: 250px;"></canvas>
        </div>
      </div>
    </div>

    <div class="status-card">
      <h2>� Open Positions</h2>
      <div style="margin-bottom: 15px;">
        <button id="closeAllBtn" style="background: #f04141; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold;">
          🚨 Close All Positions
        </button>
        <span id="closeAllStatus" style="margin-left: 15px; font-size: 14px; color: #888;"></span>
      </div>
      <div id="openPositionsTable" style="overflow-x: auto;">
        <p style="color: #666;">No open positions...</p>
      </div>
    </div>

    <div class="status-card">
      <h2>�📋 Recent Actions</h2>
      <div id="recentActions" style="max-height: 400px; overflow-y: auto; line-height: 1.8;">
        <p style="color: #666;">No actions yet...</p>
      </div>
    </div>

    <div class="status-card">
      <h2>📝 System Information</h2>
      <div style="line-height: 1.8; color: #aaa;">
        <p><strong>Features:</strong></p>
        <ul style="margin-left: 20px; margin-top: 10px;">
          <li>✅ Full trading support (long/short, leverage, SL/TP)</li>
          <li>✅ AI self-learning (analyzes last 20 cycles)</li>
          <li>✅ Multi-timeframe analysis (3min + 4hour)</li>
          <li>✅ Unified risk control (position limits, margin management)</li>
          <li>✅ Complete decision logging with Chain of Thought</li>
          <li>✅ Real-time performance tracking</li>
        </ul>
        <p style="margin-top: 15px;"><strong>Access logs:</strong> <code>decision_logs/[trader_id]/</code></p>
        <p><strong>Database:</strong> <code>data/performance.db</code></p>
      </div>
    </div>

    <div class="footer">
      <p>AI Trading Operating System v2.0.2 | Built with Node.js + TypeScript</p>
      <p>Dashboard auto-refreshes every 5 seconds via WebSocket</p>
    </div>
  </div>

  <script>
    let ws;
    let startTime = Date.now();
    let equityChart = null;
    let decisionsChart = null;

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(protocol + '//' + window.location.host);

      ws.onopen = () => {
        document.getElementById('connectionStatus').className = 'connection-status connected';
        document.getElementById('connectionStatus').innerHTML = '🟢 Connected';
      };

      ws.onclose = () => {
        document.getElementById('connectionStatus').className = 'connection-status disconnected';
        document.getElementById('connectionStatus').innerHTML = '🔴 Disconnected';
        setTimeout(connect, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'status' || message.type === 'update') {
            console.log('Received data:', message.data);
            console.log('AccountInfo:', message.data.accountInfo);
            console.log('Positions:', message.data.accountInfo?.positions);
            updateDashboard(message.data);
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };
    }

    function updateDashboard(data) {
      // Engine status
      const statusBadge = data.isRunning
        ? '<span class="status-badge running">RUNNING</span>'
        : '<span class="status-badge stopped">STOPPED</span>';
      document.getElementById('engineStatus').innerHTML = statusBadge;

      // Trader ID
      document.getElementById('traderId').textContent = data.traderId || '-';

      // Cycle number
      document.getElementById('cycleNumber').textContent = data.cycleNumber || 0;

      // Last update
      const now = new Date();
      document.getElementById('lastUpdate').textContent = now.toLocaleTimeString();

      // Total cycles
      document.getElementById('totalCycles').textContent = data.cycleNumber || 0;

      // Uptime
      const uptimeMs = Date.now() - startTime;
      const uptimeMin = Math.floor(uptimeMs / 60000);
      const uptimeSec = Math.floor((uptimeMs % 60000) / 1000);
      document.getElementById('uptime').textContent = uptimeMin + 'm ' + uptimeSec + 's';

      // Next cycle (placeholder - would need actual timing info)
      if (data.isRunning) {
        document.getElementById('nextCycle').textContent = '< 3 min';
      } else {
        document.getElementById('nextCycle').textContent = '-';
      }

      // Account Balance
      if (data.accountInfo) {
        const acc = data.accountInfo;
        console.log('Processing accountInfo, positions count:', acc.positions?.length || 0);
        document.getElementById('totalEquity').textContent = '$' + (acc.totalEquity || 0).toFixed(2);
        document.getElementById('availableBalance').textContent = '$' + (acc.availableBalance || 0).toFixed(2);
        
        const pnl = acc.totalUnrealizedPnl || 0;
        const pnlEl = document.getElementById('unrealizedPnl');
        pnlEl.textContent = '$' + pnl.toFixed(2);
        pnlEl.className = 'status-value ' + (pnl >= 0 ? 'positive' : 'negative');
        
        document.getElementById('openPositions').textContent = acc.totalPositions || 0;

        // Open Positions Table
        if (acc.positions && acc.positions.length > 0) {
          let tableHtml = '<table class="positions-table">' +
            '<thead><tr>' +
            '<th>Symbol</th>' +
            '<th>Side</th>' +
            '<th>Entry</th>' +
            '<th>Current</th>' +
            '<th>Quantity</th>' +
            '<th>Leverage</th>' +
            '<th>PnL</th>' +
            '<th>PnL %</th>' +
            '<th>Duration</th>' +
            '</tr></thead><tbody>';
          
          acc.positions.forEach(pos => {
            const pnlClass = pos.unrealizedPnl >= 0 ? 'positive' : 'negative';
            const sideClass = pos.side === 'LONG' ? 'position-side-long' : 'position-side-short';
            tableHtml += '<tr>' +
              '<td><strong>' + pos.symbol + '</strong></td>' +
              '<td><span class="' + sideClass + '">' + pos.side + '</span></td>' +
              '<td>$' + pos.entryPrice.toFixed(2) + '</td>' +
              '<td>$' + pos.currentPrice.toFixed(2) + '</td>' +
              '<td>' + pos.quantity + '</td>' +
              '<td>' + pos.leverage + 'x</td>' +
              '<td class="' + pnlClass + '">$' + pos.unrealizedPnl.toFixed(2) + '</td>' +
              '<td class="' + pnlClass + '">' + pos.unrealizedPnlPercent.toFixed(2) + '%</td>' +
              '<td>' + (pos.duration || 'N/A') + '</td>' +
              '</tr>';
          });
          
          tableHtml += '</tbody></table>';
          document.getElementById('openPositionsTable').innerHTML = tableHtml;
        } else {
          document.getElementById('openPositionsTable').innerHTML = '<p style="color: #666;">No open positions...</p>';
        }
      }

      // Update charts
      updateCharts(data.cycleHistory || []);

      // Recent Actions
      if (data.recentActions && data.recentActions.length > 0) {
        const actionsHtml = data.recentActions
          .slice()
          .reverse()
          .map(action => {
            const time = new Date(action.timestamp).toLocaleTimeString();
            const actionBadge = getActionBadge(action.action);
            const symbol = action.symbol ? ' ' + action.symbol : '';
            const details = action.details ? ' - ' + action.details : '';
            return '<div style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.05);">' +
                   '<strong>' + time + '</strong> ' + actionBadge + symbol + 
                   '<div style="color: #888; font-size: 12px; margin-top: 4px;">' + details + '</div>' +
                   '</div>';
          })
          .join('');
        document.getElementById('recentActions').innerHTML = actionsHtml;
      }
    }

    function getActionBadge(action) {
      const badges = {
        'open_long': '<span style="background: #10dc60; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">OPEN LONG</span>',
        'open_short': '<span style="background: #f04141; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">OPEN SHORT</span>',
        'close_long': '<span style="background: #ffce00; color: black; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">CLOSE LONG</span>',
        'close_short': '<span style="background: #ffce00; color: black; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">CLOSE SHORT</span>',
        'hold': '<span style="background: #666; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">HOLD</span>',
        'wait': '<span style="background: #444; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">WAIT</span>',
      };
      return badges[action] || '<span style="background: #888; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px;">' + action.toUpperCase() + '</span>';
    }

    function updateCharts(cycleHistory) {
      if (!cycleHistory || cycleHistory.length === 0) return;

      const labels = cycleHistory.map(h => 'Cycle ' + h.cycle);
      const equityData = cycleHistory.map(h => h.equity);
      const decisionsData = cycleHistory.map(h => h.decisions);

      // Equity Chart
      if (equityChart) {
        equityChart.data.labels = labels;
        equityChart.data.datasets[0].data = equityData;
        equityChart.update('none');
      } else {
        const ctx1 = document.getElementById('equityChart').getContext('2d');
        equityChart = new Chart(ctx1, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [{
              label: 'Equity ($)',
              data: equityData,
              borderColor: '#10dc60',
              backgroundColor: 'rgba(16, 220, 96, 0.1)',
              borderWidth: 2,
              fill: true,
              tension: 0.4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: '#fff',
                bodyColor: '#fff'
              }
            },
            scales: {
              x: {
                ticks: { color: '#888', maxRotation: 45, minRotation: 45 },
                grid: { color: 'rgba(255, 255, 255, 0.05)' }
              },
              y: {
                ticks: { color: '#888' },
                grid: { color: 'rgba(255, 255, 255, 0.05)' }
              }
            }
          }
        });
      }

      // Decisions Chart
      if (decisionsChart) {
        decisionsChart.data.labels = labels;
        decisionsChart.data.datasets[0].data = decisionsData;
        decisionsChart.update('none');
      } else {
        const ctx2 = document.getElementById('decisionsChart').getContext('2d');
        decisionsChart = new Chart(ctx2, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [{
              label: 'Decisions',
              data: decisionsData,
              backgroundColor: 'rgba(102, 126, 234, 0.8)',
              borderColor: '#667eea',
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: '#fff',
                bodyColor: '#fff'
              }
            },
            scales: {
              x: {
                ticks: { color: '#888', maxRotation: 45, minRotation: 45 },
                grid: { color: 'rgba(255, 255, 255, 0.05)' }
              },
              y: {
                ticks: { color: '#888', stepSize: 1 },
                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                beginAtZero: true
              }
            }
          }
        });
      }
    }

    // Initial connection
    connect();

    // Close All Positions Button
    document.getElementById('closeAllBtn').addEventListener('click', async () => {
      const btn = document.getElementById('closeAllBtn');
      const status = document.getElementById('closeAllStatus');
      
      if (confirm('Are you sure you want to close ALL open positions? This action cannot be undone.')) {
        btn.disabled = true;
        btn.textContent = 'Closing...';
        status.textContent = 'Processing...';
        status.style.color = '#ffce00';
        
        try {
          const response = await fetch('/api/close-all-positions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          const result = await response.json();
          
          if (result.success) {
            status.textContent = result.message;
            status.style.color = '#10dc60';
            // Refresh data after a short delay
            setTimeout(() => {
              // The WebSocket will update the UI automatically
            }, 1000);
          } else {
            status.textContent = 'Error: ' + result.message;
            status.style.color = '#f04141';
          }
        } catch (error) {
          status.textContent = 'Network error';
          status.style.color = '#f04141';
        } finally {
          btn.disabled = false;
          btn.textContent = '🚨 Close All Positions';
        }
      }
    });
  </script>
</body>
</html>`;
}
