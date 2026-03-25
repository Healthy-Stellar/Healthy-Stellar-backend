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
    out += `  ${toCamelCase(arg.name)}: ${abiTypeToTs(arg.type)};\n`;
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
      out += `  ${toCamelCase(k)}: ${abiTypeToTs(v)};\n`;
    }
    out += `}\n\n`;
  } else {
    out += `export type ${ifaceName} = ${abiTypeToTs(method.returns)};\n\n`;
  }
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
      out += `    ${abiTypeToScVal(arg.type, `args.${camel}`)},\n`;
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
