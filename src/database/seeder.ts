import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { User, UserRole } from '../auth/entities/user.entity';
import {
  MedicalRecord,
  RecordType,
  MedicalRecordStatus,
} from '../medical-records/entities/medical-record.entity';
import {
  AccessGrant,
  AccessLevel,
  GrantStatus,
} from '../access-control/entities/access-grant.entity';
import { AuditLogEntity, AuditAction } from '../common/audit/audit-log.entity';
import * as argon2 from 'argon2';
import { dataSourceOptions } from '../config/database.config';

const SEED_TAG = 'seeder_generated';

/** Generate a valid-format Stellar public key (G + 55 base32 chars) */
function fakeStellarAddress(): string {
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let key = 'G';
  for (let i = 0; i < 55; i++) {
    key += base32Chars[Math.floor(Math.random() * base32Chars.length)];
  }
  return key;
}

async function seed() {
  console.log('🌱 Starting database seeding...');

  if (process.env.NODE_ENV === 'production') {
    throw new Error('❌ Cannot run seeder in production environment!');
  }

  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();
  console.log('✅ Database connection established');

  try {
    const userRepo = dataSource.getRepository(User);
    const recordRepo = dataSource.getRepository(MedicalRecord);
    const grantRepo = dataSource.getRepository(AccessGrant);
    const auditRepo = dataSource.getRepository(AuditLogEntity);

    // ── Idempotency: skip if already seeded ──────────────────────────────────
    const alreadySeeded = await userRepo.findOne({
      where: { institution: SEED_TAG },
    });
    if (alreadySeeded) {
      console.log('⚠️  Seed data already present – skipping (idempotent run).');
      return;
    }

    const testPassword = await argon2.hash('Test123!@#');

    // ── 10 Providers ─────────────────────────────────────────────────────────
    console.log('👨‍⚕️  Creating 10 providers...');
    const providerRoles = [UserRole.PHYSICIAN, UserRole.NURSE];
    const providers: User[] = [];
    for (let i = 0; i < 10; i++) {
      const role = providerRoles[i % 2];
      const provider = userRepo.create({
        email: faker.internet.email({ provider: 'healthystellar.dev' }),
        passwordHash: testPassword,
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        role,
        isActive: true,
        isLicenseVerified: true,
        country: faker.location.countryCode('alpha-2'),
        isAcceptingPatients: faker.datatype.boolean(),
        licenseNumber: `${role === UserRole.PHYSICIAN ? 'MD' : 'RN'}-${faker.string.numeric(6)}`,
        npi: faker.string.numeric(10),
        specialization: faker.helpers.arrayElement([
          'Cardiology',
          'Neurology',
          'Pediatrics',
          'Oncology',
          'General Practice',
        ]),
        institution: SEED_TAG,
      });
      providers.push(await userRepo.save(provider));
    }
    console.log('  ✓ Providers created');

    // ── 50 Patients ──────────────────────────────────────────────────────────
    console.log('🧑‍🤝‍🧑 Creating 50 patients...');
    const patients: User[] = [];
    for (let i = 0; i < 50; i++) {
      const patient = userRepo.create({
        email: faker.internet.email(),
        passwordHash: testPassword,
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        role: UserRole.PATIENT,
        isActive: true,
        stellarPublicKey: fakeStellarAddress(),
        institution: SEED_TAG,
      });
      patients.push(await userRepo.save(patient));
    }
    console.log('  ✓ Patients created');

    // ── 200 Medical Records ──────────────────────────────────────────────────
    console.log('📋 Creating 200 medical records...');
    const recordTypes = Object.values(RecordType);
    const records: MedicalRecord[] = [];
    for (let i = 0; i < 200; i++) {
      const patient = patients[i % patients.length];
      const provider = providers[i % providers.length];
      const record = recordRepo.create({
        patientId: patient.id,
        providerId: provider.id,
        createdBy: provider.id,
        recordType: faker.helpers.arrayElement(recordTypes),
        title: faker.lorem.sentence({ min: 3, max: 7 }),
        description: faker.lorem.paragraph(),
        status: MedicalRecordStatus.ACTIVE,
        recordDate: faker.date.past({ years: 2 }),
        metadata: {
          notes: faker.lorem.sentence(),
          icd10: `${faker.string.alpha({ length: 1, casing: 'upper' })}${faker.string.numeric(2)}`,
        },
      });
      records.push(await recordRepo.save(record));
    }
    console.log('  ✓ Medical records created');

    // ── 30 Access Grants ─────────────────────────────────────────────────────
    console.log('🔐 Creating 30 access grants...');
    for (let i = 0; i < 30; i++) {
      const patient = patients[i % patients.length];
      const grantee = providers[i % providers.length];
      // pick 1-3 records belonging to this patient (or any records as fallback)
      const patientRecords = records.filter((r) => r.patientId === patient.id);
      const pool = patientRecords.length ? patientRecords : records;
      const slice = faker.helpers.arrayElements(pool, { min: 1, max: 3 });
      const grant = grantRepo.create({
        patientId: patient.id,
        granteeId: grantee.id,
        recordIds: slice.map((r) => r.id),
        accessLevel: faker.helpers.arrayElement(Object.values(AccessLevel)),
        status: GrantStatus.ACTIVE,
        expiresAt: faker.date.future({ years: 1 }),
      });
      await grantRepo.save(grant);
    }
    console.log('  ✓ Access grants created');

    // ── 100 Audit Log Entries ────────────────────────────────────────────────
    console.log('📝 Creating 100 audit log entries...');
    const auditActions = Object.values(AuditAction);
    const severities: Array<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = [
      'LOW',
      'MEDIUM',
      'HIGH',
      'CRITICAL',
    ];
    const allUsers = [...providers, ...patients];
    for (let i = 0; i < 100; i++) {
      const user = allUsers[i % allUsers.length];
      const entry = auditRepo.create({
        userId: user.id,
        action: faker.helpers.arrayElement(auditActions),
        entity: faker.helpers.arrayElement(['User', 'MedicalRecord', 'AccessGrant']),
        entityId: faker.string.uuid(),
        description: faker.lorem.sentence(),
        severity: faker.helpers.arrayElement(severities),
        ipAddress: faker.internet.ip(),
        userAgent: faker.internet.userAgent(),
        details: { seeded: true },
      });
      await auditRepo.save(entry);
    }
    console.log('  ✓ Audit log entries created');

    console.log('\n✅ Seeding completed!');
    console.log('  Providers : 10');
    console.log('  Patients  : 50');
    console.log('  Records   : 200');
    console.log('  Grants    : 30');
    console.log('  Audit logs: 100');
    console.log('\n🔑 All seeded users share password: Test123!@#');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await dataSource.destroy();
  }
}

seed()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
