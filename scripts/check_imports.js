const fs = require('fs');
const path = require('path');

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
const deps = Object.keys(packageJson.dependencies || {});

function getFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      getFiles(full, files);
    } else if (full.endsWith('.js') || full.endsWith('.jsx')) {
      files.push(full);
    }
  }
  return files;
}

const allFiles = [...getFiles('app'), ...getFiles('src')];

function extractExports(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  if (filePath.endsWith('.json')) {
    return { exports: new Set(), hasDefault: true }; // JSON acts as default export
  }
  const exports = new Set();
  let hasDefault = false;

  const namedRe = /export\s+(const|let|var|function|async\s+function|class)\s+([a-zA-Z0-9_$]+)/g;
  let match;
  while ((match = namedRe.exec(content)) !== null) {
    exports.add(match[2]);
  }

  const listRe = /export\s+\{([^}]+)\}/g;
  while ((match = listRe.exec(content)) !== null) {
    const parts = match[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
    parts.forEach(p => exports.add(p));
  }
  
  if (/export\s+default\s+/.test(content)) hasDefault = true;

  return { exports, hasDefault };
}

let hasError = false;

for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  
  // 2. Check relative imports
  const relImportRe = /import\s+([^'"]*)\s+from\s+['"](\.[^'"]+)['"]/g;
  let match;
  while ((match = relImportRe.exec(content)) !== null) {
    let importedNames = match[1].trim();
    const relPath = match[2];
    let targetPath = path.resolve(path.dirname(file), relPath);
    if (!targetPath.endsWith('.js') && !targetPath.endsWith('.json')) targetPath += '.js';
    if (!fs.existsSync(targetPath) && !targetPath.endsWith('.json')) {
       targetPath = targetPath.replace(/\.js$/, '/index.js');
    }
    const targetInfo = extractExports(targetPath);
    if (!targetInfo) {
      console.error(`Cannot find target file: ${targetPath} from ${file}`);
      hasError = true;
      continue;
    }

    let needsDefault = false;
    let named = [];
    if (importedNames.includes('{')) {
      const parts = importedNames.split('{');
      if (parts[0].trim() && parts[0].trim() !== ',') needsDefault = true;
      named = parts[1].replace('}', '').split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
    } else if (importedNames.includes('*')) {
      // ignore
    } else {
      if (importedNames) needsDefault = true;
    }

    if (needsDefault && !targetInfo.hasDefault) {
      console.error(`${file} imports default from ${relPath} but it has no default export`);
      hasError = true;
    }
    for (const name of named) {
      if (!targetInfo.exports.has(name)) {
        console.error(`${file} imports { ${name} } from ${relPath} but it is not exported`);
        hasError = true;
      }
    }
  }
}

if (hasError) process.exit(1);
console.log('All imports OK');
