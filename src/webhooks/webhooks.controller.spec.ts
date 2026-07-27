import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WebhooksController } from './webhooks.controller';
import { IpfsService } from '../stellar/services/ipfs.service';
import { QueueService } from '../queues/queue.service';
import { ConfigService } from '@nestjs/config';
import { WebhookDeliveryService } from './services/webhook-delivery.service';
import { WebhookDelivery, WebhookDeliveryStatus } from './entities/webhook-delivery.entity';
import { ClaimService } from '../billing/services/claim.service';
jest.mock('../billing/dto/claim.dto', () => ({
  AdjudicationWebhookDto: class AdjudicationWebhookDto {},
}));

jest.mock('../auth/guards/jwt-auth.guard', () => ({
  JwtAuthGuard: class JwtAuthGuard {
    canActivate() {
      return true;
    }
  },
}));

jest.mock('../auth/guards/roles.guard', () => ({
  RolesGuard: class RolesGuard {
    canActivate() {
      return true;
    }
  },
}));

const mockIpfsService = () => ({});
const mockQueueService = () => ({
  dispatchIpfsUpload: jest.fn(),
  dispatchStellarTransaction: jest.fn(),
});
const mockConfigService = () => ({ get: jest.fn() });
const mockWebhookDeliveryService = () => ({
  replayDelivery: jest.fn(),
});
const mockClaimService = () => ({
  handleAdjudicationWebhook: jest.fn(),
});
const mockDeliveryRepository = () => ({
  findAndCount: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
});

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let queueService: ReturnType<typeof mockQueueService>;
  let deliveryRepository: ReturnType<typeof mockDeliveryRepository>;
  let webhookDeliveryService: ReturnType<typeof mockWebhookDeliveryService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        { provide: IpfsService, useFactory: mockIpfsService },
        { provide: QueueService, useFactory: mockQueueService },
        { provide: ConfigService, useFactory: mockConfigService },
        { provide: WebhookDeliveryService, useFactory: mockWebhookDeliveryService },
        { provide: getRepositoryToken(WebhookDelivery), useFactory: mockDeliveryRepository },
        { provide: ClaimService, useFactory: mockClaimService },
      ],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
    queueService = module.get(QueueService);
    deliveryRepository = module.get(getRepositoryToken(WebhookDelivery));
    webhookDeliveryService = module.get(WebhookDeliveryService);
  });

  // ── POST /webhooks/ipfs ───────────────────────────────────────────────────

  describe('handleIpfsWebhook', () => {
    it('dispatches an IPFS upload job and returns received=true when CID is present', async () => {
      queueService.dispatchIpfsUpload.mockResolvedValue(undefined);
      const payload = { cid: 'Qm123abc', event: 'pin.added' };

      const result = await controller.handleIpfsWebhook(payload);

      expect(queueService.dispatchIpfsUpload).toHaveBeenCalledWith(
        expect.objectContaining({ cid: 'Qm123abc', payload }),
      );
      expect(result).toMatchObject({ received: true, cid: 'Qm123abc', status: 'queued_for_processing' });
    });

    it('accepts ipfs_hash as the CID field', async () => {
      queueService.dispatchIpfsUpload.mockResolvedValue(undefined);
      const payload = { ipfs_hash: 'QmABCdef' };

      const result = await controller.handleIpfsWebhook(payload);

      expect(result.cid).toBe('QmABCdef');
    });

    it('accepts hash as the CID field', async () => {
      queueService.dispatchIpfsUpload.mockResolvedValue(undefined);
      const payload = { hash: 'QmXYZ789' };

      const result = await controller.handleIpfsWebhook(payload);

      expect(result.cid).toBe('QmXYZ789');
    });

    it('returns received=false when no CID field is present', async () => {
      const result = await controller.handleIpfsWebhook({ event: 'unknown' });

      expect(queueService.dispatchIpfsUpload).not.toHaveBeenCalled();
      expect(result).toMatchObject({ received: false });
    });

    it('returns received=false when queue dispatch fails', async () => {
      queueService.dispatchIpfsUpload.mockRejectedValue(new Error('Queue unavailable'));
      const result = await controller.handleIpfsWebhook({ cid: 'QmFail' });

      expect(result).toMatchObject({ received: false, error: 'Queue unavailable' });
    });
  });

  // ── POST /webhooks/stellar ────────────────────────────────────────────────

  describe('handleStellarWebhook', () => {
    it('dispatches a Stellar transaction job and returns received=true', async () => {
      queueService.dispatchStellarTransaction.mockResolvedValue(undefined);
      const payload = { transaction_hash: 'txhash123', ledger: 42, operation_type: 'payment' };

      const result = await controller.handleStellarWebhook(payload);

      expect(queueService.dispatchStellarTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          operationType: 'payment',
          params: expect.objectContaining({ txHash: 'txhash123', ledger: 42 }),
          initiatedBy: 'webhook',
        }),
      );
      expect(result).toMatchObject({ received: true, txHash: 'txhash123', status: 'queued_for_reconciliation' });
    });

    it('accepts tx_hash as the transaction hash field', async () => {
      queueService.dispatchStellarTransaction.mockResolvedValue(undefined);
      const result = await controller.handleStellarWebhook({ tx_hash: 'altHash' });

      expect(result.txHash).toBe('altHash');
    });

    it('returns received=false when no transaction hash is present', async () => {
      const result = await controller.handleStellarWebhook({ ledger: 1 });

      expect(queueService.dispatchStellarTransaction).not.toHaveBeenCalled();
      expect(result).toMatchObject({ received: false });
    });

    it('defaults operationType to "payment" when not specified', async () => {
      queueService.dispatchStellarTransaction.mockResolvedValue(undefined);
      await controller.handleStellarWebhook({ transaction_hash: 'txABC' });

      expect(queueService.dispatchStellarTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ operationType: 'payment' }),
      );
    });

    it('returns received=false when queue dispatch fails', async () => {
      queueService.dispatchStellarTransaction.mockRejectedValue(new Error('Bull down'));
      const result = await controller.handleStellarWebhook({ transaction_hash: 'txFail' });

      expect(result).toMatchObject({ received: false, error: 'Bull down' });
    });
  });

  // ── GET /webhooks/:id/deliveries ────────────────────────────────────────

  describe('getDeliveryHistory', () => {
    it('returns the delivery attempt history for a given delivery id', async () => {
      const delivery = { id: 'delivery-1', attempts: [{ attemptNumber: 1, timestamp: '2024-01-01T00:00:00.000Z', httpStatus: 503, error: 'down', responseBodySnippet: '{"detail":"down"}' }] };
      deliveryRepository.findOne.mockResolvedValue(delivery);

      const result = await controller.getDeliveryHistory('delivery-1');

      expect(deliveryRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'delivery-1' } }),
      );
      expect(result).toEqual(delivery);
    });
  });

  // ── GET /webhooks/dead-letter ─────────────────────────────────────────────

  describe('getDeadLetterQueue', () => {
    it('returns paginated failed deliveries', async () => {
      const items = [{ id: 'dlq-1', status: WebhookDeliveryStatus.FAILED }];
      deliveryRepository.findAndCount.mockResolvedValue([items, 1]);

      const result = await controller.getDeadLetterQueue(
        WebhookDeliveryStatus.FAILED,
        undefined,
        '10',
        '0',
      );

      expect(result).toEqual({ items, total: 1 });
    });

    it('caps the limit at 100', async () => {
      deliveryRepository.findAndCount.mockResolvedValue([[], 0]);

      await controller.getDeadLetterQueue(undefined, undefined, '9999', '0');

      expect(deliveryRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('defaults limit to 50 when not provided', async () => {
      deliveryRepository.findAndCount.mockResolvedValue([[], 0]);

      await controller.getDeadLetterQueue();

      expect(deliveryRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });
  });

  // ── POST /webhooks/dead-letter/:id/replay ────────────────────────────────

  describe('replayDeadLetterItem', () => {
    it('calls replayDelivery and returns success', async () => {
      webhookDeliveryService.replayDelivery.mockResolvedValue(undefined);
      const req = { user: { id: 'admin-1' } };

      const result = await controller.replayDeadLetterItem('dlq-1', req);

      expect(webhookDeliveryService.replayDelivery).toHaveBeenCalledWith('dlq-1', 'admin-1');
      expect(result).toMatchObject({ success: true });
    });
  });

  // ── DELETE /webhooks/dead-letter/:id ─────────────────────────────────────

  describe('discardDeadLetterItem', () => {
    it('marks the delivery as FAILED and returns success', async () => {
      const delivery = { id: 'dlq-1', status: WebhookDeliveryStatus.PENDING };
      deliveryRepository.findOne.mockResolvedValue(delivery);
      deliveryRepository.save.mockResolvedValue({ ...delivery, status: WebhookDeliveryStatus.FAILED });

      const result = await controller.discardDeadLetterItem('dlq-1');

      expect(deliveryRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: WebhookDeliveryStatus.FAILED }),
      );
      expect(result).toMatchObject({ success: true });
    });

    it('returns error when delivery is not found', async () => {
      deliveryRepository.findOne.mockResolvedValue(null);

      const result = await controller.discardDeadLetterItem('dlq-missing');

      expect(deliveryRepository.save).not.toHaveBeenCalled();
      expect(result).toMatchObject({ success: false });
    });
  });
});
