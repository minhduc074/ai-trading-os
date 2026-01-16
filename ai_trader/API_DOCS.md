# API Documentation

## Base URL

```
http://localhost:3000/api
```

## Trading Endpoints

### 1. Get Account Status

**Endpoint:** `GET /trading/account`

**Description:** Retrieve current account balance, margin usage, and P&L information.

**Response:**
```json
{
  "totalBalance": 1050.25,
  "availableBalance": 945.50,
  "totalMarginUsed": 104.75,
  "marginUsagePercent": 9.98,
  "unrealizedPnL": 50.25,
  "dailyPnL": 25.00,
  "positionCount": 2
}
```

**Fields:**
- `totalBalance` (number): Total account balance in USDT
- `availableBalance` (number): Available balance for new positions
- `totalMarginUsed` (number): Margin used for open positions
- `marginUsagePercent` (number): Percentage of balance used for margin
- `unrealizedPnL` (number): Current unrealized profit/loss
- `dailyPnL` (number): Today's profit/loss
- `positionCount` (number): Number of open positions

---

### 2. Get Open Positions

**Endpoint:** `GET /trading/positions`

**Description:** Retrieve all currently open positions.

**Response:**
```json
[
  {
    "symbol": "BTCUSDT",
    "side": "LONG",
    "quantity": 0.01,
    "leverage": 5,
    "entryPrice": 42500.00,
    "currentPrice": 43200.00,
    "unrealizedPnL": 35.00,
    "unrealizedPnLPercent": 1.64,
    "openTime": "2024-01-17T10:30:00Z",
    "stopLoss": 40000.00,
    "takeProfit": 45000.00
  }
]
```

**Field Descriptions:**
- `symbol` (string): Trading pair (e.g., BTCUSDT)
- `side` (string): "LONG" or "SHORT"
- `quantity` (number): Position size in base asset
- `leverage` (number): Trading leverage (1-50x)
- `entryPrice` (number): Entry price in USDT
- `currentPrice` (number): Current market price
- `unrealizedPnL` (number): Current P&L in USDT
- `unrealizedPnLPercent` (number): Current P&L percentage
- `openTime` (ISO string): When position was opened
- `stopLoss` (number): Stop-loss price
- `takeProfit` (number): Take-profit price

---

### 3. Get Trade History

**Endpoint:** `GET /trading/trades`

**Description:** Retrieve recent closed trades.

**Response:**
```json
[
  {
    "id": "ETHUSDT-1705485000000",
    "symbol": "ETHUSDT",
    "side": "LONG",
    "quantity": 0.1,
    "leverage": 3,
    "entryPrice": 2200.00,
    "exitPrice": 2250.00,
    "pnl": 15.00,
    "pnlPercent": 2.27,
    "openTime": "2024-01-17T09:30:00Z",
    "closeTime": "2024-01-17T10:15:00Z",
    "duration": 45
  }
]
```

**Field Descriptions:**
- `id` (string): Unique trade identifier
- `symbol` (string): Trading pair
- `side` (string): "LONG" or "SHORT"
- `quantity` (number): Position size
- `leverage` (number): Leverage used
- `entryPrice` (number): Entry price in USDT
- `exitPrice` (number): Exit price in USDT
- `pnl` (number): Profit/loss in USDT
- `pnlPercent` (number): P&L percentage
- `openTime` (ISO string): Trade open time
- `closeTime` (ISO string): Trade close time
- `duration` (number): Trade duration in minutes

---

### 4. Get AI Decision

**Endpoint:** `POST /trading/decision`

**Description:** Get AI trading decision based on current market and account status.

**Request:**
```bash
curl -X POST http://localhost:3000/api/trading/decision
```

**Response:**
```json
{
  "action": "OPEN_LONG",
  "symbol": "SOLUSDT",
  "quantity": 0.5,
  "leverage": 10,
  "stopLoss": 98.50,
  "takeProfit": 115.00,
  "reasoning": "SOL showing strong momentum with RSI14=72 and volume surge. EMA20 above EMA50 on 4h. Risk-reward favorable at 1:2.65",
  "confidence": 0.85,
  "chainOfThought": "Full reasoning chain from AI model..."
}
```

**Field Descriptions:**
- `action` (string): Trading action (HOLD, OPEN_LONG, OPEN_SHORT, CLOSE_LONG, CLOSE_SHORT, WAIT)
- `symbol` (string): Target trading pair (optional if HOLD/WAIT)
- `quantity` (number): Suggested position size
- `leverage` (number): Suggested leverage
- `stopLoss` (number): Stop-loss price
- `takeProfit` (number): Take-profit price
- `reasoning` (string): Human-readable decision explanation
- `confidence` (number): Confidence level (0-1)
- `chainOfThought` (string): Full AI reasoning process

---

### 5. Execute Decision

**Endpoint:** `POST /trading/execute`

**Description:** Execute a trading decision.

**Request:**
```bash
curl -X POST http://localhost:3000/api/trading/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": "OPEN_LONG",
    "symbol": "SOLUSDT",
    "quantity": 0.5,
    "leverage": 10,
    "stopLoss": 98.50,
    "takeProfit": 115.00,
    "reasoning": "...",
    "confidence": 0.85,
    "chainOfThought": "..."
  }'
```

**Response (Success):**
```json
{
  "success": true
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Insufficient balance for position size"
}
```

---

## Decision Actions

### HOLD
- Do nothing, monitor current positions
- No new trades or position closures

### WAIT
- Uncertain market conditions
- Wait for clearer signals

### OPEN_LONG
- Open a new long (buy) position
- Requires: symbol, quantity, leverage, stopLoss, takeProfit

### OPEN_SHORT
- Open a new short (sell) position
- Requires: symbol, quantity, leverage, stopLoss, takeProfit

### CLOSE_LONG
- Close an existing long position
- Requires: symbol

### CLOSE_SHORT
- Close an existing short position
- Requires: symbol

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Invalid request parameters"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Connection to Binance failed"
}
```

---

## Examples

### Example 1: Get Account Status

```bash
curl http://localhost:3000/api/trading/account
```

### Example 2: Get Open Positions

```bash
curl http://localhost:3000/api/trading/positions
```

### Example 3: Execute Decision

```bash
curl -X POST http://localhost:3000/api/trading/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": "OPEN_LONG",
    "symbol": "BTCUSDT",
    "quantity": 0.01,
    "leverage": 5,
    "stopLoss": 40000,
    "takeProfit": 45000,
    "reasoning": "Strong uptrend",
    "confidence": 0.8,
    "chainOfThought": "Analysis shows..."
  }'
```

---

## Rate Limits

- Binance API: 1200 requests per minute
- Dashboard updates: Every 5 seconds
- Trading decision interval: Every 1 hour (configurable)

---

## Data Types

### ISO 8601 Timestamp
```
"2024-01-17T10:30:45.123Z"
```

### Numbers
- Prices, quantities, and percentages are floating-point numbers
- Precision varies by exchange (e.g., 8 decimals for BTC)

### Strings
- All text fields are UTF-8 encoded
- Symbol names follow Binance convention (XXXXUSDT)

---

## Implementation Notes

1. **Idempotency**: All endpoints are idempotent - safe to call multiple times
2. **Timestamps**: All times are in UTC (Zulu time)
3. **Decimal Precision**: Use proper decimal handling for financial calculations
4. **Error Handling**: Always check `success` field before using response data

---

## Testing with cURL

```bash
# Test endpoint availability
curl http://localhost:3000/api/trading/account

# Execute decision
curl -X POST http://localhost:3000/api/trading/execute \
  -H "Content-Type: application/json" \
  -d '{"action":"HOLD","reasoning":"Testing","confidence":0.5,"chainOfThought":"Test"}'
```

---

## Integration Guide

### JavaScript/TypeScript

```typescript
// Fetch account status
const response = await fetch('/api/trading/account');
const account = await response.json();
console.log(account.totalBalance);

// Execute decision
const decision = {
  action: 'OPEN_LONG',
  symbol: 'BTCUSDT',
  quantity: 0.01,
  leverage: 5,
  stopLoss: 40000,
  takeProfit: 45000,
  reasoning: 'Strong signal',
  confidence: 0.8,
  chainOfThought: 'Analysis...',
};

const result = await fetch('/api/trading/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(decision),
});

const executed = await result.json();
console.log(executed.success);
```

---

For more information, see [README.md](README.md) and [SETUP_GUIDE.md](SETUP_GUIDE.md).
