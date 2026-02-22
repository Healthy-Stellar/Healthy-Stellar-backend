import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AxiosResponse, AxiosError } from 'axios';
import { StellarFeeService } from './stellar-fee.service';
import { StellarCacheService } from './stellar-cache.service';
import { HorizonFeeStatsResponse } from '../interfaces/fee-estimate.interface';

describe('StellarFeeService', () => {
  let service: StellarFeeService;
  let httpService: HttpService;
  let cacheService: StellarCacheService;
  let configService: ConfigService;

  const mockHorizonResponse: HorizonFeeStatsResponse = {
    last_ledger: '12345',
    last_ledger_base_fee: '100',
    ledger_capacity_usage: '0.3',
    fee_charged: {
      max: '500',
      min: '100',
      mode: '100',
      p10: '100',
      p20: '100',
      p30: '100',
      p40: '100',
      p50: '150',
      p60: '200',
      p70: '250',
      p80: '300',
      p90: '400',
      p95: '450',
      p99: '500',
    },
    max_fee: {
      max: '1000',
      min: '100',
      mode: '100',
      p10: '100',
      p20: '100',
      p30: '100',
      p40: '100',
      p50: '200',
      p60: '300',
      p70: '400',
      p80: '500',
      p90: '700',
      p95: '850',
      p99: '1000',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StellarFeeService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'STELLAR_HORIZON_URL') {
                return 'https://horizon-testnet.stellar.org';
              }
              return defaultValue;
            }),
          },
        },
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: StellarCacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            clear: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<StellarFeeService>(StellarFeeService);
    httpService = module.get<HttpService>(HttpService);
    cacheService = module.get<StellarCacheService>(StellarCacheService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getFeeEstimate', () => {
    it('should return cached fee estimate if available', async () => {
      // Arrange
      const cachedData = {
        baseFee: '100',
        recommended: '150',
        networkCongestion: 'low' as const,
      };
      jest.spyOn(cacheService, 'get').mockReturnValue(cachedData);

      // Act
      const result = await service.getFeeEstimate('anchorRecord');

      // Assert
      expect(result).toEqual(cachedData);
      expect(cacheService.get).toHaveBeenCalledWith('fee-estimate:anchorRecord');
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it('should fetch from Horizon and cache result on cache miss', async () => {
      // Arrange
      jest.spyOn(cacheService, 'get').mockReturnValue(null);
      const axiosResponse: AxiosResponse<HorizonFeeStatsResponse> = {
        data: mockHorizonResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      jest.spyOn(httpService, 'get').mockReturnValue(of(axiosResponse));

      // Act
      const result = await service.getFeeEstimate('anchorRecord');

      // Assert
      expect(result).toHaveProperty('baseFee', '100');
      expect(result).toHaveProperty('recommended');
      expect(result).toHaveProperty('networkCongestion');
      expect(cacheService.set).toHaveBeenCalledWith(
        'fee-estimate:anchorRecord',
        result,
      );
    });

    it('should throw BadRequestException for invalid operation', async () => {
      // Act & Assert
      await expect(service.getFeeEstimate('invalidOperation')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should calculate higher fee for anchorRecord operation', async () => {
      // Arrange
      jest.spyOn(cacheService, 'get').mockReturnValue(null);
      const axiosResponse: AxiosResponse<HorizonFeeStatsResponse> = {
        data: mockHorizonResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      jest.spyOn(httpService, 'get').mockReturnValue(of(axiosResponse));

      // Act
      const anchorResult = await service.getFeeEstimate('anchorRecord');
      
      jest.spyOn(cacheService, 'get').mockReturnValue(null);
      jest.spyOn(httpService, 'get').mockReturnValue(of(axiosResponse));
      
      const revokeResult = await service.getFeeEstimate('revokeAccess');

      // Assert - anchorRecord should have higher fee due to 1.5x multiplier
      expect(parseInt(anchorResult.recommended)).toBeGreaterThan(
        parseInt(revokeResult.recommended),
      );
    });

    it('should handle Horizon API timeout', async () => {
      // Arrange
      jest.spyOn(cacheService, 'get').mockReturnValue(null);
      const timeoutError = new Error('Timeout') as AxiosError;
      timeoutError.code = 'ETIMEDOUT';
      jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => timeoutError));

      // Act & Assert
      await expect(
        service.getFeeEstimate('anchorRecord'),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('should handle Horizon API connection error', async () => {
      // Arrange
      jest.spyOn(cacheService, 'get').mockReturnValue(null);
      const connectionError = new Error('Connection refused') as AxiosError;
      connectionError.code = 'ECONNREFUSED';
      jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => connectionError));

      // Act & Assert
      await expect(
        service.getFeeEstimate('anchorRecord'),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('should handle Horizon API HTTP error', async () => {
      // Arrange
      jest.spyOn(cacheService, 'get').mockReturnValue(null);
      const httpError = new Error('HTTP Error') as AxiosError;
      httpError.response = {
        status: 503,
        statusText: 'Service Unavailable',
        data: {},
        headers: {},
        config: {} as any,
      };
      jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => httpError));

      // Act & Assert
      await expect(
        service.getFeeEstimate('anchorRecord'),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('Network Congestion Calculation', () => {
    it('should return low congestion for capacity < 0.5', async () => {
      // Arrange
      jest.spyOn(cacheService, 'get').mockReturnValue(null);
      const lowCongestionResponse = {
        ...mockHorizonResponse,
        ledger_capacity_usage: '0.3',
      };
      const axiosResponse: AxiosResponse<HorizonFeeStatsResponse> = {
        data: lowCongestionResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      jest.spyOn(httpService, 'get').mockReturnValue(of(axiosResponse));

      // Act
      const result = await service.getFeeEstimate('anchorRecord');

      // Assert
      expect(result.networkCongestion).toBe('low');
    });

    it('should return medium congestion for capacity 0.5-0.75', async () => {
      // Arrange
      jest.spyOn(cacheService, 'get').mockReturnValue(null);
      const mediumCongestionResponse = {
        ...mockHorizonResponse,
        ledger_capacity_usage: '0.6',
      };
      const axiosResponse: AxiosResponse<HorizonFeeStatsResponse> = {
        data: mediumCongestionResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      jest.spyOn(httpService, 'get').mockReturnValue(of(axiosResponse));

      // Act
      const result = await service.getFeeEstimate('anchorRecord');

      // Assert
      expect(result.networkCongestion).toBe('medium');
    });

    it('should return high congestion for capacity > 0.75', async () => {
      // Arrange
      jest.spyOn(cacheService, 'get').mockReturnValue(null);
      const highCongestionResponse = {
        ...mockHorizonResponse,
        ledger_capacity_usage: '0.9',
      };
      const axiosResponse: AxiosResponse<HorizonFeeStatsResponse> = {
        data: highCongestionResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      jest.spyOn(httpService, 'get').mockReturnValue(of(axiosResponse));

      // Act
      const result = await service.getFeeEstimate('anchorRecord');

      // Assert
      expect(result.networkCongestion).toBe('high');
    });
  });

  describe('getSupportedOperations', () => {
    it('should return list of supported operations', () => {
      // Act
      const operations = service.getSupportedOperations();

      // Assert
      expect(operations).toContain('anchorRecord');
      expect(operations).toContain('grantAccess');
      expect(operations).toContain('revokeAccess');
      expect(operations).toHaveLength(3);
    });
  });
});
