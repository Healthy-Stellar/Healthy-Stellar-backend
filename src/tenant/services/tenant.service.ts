import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
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

    // ── Advisory lock ────────────────────────────────────────────────────────
    // Use a session-level advisory lock keyed on the schema name so concurrent
    // provisioning attempts for the same slug are serialised. The lock is
    // released automatically when the connection is returned to the pool.
    const [{ acquired }] = await this.dataSource.query<[{ acquired: boolean }]>(
      `SELECT pg_try_advisory_lock(hashtext($1)) AS acquired`,
      [schemaName],
    );

    if (!acquired) {
      throw new ConflictException(
        `Schema provisioning for "${slug}" is already in progress`,
      );
    }

    // ── Compensating saga ────────────────────────────────────────────────────
    // CREATE SCHEMA is DDL and auto-commits, so we track whether the schema was
    // created and drop it on any subsequent failure (compensating transaction).
    let schemaCreated = false;

    try {
      await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
      schemaCreated = true;

      await this.runTenantMigrations(schemaName);
      await this.seedTenantData(schemaName);
    } catch (err) {
      if (schemaCreated) {
        // Best-effort rollback: drop the partially initialised schema.
        await this.dataSource
          .query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`)
          .catch(() => {
            // Log but do not mask the original error.
          });
      }
      throw err;
    } finally {
      // Release the advisory lock regardless of outcome.
      await this.dataSource
        .query(`SELECT pg_advisory_unlock(hashtext($1))`, [schemaName])
        .catch(() => {});
    }
  }

  private async runTenantMigrations(schemaName: string): Promise<void> {
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
      await this.dataSource.query(sql);
    }

    await this.dataSource.query(
      `CREATE INDEX IF NOT EXISTS idx_medical_records_patient ON "${schemaName}".medical_records(patient_id)`,
    );
    await this.dataSource.query(
      `CREATE INDEX IF NOT EXISTS idx_billings_patient ON "${schemaName}".billings(patient_id)`,
    );
    await this.dataSource.query(
      `CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON "${schemaName}".prescriptions(patient_id)`,
    );
    await this.dataSource.query(
      `CREATE INDEX IF NOT EXISTS idx_lab_orders_patient ON "${schemaName}".lab_orders(patient_id)`,
    );
  }

  private async seedTenantData(schemaName: string): Promise<void> {
    await this.dataSource.query(`
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
}
