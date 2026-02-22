import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

/**
 * Initial Migration - Create Base Tables
 * 
 * Creates all core tables for the Healthy Stellar healthcare system:
 * - users: User accounts with authentication
 * - sessions: User session management
 * - mfa_devices: Multi-factor authentication devices
 * - medical_records: Patient medical records
 * - access_grants: Access control for medical records
 * - audit_logs: Comprehensive audit trail (HIPAA compliance)
 * 
 * All schema changes MUST go through versioned migrations.
 * synchronize: false is enforced in all environments.
 */
export class CreateBaseTables1740000000000 implements MigrationInterface {
  name = 'CreateBaseTables1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable required PostgreSQL extensions
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    // Create users table
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'passwordHash',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'firstName',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'lastName',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'role',
            type: 'enum',
            enum: ['admin', 'physician', 'nurse', 'patient', 'billing_staff', 'medical_records'],
            default: "'patient'",
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: false,
          },
          {
            name: 'mfaEnabled',
            type: 'boolean',
            default: false,
          },
          {
            name: 'mfaSecret',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'lastPasswordChangeAt',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'failedLoginAttempts',
            type: 'integer',
            default: 0,
          },
          {
            name: 'lastLoginAt',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'lockedUntil',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'requiresPasswordChange',
            type: 'boolean',
            default: false,
          },
          {
            name: 'licenseNumber',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'npi',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'specialization',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'permissions',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'deletedAt',
            type: 'timestamp with time zone',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create indexes for users table
    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'IDX_users_email',
        columnNames: ['email'],
      }),
    );

    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'IDX_users_role',
        columnNames: ['role'],
      }),
    );

    // Create sessions table
    await queryRunner.createTable(
      new Table({
        name: 'sessions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'refreshToken',
            type: 'varchar',
            length: '500',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'accessToken',
            type: 'varchar',
            length: '500',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'expiresAt',
            type: 'timestamp with time zone',
            isNullable: false,
          },
          {
            name: 'refreshTokenExpiresAt',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'ipAddress',
            type: 'varchar',
            length: '45',
            isNullable: true,
          },
          {
            name: 'userAgent',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'deviceId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: false,
          },
          {
            name: 'revokedAt',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create foreign key for sessions -> users
    await queryRunner.createForeignKey(
      'sessions',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
        name: 'FK_sessions_userId',
      }),
    );

    // Create indexes for sessions table
    await queryRunner.createIndex(
      'sessions',
      new TableIndex({
        name: 'IDX_sessions_userId',
        columnNames: ['userId'],
      }),
    );

    await queryRunner.createIndex(
      'sessions',
      new TableIndex({
        name: 'IDX_sessions_refreshToken',
        columnNames: ['refreshToken'],
      }),
    );

    // Create mfa_devices table
    await queryRunner.createTable(
      new Table({
        name: 'mfa_devices',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'secret',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'backupCodes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'isVerified',
            type: 'boolean',
            default: false,
          },
          {
            name: 'verifiedAt',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'lastUsedAt',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'isPrimary',
            type: 'boolean',
            default: false,
          },
          {
            name: 'deviceName',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create foreign key for mfa_devices -> users
    await queryRunner.createForeignKey(
      'mfa_devices',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
        name: 'FK_mfa_devices_userId',
      }),
    );

    // Create indexes for mfa_devices table
    await queryRunner.createIndex(
      'mfa_devices',
      new TableIndex({
        name: 'IDX_mfa_devices_userId',
        columnNames: ['userId'],
      }),
    );

    // Create medical_records table
    await queryRunner.createTable(
      new Table({
        name: 'medical_records',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'patientId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'providerId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'createdBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'recordType',
            type: 'enum',
            enum: ['consultation', 'diagnosis', 'treatment', 'lab_result', 'imaging', 'prescription', 'surgery', 'emergency', 'other'],
            default: "'other'",
          },
          {
            name: 'title',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['active', 'archived', 'deleted'],
            default: "'active'",
          },
          {
            name: 'recordDate',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'version',
            type: 'integer',
            default: 1,
          },
          {
            name: 'createdAt',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedBy',
            type: 'uuid',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create indexes for medical_records table
    await queryRunner.createIndex(
      'medical_records',
      new TableIndex({
        name: 'IDX_medical_records_patientId',
        columnNames: ['patientId'],
      }),
    );

    await queryRunner.createIndex(
      'medical_records',
      new TableIndex({
        name: 'IDX_medical_records_patientId_createdAt',
        columnNames: ['patientId', 'createdAt'],
      }),
    );

    await queryRunner.createIndex(
      'medical_records',
      new TableIndex({
        name: 'IDX_medical_records_status_recordType',
        columnNames: ['status', 'recordType'],
      }),
    );

    // Create access_grants table
    await queryRunner.createTable(
      new Table({
        name: 'access_grants',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'patientId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'granteeId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'recordIds',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'accessLevel',
            type: 'enum',
            enum: ['READ', 'READ_WRITE'],
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['ACTIVE', 'REVOKED', 'EXPIRED'],
            default: "'ACTIVE'",
          },
          {
            name: 'expiresAt',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'revokedAt',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'revokedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'revocationReason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'sorobanTxHash',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create indexes for access_grants table
    await queryRunner.createIndex(
      'access_grants',
      new TableIndex({
        name: 'IDX_access_grants_patientId_granteeId_status',
        columnNames: ['patientId', 'granteeId', 'status'],
      }),
    );

    await queryRunner.createIndex(
      'access_grants',
      new TableIndex({
        name: 'IDX_access_grants_granteeId_status',
        columnNames: ['granteeId', 'status'],
      }),
    );

    // Create audit_logs table (enhanced version)
    await queryRunner.createTable(
      new Table({
        name: 'audit_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'action',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'entity',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'entityId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'details',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'severity',
            type: 'enum',
            enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
            isNullable: false,
          },
          {
            name: 'userAgent',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'ipAddress',
            type: 'varchar',
            length: '45',
            isNullable: true,
          },
          {
            name: 'reviewed',
            type: 'boolean',
            default: false,
          },
          {
            name: 'reviewedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'reviewedAt',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'resourceId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'resourceType',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'requiresInvestigation',
            type: 'boolean',
            default: false,
          },
          {
            name: 'timestamp',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'createdAt',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create foreign key for audit_logs -> users
    await queryRunner.createForeignKey(
      'audit_logs',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
        name: 'FK_audit_logs_userId',
      }),
    );

    // Create indexes for audit_logs table
    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'IDX_audit_logs_action_timestamp',
        columnNames: ['action', 'timestamp'],
      }),
    );

    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'IDX_audit_logs_severity_timestamp',
        columnNames: ['severity', 'timestamp'],
      }),
    );

    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'IDX_audit_logs_entity_entityId',
        columnNames: ['entity', 'entityId'],
      }),
    );

    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'IDX_audit_logs_userId',
        columnNames: ['userId'],
      }),
    );

    // Create updated_at trigger function
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Apply updated_at trigger to tables
    const tablesWithUpdatedAt = ['users', 'sessions', 'mfa_devices', 'medical_records', 'access_grants'];
    for (const table of tablesWithUpdatedAt) {
      await queryRunner.query(`
        CREATE TRIGGER update_${table}_updated_at
        BEFORE UPDATE ON ${table}
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
      `);
    }

    // Add comments for HIPAA compliance documentation
    await queryRunner.query(`
      COMMENT ON TABLE users IS 'User accounts with authentication and authorization';
      COMMENT ON TABLE sessions IS 'User session management for authentication tracking';
      COMMENT ON TABLE mfa_devices IS 'Multi-factor authentication devices for enhanced security';
      COMMENT ON TABLE medical_records IS 'Patient medical records - PHI data (HIPAA protected)';
      COMMENT ON TABLE access_grants IS 'Access control grants for medical record sharing';
      COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for HIPAA compliance';
    `);

    // Enable Row Level Security on sensitive tables
    await queryRunner.query(`
      ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
      ALTER TABLE access_grants ENABLE ROW LEVEL SECURITY;
      ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
    `);

    // Create RLS policies for audit_logs
    await queryRunner.query(`
      CREATE POLICY audit_logs_read_policy ON audit_logs
      FOR SELECT
      USING (true);
    `);

    await queryRunner.query(`
      CREATE POLICY audit_logs_insert_policy ON audit_logs
      FOR INSERT
      WITH CHECK (true);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    const tablesWithUpdatedAt = ['users', 'sessions', 'mfa_devices', 'medical_records', 'access_grants'];
    for (const table of tablesWithUpdatedAt) {
      await queryRunner.query(`DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table}`);
    }

    // Drop trigger function
    await queryRunner.query('DROP FUNCTION IF EXISTS update_updated_at_column');

    // Drop RLS policies
    await queryRunner.query('DROP POLICY IF EXISTS audit_logs_insert_policy ON audit_logs');
    await queryRunner.query('DROP POLICY IF EXISTS audit_logs_read_policy ON audit_logs');

    // Drop tables in reverse order (respecting foreign keys)
    await queryRunner.dropTable('audit_logs');
    await queryRunner.dropTable('access_grants');
    await queryRunner.dropTable('medical_records');
    await queryRunner.dropTable('mfa_devices');
    await queryRunner.dropTable('sessions');
    await queryRunner.dropTable('users');

    // Drop extensions
    await queryRunner.query('DROP EXTENSION IF EXISTS "pgcrypto"');
    await queryRunner.query('DROP EXTENSION IF EXISTS "uuid-ossp"');
  }
}
