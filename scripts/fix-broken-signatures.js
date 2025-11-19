#!/usr/bin/env node

/**
 * Fix broken function signatures created by the conversion script
 */

const fs = require('fs');
const path = require('path');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Fix broken async function signatures: async (: any) => to async () =>
  const brokenAsync1 = /async \(: any\): Promise<any> =>/g;
  if (brokenAsync1.test(content)) {
    content = content.replace(brokenAsync1, 'async (): Promise<any> =>');
    modified = true;
  }

  // Fix broken function signatures: (: any) => to () =>
  const brokenFunc1 = /\(: any\) =>/g;
  if (brokenFunc1.test(content)) {
    content = content.replace(brokenFunc1, '() =>');
    modified = true;
  }

  // Fix broken function signatures: (: any: any) => to () =>
  const brokenFunc2 = /\(: any: any\) =>/g;
  if (brokenFunc2.test(content)) {
    content = content.replace(brokenFunc2, '() =>');
    modified = true;
  }

  // Fix broken export const with empty params
  const brokenExport = /export const (\w+) = async \(: any\): Promise<any> =>/g;
  if (brokenExport.test(content)) {
    content = content.replace(brokenExport, 'export const $1 = async (): Promise<any> =>');
    modified = true;
  }

  // Fix: any: any patterns
  content = content.replace(/: any: any/g, ': any');
  modified = modified || /: any: any/.test(content);

  // Fix parameter type issues: (param: any) or (param, param2: any)
  content = content.replace(/(\w+), (\w+): any\)/g, '$1: any, $2: any)');
  content = content.replace(/(\w+) = ([\w.]+): any\)/g, '$1: any = $2)');
  content = content.replace(/(\w+) = ([\w.]+): any: any\)/g, '$1: any = $2)');
  content = content.replace(/= null: any: any/g, ': any = null');
  content = content.replace(/= false: any/g, ': boolean = false');
  content = content.replace(/= true: any/g, ': boolean = true');

  // Fix function parameter types
  content = content.replace(/async \((\w+): any\): Promise<any> =>/g, 'async ($1: any): Promise<any> =>');
  content = content.replace(/async \((\w+), (\w+): any\): Promise<any> =>/g, 'async ($1: any, $2: any): Promise<any> =>');

  // Fix .js imports to remove extension
  content = content.replace(/from ['"](.*)\.js['"]/g, "from '$1'");
  content = content.replace(/from ['"](.*)\.jsx['"]/g, "from '$1'");

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${filePath}`);
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
  if (fixFile(filePath)) {
    fixed++;
  }
});

console.log(`\nFixed ${fixed} files`);

