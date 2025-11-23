export default function handler(req, res) {
  // Example status payload — replace with calls to your real status store
  const sample = {
    isRunning: false,
    traderId: 'trader_testnet_12345',
    cycleNumber: 0,
    timestamp: Date.now(),
    accountInfo: {
      totalEquity: 0,
      availableBalance: 0,
      totalUnrealizedPnl: 0,
      totalPositions: 0,
      positions: []
    }
  };

  console.log('api/status called — returning sample payload');
  res.status(200).json({ success: true, ...sample });
}
