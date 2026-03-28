/**
 * Test environment seeder – minimal data for fast test runs.
 * Seeds: 2 providers, 3 patients, 5 records, 2 grants, 3 audit logs.
 */
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

const SEED_TAG = 'test_seeder_generated';

function fakeStellarAddress(): string {
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let key = 'G';
  for (let i = 0; i < 55; i++) {
    key += base32Chars[Math.floor(Math.random() * base32Chars.length)];
  }
  return key;
}

async function seedTest() {
  console.log('🌱 Starting TEST database seeding (minimal)...');

  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();

  try {
    const userRepo = dataSource.getRepository(User);
    const recordRepo = dataSource.getRepository(MedicalRecord);
    const grantRepo = dataSource.getRepository(AccessGrant);
    const auditRepo = dataSource.getRepository(AuditLogEntity);

    // Idempotency check
    const alreadySeeded = await userRepo.findOne({ where: { institution: SEED_TAG } });
    if (alreadySeeded) {
      console.log('⚠️  Test seed data already present – skipping.');
      return;
    }

    const testPassword = await argon2.hash('Test123!@#');

    // 2 providers
    const providers: User[] = [];
    for (let i = 0; i < 2; i++) {
      providers.push(
        await userRepo.save(
          userRepo.create({
            email: `test.provider${i}@test.dev`,
            passwordHash: testPassword,
            firstName: faker.person.firstName(),
            lastName: faker.person.lastName(),
            role: UserRole.PHYSICIAN,
            isActive: true,
            isLicenseVerified: true,
            institution: SEED_TAG,
          }),
        ),
      );
    }

    // 3 patients
    const patients: User[] = [];
    for (let i = 0; i < 3; i++) {
      patients.push(
        await userRepo.save(
          userRepo.create({
            email: `test.patient${i}@test.dev`,
            passwordHash: testPassword,
            firstName: faker.person.firstName(),
            lastName: faker.person.lastName(),
            role: UserRole.PATIENT,
            isActive: true,
            stellarPublicKey: fakeStellarAddress(),
            institution: SEED_TAG,
          }),
        ),
      );
    }

    // 5 records
    const records: MedicalRecord[] = [];
    for (let i = 0; i < 5; i++) {
      records.push(
        await recordRepo.save(
          recordRepo.create({
            patientId: patients[i % patients.length].id,
            providerId: providers[i % providers.length].id,
            createdBy: providers[i % providers.length].id,
            recordType: RecordType.CONSULTATION,
            title: `Test Record ${i + 1}`,
            description: faker.lorem.sentence(),
            status: MedicalRecordStatus.ACTIVE,
            recordDate: new Date(),
          }),
        ),
      );
    }

    // 2 grants
    for (let i = 0; i < 2; i++) {
      await grantRepo.save(
        grantRepo.create({
          patientId: patients[i].id,
          granteeId: providers[i].id,
          recordIds: [records[i].id],
          accessLevel: AccessLevel.READ,
          status: GrantStatus.ACTIVE,
          expiresAt: faker.date.future({ years: 1 }),
        }),
      );
    }

    // 3 audit logs
    for (let i = 0; i < 3; i++) {
      await auditRepo.save(
        auditRepo.create({
          userId: providers[i % providers.length].id,
          action: AuditAction.DATA_ACCESS,
          entity: 'MedicalRecord',
          entityId: records[i].id,
          description: 'Test audit entry',
          severity: 'LOW',
          ipAddress: '127.0.0.1',
          details: { seeded: true },
        }),
      );
    }

    console.log('✅ Test seeding completed (2 providers, 3 patients, 5 records, 2 grants, 3 logs)');
  } finally {
    await dataSource.destroy();
  }
}

seedTest()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
