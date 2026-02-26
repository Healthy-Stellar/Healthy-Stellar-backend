import { MigrationInterface, QueryRunner, Table, TableColumn } from 'typeorm';

export class AddReportJobsAndStellarTxHash1772101980000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add stellarTxHash column to medical_records table
    await queryRunner.addColumn(
      'medical_records',
      new TableColumn({
        name: 'stellarTxHash',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );

    // Create report_jobs table
    await queryRunner.createTable(
      new Table({
        name: 'report_jobs',
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
            isNullable: false,
          },
          {
            name: 'format',
            type: 'enum',
            enum: ['pdf', 'csv'],
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'processing', 'completed', 'failed'],
            default: "'pending'",
          },
          {
            name: 'ipfsHash',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'downloadUrl',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'downloadToken',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'expiresAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'downloaded',
            type: 'boolean',
            default: false,
          },
          {
            name: 'errorMessage',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'estimatedTime',
            type: 'int',
            default: 0,
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
        indices: [
          {
            name: 'IDX_REPORT_JOBS_PATIENT_ID',
            columnNames: ['patientId'],
          },
          {
            name: 'IDX_REPORT_JOBS_STATUS',
            columnNames: ['status'],
          },
          {
            name: 'IDX_REPORT_JOBS_DOWNLOAD_TOKEN',
            columnNames: ['downloadToken'],
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('report_jobs');
    await queryRunner.dropColumn('medical_records', 'stellarTxHash');
  }
}
