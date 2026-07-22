const fs = require('fs');
const path = require('path');

const assetsDir = ['app-assets', 'assets']
  .map(dir => path.resolve(__dirname, '../dist', dir))
  .find(dir => fs.existsSync(dir));
const legacyNames = {
  js: ['index-B5IqVcR5.js'],
  css: ['index-1UtsMkKD.css'],
};

if (!assetsDir) {
  process.exit(0);
}

const files = fs.readdirSync(assetsDir);

function latestIndexAsset(ext) {
  return files
    .filter(name => new RegExp(`^index-[A-Za-z0-9_-]+\\.${ext}$`).test(name))
    .map(name => ({
      name,
      mtime: fs.statSync(path.join(assetsDir, name)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime)[0]?.name;
}

for (const [ext, names] of Object.entries(legacyNames)) {
  const current = latestIndexAsset(ext);
  if (!current) continue;

  const source = path.join(assetsDir, current);
  for (const legacy of names) {
    const target = path.join(assetsDir, legacy);
    if (legacy === current) continue;
    fs.copyFileSync(source, target);
    console.log(`compat-assets: ${legacy} -> ${current}`);
  }
}
