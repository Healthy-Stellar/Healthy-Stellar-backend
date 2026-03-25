#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logError(message) {
  log('red', `✗ ${message}`);
}

function logSuccess(message) {
  log('green', `✓ ${message}`);
}

function logWarning(message) {
  log('yellow', `⚠ ${message}`);
}

function logInfo(message) {
  log('blue', `ℹ ${message}`);
}

function logSection(message) {
  log('cyan', `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  log('cyan', `  ${message}`);
  log('cyan', `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

/**
 * Get all translation keys from a translation object recursively
 */
function getAllKeys(obj, prefix = '') {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      keys.push(...getAllKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

/**
 * Load translation file
 */
function loadTranslationFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    logError(`Failed to load translation file: ${filePath}`);
    process.exit(1);
  }
}

/**
 * Main validation function
 */
function validateTranslations() {
  logSection('Translation Coverage Check');

  const localesDir = path.join(__dirname, '../src/i18n/locales');
  const languages = ['en', 'fr', 'es', 'ar'];

  logInfo(`Checking translations in: ${localesDir}`);
  logInfo(`Languages to validate: ${languages.join(', ')}\n`);

  // Load all translation files
  const translations = {};
  const loadedLanguages = [];

  for (const lang of languages) {
    const filePath = path.join(localesDir, `${lang}.json`);

    if (!fs.existsSync(filePath)) {
      logError(`Translation file not found: ${lang}.json`);
      process.exit(1);
    }

    try {
      translations[lang] = loadTranslationFile(filePath);
      loadedLanguages.push(lang);
      logSuccess(`Loaded ${lang}.json`);
    } catch (error) {
      logError(`Failed to load ${lang}.json: ${error.message}`);
      process.exit(1);
    }
  }

  logInfo(`Successfully loaded all ${loadedLanguages.length} language files\n`);

  // Get keys from English as the base
  const englishKeys = new Set(getAllKeys(translations.en));
  logInfo(`English has ${englishKeys.size} translation keys`);

  let hasErrors = false;
  const missingKeysByLanguage = {};
  const extraKeysByLanguage = {};

  // Check each language against English
  for (const lang of languages) {
    if (lang === 'en') continue;

    const langKeys = new Set(getAllKeys(translations[lang]));
    const missing = [];
    const extra = [];

    // Find missing keys
    for (const key of englishKeys) {
      if (!langKeys.has(key)) {
        missing.push(key);
      }
    }

    // Find extra keys
    for (const key of langKeys) {
      if (!englishKeys.has(key)) {
        extra.push(key);
      }
    }

    logInfo(`\n${lang.toUpperCase()} Coverage:`);
    logInfo(`  Keys: ${langKeys.size}`);
    logInfo(`  Coverage: ${((langKeys.size - extra.length) / englishKeys.size * 100).toFixed(2)}%`);

    if (missing.length > 0) {
      logWarning(`  Missing keys (${missing.length}):`);
      missing.slice(0, 10).forEach((key) => {
        logWarning(`    - ${key}`);
      });
      if (missing.length > 10) {
        logWarning(`    ... and ${missing.length - 10} more`);
      }
      hasErrors = true;
      missingKeysByLanguage[lang] = missing;
    }

    if (extra.length > 0) {
      logWarning(`  Extra keys (${extra.length}):`);
      extra.slice(0, 10).forEach((key) => {
        logWarning(`    - ${key}`);
      });
      if (extra.length > 10) {
        logWarning(`    ... and ${extra.length - 10} more`);
      }
      extraKeysByLanguage[lang] = extra;
    }

    if (missing.length === 0 && extra.length === 0) {
      logSuccess(`  ✓ All keys present and no extra keys`);
    }
  }

  // Check for empty values
  logSection('Checking for Empty Values');

  let emptyCount = 0;
  for (const lang of languages) {
    const keys = getAllKeys(translations[lang]);
    for (const key of keys) {
      const parts = key.split('.');
      let value = translations[lang];
      for (const part of parts) {
        value = value[part];
      }

      if (value === '' || value === null || value === undefined) {
        logWarning(`${lang}.${key} is empty`);
        emptyCount++;
      }
    }
  }

  if (emptyCount === 0) {
    logSuccess('No empty translation values found');
  }

  // Email template validation
  logSection('Email Template Validation');

  const emailTemplatesDir = path.join(__dirname, '../src/email-templates/i18n');
  const emailTemplates = ['access-granted', 'verify-email', 'reset-password'];

  for (const template of emailTemplates) {
    logInfo(`Checking template: ${template}`);
    const allPresent = languages.every((lang) => {
      const filePath = path.join(emailTemplatesDir, `${template}.${lang}.hbs`);
      return fs.existsSync(filePath);
    });

    if (allPresent) {
      logSuccess(`  ${template} - All language variants present`);
    } else {
      const missing = languages.filter((lang) => {
        const filePath = path.join(emailTemplatesDir, `${template}.${lang}.hbs`);
        return !fs.existsSync(filePath);
      });
      logError(`  ${template} - Missing variants: ${missing.join(', ')}`);
      hasErrors = true;
    }
  }

  // Final summary
  logSection('Summary');

  if (hasErrors) {
    logError(`Translation validation FAILED`);
    if (Object.keys(missingKeysByLanguage).length > 0) {
      logInfo('\nMissing keys by language:');
      for (const [lang, keys] of Object.entries(missingKeysByLanguage)) {
        logWarning(`  ${lang}: ${keys.length} missing keys`);
      }
    }
    if (Object.keys(extraKeysByLanguage).length > 0) {
      logInfo('\nExtra keys by language:');
      for (const [lang, keys] of Object.entries(extraKeysByLanguage)) {
        logWarning(`  ${lang}: ${keys.length} extra keys`);
      }
    }
    process.exit(1);
  } else {
    logSuccess('Translation validation PASSED');
    logSuccess(`All ${languages.length} languages have complete coverage`);
    logSuccess(`All ${emailTemplates.length} email templates have variants for all languages`);
    process.exit(0);
  }
}

// Run validation
validateTranslations();
