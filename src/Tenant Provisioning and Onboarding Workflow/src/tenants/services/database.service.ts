import { Injectable, Logger } from "@nestjs/common";
import { DataSource } from "typeorm";

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(private readonly dataSource: DataSource) {}

  async createTenantSchema(schemaName: string): Promise<void> {
    this.logger.debug(`Creating schema: ${schemaName}`);

    try {
      // Escape schema name to prevent SQL injection
      if (!this.isValidSchemaName(schemaName)) {
        throw new Error(`Invalid schema name: ${schemaName}`);
      }

      const query = `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`;
      await this.dataSource.query(query);
      this.logger.log(`Schema created successfully: ${schemaName}`);
    } catch (error) {
      this.logger.error(
        `Failed to create schema ${schemaName}: ${error.message}`,
      );
      throw error;
    }
  }

  async dropTenantSchema(schemaName: string): Promise<void> {
    this.logger.debug(`Dropping schema: ${schemaName}`);

    try {
      if (!this.isValidSchemaName(schemaName)) {
        throw new Error(`Invalid schema name: ${schemaName}`);
      }

      const query = `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`;
      await this.dataSource.query(query);
      this.logger.log(`Schema dropped successfully: ${schemaName}`);
    } catch (error) {
      this.logger.error(
        `Failed to drop schema ${schemaName}: ${error.message}`,
      );
      throw error;
    }
  }

  async runTenantMigrations(schemaName: string): Promise<void> {
    this.logger.debug(`Running migrations for schema: ${schemaName}`);

    try {
      const query = `
        CREATE TABLE IF NOT EXISTS "${schemaName}".roles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL UNIQUE,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS "${schemaName}".users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          first_name VARCHAR(255),
          last_name VARCHAR(255),
          is_active BOOLEAN DEFAULT TRUE,
          role_id UUID REFERENCES "${schemaName}".roles(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS "${schemaName}".audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES "${schemaName}".users(id),
          action VARCHAR(255),
          entity_type VARCHAR(255),
          entity_id VARCHAR(255),
          changes JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;

      await this.dataSource.query(query);
      this.logger.log(`Migrations completed for schema: ${schemaName}`);
    } catch (error) {
      this.logger.error(
        `Failed to run migrations for schema ${schemaName}: ${error.message}`,
      );
      throw error;
    }
  }

  async seedTenantData(tenantId: string, schemaName: string): Promise<void> {
    this.logger.debug(`Seeding data for schema: ${schemaName}`);

    try {
      // Create default roles
      const rolesQuery = `
        INSERT INTO "${schemaName}".roles (id, name, description) VALUES
        ('550e8400-e29b-41d4-a716-446655440001', 'admin', 'Administrator with full access'),
        ('550e8400-e29b-41d4-a716-446655440002', 'user', 'Regular user access'),
        ('550e8400-e29b-41d4-a716-446655440003', 'viewer', 'Read-only access')
        ON CONFLICT (name) DO NOTHING;
      `;

      await this.dataSource.query(rolesQuery);
      this.logger.log(`Roles seeded for schema: ${schemaName}`);
    } catch (error) {
      this.logger.error(
        `Failed to seed data for schema ${schemaName}: ${error.message}`,
      );
      throw error;
    }
  }

  async createAdminUser(
    schemaName: string,
    email: string,
    firstName: string,
    lastName: string,
    passwordHash: string,
  ): Promise<string> {
    this.logger.debug(`Creating admin user in schema: ${schemaName}`);

    try {
      const adminRoleQuery = `
        SELECT id FROM "${schemaName}".roles WHERE name = 'admin' LIMIT 1;
      `;
      const result = await this.dataSource.query(adminRoleQuery);
      const adminRoleId = result[0]?.id;

      if (!adminRoleId) {
        throw new Error("Admin role not found");
      }

      const createUserQuery = `
        INSERT INTO "${schemaName}".users 
        (email, password_hash, first_name, last_name, role_id, is_active)
        VALUES ($1, $2, $3, $4, $5, TRUE)
        RETURNING id;
      `;

      const userResult = await this.dataSource.query(createUserQuery, [
        email,
        passwordHash,
        firstName,
        lastName,
        adminRoleId,
      ]);

      const userId = userResult[0]?.id;
      this.logger.log(`Admin user created in schema ${schemaName}: ${userId}`);
      return userId;
    } catch (error) {
      this.logger.error(
        `Failed to create admin user in schema ${schemaName}: ${error.message}`,
      );
      throw error;
    }
  }

  private isValidSchemaName(name: string): boolean {
    // Schema names must start with a letter and contain only alphanumeric characters and underscores
    return /^[a-z_][a-z0-9_]*$/.test(name);
  }
}
