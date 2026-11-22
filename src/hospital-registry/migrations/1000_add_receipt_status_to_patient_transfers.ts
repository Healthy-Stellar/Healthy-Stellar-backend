import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddReceiptStatusToPatientTransfers1000000000000 implements MigrationInterface {
  name = 'AddReceiptStatusToPatientTransfers1000000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type if using PostgreSQL
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "receipt_status_enum" AS ENUM (
          'NOT_ANCHORED',
          'ANCHORING',
          'ANCHORED',
          'ANCHOR_FAILED'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add receipt_status column
    await queryRunner.addColumn(
      'patient_transfers',
      new TableColumn({
        name: 'receipt_status',
        type: 'enum',
        enum: ['NOT_ANCHORED', 'ANCHORING', 'ANCHORED', 'ANCHOR_FAILED'],
        default: "'NOT_ANCHORED'",
      }),
    );

    // Add receipt_error column for tracking failures
    await queryRunner.addColumn(
      'patient_transfers',
      new TableColumn({
        name: 'receipt_error',
        type: 'text',
        isNullable: true,
        default: null,
      }),
    );

    // Mark existing transfers with fake receipts as NOT_ANCHORED
    // Fake receipts start with 'sim-'
    await queryRunner.query(`
      UPDATE patient_transfers
      SET 
        receipt_status = 'NOT_ANCHORED'::receipt_status_enum,
        receipt_error = 'Pre-migration: Simulated receipt - not anchored on-chain'
      WHERE stellar_tx_hash LIKE 'sim-%' OR stellar_tx_hash IS NULL;
    `);

    // Mark successfully completed transfers (without fake receipts) as ANCHORED
    // In production, these might be real or simulated depending on your setup
    await queryRunner.query(`
      UPDATE patient_transfers
      SET receipt_status = 'ANCHORED'::receipt_status_enum
      WHERE 
        stellar_tx_hash IS NOT NULL 
        AND stellar_tx_hash NOT LIKE 'sim-%'
        AND status = 'COMPLETED';
    `);

    // Add index for querying transfers by receipt status
    await queryRunner.createIndex(
      'patient_transfers',
      new TableIndex({
        name: 'IDX_patient_transfers_receipt_status',
        columnNames: ['receipt_status'],
      }),
    );

    // Add composite index for finding non-anchored transfers
    await queryRunner.createIndex(
      'patient_transfers',
      new TableIndex({
        name: 'IDX_patient_transfers_status_receipt',
        columnNames: ['status', 'receipt_status'],
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indices
    await queryRunner.dropIndex(
      'patient_transfers',
      'IDX_patient_transfers_status_receipt',
    );
    await queryRunner.dropIndex(
      'patient_transfers',
      'IDX_patient_transfers_receipt_status',
    );

    // Drop columns
    await queryRunner.dropColumn('patient_transfers', 'receipt_error');
    await queryRunner.dropColumn('patient_transfers', 'receipt_status');

    // Drop enum type (only if no other tables use it)
    await queryRunner.query(`DROP TYPE IF EXISTS "receipt_status_enum" CASCADE;`);
  }
}
