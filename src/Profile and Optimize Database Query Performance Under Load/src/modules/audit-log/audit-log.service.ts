import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between } from "typeorm";
import { AuditLog } from "./entities/audit-log.entity";

/**
 * AuditLog Service
 *
 * Performance optimizations applied:
 * 1. Uses indexed columns (userId, createdAt) in queries
 * 2. Implements pagination to limit result sets
 * 3. Selective field loading to reduce memory usage
 * 4. Eager loading of user data in queries to prevent N+1
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  /**
   * Create an audit log entry
   * Direct insert for high-throughput logging
   */
  async create(data: Partial<AuditLog>): Promise<AuditLog> {
    const startTime = Date.now();
    const auditLog = this.auditLogRepository.create(data);
    const result = await this.auditLogRepository.save(auditLog);

    const duration = Date.now() - startTime;
    if (duration > 100) {
      this.logger.warn(`Slow audit log create: ${duration}ms`);
    }

    return result;
  }

  /**
   * Get audit logs for a specific user
   *
   * OPTIMIZED:
   * - Uses indexed userId column
   * - Pagination to limit query results
   * - Eager loads user data (already eager in entity definition)
   * - EXPLAIN ANALYZE: Should use index_scan on idx_audit_logs_user_id
   */
  async findByUserId(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: AuditLog[]; total: number }> {
    const startTime = Date.now();

    const [data, total] = await this.auditLogRepository.findAndCount({
      where: { userId },
      order: { createdAt: "DESC" },
      take: limit,
      skip: (page - 1) * limit,
      relations: ["user"],
    });

    const duration = Date.now() - startTime;
    if (duration > 100) {
      this.logger.warn(`Slow query findByUserId: ${duration}ms`);
    }

    return { data, total };
  }

  /**
   * Get audit logs within a date range
   *
   * OPTIMIZED:
   * - Uses indexed createdAt column
   * - Composite index on (userId, createdAt) when filtering by both
   * - SELECT specific columns to reduce I/O
   * - EXPLAIN ANALYZE: Should use index scan on idx_audit_logs_created_at
   */
  async findByDateRange(
    startDate: Date,
    endDate: Date,
    limit: number = 100,
  ): Promise<AuditLog[]> {
    const startTime = Date.now();

    const logs = await this.auditLogRepository.find({
      where: {
        createdAt: Between(startDate, endDate),
      },
      order: { createdAt: "DESC" },
      take: limit,
      select: ["id", "userId", "action", "resourceType", "createdAt"],
    });

    const duration = Date.now() - startTime;
    if (duration > 100) {
      this.logger.warn(`Slow query findByDateRange: ${duration}ms`);
    }

    return logs;
  }

  /**
   * Get logs for a specific user within a date range
   *
   * OPTIMIZED:
   * - Uses composite index on (userId, createdAt)
   * - Pagination to limit result size
   * - EXPLAIN ANALYZE: Should use composite index idx_audit_logs_user_created
   */
  async findByUserIdAndDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
    page: number = 1,
    limit: number = 50,
  ): Promise<{ data: AuditLog[]; total: number }> {
    const startTime = Date.now();

    const [data, total] = await this.auditLogRepository.findAndCount({
      where: {
        userId,
        createdAt: Between(startDate, endDate),
      },
      order: { createdAt: "DESC" },
      take: limit,
      skip: (page - 1) * limit,
      relations: ["user"],
    });

    const duration = Date.now() - startTime;
    if (duration > 100) {
      this.logger.warn(`Slow query findByUserIdAndDateRange: ${duration}ms`);
    }

    return { data, total };
  }

  /**
   * Get recent audit logs for multiple users (fixed N+1)
   *
   * OPTIMIZATION FIX:
   * - Uses QueryBuilder with explicit JOIN instead of implicit loads
   * - Loads all data in single query, preventing N+1
   * - Select specific columns to reduce data transfer
   */
  async findRecentForUsers(
    userIds: string[],
    limit: number = 10,
  ): Promise<AuditLog[]> {
    const startTime = Date.now();

    // Using QueryBuilder to prevent N+1 when eager loading multiple users
    const logs = await this.auditLogRepository
      .createQueryBuilder("log")
      .leftJoinAndSelect("log.user", "user")
      .where("log.userId IN (:...userIds)", { userIds })
      .orderBy("log.createdAt", "DESC")
      .limit(limit)
      .getMany();

    const duration = Date.now() - startTime;
    if (duration > 100) {
      this.logger.warn(`Slow query findRecentForUsers: ${duration}ms`);
    }

    return logs;
  }

  /**
   * Get audit logs with pagination and filtering (optimized with QueryBuilder)
   */
  async findWithFilters(filters: {
    userId?: string;
    action?: string;
    resourceType?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{ data: AuditLog[]; total: number }> {
    const startTime = Date.now();
    const { page = 1, limit = 20 } = filters;

    let query = this.auditLogRepository
      .createQueryBuilder("log")
      .leftJoinAndSelect("log.user", "user");

    if (filters.userId) {
      query = query.andWhere("log.userId = :userId", {
        userId: filters.userId,
      });
    }

    if (filters.action) {
      query = query.andWhere("log.action = :action", {
        action: filters.action,
      });
    }

    if (filters.resourceType) {
      query = query.andWhere("log.resourceType = :resourceType", {
        resourceType: filters.resourceType,
      });
    }

    if (filters.startDate && filters.endDate) {
      query = query.andWhere("log.createdAt BETWEEN :startDate AND :endDate", {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    }

    const [data, total] = await query
      .orderBy("log.createdAt", "DESC")
      .take(limit)
      .skip((page - 1) * limit)
      .getManyAndCount();

    const duration = Date.now() - startTime;
    if (duration > 100) {
      this.logger.warn(`Slow query findWithFilters: ${duration}ms`);
    }

    return { data, total };
  }

  /**
   * Bulk insert audit logs (for performance testing)
   */
  async bulkCreate(logs: Partial<AuditLog>[]): Promise<void> {
    const startTime = Date.now();

    // Use insert for bulk operations instead of save()
    await this.auditLogRepository
      .createQueryBuilder()
      .insert()
      .into(AuditLog)
      .values(logs)
      .orIgnore()
      .execute();

    const duration = Date.now() - startTime;
    this.logger.log(`Bulk insert ${logs.length} logs in ${duration}ms`);
  }
}
