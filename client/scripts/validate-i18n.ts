import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCALES_DIR = path.join(__dirname, '../src/locales');
const VI_DIR = path.join(LOCALES_DIR, 'vi');
const STRICT_LANGS = ['en'];
const STAGED_LANGS: string[] = [];

// Flat keys helper for deep JSON comparisons
function getFlatKeys(obj: unknown, prefix = ''): string[] {
  let keys: string[] = [];
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return keys;
  }
  const record = obj as Record<string, unknown>;
  for (const key in record) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      const val = record[key];
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        keys = keys.concat(getFlatKeys(val, `${prefix}${key}.`));
      } else {
        keys.push(`${prefix}${key}`);
      }
    }
  }
  return keys;
}

let hasErrors = false;

function validate() {
  console.log('--- Initializing CVerify i18n Validation Protocol ---');

  if (!fs.existsSync(VI_DIR)) {
    console.error(`Error: Source locale directory "vi" not found at ${VI_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(VI_DIR).filter((file) => file.endsWith('.json'));

  for (const file of files) {
    const viFilePath = path.join(VI_DIR, file);
    let viData: unknown;
    try {
      viData = JSON.parse(fs.readFileSync(viFilePath, 'utf-8'));
    } catch {
      console.error(`Error: Failed to parse Vietnamese translation file ${file}`);
      hasErrors = true;
      continue;
    }

    const viKeys = getFlatKeys(viData);

    // 1. Strict Validation (Vietnamese vs English)
    for (const lang of STRICT_LANGS) {
      const targetDir = path.join(LOCALES_DIR, lang);
      const targetPath = path.join(targetDir, file);

      if (!fs.existsSync(targetPath)) {
        console.error(`Error: Missing strict locale file: ${lang}/${file}`);
        hasErrors = true;
        continue;
      }

      let targetData: unknown;
      try {
        targetData = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
      } catch {
        console.error(`Error: Failed to parse translation file ${lang}/${file}`);
        hasErrors = true;
        continue;
      }

      const targetKeys = getFlatKeys(targetData);
      const missingKeys = viKeys.filter((k) => !targetKeys.includes(k));

      if (missingKeys.length > 0) {
        console.error(`Error: Strict validation failed for ${lang}/${file}. Missing keys:\n  - ${missingKeys.join('\n  - ')}`);
        hasErrors = true;
      } else {
        console.log(`✓ Strict locale validated: ${lang}/${file}`);
      }
    }

    // 2. Graceful Incremental Validation for Staged Languages (ja, ko, zh)
    for (const lang of STAGED_LANGS) {
      const targetDir = path.join(LOCALES_DIR, lang);
      const targetPath = path.join(targetDir, file);

      if (!fs.existsSync(targetPath)) {
        // Log as non-blocking warning
        console.warn(`[Staging Warn] Missing translation file: ${lang}/${file}`);
        continue;
      }

      let targetData: unknown;
      try {
        targetData = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
      } catch {
        console.warn(`[Staging Warn] Failed to parse translation file ${lang}/${file}`);
        continue;
      }

      const targetKeys = getFlatKeys(targetData);
      const missingKeys = viKeys.filter((k) => !targetKeys.includes(k));

      if (missingKeys.length > 0) {
        console.warn(`[Staging Warn] Key drift in ${lang}/${file}. Missing keys:\n  - ${missingKeys.join('\n  - ')}`);
      } else {
        console.log(`✓ Staging locale validated: ${lang}/${file}`);
      }
    }
  }

  console.log('\n--- CVerify i18n Validation Protocol Summary ---');
  if (hasErrors) {
    console.error('Result: Validation FAILED with errors in strict locales.');
    process.exit(1);
  } else {
    console.log('Result: Validation SUCCESS. All strict locales verify correctly.');
  }
}

validate();
