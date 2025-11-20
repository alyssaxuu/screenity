#!/usr/bin/env node

/**
 * Script to fix common TypeScript type issues
 */

const fs = require('fs');
const path = require('path');

function fixTypesInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Fix chrome.storage.local.get patterns
  const storagePattern = /const\s*\{\s*([^}]+)\s*\}\s*=\s*await\s+chrome\.storage\.local\.get\(\[([^\]]+)\]\);/g;
  if (storagePattern.test(content)) {
    content = content.replace(storagePattern, (match, vars, keys) => {
      const varNames = vars.split(',').map(v => v.trim()).filter(v => v);
      const keyNames = keys.split(',').map(k => k.trim().replace(/['"]/g, '')).filter(k => k);
      
      if (varNames.length === keyNames.length) {
        const typedVars = varNames.map((v, i) => {
          const key = keyNames[i];
          return `${v} = result.${key} as any`;
        }).join(', ');
        
        return `const result = await chrome.storage.local.get([${keys}]);\n    const ${typedVars};`;
      }
      return match;
    });
    modified = true;
  }

  // Fix Promise<any> return types to Promise<void> for functions that don't return
  content = content.replace(/:\s*Promise<any>\s*=>\s*\{[^}]*chrome\.storage\.local\.set\([^}]*\}/g, ': Promise<void> => {');
  modified = modified || /:\s*Promise<any>\s*=>\s*\{[^}]*chrome\.storage\.local\.set\([^}]*\}/.test(content);

  // Fix error.message patterns
  content = content.replace(/catch\s*\((\w+)\)\s*\{[^}]*\1\.message/g, (match, errVar) => {
    return match.replace(new RegExp(`\\b${errVar}\\.message`, 'g'), `(${errVar} instanceof Error ? ${errVar} : new Error(String(${errVar}))).message`);
  });
  modified = modified || /catch\s*\((\w+)\)\s*\{[^}]*\1\.message/.test(content);

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed types in: ${filePath}`);
    return true;
  }
  return false;
}

function walkDir(dir, callback) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (filePath.includes('vendor') || filePath.includes('node_modules') || filePath.includes('build')) {
      return;
    }
    if (stat.isDirectory()) {
      walkDir(filePath, callback);
    } else if (stat.isFile() && (filePath.endsWith('.ts') || filePath.endsWith('.tsx'))) {
      callback(filePath);
    }
  });
}

let fixed = 0;
walkDir(path.join(__dirname, '../src'), (filePath) => {
  if (fixTypesInFile(filePath)) {
    fixed++;
  }
});

console.log(`\nFixed types in ${fixed} files`);

