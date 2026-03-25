import * as fs from 'fs';
import * as path from 'path';

const LOCALES = ['en', 'fr', 'es', 'ar'];
const I18N_DIR = path.join(__dirname, '../src/i18n');

function flattenObject(ob: any): Record<string, string> {
    const toReturn: Record<string, string> = {};
    for (const i in ob) {
        if (!ob.hasOwnProperty(i)) continue;

        if (typeof ob[i] === 'object' && ob[i] !== null) {
            const flatObject = flattenObject(ob[i]);
            for (const x in flatObject) {
                if (!flatObject.hasOwnProperty(x)) continue;
                toReturn[i + '.' + x] = flatObject[x];
            }
        } else {
            toReturn[i] = ob[i];
        }
    }
    return toReturn;
}

function getTranslationKeys(locale: string): string[] {
    const filePath = path.join(I18N_DIR, locale, 'translation.json');
    if (!fs.existsSync(filePath)) {
        console.error(`Translation file not found for locale: ${locale} at ${filePath}`);
        process.exit(1);
    }
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Object.keys(flattenObject(content));
}

function checkTranslations() {
    console.log('Validating translation coverage...');
    let hasMissingKeys = false;

    const baseKeys = getTranslationKeys('en');

    for (const locale of LOCALES) {
        if (locale === 'en') continue;

        const localeKeys = getTranslationKeys(locale);
        const missingKeys = baseKeys.filter((key) => !localeKeys.includes(key));

        if (missingKeys.length > 0) {
            hasMissingKeys = true;
            console.error(`\n❌ Locale '${locale}' is missing keys:`);
            missingKeys.forEach((key) => console.error(`  - ${key}`));
        } else {
            console.log(`✅ Locale '${locale}' coverage is 100%`);
        }
    }

    if (hasMissingKeys) {
        console.error('\n🔴 Translation coverage check failed. Please add missing keys.');
        process.exit(1);
    }

    console.log('\n🟢 All translation files are fully covered!');
}

checkTranslations();
