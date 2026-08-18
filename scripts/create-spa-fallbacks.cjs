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
  'why',
  'features',
  'faq',
  'contact',
  'pricing',
  'payment',
  'payment/success',
  'forgot-password',
  'verify-email',
  'oauth',
  'oauth/callback',
  'create-leaflet',
  'my-leaflets',
  'dashboard',
  'settings',
  'privacy',
  'terms',
  'help',
  '404',
  'app',
  'app/leaflet',
  ...Array.from({ length: 500 }, (_, i) => `app/leaflet/${i + 1}`),
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

const htaccess = `DirectoryIndex index.html

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  RewriteRule ^index\\.html$ - [L]

  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  RewriteCond %{REQUEST_URI} !^/api/
  RewriteCond %{REQUEST_URI} !^/uploads/
  RewriteRule ^ /index.html [L]
</IfModule>

ErrorDocument 404 /index.html
`;
fs.writeFileSync(path.join(distDir, '.htaccess'), htaccess);

console.log(`create-spa-fallbacks: wrote ${fallbackDirs.length} SPA route fallbacks, 404.html, and .htaccess`);
