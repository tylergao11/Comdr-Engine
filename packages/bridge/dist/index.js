"use strict";
// ============================================================
// @comdr/bridge — Cocos Creator 扩展入口
// 替代原 main.js，在 Cocos Editor 进程中运行
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
exports.VERSION = void 0;
exports.load = load;
exports.unload = unload;
exports.open = open;
exports.getProjectInfo = getProjectInfo;
exports.runTaskCard = runTaskCardFromEditor;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const document_1 = require("./document");
const probe_v2_1 = require("./probe-v2");
const asset_writer_1 = require("./asset-writer");
const path_utils_1 = require("./path-utils");
const resource_index_1 = require("./resource-index");
const task_bridge_1 = require("./task-bridge");
const error_codes_1 = require("./error-codes");
var version_1 = require("./version");
Object.defineProperty(exports, "VERSION", { enumerable: true, get: function () { return version_1.VERSION; } });
// ===== 扩展生命周期 =====
let taskBridge = null;
let resourceIndex = null;
async function load() {
    console.log('[Comdr Bridge] Loading...');
    try {
        // 1. 从扩展目录读取 component-cache.json（sync-bridge 构建时生成，零运行时依赖）
        ensureComponentCache();
        // 2. 初始化资源索引
        resourceIndex = new resource_index_1.ResourceIndex(Editor.Project.path);
        // 异步全量扫描
        setTimeout(() => { resourceIndex.fullScan().catch(() => { }); }, 100);
        // 3. 初始化任务桥接
        taskBridge = new task_bridge_1.TaskBridge({
            getProjectPath: () => Editor.Project.path,
            getEditorAppPath: () => Editor.App.path,
            getOpenDocument: () => {
                const doc = getDoc();
                return doc ? { kind: doc.kind, path: doc.dbUrl || '', name: doc.rootName || '' } : null;
            },
            runTaskCard: runTaskCardFromEditor,
        });
        taskBridge.start();
        console.log('[Comdr Bridge] Ready');
    }
    catch (err) {
        console.error('[Comdr Bridge] Load failed:', err);
    }
}
/**
 * 将 bridge dist 内置的 component-cache.json 复制到项目 temp 目录。
 * 不需要 typescript、不需要 AST parser 运行时加载。
 * component-cache.json 由 sync-bridge.ts 在构建时生成。
 */
function ensureComponentCache() {
    const projectPath = Editor.Project.path;
    const destPath = path.join(projectPath, 'temp', 'comdr', 'component-cache.json');
    // 如果项目 temp 下已有，跳过（避免重复写入）
    if (fs.existsSync(destPath)) {
        console.log('[Comdr Bridge] component-cache.json already exists in project temp');
        return;
    }
    // 从扩展根目录读取内置的 component-cache.json
    const bundledPath = path.join(__dirname, 'component-cache.json');
    if (fs.existsSync(bundledPath)) {
        try {
            const destDir = path.dirname(destPath);
            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }
            fs.copyFileSync(bundledPath, destPath);
            console.log('[Comdr Bridge] component-cache.json deployed from bundle');
        }
        catch (e) {
            console.warn('[Comdr Bridge] Failed to copy component-cache.json:', e.message);
        }
    }
    else {
        console.warn('[Comdr Bridge] component-cache.json not bundled — run sync-bridge to generate it');
    }
}
/**
 * Bridge 启动时自动 dump 引擎序列化 schema 到项目 temp 目录。
 * 提供给 Gateway 作为引用类型的单一事实来源，替代手工 REF_ANNOTATIONS。
 * 延迟执行（等 scene 服务就绪），失败不阻塞。
 */
async function ensureEngineSchema() {
    const projectPath = Editor.Project.path;
    const destPath = path.join(projectPath, 'temp', 'comdr', 'engine-schema.json');
    try {
        const scriptContent = `
      var probeLib = require('./bridge-probe-lib');
      probeLib(cc, EditorExtends).dumpEngineSchema();
    `;
        const result = await Editor.Message.request('scene', 'execute-scene-script', scriptContent);
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        const tmp = destPath + '.tmp.' + Date.now();
        fs.writeFileSync(tmp, JSON.stringify(result, null, 2) + '\n', 'utf8');
        try {
            fs.renameSync(tmp, destPath);
        }
        catch {
            fs.writeFileSync(destPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
            try {
                fs.rmSync(tmp, { force: true });
            }
            catch { /* ignore */ }
        }
        console.log('[Comdr Bridge] engine-schema.json dumped');
    }
    catch (e) {
        process.stderr.write(`[bridge] engine-schema dump failed: ${e.message}\n`);
    }
}
function unload() {
    if (taskBridge) {
        taskBridge.stop();
        taskBridge = null;
    }
    console.log('[Comdr Bridge] Unloaded');
}
// ===== 消息处理 =====
function open(assetPath) {
    return Editor.Message.request('asset-db', 'open-asset', assetPath);
}
function getProjectInfo() {
    return {
        path: Editor.Project.path,
        name: path.basename(Editor.Project.path),
        engineVersion: Editor.App.version,
    };
}
// ===== 文档注册表（支持多窗口：path → Document） =====
const _openDocs = new Map();
let _activeDocPath = null;
function getDoc() {
    if (!_activeDocPath)
        return null;
    return _openDocs.get(_activeDocPath) || null;
}
function setDoc(path, doc) {
    _openDocs.set(path, doc);
    _activeDocPath = path;
}
function clearDoc(path) {
    if (path) {
        _openDocs.delete(path);
        if (_activeDocPath === path)
            _activeDocPath = null;
    }
    else {
        _openDocs.clear();
        _activeDocPath = null;
    }
}
// ===== 任务分发 =====
let _schemaDumped = false;
let _busy = false; // 防重入 guard（Bridge 单线程轮询，此 flag 防御 tick 重叠）
async function runTaskCardFromEditor(taskCard) {
    if (_busy)
        return { ok: false, error: 'Bridge busy — concurrent request rejected', code: 'BR_BUSY' };
    _busy = true;
    try {
        // 第一次有任务到达时 dump engine-schema（此时 scene 必定就绪，不会失败）
        if (!_schemaDumped) {
            _schemaDumped = true;
            ensureEngineSchema().then(() => {
                const markerPath = path.join(Editor.Project.path, 'temp', 'comdr', 'schema-triggered.txt');
                try {
                    fs.writeFileSync(markerPath, 'ok at ' + new Date().toISOString(), 'utf8');
                }
                catch (_) { /* */ }
            }).catch((e) => {
                const ep = path.join(Editor.Project.path, 'temp', 'comdr', 'schema-error.txt');
                try {
                    fs.writeFileSync(ep, e.message + '\n' + (e.stack || ''), 'utf8');
                }
                catch (_) { /* */ }
            });
        }
        const { type, payload = {} } = taskCard;
        const projectPath = Editor.Project.path;
        switch (type) {
            case 'probe': {
                const doc = getDoc();
                const probe = new probe_v2_1.ProbeV2(projectPath, doc);
                if (resourceIndex)
                    probe.setResourceIndex(resourceIndex);
                const kind = (payload.probeType || payload.kind || 'assets');
                return probe.handle({
                    kind: kind,
                    path: payload.path,
                    name: payload.name,
                    pattern: payload.pattern,
                    fileId: payload.nodeUuid,
                    componentType: payload.component,
                    property: payload.property,
                    level: payload.level,
                    limit: payload.limit,
                    query: payload.query,
                });
            }
            case 'write': {
                const writer = new asset_writer_1.AssetWriter(projectPath);
                const writeResult = await writer.writeAsset(payload);
                // N14: 如果 write 路径匹配当前打开文档，自动重新加载文档
                const wrotePath = writeResult.path;
                if (wrotePath && _activeDocPath && wrotePath === path.basename(_activeDocPath)) {
                    const reopen = document_1.Document.open(projectPath, wrotePath);
                    if (reopen.ok)
                        setDoc(wrotePath, reopen.doc);
                }
                return writeResult;
            }
            case 'open': {
                const openPath = payload.path;
                const result = document_1.Document.open(projectPath, openPath);
                if (result.ok) {
                    setDoc(openPath, result.doc);
                    const ctx = result.doc.ctx();
                    return { kind: result.doc.kind, dbUrl: result.doc.dbUrl, name: result.doc.rootName, rootNodeUuid: ctx.rootNodeUuid };
                }
                clearDoc(openPath);
                return result;
            }
            case 'edit': {
                const doc = getDoc();
                if (!doc)
                    return { ok: false, error: 'No document open', code: error_codes_1.ERR_BR_NO_DOC };
                return doc.edit(payload.editType, payload);
            }
            case 'save': {
                const doc = getDoc();
                if (!doc)
                    return { ok: false, error: 'No document open', code: error_codes_1.ERR_BR_NO_DOC };
                const rawDbUrl = doc.dbUrl;
                const normalized = (0, path_utils_1.normalizeAssetPath)(rawDbUrl);
                const savePath = path.join(projectPath, normalized.fsPath);
                if (!fs.existsSync(path.dirname(savePath))) {
                    return { ok: false, error: `Save directory does not exist: ${path.dirname(savePath)}`, code: error_codes_1.ERR_BR_NO_DOC };
                }
                const content = doc.serialize();
                // 诊断：写盘前检查所有脚本组件的属性（读 _key 下划线前缀，Cocos 标准存储）
                try {
                    const parsed = JSON.parse(content);
                    const scriptComps = [];
                    for (const o of parsed) {
                        if (o && typeof o === 'object' && o.__type__ && typeof o.__type__ === 'string'
                            && !o.__type__.startsWith('cc.') && !o.__type__.startsWith('cc.Prefab') && o.node) {
                            const props = {};
                            for (const k of Object.keys(o)) {
                                if (k === '__type__' || k === '__id__' || k === 'node' || k === '__prefab' || k === '_name' || k === '_objFlags' || k === '_id' || k === '_enabled' || k === '__editorExtras__' || k === '_rawProps')
                                    continue;
                                props[k] = o[k];
                            }
                            scriptComps.push({ type: o.__type__, props });
                        }
                    }
                    const diag = { path: savePath, scriptComps, totalScriptComps: scriptComps.length };
                    fs.writeFileSync(path.join(projectPath, 'temp', 'comdr', 'save-diag.json'), JSON.stringify(diag, null, 2), 'utf8');
                }
                catch (_) { /* */ }
                fs.writeFileSync(savePath, content, 'utf8');
                doc.setPath(normalized.fsPath, doc.kind);
                return { ok: true, path: normalized.fsPath };
            }
            default:
                throw new Error(`Unknown task type: ${type}`);
        }
    }
    finally {
        _busy = false;
    }
}
//# sourceMappingURL=index.js.map