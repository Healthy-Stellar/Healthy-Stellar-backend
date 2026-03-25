import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { CircuitBreakerService } from '../../src/common/circuit-breaker/circuit-breaker.service';
import { CircuitBreakerModule } from '../../src/common/circuit-breaker/circuit-breaker.module';
import { StellarWithBreakerService } from '../../src/stellar/services/stellar-with-breaker.service';
import { StellarService } from '../../src/stellar/services/stellar.service';
import { ConfigModule } from '@nestjs/config';
import { CircuitBreakerExceptionFilter } from '../../src/common/circuit-breaker/filters/circuit-breaker-exception.filter';

describe('Circuit Breaker Integration Tests', () => {
  let app: INestApplication;
  let circuitBreakerService: CircuitBreakerService;
  let stellarService: StellarService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        CircuitBreakerModule,
      ],
      providers: [
        StellarService,
        StellarWithBreakerService,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new CircuitBreakerExceptionFilter());
    await app.init();

    circuitBreakerService = moduleFixture.get<CircuitBreakerService>(CircuitBreakerService);
    stellarService = moduleFixture.get<StellarService>(StellarService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // Reset all circuit breakers before each test
    ['stellar', 'ipfs', 'kms', 'mail'].forEach((service) => {
      circuitBreakerService.reset(service);
    });
  });

  describe('Stellar Circuit Breaker', () => {
    it('should open circuit after 5 consecutive failures', async () => {
      // Mock stellar service to fail
      jest.spyOn(stellarService, 'anchorRecord').mockRejectedValue(
        new Error('Stellar Horizon timeout'),
      );

      const stellarWithBreaker = app.get(StellarWithBreakerService);

      // Trigger 5 failures
      for (let i = 0; i < 5; i++) {
        try {
          await stellarWithBreaker.anchorRecord('patient-1', 'cid-abc');
        } catch (error) {
          // Expected to fail
        }
      }

      // Verify circuit is open
      const state = circuitBreakerService.getState('stellar');
      expect(state?.state).toBe('open');
    });

    it('should return 503 with Retry-After header when circuit is open', async () => {
      // Mock stellar service to fail
      jest.spyOn(stellarService, 'anchorRecord').mockRejectedValue(
        new Error('Stellar Horizon timeout'),
      );

      const stellarWithBreaker = app.get(StellarWithBreakerService);

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await stellarWithBreaker.anchorRecord('patient-1', 'cid-abc');
        } catch (error) {
          // Expected
        }
      }

      // Next request should fail fast
      try {
        await stellarWithBreaker.anchorRecord('patient-1', 'cid-abc');
        fail('Should have thrown CircuitOpenException');
      } catch (error: any) {
        expect(error.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        const response = error.getResponse() as any;
        expect(response.retryAfter).toBe(60);
      }
    });

    it('should track failure and success counts', async () => {
      const stellarWithBreaker = app.get(StellarWithBreakerService);

      // Mock successful call
      jest.spyOn(stellarService, 'anchorRecord').mockResolvedValue({
        txHash: 'tx-123',
        ledger: 12345,
        confirmedAt: Date.now(),
      });

      await stellarWithBreaker.anchorRecord('patient-1', 'cid-abc');

      const state = circuitBreakerService.getState('stellar');
      expect(state?.successCount).toBeGreaterThan(0);

      // Mock failure
      jest.spyOn(stellarService, 'anchorRecord').mockRejectedValue(new Error('Timeout'));

      try {
        await stellarWithBreaker.anchorRecord('patient-1', 'cid-abc');
      } catch (error) {
        // Expected
      }

      const updatedState = circuitBreakerService.getState('stellar');
      expect(updatedState?.failureCount).toBeGreaterThan(0);
    });
  });

  describe('IPFS Circuit Breaker', () => {
    it('should open circuit after 3 consecutive failures', async () => {
      const mockIpfsService = {
        upload: jest.fn().mockRejectedValue(new Error('IPFS connection refused')),
      };

      // Simulate IPFS failures through circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreakerService.execute('ipfs', () => mockIpfsService.upload(Buffer.from('test')));
        } catch (error) {
          // Expected
        }
      }

      const state = circuitBreakerService.getState('ipfs');
      expect(state?.state).toBe('open');
    });
  });

  describe('KMS Circuit Breaker', () => {
    it('should open circuit after 2 consecutive failures (stricter)', async () => {
      const mockKmsService = {
        encrypt: jest.fn().mockRejectedValue(new Error('KMS unavailable')),
      };

      // Simulate KMS failures
      for (let i = 0; i < 2; i++) {
        try {
          await circuitBreakerService.execute('kms', () => 
            mockKmsService.encrypt(Buffer.from('data'), 'key-id')
          );
        } catch (error) {
          // Expected
        }
      }

      const state = circuitBreakerService.getState('kms');
      expect(state?.state).toBe('open');
    });
  });

  describe('Circuit Recovery', () => {
    it('should transition to half-open and close on success', async () => {
      jest.useFakeTimers();

      const stellarWithBreaker = app.get(StellarWithBreakerService);

      // Mock failures to open circuit
      jest.spyOn(stellarService, 'anchorRecord').mockRejectedValue(
        new Error('Stellar Horizon timeout'),
      );

      for (let i = 0; i < 5; i++) {
        try {
          await stellarWithBreaker.anchorRecord('patient-1', 'cid-abc');
        } catch (error) {
          // Expected
        }
      }

      expect(circuitBreakerService.getState('stellar')?.state).toBe('open');

      // Fast forward to half-open timeout (60 seconds for stellar)
      jest.advanceTimersByTime(60000);

      // Mock successful call
      jest.spyOn(stellarService, 'anchorRecord').mockResolvedValue({
        txHash: 'tx-success',
        ledger: 12346,
        confirmedAt: Date.now(),
      });

      // This should succeed and close the circuit
      await stellarWithBreaker.anchorRecord('patient-1', 'cid-abc');

      expect(circuitBreakerService.getState('stellar')?.state).toBe('closed');

      jest.useRealTimers();
    });
  });

  describe('Health Check Integration', () => {
    it('should expose circuit breaker states in health check', () => {
      const states = circuitBreakerService.getAllStates();

      expect(states).toHaveProperty('stellar');
      expect(states).toHaveProperty('ipfs');
      expect(states).toHaveProperty('kms');
      expect(states).toHaveProperty('mail');

      expect(['closed', 'open', 'half-open']).toContain(states.stellar);
    });

    it('should provide detailed stats', () => {
      const stats = circuitBreakerService.getDetailedStats();

      expect(stats).toHaveLength(4);
      stats.forEach((stat) => {
        expect(stat).toHaveProperty('service');
        expect(stat).toHaveProperty('state');
        expect(stat).toHaveProperty('lastStateChange');
        expect(stat).toHaveProperty('failureCount');
        expect(stat).toHaveProperty('successCount');
      });
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle concurrent requests correctly', async () => {
      const stellarWithBreaker = app.get(StellarWithBreakerService);

      jest.spyOn(stellarService, 'anchorRecord').mockResolvedValue({
        txHash: 'tx-concurrent',
        ledger: 12347,
        confirmedAt: Date.now(),
      });

      // Execute 10 concurrent requests
      const promises = Array.from({ length: 10 }, (_, i) =>
        stellarWithBreaker.anchorRecord(`patient-${i}`, `cid-${i}`),
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach((result) => {
        expect(result.txHash).toBe('tx-concurrent');
      });

      const state = circuitBreakerService.getState('stellar');
      expect(state?.successCount).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Manual Reset', () => {
    it('should allow manual circuit reset', async () => {
      const stellarWithBreaker = app.get(StellarWithBreakerService);

      // Open the circuit
      jest.spyOn(stellarService, 'anchorRecord').mockRejectedValue(new Error('Timeout'));

      for (let i = 0; i < 5; i++) {
        try {
          await stellarWithBreaker.anchorRecord('patient-1', 'cid-abc');
        } catch (error) {
          // Expected
        }
      }

      expect(circuitBreakerService.getState('stellar')?.state).toBe('open');

      // Manual reset
      circuitBreakerService.reset('stellar');

      expect(circuitBreakerService.getState('stellar')?.state).toBe('closed');

      // Should now accept requests
      jest.spyOn(stellarService, 'anchorRecord').mockResolvedValue({
        txHash: 'tx-after-reset',
        ledger: 12348,
        confirmedAt: Date.now(),
      });

      const result = await stellarWithBreaker.anchorRecord('patient-1', 'cid-abc');
      expect(result.txHash).toBe('tx-after-reset');
    });
  });
});
