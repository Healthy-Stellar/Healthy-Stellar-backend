import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateBulkExportJobsTable1771771003000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'bulk_export_jobs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'requesterId',
            type: 'varchar',
          },
          {
            name: 'requesterRole',
            type: 'varchar',
          },
          {
            name: 'resourceTypes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'in_progress', 'completed', 'failed', 'cancelled'],
            default: "'pending'",
          },
          {
            name: 'progress',
            type: 'int',
            default: 0,
          },
          {
            name: 'totalResources',
            type: 'int',
            default: 0,
          },
          {
            name: 'outputFiles',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'error',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'expiresAt',
            type: 'timestamp',
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
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'bulk_export_jobs',
      new TableIndex({
        name: 'IDX_BULK_EXPORT_REQUESTER',
        columnNames: ['requesterId'],
      }),
    );

    await queryRunner.createIndex(
      'bulk_export_jobs',
      new TableIndex({
        name: 'IDX_BULK_EXPORT_STATUS',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'bulk_export_jobs',
      new TableIndex({
        name: 'IDX_BULK_EXPORT_EXPIRES',
        columnNames: ['expiresAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('bulk_export_jobs');
  }
}
