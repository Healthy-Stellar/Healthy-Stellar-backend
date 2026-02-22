import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Tenant } from '../entities/tenant.entity';
import { CreateTenantDto, UpdateTenantDto } from '../dto/tenant.dto';

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  async create(createTenantDto: CreateTenantDto): Promise<Tenant> {
    // Check if tenant with slug already exists
    const existing = await this.tenantRepository.findOne({
      where: { slug: createTenantDto.slug },
    });

    if (existing) {
      throw new ConflictException('Tenant with this slug already exists');
    }

    // Create tenant record
    const tenant = this.tenantRepository.create(createTenantDto);
    await this.tenantRepository.save(tenant);

    // Provision tenant schema
    await this.provisionTenantSchema(tenant.slug);

    return tenant;
  }

  async provisionTenantSchema(slug: string): Promise<void> {
    const schemaName = `tenant_${slug}`;
    
    // Create schema
    await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

    // Set search path to new schema
    await this.dataSource.query(`SET search_path TO "${schemaName}", public`);

    // Run migrations for tenant schema
    await this.runTenantMigrations(schemaName);

    // Seed base data
    await this.seedTenantData(schemaName);

    // Reset search path
    await this.dataSource.query(`SET search_path TO public`);
  }

  private async runTenantMigrations(schemaName: string): Promise<void> {
    // Create core tables in tenant schema
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

    // Create indexes
    await this.dataSource.query(`CREATE INDEX IF NOT EXISTS idx_medical_records_patient ON "${schemaName}".medical_records(patient_id)`);
    await this.dataSource.query(`CREATE INDEX IF NOT EXISTS idx_billings_patient ON "${schemaName}".billings(patient_id)`);
    await this.dataSource.query(`CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON "${schemaName}".prescriptions(patient_id)`);
    await this.dataSource.query(`CREATE INDEX IF NOT EXISTS idx_lab_orders_patient ON "${schemaName}".lab_orders(patient_id)`);
  }

  private async seedTenantData(schemaName: string): Promise<void> {
    // Seed initial configuration data for tenant
    // This can be expanded based on requirements
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
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }

  async findBySlug(slug: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { slug } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }

  async update(id: string, updateTenantDto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.findById(id);
    Object.assign(tenant, updateTenantDto);
    return this.tenantRepository.save(tenant);
  }

  async delete(id: string): Promise<void> {
    const tenant = await this.findById(id);
    const schemaName = `tenant_${tenant.slug}`;
    
    // Drop schema (CASCADE will drop all tables)
    await this.dataSource.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    
    // Delete tenant record
    await this.tenantRepository.remove(tenant);
  }
}
