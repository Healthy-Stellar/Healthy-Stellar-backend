import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateAccessGrantsTable1737800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'access_grants',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'patientId',
            type: 'uuid',
          },
          {
            name: 'granteeId',
            type: 'uuid',
          },
          {
            name: 'recordIds',
            type: 'text',
          },
          {
            name: 'accessLevel',
            type: 'enum',
            enum: ['READ', 'READ_WRITE'],
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['ACTIVE', 'REVOKED', 'EXPIRED'],
            default: "'ACTIVE'",
          },
          {
            name: 'expiresAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'revokedAt',
            type: 'timestamp',
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
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'access_grants',
      new TableIndex({
        name: 'IDX_ACCESS_GRANTS_PATIENT_GRANTEE_STATUS',
        columnNames: ['patientId', 'granteeId', 'status'],
      }),
    );

    await queryRunner.createIndex(
      'access_grants',
      new TableIndex({
        name: 'IDX_ACCESS_GRANTS_GRANTEE_STATUS',
        columnNames: ['granteeId', 'status'],
      }),
    );

    await queryRunner.createIndex(
      'access_grants',
      new TableIndex({
        name: 'IDX_ACCESS_GRANTS_PATIENT',
        columnNames: ['patientId'],
      }),
    );

    await queryRunner.createIndex(
      'access_grants',
      new TableIndex({
        name: 'IDX_ACCESS_GRANTS_GRANTEE',
        columnNames: ['granteeId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('access_grants');
  }
}
