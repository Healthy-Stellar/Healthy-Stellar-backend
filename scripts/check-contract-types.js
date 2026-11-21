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

// ── Helpers ───────────────────────────────────────────────────────────────────

const TS_TYPE_MAP = {
  string: 'string',
  u64: 'bigint',
  u32: 'number',
  i64: 'bigint',
  i32: 'number',
  bool: 'boolean',
  void: 'void',
  address: 'string',
  bytes: 'Buffer',
};

function abiTypeToTsType(abiType) {
  return TS_TYPE_MAP[abiType] ?? 'unknown';
}

function toPascalCase(str) {
  return str.replace(/(^|_)([a-z])/g, (_, __, c) => c.toUpperCase());
}

function toCamelCase(str) {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Extract the body of a top-level `interface <name> { ... }` block from source.
 * Returns the text between the braces, or null if not found.
 */
function extractInterfaceBlock(source, ifaceName) {
  const pattern = new RegExp(`export\\s+interface\\s+${ifaceName}\\s*\\{`);
  const match = pattern.exec(source);
  if (!match) return null;

  const openBrace = match.index + match[0].length - 1;
  let depth = 0;
  for (let i = openBrace; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(openBrace + 1, i);
    }
  }
  return null;
}

/**
 * Parse field declarations from an interface body string.
 * Returns [{ name: string, tsType: string }, ...]
 */
function parseInterfaceFields(body) {
  const fields = [];
  const fieldRe = /^\s*(\w+)\s*:\s*([^;]+)/gm;
  let m;
  while ((m = fieldRe.exec(body)) !== null) {
    const name = m[1];
    const rawType = m[2].trim().replace(/\s*$/, '');
    fields.push({ name, tsType: rawType });
  }
  return fields;
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

  // Each argument name + type — parse the interface block to avoid substring false positives
  const expectedFields = method.args.map((arg) => ({
    name: toCamelCase(arg.name),
    abiType: arg.type,
    expectedTsType: abiTypeToTsType(arg.type),
    originalName: arg.name,
  }));

  const ifaceBlock = extractInterfaceBlock(generated, argsIface);
  if (!ifaceBlock) {
    fail(`  Could not locate interface ${argsIface} body in generated file`);
  } else {
    const declaredFields = parseInterfaceFields(ifaceBlock);
    for (const field of expectedFields) {
      const declared = declaredFields.find((d) => d.name === field.name);
      if (!declared) {
        fail(`  arg '${field.name}' (from '${field.originalName}') missing from ${argsIface}`);
      } else if (declared.tsType !== field.expectedTsType) {
        fail(
          `  arg '${field.name}' type mismatch in ${argsIface}: ` +
            `expected '${field.expectedTsType}' (ABI ${field.abiType}), got '${declared.tsType}'`,
        );
      } else {
        pass(`  arg '${field.name}' present with correct type '${field.expectedTsType}'`);
      }
    }
    // Detect extra fields not in the ABI
    for (const declared of declaredFields) {
      if (!expectedFields.find((f) => f.name === declared.name)) {
        fail(
          `  extra field '${declared.name}' in ${argsIface} not present in ABI — file may be stale`,
        );
      }
    }
  }
}

// ── Check CONTRACT_ABI is embedded ───────────────────────────────────────────

if (generated.includes('CONTRACT_ABI')) {
  pass('CONTRACT_ABI constant present');
} else {
  fail('CONTRACT_ABI constant missing — regenerate with: npm run generate:contract-types');
}

// ── Result ────────────────────────────────────────────────────────────────────

if (exitCode === 0) {
  console.log('\n[check-contract-types] All checks passed — generated types match ABI.');
} else {
  console.error('\n[check-contract-types] Drift detected. Run: npm run generate:contract-types');
}

process.exit(exitCode);
