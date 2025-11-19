#!/usr/bin/env node

/**
 * Script to help convert JS/JSX files to TS/TSX
 * This renames files and adds basic TypeScript syntax
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');

function convertFile(filePath) {
  const ext = path.extname(filePath);
  const dir = path.dirname(filePath);
  const basename = path.basename(filePath, ext);
  
  if (ext === '.js') {
    const newPath = path.join(dir, basename + '.ts');
    console.log(`Converting ${filePath} -> ${newPath}`);
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Basic conversions
    // Add type annotations for common patterns
    content = content.replace(/export const (\w+) = \(([^)]*)\) =>/g, 
      'export const $1 = ($2: any) =>');
    content = content.replace(/export const (\w+) = async \(([^)]*)\) =>/g,
      'export const $1 = async ($2: any): Promise<any> =>');
    content = content.replace(/const (\w+) = \(([^)]*)\) =>/g,
      'const $1 = ($2: any) =>');
    content = content.replace(/const (\w+) = async \(([^)]*)\) =>/g,
      'const $1 = async ($2: any): Promise<any> =>');
    
    fs.writeFileSync(newPath, content);
    fs.unlinkSync(filePath);
    return true;
  } else if (ext === '.jsx') {
    const newPath = path.join(dir, basename + '.tsx');
    console.log(`Converting ${filePath} -> ${newPath}`);
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Basic type conversions for JSX
    // Add React import if not present and uses JSX
    if (content.includes('<') && !content.includes("import React") && !content.includes("from 'react'") && !content.includes("from \"react\"")) {
      // Check if it's using new JSX transform
      if (!content.includes("react/jsx-runtime")) {
        content = "import React from 'react';\n" + content;
      }
    }
    
    fs.writeFileSync(newPath, content);
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

function walkDir(dir, callback) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    // Skip vendor files and node_modules
    if (filePath.includes('vendor') || filePath.includes('node_modules') || filePath.includes('build')) {
      return;
    }
    if (stat.isDirectory()) {
      walkDir(filePath, callback);
    } else if (stat.isFile()) {
      callback(filePath);
    }
  });
}

// Convert all JS/JSX files
let converted = 0;
walkDir(srcDir, (filePath) => {
  if (convertFile(filePath)) {
    converted++;
  }
});

console.log(`\nConverted ${converted} files to TypeScript`);

