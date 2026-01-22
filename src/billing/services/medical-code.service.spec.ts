import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MedicalCodeService } from './medical-code.service';
import { MedicalCode } from '../entities/medical-code.entity';
import { CodeType } from '../../common/enums';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('MedicalCodeService', () => {
  let service: MedicalCodeService;
  let repository: Repository<MedicalCode>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedicalCodeService,
        {
          provide: getRepositoryToken(MedicalCode),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<MedicalCodeService>(MedicalCodeService);
    repository = module.get<Repository<MedicalCode>>(getRepositoryToken(MedicalCode));
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      code: '99213',
      codeType: CodeType.CPT,
      description: 'Office or other outpatient visit',
      standardCharge: 150,
    };

    it('should create a new medical code', async () => {
      const mockCode = { id: '1', ...createDto };
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockCode);
      mockRepository.save.mockResolvedValue(mockCode);

      const result = await service.create(createDto);

      expect(result).toEqual(mockCode);
      expect(mockRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        code: '99213',
        codeType: CodeType.CPT,
      }));
    });

    it('should throw ConflictException if code already exists', async () => {
      mockRepository.findOne.mockResolvedValue({ id: '1', ...createDto });

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findById', () => {
    it('should return a medical code by ID', async () => {
      const mockCode = { id: '1', code: '99213', codeType: CodeType.CPT };
      mockRepository.findOne.mockResolvedValue(mockCode);

      const result = await service.findById('1');

      expect(result).toEqual(mockCode);
    });

    it('should throw NotFoundException if code not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByCode', () => {
    it('should return a medical code by code and type', async () => {
      const mockCode = { id: '1', code: '99213', codeType: CodeType.CPT, isActive: true };
      mockRepository.findOne.mockResolvedValue(mockCode);

      const result = await service.findByCode('99213', CodeType.CPT);

      expect(result).toEqual(mockCode);
    });

    it('should return null if code not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findByCode('99999', CodeType.CPT);

      expect(result).toBeNull();
    });
  });

  describe('search', () => {
    it('should return paginated results', async () => {
      const mockCodes = [
        { id: '1', code: '99213', codeType: CodeType.CPT },
        { id: '2', code: '99214', codeType: CodeType.CPT },
      ];
      mockRepository.findAndCount.mockResolvedValue([mockCodes, 2]);

      const result = await service.search({ page: 1, limit: 20 });

      expect(result.data).toEqual(mockCodes);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should filter by code type', async () => {
      mockRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.search({ codeType: CodeType.ICD10_CM });

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ codeType: CodeType.ICD10_CM }),
        }),
      );
    });
  });

  describe('update', () => {
    it('should update a medical code', async () => {
      const existingCode = { id: '1', code: '99213', description: 'Old description' };
      const updatedCode = { ...existingCode, description: 'New description' };

      mockRepository.findOne.mockResolvedValue(existingCode);
      mockRepository.save.mockResolvedValue(updatedCode);

      const result = await service.update('1', { description: 'New description' });

      expect(result.description).toBe('New description');
    });
  });

  describe('delete', () => {
    it('should delete a medical code', async () => {
      const mockCode = { id: '1', code: '99213' };
      mockRepository.findOne.mockResolvedValue(mockCode);
      mockRepository.remove.mockResolvedValue(mockCode);

      await service.delete('1');

      expect(mockRepository.remove).toHaveBeenCalledWith(mockCode);
    });
  });

  describe('deactivate', () => {
    it('should deactivate a medical code', async () => {
      const mockCode = { id: '1', code: '99213', isActive: true };
      mockRepository.findOne.mockResolvedValue(mockCode);
      mockRepository.save.mockResolvedValue({ ...mockCode, isActive: false });

      const result = await service.deactivate('1');

      expect(result.isActive).toBe(false);
    });
  });

  describe('validateCodes', () => {
    it('should return valid for existing codes', async () => {
      mockRepository.findOne.mockResolvedValue({ id: '1', code: '99213', isActive: true });

      const result = await service.validateCodes([
        { code: '99213', codeType: CodeType.CPT },
      ]);

      expect(result.valid).toBe(true);
      expect(result.invalidCodes).toHaveLength(0);
    });

    it('should return invalid codes list', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.validateCodes([
        { code: '99999', codeType: CodeType.CPT },
      ]);

      expect(result.valid).toBe(false);
      expect(result.invalidCodes).toContain('CPT:99999');
    });
  });
});
