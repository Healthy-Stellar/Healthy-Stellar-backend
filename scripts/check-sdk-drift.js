#!/usr/bin/env node

/**
 * SDK Drift Detection Script
 * 
 * This script:
 * 1. Generates the SDK from the OpenAPI spec
 * 2. Compares it with the committed version
 * 3. Exits with error code if there's drift
 * 
 * Usage: npm run check:sdk-drift
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

const SDK_DIR = path.join(__dirname, '..', 'packages', 'sdk', 'src');
const GENERATED_SDK_DIR = path.join(__dirname, '..', 'packages', 'sdk', 'src-generated');

console.log('🔍 Checking for SDK drift...\n');

// Step 1: Backup current SDK
console.log('📦 Backing up current SDK...');
if (fs.existsSync(SDK_DIR)) {
  execSync(`cp -r "${SDK_DIR}" "${path.dirname(SDK_DIR)}/src-backup"`);
  console.log('✅ Backup created\n');
}

// Step 2: Generate fresh SDK
console.log('🔨 Generating fresh SDK from OpenAPI spec...');
try {
  execSync('npm run generate:sdk', { stdio: 'inherit' });
  console.log('✅ SDK generated\n');
} catch (error) {
  console.error('❌ SDK generation failed');
  process.exit(1);
}

// Step 3: Compare files
console.log('🔄 Comparing generated SDK with committed version...\n');

function hashFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return crypto.createHash('md5').update(content).digest('hex');
}

function compareDirectories(original, generated, relativePath = '') {
  const differences = [];

  const originalFiles = new Set();
  const generatedFiles = new Set();

  if (fs.existsSync(original)) {
    fs.readdirSync(original).forEach((file) => {
      originalFiles.add(file);
    });
  }

  if (fs.existsSync(generated)) {
    fs.readdirSync(generated).forEach((file) => {
      generatedFiles.add(file);
    });
  }

  // Check for new and modified files
  generatedFiles.forEach((file) => {
    const genPath = path.join(generated, file);
    const origPath = path.join(original, file);
    const relPath = path.join(relativePath, file);

    if (fs.statSync(genPath).isDirectory()) {
      if (fs.existsSync(origPath) && fs.statSync(origPath).isDirectory()) {
        // Recursive check
        const nested = compareDirectories(origPath, genPath, relPath);
        differences.push(...nested);
      } else {
        differences.push({
          type: 'new_directory',
          path: relPath,
        });
      }
    } else {
      if (!fs.existsSync(origPath)) {
        differences.push({
          type: 'new',
          path: relPath,
        });
      } else {
        const origHash = hashFile(origPath);
        const genHash = hashFile(genPath);
        if (origHash !== genHash) {
          differences.push({
            type: 'modified',
            path: relPath,
          });
        }
      }
    }
  });

  // Check for deleted files
  originalFiles.forEach((file) => {
    if (!generatedFiles.has(file)) {
      differences.push({
        type: 'deleted',
        path: path.join(relativePath, file),
      });
    }
  });

  return differences;
}

// Compare the backed up version with newly generated
const backupDir = path.join(path.dirname(SDK_DIR), 'src-backup');
const diffs = compareDirectories(backupDir, SDK_DIR);

if (diffs.length === 0) {
  console.log('✅ No drift detected! SDK is up-to-date.');
  
  // Cleanup
  execSync(`rm -rf "${backupDir}"`);
  process.exit(0);
} else {
  console.log('❌ SDK drift detected!\n');
  console.log('Changes needed to bring committed SDK in sync:\n');

  const changes = {
    new: [],
    modified: [],
    deleted: [],
    new_directory: [],
  };

  diffs.forEach((diff) => {
    if (!changes[diff.type]) changes[diff.type] = [];
    changes[diff.type].push(diff.path);
  });

  if (changes.new.length > 0) {
    console.log('📝 New files:');
    changes.new.forEach((file) => console.log(`   + ${file}`));
    console.log();
  }

  if (changes.modified.length > 0) {
    console.log('🔄 Modified files:');
    changes.modified.forEach((file) => console.log(`   ~ ${file}`));
    console.log();
  }

  if (changes.deleted.length > 0) {
    console.log('🗑️  Deleted files:');
    changes.deleted.forEach((file) => console.log(`   - ${file}`));
    console.log();
  }

  if (changes.new_directory.length > 0) {
    console.log('📁 New directories:');
    changes.new_directory.forEach((dir) => console.log(`   + ${dir}/`));
    console.log();
  }

  console.log('⚠️  To fix this drift:');
  console.log('   1. Run: npm run generate:sdk');
  console.log('   2. Review the changes');
  console.log('   3. Commit the updated SDK files');
  console.log('   4. Push your changes\n');

  // Cleanup
  execSync(`rm -rf "${backupDir}"`);
  process.exit(1);
}
