import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantBranding } from '../entities/tenant-branding.entity';
import { UpdateTenantBrandingDto } from '../dto/update-tenant-branding.dto';
import { AuditLogService } from '../../common/services/audit-log.service';

const ALLOWED_LOGO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export interface LogoUploadValidation {
  mimeType: string;
  sizeBytes: number;
}

@Injectable()
export class TenantBrandingService {
  private readonly logger = new Logger(TenantBrandingService.name);

  constructor(
    @InjectRepository(TenantBranding)
    private readonly brandingRepository: Repository<TenantBranding>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async getBranding(tenantId: string): Promise<TenantBranding> {
    const branding = await this.brandingRepository.findOne({ where: { tenantId } });
    if (!branding) {
      throw new NotFoundException(`Branding not found for tenant ${tenantId}`);
    }
    return branding;
  }

  async getBrandingOrDefault(tenantId: string): Promise<Partial<TenantBranding>> {
    const branding = await this.brandingRepository.findOne({ where: { tenantId } });
    return branding ?? { primaryColor: '#667eea', secondaryColor: '#764ba2' };
  }

  async upsertBranding(
    tenantId: string,
    dto: UpdateTenantBrandingDto,
    userId: string,
  ): Promise<TenantBranding> {
    let branding = await this.brandingRepository.findOne({ where: { tenantId } });
    const isNew = !branding;

    if (isNew) {
      branding = this.brandingRepository.create({ tenantId });
    }

    Object.assign(branding, dto, { updatedBy: userId });
    const saved = await this.brandingRepository.save(branding);

    await this.auditLogService.create({
      operation: isNew ? 'CREATE_TENANT_BRANDING' : 'UPDATE_TENANT_BRANDING',
      entityType: 'tenant_branding',
      entityId: saved.id,
      userId,
      newValues: dto as Record<string, any>,
      status: 'success',
    });

    this.logger.log(`Branding ${isNew ? 'created' : 'updated'} for tenant ${tenantId}`);
    return saved;
  }

  validateLogoUpload(file: LogoUploadValidation): void {
    if (!ALLOWED_LOGO_MIME_TYPES.includes(file.mimeType)) {
      throw new BadRequestException(
        `Invalid logo type. Allowed: ${ALLOWED_LOGO_MIME_TYPES.join(', ')}`,
      );
    }
    if (file.sizeBytes > MAX_LOGO_SIZE_BYTES) {
      throw new BadRequestException(
        `Logo exceeds maximum size of ${MAX_LOGO_SIZE_BYTES / 1024 / 1024} MB`,
      );
    }
  }
}
