#!/usr/bin/env node
/**
 * register-graphql-queries.ts
 *
 * CLI script to register all approved GraphQL operations in the persisted
 * query store (Redis) at deploy time. This ensures that only pre-approved
 * queries are accepted in production while developers retain full freedom
 * in development mode.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/register-graphql-queries.ts
 *
 * Environment variables required:
 *   REDIS_HOST (default: localhost)
 *   REDIS_PORT (default: 6379)
 *   REDIS_PASSWORD (optional)
 *   REDIS_URL (alternative to host/port/password)
 */

import { ApqService } from '../src/graphql/services/apq.service';
import { ALL_OPERATIONS } from '../src/graphql/queries';

async function main() {
  const apqService = new ApqService();
  apqService.onModuleInit();

  console.log('Registering persisted GraphQL queries in Redis...');
  console.log(`Total operations to register: ${ALL_OPERATIONS.length}\n`);

  const results = await apqService.registerQueries(ALL_OPERATIONS);

  console.log('Registration complete:\n');
  for (const result of results) {
    const preview = result.query.replace(/\s+/g, ' ').trim().slice(0, 60);
    console.log(`  [OK] ${result.hash}  ${preview}...`);
  }

  const count = await apqService.getQueryCount();
  console.log(`\nTotal persisted queries in store: ${count}`);
}

main().catch((err) => {
  console.error('Failed to register GraphQL queries:', err);
  process.exit(1);
});
