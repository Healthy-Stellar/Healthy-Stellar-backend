import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddActorColumnsToLabTests1795000000000 implements MigrationInterface {
  name = 'AddActorColumnsToLabTests1795000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('lab_tests'))) {
      return;
    }

    const table = await queryRunner.getTable('lab_tests');
    if (!table?.findColumnByName('createdBy')) {
      await queryRunner.addColumn(
        'lab_tests',
        new TableColumn({ name: 'createdBy', type: 'uuid', isNullable: true }),
      );
    }
    if (!table?.findColumnByName('updatedBy')) {
      await queryRunner.addColumn(
        'lab_tests',
        new TableColumn({ name: 'updatedBy', type: 'uuid', isNullable: true }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('lab_tests'))) {
      return;
    }

    const table = await queryRunner.getTable('lab_tests');
    if (table?.findColumnByName('updatedBy')) {
      await queryRunner.dropColumn('lab_tests', 'updatedBy');
    }
    if (table?.findColumnByName('createdBy')) {
      await queryRunner.dropColumn('lab_tests', 'createdBy');
    }
  }
}
