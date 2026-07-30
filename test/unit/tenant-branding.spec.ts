import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TenantBrandingService } from '../../src/tenant-config/services/tenant-branding.service';
import { TenantBranding } from '../../src/tenant-config/entities/tenant-branding.entity';
import { AuditLogService } from '../../src/common/services/audit-log.service';
import { BadRequestException } from '@nestjs/common';

const TENANT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const mockBranding: Partial<TenantBranding> = {
  id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  tenantId: TENANT_ID,
  logoUrl: 'https://cdn.hospital.com/logo.png',
  primaryColor: '#003366',
  secondaryColor: '#0066cc',
  customDomain: 'portal.hospital.com',
  supportEmail: 'support@hospital.com',
  supportPhone: '+1-800-555-0100',
  organizationName: 'City General Hospital',
};

describe('TenantBrandingService — branding propagation', () => {
  let service: TenantBrandingService;

  const mockRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockAudit = { create: jest.fn().mockResolvedValue({}) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantBrandingService,
        { provide: getRepositoryToken(TenantBranding), useValue: mockRepo },
        { provide: AuditLogService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get(TenantBrandingService);
    jest.clearAllMocks();
  });

  it('getBrandingOrDefault returns stored branding for a tenant', async () => {
    mockRepo.findOne.mockResolvedValue(mockBranding);

    const result = await service.getBrandingOrDefault(TENANT_ID);

    expect(result.primaryColor).toBe('#003366');
    expect(result.logoUrl).toBe('https://cdn.hospital.com/logo.png');
    expect(result.organizationName).toBe('City General Hospital');
    expect(result.supportEmail).toBe('support@hospital.com');
  });

  it('getBrandingOrDefault returns default colors when no branding configured', async () => {
    mockRepo.findOne.mockResolvedValue(null);

    const result = await service.getBrandingOrDefault(TENANT_ID);

    expect(result.primaryColor).toBe('#667eea');
    expect(result.secondaryColor).toBe('#764ba2');
  });

  it('upsertBranding creates new branding and returns all fields', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    mockRepo.create.mockReturnValue({ tenantId: TENANT_ID });
    mockRepo.save.mockResolvedValue(mockBranding);

    const saved = await service.upsertBranding(
      TENANT_ID,
      {
        logoUrl: 'https://cdn.hospital.com/logo.png',
        primaryColor: '#003366',
        secondaryColor: '#0066cc',
        customDomain: 'portal.hospital.com',
        supportEmail: 'support@hospital.com',
        supportPhone: '+1-800-555-0100',
        organizationName: 'City General Hospital',
      },
      'user-uuid',
    );

    expect(saved.primaryColor).toBe('#003366');
    expect(saved.customDomain).toBe('portal.hospital.com');
    expect(mockAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'CREATE_TENANT_BRANDING' }),
    );
  });

  it('upsertBranding updates existing branding', async () => {
    mockRepo.findOne.mockResolvedValue({ ...mockBranding });
    mockRepo.save.mockResolvedValue({ ...mockBranding, primaryColor: '#ff0000' });

    const saved = await service.upsertBranding(TENANT_ID, { primaryColor: '#ff0000' }, 'user-uuid');

    expect(saved.primaryColor).toBe('#ff0000');
    expect(mockAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'UPDATE_TENANT_BRANDING' }),
    );
  });

  describe('validateLogoUpload', () => {
    it('accepts valid PNG under size limit', () => {
      expect(() =>
        service.validateLogoUpload({ mimeType: 'image/png', sizeBytes: 500_000 }),
      ).not.toThrow();
    });

    it('rejects unsupported MIME type', () => {
      expect(() =>
        service.validateLogoUpload({ mimeType: 'image/gif', sizeBytes: 100 }),
      ).toThrow(BadRequestException);
    });

    it('rejects file exceeding 2 MB', () => {
      expect(() =>
        service.validateLogoUpload({ mimeType: 'image/png', sizeBytes: 3 * 1024 * 1024 }),
      ).toThrow(BadRequestException);
    });
  });

  it('branding fields map correctly to email template context', async () => {
    mockRepo.findOne.mockResolvedValue(mockBranding);

    const branding = await service.getBrandingOrDefault(TENANT_ID);

    const emailContext = {
      organizationName: branding.organizationName ?? 'MedChain',
      logoUrl: branding.logoUrl ?? '',
      primaryColor: branding.primaryColor ?? '#667eea',
      secondaryColor: branding.secondaryColor ?? '#764ba2',
      supportEmail: branding.supportEmail ?? '',
      supportPhone: branding.supportPhone ?? '',
    };

    expect(emailContext.organizationName).toBe('City General Hospital');
    expect(emailContext.logoUrl).toBe('https://cdn.hospital.com/logo.png');
    expect(emailContext.primaryColor).toBe('#003366');
    expect(emailContext.supportEmail).toBe('support@hospital.com');
  });
});
