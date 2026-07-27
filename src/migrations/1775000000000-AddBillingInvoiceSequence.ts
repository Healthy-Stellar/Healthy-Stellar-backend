import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBillingInvoiceSequence1775000000000 implements MigrationInterface {
  name = 'AddBillingInvoiceSequence1775000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS billing_invoice_seq START 1`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP SEQUENCE IF EXISTS billing_invoice_seq`);
  }
}
