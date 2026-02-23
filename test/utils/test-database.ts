/**
 * Test Database Utilities
 * 
 * Provides utilities for managing the test database in E2E tests.
 */

import { DataSource } from 'typeorm';
import { join } from 'path';

let testDataSource: DataSource | null = null;

/**
 * Get or create test database connection
 */
export async function getTestDataSource(): Promise<DataSource> {
  if (testDataSource && testDataSource.isInitialized) {
    return testDataSource;
  }

  testDataSource = new DataSource({
    type: 'postgres',
    host: process.env.TEST_DB_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT || '5432'),
    username: process.env.TEST_DB_USERNAME || 'test_user',
    password: process.env.TEST_DB_PASSWORD || 'test_password',
    database: process.env.TEST_DB_NAME || 'healthy_stellar_test',
    entities: [join(__dirname, '../../src/**/*.entity{.ts,.js}')],
    synchronize: false, // Use migrations instead
    logging: process.env.DEBUG === 'true',
  });

  await testDataSource.initialize();
  return testDataSource;
}

/**
 * Close test database connection
 */
export async function closeTestDataSource(): Promise<void> {
  if (testDataSource && testDataSource.isInitialized) {
    await testDataSource.destroy();
    testDataSource = null;
  }
}

/**
 * Clean all tables in the test database
 */
export async function cleanDatabase(): Promise<void> {
  const dataSource = await getTestDataSource();
  const entities = dataSource.entityMetadatas;

  // Disable foreign key checks
  await dataSource.query('SET session_replication_role = replica;');

  // Truncate all tables
  for (const entity of entities) {
    const repository = dataSource.getRepository(entity.name);
    await repository.query(`TRUNCATE TABLE "${entity.tableName}" CASCADE;`);
  }

  // Re-enable foreign key checks
  await dataSource.query('SET session_replication_role = DEFAULT;');
}

/**
 * Seed test data
 */
export async function seedTestData(data: {
  users?: any[];
  patients?: any[];
  records?: any[];
  [key: string]: any[];
}): Promise<void> {
  const dataSource = await getTestDataSource();

  for (const [entityName, items] of Object.entries(data)) {
    if (!items || items.length === 0) continue;

    const repository = dataSource.getRepository(entityName);
    await repository.save(items);
  }
}

/**
 * Execute raw SQL query
 */
export async function executeQuery(query: string, parameters?: any[]): Promise<any> {
  const dataSource = await getTestDataSource();
  return dataSource.query(query, parameters);
}

/**
 * Get count of records in a table
 */
export async function getTableCount(tableName: string): Promise<number> {
  const dataSource = await getTestDataSource();
  const result = await dataSource.query(
    `SELECT COUNT(*) as count FROM "${tableName}"`,
  );
  return parseInt(result[0].count);
}

/**
 * Reset database sequences
 */
export async function resetSequences(): Promise<void> {
  const dataSource = await getTestDataSource();
  const entities = dataSource.entityMetadatas;

  for (const entity of entities) {
    if (entity.primaryColumns.length > 0) {
      const primaryColumn = entity.primaryColumns[0];
      if (primaryColumn.isGenerated) {
        await dataSource.query(
          `ALTER SEQUENCE IF EXISTS "${entity.tableName}_${primaryColumn.databaseName}_seq" RESTART WITH 1;`,
        );
      }
    }
  }
}
