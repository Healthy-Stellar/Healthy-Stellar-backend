import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleTemplateService } from './role-template.service';
import { RoleTemplate, RoleTemplateCategory } from '../entities/role-template.entity';
import { MedicalPermission, MedicalRole } from '../enums/medical-roles.enum';

describe('RoleTemplateService', () => {
  let service: RoleTemplateService;
  let repo: Repository<RoleTemplate>;

  const mockTemplate = {
    id: 'template-1',
    name: 'Ward Nurse',
    description: 'Standard ward nursing staff',
    category: RoleTemplateCategory.CLINICAL,
    version: 1,
    permissions: [
      MedicalPermission.READ_PATIENT_BASIC,
      MedicalPermission.READ_PATIENT_FULL,
      MedicalPermission.READ_MEDICAL_RECORDS,
    ],
    departmentAccess: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: { mappedRole: MedicalRole.NURSE },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleTemplateService,
        {
          provide: getRepositoryToken(RoleTemplate),
          useValue: {
            count: jest.fn().mockResolvedValue(0),
            findOne: jest.fn().mockResolvedValue(null),
            find: jest.fn().mockResolvedValue([mockTemplate]),
            create: jest.fn().mockReturnValue(mockTemplate),
            save: jest.fn().mockResolvedValue(mockTemplate),
          },
        },
      ],
    }).compile();

    service = module.get<RoleTemplateService>(RoleTemplateService);
    repo = module.get<Repository<RoleTemplate>>(getRepositoryToken(RoleTemplate));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listTemplates', () => {
    it('should return all active templates', async () => {
      const result = await service.listTemplates();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Ward Nurse');
    });

    it('should filter by category', async () => {
      jest.spyOn(repo, 'find').mockResolvedValue([mockTemplate]);
      const result = await service.listTemplates(RoleTemplateCategory.CLINICAL);
      expect(result).toHaveLength(1);
    });
  });

  describe('getTemplateById', () => {
    it('should return template when found', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(mockTemplate);
      const result = await service.getTemplateById('template-1');
      expect(result).toBeDefined();
      expect(result.name).toBe('Ward Nurse');
    });

    it('should throw NotFoundException when not found', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(null);
      await expect(service.getTemplateById('nonexistent')).rejects.toThrow();
    });
  });

  describe('instantiateRole', () => {
    it('should instantiate a role from template', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(mockTemplate);
      const result = await service.instantiateRole({
        templateId: 'template-1',
        tenantId: 'tenant-1',
      });
      expect(result.grantedPermissions).toHaveLength(3);
      expect(result.roleName).toBe('Ward Nurse');
    });

    it('should apply permission overrides', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(mockTemplate);
      const result = await service.instantiateRole({
        templateId: 'template-1',
        tenantId: 'tenant-1',
        roleName: 'Senior Nurse',
        permissionOverrides: {
          add: [MedicalPermission.WRITE_PRESCRIPTIONS],
          remove: [MedicalPermission.READ_PATIENT_FULL],
        },
      });
      expect(result.roleName).toBe('Senior Nurse');
      expect(result.grantedPermissions).toContain(MedicalPermission.WRITE_PRESCRIPTIONS);
      expect(result.grantedPermissions).not.toContain(MedicalPermission.READ_PATIENT_FULL);
    });
  });

  describe('syncToLatestVersion', () => {
    it('should detect added and removed permissions', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(mockTemplate);
      const result = await service.syncToLatestVersion('template-1', [
        MedicalPermission.READ_PATIENT_BASIC,
      ]);
      expect(result.added).toHaveLength(2);
      expect(result.removed).toHaveLength(0);
    });
  });

  describe('seedTemplates', () => {
    it('should seed templates when DB is empty', async () => {
      await service.seedTemplates();
      expect(repo.save).toHaveBeenCalled();
    });
  });
});
