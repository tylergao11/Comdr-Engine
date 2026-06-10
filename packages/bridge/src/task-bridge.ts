// ============================================================
// TaskBridge — 文件 IPC 轮询机制
// 轮询 temp/comdr/inbox/ → 执行 → 写 temp/comdr/outbox/
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import { VERSION } from './version';

const BRIDGE_SCHEMA = 'Comdr.cocos-task-bridge.v1';
const REQUEST_SCHEMA = 'Comdr.cocos-task-request.v1';
const RESULT_SCHEMA = 'Comdr.cocos-task-result.v1';

// 本地常量（与 core/src/foundation/constants.ts 保持一致）
const IPC_POLL_DEFAULT_MS = 250;
const IPC_TIMEOUT_DEFAULT_MS = 120_000;
const HEARTBEAT_SCHEMA_VERSION = '2.0.0';

export interface TaskBridgeOptions {
  getProjectPath: () => string;
  getEditorAppPath?: () => string;
  getOpenDocument?: () => { kind: string; path: string; name: string } | null;
  runTaskCard: (taskCard: { type: string; payload?: Record<string, unknown> }) => Promise<unknown>;
  intervalMs?: number;
  taskTimeoutMs?: number;
}

export class TaskBridge {
  private _opts: Required<TaskBridgeOptions>;
  private _timer: ReturnType<typeof setInterval> | null = null;
  private _processing: boolean = false;
  private _engineSourceInfo: Record<string, unknown> | null = null;
  private _engineSourceDiscovered = false;
  private _internalAssetInfo: Record<string, { uuid: string; type: string; name: string }> | null = null;
  private _internalAssetDiscovered = false;

  constructor(options: TaskBridgeOptions) {
    this._opts = {
      intervalMs: IPC_POLL_DEFAULT_MS,
      taskTimeoutMs: IPC_TIMEOUT_DEFAULT_MS,
      getEditorAppPath: () => '',
      getOpenDocument: () => null,
      ...options,
    };
  }

  start(): void {
    const dirs = this._getDirs();
    fs.mkdirSync(dirs.inbox, { recursive: true });
    fs.mkdirSync(dirs.processing, { recursive: true });
    fs.mkdirSync(dirs.outbox, { recursive: true });

    this._recoverProcessing(dirs);
    this._writeHeartbeat(dirs);

    this._timer = setInterval(() => {
      this._tick(dirs).catch((e) => { process.stderr.write(`[bridge] tick error: ${(e as Error).message}\n`); });
    }, this._opts.intervalMs);
    if (this._timer.unref) this._timer.unref();
  }

  stop(): void {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  // ===== 内部 =====

  private _getDirs(): { root: string; inbox: string; processing: string; outbox: string } {
    const projectPath = this._opts.getProjectPath();
    const root = path.join(projectPath, 'temp', 'comdr');
    return {
      root,
      inbox: path.join(root, 'inbox'),
      processing: path.join(root, 'processing'),
      outbox: path.join(root, 'outbox'),
    };
  }

  private async _tick(dirs: ReturnType<typeof this._getDirs>): Promise<void> {
    if (this._processing) return;

    const files = fs.readdirSync(dirs.inbox)
      .filter((f) => f.endsWith('.json'))
      .sort();

    this._writeHeartbeat(dirs);

    if (files.length === 0) return;

    this._processing = true;
    try {
      await this._processFile(dirs, files[0]);
    } finally {
      this._processing = false;
    }
  }

  private async _processFile(
    dirs: ReturnType<typeof this._getDirs>,
    fileName: string
  ): Promise<void> {
    const source = path.join(dirs.inbox, fileName);
    const working = path.join(dirs.processing, fileName);

    // 原子认领
    try {
      fs.renameSync(source, working);
    } catch (e) {
      process.stderr.write(`[bridge] rename claims failed: ${(e as Error).message}\n`);
      return;
    }

    const startedAt = new Date().toISOString();
    let request: Record<string, unknown> = {};

    try {
      const raw = fs.readFileSync(working, 'utf8').replace(/^﻿/, '');
      request = JSON.parse(raw) as Record<string, unknown>;

      if (request.schema !== REQUEST_SCHEMA) {
        throw new Error(`Unsupported schema: ${request.schema}`);
      }

      const taskCard = request.taskCard as { type: string; payload?: Record<string, unknown> };
      if (!taskCard || typeof taskCard !== 'object') {
        throw new Error('Missing taskCard');
      }

      // 执行（带超时）
      const result = await this._withTimeout(
        this._opts.runTaskCard(taskCard),
        this._opts.taskTimeoutMs
      );

      this._writeResult(dirs, request, {
        ok: true,
        result,
        startedAt,
        finishedAt: new Date().toISOString(),
      });
    } catch (err) {
      this._writeResult(dirs, request, {
        ok: false,
        error: (err as Error).message,
        startedAt,
        finishedAt: new Date().toISOString(),
      });
    } finally {
      try { fs.rmSync(working, { force: true }); } catch { /* ignore */ }
    }
  }

  private _writeResult(
    dirs: ReturnType<typeof this._getDirs>,
    request: Record<string, unknown>,
    result: Record<string, unknown>
  ): void {
    const id = String(request.id || `task-${Date.now()}`);
    const target = path.join(dirs.outbox, `${id}.json`);
    const payload = {
      schema: RESULT_SCHEMA,
      id,
      ...result,
    };

    // 原子写入
    const tmp = target + '.tmp.' + Date.now();
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2) + '\n', 'utf8');
    try {
      fs.renameSync(tmp, target);
    } catch (e) {
      process.stderr.write(`[bridge] atomic write rename failed, using fallback: ${(e as Error).message}\n`);
      try {
        fs.writeFileSync(target, JSON.stringify(payload, null, 2) + '\n', 'utf8');
      } catch (e2) {
        process.stderr.write(`[bridge] atomic write fallback also failed: ${(e2 as Error).message}\n`);
      }
      try { fs.rmSync(tmp, { force: true }); } catch { /* ignore */ }
    }
  }

  private _recoverProcessing(dirs: ReturnType<typeof this._getDirs>): void {
    if (!fs.existsSync(dirs.processing)) return;
    const files = fs.readdirSync(dirs.processing)
      .filter((f) => f.endsWith('.json'));

    for (const fileName of files) {
      const working = path.join(dirs.processing, fileName);
      this._writeResult(dirs, { id: path.basename(fileName, '.json') }, {
        ok: false,
        error: 'Recovered stale request after bridge restart',
        recovered: true,
        startedAt: null,
        finishedAt: new Date().toISOString(),
      });
      try { fs.rmSync(working, { force: true }); } catch { /* ignore */ }
    }
  }

  private _discoverEngineSource(): Record<string, unknown> {
    if (this._engineSourceDiscovered) return this._engineSourceInfo || { available: false };
    this._engineSourceDiscovered = true;

    const editorAppPath = this._opts.getEditorAppPath();
    if (!editorAppPath) {
      this._engineSourceInfo = { available: false, reason: 'no editor path' };
      return this._engineSourceInfo;
    }

    // 从 app.asar 路径推导编辑器根目录
    const editorRoot = path.dirname(editorAppPath);
    const engineCocosPath = path.join(editorRoot, 'resources', 'resources', '3d', 'engine', 'cocos');

    if (fs.existsSync(engineCocosPath)) {
      // 尝试读版本号
      let version = '';
      try {
        const infoPath = path.join(editorRoot, 'resources', 'info.json');
        if (fs.existsSync(infoPath)) {
          const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
          version = info.version || '';
        }
      } catch { /* ignore */ }

      this._engineSourceInfo = {
        available: true,
        path: engineCocosPath,
        version: version || '3.x',
      };
    } else {
      this._engineSourceInfo = { available: false, reason: 'engine cocos dir not found' };
    }

    return this._engineSourceInfo;
  }

  /** 加载 sync 脚本预提取的 internal 资产目录（构建时生成，零运行时路径依赖） */
  private _discoverInternalAssets(): Record<string, { uuid: string; type: string; name: string }> {
    if (this._internalAssetDiscovered) return this._internalAssetInfo || {};
    this._internalAssetDiscovered = true;

    // sync-bridge 脚本在构建时将 internal-assets.json 写入 dist
    const cachePath = path.join(__dirname, 'internal-assets.json');
    try {
      if (fs.existsSync(cachePath)) {
        const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        if (cache.schema === 'Comdr.internal-assets.v1' && cache.assets) {
          this._internalAssetInfo = cache.assets as Record<string, { uuid: string; type: string; name: string }>;
          return this._internalAssetInfo;
        }
      }
    } catch (e) {
      process.stderr.write(`[bridge] internal assets cache load failed: ${(e as Error).message}\n`);
    }

    this._internalAssetInfo = {};
    return {};
  }

  private _writeHeartbeat(dirs: ReturnType<typeof this._getDirs>): void {
    const cachePath = path.join(dirs.root, 'component-cache.json');
    let componentSchema: Record<string, unknown> = { working: false };
    try {
      if (fs.existsSync(cachePath)) {
        const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        const comps = cache.components || {};
        componentSchema = {
          working: true,
          count: Object.keys(comps).length,
          source: cache.source || 'engine-ts-source',
          version: cache.version || '',
        };
      }
    } catch { /* component cache not ready yet */ }

    const engineSource = this._discoverEngineSource();
    const internalAssets = this._discoverInternalAssets();

    const openDoc = this._opts.getOpenDocument?.() || null;
    // 心跳结构须与 core/src/tool-center.ts:BridgeHeartbeatInfo 兼容
    const info = {
      schema: BRIDGE_SCHEMA,
      projectPath: this._opts.getProjectPath(),
      openDocument: openDoc ? { kind: openDoc.kind, path: openDoc.path, name: openDoc.name } : null,
      root: dirs.root,
      inbox: dirs.inbox,
      processing: dirs.processing,
      outbox: dirs.outbox,
      updatedAt: new Date().toISOString(),
      editorCapabilities: {
        version: HEARTBEAT_SCHEMA_VERSION,
        bridgeVersion: VERSION,
        probedAt: new Date().toISOString(),
        componentSchema,
        assetWrite: { working: true },
        documentSerialize: { working: true },
        engineSource,
        internalAssets: Object.keys(internalAssets).length > 0 ? internalAssets : undefined,
      },
    };

    const bp = path.join(dirs.root, 'bridge.json');
    const tmp = bp + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(info, null, 2) + '\n', 'utf8');
    try {
      fs.renameSync(tmp, bp);
    } catch (e) {
      try {
        fs.writeFileSync(bp, JSON.stringify(info, null, 2) + '\n', 'utf8');
      } catch (e2) {
        process.stderr.write(`[bridge] heartbeat write failed: ${(e2 as Error).message}\n`);
      }
    }
  }

  private _withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Task timeout after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }
}
