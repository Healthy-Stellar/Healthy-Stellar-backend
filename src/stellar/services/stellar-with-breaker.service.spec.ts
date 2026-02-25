import { Test, TestingModule } from '@nestjs/testing';
import { StellarWithBreakerService } from './stellar-with-breaker.service';
import { StellarService } from './stellar.service';
import { CircuitBreakerService } from '../../common/circuit-breaker/circuit-breaker.service';
import { CircuitOpenException } from '../../common/circuit-breaker/exceptions/circuit-open.exception';
import { BrokenCircuitError } from 'cockatiel';

describe('StellarWithBreakerService', () => {
  let service: StellarWithBreakerService;
  let stellarService: jest.Mocked<StellarService>;
  let circuitBreaker: jest.Mocked<CircuitBreakerService>;

  beforeEach(async () => {
    const mockStellarService = {
      anchorRecord: jest.fn(),
      grantAccess: jest.fn(),
      revokeAccess: jest.fn(),
      verifyAccess: jest.fn(),
    };

    const mockCircuitBreaker = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StellarWithBreakerService,
        {
          provide: StellarService,
          useValue: mockStellarService,
        },
        {
          provide: CircuitBreakerService,
          useValue: mockCircuitBreaker,
        },
      ],
    }).compile();

    service = module.get<StellarWithBreakerService>(StellarWithBreakerService);
    stellarService = module.get(StellarService);
    circuitBreaker = module.get(CircuitBreakerService);
  });

  describe('anchorRecord', () => {
    it('should execute through circuit breaker', async () => {
      const mockResult = { txHash: 'tx-123', ledger: 12345, confirmedAt: Date.now() };
      stellarService.anchorRecord.mockResolvedValue(mockResult);
      circuitBreaker.execute.mockImplementation((_, fn) => fn());

      const result = await service.anchorRecord('patient-1', 'cid-abc');

      expect(circuitBreaker.execute).toHaveBeenCalledWith('stellar', expect.any(Function));
      expect(stellarService.anchorRecord).toHaveBeenCalledWith('patient-1', 'cid-abc');
      expect(result).toEqual(mockResult);
    });

    it('should throw CircuitOpenException when circuit is open', async () => {
      circuitBreaker.execute.mockRejectedValue(new BrokenCircuitError());

      await expect(service.anchorRecord('patient-1', 'cid-abc')).rejects.toThrow(
        CircuitOpenException,
      );
    });

    it('should include retry-after in exception', async () => {
      circuitBreaker.execute.mockRejectedValue(new BrokenCircuitError());

      try {
        await service.anchorRecord('patient-1', 'cid-abc');
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitOpenException);
        expect((error as CircuitOpenException).getRetryAfterSeconds()).toBe(60);
      }
    });
  });

  describe('grantAccess', () => {
    it('should execute through circuit breaker', async () => {
      const mockResult = { txHash: 'tx-456', ledger: 12346, confirmedAt: Date.now() };
      const expiresAt = new Date('2025-12-31');
      stellarService.grantAccess.mockResolvedValue(mockResult);
      circuitBreaker.execute.mockImplementation((_, fn) => fn());

      const result = await service.grantAccess('patient-1', 'doctor-1', 'record-1', expiresAt);

      expect(circuitBreaker.execute).toHaveBeenCalledWith('stellar', expect.any(Function));
      expect(stellarService.grantAccess).toHaveBeenCalledWith(
        'patient-1',
        'doctor-1',
        'record-1',
        expiresAt,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('revokeAccess', () => {
    it('should execute through circuit breaker', async () => {
      const mockResult = { txHash: 'tx-789', ledger: 12347, confirmedAt: Date.now() };
      stellarService.revokeAccess.mockResolvedValue(mockResult);
      circuitBreaker.execute.mockImplementation((_, fn) => fn());

      const result = await service.revokeAccess('patient-1', 'doctor-1', 'record-1');

      expect(circuitBreaker.execute).toHaveBeenCalledWith('stellar', expect.any(Function));
      expect(stellarService.revokeAccess).toHaveBeenCalledWith('patient-1', 'doctor-1', 'record-1');
      expect(result).toEqual(mockResult);
    });
  });

  describe('verifyAccess', () => {
    it('should execute through circuit breaker', async () => {
      const mockResult = { hasAccess: true, expiresAt: '2025-12-31T00:00:00.000Z' };
      stellarService.verifyAccess.mockResolvedValue(mockResult);
      circuitBreaker.execute.mockImplementation((_, fn) => fn());

      const result = await service.verifyAccess('doctor-1', 'record-1');

      expect(circuitBreaker.execute).toHaveBeenCalledWith('stellar', expect.any(Function));
      expect(stellarService.verifyAccess).toHaveBeenCalledWith('doctor-1', 'record-1');
      expect(result).toEqual(mockResult);
    });
  });

  describe('error handling', () => {
    it('should propagate non-circuit errors', async () => {
      const error = new Error('Network timeout');
      circuitBreaker.execute.mockRejectedValue(error);

      await expect(service.anchorRecord('patient-1', 'cid-abc')).rejects.toThrow('Network timeout');
    });
  });
});
