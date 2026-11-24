import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Tenant } from '../entities/tenant.entity';
import { CreateTenantDto, UpdateTenantDto } from '../dto/tenant.dto';

/**
 * Strict allowlist for tenant slugs used in DDL identifiers.
 * Matches ^[a-z0-9_]{3,63}$ — no hyphens, quotes, spaces, or any character
 * that could escape a quoted PostgreSQL identifier.
 */
const SLUG_RE = /^[a-z0-9_]{3,63}$/;

/** Throws BadRequestException if slug does not pass the allowlist. */
function assertSafeSlug(slug: string): void {
  if (!SLUG_RE.test(slug)) {
    throw new BadRequestException(
      'Tenant slug must match ^[a-z0-9_]{3,63}$ (lowercase letters, digits, underscores only)',
    );
  }
}

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  async create(createTenantDto: CreateTenantDto): Promise<Tenant> {
    assertSafeSlug(createTenantDto.slug);

    const existing = await this.tenantRepository.findOne({
      where: { slug: createTenantDto.slug },
    });
    if (existing) {
      throw new ConflictException('Tenant with this slug already exists');
    }

    const tenant = this.tenantRepository.create(createTenantDto);
    await this.tenantRepository.save(tenant);

    await this.provisionTenantSchema(tenant.slug);

    return tenant;
  }

  /**
   * Provisions a schema for the given slug with three safety guarantees:
   *
   * 1. Slug allowlist — rejects any slug that doesn't match ^[a-z0-9_]{3,63}$
   *    before it ever touches a SQL string.
   *
   * 2. PostgreSQL advisory lock — pg_try_advisory_lock(hashtext(schemaName))
   *    prevents two concurrent calls for the same slug from racing. If the lock
   *    is already held the call fails fast with a ConflictException rather than
   *    producing a half-initialised duplicate schema.
   *
   *    The lock is acquired, used, and released on a single dedicated
   *    QueryRunner connection. Session-level advisory locks are owned by the
   *    connection that acquired them, so all lock-related statements MUST run
   *    on the same connection — otherwise the unlock runs on a different pooled
   *    connection, returns false, and the lock leaks forever.
   *
   * 3. Compensating saga — DDL statements (CREATE SCHEMA, CREATE TABLE) are
   *    auto-committed by PostgreSQL and cannot be rolled back inside a
   *    transaction. Instead we wrap the provisioning steps in try/catch and
   *    DROP the schema on any failure, leaving the database in a clean state.
   */
  async provisionTenantSchema(slug: string): Promise<void> {
    assertSafeSlug(slug);

    // schemaName is safe to interpolate: assertSafeSlug guarantees it contains
    // only [a-z0-9_] — no characters that can escape a double-quoted identifier.
    const schemaName = `tenant_${slug}`;

    // ── Dedicated connection ─────────────────────────────────────────────────
    // A session-level advisory lock is bound to the connection that acquired
    // it. Use a single QueryRunner for the lock, the DDL, and the unlock so
    // they all run on the same physical connection.
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();

    let lockAcquired = false;

    try {
      // ── Advisory lock ──────────────────────────────────────────────────────
      const [{ acquired }] = await runner.query<
        [{ acquired: boolean }]
      >(`SELECT pg_try_advisory_lock(hashtext($1)) AS acquired`, [schemaName]);

      if (!acquired) {
        throw new ConflictException(
          `Schema provisioning for "${slug}" is already in progress`,
        );
      }
      lockAcquired = true;

      // ── Compensating saga ──────────────────────────────────────────────────
      // CREATE SCHEMA is DDL and auto-commits, so we track whether the schema
      // was created and drop it on any subsequent failure (compensating
      // transaction).
      let schemaCreated = false;

      try {
        await runner.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
        schemaCreated = true;

        await this.runTenantMigrations(runner, schemaName);
        await this.seedTenantData(runner, schemaName);
      } catch (err) {
        if (schemaCreated) {
          // Best-effort rollback: drop the partially initialised schema.
          await runner
            .query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`)
            .catch((dropErr) => {
              // Log but do not mask the original error.
              this.logger.error(
                `Failed to drop partially initialised schema "${schemaName}" during compensation: ${
                  dropErr instanceof Error ? dropErr.message : String(dropErr)
                }`,
              );
            });
        }
        throw err;
      }
    } finally {
      // ── Release the advisory lock ──────────────────────────────────────────
      // Must run on the same connection that acquired the lock. Log (do not
      // swallow) any failure so a leaked lock is diagnosable.
      if (lockAcquired) {
        try {
          const [{ unlocked }] = await runner.query<[{ unlocked: boolean }]>(
            `SELECT pg_advisory_unlock(hashtext($1)) AS unlocked`,
            [schemaName],
          );
          if (!unlocked) {
            this.logger.warn(
              `Advisory lock for schema "${schemaName}" was not held by this connection on unlock; it may have leaked`,
            );
          }
        } catch (unlockErr) {
          this.logger.error(
            `Failed to release advisory lock for schema "${schemaName}": ${
              unlockErr instanceof Error ? unlockErr.message : String(unlockErr)
            }`,
          );
        }
      }

      // Return the connection to the pool.
      await runner.release().catch((releaseErr) => {
        this.logger.error(
          `Failed to release QueryRunner for schema "${schemaName}": ${
            releaseErr instanceof Error ? releaseErr.message : String(releaseErr)
          }`,
        );
      });
    }
  }

  private async runTenantMigrations(
    runner: { query: (sql: string) => Promise<unknown> },
    schemaName: string,
  ): Promise<void> {
    const tables = [
      `CREATE TABLE IF NOT EXISTS "${schemaName}".medical_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id VARCHAR(255) NOT NULL,
        record_type VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS "${schemaName}".billings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id VARCHAR(255) NOT NULL,
        invoice_number VARCHAR(50) UNIQUE NOT NULL,
        total_charges DECIMAL(12,2) DEFAULT 0,
        balance DECIMAL(12,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS "${schemaName}".prescriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id VARCHAR(255) NOT NULL,
        prescription_number VARCHAR(50) UNIQUE NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS "${schemaName}".lab_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id VARCHAR(255) NOT NULL,
        order_number VARCHAR(50) UNIQUE NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
    ];

    for (const sql of tables) {
      await runner.query(sql);
    }

    await runner.query(
      `CREATE INDEX IF NOT EXISTS idx_medical_records_patient ON "${schemaName}".medical_records(patient_id)`,
    );
    await runner.query(
      `CREATE INDEX IF NOT EXISTS idx_billings_patient ON "${schemaName}".billings(patient_id)`,
    );
    await runner.query(
      `CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON "${schemaName}".prescriptions(patient_id)`,
    );
    await runner.query(
      `CREATE INDEX IF NOT EXISTS idx_lab_orders_patient ON "${schemaName}".lab_orders(patient_id)`,
    );
  }

  private async seedTenantData(
    runner: { query: (sql: string) => Promise<unknown> },
    schemaName: string,
  ): Promise<void> {
    await runner.query(`
      INSERT INTO "${schemaName}".medical_records (patient_id, record_type)
      VALUES ('system', 'initialization')
      ON CONFLICT DO NOTHING
    `);
  }

  async findAll(): Promise<Tenant[]> {
    return this.tenantRepository.find();
  }

  async findById(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async findBySlug(slug: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { slug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async update(id: string, updateTenantDto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.findById(id);
    Object.assign(tenant, updateTenantDto);
    return this.tenantRepository.save(tenant);
  }

  async delete(id: string): Promise<void> {
    const tenant = await this.findById(id);
    assertSafeSlug(tenant.slug);
    const schemaName = `tenant_${tenant.slug}`;
    await this.dataSource.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await this.tenantRepository.remove(tenant);
  }

  async softDelete(id: string): Promise<void> {
    const tenant = await this.findById(id);
    tenant.status = 'deleted';
    await this.tenantRepository.save(tenant);
  }
}