"use strict";
// ============================================================
// SnapshotManager — 以资源为核心的快照/回滚管理器
// 从单槽位 UndoManager 重构为 Map<assetPath, SnapshotEntry>
// 保留旧接口兼容（storeBackup/canUndo/clear/getBackup）
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.UndoManager = exports.SnapshotManager = void 0;
class SnapshotManager {
    // ===== 新：以资源为核心的快照表 =====
    _snapshots = new Map();
    // ===== 旧兼容：单槽位备份 =====
    _backup = null;
    _timestamp = 0;
    // ===== 静态工厂：兼容旧名 =====
    /** @deprecated 使用 SnapshotManager */
    static create() {
        return new SnapshotManager();
    }
    // ==========================================
    // 新 API — 以资源为核心
    // ==========================================
    /** 记录操作前状态，path 已有时不重复拍 */
    captureBefore(path, kind, json) {
        if (!path || !json)
            return false;
        if (this._snapshots.has(path))
            return true; // 已有快照，幂等
        let parsed;
        try {
            parsed = JSON.parse(json);
        }
        catch {
            return false;
        }
        if (!Array.isArray(parsed))
            return false;
        this._snapshots.set(path, {
            path,
            kind,
            before: parsed,
            after: null,
            capturedAt: Date.now(),
        });
        return true;
    }
    /** done() 成功时记录操作后状态 */
    captureAfter(path, json) {
        const entry = this._snapshots.get(path);
        if (!entry)
            return false;
        let parsed;
        try {
            parsed = JSON.parse(json);
        }
        catch {
            return false;
        }
        if (!Array.isArray(parsed))
            return false;
        entry.after = parsed;
        return true;
    }
    /** 是否有该资源的快照 */
    hasBefore(path) {
        return this._snapshots.has(path);
    }
    /** 获取单个快照条目（只读） */
    getSnapshot(path) {
        return this._snapshots.get(path) || null;
    }
    /** 全部条目（供 diff 遍历） */
    getAllEntries() {
        return Array.from(this._snapshots.values());
    }
    /** 只读读取 before（不消耗） */
    peekBefore(path) {
        const entry = this._snapshots.get(path);
        if (!entry)
            return null;
        return { before: entry.before, kind: entry.kind };
    }
    /** 消耗型读取（回滚用），取出后从 Map 中移除 */
    consumeSnapshot(path) {
        const entry = this._snapshots.get(path);
        if (!entry)
            return null;
        this._snapshots.delete(path);
        return entry;
    }
    /** 回滚写入失败时放回快照 */
    restoreSnapshot(entry) {
        if (!this._snapshots.has(entry.path)) {
            this._snapshots.set(entry.path, entry);
        }
    }
    /** 清除单个资源快照 */
    clearSnapshot(path) {
        this._snapshots.delete(path);
    }
    /** 会话结束清理 */
    clearAll() {
        this._snapshots.clear();
        this.clear(); // 同时清理旧兼容槽位
    }
    /** 本次调用触及的所有资源路径 */
    touchedPaths() {
        return Array.from(this._snapshots.keys());
    }
    /** 快照表中资源数量 */
    get snapshotCount() {
        return this._snapshots.size;
    }
    // ==========================================
    // 旧 API — 单槽位兼容（过渡期，内部委托给新 API）
    // ==========================================
    /** @deprecated 使用 captureBefore 替代 */
    storeBackup(serializedJson, filePath, assetType) {
        if (!serializedJson || !filePath)
            return false;
        let json;
        try {
            json = JSON.parse(serializedJson);
        }
        catch {
            return false;
        }
        if (!Array.isArray(json))
            return false;
        this._backup = { json, filePath, assetType };
        this._timestamp = Date.now();
        // 同时写入新快照表（幂等）
        if (!this._snapshots.has(filePath)) {
            this._snapshots.set(filePath, {
                path: filePath,
                kind: assetType === 'scene' ? 'scene' : 'prefab',
                before: json,
                after: null,
                capturedAt: this._timestamp,
            });
        }
        return true;
    }
    /** 非破坏性读取备份（不消耗） */
    peekBackup() {
        return this._backup;
    }
    /** 获取备份数据，一次读取后自动清除 */
    getBackup() {
        const backup = this._backup;
        this._backup = null;
        this._timestamp = 0;
        return backup;
    }
    /** 恢复备份（写入失败时调用） */
    restoreBackup(backup) {
        this._backup = backup;
        this._timestamp = Date.now();
    }
    /** 是否有可用备份 */
    canUndo() {
        return this._backup !== null;
    }
    /** 清除备份（操作成功确认后调用） */
    clear() {
        this._backup = null;
        this._timestamp = 0;
    }
    /** 获取备份元信息（不消耗备份） */
    getInfo() {
        if (!this._backup)
            return null;
        return {
            timestamp: this._timestamp,
            filePath: this._backup.filePath,
            hasData: Array.isArray(this._backup.json) && this._backup.json.length > 0,
        };
    }
}
exports.SnapshotManager = SnapshotManager;
/** @deprecated 使用 SnapshotManager */
exports.UndoManager = SnapshotManager;
//# sourceMappingURL=undo-manager.js.map