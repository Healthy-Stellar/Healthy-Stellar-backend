/**
 * Global Setup for E2E Tests
 * 
 * This file runs once before all E2E test suites.
 * It sets up the test database and prepares the environment.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as dotenv from 'dotenv';
import { join } from 'path';

const execAsync = promisify(exec);

export default async function globalSetup() {
  console.log('\n🚀 Starting E2E Test Environment Setup...\n');

  // Load test environment variables
  dotenv.config({ path: join(__dirname, '.env.test') });

  try {
    // Check if Docker is running
    await checkDocker();

    // Start test database container
    await startTestDatabase();

    // Wait for database to be ready
    await waitForDatabase();

    // Run migrations
    await runMigrations();

    console.log('\n✅ E2E Test Environment Setup Complete!\n');
  } catch (error) {
    console.error('\n❌ E2E Test Environment Setup Failed:', error.message);
    throw error;
  }
}

async function checkDocker(): Promise<void> {
  try {
    await execAsync('docker --version');
    console.log('✓ Docker is available');
  } catch (error) {
    throw new Error(
      'Docker is not available. Please install Docker to run E2E tests.',
    );
  }
}

async function startTestDatabase(): Promise<void> {
  const containerName = 'healthy-stellar-test-db';
  const dbPort = process.env.TEST_DB_PORT || '5432';
  const dbUser = process.env.TEST_DB_USERNAME || 'test_user';
  const dbPassword = process.env.TEST_DB_PASSWORD || 'test_password';
  const dbName = process.env.TEST_DB_NAME || 'healthy_stellar_test';

  try {
    // Check if container already exists
    const { stdout } = await execAsync(
      `docker ps -a --filter name=${containerName} --format "{{.Names}}"`,
    );

    if (stdout.includes(containerName)) {
      console.log('✓ Test database container already exists');
      
      // Check if it's running
      const { stdout: runningCheck } = await execAsync(
        `docker ps --filter name=${containerName} --format "{{.Names}}"`,
      );

      if (!runningCheck.includes(containerName)) {
        console.log('  Starting existing container...');
        await execAsync(`docker start ${containerName}`);
      }
    } else {
      console.log('  Creating new test database container...');
      await execAsync(
        `docker run -d \
          --name ${containerName} \
          -e POSTGRES_USER=${dbUser} \
          -e POSTGRES_PASSWORD=${dbPassword} \
          -e POSTGRES_DB=${dbName} \
          -p ${dbPort}:5432 \
          postgres:15-alpine`,
      );
    }

    console.log('✓ Test database container is running');
  } catch (error) {
    throw new Error(`Failed to start test database: ${error.message}`);
  }
}

async function waitForDatabase(): Promise<void> {
  const maxAttempts = 30;
  const delay = 1000;

  console.log('  Waiting for database to be ready...');

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const dbHost = process.env.TEST_DB_HOST || 'localhost';
      const dbPort = process.env.TEST_DB_PORT || '5432';
      const dbUser = process.env.TEST_DB_USERNAME || 'test_user';
      const dbName = process.env.TEST_DB_NAME || 'healthy_stellar_test';

      await execAsync(
        `docker exec healthy-stellar-test-db pg_isready -h ${dbHost} -p 5432 -U ${dbUser} -d ${dbName}`,
      );

      console.log('✓ Database is ready');
      return;
    } catch (error) {
      if (i === maxAttempts - 1) {
        throw new Error('Database failed to become ready in time');
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function runMigrations(): Promise<void> {
  try {
    console.log('  Running database migrations...');
    
    // Set environment to test
    process.env.NODE_ENV = 'test';
    
    await execAsync('npm run migration:run');
    console.log('✓ Migrations completed');
  } catch (error) {
    console.warn('⚠ Migration warning:', error.message);
    // Don't fail if migrations have issues - they might already be applied
  }
}
