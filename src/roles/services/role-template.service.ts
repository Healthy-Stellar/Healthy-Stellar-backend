import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleTemplate, RoleTemplateCategory } from '../entities/role-template.entity';
import {
  MedicalRole,
  MedicalPermission,
  MedicalDepartment,
} from '../enums/medical-roles.enum';

export interface InstantiateRoleDto {
  templateId: string;
  tenantId: string;
  roleName?: string;
  permissionOverrides?: {
    add?: MedicalPermission[];
    remove?: MedicalPermission[];
  };
}

export interface RoleTemplateResponse {
  id: string;
  name: string;
  description: string;
  category: RoleTemplateCategory;
  version: number;
  permissions: MedicalPermission[];
  departmentAccess: string[];
  isActive: boolean;
}

@Injectable()
export class RoleTemplateService {
  private readonly logger = new Logger(RoleTemplateService.name);

  /** Predefined library of common hospital job function templates */
  private readonly predefinedTemplates: Array<{
    name: string;
    description: string;
    category: RoleTemplateCategory;
    permissions: MedicalPermission[];
    departmentAccess: string[];
    metadata?: Record<string, any>;
  }> = [
    {
      name: 'Ward Nurse',
      description: 'Standard ward nursing staff — patient care, medication administration, and documentation within assigned department.',
      category: RoleTemplateCategory.CLINICAL,
      permissions: [
        MedicalPermission.READ_PATIENT_BASIC,
        MedicalPermission.READ_PATIENT_FULL,
        MedicalPermission.WRITE_PATIENT_DATA,
        MedicalPermission.READ_MEDICAL_RECORDS,
        MedicalPermission.WRITE_MEDICAL_RECORDS,
        MedicalPermission.READ_LAB_RESULTS,
        MedicalPermission.READ_PRESCRIPTIONS,
        MedicalPermission.ACCESS_OWN_DEPARTMENT,
      ],
      departmentAccess: [],
      metadata: { mappedRole: MedicalRole.NURSE },
    },
    {
      name: 'Attending Physician',
      description: 'Attending physician with full patient record access, prescription writing, and cross-department consultation rights.',
      category: RoleTemplateCategory.CLINICAL,
      permissions: [
        MedicalPermission.READ_PATIENT_BASIC,
        MedicalPermission.READ_PATIENT_FULL,
        MedicalPermission.WRITE_PATIENT_DATA,
        MedicalPermission.READ_MEDICAL_RECORDS,
        MedicalPermission.WRITE_MEDICAL_RECORDS,
        MedicalPermission.READ_LAB_RESULTS,
        MedicalPermission.READ_PRESCRIPTIONS,
        MedicalPermission.WRITE_PRESCRIPTIONS,
        MedicalPermission.ACCESS_OWN_DEPARTMENT,
        MedicalPermission.EMERGENCY_OVERRIDE,
        MedicalPermission.RESEARCH_EXPORT,
      ],
      departmentAccess: [],
      metadata: { mappedRole: MedicalRole.DOCTOR },
    },
    {
      name: 'Lab Technician',
      description: 'Laboratory staff — processes lab requests, records results, and views patient basics for specimen identification.',
      category: RoleTemplateCategory.LABORATORY,
      permissions: [
        MedicalPermission.READ_PATIENT_BASIC,
        MedicalPermission.READ_LAB_RESULTS,
        MedicalPermission.WRITE_LAB_RESULTS,
        MedicalPermission.ACCESS_OWN_DEPARTMENT,
      ],
      departmentAccess: [MedicalDepartment.LABORATORY],
      metadata: { mappedRole: MedicalRole.LAB_TECHNICIAN },
    },
    {
      name: 'Billing Clerk',
      description: 'Billing and coding staff — views patient demographics and encounter data for insurance claims; no clinical write access.',
      category: RoleTemplateCategory.ADMINISTRATIVE,
      permissions: [
        MedicalPermission.READ_PATIENT_BASIC,
        MedicalPermission.ACCESS_OWN_DEPARTMENT,
      ],
      departmentAccess: [],
      metadata: { mappedRole: null, isBillingOnly: true },
    },
    {
      name: 'Pharmacist',
      description: 'Pharmacy staff — processes prescriptions, dispenses medications, and reviews patient medication history.',
      category: RoleTemplateCategory.PHARMACY,
      permissions: [
        MedicalPermission.READ_PATIENT_BASIC,
        MedicalPermission.READ_PRESCRIPTIONS,
        MedicalPermission.WRITE_PRESCRIPTIONS,
        MedicalPermission.DISPENSE_MEDICATIONS,
        MedicalPermission.ACCESS_OWN_DEPARTMENT,
      ],
      departmentAccess: [MedicalDepartment.PHARMACY],
      metadata: { mappedRole: MedicalRole.PHARMACIST },
    },
    {
      name: 'Emergency Department Physician',
      description: 'ED physician with elevated emergency override, cross-department access, and full clinical authority.',
      category: RoleTemplateCategory.EMERGENCY,
      permissions: [
        MedicalPermission.READ_PATIENT_BASIC,
        MedicalPermission.READ_PATIENT_FULL,
        MedicalPermission.WRITE_PATIENT_DATA,
        MedicalPermission.READ_MEDICAL_RECORDS,
        MedicalPermission.WRITE_MEDICAL_RECORDS,
        MedicalPermission.READ_LAB_RESULTS,
        MedicalPermission.WRITE_LAB_RESULTS,
        MedicalPermission.READ_PRESCRIPTIONS,
        MedicalPermission.WRITE_PRESCRIPTIONS,
        MedicalPermission.ACCESS_ANY_DEPARTMENT,
        MedicalPermission.EMERGENCY_OVERRIDE,
      ],
      departmentAccess: [MedicalDepartment.EMERGENCY],
      metadata: { mappedRole: MedicalRole.DOCTOR, isEmergency: true },
    },
    {
      name: 'System Administrator',
      description: 'Full system access — user management, audit log review, system configuration, and all clinical data.',
      category: RoleTemplateCategory.ADMINISTRATIVE,
      permissions: [
        MedicalPermission.READ_PATIENT_BASIC,
        MedicalPermission.READ_PATIENT_FULL,
        MedicalPermission.WRITE_PATIENT_DATA,
        MedicalPermission.DELETE_PATIENT_DATA,
        MedicalPermission.READ_MEDICAL_RECORDS,
        MedicalPermission.WRITE_MEDICAL_RECORDS,
        MedicalPermission.READ_LAB_RESULTS,
        MedicalPermission.WRITE_LAB_RESULTS,
        MedicalPermission.READ_PRESCRIPTIONS,
        MedicalPermission.WRITE_PRESCRIPTIONS,
        MedicalPermission.ACCESS_ANY_DEPARTMENT,
        MedicalPermission.MANAGE_STAFF,
        MedicalPermission.VIEW_AUDIT_LOGS,
        MedicalPermission.MANAGE_SYSTEM,
        MedicalPermission.EMERGENCY_OVERRIDE,
        MedicalPermission.RESEARCH_EXPORT,
      ],
      departmentAccess: [],
      metadata: { mappedRole: MedicalRole.ADMIN },
    },
    {
      name: 'Radiologist',
      description: 'Radiology specialist — views imaging orders and patient data within radiology, writes imaging reports.',
      category: RoleTemplateCategory.CLINICAL,
      permissions: [
        MedicalPermission.READ_PATIENT_BASIC,
        MedicalPermission.READ_PATIENT_FULL,
        MedicalPermission.READ_MEDICAL_RECORDS,
        MedicalPermission.WRITE_MEDICAL_RECORDS,
        MedicalPermission.READ_LAB_RESULTS,
        MedicalPermission.ACCESS_OWN_DEPARTMENT,
      ],
      departmentAccess: [MedicalDepartment.RADIOLOGY],
      metadata: { mappedRole: MedicalRole.DOCTOR, specialty: 'RADIOLOGIST' },
    },
  ];

  constructor(
    @InjectRepository(RoleTemplate)
    private readonly templateRepo: Repository<RoleTemplate>,
  ) {}

  // ── Seed templates on first use ────────────────────────────────────────────

  async seedTemplates(): Promise<void> {
    const count = await this.templateRepo.count();
    if (count === 0) {
      this.logger.log('Seeding predefined role templates…');
      for (const tpl of this.predefinedTemplates) {
        const existing = await this.templateRepo.findOne({
          where: { name: tpl.name, version: 1 },
        });
        if (!existing) {
          await this.templateRepo.save(
            this.templateRepo.create({ ...tpl, version: 1 }),
          );
        }
      }
      this.logger.log(`Seeded ${this.predefinedTemplates.length} role templates.`);
    }
  }

  // ── List templates ─────────────────────────────────────────────────────────

  async listTemplates(category?: RoleTemplateCategory): Promise<RoleTemplateResponse[]> {
    const where: any = { isActive: true };
    if (category) {
      where.category = category;
    }
    const templates = await this.templateRepo.find({
      where,
      order: { category: 'ASC', name: 'ASC' },
    });
    return templates.map((t) => this.toResponse(t));
  }

  async getTemplateById(id: string): Promise<RoleTemplateResponse> {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template) {
      throw new NotFoundException(`Role template ${id} not found`);
    }
    return this.toResponse(template);
  }

  // ── Instantiate a role from template ──────────────────────────────────────

  async instantiateRole(dto: InstantiateRoleDto): Promise<{
    template: RoleTemplateResponse;
    grantedPermissions: MedicalPermission[];
    roleName: string;
  }> {
    const template = await this.templateRepo.findOne({
      where: { id: dto.templateId },
    });
    if (!template) {
      throw new NotFoundException(`Role template ${dto.templateId} not found`);
    }

    let permissions = [...(template.permissions as MedicalPermission[])];

    // Apply overrides
    if (dto.permissionOverrides) {
      if (dto.permissionOverrides.add?.length) {
        for (const perm of dto.permissionOverrides.add) {
          if (!permissions.includes(perm)) {
            permissions.push(perm);
          }
        }
      }
      if (dto.permissionOverrides.remove?.length) {
        permissions = permissions.filter(
          (p) => !dto.permissionOverrides.remove!.includes(p),
        );
      }
    }

    const roleName = dto.roleName ?? template.name;

    this.logger.log(
      `Role instantiated from template "${template.name}" (v${template.version}): ${roleName} with ${permissions.length} permissions`,
    );

    return {
      template: this.toResponse(template),
      grantedPermissions: permissions,
      roleName,
    };
  }

  // ── Version management ────────────────────────────────────────────────────

  async createNewVersion(
    name: string,
    updatedPermissions: MedicalPermission[],
    description?: string,
  ): Promise<RoleTemplateResponse> {
    const currentVersion = await this.templateRepo.findOne({
      where: { name, isActive: true },
      order: { version: 'DESC' },
    });

    const newVersion = (currentVersion?.version ?? 0) + 1;

    const template = this.templateRepo.create({
      name,
      description: description ?? currentVersion?.description ?? '',
      category: currentVersion?.category ?? RoleTemplateCategory.CLINICAL,
      version: newVersion,
      permissions: updatedPermissions,
      departmentAccess: currentVersion?.departmentAccess ?? [],
      metadata: currentVersion?.metadata ?? {},
    });

    const saved = await this.templateRepo.save(template);
    this.logger.log(`New template version created: ${name} v${newVersion}`);
    return this.toResponse(saved);
  }

  // ── Admin endpoints ────────────────────────────────────────────────────────

  async getTemplateVersions(name: string): Promise<RoleTemplateResponse[]> {
    const templates = await this.templateRepo.find({
      where: { name },
      order: { version: 'DESC' },
    });
    if (templates.length === 0) {
      throw new NotFoundException(`No templates found with name "${name}"`);
    }
    return templates.map((t) => this.toResponse(t));
  }

  // ── Sync tenant to latest template version ────────────────────────────────

  async syncToLatestVersion(
    templateId: string,
    currentPermissions: MedicalPermission[],
  ): Promise<{
    added: MedicalPermission[];
    removed: MedicalPermission[];
    currentPermissions: MedicalPermission[];
  }> {
    const template = await this.templateRepo.findOne({
      where: { id: templateId },
    });
    if (!template) {
      throw new NotFoundException(`Template ${templateId} not found`);
    }

    const templatePerms = template.permissions as MedicalPermission[];
    const added = templatePerms.filter((p) => !currentPermissions.includes(p));
    const removed = currentPermissions.filter((p) => !templatePerms.includes(p));

    const merged = [...new Set([...currentPermissions, ...added])].filter(
      (p) => !removed.includes(p),
    );

    return { added, removed, currentPermissions: merged };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private toResponse(template: RoleTemplate): RoleTemplateResponse {
    return {
      id: template.id,
      name: template.name,
      description: template.description ?? '',
      category: template.category,
      version: template.version,
      permissions: template.permissions as MedicalPermission[],
      departmentAccess: template.departmentAccess,
      isActive: template.isActive,
    };
  }
}

