import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { User } from '../users/entities/user.entity';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { AccessGrant, GrantStatus } from '../access-control/entities/access-grant.entity';
import { StellarTransaction } from './entities/stellar-transaction.entity';
import { OverviewResponseDto } from './dto/overview-response.dto';
import { ActivityResponseDto, DailyActivityDto } from './dto/activity-response.dto';
import { TopProvidersResponseDto, ProviderRankingDto } from './dto/top-providers-response.dto';

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
  ) {}

  async getOverview(): Promise<OverviewResponseDto> {
      const cacheKey = 'analytics:overview';

      // Check cache first
      const cached = await this.cacheManager.get<OverviewResponseDto>(cacheKey);
      if (cached) {
        return cached;
      }

      // Execute COUNT queries for all metrics
      const totalUsers = await this.userRepository.count();
      const totalRecords = await this.medicalRecordRepository.count();
      const totalAccessGrants = await this.accessGrantRepository.count();
      const stellarTransactions = await this.stellarTransactionRepository.count();

      // Count active grants: status is ACTIVE
      const activeGrants = await this.accessGrantRepository.count({
        where: {
          status: GrantStatus.ACTIVE,
        },
      });

      const result = {
        totalUsers,
        totalRecords,
        totalAccessGrants,
        activeGrants,
        stellarTransactions,
      };

      // Store in cache with 300-second TTL
      await this.cacheManager.set(cacheKey, result, 300);

      return result;
    }


  async getActivity(from: Date, to: Date): Promise<ActivityResponseDto> {
    const cacheKey = `analytics:activity:${from.toISOString()}:${to.toISOString()}`;
    
    // Check cache first
    const cached = await this.cacheManager.get<ActivityResponseDto>(cacheKey);
    if (cached) {
      return cached;
    }

    // Query for daily record uploads using date_trunc
    const recordUploadsQuery = await this.medicalRecordRepository
      .createQueryBuilder('record')
      .select("date_trunc('day', record.createdAt)", 'date')
      .addSelect('COUNT(*)', 'count')
      .where('record.createdAt >= :from', { from })
      .andWhere('record.createdAt <= :to', { to })
      .groupBy("date_trunc('day', record.createdAt)")
      .orderBy("date_trunc('day', record.createdAt)", 'ASC')
      .getRawMany();

    // Query for daily access events using date_trunc
    const accessEventsQuery = await this.accessGrantRepository
      .createQueryBuilder('grant')
      .select("date_trunc('day', grant.createdAt)", 'date')
      .addSelect('COUNT(*)', 'count')
      .where('grant.createdAt >= :from', { from })
      .andWhere('grant.createdAt <= :to', { to })
      .groupBy("date_trunc('day', grant.createdAt)")
      .orderBy("date_trunc('day', grant.createdAt)", 'ASC')
      .getRawMany();

    // Create maps for quick lookup
    const recordUploadsMap = new Map<string, number>();
    recordUploadsQuery.forEach((row) => {
      const dateStr = new Date(row.date).toISOString().split('T')[0];
      recordUploadsMap.set(dateStr, parseInt(row.count, 10));
    });

    const accessEventsMap = new Map<string, number>();
    accessEventsQuery.forEach((row) => {
      const dateStr = new Date(row.date).toISOString().split('T')[0];
      accessEventsMap.set(dateStr, parseInt(row.count, 10));
    });

    // Generate complete date range with all dates
    const dailyActivity: DailyActivityDto[] = [];
    const currentDate = new Date(from);
    const endDate = new Date(to);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      dailyActivity.push({
        date: dateStr,
        recordUploads: recordUploadsMap.get(dateStr) || 0,
        accessEvents: accessEventsMap.get(dateStr) || 0,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const result = {
      dailyActivity,
    };

    // Store in cache with 300-second TTL
    await this.cacheManager.set(cacheKey, result, 300);

    return result;
  }

  async getTopProviders(): Promise<TopProvidersResponseDto> {
    const cacheKey = 'analytics:top-providers';
    
    // Check cache first
    const cached = await this.cacheManager.get<TopProvidersResponseDto>(cacheKey);
    if (cached) {
      return cached;
    }

    // Query with JOIN between AccessGrant and User (provider)
    // Filter only active grants and group by provider
    const topProvidersQuery = await this.accessGrantRepository
      .createQueryBuilder('grant')
      .select('grant.granteeId', 'providerId')
      .addSelect('COUNT(*)', 'activeGrantCount')
      .where('grant.status = :status', { status: GrantStatus.ACTIVE })
      .groupBy('grant.granteeId')
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany();

    // Map results to DTO
    const providers: ProviderRankingDto[] = topProvidersQuery.map((row) => ({
      providerId: row.providerId,
      activeGrantCount: parseInt(row.activeGrantCount, 10),
    }));

    const result = {
      providers,
    };

    // Store in cache with 300-second TTL
    await this.cacheManager.set(cacheKey, result, 300);

    return result;
  }
}
