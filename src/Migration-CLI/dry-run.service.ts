import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, MigrationInterface, QueryRunner } from 'typeorm';

export interface DryRunStatement {
  sql: string;
  parameters?: unknown[];
  estimatedRowsAffected?: number;
  operationType: SqlOperationType;
  tableNames: string[];
  indexOperations: IndexOperation[];
  estimatedLockDurationMs?: number;
  lockLevel?: LockLevel;
}

export interface IndexOperation {
  type: 'CREATE' | 'DROP' | 'REINDEX';
  indexName: string;
  tableName: string;
  concurrent: boolean;
}

export interface DryRunReport {
  migrationName: string;
  statements: DryRunStatement[];
  totalStatements: number;
  totalIndexOperations: IndexOperation[];
  estimatedTotalLockMs: number;
  tablesAffected: string[];
  warnings: string[];
}

export type SqlOperationType =
  | 'DDL_CREATE'
  | 'DDL_ALTER'
  | 'DDL_DROP'
  | 'DML_INSERT'
  | 'DML_UPDATE'
  | 'DML_DELETE'
  | 'INDEX'
  | 'CONSTRAINT'
  | 'OTHER';

export type LockLevel =
  | 'NONE'
  | 'ACCESS_SHARE'
  | 'ROW_SHARE'
  | 'ROW_EXCLUSIVE'
  | 'SHARE_UPDATE_EXCLUSIVE'
  | 'SHARE'
  | 'SHARE_ROW_EXCLUSIVE'
  | 'EXCLUSIVE'
  | 'ACCESS_EXCLUSIVE';

/** Lock durations are rough estimates per operation type, in ms */
const LOCK_ESTIMATES_MS: Record<SqlOperationType, number> = {
  DDL_CREATE: 0,
  DDL_ALTER: 5000,
  DDL_DROP: 2000,
  DML_INSERT: 0,
  DML_UPDATE: 100,
  DML_DELETE: 100,
  INDEX: 30000,
  CONSTRAINT: 3000,
  OTHER: 100,
};

@Injectable()
export class DryRunService {
  private readonly logger = new Logger(DryRunService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Execute migrations in capture-mode: collect all SQL without committing.
   */
  async executeDryRun(
    migrations: MigrationInterface[],
  ): Promise<DryRunReport[]> {
    const reports: DryRunReport[] = [];

    for (const migration of migrations) {
      const report = await this.captureMigration(migration);
      reports.push(report);
    }

    return reports;
  }

  private async captureMigration(
    migration: MigrationInterface,
  ): Promise<DryRunReport> {
    const capturedSql: Array<{ sql: string; parameters?: unknown[] }> = [];

    // Build a fake QueryRunner that records SQL instead of executing it
    const fakeRunner = this.buildCapturingQueryRunner(capturedSql);

    try {
      await migration.up(fakeRunner as unknown as QueryRunner);
    } catch (err: unknown) {
      // Some migrations call schema-inspect methods; warn but continue
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Dry-run capture partial failure for ${migration.name}: ${message}`,
      );
    }

    const statements: DryRunStatement[] = await Promise.all(
      capturedSql.map((s) => this.enrichStatement(s.sql, s.parameters)),
    );

    const allIndexOps = statements.flatMap((s) => s.indexOperations);
    const tablesAffected = [
      ...new Set(statements.flatMap((s) => s.tableNames)),
    ];
    const estimatedTotalLockMs = statements.reduce(
      (sum, s) => sum + (s.estimatedLockDurationMs ?? 0),
      0,
    );

    const warnings = this.detectWarnings(statements);

    return {
      migrationName: migration.name ?? 'UnnamedMigration',
      statements,
      totalStatements: statements.length,
      totalIndexOperations: allIndexOps,
      estimatedTotalLockMs,
      tablesAffected,
      warnings,
    };
  }

  // ---------------------------------------------------------------------------
  // Statement enrichment
  // ---------------------------------------------------------------------------

  private async enrichStatement(
    sql: string,
    parameters?: unknown[],
  ): Promise<DryRunStatement> {
    const normalized = sql.trim().toUpperCase();
    const operationType = this.classifyOperation(normalized);
    const tableNames = this.extractTableNames(sql);
    const indexOperations = this.extractIndexOperations(sql);
    const lockLevel = this.determineLockLevel(operationType, normalized);
    const estimatedLockDurationMs =
      LOCK_ESTIMATES_MS[operationType] ?? 0;

    let estimatedRowsAffected: number | undefined;

    if (
      (operationType === 'DML_UPDATE' || operationType === 'DML_DELETE') &&
      tableNames.length > 0
    ) {
      estimatedRowsAffected = await this.estimateRows(tableNames[0]);
    }

    return {
      sql: sql.trim(),
      parameters,
      estimatedRowsAffected,
      operationType,
      tableNames,
      indexOperations,
      estimatedLockDurationMs,
      lockLevel,
    };
  }

  private classifyOperation(upper: string): SqlOperationType {
    if (upper.startsWith('CREATE INDEX') || upper.startsWith('DROP INDEX'))
      return 'INDEX';
    if (upper.startsWith('CREATE TABLE')) return 'DDL_CREATE';
    if (upper.startsWith('ALTER TABLE')) return 'DDL_ALTER';
    if (upper.startsWith('DROP TABLE')) return 'DDL_DROP';
    if (upper.startsWith('INSERT')) return 'DML_INSERT';
    if (upper.startsWith('UPDATE')) return 'DML_UPDATE';
    if (upper.startsWith('DELETE')) return 'DML_DELETE';
    if (
      upper.includes('CONSTRAINT') ||
      upper.includes('ADD FOREIGN KEY') ||
      upper.includes('ADD PRIMARY KEY')
    )
      return 'CONSTRAINT';
    if (
      upper.startsWith('CREATE') ||
      upper.startsWith('DROP') ||
      upper.startsWith('ALTER')
    )
      return 'DDL_ALTER';
    return 'OTHER';
  }

  private extractTableNames(sql: string): string[] {
    const patterns = [
      /(?:FROM|INTO|UPDATE|TABLE|JOIN)\s+"?(\w+)"?/gi,
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?/gi,
      /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?"?(\w+)"?/gi,
      /ALTER\s+TABLE\s+"?(\w+)"?/gi,
    ];

    const names = new Set<string>();
    for (const pattern of patterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(sql)) !== null) {
        if (match[1] && !SQL_KEYWORDS.has(match[1].toUpperCase())) {
          names.add(match[1].toLowerCase());
        }
      }
    }
    return [...names];
  }

  private extractIndexOperations(sql: string): IndexOperation[] {
    const ops: IndexOperation[] = [];
    const upper = sql.trim().toUpperCase();

    const createMatch = sql.match(
      /CREATE\s+(UNIQUE\s+)?(?:CONCURRENTLY\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?\s+ON\s+"?(\w+)"?/i,
    );
    if (createMatch) {
      ops.push({
        type: 'CREATE',
        indexName: createMatch[2],
        tableName: createMatch[3],
        concurrent: upper.includes('CONCURRENTLY'),
      });
    }

    const dropMatch = sql.match(
      /DROP\s+INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+EXISTS\s+)?"?(\w+)"?/i,
    );
    if (dropMatch) {
      ops.push({
        type: 'DROP',
        indexName: dropMatch[1],
        tableName: 'unknown',
        concurrent: upper.includes('CONCURRENTLY'),
      });
    }

    return ops;
  }

  private determineLockLevel(
    type: SqlOperationType,
    upper: string,
  ): LockLevel {
    if (type === 'DDL_DROP') return 'ACCESS_EXCLUSIVE';
    if (type === 'DDL_ALTER') return 'ACCESS_EXCLUSIVE';
    if (type === 'DDL_CREATE') return 'ACCESS_EXCLUSIVE';
    if (type === 'INDEX') {
      return upper.includes('CONCURRENTLY') ? 'SHARE_UPDATE_EXCLUSIVE' : 'SHARE';
    }
    if (type === 'CONSTRAINT') return 'ACCESS_EXCLUSIVE';
    if (type === 'DML_UPDATE' || type === 'DML_DELETE') return 'ROW_EXCLUSIVE';
    return 'NONE';
  }

  private async estimateRows(tableName: string): Promise<number | undefined> {
    try {
      const result: Array<{ estimate: string }> = await this.dataSource.query(
        `SELECT reltuples::bigint AS estimate FROM pg_class WHERE relname = $1`,
        [tableName],
      );
      return result[0] ? parseInt(result[0].estimate, 10) : undefined;
    } catch {
      return undefined;
    }
  }

  private detectWarnings(statements: DryRunStatement[]): string[] {
    const warnings: string[] = [];

    const lockingAlters = statements.filter(
      (s) =>
        s.operationType === 'DDL_ALTER' &&
        s.lockLevel === 'ACCESS_EXCLUSIVE',
    );
    if (lockingAlters.length > 0) {
      warnings.push(
        `${lockingAlters.length} ALTER TABLE statement(s) will acquire ACCESS EXCLUSIVE lock — table will be unavailable during execution.`,
      );
    }

    const nonConcurrentIndexes = statements
      .flatMap((s) => s.indexOperations)
      .filter((op) => !op.concurrent);
    if (nonConcurrentIndexes.length > 0) {
      warnings.push(
        `${nonConcurrentIndexes.length} index operation(s) are not CONCURRENT — consider using CONCURRENTLY to reduce lock time.`,
      );
    }

    const heavyDml = statements.filter(
      (s) =>
        (s.operationType === 'DML_UPDATE' || s.operationType === 'DML_DELETE') &&
        (s.estimatedRowsAffected ?? 0) > 100_000,
    );
    if (heavyDml.length > 0) {
      warnings.push(
        `${heavyDml.length} DML statement(s) may affect >100k rows — consider batching.`,
      );
    }

    return warnings;
  }

  // ---------------------------------------------------------------------------
  // Fake QueryRunner factory
  // ---------------------------------------------------------------------------

  private buildCapturingQueryRunner(
    capturedSql: Array<{ sql: string; parameters?: unknown[] }>,
  ) {
    // We return a proxy object that satisfies the QueryRunner interface
    // for the methods migrations typically call, without touching the DB.
    return {
      query: async (sql: string, parameters?: unknown[]) => {
        capturedSql.push({ sql, parameters });
        return [];
      },
      startTransaction: async () => {},
      commitTransaction: async () => {},
      rollbackTransaction: async () => {},
      release: async () => {},
      connect: async () => {},
      // Schema-builder stubs — TypeORM migrations that use the builder will
      // call these; we capture them as no-ops and their SQL separately.
      createTable: async (_table: unknown) => {
        capturedSql.push({ sql: `-- createTable (schema-builder)` });
      },
      dropTable: async (_name: unknown) => {
        capturedSql.push({ sql: `-- dropTable (schema-builder)` });
      },
      addColumn: async (_table: unknown, _column: unknown) => {
        capturedSql.push({ sql: `-- addColumn (schema-builder)` });
      },
      dropColumn: async (_table: unknown, _column: unknown) => {
        capturedSql.push({ sql: `-- dropColumn (schema-builder)` });
      },
      createIndex: async (_index: unknown) => {
        capturedSql.push({ sql: `-- createIndex (schema-builder)` });
      },
      dropIndex: async (_table: unknown, _index: unknown) => {
        capturedSql.push({ sql: `-- dropIndex (schema-builder)` });
      },
      changeColumn: async (_table: unknown, _oldColumn: unknown, _newColumn: unknown) => {
        capturedSql.push({ sql: `-- changeColumn (schema-builder)` });
      },
      createForeignKey: async (_table: unknown, _fk: unknown) => {
        capturedSql.push({ sql: `-- createForeignKey (schema-builder)` });
      },
      dropForeignKey: async (_table: unknown, _fk: unknown) => {
        capturedSql.push({ sql: `-- dropForeignKey (schema-builder)` });
      },
      hasTable: async () => false,
      hasColumn: async () => false,
      hasIndex: async () => false,
      getTable: async () => null,
      getTables: async () => [],
      manager: {
        transaction: async (fn: (em: unknown) => Promise<unknown>) => fn({}),
      },
      connection: this.dataSource,
      isTransactionActive: false,
    };
  }
}

const SQL_KEYWORDS = new Set([
  'TABLE', 'INDEX', 'VIEW', 'DATABASE', 'SCHEMA', 'SEQUENCE',
  'TRIGGER', 'FUNCTION', 'PROCEDURE', 'COLUMN', 'CONSTRAINT',
  'EXISTS', 'NOT', 'IF', 'OR', 'AND', 'AS', 'ON', 'IN', 'INTO',
  'SET', 'WHERE', 'FROM', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER',
  'UNIQUE', 'PRIMARY', 'FOREIGN', 'KEY', 'REFERENCES', 'CASCADE',
  'DEFAULT', 'NULL', 'NOT', 'CHECK', 'CREATE', 'ALTER', 'DROP',
  'SELECT', 'INSERT', 'UPDATE', 'DELETE',
]);
