// ============================================================
// sync-bridge — 编译 + 同步到 Cocos Creator 扩展目录
// 用法: npm run build && npx tsx scripts/sync-bridge.ts [editorAppPath]
//
// component-cache.json 由 extract-component-schema.ts 从引擎 TS 源码生成。
// 如果无法提取（引擎源码不可用），使用内置默认（CI 预构建，3.8.3）。
// Bridge 运行时零外部依赖。
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const ROOT = path.resolve(__dirname, '..');
const BRIDGE_SRC = path.join(ROOT, 'packages', 'bridge');
const BRIDGE_DIST = path.join(BRIDGE_SRC, 'dist');
const EXTENSION_TARGET = process.env.COCOS_EXTENSIONS_PATH || path.join(
  process.env.HOME || process.env.USERPROFILE || '.',
  '.CocosCreator',
  'extensions',
  'comdr-cocos-bridge'
);

function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.json')) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`  ${entry.name}`);
    }
  }
}

// ===== 生成 component-cache.json =====

const DEFAULT_ENGINE_ROOT = process.platform === 'win32'
  ? 'C:/ProgramData/cocos/editors/Creator'
  : path.join(process.env.HOME || '.', 'Library/Application Support/CocosDashboard/editors');

function findEngineSourcePath(): string | null {
  // 在编辑器目录中搜索 3.x 版本的引擎 TS 源码
  if (!fs.existsSync(DEFAULT_ENGINE_ROOT)) return null;

  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(DEFAULT_ENGINE_ROOT, { withFileTypes: true }); } catch { return null; }

  // 按版本排序，优先用最新
  const versions = entries
    .filter((e) => e.isDirectory() && /^\d+\.\d+/.test(e.name))
    .map((e) => e.name)
    .sort()
    .reverse();

  for (const ver of versions) {
    const enginePath = path.join(DEFAULT_ENGINE_ROOT, ver, 'resources', 'resources', '3d', 'engine', 'cocos');
    if (fs.existsSync(enginePath)) {
      console.log(`  Found engine source: ${enginePath} (version ${ver})`);
      return enginePath;
    }
  }

  return null;
}

function generateComponentCache(editorAppPath?: string): boolean {
  // 1. 尝试运行提取脚本（从引擎 TS 源码提取组件 schema）
  const extractScript = path.join(ROOT, 'scripts', 'extract-component-schema.ts');
  let enginePath: string | null = null;

  if (editorAppPath) {
    // 从传入的 app.asar 路径推导引擎目录
    const editorRoot = path.dirname(editorAppPath);
    enginePath = path.join(editorRoot, 'resources', 'resources', '3d', 'engine', 'cocos');
  } else {
    enginePath = findEngineSourcePath();
  }

  if (enginePath && fs.existsSync(enginePath)) {
    try {
      const outputPath = path.join(BRIDGE_DIST, 'component-cache.json');
      execSync(`npx tsx "${extractScript}" "${enginePath}" "${outputPath}"`, {
        cwd: ROOT,
        stdio: 'inherit',
        timeout: 60_000,
      });
      console.log('  Component cache generated from engine source');
      return true;
    } catch (e) {
      console.warn(`  ⚠ Extraction failed: ${(e as Error).message}`);
    }
  }

  // 2. 回退：使用内置默认 component-cache.json（CI 预构建，基于 3.8.3）
  const defaultCache = path.join(BRIDGE_DIST, 'component-cache.json');
  if (fs.existsSync(defaultCache)) {
    console.log('  Using built-in default component-cache.json');
    return true;
  }

  console.warn('  ⚠ No component-cache source found — heartbeat will report componentSchema.working: false');
  console.warn('    Pass editor app.asar path: npx tsx scripts/sync-bridge.ts "C:\\...\\app.asar"');
  return false;
}

/** 从 CWD 向上搜索 Cocos 项目（含 package.json 且有 creator.version） */
function discoverCocosProject(): string | undefined {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    try {
      const pkgPath = path.join(dir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.creator?.version) {
          return dir;
        }
      }
    } catch { /* continue */ }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

/** 从 Cocos 安装目录的 editor/assets/ 提取 internal 资产 UUID，写入 internal-assets.json */
function extractInternalAssets(distDir: string): void {
  const enginePath = findEngineSourcePath();
  if (!enginePath) {
    console.log('  Engine source not found — skip internal asset extraction');
    return;
  }

  // engine/cocos → engine/editor/assets
  const internalDir = path.join(path.dirname(enginePath), 'editor', 'assets');
  if (!fs.existsSync(internalDir)) {
    console.log(`  Internal assets dir not found: ${internalDir}`);
    return;
  }

  const assets: Record<string, { uuid: string; type: string; name: string }> = {};

  function toKey(name: string): string {
    return name.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[_\s]+/g, '-').toLowerCase();
  }

  // 递归扫描目录下所有 .meta 文件
  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith('.meta')) continue;

      const relPath = path.relative(internalDir, full).replace(/\\/g, '/');
      const assetName = relPath.replace(/\.meta$/, '');
      const baseName = toKey(path.basename(assetName, path.extname(assetName)));
      // key 包含目录层级（如 default-materials/default-material）
      const keyPrefix = path.dirname(assetName) !== '.'
        ? toKey(path.dirname(assetName).replace(/[_\s]+/g, '-')) + '/'
        : '';

      try {
        const meta = JSON.parse(fs.readFileSync(full, 'utf8'));
        if (!meta.uuid) continue;

        // subMetas: texture, sprite-frame 子资产
        if (meta.subMetas) {
          for (const [subId, raw] of Object.entries(meta.subMetas)) {
            const sm = raw as Record<string, unknown>;
            const imp = sm.importer as string;
            if (imp === 'sprite-frame') {
              assets[keyPrefix + baseName + '-sprite-frame'] = {
                uuid: `${meta.uuid}@${subId}`, type: 'cc.SpriteFrame',
                name: (sm.displayName as string) || baseName,
              };
            } else if (imp === 'texture') {
              assets[keyPrefix + baseName + '-texture'] = {
                uuid: `${meta.uuid}@${subId}`, type: 'cc.Texture2D',
                name: (sm.displayName as string) || baseName,
              };
            }
          }
        }

        // 主资产
        const imp = (meta.importer || '') as string;
        let type = '';
        if (imp === 'image') type = 'cc.ImageAsset';
        else if (imp === 'material') type = 'cc.Material';
        else if (imp === 'font') type = 'cc.TTFFont';
        else if (imp === 'sprite-frame') type = 'cc.SpriteFrame';
        else if (imp === 'directory') continue;
        else type = imp;
        if (type) {
          assets[keyPrefix + baseName] = {
            uuid: meta.uuid, type,
            name: ((meta.userData as Record<string, unknown>)?.displayName as string) || baseName,
          };
        }
      } catch { /* skip unparseable */ }
    }
  }

  walk(internalDir);

  const output = path.join(distDir, 'internal-assets.json');
  fs.writeFileSync(output, JSON.stringify({
    schema: 'Comdr.internal-assets.v1',
    generatedBy: 'sync-bridge',
    source: 'engine-editor-assets',
    count: Object.keys(assets).length,
    assets,
  }, null, 2) + '\n', 'utf8');
  console.log(`  ${Object.keys(assets).length} internal assets → ${output}`);
}

// ===== 主流程 =====

function main(): void {
  const args = process.argv.slice(2);
  let editorAppPath: string | undefined;
  let projectPath: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project') {
      // --project 后跟路径 → 直接使用；无路径 → 留空走自动发现
      if (args[i + 1] && !args[i + 1].startsWith('--')) {
        projectPath = args[++i];
      }
    } else if (!args[i].startsWith('--')) {
      editorAppPath = args[i];
    }
  }
  // CLI > env var > CWD 自动发现（向上搜 Cocos 项目）
  const effectiveProjectPath = projectPath || process.env.COCOS_PROJECT_PATH || discoverCocosProject();
  if (effectiveProjectPath && !fs.existsSync(effectiveProjectPath)) {
    console.warn(`Warning: project path not found: ${effectiveProjectPath}`);
  }

  console.log(`Syncing bridge to: ${EXTENSION_TARGET}`);

  if (!fs.existsSync(BRIDGE_DIST)) {
    console.error('Bridge dist not found. Run `npm run build` first.');
    process.exit(1);
  }

  // 清理旧文件
  if (fs.existsSync(EXTENSION_TARGET)) {
    fs.rmSync(EXTENSION_TARGET, { recursive: true, force: true });
  }
  fs.mkdirSync(EXTENSION_TARGET, { recursive: true });

  // 1. 生成 component-cache.json（构建时，不依赖运行时 typescript）
  console.log('Generating component cache:');
  generateComponentCache(editorAppPath);

  // 2. 生成 internal-assets.json（从编辑器 assets 目录提取内置资产 UUID）
  console.log('Extracting internal assets:');
  extractInternalAssets(BRIDGE_DIST);

  // 3. 复制 bridge dist 文件
  console.log('Copying bridge dist files:');
  copyDir(BRIDGE_DIST, EXTENSION_TARGET);

  // 3. 生成 Cocos Creator 扩展清单
  const pkgJson = path.join(BRIDGE_SRC, 'package.json');
  if (fs.existsSync(pkgJson)) {
    const pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf8'));
    const cocos = pkg._cocos || {};

    const contributions = JSON.parse(JSON.stringify(cocos.contributions || {}));
    const sceneContrib = (contributions as Record<string, unknown>).scene as Record<string, unknown> | undefined;
    if (sceneContrib?.script) {
      const scene = sceneContrib;
      if (typeof scene.script === 'string') {
        scene.script = scene.script.replace(/^\.\/dist\//, './');
      }
    }

    const manifest: Record<string, unknown> = {
      name: 'comdr-cocos-bridge',
      title: cocos.title || 'Comdr',
      version: cocos.version || pkg.version || '1.0.0',
      package_version: cocos.package_version || 2,
      creator: cocos.creator || '>=3.0.0',
      description: cocos.description || 'Comdr Bridge for Cocos Creator',
      author: cocos.author || 'Comdr',
      main: './index.js',
      contributions,
    };

    fs.writeFileSync(
      path.join(EXTENSION_TARGET, 'package.json'),
      JSON.stringify(manifest, null, 2) + '\n',
      'utf8'
    );
    console.log('  package.json (Cocos manifest)');
  }

  // 4. 同步到项目级扩展目录（Cocos 优先加载项目级扩展）
  if (effectiveProjectPath) {
    const projectExtDir = path.join(effectiveProjectPath, 'extensions', 'comdr-cocos-bridge');
    console.log(`\nSyncing to project: ${effectiveProjectPath}`);
    if (fs.existsSync(projectExtDir)) {
      fs.rmSync(projectExtDir, { recursive: true, force: true });
    }
    fs.mkdirSync(projectExtDir, { recursive: true });
    copyDir(BRIDGE_DIST, projectExtDir);
    const projManifest = path.join(EXTENSION_TARGET, 'package.json');
    if (fs.existsSync(projManifest)) {
      fs.copyFileSync(projManifest, path.join(projectExtDir, 'package.json'));
    }
  }

  console.log('Sync complete.');
  console.log('');
  console.log('================================================================');
  console.log('  Restart Cocos Creator fully (close and reopen).');
  console.log('================================================================');
  console.log('');
}

main();
