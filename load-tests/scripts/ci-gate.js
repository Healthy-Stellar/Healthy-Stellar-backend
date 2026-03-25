#!/usr/bin/env node
/**
 * CI Gate: Load Test Pass/Fail Check
 *
 * Reads the latest k6 JSON results and exits with code 1 if any
 * acceptance criteria are violated. Used as a staging deployment gate.
 *
 * Usage:
 *   node load-tests/scripts/ci-gate.js [results-file]
 *
 * Defaults to: load-tests/results/production-latest.json
 */

const fs   = require('fs');
const path = require('path');

const resultsFile = process.argv[2]
  || path.join(__dirname, '../results/production-latest.json');

// Acceptance criteria
const CRITERIA = [
  { metric: 'patient_read_duration',   stat: 'p(95)', threshold: 500,  label: 'Patient reads p95 < 500ms' },
  { metric: 'provider_write_duration', stat: 'p(95)', threshold: 2000, label: 'Provider writes p95 < 2000ms' },
  { metric: 'health_check_duration',   stat: 'p(95)', threshold: 100,  label: 'Health checks p95 < 100ms' },
  { metric: 'spike_duration',          stat: 'p(95)', threshold: 2000, label: 'Spike test p95 < 2000ms' },
  { metric: 'http_req_failed',         stat: 'rate',  threshold: 0.02, label: 'Global error rate < 2%' },
  { metric: 'spike_errors',            stat: 'rate',  threshold: 0.05, label: 'Spike error rate < 5%' },
];

function loadResults(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`Results file not found: ${filePath}`);
    console.error('Run: npm run load-test first');
    process.exit(2);
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`Failed to parse results: ${e.message}`);
    process.exit(2);
  }
}

function evaluate(data) {
  const metrics = data.metrics || {};
  const failures = [];
  const passes   = [];

  for (const criterion of CRITERIA) {
    const m = metrics[criterion.metric];
    if (!m) {
      console.warn(`  WARN  Metric not found: ${criterion.metric} (scenario may not have run)`);
      continue;
    }

    const value = m.values[criterion.stat];
    if (value === undefined) {
      console.warn(`  WARN  Stat '${criterion.stat}' not found in ${criterion.metric}`);
      continue;
    }

    const pass = value <= criterion.threshold;
    const display = criterion.stat === 'rate'
      ? `${(value * 100).toFixed(2)}% (threshold: ${(criterion.threshold * 100).toFixed(0)}%)`
      : `${value.toFixed(1)}ms (threshold: ${criterion.threshold}ms)`;

    if (pass) {
      passes.push({ label: criterion.label, display });
    } else {
      failures.push({ label: criterion.label, display });
    }
  }

  return { failures, passes };
}

function main() {
  console.log('\n=== CI Load Test Gate ===');
  console.log(`Results: ${resultsFile}\n`);

  const data = loadResults(resultsFile);
  const { failures, passes } = evaluate(data);

  for (const p of passes) {
    console.log(`  PASS  ${p.label}: ${p.display}`);
  }

  if (failures.length > 0) {
    console.log('');
    for (const f of failures) {
      console.error(`  FAIL  ${f.label}: ${f.display}`);
    }
    console.error(`\n[CI GATE] FAILED — ${failures.length} criterion/criteria violated.`);
    console.error('[CI GATE] Staging deployment blocked.\n');
    process.exit(1);
  }

  console.log(`\n[CI GATE] PASSED — all ${passes.length} criteria met.`);
  console.log('[CI GATE] Staging deployment approved.\n');
  process.exit(0);
}

main();
