import { Test, TestingModule } from '@nestjs/testing';
import { CircuitBreakerService } from './circuit-breaker.service';
import { BrokenCircuitError } from 'cockatiel';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CircuitBreakerService],
    }).compile();

    service = module.get<CircuitBreakerService>(CircuitBreakerService);
    service.onModuleInit();
  });

  afterEach(() => {
    // Reset all circuit breakers after each test
    ['stellar', 'ipfs', 'kms', 'mail'].forEach((serviceName) => {
      service.reset(serviceName);
    });
  });

  describe('initialization', () => {
    it('should initialize circuit breakers for all configured services', () => {
      const states = service.getAllStates();
      expect(states).toHaveProperty('stellar');
      expect(states).toHaveProperty('ipfs');
      expect(states).toHaveProperty('kms');
      expect(states).toHaveProperty('mail');
    });

    it('should initialize all circuit breakers in closed state', () => {
      const states = service.getAllStates();
      expect(states.stellar).toBe('closed');
      expect(states.ipfs).toBe('closed');
      expect(states.kms).toBe('closed');
      expect(states.mail).toBe('closed');
    });
  });

  describe('stellar circuit breaker', () => {
    it('should open after 5 consecutive failures', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('Stellar Horizon timeout'));

      // Trigger 5 failures
      for (let i = 0; i < 5; i++) {
        try {
          await service.execute('stellar', failingFn);
        } catch (error) {
          // Expected to fail
        }
      }

      const state = service.getState('stellar');
      expect(state?.state).toBe('open');
    });

    it('should fail fast when circuit is open', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('Stellar Horizon timeout'));

      // Trigger 5 failures to open circuit
      for (let i = 0; i < 5; i++) {
        try {
          await service.execute('stellar', failingFn);
        } catch (error) {
          // Expected
        }
      }

      // Next call should fail immediately without calling the function
      const callCountBefore = failingFn.mock.calls.length;
      try {
        await service.execute('stellar', failingFn);
      } catch (error) {
        expect(error).toBeInstanceOf(BrokenCircuitError);
      }

      // Function should not have been called again (fail fast)
      expect(failingFn.mock.calls.length).toBe(callCountBefore);
    });

    it('should transition to half-open after timeout', async () => {
      jest.useFakeTimers();

      const failingFn = jest.fn().mockRejectedValue(new Error('Stellar Horizon timeout'));

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await service.execute('stellar', failingFn);
        } catch (error) {
          // Expected
        }
      }

      expect(service.getState('stellar')?.state).toBe('open');

      // Fast forward 60 seconds (halfOpenAfter for stellar)
      jest.advanceTimersByTime(60000);

      // Next successful call should close the circuit
      const successFn = jest.fn().mockResolvedValue('success');
      await service.execute('stellar', successFn);

      const state = service.getState('stellar');
      expect(state?.state).toBe('closed');

      jest.useRealTimers();
    });

    it('should close circuit after successful execution in half-open state', async () => {
      jest.useFakeTimers();

      const failingFn = jest.fn().mockRejectedValue(new Error('Stellar Horizon timeout'));

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await service.execute('stellar', failingFn);
        } catch (error) {
          // Expected
        }
      }

      // Wait for half-open
      jest.advanceTimersByTime(60000);

      // Successful call should close circuit
      const successFn = jest.fn().mockResolvedValue('success');
      await service.execute('stellar', successFn);

      expect(service.getState('stellar')?.state).toBe('closed');

      jest.useRealTimers();
    });
  });

  describe('ipfs circuit breaker', () => {
    it('should open after 3 consecutive failures', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('IPFS connection refused'));

      // Trigger 3 failures
      for (let i = 0; i < 3; i++) {
        try {
          await service.execute('ipfs', failingFn);
        } catch (error) {
          // Expected
        }
      }

      const state = service.getState('ipfs');
      expect(state?.state).toBe('open');
    });

    it('should transition to half-open after 45 seconds', async () => {
      jest.useFakeTimers();

      const failingFn = jest.fn().mockRejectedValue(new Error('IPFS timeout'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await service.execute('ipfs', failingFn);
        } catch (error) {
          // Expected
        }
      }

      expect(service.getState('ipfs')?.state).toBe('open');

      // Fast forward 45 seconds
      jest.advanceTimersByTime(45000);

      // Next successful call should close
      const successFn = jest.fn().mockResolvedValue('cid-123');
      await service.execute('ipfs', successFn);

      expect(service.getState('ipfs')?.state).toBe('closed');

      jest.useRealTimers();
    });
  });

  describe('kms circuit breaker', () => {
    it('should open after 2 consecutive failures (stricter threshold)', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('KMS key not found'));

      // Trigger 2 failures
      for (let i = 0; i < 2; i++) {
        try {
          await service.execute('kms', failingFn);
        } catch (error) {
          // Expected
        }
      }

      const state = service.getState('kms');
      expect(state?.state).toBe('open');
    });

    it('should transition to half-open after 30 seconds', async () => {
      jest.useFakeTimers();

      const failingFn = jest.fn().mockRejectedValue(new Error('KMS unavailable'));

      // Open the circuit
      for (let i = 0; i < 2; i++) {
        try {
          await service.execute('kms', failingFn);
        } catch (error) {
          // Expected
        }
      }

      expect(service.getState('kms')?.state).toBe('open');

      // Fast forward 30 seconds
      jest.advanceTimersByTime(30000);

      // Next successful call should close
      const successFn = jest.fn().mockResolvedValue(Buffer.from('encrypted'));
      await service.execute('kms', successFn);

      expect(service.getState('kms')?.state).toBe('closed');

      jest.useRealTimers();
    });
  });

  describe('mail circuit breaker', () => {
    it('should open after 3 consecutive failures', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('SMTP connection failed'));

      // Trigger 3 failures
      for (let i = 0; i < 3; i++) {
        try {
          await service.execute('mail', failingFn);
        } catch (error) {
          // Expected
        }
      }

      const state = service.getState('mail');
      expect(state?.state).toBe('open');
    });
  });

  describe('state tracking', () => {
    it('should track failure count', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('Test failure'));

      try {
        await service.execute('stellar', failingFn);
      } catch (error) {
        // Expected
      }

      const state = service.getState('stellar');
      expect(state?.failureCount).toBeGreaterThan(0);
    });

    it('should track success count', async () => {
      const successFn = jest.fn().mockResolvedValue('success');

      await service.execute('stellar', successFn);

      const state = service.getState('stellar');
      expect(state?.successCount).toBeGreaterThan(0);
    });

    it('should track last state change timestamp', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('Test failure'));

      const beforeTime = new Date();

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await service.execute('stellar', failingFn);
        } catch (error) {
          // Expected
        }
      }

      const state = service.getState('stellar');
      expect(state?.lastStateChange.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    });
  });

  describe('manual reset', () => {
    it('should manually reset a circuit breaker', async () => {
      const failingFn = jest.fn().mockRejectedValue(new Error('Test failure'));

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await service.execute('stellar', failingFn);
        } catch (error) {
          // Expected
        }
      }

      expect(service.getState('stellar')?.state).toBe('open');

      // Manual reset
      service.reset('stellar');

      expect(service.getState('stellar')?.state).toBe('closed');
      expect(service.getState('stellar')?.failureCount).toBe(0);
      expect(service.getState('stellar')?.successCount).toBe(0);
    });
  });

  describe('detailed stats', () => {
    it('should return detailed stats for all circuit breakers', () => {
      const stats = service.getDetailedStats();

      expect(stats).toHaveLength(4);
      expect(stats.every((s) => s.service && s.state && s.lastStateChange)).toBe(true);
    });
  });
});
