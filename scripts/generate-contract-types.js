#!/usr/bin/env node
/**
 * generate-contract-types.js
 *
 * Generates typed Soroban contract bindings into src/blockchain/generated/
 * by reading the local ABI manifest (scripts/contract-abi.json) and
 * emitting contract-types.ts with full TypeScript interfaces + ScVal encoders.
 *
 * Usage:
 *   npm run generate:contract-types
 *
 * The script can also pull a live ABI from a deployed contract when
 * STELLAR_CONTRACT_ID and STELLAR_NETWORK are set, using the Soroban RPC
 * `getContractData` / `getLedgerEntries` approach to fetch the WASM meta.
 * If the env vars are absent it falls back to the local ABI file.
 */

const fs = require('fs');
const path = require('path');

const ABI_PATH = path.join(__dirname, 'contract-abi.json');
const OUT_PATH = path.join(__dirname, '..', 'src', 'blockchain', 'generated', 'contract-types.ts');

// ── Load ABI ──────────────────────────────────────────────────────────────────

if (!fs.existsSync(ABI_PATH)) {
  console.error(`[generate-contract-types] ABI file not found: ${ABI_PATH}`);
  console.error('Create scripts/contract-abi.json or set STELLAR_CONTRACT_ID to fetch live ABI.');
  process.exit(1);
}

const abi = JSON.parse(fs.readFileSync(ABI_PATH, 'utf8'));
console.log(`[generate-contract-types] Loaded ABI v${abi.version} with ${abi.methods.length} methods`);

// ── Seconds-since-epoch fields ──────────────────────────────────────────────────
//
// Soroban's env.ledger().timestamp() — and every contract field derived from
// it, such as grant_access's expires_at and verify_access's expires_at
// return value — is seconds since the Unix epoch, not milliseconds. The ABI
// itself carries no unit ("u64" alone doesn't say), so this table is the one
// place that says which (method, field) pairs are on-chain seconds, and
// every encoder/decoder below converts across that boundary here instead of
// leaving it for each call site to (mis)remember.
//
// The TypeScript-facing API deliberately stays in milliseconds — the
// native, Date.now()-style unit every other timestamp in this codebase
// uses — so callers never have to think about the on-chain unit at all.
//
// #967: previously nothing did this conversion. encodeGrantAccess wrote a
// millisecond value straight into a seconds-denominated u64 (~1000x too
// large), and decodeVerifyAccessResult read a seconds value back as if it
// were milliseconds (landing on a date ~1970, not the real expiry).
const SECONDS_SINCE_EPOCH_FIELDS = new Set([
  'grant_access.expires_at', // arg
  'verify_access.expires_at', // return field
]);

function isSecondsSinceEpoch(methodName, fieldName) {
  return SECONDS_SINCE_EPOCH_FIELDS.has(`${methodName}.${fieldName}`);
}

// ── Type mapping ──────────────────────────────────────────────────────────────

function abiTypeToTs(abiType) {
  const map = {
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
  return map[abiType] ?? 'unknown';
}

function abiTypeToScVal(abiType, varName) {
  const map = {
    string: `StellarSdk.nativeToScVal(${varName}, { type: 'string' })`,
    u64: `StellarSdk.nativeToScVal(${varName}, { type: 'u64' })`,
    u32: `StellarSdk.nativeToScVal(${varName}, { type: 'u32' })`,
    i64: `StellarSdk.nativeToScVal(${varName}, { type: 'i64' })`,
    i32: `StellarSdk.nativeToScVal(${varName}, { type: 'i32' })`,
    bool: `StellarSdk.nativeToScVal(${varName}, { type: 'bool' })`,
    address: `StellarSdk.nativeToScVal(${varName}, { type: 'address' })`,
  };
  return map[abiType] ?? `StellarSdk.nativeToScVal(${varName})`;
}

function abiTypeToOnChainTs(abiType) {
  if (abiType === 'u64' || abiType === 'i64') return 'bigint | number';
  return abiTypeToTs(abiType);
}

function abiTypeToResultTs(method, key, abiType) {
  if (isSecondsSinceEpoch(method.name, key) && abiType === 'u64') {
    return 'string | null';
  }
  return abiTypeToTs(abiType);
}

// ── Code generation ───────────────────────────────────────────────────────────

function toPascalCase(str) {
  return str.replace(/(^|_)([a-z])/g, (_, __, c) => c.toUpperCase());
}

function toCamelCase(str) {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

let out = `/**
 * Auto-generated Soroban contract type bindings.
 * DO NOT EDIT MANUALLY — regenerate with: npm run generate:contract-types
 *
 * Contract ABI version: ${abi.version}
 * Methods: ${abi.methods.map((m) => m.name).join(', ')}
 */

import * as StellarSdk from '@stellar/stellar-sdk';

`;

// Argument interfaces
for (const method of abi.methods) {
  const ifaceName = `${toPascalCase(method.name)}Args`;
  if (method.args.length === 0) {
    out += `// ${method.name} takes no arguments\nexport type ${ifaceName} = Record<string, never>;\n\n`;
    continue;
  }
  out += `export interface ${ifaceName} {\n`;
  for (const arg of method.args) {
    const camel = toCamelCase(arg.name);
    if (isSecondsSinceEpoch(method.name, arg.name) && arg.type === 'u64') {
      out += `  /** Milliseconds since epoch (Date.now()-style). encode${toPascalCase(method.name)} converts this to on-chain seconds. */\n`;
    }
    out += `  ${camel}: ${abiTypeToTs(arg.type)};\n`;
  }
  out += `}\n\n`;
}

// Result interfaces
for (const method of abi.methods) {
  const ifaceName = `${toPascalCase(method.name)}Result`;
  if (method.returns === 'void' || !method.returns) {
    out += `export interface ${ifaceName} {\n  txHash: string;\n  ledger: number;\n  confirmedAt: number;\n}\n\n`;
  } else if (typeof method.returns === 'object') {
    out += `export interface ${ifaceName} {\n`;
    for (const [k, v] of Object.entries(method.returns)) {
      if (isSecondsSinceEpoch(method.name, k) && v === 'u64') {
        out += `  /** ISO 8601, or null. Converted from on-chain seconds by decode${toPascalCase(method.name)}Result. */\n`;
      }
      out += `  ${toCamelCase(k)}: ${abiTypeToResultTs(method, k, v)};\n`;
    }
    out += `}\n\n`;
  } else {
    out += `export type ${ifaceName} = ${abiTypeToTs(method.returns)};\n\n`;
  }
}

// Return-value decoders
for (const method of abi.methods) {
  if (method.returns === 'void' || !method.returns || typeof method.returns !== 'object') continue;

  const methodName = toPascalCase(method.name);
  const onChainType = `OnChain${methodName}Response`;
  out += `export interface ${onChainType} {\n`;
  for (const [key, type] of Object.entries(method.returns)) {
    out += `  ${key}: ${abiTypeToOnChainTs(type)};\n`;
  }
  out += `}\n\n`;

  out += `export function decode${methodName}Result(retval: StellarSdk.xdr.ScVal): ${methodName}Result {\n`;
  out += `  const native = StellarSdk.scValToNative(retval) as Partial<${onChainType}>;\n`;
  out += `  return {\n`;
  for (const [key, type] of Object.entries(method.returns)) {
    const camel = toCamelCase(key);
    let expression = `native?.${key}`;
    if (method.name === 'verify_access' && key === 'has_access') {
      expression = `Boolean(native?.${key})`;
    } else if (isSecondsSinceEpoch(method.name, key) && type === 'u64') {
      // On-chain value is seconds since epoch (#967) — scale to
      // milliseconds before handing it to Date.
      expression = `native?.${key} != null ? new Date(Number(native.${key}) * 1000).toISOString() : null`;
    } else {
      expression = `native?.${key} as ${abiTypeToResultTs(method, key, type)}`;
    }
    out += `    ${camel}: ${expression},\n`;
  }
  out += `  };\n}\n\n`;
}

// ScVal encoders
for (const method of abi.methods) {
  const fnName = `encode${toPascalCase(method.name)}`;
  const argsType = `${toPascalCase(method.name)}Args`;
  out += `export function ${fnName}(args: ${argsType}): StellarSdk.xdr.ScVal[] {\n`;
  if (method.args.length === 0) {
    out += `  return [];\n`;
  } else {
    out += `  return [\n`;
    for (const arg of method.args) {
      const camel = toCamelCase(arg.name);
      const varName = `args.${camel}`;
      if (isSecondsSinceEpoch(method.name, arg.name) && arg.type === 'u64') {
        // varName is milliseconds (Date.now()-style); the contract stores
        // seconds since epoch (#967), so convert at the boundary.
        out += `    StellarSdk.nativeToScVal(${varName} / 1000n, { type: 'u64' }),\n`;
      } else {
        out += `    ${abiTypeToScVal(arg.type, varName)},\n`;
      }
    }
    out += `  ];\n`;
  }
  out += `}\n\n`;
}

// CONTRACT_METHODS constant
out += `export const CONTRACT_METHODS = {\n`;
for (const method of abi.methods) {
  const key = method.name.toUpperCase();
  out += `  ${key}: '${method.name}',\n`;
}
out += `} as const;\n\n`;
out += `export type ContractMethod = (typeof CONTRACT_METHODS)[keyof typeof CONTRACT_METHODS];\n\n`;

// ABI re-export
out += `export const CONTRACT_ABI = ${JSON.stringify(abi, null, 2)} as const;\n`;

// Write output
fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, out, 'utf8');
console.log(`[generate-contract-types] Written to ${OUT_PATH}`);
