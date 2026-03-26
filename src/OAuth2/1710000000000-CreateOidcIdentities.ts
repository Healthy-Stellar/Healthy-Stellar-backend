import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateOidcIdentities1710000000000 implements MigrationInterface {
  name = 'CreateOidcIdentities1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'oidc_identities',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'provider',
            type: 'varchar',
            length: '64',
            isNullable: false,
          },
          {
            name: 'provider_subject',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'given_name',
            type: 'varchar',
            length: '128',
            isNullable: true,
          },
          {
            name: 'family_name',
            type: 'varchar',
            length: '128',
            isNullable: true,
          },
          {
            name: 'raw_claims',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'last_used_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    // Unique constraint: one OIDC subject per provider
    await queryRunner.createIndex(
      'oidc_identities',
      new TableIndex({
        name: 'UQ_oidc_identities_provider_subject',
        columnNames: ['provider', 'provider_subject'],
        isUnique: true,
      }),
    );

    // Index on user_id for fast lookups by user
    await queryRunner.createIndex(
      'oidc_identities',
      new TableIndex({
        name: 'IDX_oidc_identities_user_id',
        columnNames: ['user_id'],
      }),
    );

    // FK to users
    await queryRunner.createForeignKey(
      'oidc_identities',
      new TableForeignKey({
        name: 'FK_oidc_identities_user',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Add stellar_address column to users if not already present
    const usersTable = await queryRunner.getTable('users');
    const hasStellar = usersTable?.columns.some((c) => c.name === 'stellar_address');
    if (!hasStellar) {
      await queryRunner.query(
        `ALTER TABLE "users" ADD COLUMN "stellar_address" varchar(56) NULL`,
      );
      await queryRunner.query(
        `CREATE UNIQUE INDEX "UQ_users_stellar_address" ON "users" ("stellar_address") WHERE "stellar_address" IS NOT NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('oidc_identities', 'FK_oidc_identities_user');
    await queryRunner.dropIndex('oidc_identities', 'IDX_oidc_identities_user_id');
    await queryRunner.dropIndex('oidc_identities', 'UQ_oidc_identities_provider_subject');
    await queryRunner.dropTable('oidc_identities');
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_users_stellar_address"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "stellar_address"`);
  }
}
