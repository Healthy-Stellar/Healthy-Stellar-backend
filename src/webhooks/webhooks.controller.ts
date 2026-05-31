import { Controller, Post, Body, HttpCode, Inject, Logger, Get, Param, UseGuards, Req, Query, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { IpfsService } from '../stellar/services/ipfs.service';
import { QueueService } from '../queues/queue.service';
import { ConfigService } from '@nestjs/config';
import { WebhookDeliveryService } from './services/webhook-delivery.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookDelivery, WebhookDeliveryStatus } from './entities/webhook-delivery.entity';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly ipfsService: IpfsService,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    private readonly webhookService: WebhookDeliveryService,
    @InjectRepository(WebhookDelivery)
    private readonly deliveryRepository: Repository<WebhookDelivery>,
  ) {}

  @Post('ipfs')
  @HttpCode(200)
  async handleIpfsWebhook(@Body() payload: any) {
    this.logger.log(`Received IPFS webhook: ${JSON.stringify(payload)}`);
    
    // Handle IPFS pinning service webhook
    // Extract CID from payload and dispatch for processing
    const cid = payload?.cid || payload?.ipfs_hash || payload?.hash;
    if (!cid) {
      this.logger.warn('IPFS webhook received without CID');
      return { received: false, error: 'Missing CID in payload' };
    }
    
    try {
      // Dispatch IPFS upload job for processing
      await this.queueService.dispatchIpfsUpload({
        cid,
        payload,
        correlationId: `ipfs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      });
      
      this.logger.log(`IPFS webhook processed successfully for CID: ${cid}`);
      return { received: true, cid, status: 'queued_for_processing' };
    } catch (error) {
      this.logger.error(`Failed to process IPFS webhook for CID ${cid}: ${error.message}`, error.stack);
      return { received: false, error: error.message };
    }
  }

  @Post('stellar')
  @HttpCode(200)
  async handleStellarWebhook(@Body() payload: any) {
    this.logger.log(`Received Stellar webhook: ${JSON.stringify(payload)}`);
    
    // Handle Stellar payment processor webhook
    // Extract transaction details and dispatch for reconciliation
    const txHash = payload?.transaction_hash || payload?.tx_hash || payload?.hash;
    const ledger = payload?.ledger || payload?.ledger_sequence;
    const operationType = payload?.operation_type || 'payment';
    
    if (!txHash) {
      this.logger.warn('Stellar webhook received without transaction hash');
      return { received: false, error: 'Missing transaction hash in payload' };
    }
    
    try {
      // Dispatch Stellar transaction job for processing
      await this.queueService.dispatchStellarTransaction({
        operationType,
        params: {
          txHash,
          ledger,
          payload,
        },
        initiatedBy: 'webhook',
        correlationId: `stellar-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      });
      
      this.logger.log(`Stellar webhook processed successfully for transaction: ${txHash}`);
      return { received: true, txHash, status: 'queued_for_reconciliation' };
    } catch (error) {
      this.logger.error(`Failed to process Stellar webhook for transaction ${txHash}: ${error.message}`, error.stack);
      return { received: false, error: error.message };
    }
  }

  // ── Dead-Letter Queue Management ──────────────────────────────────────────

  @Get('dead-letter')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List failed webhook deliveries (dead-letter queue)' })
  @ApiQuery({ name: 'status', required: false, enum: WebhookDeliveryStatus })
  @ApiQuery({ name: 'subscriptionId', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getDeadLetterQueue(
    @Query('status') status?: WebhookDeliveryStatus,
    @Query('subscriptionId') subscriptionId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const where: any = {};
    if (status) where.status = status;
    if (subscriptionId) where.subscriptionId = subscriptionId;

    const [items, total] = await this.deliveryRepository.findAndCount({
      where,
      relations: ['subscription'],
      skip: offset ? parseInt(offset, 10) : 0,
      take: limit ? Math.min(parseInt(limit, 10), 100) : 50,
      order: { createdAt: 'DESC' },
    });

    return { items, total };
  }

  @Get('dead-letter/:deliveryId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get details of a failed webhook delivery' })
  @ApiParam({ name: 'deliveryId', type: String })
  async getDeadLetterItem(@Param('deliveryId') deliveryId: string) {
    return this.deliveryRepository.findOne({
      where: { id: deliveryId },
      relations: ['subscription'],
    });
  }

  @Post('dead-letter/:deliveryId/replay')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Replay a failed webhook delivery from dead-letter queue' })
  @ApiParam({ name: 'deliveryId', type: String })
  @HttpCode(200)
  async replayDeadLetterItem(
    @Param('deliveryId') deliveryId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id || 'unknown';
    await this.webhookService.replayDelivery(deliveryId, userId);
    return { success: true, message: 'Webhook delivery queued for replay' };
  }

  @Delete('dead-letter/:deliveryId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Discard a failed webhook delivery' })
  @ApiParam({ name: 'deliveryId', type: String })
  @HttpCode(200)
  async discardDeadLetterItem(
    @Param('deliveryId') deliveryId: string,
  ) {
    const delivery = await this.deliveryRepository.findOne({
      where: { id: deliveryId },
    });

    if (!delivery) {
      return { error: 'Delivery not found', success: false };
    }

    delivery.status = WebhookDeliveryStatus.FAILED; // Mark as discarded
    await this.deliveryRepository.save(delivery);

    return { success: true, message: 'Webhook delivery discarded' };
  }
}

