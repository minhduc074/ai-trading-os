import { AIDecisionEngine } from '../AIService_v2';
import { MarketData } from '../../types';

describe('AIDecisionEngine.parseAIResponse (via any)', () => {
  const engine = new AIDecisionEngine({ provider: 'qwen', apiKey: 'dummy-key' });

  const marketData: MarketData[] = [
    {
      symbol: 'BTCUSDT',
      currentPrice: 61250,
      priceChange24h: 0,
      priceChangePercent24h: 0,
      volume24h: 5000000,
      indicators3m: {
        rsi7: 58,
        macd: 15,
        macdSignal: 10,
        macdHistogram: 5,
        ema20: 61100,
        volume: 1000,
        priceSequence: [61000, 61100, 61200, 61180],
        volumeSequence: [800, 950, 1100, 1000],
      },
      indicators4h: {
        rsi14: 58,
        ema20: 61000,
        ema50: 60900,
        atr: 20,
        trend: 'bullish',
        priceSequence: [60000, 60500, 61000, 61200],
      },
      timestamp: Date.now(),
    },
  ];

  test('empty JSON array -> no decisions', () => {
    const res = (engine as any).parseAIResponse('[]', marketData);
    expect(res.decisions).toHaveLength(0);
  });

  test('no_trade action -> no decisions', () => {
    const aiResp = '```json\n[ { "action": "no_trade", "symbol": "BTCUSDT" } ]\n```';
    const res = (engine as any).parseAIResponse(aiResp, marketData);
    expect(res.decisions).toHaveLength(0);
  });

  test('open_long with sufficient confidence -> one decision with computed risk', () => {
    const aiResp = '```json\n[ { "action": "open_long", "symbol": "BTCUSDT", "position_size_usd": 1000, "profit_target": 61500, "stop_loss": 60800, "confidence": 75 } ]\n```';
    const res = (engine as any).parseAIResponse(aiResp, marketData);
    expect(res.decisions).toHaveLength(1);
    const d = res.decisions[0];
    expect(d.action).toBe('open_long');
    expect(d.confidence).toBe(75);
    expect(d.risk_usd).toBeGreaterThan(0);
  });

  test('open_long with low confidence -> no decisions', () => {
    const aiResp = '```json\n[ { "action": "open_long", "symbol": "BTCUSDT", "position_size_usd": 1000, "profit_target": 61500, "stop_loss": 60800, "confidence": 60 } ]\n```';
    const res = (engine as any).parseAIResponse(aiResp, marketData);
    expect(res.decisions).toHaveLength(0);
  });

  test('multiple decisions array -> uses the first decision only', () => {
    const aiResp = '```json\n[ { "action": "open_long", "symbol": "BTCUSDT", "position_size_usd": 1000, "profit_target": 61500, "stop_loss": 60800, "confidence": 75 }, { "action": "open_short", "symbol": "BTCUSDT", "position_size_usd": 1200, "profit_target": 60500, "stop_loss": 61000, "confidence": 90 } ]\n```';
    const res = (engine as any).parseAIResponse(aiResp, marketData);
    expect(res.decisions).toHaveLength(1);
    const d = res.decisions[0];
    expect(d.action).toBe('open_long');
    expect(d.confidence).toBe(75);
  });

  test('raw JSON (no code block) -> parses correctly', () => {
    const aiResp = '[{ "action": "open_long", "symbol": "BTCUSDT", "position_size_usd": 2000, "profit_target": 62000, "stop_loss": 61000, "confidence": 80 }]';
    const res = (engine as any).parseAIResponse(aiResp, marketData);
    expect(res.decisions).toHaveLength(1);
    const d = res.decisions[0];
    expect(d.action).toBe('open_long');
    expect(d.confidence).toBe(80);
  });

  test('confidence as string with percent ("75%") -> parse and accept', () => {
    const aiResp = '```json\n[ { "action": "open_long", "symbol": "BTCUSDT", "position_size_usd": 500, "profit_target": 61500, "stop_loss": 60800, "confidence": "75%" } ]\n```';
    const res = (engine as any).parseAIResponse(aiResp, marketData);
    expect(res.decisions).toHaveLength(1);
    const d = res.decisions[0];
    expect(d.action).toBe('open_long');
    expect(d.confidence).toBe(75);
  });

  test('trailing commas in JSON are sanitized -> parses correctly', () => {
    const aiResp = '```json\n[ { "action": "open_long", "symbol": "BTCUSDT", "position_size_usd": 1000, "profit_target": 61500, "stop_loss": 60800, "confidence": 75, } ]\n```';
    const res = (engine as any).parseAIResponse(aiResp, marketData);
    expect(res.decisions).toHaveLength(1);
    const d = res.decisions[0];
    expect(d.action).toBe('open_long');
    expect(d.risk_usd).toBeGreaterThan(0);
  });

  test('chain of thought is extracted from text before JSON block', () => {
    const aiResp = 'Market analysis: Bullish setup on BTC.\n```json\n[ { "action": "open_long", "symbol": "BTCUSDT", "position_size_usd": 500, "profit_target": 61500, "stop_loss": 60800, "confidence": 75 } ]\n```';
    const res = (engine as any).parseAIResponse(aiResp, marketData);
    expect(res.decisions).toHaveLength(1);
    expect(res.chainOfThought).toContain('Market analysis: Bullish setup on BTC');
  });
});
