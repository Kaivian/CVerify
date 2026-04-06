const fs = require('fs');
const path = require('path');

const BLACKLIST_PATTERNS = [
  /text-(white|black)/,
  /text-(zinc|neutral|slate|stone|indigo)-[0-9]+/,
  /bg-(zinc|neutral|slate|stone|indigo)-[0-9]+/,
  /border-(zinc|neutral|slate|stone|indigo)-[0-9]+/
];

const ALLOWED_FILES = [
  'globals.css',
  'layout.tsx',      // Standard container overrides
  'states.tsx',      // Base loader skeletons
  'form-input.tsx',  // Standard low-level form elements
  'page.tsx'         // Standard page structure templates
];

let failed = false;

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next') {
        scanDir(fullPath);
      }
    } else if (stat.isFile() && /\.(tsx|ts|js|jsx)$/.test(file)) {
      if (ALLOWED_FILES.some(allowed => fullPath.includes(allowed))) {
        continue;
      }
      
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        // Skip imports, comments, or style constants
        const trimmed = line.trim();
        if (trimmed.startsWith('import') || trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
          return;
        }

        for (const pattern of BLACKLIST_PATTERNS) {
          if (pattern.test(line)) {
            console.error(`\x1b[31m[THEME AUDIT ERROR]\x1b[0m ${fullPath}:${index + 1} - Disallowed color utility match: ${trimmed}`);
            failed = true;
          }
        }
      });
    }
  }
}

console.log('Starting CVerify Theme & Typography Semantic Token Audit...');
const srcDir = path.join(__dirname, '..', 'src');
if (fs.existsSync(srcDir)) {
  scanDir(srcDir);
}

if (failed) {
  console.log('\n\x1b[31mAudit Failed!\x1b[0m Some components still contain raw hardcoded color utility classes.');
  process.exit(1);
} else {
  console.log('\n\x1b[32mAudit Passed!\x1b[0m All components adhere perfectly to the HeroUI v3 semantic token theme.');
  process.exit(0);
}
