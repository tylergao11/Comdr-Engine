// ============================================================
// clean — 跨平台清理编译产物
// ============================================================

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PACKAGES = ['core', 'bridge', 'mcp-server', 'cli'];

let removed = 0;
for (const pkg of PACKAGES) {
  const distDir = path.join(ROOT, 'packages', pkg, 'dist');
  try {
    fs.rmSync(distDir, { recursive: true, force: true });
    removed++;
    console.log(`[clean] Removed: packages/${pkg}/dist`);
  } catch {
    // 目录不存在或无法删除，跳过
  }
}
console.log(`[clean] Done: ${removed} package(s) cleaned`);
