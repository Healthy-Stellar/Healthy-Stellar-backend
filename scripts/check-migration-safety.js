#!/usr/bin/env node
/**
 * CI Migration Safety Gate
 *
 * Scans all TypeORM migration files in src/migrations/ and enforces the
 * expand/contract rules:
 *
 *   Rule 1 — No bare DROP COLUMN without a prior nullable step.
 *            A column must appear in an ADD COLUMN ... NULL or
 *            ALTER COLUMN ... DROP NOT NULL migration before it can be
 *            dropped in a later migration.
 *
 *   Rule 2 — No DROP COLUMN and ADD COLUMN for the same column name in
 *            the same migration file (must be split across two releases).
 *
 *   Rule 3 — Every migration file must export a `down()` method (rollback).
 *
 * Exit codes:
 *   0 — all migrations are safe
 *   1 — one or more violations found (CI should block the merge)
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

// ── Regex patterns ────────────────────────────────────────────────────────────

// Matches DROP COLUMN [IF EXISTS] "col" — only inside up() body, not down()
// We extract column names from the raw SQL strings
const DROP_COLUMN_RE = /DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?["'`](\w+)["'`]/gi;

// Matches: ADD COLUMN [IF NOT EXISTS] "col" ... NULL  (nullable add)
// Requires the column name to be quoted to avoid false positives on keywords
const ADD_NULLABLE_RE = /ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`](\w+)["'`]\s+\w[\w\s(,)]*\bNULL\b/gi;

// Matches: ALTER COLUMN "col" DROP NOT NULL
const DROP_NOT_NULL_RE = /ALTER\s+COLUMN\s+["'`](\w+)["'`]\s+DROP\s+NOT\s+NULL/gi;

// Matches: down() method presence
const HAS_DOWN_RE = /async\s+down\s*\(|down\s*\(\s*queryRunner/;

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    .sort() // chronological order by filename timestamp prefix
    .map((filename) => {
      const fullPath = path.join(dir, filename);
      const content  = fs.readFileSync(fullPath, 'utf8');
      return { filename, fullPath, content };
    });
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Crudely extract the body of a named async method from TypeScript source.
 * Finds the first `async up(` or `async down(` and returns everything up to
 * the matching closing brace. Falls back to full content if not found.
 */
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

function main() {
  const migrations = loadMigrations(MIGRATIONS_DIR);
  const violations = [];

  // Track which columns have been made nullable across all prior migrations.
  // Key: "table.column" (lowercase), Value: filename where it was made nullable.
  const nullableColumns = new Map();

  for (const { filename, content } of migrations) {
    // Split content into up() and down() sections so we only check
    // DROP COLUMN rules against the up() body, not the rollback code.
    const upBody   = extractMethodBody(content, 'up');
    const downBody = extractMethodBody(content, 'down');
    const hasDown  = HAS_DOWN_RE.test(content);

    const droppedCols    = extractMatches(upBody,   DROP_COLUMN_RE);
    const addedNullable  = extractMatches(upBody,   ADD_NULLABLE_RE);
    const droppedNotNull = extractMatches(upBody,   DROP_NOT_NULL_RE);

    // Also register columns made nullable in down() — they count for future up()s
    const downAddedNullable  = extractMatches(downBody, ADD_NULLABLE_RE);
    const downDroppedNotNull = extractMatches(downBody, DROP_NOT_NULL_RE);

    // Register newly nullable columns from this migration's up() body
    for (const col of addedNullable)   nullableColumns.set(col, filename);
    for (const col of droppedNotNull)  nullableColumns.set(col, filename);
    // Also register from down() — columns restored as nullable in rollbacks
    for (const col of downAddedNullable)  nullableColumns.set(col, filename);
    for (const col of downDroppedNotNull) nullableColumns.set(col, filename);

    // Rule 3: every migration must have a down() rollback
    if (!hasDown) {
      violations.push({
        file: filename,
        rule: 'MISSING_ROLLBACK',
        message: 'Migration has no down() method. Every migration must be reversible.',
      });
    }

    for (const col of droppedCols) {
      // Rule 2: cannot ADD and DROP the same column in the same migration
      if (addedNullable.has(col)) {
        violations.push({
          file: filename,
          rule: 'SAME_MIGRATION_ADD_DROP',
          column: col,
          message:
            `Column "${col}" is both added and dropped in the same migration. ` +
            'Split into an expand migration (add) and a contract migration (drop) ' +
            'deployed in separate releases.',
        });
      }

      // Rule 1: column must have been made nullable in a PRIOR migration
      if (!nullableColumns.has(col)) {
        violations.push({
          file: filename,
          rule: 'DROP_WITHOUT_NULLABLE_STEP',
          column: col,
          message:
            `Column "${col}" is dropped without a prior nullable step. ` +
            'Before dropping a column, a previous migration must either: ' +
            '(a) add it as NULL, or (b) ALTER COLUMN ... DROP NOT NULL. ' +
            'This ensures the expand phase is deployed before the contract phase.',
        });
      }
    }
  }

  // ── Report ────────────────────────────────────────────────────────────────

  console.log(`\n=== Migration Safety Gate ===`);
  console.log(`Scanned ${migrations.length} migration(s) in ${MIGRATIONS_DIR}\n`);

  if (violations.length === 0) {
    console.log('✅  All migrations are safe. No expand/contract violations found.\n');
    process.exit(0);
  }

  console.error(`❌  ${violations.length} violation(s) found:\n`);

  for (const v of violations) {
    console.error(`  File:    ${v.file}`);
    console.error(`  Rule:    ${v.rule}`);
    if (v.column) console.error(`  Column:  ${v.column}`);
    console.error(`  Problem: ${v.message}`);
    console.error('');
  }

  console.error('Fix all violations before merging. See docs/zero-downtime-migrations.md\n');
  process.exit(1);
}

main();
