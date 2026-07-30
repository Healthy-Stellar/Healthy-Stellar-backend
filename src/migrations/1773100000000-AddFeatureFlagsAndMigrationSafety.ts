import { MigrationInterface, QueryRunner, Table } from 'typeorm';
import { createIndexConcurrently } from '../common/utils/migration-safety.util';

export class AddFeatureFlagsAndMigrationSafety1773100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('feature_flags');
    if (!tableExists) {
      await queryRunner.createTable(
        new Table({
          name: 'feature_flags',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            { name: 'key', type: 'varchar', isUnique: true },
            { name: 'enabled', type: 'boolean', default: false },
            {
              name: 'strategy',
              type: 'enum',
              enum: ['ALL', 'PERCENTAGE', 'ALLOWLIST'],
              default: "'ALL'",
            },
            { name: 'rolloutPercentage', type: 'int', default: 0 },
            { name: 'allowlist', type: 'simple-array', isNullable: true },
            { name: 'description', type: 'text', isNullable: true },
            { name: 'updatedBy', type: 'uuid', isNullable: true },
            { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
            { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          ],
        }),
        true,
      );
    }

    // Non-blocking index creation
    await createIndexConcurrently(
      queryRunner,
      'IDX_FEATURE_FLAGS_KEY',
      'feature_flags',
      ['key'],
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('feature_flags', true);
  }
}
