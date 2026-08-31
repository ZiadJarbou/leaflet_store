#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'deploy', 'production-code-only');

const forbiddenPatterns = [
  /(^|[\\/])\.env($|[\\/])/i,
  /(^|[\\/])\.env\./i,
  /(^|[\\/]).*\.db$/i,
  /(^|[\\/]).*\.sqlite3?$/i,
  /(^|[\\/]).*-wal$/i,
  /(^|[\\/]).*-shm$/i,
  /^server[\\/]uploads($|[\\/])/i,
  /^server[\\/]pdf_exports($|[\\/])/i,
  /^server[\\/]backups($|[\\/])/i,
  /^server[\\/]seed-[^\\/]+\.cjs$/i,
];

const requiredPaths = [
  'package.json',
  'package-lock.json',
  'server.js',
  'server/index.cjs',
  'server/routes',
  'server/default-card-templates.json',
  'dist',
  'public',
];

function assertInsideRoot(target) {
  const resolved = path.resolve(target);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`Refusing to operate outside project root: ${resolved}`);
  }
  return resolved;
}

function isForbidden(relativePath) {
  return forbiddenPatterns.some(pattern => pattern.test(relativePath));
}

function copyRecursive(source, destination, relativePath = '') {
  const rel = relativePath || path.basename(source);
  if (isForbidden(rel)) {
    throw new Error(`Refusing to package production runtime data or seed script: ${rel}`);
  }

  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    fs.mkdirSync(destination, { recursive: true });
    for (const entry of fs.readdirSync(source)) {
      copyRecursive(
        path.join(source, entry),
        path.join(destination, entry),
        relativePath ? path.join(relativePath, entry) : entry,
      );
    }
    return;
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function listFiles(dir, prefix = '') {
  const files = [];
  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const rel = prefix ? path.join(prefix, entry) : entry;
    if (fs.statSync(fullPath).isDirectory()) {
      files.push(...listFiles(fullPath, rel));
    } else {
      files.push(rel);
    }
  }
  return files;
}

assertInsideRoot(outDir);
if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const relativePath of requiredPaths) {
  const source = path.join(root, relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Required production artifact is missing: ${relativePath}`);
  }
  copyRecursive(source, path.join(outDir, relativePath), relativePath);
}

const packagedFiles = listFiles(outDir);
const forbidden = packagedFiles.filter(isForbidden);
if (forbidden.length) {
  throw new Error(`Unsafe production package contains forbidden file(s): ${forbidden.join(', ')}`);
}

const manifest = {
  created_at: new Date().toISOString(),
  policy: [
    'Application code only',
    'No production database files',
    'No environment credential files',
    'No uploads, PDF exports, or backups',
    'No seed scripts',
  ],
  files: packagedFiles.length,
};
fs.writeFileSync(path.join(outDir, 'DEPLOYMENT_MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Production code-only package prepared: ${path.relative(root, outDir)}`);
console.log(`Files: ${packagedFiles.length}`);
