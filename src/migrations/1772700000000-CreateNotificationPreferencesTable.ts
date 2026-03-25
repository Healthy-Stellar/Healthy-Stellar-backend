import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class CreateNotificationPreferencesTable1772700000000 implements MigrationInterface {
  name = 'CreateNotificationPreferencesTable1772700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'notification_preferences',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'patientId', type: 'varchar', isNullable: false },
          { name: 'webSocketEnabled', type: 'boolean', default: true },
          { name: 'emailEnabled', type: 'boolean', default: false },
          { name: 'newRecordNotifications', type: 'boolean', default: true },
          { name: 'accessGrantedNotifications', type: 'boolean', default: true },
          { name: 'accessRevokedNotifications', type: 'boolean', default: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'notification_preferences',
      new Index({ columnNames: ['patientId'], isUnique: true } as any),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('notification_preferences');
  }
}
