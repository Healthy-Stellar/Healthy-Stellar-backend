# Database Setup Guide

## Overview

This project uses **TypeORM** with **PostgreSQL** as the primary database. All schema changes are managed through versioned migrations to ensure consistency across environments.

## Key Principles

### ⚠️ Critical Rules

1. **NO `synchronize: true`** - Schema changes MUST go through migrations in ALL environments
2. **DATABASE_URL is the only required connection config** - Simplifies deployment
3. **All migrations are versioned** - Ensures reproducible database state
4. **Manual migration execution** - Migrations are never run automatically

## Configuration

### Environment Variables

The application supports two configuration methods:

#### Option 1: DATABASE_URL (Recommended for Production)

```bash
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
```

#### Option 2: Individual Parameters

```bash
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=your_username
DB_PASSWORD=your_password
DB_NAME=your_database
```

### Additional Configuration

```bash
# SSL Configuration (Production)
DB_SSL_ENABLED=true
DB_SSL_CA=/path/to/ca.crt
DB_SSL_CERT=/path/to/client.crt
DB_SSL_KEY=/path/to/client.key

# Connection Pool
DB_POOL_MIN=2
DB_POOL_MAX=20
```

## Database Schema

### Core Tables

1. **users** - User accounts with authentication
   - Supports multiple roles: admin, physician, nurse, patient, billing_staff, medical_records
   - Includes MFA support and account lockout features
   - HIPAA-compliant audit fields

2. **sessions** - User session management
   - Tracks active sessions with refresh tokens
   - Records IP address and user agent for security
   - Automatic cleanup of expired sessions

3. **mfa_devices** - Multi-factor authentication
   - TOTP-based MFA support
   - Backup codes for account recovery
   - Device management per user

4. **medical_records** - Patient medical records (PHI)
   - Encrypted sensitive data
   - Version tracking for audit trail
   - Support for multiple record types (consultation, diagnosis, treatment, etc.)

5. **access_grants** - Access control for medical records
   - Granular permission management
   - Time-based access expiration
   - Revocation tracking with audit trail

6. **audit_logs** - Comprehensive audit trail
   - HIPAA-compliant logging
   - Tracks all data access and modifications
   - Severity levels for security monitoring

## Migration Commands

### Generate a New Migration

After modifying entities, generate a migration:

```bash
npm run migration:generate -- src/migrations/DescriptiveName
```

Example:
```bash
npm run migration:generate -- src/migrations/AddPatientPhoneNumber
```

### Run Pending Migrations

Apply all pending migrations to the database:

```bash
npm run migration:run
```

### Revert Last Migration

Rollback the most recent migration:

```bash
npm run migration:revert
```

### Check Migration Status

View which migrations have been applied:

```bash
npm run typeorm migration:show
```

## Development Workflow

### Initial Setup

1. **Install PostgreSQL** (if not already installed)
   ```bash
   # macOS
   brew install postgresql@14
   brew services start postgresql@14

   # Ubuntu/Debian
   sudo apt-get install postgresql-14
   sudo systemctl start postgresql

   # Windows
   # Download from https://www.postgresql.org/download/windows/
   ```

2. **Create Database**
   ```bash
   createdb healthy_stellar_dev
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. **Run Migrations**
   ```bash
   npm run migration:run
   ```

5. **Seed Development Data** (Optional)
   ```bash
   npm run seed
   ```

### Making Schema Changes

1. **Modify Entity Files**
   - Update TypeScript entity files in `src/**/entities/`
   - Follow existing patterns and conventions

2. **Generate Migration**
   ```bash
   npm run migration:generate -- src/migrations/YourChangeName
   ```

3. **Review Generated Migration**
   - Check the generated file in `src/migrations/`
   - Verify SQL statements are correct
   - Add any custom logic if needed

4. **Test Migration**
   ```bash
   # Apply migration
   npm run migration:run

   # Test your changes
   npm run test

   # If issues, revert
   npm run migration:revert
   ```

5. **Commit Migration**
   ```bash
   git add src/migrations/
   git commit -m "feat: add migration for [description]"
   ```

## Database Seeder

The seeder creates test data for local development:

### What Gets Seeded

- **10 Users**:
  - 1 Admin
  - 2 Physicians (Dr. Smith - Cardiology, Dr. Johnson - Neurology)
  - 2 Nurses
  - 3 Patients
  - 1 Billing Staff
  - 1 Medical Records Staff

- **6 Medical Records**:
  - Various record types (consultations, lab results, diagnoses, prescriptions)
  - Realistic medical data with metadata

- **3 Access Grants**:
  - Physicians granted access to their patients' records
  - Nurse granted read access to patient records

### Running the Seeder

```bash
npm run seed
```

### Test Credentials

All seeded users have the same password:

```
Email: admin@healthystellar.com
Email: dr.smith@healthystellar.com
Email: patient1@example.com
Password: Test123!@#
```

### ⚠️ Important Notes

- **Development Only**: Seeder will refuse to run in production
- **Destructive**: Clears all existing data before seeding
- **Idempotent**: Can be run multiple times safely

## Production Deployment

### Pre-Deployment Checklist

- [ ] All migrations tested in staging environment
- [ ] Database backup created
- [ ] SSL/TLS enabled (`DB_SSL_ENABLED=true`)
- [ ] Connection pooling configured
- [ ] Audit logging verified
- [ ] Row-level security policies reviewed

### Deployment Steps

1. **Backup Database**
   ```bash
   pg_dump -h $DB_HOST -U $DB_USERNAME -d $DB_NAME > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Run Migrations**
   ```bash
   NODE_ENV=production npm run migration:run
   ```

3. **Verify Migration**
   ```bash
   npm run typeorm migration:show
   ```

4. **Monitor Application**
   - Check application logs
   - Verify database connections
   - Test critical endpoints

### Rollback Procedure

If issues occur after deployment:

1. **Stop Application**
   ```bash
   # Stop your application server
   ```

2. **Revert Migration**
   ```bash
   NODE_ENV=production npm run migration:revert
   ```

3. **Restore from Backup** (if needed)
   ```bash
   psql -h $DB_HOST -U $DB_USERNAME -d $DB_NAME < backup_file.sql
   ```

## Security Considerations

### HIPAA Compliance

1. **Encryption at Rest**
   - Use PostgreSQL encryption features
   - Encrypt sensitive columns using application-level encryption

2. **Encryption in Transit**
   - Always use SSL/TLS in production
   - Configure `DB_SSL_ENABLED=true`

3. **Access Control**
   - Use Row-Level Security (RLS) policies
   - Implement least-privilege access
   - Regular access audits

4. **Audit Logging**
   - All data access is logged
   - Logs retained per HIPAA requirements (6+ years)
   - Regular log reviews for suspicious activity

### Connection Security

```bash
# Production SSL Configuration
DB_SSL_ENABLED=true
DB_SSL_CA=/path/to/ca-certificate.crt
DB_SSL_CERT=/path/to/client-cert.crt
DB_SSL_KEY=/path/to/client-key.key
```

### Password Management

- Never commit `.env` files
- Use strong database passwords (16+ characters)
- Rotate credentials regularly
- Use secrets management (AWS Secrets Manager, HashiCorp Vault, etc.)

## Troubleshooting

### Connection Issues

**Problem**: Cannot connect to database

```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Check credentials
psql -h $DB_HOST -U $DB_USERNAME -d $DB_NAME

# Check firewall rules
sudo ufw status
```

### Migration Errors

**Problem**: Migration fails to run

```bash
# Check migration status
npm run typeorm migration:show

# View detailed error
npm run migration:run -- --verbose

# Manually fix database state if needed
psql -h $DB_HOST -U $DB_USERNAME -d $DB_NAME
```

**Problem**: Migration already exists

```bash
# Check migrations table
SELECT * FROM migrations ORDER BY timestamp DESC;

# Manually remove if needed (CAUTION!)
DELETE FROM migrations WHERE name = 'MigrationName';
```

### Performance Issues

**Problem**: Slow queries

```bash
# Enable query logging
# In .env: Set NODE_ENV=development

# Check slow queries in PostgreSQL
SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;

# Analyze query performance
EXPLAIN ANALYZE SELECT ...;
```

## Best Practices

### Entity Design

1. **Use UUIDs for Primary Keys**
   ```typescript
   @PrimaryGeneratedColumn('uuid')
   id: string;
   ```

2. **Add Timestamps**
   ```typescript
   @CreateDateColumn()
   createdAt: Date;

   @UpdateDateColumn()
   updatedAt: Date;
   ```

3. **Use Enums for Fixed Values**
   ```typescript
   export enum UserRole {
     ADMIN = 'admin',
     PHYSICIAN = 'physician',
   }
   ```

4. **Index Frequently Queried Columns**
   ```typescript
   @Index()
   @Column()
   email: string;
   ```

### Migration Best Practices

1. **Descriptive Names**: Use clear, descriptive migration names
2. **Small Changes**: Keep migrations focused on single changes
3. **Test Rollbacks**: Always test the `down()` method
4. **Data Migrations**: Separate schema and data migrations
5. **Review Generated SQL**: Always review auto-generated migrations

### Testing

```bash
# Run all tests
npm run test

# Run with coverage
npm run test:cov

# Test specific module
npm run test -- medical-records
```

## Additional Resources

- [TypeORM Documentation](https://typeorm.io/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html)
- [NestJS TypeORM Integration](https://docs.nestjs.com/techniques/database)

## Support

For issues or questions:
1. Check this documentation
2. Review existing migrations in `src/migrations/`
3. Check application logs
4. Contact the development team
