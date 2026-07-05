const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');
const match = html.match(/教學日誌生成器 \(v(\d+)\.(\d+)\)/);

if (!match) {
  console.error('找不到目前版本號');
  process.exit(1);
}

const major = Number(match[1]);
const minor = Number(match[2]);
const nextVersion = `v${major}.${minor + 1}`;
const updated = html.replace(/v\d+\.\d+/g, nextVersion);

fs.writeFileSync(indexPath, updated, 'utf8');
console.log(nextVersion);
