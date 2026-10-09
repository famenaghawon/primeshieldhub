// fix-links.js – run with: node fix-links.js
const fs = require('fs');
const path = require('path');
const { glob } = require('glob'); // npm install glob if needed

const PUBLIC = path.join(__dirname, 'public');

async function getPageNames() {
  const files = await glob('**/*.html', { cwd: PUBLIC, ignore: 'node_modules/**' });
  // Map "folder/index.html" to "folder/", "page.html" to "page"
  return files.map(f => {
    const parsed = path.parse(f);
    if (parsed.name === 'index') {
      return parsed.dir ? parsed.dir + '/' : '';
    }
    return path.join(parsed.dir, parsed.name).replace(/\\/g, '/');
  }).filter(Boolean);
}

function replaceLinks(content, pageNames) {
  // href attributes
  content = content.replace(/(href\s*=\s*["'])(\/[^"']*?)(["'])/gi, (match, p1, p2, p3) => {
    const clean = p2.split('?')[0].split('#')[0]; // ignore query/hash
    if (pageNames.includes(clean)) {
      return `${p1}${clean}.html${p2.slice(clean.length)}${p3}`;
    }
    return match;
  });

  // window.location.href = '/page'
  content = content.replace(/(window\.location\.href\s*=\s*['"])(\/[^'"]*?)(['"])/gi, (match, p1, p2, p3) => {
    const clean = p2.split('?')[0].split('#')[0];
    if (pageNames.includes(clean)) {
      return `${p1}${clean}.html${p2.slice(clean.length)}${p3}`;
    }
    return match;
  });

  // action attributes on forms
  content = content.replace(/(action\s*=\s*["'])(\/[^"']*?)(["'])/gi, (match, p1, p2, p3) => {
    const clean = p2.split('?')[0].split('#')[0];
    if (pageNames.includes(clean)) {
      return `${p1}${clean}.html${p2.slice(clean.length)}${p3}`;
    }
    return match;
  });

  return content;
}

async function main() {
  const pageNames = await getPageNames();
  console.log('Pages found:', pageNames);

  const htmlFiles = await glob('**/*.html', { cwd: PUBLIC });
  for (const file of htmlFiles) {
    const filePath = path.join(PUBLIC, file);
    let content = fs.readFileSync(filePath, 'utf8');
    const newContent = replaceLinks(content, pageNames);
    if (newContent !== content) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log('Updated:', file);
    }
  }
  console.log('Done. All links now include .html where applicable.');
}

main().catch(console.error);
