#!/usr/bin/env node
/**
 * CI Migration Safety Gate
 *
 * Scans TypeORM migration files in src/migrations/ and enforces destructive
 * migration rules plus the expand/contract safety gate.
 *
 * Rules enforced:
 *   - DROP COLUMN without prior nullable step
 *   - DROP TABLE
 *   - ADD/SET NOT NULL without DEFAULT
 *   - removal of likely application unique indexes
 *   - missing down() rollback
 *
 * Usage:
 *   node scripts/check-migration-safety.js
 *   node scripts/check-migration-safety.js --dir src/migrations
 */

const fs   = require('fs');
const path = require('path');

const MIGRATIONS_DIR = process.argv.includes('--dir')
  ? process.argv[process.argv.indexOf('--dir') + 1]
  : path.join(__dirname, '../src/migrations');

const DROP_COLUMN_RE = /DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?["'`](\w+)["'`]/gi;
const ADD_NULLABLE_RE = /ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`](\w+)["'`]\s+\w[\w\s(,)]*\bNULL\b/gi;
const DROP_NOT_NULL_RE = /ALTER\s+COLUMN\s+["'`](\w+)["'`]\s+DROP\s+NOT\s+NULL/gi;
const DROP_TABLE_RE = /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:["'`]?\w+["'`]?\.)?["'`]?([\w_]+)["'`]?/gi;
const ADD_NOT_NULL_RE = /ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`](\w+)["'`]\s+[^;]*?\bNOT\s+NULL\b(?![^;]*\bDEFAULT\b)/gi;
const SET_NOT_NULL_RE = /ALTER\s+COLUMN\s+["'`](\w+)["'`]\s+SET\s+NOT\s+NULL/gi;
const DROP_INDEX_RE = /DROP\s+INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+EXISTS\s+)?["'`](\w+)["'`]/gi;
const DROP_CONSTRAINT_RE = /DROP\s+CONSTRAINT\s+["'`](\w+)["'`]/gi;
const HAS_DOWN_RE = /async\s+down\s*\(|down\s*\(\s*queryRunner/;

function extractMatches(content, regex) {
  const names = new Set();
  let match;
  const re = new RegExp(regex.source, regex.flags);
  while ((match = re.exec(content)) !== null) {
    names.add(match[1].toLowerCase());
  }
  return names;
}

function loadMigrations(dir) {
  if (!fs.existsSync(dir)) {
    console.error(`Migrations directory not found: ${dir}`);
    process.exit(1);
  }

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
    .sort()
    .map((filename) => {
      const fullPath = path.join(dir, filename);
      const content  = fs.readFileSync(fullPath, 'utf8');
      return { filename, fullPath, content };
    });
}

function extractMethodBody(content, methodName) {
  const startRe = new RegExp(`async\\s+${methodName}\\s*\\(`);
  const match = startRe.exec(content);
  if (!match) return '';

  let depth = 0;
  let i = match.index;
  let started = false;

  while (i < content.length) {
    if (content[i] === '{') { depth++; started = true; }
    if (content[i] === '}') { depth--; }
    if (started && depth === 0) {
      return content.slice(match.index, i + 1);
    }
    i++;
  }
  return content.slice(match.index);
}

function isLikelyApplicationUniqueIndex(name) {
  const text = name.toLowerCase();
  return text.startsWith('uq_') || text.startsWith('unq_') || text.includes('unique');
}

function main() {
  const migrations = loadMigrations(MIGRATIONS_DIR);
  const violations = [];
  const summaryRows = [];
  const nullableColumns = new Map();

  for (const { filename, content } of migrations) {
    const upBody   = extractMethodBody(content, 'up');
    const downBody = extractMethodBody(content, 'down');
    const hasDown  = HAS_DOWN_RE.test(content);

    const droppedCols        = extractMatches(upBody, DROP_COLUMN_RE);
    const addedNullable      = extractMatches(upBody, ADD_NULLABLE_RE);
    const droppedNotNull     = extractMatches(upBody, DROP_NOT_NULL_RE);
    const droppedTables      = extractMatches(upBody, DROP_TABLE_RE);
    const addedNotNull       = extractMatches(upBody, ADD_NOT_NULL_RE);
    const setNotNull         = extractMatches(upBody, SET_NOT_NULL_RE);
    const droppedIndexes     = extractMatches(upBody, DROP_INDEX_RE);
    const droppedConstraints = extractMatches(upBody, DROP_CONSTRAINT_RE);

    const downAddedNullable = extractMatches(downBody, ADD_NULLABLE_RE);
    const downDroppedNotNull = extractMatches(downBody, DROP_NOT_NULL_RE);

    for (const col of addedNullable) nullableColumns.set(col, filename);
    for (const col of droppedNotNull) nullableColumns.set(col, filename);
    for (const col of downAddedNullable) nullableColumns.set(col, filename);
    for (const col of downDroppedNotNull) nullableColumns.set(col, filename);

    if (!hasDown) {
      violations.push({
        file: filename,
        rule: 'MISSING_ROLLBACK',
        message: 'Migration has no down() method. Every migration must be reversible.',
      });
    }

    for (const col of droppedCols) {
      violations.push({
        file: filename,
        rule: 'DROP_COLUMN',
        column: col,
        message: `Column "${col}" is dropped in this migration. DROP COLUMN is destructive and must be reviewed.`,
      });

      if (addedNullable.has(col)) {
        violations.push({
          file: filename,
          rule: 'SAME_MIGRATION_ADD_DROP',
          column: col,
          message:
            `Column "${col}" is both added and dropped in the same migration. ` +
            'Split into an expand migration (add) and a contract migration (drop) deployed in separate releases.',
        });
      }

      if (!nullableColumns.has(col)) {
        violations.push({
          file: filename,
          rule: 'DROP_WITHOUT_NULLABLE_STEP',
          column: col,
          message:
            `Column "${col}" is dropped without a prior nullable step. ` +
            'Before dropping a column, a previous migration must either add it as NULL or ALTER COLUMN ... DROP NOT NULL.',
        });
      }
    }

    for (const table of droppedTables) {
      violations.push({
        file: filename,
        rule: 'DROP_TABLE',
        table,
        message: `Table "${table}" is dropped in this migration. Table drops are destructive and require explicit review.`,
      });
    }

    for (const col of addedNotNull) {
      violations.push({
        file: filename,
        rule: 'ADD_NOT_NULL_WITHOUT_DEFAULT',
        column: col,
        message: `Column "${col}" is added as NOT NULL without a DEFAULT. This can fail on existing rows.`,
      });
    }

    for (const col of setNotNull) {
      violations.push({
        file: filename,
        rule: 'ADD_NOT_NULL_WITHOUT_DEFAULT',
        column: col,
        message: `Column "${col}" is altered to SET NOT NULL. Ensure existing rows already satisfy the constraint.`,
      });
    }

    const removedUniqueIndexes = new Set();
    for (const name of droppedIndexes) {
      if (isLikelyApplicationUniqueIndex(name)) removedUniqueIndexes.add(name);
    }
    for (const name of droppedConstraints) {
      if (isLikelyApplicationUniqueIndex(name)) removedUniqueIndexes.add(name);
    }

    for (const indexName of removedUniqueIndexes) {
      violations.push({
        file: filename,
        rule: 'REMOVE_UNIQUE_INDEX',
        index: indexName,
        message: `Unique index or constraint "${indexName}" is removed in this migration. This can break application integrity.`,
      });
    }

    summaryRows.push({
      file: filename,
      dropColumns: droppedCols.size,
      dropTables: droppedTables.size,
      addNotNull: addedNotNull.size + setNotNull.size,
      uniqueRemovals: removedUniqueIndexes.size,
      hasDown,
      risky: droppedCols.size + droppedTables.size + addedNotNull.size + setNotNull.size + removedUniqueIndexes.size,
    });
  }

  console.log(`\n=== Migration Safety Gate ===`);
  console.log(`Scanned ${migrations.length} migration(s) in ${MIGRATIONS_DIR}\n`);

  const totalDropColumns = summaryRows.reduce((sum, row) => sum + row.dropColumns, 0);
  const totalDropTables = summaryRows.reduce((sum, row) => sum + row.dropTables, 0);
  const totalAddNotNull = summaryRows.reduce((sum, row) => sum + row.addNotNull, 0);
  const totalUniqueRemovals = summaryRows.reduce((sum, row) => sum + row.uniqueRemovals, 0);

  console.log('Detected migration changes:');
  console.log(`  DROP COLUMN occurrences: ${totalDropColumns}`);
  console.log(`  DROP TABLE occurrences: ${totalDropTables}`);
  console.log(`  ADD/SET NOT NULL without default: ${totalAddNotNull}`);
  console.log(`  UNIQUE INDEX/CONSTRAINT removals: ${totalUniqueRemovals}\n`);

  summaryRows.forEach((row) => {
    const parts = [];
    if (row.dropColumns) parts.push(`drop columns=${row.dropColumns}`);
    if (row.dropTables) parts.push(`drop tables=${row.dropTables}`);
    if (row.addNotNull) parts.push(`not-null changes=${row.addNotNull}`);
    if (row.uniqueRemovals) parts.push(`unique index removals=${row.uniqueRemovals}`);
    if (!row.hasDown) parts.push('missing rollback');
    if (parts.length === 0) parts.push('no risky operations detected');
    console.log(`  - ${row.file}: ${parts.join(', ')}`);
  });

  if (violations.length === 0) {
    console.log('\n?  All migrations are safe. No policy violations found.\n');
    process.exit(0);
  }

  console.error(`\n?  ${violations.length} violation(s) found:\n`);
  for (const v of violations) {
    console.error(`  File:    ${v.file}`);
    console.error(`  Rule:    ${v.rule}`);
    if (v.column) console.error(`  Column:  ${v.column}`);
    if (v.table) console.error(`  Table:   ${v.table}`);
    if (v.index) console.error(`  Index:   ${v.index}`);
    console.error(`  Problem: ${v.message}`);
    console.error('');
  }

  console.error('Fix all violations before merging. See src/operator-runbook/migration-safety.md\n');
  process.exit(1);
}

main();
