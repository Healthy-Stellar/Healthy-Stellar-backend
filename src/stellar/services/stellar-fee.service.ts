import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout, catchError } from 'rxjs';
import { AxiosError } from 'axios';
import { StellarCacheService } from './stellar-cache.service';
import {
  FeeEstimateResponse,
  HorizonFeeStatsResponse,
  StellarOperation,
} from '../interfaces/fee-estimate.interface';

/**
 * Stellar Fee Service
 * 
 * Provides fee estimation for Stellar network operations by querying
 * the Horizon API and calculating recommended fees based on network
 * congestion and operation type.
 * 
 * Features:
 * - Fetches real-time fee stats from Horizon
 * - Calculates recommended fees based on network congestion
 * - Caches results for 30 seconds to avoid API hammering
 * - Handles Horizon unavailability gracefully
 * - Supports multiple operation types with different fee multipliers
 */
@Injectable()
export class StellarFeeService {
  private readonly logger = new Logger(StellarFeeService.name);
  private readonly horizonUrl: string;
  private readonly REQUEST_TIMEOUT_MS = 8000;

  // Operation-specific fee multipliers
  private readonly OPERATION_MULTIPLIERS = {
    'anchorRecord': 1.5, // Higher priority for medical records
    'grantAccess': 1.2,
    'revokeAccess': 1.0,
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly cacheService: StellarCacheService,
  ) {
    this.horizonUrl = this.configService.get<string>(
      'STELLAR_HORIZON_URL',
      'https://horizon-testnet.stellar.org',
    );
    this.logger.log(`Stellar Fee Service initialized with Horizon: ${this.horizonUrl}`);
  }

  /**
   * Get fee estimate for a specific operation
   */
  async getFeeEstimate(operation: string): Promise<FeeEstimateResponse> {
    // Validate operation
    if (!this.isValidOperation(operation)) {
      throw new BadRequestException(
        `Invalid operation. Supported operations: anchorRecord, grantAccess, revokeAccess`,
      );
    }

    const cacheKey = `fee-estimate:${operation}`;
    
    // Check cache first
    const cached = this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from Horizon
    try {
      const feeStats = await this.fetchFeeStatsFromHorizon();
      const estimate = this.calculateFeeEstimate(feeStats, operation as StellarOperation);
      
      // Cache the result
      this.cacheService.set(cacheKey, estimate);
      
      return estimate;
    } catch (error) {
      this.logger.error(`Failed to fetch fee estimate: ${error.message}`, error.stack);
      
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      
      throw new ServiceUnavailableException(
        'Unable to fetch fee estimate from Stellar network. Please try again later.',
      );
    }
  }

  /**
   * Fetch fee statistics from Horizon API
   */
  private async fetchFeeStatsFromHorizon(): Promise<HorizonFeeStatsResponse> {
    const url = `${this.horizonUrl}/fee_stats`;
    
    this.logger.debug(`Fetching fee stats from: ${url}`);

    try {
      const response = await firstValueFrom(
        this.httpService.get<HorizonFeeStatsResponse>(url).pipe(
          timeout(this.REQUEST_TIMEOUT_MS),
          catchError((error: AxiosError) => {
            if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
              this.logger.error('Horizon API request timeout');
              throw new ServiceUnavailableException(
                'Stellar Horizon API is not responding. Please try again later.',
              );
            }
            
            if (error.response) {
              this.logger.error(
                `Horizon API error: ${error.response.status} - ${error.response.statusText}`,
              );
              throw new ServiceUnavailableException(
                `Stellar Horizon API returned error: ${error.response.status}`,
              );
            }
            
            this.logger.error(`Network error connecting to Horizon: ${error.message}`);
            throw new ServiceUnavailableException(
              'Unable to connect to Stellar Horizon API. The service may be temporarily unavailable.',
            );
          }),
        ),
      );

      this.logger.debug('Successfully fetched fee stats from Horizon');
      return response.data;
    } catch (error) {
      // Re-throw ServiceUnavailableException
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      
      // Catch any other unexpected errors
      this.logger.error(`Unexpected error fetching fee stats: ${error.message}`);
      throw new ServiceUnavailableException(
        'An unexpected error occurred while fetching fee estimates.',
      );
    }
  }

  /**
   * Calculate fee estimate based on Horizon stats and operation type
   */
  private calculateFeeEstimate(
    feeStats: HorizonFeeStatsResponse,
    operation: string,
  ): FeeEstimateResponse {
    const baseFee = feeStats.last_ledger_base_fee;
    const capacityUsage = parseFloat(feeStats.ledger_capacity_usage);
    
    // Determine network congestion level
    const congestion = this.determineNetworkCongestion(capacityUsage);
    
    // Calculate recommended fee based on congestion and operation type
    const recommended = this.calculateRecommendedFee(
      feeStats,
      congestion,
      operation,
    );

    this.logger.debug(
      `Fee estimate calculated - Base: ${baseFee}, Recommended: ${recommended}, Congestion: ${congestion}`,
    );

    return {
      baseFee,
      recommended,
      networkCongestion: congestion,
    };
  }

  /**
   * Determine network congestion level based on ledger capacity usage
   */
  private determineNetworkCongestion(
    capacityUsage: number,
  ): 'low' | 'medium' | 'high' {
    if (capacityUsage < 0.5) {
      return 'low';
    } else if (capacityUsage < 0.75) {
      return 'medium';
    } else {
      return 'high';
    }
  }

  /**
   * Calculate recommended fee based on network conditions and operation
   */
  private calculateRecommendedFee(
    feeStats: HorizonFeeStatsResponse,
    congestion: 'low' | 'medium' | 'high',
    operation: string,
  ): string {
    const baseFee = parseInt(feeStats.last_ledger_base_fee, 10);
    const p50Fee = parseInt(feeStats.fee_charged.p50, 10);
    const p90Fee = parseInt(feeStats.fee_charged.p90, 10);
    
    let recommendedFee: number;

    // Base recommendation on congestion level
    switch (congestion) {
      case 'low':
        // Use base fee or slightly above
        recommendedFee = Math.max(baseFee, p50Fee);
        break;
      case 'medium':
        // Use p50 to p90 range
        recommendedFee = Math.ceil((p50Fee + p90Fee) / 2);
        break;
      case 'high':
        // Use p90 or higher
        recommendedFee = Math.max(p90Fee, baseFee * 2);
        break;
    }

    // Apply operation-specific multiplier
    const multiplier = this.OPERATION_MULTIPLIERS[operation] || 1.0;
    recommendedFee = Math.ceil(recommendedFee * multiplier);

    // Ensure minimum fee
    recommendedFee = Math.max(recommendedFee, baseFee);

    return recommendedFee.toString();
  }

  /**
   * Validate if operation is supported
   */
  private isValidOperation(operation: string): boolean {
    return ['anchorRecord', 'grantAccess', 'revokeAccess'].includes(operation);
  }

  /**
   * Get supported operations
   */
  getSupportedOperations(): string[] {
    return ['anchorRecord', 'grantAccess', 'revokeAccess'];
  }
}
