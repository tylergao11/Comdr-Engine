// ============================================================
// setup — 一键入职脚本
// 用法: npm run setup
// 从 git clone 到可用，一条命令搞定
// ============================================================

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');

interface StepResult {
  label: string;
  status: 'ok' | 'skip' | 'fail';
  detail?: string;
}

const results: StepResult[] = [];

function sym(status: StepResult['status']): string {
  return { ok: '✓', skip: '⚠', fail: '✗' }[status];
}

function step(label: string, fn: () => StepResult): void {
  const r = fn();
  results.push(r);
  console.log(`${sym(r.status)} ${label}${r.detail ? ` → ${r.detail}` : ''}`);
}

function exec(cmd: string, cwd?: string): boolean {
  try {
    execSync(cmd, { cwd: cwd || ROOT, stdio: 'inherit' });
    return true;
  } catch {
    return false;
  }
}

function execSilent(cmd: string): boolean {
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// ===== Main =====

console.log('\n=== Comdr Setup ===\n');

// 1. Node.js 版本检查
step('Node.js v18+', () => {
  const v = parseInt(process.version.slice(1));
  return v >= 18
    ? { label: 'Node.js v18+', status: 'ok', detail: process.version }
    : { label: 'Node.js v18+', status: 'fail', detail: `found ${process.version}, need >=18` };
});

if (results[0].status === 'fail') {
  console.log('\n✗ Node.js >=18 required. Install from https://nodejs.org');
  process.exit(1);
}

// 2. npm install
step('npm install', () => {
  const ok = exec('npm install');
  return { label: 'npm install', status: ok ? 'ok' : 'fail', detail: ok ? 'all packages' : 'install failed' };
});

if (results[1].status === 'fail') {
  console.log('\n✗ npm install failed. Check your network and try again.');
  process.exit(1);
}

// 3. TypeScript build
step('TypeScript build', () => {
  const ok = exec('npm run build');
  return { label: 'TypeScript build', status: ok ? 'ok' : 'fail', detail: ok ? '4 packages' : 'build failed' };
});

if (results[2].status === 'fail') {
  console.log('\n✗ TypeScript build failed. Fix type errors and re-run `npm run setup`.');
  process.exit(1);
}

// 4. Overlay — 复制预编译二进制
step('Overlay', () => {
  const exeName = process.platform === 'win32' ? 'comdr-overlay.exe' : 'comdr-overlay';
  const home = process.env.HOME || process.env.USERPROFILE || '.';
  const overlayDir = path.join(home, '.comdr', 'overlay');
  const src = path.join(ROOT, 'packages', 'overlay', 'dist-bin', exeName);
  const dst = path.join(overlayDir, exeName);

  if (!fs.existsSync(src)) {
    return { label: 'Overlay', status: 'skip', detail: `pre-built binary not found at ${src}` };
  }

  fs.mkdirSync(overlayDir, { recursive: true });
  fs.copyFileSync(src, dst);
  const sizeMB = (fs.statSync(dst).size / (1024 * 1024)).toFixed(1);
  return { label: 'Overlay', status: 'ok', detail: `${sizeMB}MB → ${overlayDir}` };
});

// 5. Bridge — 部署到 Cocos Creator 扩展目录
step('Bridge sync', () => {
  const home = process.env.HOME || process.env.USERPROFILE || '.';
  const extDir = process.env.COCOS_EXTENSIONS_PATH ||
    path.join(home, '.CocosCreator', 'extensions', 'comdr-cocos-bridge');

  // 轻量级 Cocos 检测
  const cocosFound = detectCocosCreator();
  if (!cocosFound) {
    return { label: 'Bridge sync', status: 'skip', detail: 'Cocos Creator not detected' };
  }

  const ok = exec('npm run sync-bridge');
  return { label: 'Bridge sync', status: ok ? 'ok' : 'fail', detail: ok ? extDir : 'sync-bridge failed' };
});

// 6. API key 检查
step('API key', () => {
  // MCP server 作为子进程继承父进程环境变量，检查是否有可用的 key
  const keys = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'OPENAI_API_KEY', 'DEEPSEEK_API_KEY'];
  const found = keys.filter((k) => process.env[k]);
  if (found.length > 0) {
    return { label: 'API key', status: 'ok', detail: `${found[0]} detected` };
  }
  return { label: 'API key', status: 'skip', detail: 'inherited from parent process (if not set, LLM calls will fail)' };
});

// ===== Summary =====
const okCount = results.filter((r) => r.status === 'ok').length;
const skipCount = results.filter((r) => r.status === 'skip').length;
const failCount = results.filter((r) => r.status === 'fail').length;

console.log(`\nSummary: ${okCount} succeeded, ${skipCount} skipped, ${failCount} failed`);

console.log('\nNext steps:');
let stepNum = 1;
if (skipCount > 0 || failCount > 0) {
  // Only show the first skipped/failed item
  const skipped = results.filter((r) => r.status === 'skip');
  if (skipped.some((r) => r.label === 'Overlay')) {
    console.log(`  ${stepNum++}. Install Rust + Cargo and run \`npm run build:overlay\` to build the overlay`);
  }
  if (skipped.some((r) => r.label === 'Bridge sync')) {
    console.log(`  ${stepNum++}. Install Cocos Creator, then run \`npm run sync-bridge\` to deploy the bridge`);
  }
}
console.log(`  ${stepNum++}. Open Cocos Creator → Extension Manager → enable "comdr-cocos-bridge"`);
console.log(`  ${stepNum++}. Restart your IDE to pick up .mcp.json MCP configuration`);

if (failCount > 0) {
  console.log('\n⚠ Some steps failed. Fix the issues above and re-run `npm run setup`.');
  process.exit(1);
}
console.log('');

// ===== Helpers =====

function detectCocosCreator(): boolean {
  const home = process.env.HOME || process.env.USERPROFILE || '.';
  const localAppData =
    process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');

  const candidateDirs: string[] = [
    path.join(localAppData, 'CocosDashboard', 'editors'),
    path.join(localAppData, 'CocosDashboard', 'resources', 'editors'),
    path.join(home, 'Library', 'Application Support', 'CocosDashboard', 'editors'),
    path.join(home, 'CocosDashboard', 'editors'),
  ];

  for (const dir of candidateDirs) {
    if (!fs.existsSync(dir)) continue;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const dtsPath = path.join(
          dir,
          entry.name,
          'resources',
          '3d',
          'engine',
          'bin',
          '.declarations',
          'cc.d.ts'
        );
        if (fs.existsSync(dtsPath)) return true;
      }
    }
  }
  return false;
}
