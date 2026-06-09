"use strict";
// ============================================================
// AssetCache — 持久化 path→UUID 缓存
// 存储位置: ~/.comdr/asset-cache.json
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
exports.AssetCache = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const value_kit_1 = require("../foundation/value-kit");
const CACHE_SCHEMA = 'Comdr.asset-cache.v1';
const OLD_CACHE_SCHEMA = 'Cmdr.asset-cache.v1'; // 旧版本兼容
/** 缓存条目上限 — 超过此值按 LRU 淘汰最旧条目 */
const MAX_CACHE_ENTRIES = 10_000;
class AssetCache {
    _projectRoot;
    _cachePath;
    _entries = new Map();
    _dirty = false;
    _autoFlushTimer = null;
    constructor(projectRoot, cachePath) {
        this._projectRoot = (0, value_kit_1.normalizeSlash)(projectRoot);
        this._cachePath = cachePath || path.join(process.env.HOME || process.env.USERPROFILE || '.', '.comdr', 'asset-cache.json');
    }
    // ----- 读取 -----
    load() {
        let data = (0, value_kit_1.readJsonUtf8)(this._cachePath);
        // 迁移：新路径无数据时尝试旧路径 (cmdr → comdr 重命名兼容)
        if (!data) {
            const oldPath = this._cachePath.replace(/[\\/]\.comdr[\\/]/, (sep) => `${sep === '/' ? '/' : '\\'}.cmdr${sep === '/' ? '/' : '\\'}`);
            if (oldPath !== this._cachePath) {
                const oldData = (0, value_kit_1.readJsonUtf8)(oldPath);
                if (oldData && (oldData.schema === OLD_CACHE_SCHEMA || oldData.schema === CACHE_SCHEMA)) {
                    data = { ...oldData, schema: CACHE_SCHEMA };
                    // 写入新位置
                    const dir = path.dirname(this._cachePath);
                    fs.mkdirSync(dir, { recursive: true });
                    (0, value_kit_1.writeJsonAtomic)(this._cachePath, data, true);
                }
            }
        }
        if (!data || (data.schema !== CACHE_SCHEMA && data.schema !== OLD_CACHE_SCHEMA))
            return;
        // 仅加载同项目的数据
        if ((0, value_kit_1.normalizeSlash)(data.projectRoot) !== this._projectRoot)
            return;
        this._entries.clear();
        for (const [k, v] of Object.entries(data.entries || {})) {
            this._entries.set(k, v);
        }
        this._dirty = false;
    }
    get(assetPath) {
        const key = (0, value_kit_1.normalizeSlash)(assetPath);
        return this._entries.get(key)?.uuid || null;
    }
    getBatch(paths) {
        return paths.map((p) => this.get(p));
    }
    has(assetPath) {
        return this._entries.has((0, value_kit_1.normalizeSlash)(assetPath));
    }
    allEntries() {
        return Object.fromEntries(this._entries);
    }
    // ----- 写入 -----
    set(assetPath, uuid) {
        const key = (0, value_kit_1.normalizeSlash)(assetPath);
        // LRU 淘汰：超过上限时移除最旧的 N 条（按 updatedAt 排序）
        if (this._entries.size >= MAX_CACHE_ENTRIES && !this._entries.has(key)) {
            const sorted = [...this._entries.entries()]
                .sort(([, a], [, b]) => a.updatedAt.localeCompare(b.updatedAt));
            const evict = sorted.slice(0, Math.ceil(MAX_CACHE_ENTRIES * 0.1)); // 淘汰 10%
            for (const [k] of evict)
                this._entries.delete(k);
        }
        this._entries.set(key, { uuid, updatedAt: (0, value_kit_1.nowISO)() });
        this._dirty = true;
    }
    setBatch(map) {
        for (const [k, v] of Object.entries(map)) {
            this.set(k, v);
        }
    }
    invalidate(assetPath) {
        this._entries.delete((0, value_kit_1.normalizeSlash)(assetPath));
        this._dirty = true;
    }
    invalidateAll() {
        this._entries.clear();
        this._dirty = true;
    }
    // ----- 持久化 -----
    get isDirty() {
        return this._dirty;
    }
    flush() {
        if (!this._dirty)
            return;
        const data = {
            schema: CACHE_SCHEMA,
            projectRoot: this._projectRoot,
            updatedAt: (0, value_kit_1.nowISO)(),
            entries: Object.fromEntries(this._entries),
        };
        const dir = path.dirname(this._cachePath);
        fs.mkdirSync(dir, { recursive: true });
        (0, value_kit_1.writeJsonAtomic)(this._cachePath, data, true);
        this._dirty = false;
    }
    /** 启用自动刷新（5 分钟间隔） */
    enableAutoFlush(intervalMs = 5 * 60 * 1000) {
        if (this._autoFlushTimer)
            return;
        this._autoFlushTimer = setInterval(() => {
            if (this._dirty)
                this.flush();
        }, intervalMs);
        if (this._autoFlushTimer.unref)
            this._autoFlushTimer.unref();
    }
    /** 停用自动刷新定时器（不 flush） */
    disableAutoFlush() {
        if (this._autoFlushTimer) {
            clearInterval(this._autoFlushTimer);
            this._autoFlushTimer = null;
        }
    }
    /** 销毁定时器并刷新 */
    destroy() {
        if (this._autoFlushTimer) {
            clearInterval(this._autoFlushTimer);
            this._autoFlushTimer = null;
        }
        this.flush();
    }
}
exports.AssetCache = AssetCache;
//# sourceMappingURL=asset-cache.js.map