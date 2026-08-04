const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, '../dist');
const indexPath = path.join(distDir, 'index.html');

if (!fs.existsSync(indexPath)) {
  console.warn('create-spa-fallbacks: dist/index.html not found, skipping');
  process.exit(0);
}

const indexHtml = fs.readFileSync(indexPath);
const fallbackDirs = [
  'admin',
  'admin/dashboard',
  'admin/users',
  'admin/leaflets',
  'admin/cover-pages',
  'admin/cover-templates',
  'admin/uploads',
  'admin/icons',
  'admin/seo',
  'admin/pages',
  'admin/card-templates',
  'admin/help-center',
  'admin/backup',
  'admin/settings',
];

for (const route of fallbackDirs) {
  const targetDir = path.join(distDir, route);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'index.html'), indexHtml);
}

fs.writeFileSync(path.join(distDir, '404.html'), indexHtml);
console.log(`create-spa-fallbacks: wrote ${fallbackDirs.length} admin route fallbacks and 404.html`);
