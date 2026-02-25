#!/usr/bin/env node

/**
 * SDK Version Update Script
 * 
 * Updates the version in packages/sdk/package.json
 * Usage: npm run version:sdk -- "1.2.3"
 */

const fs = require('fs');
const path = require('path');

const version = process.argv[2];

if (!version) {
  console.error('❌ Version argument required');
  console.error('Usage: npx version-sdk.js <version>');
  console.error('Example: npx version-sdk.js 1.2.3');
  process.exit(1);
}

// Validate version format (semver)
const semverRegex = /^\d+\.\d+\.\d+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/;
if (!semverRegex.test(version)) {
  console.error(`❌ Invalid version format: ${version}`);
  console.error('Please use semantic versioning (e.g., 1.2.3)');
  process.exit(1);
}

const sdkPackageJsonPath = path.join(__dirname, '..', 'packages', 'sdk', 'package.json');

try {
  // Read current package.json
  const packageJson = JSON.parse(fs.readFileSync(sdkPackageJsonPath, 'utf-8'));
  const oldVersion = packageJson.version;

  // Update version
  packageJson.version = version;

  // Write back
  fs.writeFileSync(
    sdkPackageJsonPath,
    JSON.stringify(packageJson, null, 2) + '\n',
  );

  console.log(`✅ SDK version updated`);
  console.log(`   Old: ${oldVersion}`);
  console.log(`   New: ${version}`);
  console.log(`   File: ${sdkPackageJsonPath}`);
} catch (error) {
  console.error(`❌ Failed to update SDK version: ${error.message}`);
  process.exit(1);
}
