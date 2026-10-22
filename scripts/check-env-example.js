#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sourceRoot = path.join(root, 'src');
const examplePath = path.join(root, '.env.example');
const sourceFiles = [];

function collectSourceFiles(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectSourceFiles(fullPath);
    else if (/\.(?:ts|js|tsx|jsx)$/.test(entry.name) && !/\.(?:spec|test)\./.test(entry.name)) {
      sourceFiles.push(fullPath);
    }
  }
}

collectSourceFiles(sourceRoot);

const sourceKeys = new Set();
const processEnvPatterns = [
  /\bprocess\.env\.([A-Z][A-Z0-9_]*)\b/g,
  /\bprocess\.env\s*\[\s*['"]([A-Z][A-Z0-9_]*)['"]\s*\]/g,
];
const configGetPattern = /\b(?:configService|config|this\.configService|this\.config)\s*\.\s*get(?:OrThrow)?(?:\s*<[^>]*>)?\s*\(\s*['"]([A-Z][A-Z0-9_]*)['"]/g;
const validationSchemaPattern = /^\s{2}([A-Z][A-Z0-9_]*):\s*Joi\./gm;
const platformEnvironmentKeys = new Set(['GITHUB_ACTOR', 'HOSTNAME', 'USER']);

for (const file of sourceFiles) {
  const source = fs.readFileSync(file, 'utf8');
  for (const pattern of [...processEnvPatterns, configGetPattern]) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) sourceKeys.add(match[1]);
  }
  validationSchemaPattern.lastIndex = 0;
  for (const match of source.matchAll(validationSchemaPattern)) sourceKeys.add(match[1]);
}

for (const key of platformEnvironmentKeys) sourceKeys.delete(key);
for (const key of sourceKeys) {
  // Configurations that expand these prefixes dynamically are documented as
  // prefix patterns rather than concrete environment variable names.
  if (key.endsWith('_')) sourceKeys.delete(key);
}

const example = fs.readFileSync(examplePath, 'utf8');
const exampleKeys = new Set();
for (const line of example.split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=/);
  if (match) exampleKeys.add(match[1]);
}

const missing = [...sourceKeys].filter((key) => !exampleKeys.has(key)).sort();
const unused = [...exampleKeys].filter((key) => !sourceKeys.has(key)).sort();

if (missing.length || unused.length) {
  if (missing.length) console.error(`Missing from .env.example (${missing.length}):\n  ${missing.join('\n  ')}`);
  if (unused.length) console.error(`Not read from src/ (${unused.length}):\n  ${unused.join('\n  ')}`);
  console.error('\nNote: this static check catches literal access only; dynamic key construction must be documented explicitly.');
  process.exitCode = 1;
} else {
  console.log(`Environment example matches ${sourceKeys.size} statically referenced keys.`);
}
