// Market Data Service - Standalone Version
// Fetches market data from Binance Futures API

class MarketDataService {
  constructor() {
    this.baseURL = 'https://fapi.binance.com';
  }

  // Helper: Calculate RSI
  calculateRSI(prices, period) {
    if (prices.length < period + 1) return 50;
    
    const changes = prices.slice(1).map((price, i) => price - prices[i]);
    const gains = changes.map(change => change > 0 ? change : 0);
    const losses = changes.map(change => change < 0 ? -change : 0);
    
    const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  // Helper: Calculate EMA
  calculateEMA(prices, period) {
    if (prices.length < period) return prices[prices.length - 1];
    
    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    
    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }

  // Helper: Calculate MACD
  calculateMACD(prices) {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macd = ema12 - ema26;
    
    // Calculate signal line (9-day EMA of MACD)
    const macdLine = [];
    for (let i = 26; i <= prices.length; i++) {
      const slice = prices.slice(0, i);
      const e12 = this.calculateEMA(slice, 12);
      const e26 = this.calculateEMA(slice, 26);
      macdLine.push(e12 - e26);
    }
    
    const signal = macdLine.length >= 9 ? this.calculateEMA(macdLine, 9) : macd;
    const histogram = macd - signal;
    
    return { macd, signal, histogram };
  }

  // Helper: Calculate ATR
  calculateATR(highs, lows, closes, period = 14) {
    if (highs.length < period + 1) return 0;
    
    const trueRanges = [];
    for (let i = 1; i < highs.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trueRanges.push(tr);
    }
    
    return trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period;
  }

  async getMarketData(symbols) {
    try {
      const data = [];

      for (const symbol of symbols) {
        const marketData = await this.fetchSymbolData(symbol);
        if (marketData) {
          data.push(marketData);
        }
      }

      return data;
    } catch (error) {
      console.error('Market data fetch error:', error);
      return [];
    }
  }

  async fetchSymbolData(symbol) {
    try {
      // Fetch ticker data
      const tickerResponse = await fetch(`${this.baseURL}/fapi/v1/ticker/24hr?symbol=${symbol}`);
      if (!tickerResponse.ok) {
        const errorText = await tickerResponse.text();
        console.error(`[${symbol}] Ticker API error ${tickerResponse.status}: ${errorText}`);
        throw new Error(`Ticker API error: ${tickerResponse.status}`);
      }
      const ticker = await tickerResponse.json();
      if (ticker.code) {
        console.error(`[${symbol}] Binance error code ${ticker.code}: ${ticker.msg}`);
        throw new Error(`Ticker error: ${ticker.msg}`);
      }

      // Fetch funding rate
      const fundingResponse = await fetch(`${this.baseURL}/fapi/v1/fundingRate?symbol=${symbol}&limit=1`);
      const fundingData = await fundingResponse.json();
      const fundingArray = Array.isArray(fundingData) ? fundingData : [];

      // Fetch open interest
      const oiResponse = await fetch(`${this.baseURL}/fapi/v1/openInterest?symbol=${symbol}`);
      const oiData = await oiResponse.json();

      // Fetch K-line data for technical indicators
      // 1h candles for RSI and short-term indicators (last 100 candles)
      const klines1hResponse = await fetch(`${this.baseURL}/fapi/v1/klines?symbol=${symbol}&interval=1h&limit=100`);
      if (!klines1hResponse.ok) {
        const errorText = await klines1hResponse.text();
        console.error(`[${symbol}] 1h klines API error ${klines1hResponse.status}: ${errorText}`);
        return null;
      }
      const klines1hData = await klines1hResponse.json();
      
      if (!Array.isArray(klines1hData)) {
        console.error(`[${symbol}] Invalid 1h klines response:`, JSON.stringify(klines1hData).substring(0, 200));
        return null;
      }
      
      const klines1h = klines1hData;
      if (klines1h.length === 0) {
        console.warn(`[${symbol}] No 1h klines data returned`);
        return null;
      }
      
      // 4h candles for EMA50 (last 100 candles)
      const klines4hResponse = await fetch(`${this.baseURL}/fapi/v1/klines?symbol=${symbol}&interval=4h&limit=100`);
      if (!klines4hResponse.ok) {
        const errorText = await klines4hResponse.text();
        console.error(`[${symbol}] 4h klines API error ${klines4hResponse.status}: ${errorText}`);
        return null;
      }
      const klines4hData = await klines4hResponse.json();
      
      if (!Array.isArray(klines4hData)) {
        console.error(`[${symbol}] Invalid 4h klines response:`, JSON.stringify(klines4hData).substring(0, 200));
        return null;
      }
      
      const klines4h = klines4hData;
      if (klines4h.length === 0) {
        console.warn(`[${symbol}] No 4h klines data returned`);
        return null;
      }

      // Extract price data from K-lines
      const closes1h = klines1h.map(k => parseFloat(k[4])); // Close prices
      const highs1h = klines1h.map(k => parseFloat(k[2])); // High prices
      const lows1h = klines1h.map(k => parseFloat(k[3])); // Low prices
      const closes4h = klines4h.map(k => parseFloat(k[4]));

      // Calculate real technical indicators
      const rsi7 = this.calculateRSI(closes1h, 7);
      const rsi14 = this.calculateRSI(closes1h, 14);
      const ema20_3m = this.calculateEMA(closes1h, 20);
      const ema50_4h = this.calculateEMA(closes4h, 50);
      const macdData = this.calculateMACD(closes1h);
      const atr = this.calculateATR(highs1h, lows1h, closes1h, 14);

      return {
        symbol,
        currentPrice: parseFloat(ticker.lastPrice),
        priceChange24h: parseFloat(ticker.priceChangePercent),
        volume24h: parseFloat(ticker.quoteAssetVolume),
        highPrice24h: parseFloat(ticker.highPrice),
        lowPrice24h: parseFloat(ticker.lowPrice),
        openInterest: parseFloat(oiData.openInterest || '0'),
        liquidityUSD: parseFloat(oiData.openInterest || '0') * parseFloat(ticker.lastPrice),
        fundingRate: fundingArray[0] ? parseFloat(fundingArray[0].fundingRate) : 0,
        rsi7,
        rsi14,
        ema20_3m,
        ema50_4h,
        macd: macdData.macd,
        histogram: macdData.histogram,
        atr,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Error fetching data for ${symbol}: ${errorMsg}`);
      return null;
    }
  }

  getDefaultCoinPool() {
    // Top major coins
    return [
      'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 
      'ADAUSDT', 'DOGEUSDT', 'MATICUSDT', 'LINKUSDT', 'AVAXUSDT',
      'DOTUSDT', 'LTCUSDT', 'BCHUSDT', 'UNIUSDT', 'ATOMUSDT',
      'XLMUSDT', 'NEARUSDT', 'APTUSDT', 'ARBUSDT', 'OPUSDT',
      'TRXUSDT', 'ICPUSDT', 'WLDUSDT', 'RNDRUSDT'
    ];
  }

  getTopCoins() {
    return [
      'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
      'ADAUSDT', 'DOGEUSDT', 'MATICUSDT', 'LTCUSDT', 'BCHUSDT',
      'LINKUSDT', 'UNIUSDT', 'XLMUSDT', 'DOTUSDT', 'TRXUSDT',
      'ATOMUSDT', 'FILUSDT', 'ETCUSDT', 'NEARUSDT', 'FTMUSDT',
      'AVAXUSDT', 'ICPUSDT', 'APTUSDT', 'ARBUSDT', 'OPUSDT',
      'SUIUSDT', 'INJUSDT', 'WLDUSDT', 'SEIUSDT', 'TIAUSDT',
    ];
  }
}

module.exports = { MarketDataService };
