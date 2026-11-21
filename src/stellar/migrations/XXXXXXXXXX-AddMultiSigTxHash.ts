import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMultiSigTxHash1724994725000 implements MigrationInterface {
    name = 'AddMultiSigTxHash1724994725000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // check if column exists, then add if not
        const table = await queryRunner.getTable('multi_sig_transactions');
        const columns = await queryRunner.getColumns(table);
        if (!columns.find(c => c.name === 'execution_attempts')) {
            await queryRunner.addColumn(table, 'execution_attempts', { type: 'int', default: 0 });
        }
        if (!columns.find(c => c.name === 'last_error')) {
            await queryRunner.addColumn(table, 'last_error', { type: 'text', isNullable: true });
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('multi_sig_transactions');
        const columns = await queryRunner.getColumns(table);
        if (columns.find(c => c.name === 'execution_attempts')) {
            await queryRunner.dropColumn(table, 'execution_attempts');
        }
        if (columns.find(c => c.name === 'last_error')) {
            await queryRunner.dropColumn(table, 'last_error');
        }
    }
}