const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, '../dist');
const indexPath = path.join(distDir, 'index.html');

if (!fs.existsSync(indexPath)) {
  process.exit(0);
}

let html = fs.readFileSync(indexPath, 'utf8');
const scriptMatch = html.match(/<script type="module" src="\/(app-assets|assets)\/(index-[A-Za-z0-9_-]+\.js)"><\/script>/);

if (!scriptMatch) {
  console.log('inline-entry-js: no external entry script found');
  process.exit(0);
}

const [, assetsDirName, scriptName] = scriptMatch;
const scriptPath = path.join(distDir, assetsDirName, scriptName);

if (!fs.existsSync(scriptPath)) {
  throw new Error(`inline-entry-js: missing ${scriptPath}`);
}

const script = fs.readFileSync(scriptPath, 'utf8');
const escapedScript = script.replace(/<\/script/gi, '<\\/script');

html = html
  .replace(/\s*<link rel="modulepreload" href="\/(?:app-assets|assets)\/[^"]+">/g, '')
  .replace(scriptMatch[0], () => `<script type="module">\n${escapedScript}\n</script>`);

fs.writeFileSync(indexPath, html);
console.log(`inline-entry-js: inlined ${assetsDirName}/${scriptName}`);
