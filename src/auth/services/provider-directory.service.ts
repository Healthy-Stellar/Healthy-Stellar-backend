import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProviderDirectoryQueryDto } from '../dto/provider-directory-query.dto';
import { User, UserRole } from '../entities/user.entity';
import { PaginationUtil } from '../../common/utils/pagination.util';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';

interface ProviderDirectoryRecord {
  id: string;
  displayName: string;
  role: 'doctor' | 'lab' | 'insurer';
  specialty: string | null;
  institution: string | null;
  country: string | null;
  isAcceptingPatients: boolean;
  stellarAddress?: string | null;
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

  async searchProviders(
    query: ProviderDirectoryQueryDto,
    includeSensitiveData: boolean,
  ): Promise<PaginatedResponseDto<ProviderDirectoryRecord>> {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const offset = (page - 1) * pageSize;

    const qb = this.usersRepository
      .createQueryBuilder('u')
      .where('u.role IN (:...providerRoles)', { providerRoles: this.providerRoles })
      .andWhere('u."isActive" = :isActive', { isActive: true })
      .andWhere('u."isLicenseVerified" = :isVerified', { isVerified: true })
      .andWhere('u."deletedAt" IS NULL')
      .select('u.id', 'id')
      .addSelect(
        `COALESCE(NULLIF(u."displayName", ''), TRIM(CONCAT(COALESCE(u."firstName", ''), ' ', COALESCE(u."lastName", ''))))`,
        'displayName',
      )
      .addSelect('u.role', 'role')
      .addSelect(`COALESCE(NULLIF(u."specialization", ''), NULLIF(u."specialty", ''))`, 'specialty')
      .addSelect('u."institution"', 'institution')
      .addSelect('u."country"', 'country')
      .addSelect('u."isAcceptingPatients"', 'isAcceptingPatients');

    if (includeSensitiveData) {
      qb.addSelect('u."stellarPublicKey"', 'stellarAddress');
    }

    if (query.role) {
      qb.andWhere('u.role = :role', { role: this.mapRoleAliasToEnum(query.role) });
    }

    if (query.specialty || query.specialization) {
      const specialtySearch = query.specialty || query.specialization;
      qb.andWhere(
        `(COALESCE(u."specialty", '') ILIKE :specialty OR COALESCE(u."specialization", '') ILIKE :specialty)`,
        {
          specialty: `%${specialtySearch}%`,
        },
      );
    }

    if (query.country) {
      qb.andWhere('u.country = :country', { country: query.country });
    }

    if (query.isAcceptingPatients !== undefined) {
      qb.andWhere('u."isAcceptingPatients" = :isAcceptingPatients', {
        isAcceptingPatients: query.isAcceptingPatients,
      });
    }

    if (query.search) {
      qb.andWhere(`u.search_vector @@ plainto_tsquery('english', :search)`, {
        search: query.search,
      });
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
    const rows = await qb.offset(offset).limit(pageSize).getRawMany<{
      id: string;
      displayName: string;
      role: UserRole;
      specialty: string | null;
      institution: string | null;
      country: string | null;
      isAcceptingPatients: boolean;
      stellarAddress?: string | null;
    }>();

    const data = rows.map((row) => ({
      id: row.id,
      displayName: row.displayName,
      role: this.mapRoleEnumToAlias(row.role),
      specialty: row.specialty,
      institution: row.institution,
      country: row.country,
      isAcceptingPatients: row.isAcceptingPatients,
      ...(includeSensitiveData ? { stellarAddress: row.stellarAddress ?? null } : {}),
    }));

    const total = Number(totalRow?.total || 0);
    return PaginationUtil.createResponse(data, total, page, pageSize);
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
