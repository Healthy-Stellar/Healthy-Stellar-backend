import { ForbiddenException, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { MultiSigController } from '../../src/stellar/controllers/multi-sig.controller';
import { MultiSigTransactionService } from '../../src/stellar/services/multi-sig-transaction.service';
import { AuthTokenService } from '../../src/auth/services/auth-token.service';
import { SessionManagementService } from '../../src/auth/services/session-management.service';
import { UserRole } from '../../src/auth/entities/user.entity';

describe('Multi-signature payment authorization (e2e) — #1152', () => {
  let app: INestApplication;

  const tokens: Record<string, { userId: string; role: UserRole }> = {
    'billing-token': { userId: 'intruder', role: UserRole.BILLING_STAFF },
  };

  const authTokenServiceMock = {
    verifyAccessToken: jest.fn((token: string) => {
      const user = tokens[token];
      return user
        ? {
            ...user,
            email: `${user.userId}@test`,
            mfaVerified: true,
            sessionId: `session-${user.userId}`,
            organizationId: 'tenant-1',
          }
        : null;
    }),
  };

  const sessionManagementServiceMock = {
    isSessionValid: jest.fn(async () => true),
    updateSessionActivity: jest.fn(async () => undefined),
  };

  const multiSigServiceMock = {
    createMultiSigPayment: jest.fn(),
    approveTransaction: jest.fn(async (_id: string, _tenantId: string, signerId: string) => {
      if (signerId !== 'signer-1') throw new ForbiddenException('Not authorised');
    }),
    rejectTransaction: jest.fn(),
    sweepApprovedTransactions: jest.fn(),
    getTransactionStatus: jest.fn(),
    listPendingTransactions: jest.fn(),
  };

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [MultiSigController],
      providers: [
        { provide: MultiSigTransactionService, useValue: multiSigServiceMock },
        { provide: AuthTokenService, useValue: authTokenServiceMock },
        { provide: SessionManagementService, useValue: sessionManagementServiceMock },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  beforeEach(() => jest.clearAllMocks());

  afterAll(async () => {
    if (app) await app.close();
  });

  it('rejects anonymous payment routes with 401', async () => {
    const anonymousRequests = [
      http().post('/stellar/multi-sig/payments'),
      http().post('/stellar/multi-sig/payments/tx-1/approve'),
      http().post('/stellar/multi-sig/payments/tx-1/reject'),
      http().post('/stellar/multi-sig/payments/sweep'),
      http().get('/stellar/multi-sig/payments'),
      http().get('/stellar/multi-sig/payments/tx-1'),
    ];

    for (const call of anonymousRequests) {
      await call.send({}).expect(401);
    }

    expect(multiSigServiceMock.approveTransaction).not.toHaveBeenCalled();
  });

  it('returns 403 when a non-signer tries to approve using a signer id in the body', async () => {
    await http()
      .post('/stellar/multi-sig/payments/tx-1/approve')
      .set(auth('billing-token'))
      .send({ signerId: 'signer-1' })
      .expect(403);

    expect(multiSigServiceMock.approveTransaction).toHaveBeenCalledWith(
      'tx-1',
      'tenant-1',
      'intruder',
    );
  });
});
