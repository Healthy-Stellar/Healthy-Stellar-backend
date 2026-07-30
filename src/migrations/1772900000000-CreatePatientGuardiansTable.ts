import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreatePatientGuardiansTable1772900000000 implements MigrationInterface {
  name = 'CreatePatientGuardiansTable1772900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE guardian_relationship_type_enum AS ENUM (
        'parent', 'legal_guardian', 'spouse', 'sibling', 'other'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE guardianship_status_enum AS ENUM (
        'active', 'revoked', 'expired', 'pending_review'
      )
    `);

    await queryRunner.createTable(
      new Table({
        name: 'patient_guardians',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
          { name: 'guardian_user_id', type: 'uuid' },
          { name: 'dependent_patient_id', type: 'uuid' },
          { name: 'relationship_type', type: 'guardian_relationship_type_enum' },
          { name: 'status', type: 'guardianship_status_enum', default: "'active'" },
          { name: 'effective_from', type: 'date' },
          { name: 'effective_to', type: 'date', isNullable: true },
          { name: 'revoked_by', type: 'uuid', isNullable: true },
          { name: 'revoked_at', type: 'timestamp', isNullable: true },
          { name: 'revocation_reason', type: 'text', isNullable: true },
          { name: 'created_by', type: 'uuid' },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'patient_guardians',
      new TableIndex({
        name: 'IDX_patient_guardians_guardian_dependent_unique',
        columnNames: ['guardian_user_id', 'dependent_patient_id'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'patient_guardians',
      new TableIndex({
        name: 'IDX_patient_guardians_dependent_status',
        columnNames: ['dependent_patient_id', 'status'],
      }),
    );

    await queryRunner.createForeignKey(
      'patient_guardians',
      new TableForeignKey({
        name: 'FK_patient_guardians_dependent',
        columnNames: ['dependent_patient_id'],
        referencedTableName: 'patients',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('patient_guardians', 'FK_patient_guardians_dependent');
    await queryRunner.dropTable('patient_guardians');
    await queryRunner.query('DROP TYPE IF EXISTS guardianship_status_enum');
    await queryRunner.query('DROP TYPE IF EXISTS guardian_relationship_type_enum');
  }
}
