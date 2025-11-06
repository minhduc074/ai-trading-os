import { AccountInfo, Position, TradingConfig, RiskCheckResult, PositionLimit } from '../types';

/**
 * Risk Management System
 * Enforces position limits, leverage controls, and margin management
 */
export class RiskManager {
  private config: TradingConfig;

  constructor(config: TradingConfig) {
    this.config = config;
  }

  /**
   * Check if a new position is allowed based on risk rules
   */
  async checkNewPosition(
    symbol: string,
    side: 'LONG' | 'SHORT',
    quantity: number,
    leverage: number,
    price: number,
    accountInfo: AccountInfo
  ): Promise<RiskCheckResult> {
    // Calculate position value
    const positionValue = quantity * price;
    const totalExposure = positionValue * leverage;

    // Check 1: Prevent duplicate positions (anti-stacking)
    const hasDuplicatePosition = accountInfo.positions.some(
      p => p.symbol === symbol && p.side === side
    );

    if (hasDuplicatePosition) {
      return {
        allowed: false,
        reason: `Already have a ${side} position on ${symbol}. Anti-stacking protection.`,
      };
    }

    // Check 2: Leverage limits
    const isMajorCoin = this.isMajorCoin(symbol);
    const maxAllowedLeverage = isMajorCoin 
      ? this.config.maxLeverageMajor 
      : this.config.maxLeverageAltcoin;

    if (leverage > maxAllowedLeverage) {
      return {
        allowed: false,
        reason: `Leverage ${leverage}x exceeds maximum ${maxAllowedLeverage}x for ${isMajorCoin ? 'major' : 'altcoin'}`,
        adjustedLeverage: maxAllowedLeverage,
      };
    }

    // Check 3: Position size limits
    const maxPositionMultiplier = isMajorCoin
      ? this.config.maxPositionSizeMajorMultiplier
      : this.config.maxPositionSizeAltcoinMultiplier;
    
    const maxPositionValue = accountInfo.totalEquity * maxPositionMultiplier;

    if (positionValue > maxPositionValue) {
      const adjustedQuantity = maxPositionValue / price;
      return {
        allowed: false,
        reason: `Position value $${positionValue.toFixed(2)} exceeds maximum $${maxPositionValue.toFixed(2)} (${maxPositionMultiplier}x equity)`,
        adjustedQuantity,
      };
    }

    // Check 4: Maximum positions limit
    if (accountInfo.totalPositions >= this.config.maxPositions) {
      return {
        allowed: false,
        reason: `Already at maximum positions limit (${this.config.maxPositions})`,
      };
    }

    // Check 5: Margin usage
    const requiredMargin = positionValue; // For cross margin
    const projectedMarginUsage = (accountInfo.totalMarginUsed + requiredMargin) / accountInfo.totalEquity;

    if (projectedMarginUsage > this.config.maxMarginUsage) {
      const maxMarginValue = this.config.maxMarginUsage * accountInfo.totalEquity;
      const availableMargin = Math.max(0, maxMarginValue - accountInfo.totalMarginUsed);
      const thirtyPercentQuantity = quantity * 0.3;
      const marginLimitedQuantity = availableMargin > 0 ? availableMargin / price : 0;
      const fallbackQuantity = Math.min(thirtyPercentQuantity, marginLimitedQuantity);

      const baseReason = `Projected margin usage ${(projectedMarginUsage * 100).toFixed(1)}% exceeds maximum ${(this.config.maxMarginUsage * 100).toFixed(1)}%`;

      const result: RiskCheckResult = {
        allowed: false,
        reason: baseReason,
      };

      if (fallbackQuantity > 0 && fallbackQuantity < quantity) {
        result.adjustedQuantity = fallbackQuantity;
        result.reason = `${baseReason}. Suggested fallback quantity: ${fallbackQuantity.toFixed(6)}`;
      }

      return result;
    }

    // Check 6: Available balance
    if (requiredMargin > accountInfo.availableBalance) {
      return {
        allowed: false,
        reason: `Insufficient balance. Required: $${requiredMargin.toFixed(2)}, Available: $${accountInfo.availableBalance.toFixed(2)}`,
      };
    }

    // All checks passed
    return {
      allowed: true,
    };
  }

  /**
   * Check if position close is allowed
   */
  async checkClosePosition(
    symbol: string,
    side: 'LONG' | 'SHORT',
    accountInfo: AccountInfo
  ): Promise<RiskCheckResult> {
    const hasPosition = accountInfo.positions.some(
      p => p.symbol === symbol && p.side === side
    );

    if (!hasPosition) {
      return {
        allowed: false,
        reason: `No ${side} position found for ${symbol}`,
      };
    }

    return {
      allowed: true,
    };
  }

  /**
   * Validate stop-loss and take-profit levels
   */
  validateStopLossTakeProfit(
    side: 'LONG' | 'SHORT',
    entryPrice: number,
    stopLoss?: number,
    takeProfit?: number
  ): { valid: boolean; reason?: string } {
    if (!stopLoss && !takeProfit) {
      return { valid: true };
    }

    // Validate stop-loss
    if (stopLoss) {
      if (side === 'LONG' && stopLoss >= entryPrice) {
        return {
          valid: false,
          reason: 'Stop-loss must be below entry price for LONG positions',
        };
      }
      if (side === 'SHORT' && stopLoss <= entryPrice) {
        return {
          valid: false,
          reason: 'Stop-loss must be above entry price for SHORT positions',
        };
      }
    }

    // Validate take-profit
    if (takeProfit) {
      if (side === 'LONG' && takeProfit <= entryPrice) {
        return {
          valid: false,
          reason: 'Take-profit must be above entry price for LONG positions',
        };
      }
      if (side === 'SHORT' && takeProfit >= entryPrice) {
        return {
          valid: false,
          reason: 'Take-profit must be below entry price for SHORT positions',
        };
      }
    }

    // Check risk-reward ratio if both are provided
    if (stopLoss && takeProfit) {
      const risk = Math.abs(entryPrice - stopLoss) / entryPrice;
      const reward = Math.abs(takeProfit - entryPrice) / entryPrice;
      const riskRewardRatio = reward / risk;

      if (riskRewardRatio < this.config.minRiskRewardRatio) {
        return {
          valid: false,
          reason: `Risk-reward ratio ${riskRewardRatio.toFixed(2)} is below minimum ${this.config.minRiskRewardRatio}`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Calculate position limits for a symbol
   */
  getPositionLimit(symbol: string, accountInfo: AccountInfo): PositionLimit {
    const isMajorCoin = this.isMajorCoin(symbol);
    const maxLeverage = isMajorCoin 
      ? this.config.maxLeverageMajor 
      : this.config.maxLeverageAltcoin;
    
    const maxPositionMultiplier = isMajorCoin
      ? this.config.maxPositionSizeMajorMultiplier
      : this.config.maxPositionSizeAltcoinMultiplier;
    
    const maxPositionValue = accountInfo.totalEquity * maxPositionMultiplier;
    
    // Calculate current exposure for this symbol
    const currentPosition = accountInfo.positions.find(p => p.symbol === symbol);
    const currentExposure = currentPosition 
      ? currentPosition.quantity * currentPosition.currentPrice * currentPosition.leverage
      : 0;
    
    const availableRoom = maxPositionValue - currentExposure;

    return {
      maxPositionValue,
      maxLeverage,
      currentExposure,
      availableRoom: Math.max(0, availableRoom),
    };
  }

  /**
   * Check if symbol is a major coin (BTC, ETH)
   */
  private isMajorCoin(symbol: string): boolean {
    const majorCoins = ['BTCUSDT', 'ETHUSDT', 'BTCUSD', 'ETHUSD'];
    return majorCoins.includes(symbol.toUpperCase());
  }

  /**
   * Calculate recommended position size based on risk management
   */
  calculateRecommendedPositionSize(
    symbol: string,
    price: number,
    leverage: number,
    accountInfo: AccountInfo,
    riskPercentage: number = 2.0 // Risk 2% of equity per trade
  ): number {
    const positionLimit = this.getPositionLimit(symbol, accountInfo);
    
    // Calculate position size based on risk percentage
    const riskAmount = accountInfo.totalEquity * (riskPercentage / 100);
    const positionValue = riskAmount * leverage;
    
    // Cap at position limit
    const cappedValue = Math.min(positionValue, positionLimit.availableRoom);
    
    // Convert to quantity
    const quantity = cappedValue / price;
    
    return quantity;
  }

  /**
   * Get risk assessment summary
   */
  getRiskSummary(accountInfo: AccountInfo): string {
    const marginUsagePercent = accountInfo.marginUsagePercent * 100;
    const positionsUsage = (accountInfo.totalPositions / this.config.maxPositions) * 100;
    
    let riskLevel = 'LOW';
    if (marginUsagePercent > 70 || positionsUsage > 80) {
      riskLevel = 'HIGH';
    } else if (marginUsagePercent > 50 || positionsUsage > 60) {
      riskLevel = 'MEDIUM';
    }

    return `Risk Level: ${riskLevel} | Margin: ${marginUsagePercent.toFixed(1)}%/${(this.config.maxMarginUsage * 100).toFixed(1)}% | Positions: ${accountInfo.totalPositions}/${this.config.maxPositions}`;
  }
}
