/**
 * Clears all seeder-generated data from the database.
 * Removes rows tagged with institution = 'seeder_generated' or 'test_seeder_generated'.
 * Does NOT truncate tables – safe to run alongside real data.
 */
import { DataSource, In } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { AccessGrant } from '../access-control/entities/access-grant.entity';
import { AuditLogEntity } from '../common/audit/audit-log.entity';
import { dataSourceOptions } from '../config/database.config';

const SEED_TAGS = ['seeder_generated', 'test_seeder_generated'];

async function clear() {
  console.log('🗑️  Clearing seeded data...');

  if (process.env.NODE_ENV === 'production') {
    throw new Error('❌ Cannot run seed:clear in production!');
  }

  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();

  try {
    const userRepo = dataSource.getRepository(User);
    const recordRepo = dataSource.getRepository(MedicalRecord);
    const grantRepo = dataSource.getRepository(AccessGrant);
    const auditRepo = dataSource.getRepository(AuditLogEntity);

    // Find seeded users
    const seededUsers = await userRepo.find({ where: { institution: In(SEED_TAGS) } });
    const seededUserIds = seededUsers.map((u) => u.id);

    if (!seededUserIds.length) {
      console.log('ℹ️  No seeded data found.');
      return;
    }

    // Remove dependent data first
    if (seededUserIds.length) {
      await auditRepo
        .createQueryBuilder()
        .delete()
        .where('userId IN (:...ids)', { ids: seededUserIds })
        .execute();

      await grantRepo
        .createQueryBuilder()
        .delete()
        .where('patientId IN (:...ids) OR granteeId IN (:...ids)', { ids: seededUserIds })
        .execute();

      await recordRepo
        .createQueryBuilder()
        .delete()
        .where('patientId IN (:...ids)', { ids: seededUserIds })
        .execute();

      await userRepo.remove(seededUsers);
    }

    console.log(`✅ Cleared seeded data (${seededUserIds.length} users and related records).`);
  } finally {
    await dataSource.destroy();
  }
}

clear()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('❌ Clear failed:', e);
    process.exit(1);
  });
