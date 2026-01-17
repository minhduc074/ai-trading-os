// Trading types (JavaScript version)
// These are for documentation purposes - actual types are enforced via JSDoc

/**
 * @typedef {Object} Position
 * @property {string} symbol
 * @property {'LONG'|'SHORT'} side
 * @property {number} quantity
 * @property {number} leverage
 * @property {number} entryPrice
 * @property {number} currentPrice
 * @property {number} unrealizedPnL
 * @property {number} unrealizedPnLPercent
 * @property {Date} openTime
 * @property {number} stopLoss
 * @property {number} takeProfit
 */

/**
 * @typedef {Object} Trade
 * @property {string} id
 * @property {string} symbol
 * @property {'LONG'|'SHORT'} side
 * @property {number} quantity
 * @property {number} leverage
 * @property {number} entryPrice
 * @property {number} exitPrice
 * @property {number} pnl
 * @property {number} pnlPercent
 * @property {Date} openTime
 * @property {Date} closeTime
 * @property {number} duration
 */

/**
 * @typedef {Object} AccountStatus
 * @property {number} totalBalance
 * @property {number} availableBalance
 * @property {number} totalMarginUsed
 * @property {number} marginUsagePercent
 * @property {number} unrealizedPnL
 * @property {number} dailyPnL
 * @property {number} positionCount
 */

/**
 * @typedef {Object} MarketData
 * @property {string} symbol
 * @property {number} currentPrice
 * @property {number} priceChange24h
 * @property {number} volume24h
 * @property {number} highPrice24h
 * @property {number} lowPrice24h
 * @property {number} openInterest
 * @property {number} liquidityUSD
 * @property {number} fundingRate
 * @property {number} rsi7
 * @property {number} rsi14
 * @property {number} ema20_3m
 * @property {number} ema50_4h
 * @property {number} macd
 * @property {number} histogram
 * @property {number} atr
 */

/**
 * @typedef {Object} AIDecisionItem
 * @property {'CLOSE_LONG'|'CLOSE_SHORT'|'OPEN_LONG'|'OPEN_SHORT'} action
 * @property {string} symbol
 * @property {number} [quantity]
 * @property {number} [leverage]
 * @property {number} [stopLoss]
 * @property {number} [takeProfit]
 * @property {string} reasoning
 * @property {number} confidence
 * @property {number} [priority]
 */

/**
 * @typedef {Object} AIDecision
 * @property {'HOLD'|'CLOSE_LONG'|'CLOSE_SHORT'|'OPEN_LONG'|'OPEN_SHORT'|'WAIT'|'MULTIPLE'} action
 * @property {string} [symbol]
 * @property {number} [quantity]
 * @property {number} [leverage]
 * @property {number} [stopLoss]
 * @property {number} [takeProfit]
 * @property {string} reasoning
 * @property {number} confidence
 * @property {string} chainOfThought
 * @property {string} [aiAgent]
 * @property {AIDecisionItem[]} [decisions]
 */

/**
 * @typedef {Object} PerformanceMetrics
 * @property {number} totalTrades
 * @property {number} winRate
 * @property {number} profitFactor
 * @property {number} averageProfitUSDT
 * @property {number} sharpeRatio
 * @property {number} maxDrawdown
 * @property {string[]} bestPerformingAssets
 * @property {string[]} worstPerformingAssets
 */

module.exports = {};
