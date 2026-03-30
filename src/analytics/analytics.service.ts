import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { User } from '../users/entities/user.entity';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { AccessGrant, GrantStatus } from '../access-control/entities/access-grant.entity';
import { StellarTransaction } from './entities/stellar-transaction.entity';
import { TenantContext } from '../tenant/context/tenant.context';
import { OverviewResponseDto } from './dto/overview-response.dto';
import { ActivityResponseDto, DailyActivityDto } from './dto/activity-response.dto';
import { TopProvidersResponseDto, ProviderRankingDto } from './dto/top-providers-response.dto';
import { AdminStatsResponseDto, RecordsByTypeDto, TopProviderDto } from './dto/admin-stats-response.dto';
import { MedicalRole } from '../users/enums/medical-role.enum';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(MedicalRecord)
    private readonly medicalRecordRepository: Repository<MedicalRecord>,
    @InjectRepository(AccessGrant)
    private readonly accessGrantRepository: Repository<AccessGrant>,
    @InjectRepository(StellarTransaction)
    private readonly stellarTransactionRepository: Repository<StellarTransaction>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private requireTenantId(): string {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) throw new ForbiddenException('Tenant context not found');
    return tenantId;
  }

  async getOverview(): Promise<OverviewResponseDto> {
    const tenantId = this.requireTenantId();
    const cacheKey = `analytics:overview:${tenantId}`;

    const cached = await this.cacheManager.get<OverviewResponseDto>(cacheKey);
    if (cached) return cached;

    const [totalUsers, totalRecords, totalAccessGrants, activeGrants, stellarTransactions] =
      await Promise.all([
        this.userRepository.count({ where: { organizationId: tenantId } as any }),
        this.medicalRecordRepository.count({ where: { organizationId: tenantId } as any }),
        this.accessGrantRepository.count({ where: { organizationId: tenantId } as any }),
        this.accessGrantRepository.count({ where: { organizationId: tenantId, status: GrantStatus.ACTIVE } as any }),
        this.stellarTransactionRepository.count({ where: { organizationId: tenantId } as any }),
      ]);

    const result = { totalUsers, totalRecords, totalAccessGrants, activeGrants, stellarTransactions };
    await this.cacheManager.set(cacheKey, result, 300);
    return result;
  }

  async getActivity(from: Date, to: Date): Promise<ActivityResponseDto> {
    const tenantId = this.requireTenantId();
    const cacheKey = `analytics:activity:${tenantId}:${from.toISOString()}:${to.toISOString()}`;

    const cached = await this.cacheManager.get<ActivityResponseDto>(cacheKey);
    if (cached) return cached;

    const [recordUploadsQuery, accessEventsQuery] = await Promise.all([
      this.medicalRecordRepository
        .createQueryBuilder('record')
        .select("date_trunc('day', record.createdAt)", 'date')
        .addSelect('COUNT(*)', 'count')
        .where('record."organizationId" = :tenantId', { tenantId })
        .andWhere('record.createdAt >= :from', { from })
        .andWhere('record.createdAt <= :to', { to })
        .groupBy("date_trunc('day', record.createdAt)")
        .orderBy("date_trunc('day', record.createdAt)", 'ASC')
        .getRawMany(),
      this.accessGrantRepository
        .createQueryBuilder('grant')
        .select("date_trunc('day', grant.createdAt)", 'date')
        .addSelect('COUNT(*)', 'count')
        .where('grant."organizationId" = :tenantId', { tenantId })
        .andWhere('grant.createdAt >= :from', { from })
        .andWhere('grant.createdAt <= :to', { to })
        .groupBy("date_trunc('day', grant.createdAt)")
        .orderBy("date_trunc('day', grant.createdAt)", 'ASC')
        .getRawMany(),
    ]);

    const recordUploadsMap = new Map<string, number>(
      recordUploadsQuery.map((r) => [new Date(r.date).toISOString().split('T')[0], parseInt(r.count, 10)]),
    );
    const accessEventsMap = new Map<string, number>(
      accessEventsQuery.map((r) => [new Date(r.date).toISOString().split('T')[0], parseInt(r.count, 10)]),
    );

    const dailyActivity: DailyActivityDto[] = [];
    const cur = new Date(from);
    while (cur <= to) {
      const d = cur.toISOString().split('T')[0];
      dailyActivity.push({ date: d, recordUploads: recordUploadsMap.get(d) ?? 0, accessEvents: accessEventsMap.get(d) ?? 0 });
      cur.setDate(cur.getDate() + 1);
    }

    const result = { dailyActivity };
    await this.cacheManager.set(cacheKey, result, 300);
    return result;
  }

  async getStats(): Promise<AdminStatsResponseDto> {
    const tenantId = this.requireTenantId();
    const cacheKey = `admin:stats:${tenantId}`;
    const TTL_SECONDS = 300;

    const cached = await this.cacheManager.get<AdminStatsResponseDto>(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const ago7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const ago30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [totalPatients, totalProviders, totalRecords, recordsLast7Days, recordsLast30Days, activeAccessGrants] =
      await Promise.all([
        this.userRepository.count({ where: { role: MedicalRole.PATIENT, organizationId: tenantId } as any }),
        this.userRepository
          .createQueryBuilder('u')
          .where('u.role != :role', { role: MedicalRole.PATIENT })
          .andWhere('u."organizationId" = :tenantId', { tenantId })
          .getCount(),
        this.medicalRecordRepository.count({ where: { organizationId: tenantId } as any }),
        this.medicalRecordRepository
          .createQueryBuilder('r')
          .where('r."organizationId" = :tenantId', { tenantId })
          .andWhere('r.createdAt >= :ago', { ago: ago7 })
          .getCount(),
        this.medicalRecordRepository
          .createQueryBuilder('r')
          .where('r."organizationId" = :tenantId', { tenantId })
          .andWhere('r.createdAt >= :ago', { ago: ago30 })
          .getCount(),
        this.accessGrantRepository.count({ where: { status: GrantStatus.ACTIVE, organizationId: tenantId } as any }),
      ]);

    const topProvidersRaw: { providerId: string; recordCount: string }[] =
      await this.medicalRecordRepository
        .createQueryBuilder('r')
        .select('r.providerId', 'providerId')
        .addSelect('COUNT(*)', 'recordCount')
        .where('r.providerId IS NOT NULL')
        .andWhere('r."organizationId" = :tenantId', { tenantId })
        .groupBy('r.providerId')
        .orderBy('COUNT(*)', 'DESC')
        .limit(5)
        .getRawMany();

    const topProviders: TopProviderDto[] = topProvidersRaw.map((row) => ({
      providerId: row.providerId,
      recordCount: parseInt(row.recordCount, 10),
    }));

    const byTypeRaw: { recordType: string; count: string }[] =
      await this.medicalRecordRepository
        .createQueryBuilder('r')
        .select('r.recordType', 'recordType')
        .addSelect('COUNT(*)', 'count')
        .where('r."organizationId" = :tenantId', { tenantId })
        .groupBy('r.recordType')
        .orderBy('COUNT(*)', 'DESC')
        .getRawMany();

    const recordsByType: RecordsByTypeDto[] = byTypeRaw.map((row) => ({
      recordType: row.recordType,
      count: parseInt(row.count, 10),
    }));

    const result: AdminStatsResponseDto = {
      totalPatients, totalProviders, totalRecords,
      recordsLast7Days, recordsLast30Days,
      topProviders, recordsByType, activeAccessGrants,
      cachedAt: now.toISOString(),
    };

    await this.cacheManager.set(cacheKey, result, TTL_SECONDS);
    return result;
  }

  async getTopProviders(): Promise<TopProvidersResponseDto> {
    const tenantId = this.requireTenantId();
    const cacheKey = `analytics:top-providers:${tenantId}`;

    const cached = await this.cacheManager.get<TopProvidersResponseDto>(cacheKey);
    if (cached) return cached;

    const topProvidersQuery = await this.accessGrantRepository
      .createQueryBuilder('grant')
      .select('grant.granteeId', 'providerId')
      .addSelect('COUNT(*)', 'activeGrantCount')
      .where('grant.status = :status', { status: GrantStatus.ACTIVE })
      .andWhere('grant."organizationId" = :tenantId', { tenantId })
      .groupBy('grant.granteeId')
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany();

    const providers: ProviderRankingDto[] = topProvidersQuery.map((row) => ({
      providerId: row.providerId,
      activeGrantCount: parseInt(row.activeGrantCount, 10),
    }));

    const result = { providers };
    await this.cacheManager.set(cacheKey, result, 300);
    return result;
  }
}
