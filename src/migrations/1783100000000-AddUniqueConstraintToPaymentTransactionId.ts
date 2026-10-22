import { MigrationInterface, QueryRunner } from 'typeorm';
import { createIndexConcurrently } from '../common/utils/migration-safety.util';

/**
 * Migration: Unique constraint on payments.transactionId
 *
 * Why this migration
 * -------------------
 * PaymentService.create() previously had no server-side protection against
 * duplicate/double-processed payments: `transactionId` was optional and
 * un-indexed, so a client retry after a timeout (or a duplicate webhook
 * delivery) could insert a second Payment row and deduct twice from
 * `billing.balance`. PaymentService now checks for an existing payment by
 * transactionId before inserting, but that check-then-insert is itself
 * race-prone under concurrent requests — the unique index is the
 * authoritative guard, with the application-level check turning the
 * resulting unique-violation into a clean "return the existing payment"
 * instead of a 500.
 *
 * `transactionId` is nullable, and Postgres unique indexes treat NULLs as
 * distinct from one another, so rows without a transactionId are unaffected.
 *
 * Idempotency: guarded by table/column existence checks so the migration is
 * safe to re-run against a partially-applied schema. If duplicate
 * transactionId values already exist (e.g. seeded/test data), the unique
 * index creation is skipped with a warning rather than failing the deploy —
 * operators can reconcile duplicates and re-run.
 */
export class AddUniqueConstraintToPaymentTransactionId1783100000000
  implements MigrationInterface
{
  name = 'AddUniqueConstraintToPaymentTransactionId1783100000000';

  private readonly indexName = 'UQ_payments_transactionId';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('payments'))) {
      return;
    }
    if (!(await queryRunner.hasColumn('payments', 'transactionId'))) {
      return;
    }

    const duplicates: Array<{ count: string }> = await queryRunner.query(
      `SELECT COUNT(*) AS count FROM (
         SELECT "transactionId"
         FROM "payments"
         WHERE "transactionId" IS NOT NULL
         GROUP BY "transactionId"
         HAVING COUNT(*) > 1
       ) dups`,
    );

    if (Number(duplicates[0]?.count ?? 0) > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `Migration ${this.name} skipped: duplicate "transactionId" values exist in "payments". ` +
          `Reconcile duplicates and re-run this migration.`,
      );
      return;
    }

    await createIndexConcurrently(
      queryRunner,
      this.indexName,
      'payments',
      ['transactionId'],
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('payments'))) {
      return;
    }
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "${this.indexName}"`);
  }
}
