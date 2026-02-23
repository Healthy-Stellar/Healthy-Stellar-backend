/**
 * Global Teardown for E2E Tests
 * 
 * This file runs once after all E2E test suites.
 * It cleans up the test database and environment.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default async function globalTeardown() {
  console.log('\n🧹 Starting E2E Test Environment Cleanup...\n');

  try {
    // Option 1: Stop the container (keeps data for debugging)
    await stopTestDatabase();

    // Option 2: Remove the container completely (uncomment if needed)
    // await removeTestDatabase();

    console.log('\n✅ E2E Test Environment Cleanup Complete!\n');
  } catch (error) {
    console.error('\n⚠ E2E Test Environment Cleanup Warning:', error.message);
    // Don't throw - cleanup failures shouldn't fail the test run
  }
}

async function stopTestDatabase(): Promise<void> {
  const containerName = 'healthy-stellar-test-db';

  try {
    const { stdout } = await execAsync(
      `docker ps --filter name=${containerName} --format "{{.Names}}"`,
    );

    if (stdout.includes(containerName)) {
      console.log('  Stopping test database container...');
      await execAsync(`docker stop ${containerName}`);
      console.log('✓ Test database container stopped');
      console.log('  (Container preserved for debugging. Run "docker rm healthy-stellar-test-db" to remove)');
    } else {
      console.log('✓ Test database container was not running');
    }
  } catch (error) {
    console.warn('⚠ Could not stop test database:', error.message);
  }
}

async function removeTestDatabase(): Promise<void> {
  const containerName = 'healthy-stellar-test-db';

  try {
    const { stdout } = await execAsync(
      `docker ps -a --filter name=${containerName} --format "{{.Names}}"`,
    );

    if (stdout.includes(containerName)) {
      console.log('  Removing test database container...');
      await execAsync(`docker rm -f ${containerName}`);
      console.log('✓ Test database container removed');
    } else {
      console.log('✓ Test database container does not exist');
    }
  } catch (error) {
    console.warn('⚠ Could not remove test database:', error.message);
  }
}
