import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateRunbookMappingsTable1772800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "runbook_mappings_incidentcategory_enum" AS ENUM (
        'medication_error', 'patient_fall', 'equipment_failure',
        'infection_control_breach', 'data_breach', 'patient_identification_error',
        'surgical_complication', 'adverse_drug_reaction', 'system_downtime', 'security_incident'
      )
    `);

    await queryRunner.createTable(
      new Table({
        name: 'runbook_mappings',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'incidentCategory', type: 'runbook_mappings_incidentcategory_enum', isUnique: true },
          { name: 'runbookId', type: 'varchar', length: '100' },
          { name: 'runbookTitle', type: 'varchar', length: '255' },
          { name: 'runbookUrl', type: 'text' },
          { name: 'steps', type: 'text', isNullable: true },
          { name: 'isActive', type: 'boolean', default: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'runbook_mappings',
      new TableIndex({ name: 'IDX_runbook_mappings_incidentCategory', columnNames: ['incidentCategory'], isUnique: true }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('runbook_mappings');
    await queryRunner.query(`DROP TYPE "runbook_mappings_incidentcategory_enum"`);
  }
}
