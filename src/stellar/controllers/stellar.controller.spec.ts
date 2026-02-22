import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { StellarController } from './stellar.controller';
import { StellarFeeService } from '../services/stellar-fee.service';

describe('StellarController', () => {
  let controller: StellarController;
  let feeService: StellarFeeService;

  const mockFeeEstimate = {
    baseFee: '100',
    recommended: '150',
    networkCongestion: 'low' as const,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StellarController],
      providers: [
        {
          provide: StellarFeeService,
          useValue: {
            getFeeEstimate: jest.fn(),
            getSupportedOperations: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<StellarController>(StellarController);
    feeService = module.get<StellarFeeService>(StellarFeeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getFeeEstimate', () => {
    it('should return fee estimate for valid operation', async () => {
      // Arrange
      jest.spyOn(feeService, 'getFeeEstimate').mockResolvedValue(mockFeeEstimate);

      // Act
      const result = await controller.getFeeEstimate('anchorRecord');

      // Assert
      expect(result).toEqual(mockFeeEstimate);
      expect(feeService.getFeeEstimate).toHaveBeenCalledWith('anchorRecord');
    });

    it('should handle anchorRecord operation', async () => {
      // Arrange
      jest.spyOn(feeService, 'getFeeEstimate').mockResolvedValue(mockFeeEstimate);

      // Act
      const result = await controller.getFeeEstimate('anchorRecord');

      // Assert
      expect(result).toEqual(mockFeeEstimate);
      expect(feeService.getFeeEstimate).toHaveBeenCalledWith('anchorRecord');
    });

    it('should handle grantAccess operation', async () => {
      // Arrange
      jest.spyOn(feeService, 'getFeeEstimate').mockResolvedValue(mockFeeEstimate);

      // Act
      const result = await controller.getFeeEstimate('grantAccess');

      // Assert
      expect(result).toEqual(mockFeeEstimate);
      expect(feeService.getFeeEstimate).toHaveBeenCalledWith('grantAccess');
    });

    it('should handle revokeAccess operation', async () => {
      // Arrange
      jest.spyOn(feeService, 'getFeeEstimate').mockResolvedValue(mockFeeEstimate);

      // Act
      const result = await controller.getFeeEstimate('revokeAccess');

      // Assert
      expect(result).toEqual(mockFeeEstimate);
      expect(feeService.getFeeEstimate).toHaveBeenCalledWith('revokeAccess');
    });

    it('should throw BadRequestException for invalid operation', async () => {
      // Arrange
      jest
        .spyOn(feeService, 'getFeeEstimate')
        .mockRejectedValue(
          new BadRequestException('Invalid operation'),
        );

      // Act & Assert
      await expect(controller.getFeeEstimate('invalidOp')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ServiceUnavailableException when Horizon is down', async () => {
      // Arrange
      jest
        .spyOn(feeService, 'getFeeEstimate')
        .mockRejectedValue(
          new ServiceUnavailableException('Horizon unavailable'),
        );

      // Act & Assert
      await expect(
        controller.getFeeEstimate('anchorRecord'),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('should return different congestion levels', async () => {
      // Arrange - Low congestion
      const lowCongestion = { ...mockFeeEstimate, networkCongestion: 'low' as const };
      jest.spyOn(feeService, 'getFeeEstimate').mockResolvedValue(lowCongestion);

      // Act
      const lowResult = await controller.getFeeEstimate('anchorRecord');

      // Assert
      expect(lowResult.networkCongestion).toBe('low');

      // Arrange - High congestion
      const highCongestion = { ...mockFeeEstimate, networkCongestion: 'high' as const };
      jest.spyOn(feeService, 'getFeeEstimate').mockResolvedValue(highCongestion);

      // Act
      const highResult = await controller.getFeeEstimate('anchorRecord');

      // Assert
      expect(highResult.networkCongestion).toBe('high');
    });
  });

  describe('getSupportedOperations', () => {
    it('should return list of supported operations', () => {
      // Arrange
      const operations = ['anchorRecord', 'grantAccess', 'revokeAccess'];
      jest.spyOn(feeService, 'getSupportedOperations').mockReturnValue(operations);

      // Act
      const result = controller.getSupportedOperations();

      // Assert
      expect(result).toEqual({ operations });
      expect(feeService.getSupportedOperations).toHaveBeenCalled();
    });

    it('should return array with all three operations', () => {
      // Arrange
      const operations = ['anchorRecord', 'grantAccess', 'revokeAccess'];
      jest.spyOn(feeService, 'getSupportedOperations').mockReturnValue(operations);

      // Act
      const result = controller.getSupportedOperations();

      // Assert
      expect(result.operations).toHaveLength(3);
      expect(result.operations).toContain('anchorRecord');
      expect(result.operations).toContain('grantAccess');
      expect(result.operations).toContain('revokeAccess');
    });
  });
});
