# Local AI Setup Guide

The AI Trading Operating System now supports using a **local AI server** instead of cloud APIs. This means:
- ✅ **No API keys needed** (free!)
- ✅ **Complete privacy** (data stays on your machine)
- ✅ **Faster responses** (no internet latency)
- ✅ **No usage limits** (unlimited trading decisions)

## Prerequisites

You need a local AI server running on your machine. The system is designed to work with the DeepSeek-compatible API format.

## Configuration

### 1. Update `.env` file

Set `AI_PROVIDER` to `local` and configure the connection:

```env
# AI Model Configuration
AI_PROVIDER=local  # Use local AI server

# Local AI Server Settings
LOCAL_AI_URL=http://localhost:5000
LOCAL_AI_EMAIL=your_email@example.com
LOCAL_AI_PASSWORD=your_password
```

### 2. Start Your Local AI Server

Before running the trading system, make sure your local AI server is running:

```bash
# Example: Start your Python AI server
cd G:\free_ai
python app.py
```

The server should be accessible at `http://localhost:5000` with the following endpoints:
- `POST /api/chat/login` - Initialize session (optional)
- `POST /api/chat/send` - Send message and get AI response
- `POST /api/chat/close` - Close session (optional)

### 3. Start Trading System

```powershell
npm start
```

The system will:
1. Connect to your local AI server at `http://localhost:5000`
2. Attempt to login (if credentials are provided)
3. Send trading analysis prompts via `/api/chat/send`
4. Parse AI responses into trading decisions

## API Format

Your local AI server should accept this request format:

```json
POST /api/chat/send
{
  "platform": "deepseek",
  "message": "Trading analysis prompt...",
  "session_id": "trading_ai_1234567890"
}
```

And return this response format:

```json
{
  "message": "Original prompt",
  "response": "AI response with Chain of Thought reasoning and JSON decisions..."
}
```

## Expected AI Response Format

The AI should respond with:
1. **Chain of Thought reasoning** (2-3 paragraphs of analysis)
2. **JSON array** of trading decisions

Example:
```
Based on the market analysis, I observe strong bullish momentum in BTCUSDT...
The historical performance shows a 70% win rate, which gives me confidence...

[
  {
    "action": "open_long",
    "symbol": "BTCUSDT",
    "quantity": 0.01,
    "leverage": 10,
    "stopLoss": 42000,
    "takeProfit": 46000,
    "reasoning": "Strong uptrend with RSI confirmation",
    "confidence": 0.85
  }
]
```

## Switching Back to Cloud AI

To switch back to DeepSeek or Qwen cloud APIs:

```env
AI_PROVIDER=deepseek  # or qwen

# Add your API keys
DEEPSEEK_API_KEY=your_api_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

## Troubleshooting

### Connection Failed
```
Error: connect ECONNREFUSED 127.0.0.1:5000
```
**Solution:** Make sure your local AI server is running on port 5000.

### Invalid Response
```
Error: Local AI did not return a valid response
```
**Solution:** Check that your AI server returns JSON with a `response` field.

### AI Timeout
```
Error: timeout of 60000ms exceeded
```
**Solution:** Your AI is taking too long. Consider:
- Using a faster AI model
- Reducing the prompt length
- Increasing timeout in `AIService.ts`

## Benefits of Local AI

| Feature | Cloud AI | Local AI |
|---------|----------|----------|
| Cost | $0.14-0.50 per 1M tokens | **Free** |
| Privacy | Data sent to cloud | **Data stays local** |
| Speed | 500ms-2s per request | **100-500ms** |
| Limits | API rate limits | **Unlimited** |
| Internet | Required | **Works offline** |
| Setup | Just API key | Requires local server |

## Recommended Local AI Models

For trading decisions, we recommend:
- **DeepSeek-R1** (best reasoning)
- **Qwen2.5** (fast and accurate)
- **Llama 3.1 70B** (good balance)
- **Mixtral 8x7B** (fast inference)

All models should be run via your local server at `http://localhost:5000`.

## Notes

- The system will automatically try to login to your AI server (login may be optional)
- Sessions are automatically closed when the trading system shuts down
- The AI prompt includes full market analysis, historical performance, and technical indicators
- Responses are cached in decision logs for review

## Support

If you encounter issues with local AI integration, check:
1. Is your AI server running? (`curl http://localhost:5000/health`)
2. Does it support the required API format?
3. Is the AI model loaded and ready?
4. Check logs in `data/decisions/` for detailed error messages
