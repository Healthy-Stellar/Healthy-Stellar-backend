/**
 * Integration tests for StellarService against Stellar Testnet.
 *
 * These tests are SKIPPED by default (they require real network access
 * and a funded Testnet account). To run them:
 *
 *   STELLAR_INTEGRATION=true \
 *   STELLAR_SECRET_KEY=<funded-testnet-secret> \
 *   STELLAR_CONTRACT_ID=<deployed-contract-id> \
 *   jest test/stellar.integration.spec.ts --testTimeout=60000
 *
 * The suite is gated by the STELLAR_INTEGRATION environment variable so that
 * standard CI runs (`npm test`) are not affected.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { StellarService } from '../src/stellar/services/stellar.service';

const RUN_INTEGRATION = process.env.STELLAR_INTEGRATION === 'true';
const itIntegration = RUN_INTEGRATION ? it : it.skip;

describe('StellarService — Testnet Integration', () => {
  let service: StellarService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env.local', '.env'],
        }),
      ],
      providers: [StellarService],
    }).compile();

    service = module.get<StellarService>(StellarService);
  });

  // ── anchorRecord ────────────────────────────────────────────────────────

  itIntegration(
    'anchorRecord — should submit a transaction and return a tx hash',
    async () => {
      const patientId = `integration-patient-${Date.now()}`;
      const cid = 'QmIntegrationTestCIDabcdef1234567890';

      const result = await service.anchorRecord(patientId, cid);

      expect(result).toHaveProperty('txHash');
      expect(result).toHaveProperty('ledger');
      expect(result.confirmedAt).toBeGreaterThan(0);
      expect(typeof result.txHash).toBe('string');
      expect(result.txHash).toHaveLength(64); // 32-byte hex
    },
    60_000,
  );

  // ── grantAccess ─────────────────────────────────────────────────────────

  itIntegration(
    'grantAccess — should grant access and return a tx hash',
    async () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const result = await service.grantAccess(
        `integration-patient-${Date.now()}`,
        `integration-doctor-${Date.now()}`,
        `integration-record-${Date.now()}`,
        expiresAt,
      );

      expect(result.txHash).toBeTruthy();
      expect(result.ledger).toBeGreaterThan(0);
    },
    60_000,
  );

  // ── revokeAccess ────────────────────────────────────────────────────────

  itIntegration(
    'revokeAccess — should revoke access and return a tx hash',
    async () => {
      const result = await service.revokeAccess(
        `integration-patient-${Date.now()}`,
        `integration-doctor-${Date.now()}`,
        `integration-record-${Date.now()}`,
      );

      expect(result.txHash).toBeTruthy();
    },
    60_000,
  );

  // ── verifyAccess ────────────────────────────────────────────────────────

  itIntegration(
    'verifyAccess — should simulate without submitting a transaction',
    async () => {
      const result = await service.verifyAccess(
        `integration-requester-${Date.now()}`,
        `integration-record-${Date.now()}`,
      );

      // Result shape is correct regardless of actual access state
      expect(typeof result.hasAccess).toBe('boolean');
      // expiresAt is either null or an ISO string
      if (result.expiresAt !== null) {
        expect(new Date(result.expiresAt).toISOString()).toBe(result.expiresAt);
      }
    },
    60_000,
  );
});
