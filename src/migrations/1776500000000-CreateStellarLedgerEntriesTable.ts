import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateStellarLedgerEntriesTable1776500000000 implements MigrationInterface {
  name = 'CreateStellarLedgerEntriesTable1776500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'stellar_ledger_entries',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'account_id',
            type: 'varchar',
            isNullable: false,
            comment: 'Stellar account public key',
          },
          {
            name: 'amount',
            type: 'numeric',
            precision: 19,
            scale: 7,
            isNullable: false,
            comment: 'Amount in XLM',
          },
          {
            name: 'status',
            type: 'varchar',
            isNullable: false,
            default: "'confirmed'",
            comment: 'Status: confirmed or pending',
          },
          {
            name: 'tx_hash',
            type: 'varchar',
            isNullable: true,
            comment: 'Associated Stellar transaction hash if applicable',
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'stellar_ledger_entries',
      new TableIndex({
        name: 'IDX_stellar_ledger_entries_account_id_status',
        columnNames: ['account_id', 'status'],
      }),
    );

    await queryRunner.createIndex(
      'stellar_ledger_entries',
      new TableIndex({
        name: 'IDX_stellar_ledger_entries_created_at',
        columnNames: ['created_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('stellar_ledger_entries');
  }
}
