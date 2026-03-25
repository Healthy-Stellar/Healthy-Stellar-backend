#!/usr/bin/env node
/**
 * check-contract-types.js
 *
 * CI check: verifies that the generated contract-types.ts is in sync with
 * the canonical ABI in scripts/contract-abi.json.
 *
 * Exits 0 if in sync, 1 if drift is detected.
 *
 * Usage:
 *   node scripts/check-contract-types.js
 */

const fs = require('fs');
const path = require('path');

const ABI_PATH = path.join(__dirname, 'contract-abi.json');
const GENERATED_PATH = path.join(__dirname, '..', 'src', 'blockchain', 'generated', 'contract-types.ts');

let exitCode = 0;

function fail(msg) {
  console.error(`[check-contract-types] FAIL: ${msg}`);
  exitCode = 1;
}

function pass(msg) {
  console.log(`[check-contract-types] OK: ${msg}`);
}

// ── Load files ────────────────────────────────────────────────────────────────

if (!fs.existsSync(ABI_PATH)) {
  fail(`ABI file not found: ${ABI_PATH}`);
  process.exit(1);
}

if (!fs.existsSync(GENERATED_PATH)) {
  fail(`Generated types not found: ${GENERATED_PATH}. Run: npm run generate:contract-types`);
  process.exit(1);
}

const abi = JSON.parse(fs.readFileSync(ABI_PATH, 'utf8'));
const generated = fs.readFileSync(GENERATED_PATH, 'utf8');

// ── Check ABI version is embedded ────────────────────────────────────────────

if (generated.includes(`ABI version: ${abi.version}`)) {
  pass(`ABI version ${abi.version} present in generated file`);
} else {
  fail(`ABI version ${abi.version} not found in generated file — regenerate with: npm run generate:contract-types`);
}

// ── Check each method is represented ─────────────────────────────────────────

for (const method of abi.methods) {
  const methodConst = method.name.toUpperCase();

  // CONTRACT_METHODS constant
  if (generated.includes(`'${method.name}'`)) {
    pass(`CONTRACT_METHODS.${methodConst} present`);
  } else {
    fail(`CONTRACT_METHODS.${methodConst} ('${method.name}') missing from generated file`);
  }

  // Encoder function
  const encoderName = `encode${toPascalCase(method.name)}`;
  if (generated.includes(`function ${encoderName}`)) {
    pass(`Encoder ${encoderName} present`);
  } else {
    fail(`Encoder ${encoderName} missing from generated file`);
  }

  // Args interface
  const argsIface = `${toPascalCase(method.name)}Args`;
  if (generated.includes(argsIface)) {
    pass(`Interface ${argsIface} present`);
  } else {
    fail(`Interface ${argsIface} missing from generated file`);
  }

  // Each argument name
  for (const arg of method.args) {
    const camel = toCamelCase(arg.name);
    if (generated.includes(camel)) {
      pass(`  arg '${camel}' present`);
    } else {
      fail(`  arg '${camel}' (from '${arg.name}') missing from generated file`);
    }
  }
}

// ── Check CONTRACT_ABI is embedded ───────────────────────────────────────────

if (generated.includes('CONTRACT_ABI')) {
  pass('CONTRACT_ABI constant present');
} else {
  fail('CONTRACT_ABI constant missing — regenerate with: npm run generate:contract-types');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toPascalCase(str) {
  return str.replace(/(^|_)([a-z])/g, (_, __, c) => c.toUpperCase());
}

function toCamelCase(str) {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

// ── Result ────────────────────────────────────────────────────────────────────

if (exitCode === 0) {
  console.log('\n[check-contract-types] All checks passed — generated types match ABI.');
} else {
  console.error('\n[check-contract-types] Drift detected. Run: npm run generate:contract-types');
}

process.exit(exitCode);
