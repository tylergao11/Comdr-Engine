// ============================================================
// copy-assets — 将非 TS 数据资产复制到 dist/ 对应位置
// tsc --build 只编译 .ts→.js，此脚本补齐 JSON 等数据文件
// ============================================================

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/** [src相对路径, 源文件名] → 复制到 dist/ 同目录 */
const ASSETS = [
  ['packages/core/src/knowledge', 'component-knowledge.json'],
];

let copied = 0;
let skipped = 0;

for (const [srcDir, fileName] of ASSETS) {
  const srcPath = path.join(ROOT, srcDir, fileName);
  const distDir = srcDir.replace('/src/', '/dist/');
  const distPath = path.join(ROOT, distDir, fileName);

  if (!fs.existsSync(srcPath)) {
    console.warn(`[copy-assets] WARN: source not found: ${srcPath}`);
    continue;
  }

  fs.mkdirSync(path.dirname(distPath), { recursive: true });

  const srcStat = fs.statSync(srcPath);
  const needsCopy = !fs.existsSync(distPath) ||
    fs.statSync(distPath).mtimeMs < srcStat.mtimeMs;

  if (needsCopy) {
    fs.copyFileSync(srcPath, distPath);
    copied++;
    console.log(`[copy-assets] COPIED: ${srcDir}/${fileName} → ${distDir}/${fileName}`);
  } else {
    skipped++;
  }
}

if (copied > 0 || skipped > 0) {
  console.log(`[copy-assets] Done: ${copied} copied, ${skipped} up-to-date`);
}
