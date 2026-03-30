import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  HttpStatus,
  HttpCode,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { StellarRecoveryManagerService } from '../services/stellar-recovery-manager.service';
import { TransactionStatus } from '../services/stellar-transaction-queue.service';

/**
 * Stellar Transaction Recovery Controller
 *
 * Provides REST API endpoints for monitoring and managing
 * the transaction retry and recovery system
 */

@ApiTags('stellar-recovery')
@Controller('stellar/recovery')
export class StellarRecoveryController {
  private readonly logger = new Logger(StellarRecoveryController.name);

  constructor(private readonly recoveryManager: StellarRecoveryManagerService) {}

  /**
   * Get system health status
   */
  @Get('health')
  @ApiOperation({ summary: 'Get recovery system health status' })
  @ApiResponse({
    status: 200,
    description: 'Health status retrieved successfully',
  })
  async getHealth() {
    const health = await this.recoveryManager.healthCheck();
    return {
      statusCode: HttpStatus.OK,
      data: health,
    };
  }

  /**
   * Get recovery statistics
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get recovery system statistics' })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  getStats() {
    const stats = this.recoveryManager.getStats();
    const queueStats = this.recoveryManager.getQueueStats();

    return {
      statusCode: HttpStatus.OK,
      data: {
        recovery: stats,
        queue: queueStats,
      },
    };
  }

  /**
   * Get queued transaction status
   */
  @Get('queue/:queueId')
  @ApiOperation({ summary: 'Get status of a queued transaction' })
  @ApiResponse({
    status: 200,
    description: 'Transaction status retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Transaction not found in queue',
  })
  getQueuedTransaction(@Param('queueId') queueId: string) {
    const transaction = this.recoveryManager.getQueuedTransactionStatus(queueId);

    if (!transaction) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: `Transaction ${queueId} not found in queue`,
      };
    }

    return {
      statusCode: HttpStatus.OK,
      data: {
        id: transaction.id,
        status: transaction.status,
        attempts: transaction.attempts,
        maxAttempts: transaction.maxAttempts,
        nextRetryAt: transaction.nextRetryAt,
        createdAt: transaction.createdAt,
        lastAttemptAt: transaction.lastAttemptAt,
        lastError: transaction.lastError,
        priority: transaction.priority,
        context: transaction.context,
      },
    };
  }

  /**
   * Get all failed transactions
   */
  @Get('failed')
  @ApiOperation({ summary: 'Get all failed transactions' })
  @ApiResponse({
    status: 200,
    description: 'Failed transactions retrieved successfully',
  })
  getFailedTransactions() {
    const failed = this.recoveryManager.getFailedTransactions();

    return {
      statusCode: HttpStatus.OK,
      data: {
        count: failed.length,
        transactions: failed.map((tx) => ({
          id: tx.id,
          operation: tx.context.operation,
          status: tx.status,
          attempts: tx.attempts,
          maxAttempts: tx.maxAttempts,
          lastError: tx.lastError,
          createdAt: tx.createdAt,
          lastAttemptAt: tx.lastAttemptAt,
          priority: tx.priority,
        })),
      },
    };
  }

  /**
   * Get all pending transactions
   */
  @Get('pending')
  @ApiOperation({ summary: 'Get all pending transactions' })
  @ApiResponse({
    status: 200,
    description: 'Pending transactions retrieved successfully',
  })
  getPendingTransactions() {
    const pending = this.recoveryManager.getPendingTransactions();

    return {
      statusCode: HttpStatus.OK,
      data: {
        count: pending.length,
        transactions: pending.map((tx) => ({
          id: tx.id,
          operation: tx.context.operation,
          status: tx.status,
          attempts: tx.attempts,
          maxAttempts: tx.maxAttempts,
          nextRetryAt: tx.nextRetryAt,
          createdAt: tx.createdAt,
          priority: tx.priority,
        })),
      },
    };
  }

  /**
   * Cancel a queued transaction
   */
  @Delete('queue/:queueId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a queued transaction' })
  @ApiResponse({
    status: 200,
    description: 'Transaction cancelled successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Transaction not found',
  })
  cancelQueuedTransaction(@Param('queueId') queueId: string) {
    const cancelled = this.recoveryManager.cancelQueuedTransaction(queueId);

    if (!cancelled) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: `Transaction ${queueId} not found in queue`,
      };
    }

    this.logger.log(`Transaction cancelled via API: ${queueId}`);

    return {
      statusCode: HttpStatus.OK,
      message: `Transaction ${queueId} cancelled successfully`,
    };
  }

  /**
   * Export queue state
   */
  @Get('queue/export')
  @ApiOperation({ summary: 'Export queue state for persistence' })
  @ApiResponse({
    status: 200,
    description: 'Queue state exported successfully',
  })
  exportQueue() {
    const queueState = this.recoveryManager.exportQueueState();

    return {
      statusCode: HttpStatus.OK,
      data: {
        exportedAt: new Date().toISOString(),
        count: queueState.length,
        transactions: queueState,
      },
    };
  }

  /**
   * Import queue state
   */
  @Post('queue/import')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Import queue state from persistence' })
  @ApiResponse({
    status: 200,
    description: 'Queue state imported successfully',
  })
  importQueue(
    @Body()
    body: {
      transactions: any[];
      networkPassphrase: string;
    },
  ) {
    const imported = this.recoveryManager.importQueueState(
      body.transactions,
      body.networkPassphrase,
    );

    this.logger.log(`Imported ${imported} transactions via API`);

    return {
      statusCode: HttpStatus.OK,
      message: `Successfully imported ${imported} transactions`,
      data: {
        imported,
        total: body.transactions.length,
      },
    };
  }

  /**
   * Reset statistics
   */
  @Post('stats/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset recovery statistics' })
  @ApiResponse({
    status: 200,
    description: 'Statistics reset successfully',
  })
  resetStats() {
    this.recoveryManager.resetStats();

    this.logger.log('Statistics reset via API');

    return {
      statusCode: HttpStatus.OK,
      message: 'Statistics reset successfully',
    };
  }
}
