import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "./entities/user.entity";

/**
 * Users Service
 * Manages user-related queries with performance optimizations
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Create a new user
   */
  async create(data: Partial<User>): Promise<User> {
    const startTime = Date.now();
    const user = this.userRepository.create(data);
    const result = await this.userRepository.save(user);

    const duration = Date.now() - startTime;
    if (duration > 100) {
      this.logger.warn(`Slow user create: ${duration}ms`);
    }

    return result;
  }

  /**
   * Find user by email (indexed column)
   *
   * OPTIMIZED:
   * - Uses unique index on email column
   * - EXPLAIN ANALYZE: Should use index scan on idx_users_email
   */
  async findByEmail(email: string): Promise<User | undefined> {
    const startTime = Date.now();

    const user = await this.userRepository.findOne({
      where: { email },
    });

    const duration = Date.now() - startTime;
    if (duration > 100) {
      this.logger.warn(`Slow query findByEmail: ${duration}ms`);
    }

    return user;
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | undefined> {
    const startTime = Date.now();

    const user = await this.userRepository.findOne({
      where: { id },
    });

    const duration = Date.now() - startTime;
    if (duration > 100) {
      this.logger.warn(`Slow query findById: ${duration}ms`);
    }

    return user;
  }

  /**
   * Get active users with pagination
   *
   * OPTIMIZED:
   * - Uses indexed status column
   */
  async findActive(
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: User[]; total: number }> {
    const startTime = Date.now();

    const [data, total] = await this.userRepository.findAndCount({
      where: { status: "active" },
      order: { createdAt: "DESC" },
      take: limit,
      skip: (page - 1) * limit,
    });

    const duration = Date.now() - startTime;
    if (duration > 100) {
      this.logger.warn(`Slow query findActive: ${duration}ms`);
    }

    return { data, total };
  }

  /**
   * Bulk create users (for performance testing)
   */
  async bulkCreate(users: Partial<User>[]): Promise<void> {
    const startTime = Date.now();

    await this.userRepository
      .createQueryBuilder()
      .insert()
      .into(User)
      .values(users)
      .orIgnore()
      .execute();

    const duration = Date.now() - startTime;
    this.logger.log(`Bulk insert ${users.length} users in ${duration}ms`);
  }
}
