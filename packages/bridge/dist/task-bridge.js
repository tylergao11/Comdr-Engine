"use strict";
// ============================================================
// TaskBridge — 文件 IPC 轮询机制
// 轮询 temp/comdr/inbox/ → 执行 → 写 temp/comdr/outbox/
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskBridge = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const version_1 = require("./version");
const BRIDGE_SCHEMA = 'Comdr.cocos-task-bridge.v1';
const REQUEST_SCHEMA = 'Comdr.cocos-task-request.v1';
const RESULT_SCHEMA = 'Comdr.cocos-task-result.v1';
// 本地常量（与 core/src/foundation/constants.ts 保持一致）
const IPC_POLL_DEFAULT_MS = 500;
const IPC_TIMEOUT_DEFAULT_MS = 120_000;
const HEARTBEAT_SCHEMA_VERSION = '2.0.0';
class TaskBridge {
    _opts;
    _timer = null;
    _processing = false;
    _engineSourceInfo = null;
    _engineSourceDiscovered = false;
    _internalAssetInfo = null;
    _internalAssetDiscovered = false;
    constructor(options) {
        this._opts = {
            intervalMs: IPC_POLL_DEFAULT_MS,
            taskTimeoutMs: IPC_TIMEOUT_DEFAULT_MS,
            getEditorAppPath: () => '',
            getOpenDocument: () => null,
            ...options,
        };
    }
    start() {
        const dirs = this._getDirs();
        fs.mkdirSync(dirs.inbox, { recursive: true });
        fs.mkdirSync(dirs.processing, { recursive: true });
        fs.mkdirSync(dirs.outbox, { recursive: true });
        this._recoverProcessing(dirs);
        this._writeHeartbeat(dirs);
        this._timer = setInterval(() => {
            this._tick(dirs).catch((e) => { process.stderr.write(`[bridge] tick error: ${e.message}\n`); });
        }, this._opts.intervalMs);
        if (this._timer.unref)
            this._timer.unref();
    }
    stop() {
        if (this._timer)
            clearInterval(this._timer);
        this._timer = null;
    }
    // ===== 内部 =====
    _getDirs() {
        const projectPath = this._opts.getProjectPath();
        const root = path.join(projectPath, 'temp', 'comdr');
        return {
            root,
            inbox: path.join(root, 'inbox'),
            processing: path.join(root, 'processing'),
            outbox: path.join(root, 'outbox'),
        };
    }
    async _tick(dirs) {
        if (this._processing)
            return;
        const files = fs.readdirSync(dirs.inbox)
            .filter((f) => f.endsWith('.json'))
            .sort();
        this._writeHeartbeat(dirs);
        if (files.length === 0)
            return;
        this._processing = true;
        try {
            await this._processFile(dirs, files[0]);
        }
        finally {
            this._processing = false;
        }
    }
    async _processFile(dirs, fileName) {
        const source = path.join(dirs.inbox, fileName);
        const working = path.join(dirs.processing, fileName);
        // 原子认领
        try {
            fs.renameSync(source, working);
        }
        catch (e) {
            process.stderr.write(`[bridge] rename claims failed: ${e.message}\n`);
            return;
        }
        const startedAt = new Date().toISOString();
        let request = {};
        try {
            const raw = fs.readFileSync(working, 'utf8').replace(/^﻿/, '');
            request = JSON.parse(raw);
            if (request.schema !== REQUEST_SCHEMA) {
                throw new Error(`Unsupported schema: ${request.schema}`);
            }
            const taskCard = request.taskCard;
            if (!taskCard || typeof taskCard !== 'object') {
                throw new Error('Missing taskCard');
            }
            // 执行（带超时）
            const result = await this._withTimeout(this._opts.runTaskCard(taskCard), this._opts.taskTimeoutMs);
            this._writeResult(dirs, request, {
                ok: true,
                result,
                startedAt,
                finishedAt: new Date().toISOString(),
            });
        }
        catch (err) {
            this._writeResult(dirs, request, {
                ok: false,
                error: err.message,
                startedAt,
                finishedAt: new Date().toISOString(),
            });
        }
        finally {
            try {
                fs.rmSync(working, { force: true });
            }
            catch { /* ignore */ }
        }
    }
    _writeResult(dirs, request, result) {
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
        }
        catch (e) {
            process.stderr.write(`[bridge] atomic write rename failed, using fallback: ${e.message}\n`);
            try {
                fs.writeFileSync(target, JSON.stringify(payload, null, 2) + '\n', 'utf8');
            }
            catch (e2) {
                process.stderr.write(`[bridge] atomic write fallback also failed: ${e2.message}\n`);
            }
            try {
                fs.rmSync(tmp, { force: true });
            }
            catch { /* ignore */ }
        }
    }
    _recoverProcessing(dirs) {
        if (!fs.existsSync(dirs.processing))
            return;
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
            try {
                fs.rmSync(working, { force: true });
            }
            catch { /* ignore */ }
        }
    }
    _discoverEngineSource() {
        if (this._engineSourceDiscovered)
            return this._engineSourceInfo || { available: false };
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
            }
            catch { /* ignore */ }
            this._engineSourceInfo = {
                available: true,
                path: engineCocosPath,
                version: version || '3.x',
            };
        }
        else {
            this._engineSourceInfo = { available: false, reason: 'engine cocos dir not found' };
        }
        return this._engineSourceInfo;
    }
    /** 加载 sync 脚本预提取的 internal 资产目录（构建时生成，零运行时路径依赖） */
    _discoverInternalAssets() {
        if (this._internalAssetDiscovered)
            return this._internalAssetInfo || {};
        this._internalAssetDiscovered = true;
        // sync-bridge 脚本在构建时将 internal-assets.json 写入 dist
        const cachePath = path.join(__dirname, 'internal-assets.json');
        try {
            if (fs.existsSync(cachePath)) {
                const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
                if (cache.schema === 'Comdr.internal-assets.v1' && cache.assets) {
                    this._internalAssetInfo = cache.assets;
                    return this._internalAssetInfo;
                }
            }
        }
        catch (e) {
            process.stderr.write(`[bridge] internal assets cache load failed: ${e.message}\n`);
        }
        this._internalAssetInfo = {};
        return {};
    }
    _writeHeartbeat(dirs) {
        const cachePath = path.join(dirs.root, 'component-cache.json');
        let componentSchema = { working: false };
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
        }
        catch { /* component cache not ready yet */ }
        const engineSource = this._discoverEngineSource();
        const internalAssets = this._discoverInternalAssets();
        const openDoc = this._opts.getOpenDocument?.() || null;
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
                bridgeVersion: version_1.VERSION,
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
        }
        catch (e) {
            try {
                fs.writeFileSync(bp, JSON.stringify(info, null, 2) + '\n', 'utf8');
            }
            catch (e2) {
                process.stderr.write(`[bridge] heartbeat write failed: ${e2.message}\n`);
            }
        }
    }
    _withTimeout(promise, ms) {
        let timer;
        const timeout = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`Task timeout after ${ms}ms`)), ms);
        });
        return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
    }
}
exports.TaskBridge = TaskBridge;
//# sourceMappingURL=task-bridge.js.map