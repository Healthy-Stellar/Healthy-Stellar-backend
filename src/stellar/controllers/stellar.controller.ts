import {
  Controller,
  Get,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { StellarFeeService } from '../services/stellar-fee.service';
import { FeeEstimateResponse } from '../interfaces/fee-estimate.interface';

/**
 * Stellar Controller
 * 
 * Provides endpoints for Stellar blockchain operations including
 * fee estimation for transactions.
 */
@Controller('stellar')
export class StellarController {
  constructor(private readonly stellarFeeService: StellarFeeService) {}

  /**
   * Get fee estimate for a Stellar operation
   * 
   * @param operation - The type of operation (anchorRecord, grantAccess, revokeAccess)
   * @returns Fee estimate with base fee, recommended fee, and network congestion level
   * 
   * @example
   * GET /stellar/fee-estimate?operation=anchorRecord
   * 
   * Response:
   * {
   *   "baseFee": "100",
   *   "recommended": "150",
   *   "networkCongestion": "low"
   * }
   */
  @Get('fee-estimate')
  @HttpCode(HttpStatus.OK)
  async getFeeEstimate(
    @Query('operation') operation: string,
  ): Promise<FeeEstimateResponse> {
    return this.stellarFeeService.getFeeEstimate(operation);
  }

  /**
   * Get list of supported operations
   * 
   * @returns Array of supported operation types
   */
  @Get('operations')
  @HttpCode(HttpStatus.OK)
  getSupportedOperations(): { operations: string[] } {
    return {
      operations: this.stellarFeeService.getSupportedOperations(),
    };
  }
}
