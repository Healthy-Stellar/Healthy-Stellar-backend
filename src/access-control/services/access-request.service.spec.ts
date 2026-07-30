import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AccessRequestService } from './access-request.service';
import { AccessRequest, AccessRequestStatus } from '../entities/access-request.entity';
import { AccessGrant, AccessLevel, GrantStatus } from '../entities/access-grant.entity';
import { SorobanQueueService } from './soroban-queue.service';
import { NotificationsService } from '../../notifications/services/notifications.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PROVIDER = 'aaaaaaaa-0000-0000-0000-000000000001';
const PATIENT  = 'bbbbbbbb-0000-0000-0000-000000000002';
const OTHER    = 'cccccccc-0000-0000-0000-000000000003';

const FUTURE = new Date(Date.now() + 72 * 60 * 60 * 1000);
const PAST   = new Date(Date.now() - 1000);

function makeRequest(overrides: Partial<AccessRequest> = {}): AccessRequest {
  return {
    id: 'req-1',
    providerAddress: PROVIDER,
    patientAddress: PATIENT,
    reason: 'Clinical review of chronic condition management',
    status: AccessRequestStatus.PENDING,
    requestedAt: new Date(),
    respondedAt: null,
    expiresAt: FUTURE,
    sorobanTxHash: null,
    ...overrides,
  } as AccessRequest;
}

function makeGrant(overrides: Partial<AccessGrant> = {}): AccessGrant {
  return {
    id: 'grant-1',
    patientId: PATIENT,
    granteeId: PROVIDER,
    recordIds: ['*'],
    accessLevel: AccessLevel.READ,
    status: GrantStatus.ACTIVE,
    isEmergency: false,
    emergencyReason: null,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    revokedAt: null,
    revokedBy: null,
    revocationReason: null,
    sorobanTxHash: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as AccessGrant;
}

// ── Mock factories ────────────────────────────────────────────────────────────

function makeMocks() {
  const requestRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const grantRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const soroban = {
    dispatchGrant: jest.fn().mockResolvedValue('0xsoroban-tx-hash'),
  };

  const notifications = {
    sendPatientEmailNotification: jest.fn().mockResolvedValue(undefined),
    emitAccessGranted: jest.fn(),
    emitAccessRevoked: jest.fn(),
  };

  return { requestRepo, grantRepo, soroban, notifications };
}

async function buildService(mocks: ReturnType<typeof makeMocks>) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AccessRequestService,
      { provide: getRepositoryToken(AccessRequest), useValue: mocks.requestRepo },
      { provide: getRepositoryToken(AccessGrant), useValue: mocks.grantRepo },
      { provide: SorobanQueueService, useValue: mocks.soroban },
      { provide: NotificationsService, useValue: mocks.notifications },
    ],
  }).compile();

  return module.get(AccessRequestService);
}

// ══════════════════════════════════════════════════════════════════════════════
describe('AccessRequestService', () => {
  let service: AccessRequestService;
  let mocks: ReturnType<typeof makeMocks>;

  beforeEach(async () => {
    mocks = makeMocks();
    service = await buildService(mocks);
  });

  afterEach(() => jest.clearAllMocks());

  // ── submitRequest ───────────────────────────────────────────────────────────
  describe('submitRequest', () => {
    const dto = {
      patientAddress: PATIENT,
      reason: 'Clinical review of chronic condition management',
    };

    beforeEach(() => {
      mocks.requestRepo.findOne.mockResolvedValue(null);
      const pending = makeRequest();
      mocks.requestRepo.create.mockReturnValue(pending);
      mocks.requestRepo.save.mockResolvedValue(pending);
    });

    it('creates and returns a PENDING request', async () => {
      const result = await service.submitRequest(PROVIDER, dto);

      expect(result.status).toBe(AccessRequestStatus.PENDING);
      expect(mocks.requestRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          providerAddress: PROVIDER,
          patientAddress: PATIENT,
          status: AccessRequestStatus.PENDING,
        }),
      );
    });

    it('sets expiresAt ~72 hours in the future', async () => {
      await service.submitRequest(PROVIDER, dto);

      const created = mocks.requestRepo.create.mock.calls[0][0];
      const diffMs = created.expiresAt.getTime() - Date.now();
      expect(diffMs).toBeGreaterThan(71 * 60 * 60 * 1000);
      expect(diffMs).toBeLessThan(73 * 60 * 60 * 1000);
    });

    it('sends email notification to patient', async () => {
      await service.submitRequest(PROVIDER, dto);

      expect(mocks.notifications.sendPatientEmailNotification).toHaveBeenCalledWith(
        PATIENT,
        expect.stringContaining('access request'),
        expect.stringContaining(PROVIDER),
      );
    });

    it('emits WebSocket notification', async () => {
      await service.submitRequest(PROVIDER, dto);

      expect(mocks.notifications.emitAccessGranted).toHaveBeenCalledWith(
        PROVIDER,
        expect.any(String),
        expect.objectContaining({ targetUserId: PATIENT }),
      );
    });

    it('throws ConflictException when a pending request already exists', async () => {
      mocks.requestRepo.findOne.mockResolvedValue(makeRequest());

      await expect(service.submitRequest(PROVIDER, dto)).rejects.toThrow(ConflictException);
      expect(mocks.requestRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── getPendingRequests ──────────────────────────────────────────────────────
  describe('getPendingRequests', () => {
    it('returns only non-expired PENDING requests for the patient', async () => {
      const pending = [makeRequest(), makeRequest({ id: 'req-2' })];
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(pending),
      };
      mocks.requestRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getPendingRequests(PATIENT);

      expect(result).toHaveLength(2);
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('status'),
        expect.objectContaining({ status: AccessRequestStatus.PENDING }),
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('expiresAt'),
        expect.objectContaining({ now: expect.any(Date) }),
      );
    });

    it('returns empty array when no pending requests exist', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mocks.requestRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getPendingRequests(PATIENT);

      expect(result).toEqual([]);
    });
  });

  // ── approveRequest ──────────────────────────────────────────────────────────
  describe('approveRequest', () => {
    beforeEach(() => {
      mocks.requestRepo.findOne.mockResolvedValue(makeRequest());
      const grant = makeGrant();
      mocks.grantRepo.create.mockReturnValue(grant);
      mocks.grantRepo.save.mockResolvedValue(grant);
      mocks.requestRepo.save.mockResolvedValue(
        makeRequest({ status: AccessRequestStatus.APPROVED, sorobanTxHash: '0xsoroban-tx-hash' }),
      );
    });

    it('transitions request to APPROVED and returns both request and grant', async () => {
      const result = await service.approveRequest('req-1', PATIENT);

      expect(result.request.status).toBe(AccessRequestStatus.APPROVED);
      expect(result.grant).toBeDefined();
    });

    it('creates an AccessGrant with READ access for all records', async () => {
      await service.approveRequest('req-1', PATIENT);

      expect(mocks.grantRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: PATIENT,
          granteeId: PROVIDER,
          recordIds: ['*'],
          accessLevel: AccessLevel.READ,
          status: GrantStatus.ACTIVE,
        }),
      );
    });

    it('dispatches grant to Soroban and stores the tx hash', async () => {
      await service.approveRequest('req-1', PATIENT);

      expect(mocks.soroban.dispatchGrant).toHaveBeenCalledTimes(1);
      expect(mocks.requestRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ sorobanTxHash: '0xsoroban-tx-hash' }),
      );
    });

    it('notifies the provider of approval', async () => {
      await service.approveRequest('req-1', PATIENT);

      expect(mocks.notifications.emitAccessGranted).toHaveBeenCalledWith(
        PATIENT,
        expect.any(String),
        expect.objectContaining({ targetUserId: PROVIDER }),
      );
    });

    it('throws NotFoundException when request does not exist', async () => {
      mocks.requestRepo.findOne.mockResolvedValue(null);

      await expect(service.approveRequest('req-1', PATIENT)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when caller is not the target patient', async () => {
      await expect(service.approveRequest('req-1', OTHER)).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when request is already APPROVED', async () => {
      mocks.requestRepo.findOne.mockResolvedValue(
        makeRequest({ status: AccessRequestStatus.APPROVED }),
      );

      await expect(service.approveRequest('req-1', PATIENT)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when request is already DENIED', async () => {
      mocks.requestRepo.findOne.mockResolvedValue(
        makeRequest({ status: AccessRequestStatus.DENIED }),
      );

      await expect(service.approveRequest('req-1', PATIENT)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException and marks EXPIRED when expiresAt is in the past', async () => {
      mocks.requestRepo.findOne.mockResolvedValue(makeRequest({ expiresAt: PAST }));
      mocks.requestRepo.save.mockResolvedValue(
        makeRequest({ status: AccessRequestStatus.EXPIRED }),
      );

      await expect(service.approveRequest('req-1', PATIENT)).rejects.toThrow(ConflictException);
      expect(mocks.requestRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: AccessRequestStatus.EXPIRED }),
      );
    });
  });

  // ── denyRequest ─────────────────────────────────────────────────────────────
  describe('denyRequest', () => {
    beforeEach(() => {
      mocks.requestRepo.findOne.mockResolvedValue(makeRequest());
      mocks.requestRepo.save.mockResolvedValue(
        makeRequest({ status: AccessRequestStatus.DENIED, respondedAt: new Date() }),
      );
    });

    it('transitions request to DENIED', async () => {
      const result = await service.denyRequest('req-1', PATIENT);

      expect(result.status).toBe(AccessRequestStatus.DENIED);
    });

    it('sets respondedAt on denial', async () => {
      const result = await service.denyRequest('req-1', PATIENT);

      expect(result.respondedAt).toBeInstanceOf(Date);
    });

    it('notifies the provider of denial', async () => {
      await service.denyRequest('req-1', PATIENT);

      expect(mocks.notifications.emitAccessRevoked).toHaveBeenCalledWith(
        PATIENT,
        'req-1',
        expect.objectContaining({ targetUserId: PROVIDER }),
      );
    });

    it('does NOT call Soroban on denial', async () => {
      await service.denyRequest('req-1', PATIENT);

      expect(mocks.soroban.dispatchGrant).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when request does not exist', async () => {
      mocks.requestRepo.findOne.mockResolvedValue(null);

      await expect(service.denyRequest('req-1', PATIENT)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when caller is not the target patient', async () => {
      await expect(service.denyRequest('req-1', OTHER)).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when request is already DENIED', async () => {
      mocks.requestRepo.findOne.mockResolvedValue(
        makeRequest({ status: AccessRequestStatus.DENIED }),
      );

      await expect(service.denyRequest('req-1', PATIENT)).rejects.toThrow(ConflictException);
    });
  });

  // ── expireStaleRequests ─────────────────────────────────────────────────────
  describe('expireStaleRequests', () => {
    it('bulk-updates PENDING requests past their expiresAt to EXPIRED', async () => {
      mocks.requestRepo.update.mockResolvedValue({ affected: 3 });

      const count = await service.expireStaleRequests();

      expect(count).toBe(3);
      expect(mocks.requestRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: AccessRequestStatus.PENDING }),
        { status: AccessRequestStatus.EXPIRED },
      );
    });

    it('returns 0 when no requests have expired', async () => {
      mocks.requestRepo.update.mockResolvedValue({ affected: 0 });

      const count = await service.expireStaleRequests();

      expect(count).toBe(0);
    });

    it('handles undefined affected gracefully', async () => {
      mocks.requestRepo.update.mockResolvedValue({ affected: undefined });

      const count = await service.expireStaleRequests();

      expect(count).toBe(0);
    });
  });

  // ── lifecycle hooks ─────────────────────────────────────────────────────────
  describe('lifecycle', () => {
    it('starts the expiry interval on module init', () => {
      jest.useFakeTimers();
      const spy = jest.spyOn(service, 'expireStaleRequests').mockResolvedValue(0);

      service.onModuleInit();
      jest.advanceTimersByTime(15 * 60 * 1000 + 100);

      expect(spy).toHaveBeenCalledTimes(1);

      service.onModuleDestroy();
      jest.useRealTimers();
    });

    it('clears the interval on module destroy', () => {
      jest.useFakeTimers();
      const spy = jest.spyOn(service, 'expireStaleRequests').mockResolvedValue(0);

      service.onModuleInit();
      service.onModuleDestroy();
      jest.advanceTimersByTime(30 * 60 * 1000);

      expect(spy).not.toHaveBeenCalled();
      jest.useRealTimers();
    });
  });
});
