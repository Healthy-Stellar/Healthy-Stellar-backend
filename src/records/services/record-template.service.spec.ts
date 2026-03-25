import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RecordTemplateService } from './record-template.service';
import { RecordTemplate } from '../entities/record-template.entity';
import { Record } from '../entities/record.entity';
import { RecordType } from '../dto/create-record.dto';

const PROVIDER_ID = 'provider-uuid-1';
const OTHER_PROVIDER_ID = 'provider-uuid-2';
const TEMPLATE_ID = 'template-uuid-1';

const mockTemplate: RecordTemplate = {
  id: TEMPLATE_ID,
  providerId: PROVIDER_ID,
  name: 'Standard Lab Result',
  recordType: RecordType.LAB_RESULT,
  schemaJson: { fields: ['testName', 'result', 'unit'] },
  isPublic: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPublicTemplate: RecordTemplate = {
  ...mockTemplate,
  id: 'template-uuid-public',
  providerId: OTHER_PROVIDER_ID,
  isPublic: true,
};

describe('RecordTemplateService', () => {
  let service: RecordTemplateService;

  const mockTemplateRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockRecordRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockQb = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordTemplateService,
        { provide: getRepositoryToken(RecordTemplate), useValue: mockTemplateRepo },
        { provide: getRepositoryToken(Record), useValue: mockRecordRepo },
      ],
    }).compile();

    service = module.get<RecordTemplateService>(RecordTemplateService);
    jest.clearAllMocks();
    mockTemplateRepo.createQueryBuilder.mockReturnValue(mockQb);
  });

  describe('create', () => {
    it('should create a template with valid schemaJson', async () => {
      const dto = {
        name: 'Standard Lab Result',
        recordType: RecordType.LAB_RESULT,
        schemaJson: { fields: ['testName', 'result'] },
        isPublic: false,
      };

      mockTemplateRepo.create.mockReturnValue({ ...mockTemplate });
      mockTemplateRepo.save.mockResolvedValue(mockTemplate);

      const result = await service.create(PROVIDER_ID, dto);

      expect(mockTemplateRepo.create).toHaveBeenCalledWith({
        providerId: PROVIDER_ID,
        name: dto.name,
        recordType: dto.recordType,
        schemaJson: dto.schemaJson,
        isPublic: false,
      });
      expect(result).toEqual(mockTemplate);
    });

    it('should default isPublic to false when not provided', async () => {
      const dto = {
        name: 'Prescription Template',
        recordType: RecordType.PRESCRIPTION,
        schemaJson: { medication: '', dosage: '' },
      };

      mockTemplateRepo.create.mockReturnValue({ ...mockTemplate, isPublic: false });
      mockTemplateRepo.save.mockResolvedValue({ ...mockTemplate, isPublic: false });

      await service.create(PROVIDER_ID, dto);

      expect(mockTemplateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isPublic: false }),
      );
    });

    it('should create a public template when isPublic is true', async () => {
      const dto = {
        name: 'Public Lab Template',
        recordType: RecordType.LAB_RESULT,
        schemaJson: { fields: [] },
        isPublic: true,
      };

      mockTemplateRepo.create.mockReturnValue({ ...mockTemplate, isPublic: true });
      mockTemplateRepo.save.mockResolvedValue({ ...mockTemplate, isPublic: true });

      await service.create(PROVIDER_ID, dto);

      expect(mockTemplateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isPublic: true }),
      );
    });

    it('should throw BadRequestException for non-object schemaJson', async () => {
      const dto = {
        name: 'Bad Template',
        recordType: RecordType.LAB_RESULT,
        schemaJson: null as any,
      };

      await expect(service.create(PROVIDER_ID, dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for array schemaJson', async () => {
      const dto = {
        name: 'Bad Template',
        recordType: RecordType.LAB_RESULT,
        schemaJson: [] as any,
      };

      await expect(service.create(PROVIDER_ID, dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return public templates and own templates', async () => {
      const templates = [mockTemplate, mockPublicTemplate];
      mockQb.getMany.mockResolvedValue(templates);

      const result = await service.findAll(PROVIDER_ID);

      expect(mockTemplateRepo.createQueryBuilder).toHaveBeenCalledWith('t');
      expect(mockQb.where).toHaveBeenCalledWith(
        't.isPublic = :isPublic OR t.providerId = :providerId',
        { isPublic: true, providerId: PROVIDER_ID },
      );
      expect(result).toEqual(templates);
    });

    it('should return empty array when no templates match', async () => {
      mockQb.getMany.mockResolvedValue([]);

      const result = await service.findAll('unknown-provider');

      expect(result).toEqual([]);
    });
  });

  describe('createRecordFromTemplate', () => {
    const dto = { patientId: 'patient-1', description: 'Custom desc' };

    it('should create a record pre-filled with template recordType', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(mockTemplate);
      const savedRecord = {
        id: 'record-1',
        patientId: 'patient-1',
        recordType: RecordType.LAB_RESULT,
        description: 'Custom desc',
        cid: '',
        stellarTxHash: '',
        createdAt: new Date(),
      };
      mockRecordRepo.create.mockReturnValue(savedRecord);
      mockRecordRepo.save.mockResolvedValue(savedRecord);

      const result = await service.createRecordFromTemplate(TEMPLATE_ID, PROVIDER_ID, dto);

      expect(mockRecordRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: 'patient-1',
          recordType: RecordType.LAB_RESULT,
          description: 'Custom desc',
        }),
      );
      expect(result.recordType).toBe(RecordType.LAB_RESULT);
    });

    it('should use default description from template name when not provided', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(mockTemplate);
      mockRecordRepo.create.mockReturnValue({});
      mockRecordRepo.save.mockResolvedValue({});

      await service.createRecordFromTemplate(TEMPLATE_ID, PROVIDER_ID, { patientId: 'p-1' });

      expect(mockRecordRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: `Created from template: ${mockTemplate.name}`,
        }),
      );
    });

    it('should merge fieldValues into template schemaJson', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(mockTemplate);
      mockRecordRepo.create.mockReturnValue({});
      mockRecordRepo.save.mockResolvedValue({});

      await service.createRecordFromTemplate(TEMPLATE_ID, PROVIDER_ID, {
        patientId: 'p-1',
        fieldValues: { result: 'Positive' },
      });

      // Service should not throw and should call create
      expect(mockRecordRepo.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when template does not exist', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createRecordFromTemplate('non-existent', PROVIDER_ID, dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when accessing private template of another provider', async () => {
      const privateOtherTemplate = { ...mockTemplate, providerId: OTHER_PROVIDER_ID, isPublic: false };
      mockTemplateRepo.findOne.mockResolvedValue(privateOtherTemplate);

      await expect(
        service.createRecordFromTemplate(TEMPLATE_ID, PROVIDER_ID, dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow access to public template from another provider', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(mockPublicTemplate);
      mockRecordRepo.create.mockReturnValue({});
      mockRecordRepo.save.mockResolvedValue({ recordType: RecordType.LAB_RESULT });

      const result = await service.createRecordFromTemplate(
        mockPublicTemplate.id,
        PROVIDER_ID,
        dto,
      );

      expect(mockRecordRepo.save).toHaveBeenCalled();
    });

    it('should allow owner to access their own private template', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(mockTemplate);
      mockRecordRepo.create.mockReturnValue({});
      mockRecordRepo.save.mockResolvedValue({ recordType: RecordType.LAB_RESULT });

      await expect(
        service.createRecordFromTemplate(TEMPLATE_ID, PROVIDER_ID, dto),
      ).resolves.not.toThrow();
    });
  });
});
