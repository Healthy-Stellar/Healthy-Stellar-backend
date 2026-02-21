#!/usr/bin/env ts-node

/**
 * Database Performance Benchmarking Script
 * 
 * This script measures query performance before and after index optimization.
 * Run this script BEFORE and AFTER running the AddPerformanceIndexes migration
 * to document the performance improvements.
 * 
 * Usage:
 *   # Before migration
 *   npm run benchmark:db > benchmark-before.txt
 * 
 *   # Run migration
 *   npm run migration:run
 * 
 *   # After migration
 *   npm run benchmark:db > benchmark-after.txt
 * 
 *   # Compare results
 *   diff benchmark-before.txt benchmark-after.txt
 */

import { DataSource } from 'typeorm';
import { performance } from 'perf_hooks';

interface BenchmarkResult {
  query: string;
  description: string;
  executionTime: number;
  rowsReturned: number;
  planningTime?: number;
  executionTimeFromExplain?: number;
  indexesUsed: string[];
}

class DatabaseBenchmark {
  private dataSource: DataSource;
  private results: BenchmarkResult[] = [];

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
    console.log('\n✅ Database connection closed');
  }

  /**
   * Execute a query and measure its performance
   */
  private async benchmarkQuery(
    description: string,
    query: string,
    params: any[] = [],
  ): Promise<BenchmarkResult> {
    // Warm up the query cache
    await this.dataSource.query(query, params);

    // Execute with EXPLAIN ANALYZE
    const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
    const explainResult = await this.dataSource.query(explainQuery, params);
    const plan = explainResult[0]['QUERY PLAN'][0];

    // Execute the actual query and measure time
    const startTime = performance.now();
    const result = await this.dataSource.query(query, params);
    const endTime = performance.now();
    const executionTime = endTime - startTime;

    // Extract index usage from plan
    const indexesUsed = this.extractIndexesFromPlan(plan);

    return {
      query,
      description,
      executionTime,
      rowsReturned: result.length,
      planningTime: plan['Planning Time'],
      executionTimeFromExplain: plan['Execution Time'],
      indexesUsed,
    };
  }

  /**
   * Extract index names from query plan
   */
  private extractIndexesFromPlan(plan: any): string[] {
    const indexes: string[] = [];
    
    const traverse = (node: any) => {
      if (node['Node Type'] === 'Index Scan' || node['Node Type'] === 'Index Only Scan') {
        if (node['Index Name']) {
          indexes.push(node['Index Name']);
        }
      }
      if (node['Plans']) {
        node['Plans'].forEach((child: any) => traverse(child));
      }
    };
    
    traverse(plan['Plan']);
    return indexes;
  }

  /**
   * Run all benchmark queries
   */
  async runBenchmarks(): Promise<void> {
    console.log('🚀 Starting Database Performance Benchmarks\n');
    console.log('=' .repeat(80));
    console.log('\n');

    // ========================================================================
    // MEDICAL RECORDS BENCHMARKS
    // ========================================================================
    console.log('📋 MEDICAL RECORDS QUERIES\n');

    // Query 1: Patient record lookup
    const result1 = await this.benchmarkQuery(
      'Medical Records: Find by Patient ID',
      `SELECT * FROM medical_records WHERE patient_id = $1 LIMIT 100`,
      ['00000000-0000-0000-0000-000000000001'],
    );
    this.results.push(result1);
    this.printResult(result1);

    // Query 2: Complex filtered search
    const result2 = await this.benchmarkQuery(
      'Medical Records: Complex Filter (patient + type + status)',
      `SELECT * FROM medical_records 
       WHERE patient_id = $1 
       AND record_type = $2 
       AND status = $3 
       ORDER BY created_at DESC 
       LIMIT 50`,
      ['00000000-0000-0000-0000-000000000001', 'consultation', 'active'],
    );
    this.results.push(result2);
    this.printResult(result2);

    // Query 3: Status and type filtering
    const result3 = await this.benchmarkQuery(
      'Medical Records: Filter by Status and Type',
      `SELECT * FROM medical_records 
       WHERE status = $1 
       AND record_type = $2 
       ORDER BY created_at DESC 
       LIMIT 100`,
      ['active', 'diagnosis'],
    );
    this.results.push(result3);
    this.printResult(result3);

    // ========================================================================
    // ACCESS GRANTS BENCHMARKS
    // ========================================================================
    console.log('\n🔐 ACCESS GRANTS QUERIES\n');

    // Query 4: Access grant validation
    const result4 = await this.benchmarkQuery(
      'Access Grants: Validate Access (patient + grantee + expiration)',
      `SELECT * FROM access_grants 
       WHERE patient_id = $1 
       AND grantee_id = $2 
       AND status = 'ACTIVE'
       AND (expires_at IS NULL OR expires_at > NOW())`,
      ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'],
    );
    this.results.push(result4);
    this.printResult(result4);

    // Query 5: User's received grants
    const result5 = await this.benchmarkQuery(
      'Access Grants: Get Received Grants (grantee + status)',
      `SELECT * FROM access_grants 
       WHERE grantee_id = $1 
       AND status = 'ACTIVE'
       ORDER BY created_at DESC`,
      ['00000000-0000-0000-0000-000000000002'],
    );
    this.results.push(result5);
    this.printResult(result5);

    // Query 6: Expired grants batch processing
    const result6 = await this.benchmarkQuery(
      'Access Grants: Find Expired Grants',
      `SELECT * FROM access_grants 
       WHERE status = 'ACTIVE' 
       AND expires_at < NOW()`,
      [],
    );
    this.results.push(result6);
    this.printResult(result6);

    // ========================================================================
    // AUDIT LOGS BENCHMARKS
    // ========================================================================
    console.log('\n📊 AUDIT LOGS QUERIES\n');

    // Query 7: User activity timeline
    const result7 = await this.benchmarkQuery(
      'Audit Logs: User Activity Timeline',
      `SELECT * FROM audit_logs 
       WHERE user_id = $1 
       ORDER BY timestamp DESC 
       LIMIT 100`,
      ['user-123'],
    );
    this.results.push(result7);
    this.printResult(result7);

    // Query 8: Resource audit trail
    const result8 = await this.benchmarkQuery(
      'Audit Logs: Resource Audit Trail',
      `SELECT * FROM audit_logs 
       WHERE entity_id = $1 
       ORDER BY timestamp DESC`,
      ['00000000-0000-0000-0000-000000000001'],
    );
    this.results.push(result8);
    this.printResult(result8);

    // Query 9: Operation-specific audit
    const result9 = await this.benchmarkQuery(
      'Audit Logs: Operation Filter',
      `SELECT * FROM audit_logs 
       WHERE operation = $1 
       ORDER BY timestamp DESC 
       LIMIT 100`,
      ['UPDATE'],
    );
    this.results.push(result9);
    this.printResult(result9);

    // Query 10: Entity-specific audit trail
    const result10 = await this.benchmarkQuery(
      'Audit Logs: Entity Type + ID Audit Trail',
      `SELECT * FROM audit_logs 
       WHERE entity_type = $1 
       AND entity_id = $2 
       ORDER BY timestamp DESC`,
      ['medical_records', '00000000-0000-0000-0000-000000000001'],
    );
    this.results.push(result10);
    this.printResult(result10);

    // ========================================================================
    // MEDICAL HISTORY BENCHMARKS
    // ========================================================================
    console.log('\n📅 MEDICAL HISTORY QUERIES\n');

    // Query 11: Patient timeline
    const result11 = await this.benchmarkQuery(
      'Medical History: Patient Timeline',
      `SELECT * FROM medical_history 
       WHERE patient_id = $1 
       ORDER BY event_date DESC 
       LIMIT 50`,
      ['00000000-0000-0000-0000-000000000001'],
    );
    this.results.push(result11);
    this.printResult(result11);

    // Query 12: Record-specific history
    const result12 = await this.benchmarkQuery(
      'Medical History: Record History',
      `SELECT * FROM medical_history 
       WHERE medical_record_id = $1 
       ORDER BY event_date DESC`,
      ['00000000-0000-0000-0000-000000000001'],
    );
    this.results.push(result12);
    this.printResult(result12);

    // ========================================================================
    // SUMMARY
    // ========================================================================
    this.printSummary();
  }

  /**
   * Print individual benchmark result
   */
  private printResult(result: BenchmarkResult): void {
    console.log(`  ${result.description}`);
    console.log(`  ${'─'.repeat(76)}`);
    console.log(`  Execution Time:     ${result.executionTime.toFixed(2)} ms`);
    console.log(`  Planning Time:      ${result.planningTime?.toFixed(2) || 'N/A'} ms`);
    console.log(`  Rows Returned:      ${result.rowsReturned}`);
    console.log(`  Indexes Used:       ${result.indexesUsed.length > 0 ? result.indexesUsed.join(', ') : 'None (Sequential Scan)'}`);
    console.log('');
  }

  /**
   * Print summary statistics
   */
  private printSummary(): void {
    console.log('\n' + '='.repeat(80));
    console.log('📈 BENCHMARK SUMMARY\n');

    const totalTime = this.results.reduce((sum, r) => sum + r.executionTime, 0);
    const avgTime = totalTime / this.results.length;
    const totalRows = this.results.reduce((sum, r) => sum + r.rowsReturned, 0);
    const queriesWithIndexes = this.results.filter(r => r.indexesUsed.length > 0).length;
    const queriesWithoutIndexes = this.results.length - queriesWithIndexes;

    console.log(`  Total Queries:           ${this.results.length}`);
    console.log(`  Total Execution Time:    ${totalTime.toFixed(2)} ms`);
    console.log(`  Average Execution Time:  ${avgTime.toFixed(2)} ms`);
    console.log(`  Total Rows Returned:     ${totalRows}`);
    console.log(`  Queries Using Indexes:   ${queriesWithIndexes} (${((queriesWithIndexes / this.results.length) * 100).toFixed(1)}%)`);
    console.log(`  Queries w/o Indexes:     ${queriesWithoutIndexes} (${((queriesWithoutIndexes / this.results.length) * 100).toFixed(1)}%)`);
    console.log('');

    // Top 3 slowest queries
    const slowest = [...this.results]
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, 3);

    console.log('  🐌 Top 3 Slowest Queries:');
    slowest.forEach((r, i) => {
      console.log(`    ${i + 1}. ${r.description}: ${r.executionTime.toFixed(2)} ms`);
    });
    console.log('');

    // Queries without indexes
    const noIndexQueries = this.results.filter(r => r.indexesUsed.length === 0);
    if (noIndexQueries.length > 0) {
      console.log('  ⚠️  Queries Without Index Usage:');
      noIndexQueries.forEach(r => {
        console.log(`    - ${r.description}`);
      });
      console.log('');
    }

    console.log('='.repeat(80));
    console.log('\n💡 TIP: Run this script before and after the migration to compare results\n');
  }
}

// Main execution
async function main() {
  const benchmark = new DatabaseBenchmark();
  
  try {
    await benchmark.initialize();
    await benchmark.runBenchmarks();
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  } finally {
    await benchmark.cleanup();
  }
}

main();
