#!/usr/bin/env ts-node

/**
 * Query Plan Analysis Script
 * 
 * This script generates detailed EXPLAIN ANALYZE output for the top 3
 * most common queries in the system. Use this to verify index usage
 * and identify optimization opportunities.
 * 
 * Usage:
 *   npm run explain:queries
 */

import { DataSource } from 'typeorm';

interface QueryPlan {
  name: string;
  query: string;
  params: any[];
  description: string;
}

class QueryPlanAnalyzer {
  private dataSource: DataSource;

  constructor() {
    this.dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'healthy_stellar',
      synchronize: false,
      logging: false,
    });
  }

  async initialize(): Promise<void> {
    await this.dataSource.initialize();
    console.log('✅ Database connection established\n');
  }

  async cleanup(): Promise<void> {
    await this.dataSource.destroy();
  }

  /**
   * Top 3 most common queries in the system
   */
  private getTopQueries(): QueryPlan[] {
    return [
      {
        name: 'Query #1: Medical Records by Patient ID',
        description: `
This is the most frequently executed query in the system. It retrieves all
medical records for a specific patient, ordered by creation date. This query
is executed on every patient dashboard load, medical record search, and
timeline view.

Expected Index Usage:
- BEFORE migration: Sequential scan or partial index on patient_id
- AFTER migration: IDX_medical_records_patient_id (B-tree index)

Performance Impact:
- Expected improvement: 80-95% reduction in query time
- Typical execution: 100-500 times per minute during peak hours
        `,
        query: `
SELECT 
  id, patient_id, provider_id, record_type, title, 
  description, status, record_date, created_at, updated_at
FROM medical_records 
WHERE patient_id = $1 
ORDER BY created_at DESC 
LIMIT 100
        `,
        params: ['00000000-0000-0000-0000-000000000001'],
      },
      {
        name: 'Query #2: Access Grant Validation',
        description: `
This query validates whether a user (grantee) has active access to a patient's
records. It checks for active grants that haven't expired. This is executed
on every access control check, making it one of the most critical queries
for system performance and HIPAA compliance.

Expected Index Usage:
- BEFORE migration: Multiple sequential scans or partial indexes
- AFTER migration: IDX_access_grants_patient_grantee_expires (composite index)

Performance Impact:
- Expected improvement: 70-90% reduction in query time
- Typical execution: 200-1000 times per minute during peak hours
- Critical for: Real-time access control decisions
        `,
        query: `
SELECT 
  id, patient_id, grantee_id, record_ids, access_level,
  status, expires_at, created_at
FROM access_grants 
WHERE patient_id = $1 
  AND grantee_id = $2 
  AND status = 'ACTIVE'
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY created_at DESC
        `,
        params: [
          '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000002',
        ],
      },
      {
        name: 'Query #3: User Activity Audit Trail',
        description: `
This query retrieves the audit trail for a specific user, showing all actions
they've performed in the system. This is essential for HIPAA compliance,
security investigations, and user activity monitoring.

Expected Index Usage:
- BEFORE migration: Sequential scan or partial index on user_id
- AFTER migration: IDX_audit_logs_user_id_timestamp (composite index)

Performance Impact:
- Expected improvement: 60-85% reduction in query time
- Typical execution: 50-200 times per minute
- Critical for: HIPAA audit reports, security investigations
        `,
        query: `
SELECT 
  id, user_id, operation, entity_type, entity_id,
  timestamp, ip_address, changes
FROM audit_logs 
WHERE user_id = $1 
ORDER BY timestamp DESC 
LIMIT 100
        `,
        params: ['user-123'],
      },
    ];
  }

  /**
   * Analyze a single query
   */
  private async analyzeQuery(queryPlan: QueryPlan): Promise<void> {
    console.log('='.repeat(80));
    console.log(`\n${queryPlan.name}\n`);
    console.log('─'.repeat(80));
    console.log(queryPlan.description);
    console.log('─'.repeat(80));
    console.log('\n📝 SQL Query:\n');
    console.log(queryPlan.query.trim());
    console.log('\n📊 Query Plan (EXPLAIN ANALYZE):\n');

    try {
      // Execute EXPLAIN ANALYZE
      const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT TEXT) ${queryPlan.query}`;
      const result = await this.dataSource.query(explainQuery, queryPlan.params);

      // Print the plan
      result.forEach((row: any) => {
        console.log(row['QUERY PLAN']);
      });

      console.log('\n');

      // Execute EXPLAIN in JSON format for programmatic analysis
      const explainJsonQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${queryPlan.query}`;
      const jsonResult = await this.dataSource.query(explainJsonQuery, queryPlan.params);
      const plan = jsonResult[0]['QUERY PLAN'][0];

      // Extract key metrics
      console.log('📈 Key Metrics:\n');
      console.log(`  Planning Time:    ${plan['Planning Time']?.toFixed(2)} ms`);
      console.log(`  Execution Time:   ${plan['Execution Time']?.toFixed(2)} ms`);
      console.log(`  Total Cost:       ${plan['Plan']['Total Cost']?.toFixed(2)}`);
      console.log(`  Rows Returned:    ${plan['Plan']['Actual Rows']}`);
      
      // Check for index usage
      const indexUsed = this.extractIndexInfo(plan['Plan']);
      if (indexUsed) {
        console.log(`  ✅ Index Used:    ${indexUsed}`);
      } else {
        console.log(`  ⚠️  No Index:     Sequential Scan detected`);
      }

      // Check for performance warnings
      this.checkPerformanceWarnings(plan);

      console.log('\n');
    } catch (error) {
      console.error(`❌ Error analyzing query: ${error}`);
    }
  }

  /**
   * Extract index information from query plan
   */
  private extractIndexInfo(plan: any): string | null {
    if (plan['Node Type'] === 'Index Scan' || plan['Node Type'] === 'Index Only Scan') {
      return plan['Index Name'];
    }
    if (plan['Plans']) {
      for (const subPlan of plan['Plans']) {
        const index = this.extractIndexInfo(subPlan);
        if (index) return index;
      }
    }
    return null;
  }

  /**
   * Check for common performance issues
   */
  private checkPerformanceWarnings(plan: any): void {
    const warnings: string[] = [];

    // Check execution time
    if (plan['Execution Time'] > 100) {
      warnings.push(`Slow query: Execution time ${plan['Execution Time'].toFixed(2)}ms exceeds 100ms threshold`);
    }

    // Check for sequential scans
    if (this.hasSequentialScan(plan['Plan'])) {
      warnings.push('Sequential scan detected: Consider adding an index');
    }

    // Check for high cost
    if (plan['Plan']['Total Cost'] > 1000) {
      warnings.push(`High query cost: ${plan['Plan']['Total Cost'].toFixed(2)} (consider optimization)`);
    }

    if (warnings.length > 0) {
      console.log('\n⚠️  Performance Warnings:\n');
      warnings.forEach(warning => {
        console.log(`  - ${warning}`);
      });
    } else {
      console.log('\n✅ No performance warnings detected');
    }
  }

  /**
   * Check if plan contains sequential scan
   */
  private hasSequentialScan(plan: any): boolean {
    if (plan['Node Type'] === 'Seq Scan') {
      return true;
    }
    if (plan['Plans']) {
      return plan['Plans'].some((subPlan: any) => this.hasSequentialScan(subPlan));
    }
    return false;
  }

  /**
   * Run analysis on all top queries
   */
  async analyzeTopQueries(): Promise<void> {
    console.log('\n🔍 QUERY PLAN ANALYSIS FOR TOP 3 QUERIES\n');
    console.log('This analysis shows how PostgreSQL executes the most common queries');
    console.log('in the system. Use this to verify index usage and identify optimization');
    console.log('opportunities.\n');

    const queries = this.getTopQueries();

    for (const query of queries) {
      await this.analyzeQuery(query);
    }

    console.log('='.repeat(80));
    console.log('\n💡 INTERPRETATION GUIDE\n');
    console.log('Index Scan:        ✅ Good - Using an index efficiently');
    console.log('Index Only Scan:   ✅ Excellent - Using index without table access');
    console.log('Bitmap Index Scan: ✅ Good - Using index for multiple conditions');
    console.log('Sequential Scan:   ⚠️  Warning - Reading entire table (slow for large tables)');
    console.log('');
    console.log('Planning Time:     Time spent planning the query (should be < 5ms)');
    console.log('Execution Time:    Time spent executing the query (target < 100ms)');
    console.log('Total Cost:        Estimated cost units (lower is better)');
    console.log('');
    console.log('='.repeat(80));
    console.log('\n');
  }

  /**
   * Generate comparison report
   */
  async generateComparisonReport(): Promise<void> {
    console.log('\n📊 BEFORE/AFTER MIGRATION COMPARISON\n');
    console.log('Run this script before and after the migration to compare:');
    console.log('');
    console.log('  # Before migration');
    console.log('  npm run explain:queries > explain-before.txt');
    console.log('');
    console.log('  # Run migration');
    console.log('  npm run migration:run');
    console.log('');
    console.log('  # After migration');
    console.log('  npm run explain:queries > explain-after.txt');
    console.log('');
    console.log('  # Compare');
    console.log('  diff explain-before.txt explain-after.txt');
    console.log('');
  }
}

// Main execution
async function main() {
  const analyzer = new QueryPlanAnalyzer();

  try {
    await analyzer.initialize();
    await analyzer.analyzeTopQueries();
    await analyzer.generateComparisonReport();
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  } finally {
    await analyzer.cleanup();
  }
}

main();
