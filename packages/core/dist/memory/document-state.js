"use strict";
// ============================================================
// DocumentState — 当前打开的文档跟踪，从 Bridge 心跳同步
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentState = exports.DOCUMENT_KINDS = void 0;
const constants_1 = require("../foundation/constants");
exports.DOCUMENT_KINDS = {
    SCENE: 'scene',
    PREFAB: 'prefab',
    NONE: 'none',
};
const EMPTY_STATE = {
    kind: 'none',
    dbUrl: null,
    path: null,
    assetUuid: null,
    rootUuid: null,
    name: null,
};
class DocumentState {
    _current = { ...EMPTY_STATE };
    _history = [];
    openScene(dbUrl, assetUuid, rootUuid, name) {
        this._pushHistory();
        this._current = {
            kind: 'scene',
            dbUrl,
            path: null,
            assetUuid: assetUuid || null,
            rootUuid: rootUuid || null,
            name: name || null,
        };
    }
    openPrefab(dbUrl, assetUuid, rootUuid, name) {
        this._pushHistory();
        this._current = {
            kind: 'prefab',
            dbUrl,
            path: null,
            assetUuid: assetUuid || null,
            rootUuid: rootUuid || null,
            name: name || null,
        };
    }
    close() {
        this._pushHistory();
        this._current = { ...EMPTY_STATE };
    }
    getCurrent() {
        return this._current;
    }
    isEditingScene() {
        return this._current.kind === 'scene';
    }
    isEditingPrefab() {
        return this._current.kind === 'prefab';
    }
    hasOpen() {
        return this._current.kind !== 'none';
    }
    /** 从 Bridge 心跳更新文档状态 */
    updateFromHeartbeat(hb) {
        const doc = hb.openDocument || hb.currentScene;
        if (!doc || !doc.kind) {
            if (!hb.hasOpenDocument && this._current.kind !== 'none') {
                this.close();
            }
            return;
        }
        const kind = doc.kind === 'prefab' ? 'prefab' : 'scene';
        const newState = {
            kind: kind,
            dbUrl: doc.dbUrl || null,
            path: doc.path || null,
            assetUuid: doc.assetUuid || null,
            rootUuid: doc.rootNodeUuid || null,
            name: doc.name || null,
        };
        if (!this._sameDoc(newState)) {
            this._pushHistory();
            this._current = newState;
        }
    }
    /** 是否匹配给定的目标 */
    matchesTarget(targetKind, targetPath) {
        if (this._current.kind !== targetKind)
            return false;
        if (targetPath && this._current.path && this._current.path !== targetPath)
            return false;
        return true;
    }
    getHistory(n = 20) {
        return this._history.slice(-n);
    }
    // ----- private -----
    _pushHistory() {
        if (this._current.kind !== 'none') {
            this._history.push({ ...this._current });
            if (this._history.length > constants_1.BUFFER_EDIT_HISTORY) {
                this._history = this._history.slice(-constants_1.BUFFER_EDIT_HISTORY);
            }
        }
    }
    _sameDoc(other) {
        return (this._current.kind === other.kind &&
            this._current.dbUrl === other.dbUrl &&
            this._current.assetUuid === other.assetUuid);
    }
}
exports.DocumentState = DocumentState;
//# sourceMappingURL=document-state.js.map