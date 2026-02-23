import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProviderDirectoryQueryDto } from '../dto/provider-directory-query.dto';
import { User, UserRole } from '../entities/user.entity';

interface ProviderDirectoryRecord {
  id: string;
  displayName: string;
  role: 'doctor' | 'lab' | 'insurer';
  specialty: string | null;
  institution: string | null;
  stellarPublicKey?: string | null;
}

interface ProviderDirectoryResult {
  data: ProviderDirectoryRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

@Injectable()
export class ProviderDirectoryService {
  private readonly providerRoles: UserRole[] = [
    UserRole.PHYSICIAN,
    UserRole.MEDICAL_RECORDS,
    UserRole.BILLING_STAFF,
  ];

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async searchProviders(query: ProviderDirectoryQueryDto, includeSensitiveData: boolean): Promise<ProviderDirectoryResult> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const offset = (page - 1) * limit;

    const qb = this.usersRepository
      .createQueryBuilder('u')
      .where('u.role IN (:...providerRoles)', { providerRoles: this.providerRoles })
      .andWhere('u."isActive" = :isActive', { isActive: true })
      .andWhere('u."deletedAt" IS NULL')
      .select('u.id', 'id')
      .addSelect(`COALESCE(NULLIF(u."displayName", ''), TRIM(CONCAT(COALESCE(u."firstName", ''), ' ', COALESCE(u."lastName", ''))))`, 'displayName')
      .addSelect('u.role', 'role')
      .addSelect(`COALESCE(NULLIF(u."specialty", ''), NULLIF(u."specialization", ''))`, 'specialty')
      .addSelect('u."institution"', 'institution');

    if (includeSensitiveData) {
      qb.addSelect('u."stellarPublicKey"', 'stellarPublicKey');
    }

    if (query.role) {
      qb.andWhere('u.role = :role', { role: this.mapRoleAliasToEnum(query.role) });
    }

    if (query.specialty) {
      qb.andWhere(`COALESCE(u."specialty", u."specialization", '') ILIKE :specialty`, {
        specialty: `%${query.specialty}%`,
      });
    }

    if (query.search) {
      qb.andWhere(`u.search_vector @@ plainto_tsquery('english', :search)`, { search: query.search });
      qb.orderBy(`ts_rank(u.search_vector, plainto_tsquery('english', :search))`, 'DESC');
      qb.addOrderBy('u."createdAt"', 'DESC');
    } else {
      qb.orderBy('u."createdAt"', 'DESC');
    }

    const totalRow = await qb
      .clone()
      .orderBy()
      .select('COUNT(DISTINCT u.id)', 'total')
      .getRawOne<{ total: string }>();
    const rows = await qb.offset(offset).limit(limit).getRawMany<{
      id: string;
      displayName: string;
      role: UserRole;
      specialty: string | null;
      institution: string | null;
      stellarPublicKey?: string | null;
    }>();

    return {
      data: rows.map((row) => ({
        id: row.id,
        displayName: row.displayName,
        role: this.mapRoleEnumToAlias(row.role),
        specialty: row.specialty,
        institution: row.institution,
        ...(includeSensitiveData ? { stellarPublicKey: row.stellarPublicKey ?? null } : {}),
      })),
      pagination: {
        page,
        limit,
        total: Number(totalRow?.total || 0),
      },
    };
  }

  private mapRoleAliasToEnum(role: 'doctor' | 'lab' | 'insurer'): UserRole {
    switch (role) {
      case 'doctor':
        return UserRole.PHYSICIAN;
      case 'lab':
        return UserRole.MEDICAL_RECORDS;
      case 'insurer':
        return UserRole.BILLING_STAFF;
      default:
        return UserRole.PHYSICIAN;
    }
  }

  private mapRoleEnumToAlias(role: UserRole): 'doctor' | 'lab' | 'insurer' {
    if (role === UserRole.MEDICAL_RECORDS) {
      return 'lab';
    }

    if (role === UserRole.BILLING_STAFF) {
      return 'insurer';
    }

    return 'doctor';
  }
}
