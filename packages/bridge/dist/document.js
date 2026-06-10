"use strict";
// ============================================================
// Document — prefab/scene JSON 生命周期管理
// 打开 → 查询 → 编辑(快照+回滚) → 序列化(墓碑压缩) → 保存
// 参考原 Comdr ComdrTools/cocos-extension/comdr-cocos-bridge/document.js
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
exports.Document = exports.EditType = void 0;
exports.setComponentTemplateProvider = setComponentTemplateProvider;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const id_utils_1 = require("./id-utils");
const path_utils_1 = require("./path-utils");
const error_codes_1 = require("./error-codes");
// 本地常量（与 core/src/model/cocos-world.ts 保持一致）
const LAYER_UI_2D = 33554432;
const MAX_UNDO_DEPTH = 50;
/** 墓碑压缩阈值 — 只有超过此值才触发压缩，小场景不付出 O(n) 的 compact 开销 */
const TOMBSTONE_COMPACT_THRESHOLD = 200;
/** 层级节点类型 — 对应 core/src/model/cocos-world.ts NODE_LIKE_TYPES */
const NODE_LIKE_TYPES = new Set(['cc.Node', 'cc.Scene']);
/** 树遍历最大深度 — 防御极端嵌套场景（深层 prefab 嵌套），超深视为数据损坏 */
const MAX_TREE_DEPTH = 1000;
/** 文档编辑操作类型 */
exports.EditType = {
    ADD_COMPONENT: 'add-component',
    SET_PROP: 'set-prop',
    SET_PROPS: 'set-props',
    DELETE_NODE: 'delete-node',
    REPARENT: 'reparent',
    DUPLICATE: 'duplicate',
    SET_ACTIVE: 'set-active',
    ADD_NODE_TREE: 'add-node-tree',
};
const error_codes_2 = require("./error-codes");
// ====== 可注入的组件模板提供者 ======
// Bridge 部署到 Cocos 扩展目录时不能直接 import @comdr/core
// 由 index.ts 在初始化时注入
let _componentTemplateProvider = null;
function setComponentTemplateProvider(fn) {
    _componentTemplateProvider = fn;
}
// ===== 诊断收集器：_resolvePropValue → _setProperties 全链路 =====
// 每次 edit 操作重置，set-props 完成后写入文件。
let _diagResolveEntries = [];
function _appendResolveDiag(entry) {
    _diagResolveEntries.push(entry);
}
function _flushSetPropsDiag(detail) {
    try {
        const fs = require('fs');
        const p = require('path');
        fs.writeFileSync(p.join(__dirname, '..', 'setprops-diag.json'), JSON.stringify({
            resolveChain: _diagResolveEntries,
            ...detail,
        }, null, 2), 'utf8');
    }
    catch (_) { /* */ }
    _diagResolveEntries = [];
}
// ===== 工具函数 =====
/** cc.Node 或 cc.Scene — 对应 NODE_LIKE_TYPES */
function _isNodeOrScene(typeName) {
    return typeName !== undefined && NODE_LIKE_TYPES.has(typeName);
}
/** Gateway 已在上游完成类型标准化（引擎组件 → cc.Xxx，用户脚本 → 类名）。
 *  Bridge 信任上游，不做二次加工。 */
function normalizeComponentType(typeName) {
    if (!typeName)
        return '';
    return typeName;
}
// 组件模板的惰性引用（避免 Bridge 环境依赖 @comdr/core）
let _cocosTypesModule = null;
function getComponentTemplate(typeName) {
    // 1. 注入的提供者（部署环境）
    if (_componentTemplateProvider) {
        const t = _componentTemplateProvider(typeName);
        if (t)
            return t;
    }
    // 2. 最小内置回退
    return _buildMinimalTemplate(typeName);
}
function _buildMinimalTemplate(typeName) {
    return {
        __type__: typeName,
        _name: '',
        _objFlags: 0,
        node: null,
        _enabled: true,
        _id: '',
    };
}
// ====== Document 类 ======
class Document {
    _json;
    _tree;
    _path;
    _kind;
    _dirty;
    _undoStack = [];
    _maxUndo = MAX_UNDO_DEPTH;
    _snapshot;
    // 模糊名索引（name → 命中列表），_buildTree 时构建，O(1) 查找
    _nodeFlatIndex = [];
    // findNode 加速：fileId → PrefabInfo 在 _json 中的索引，惰性构建，_json 变更后置 null
    _prefabInfoIndex = null;
    // findComponent 加速：CompPrefabInfo 索引 → 引用它的 Component 索引，惰性构建
    _compToCpiIndex = null;
    constructor(jsonArray, assetPath, kind, tree) {
        this._json = jsonArray;
        this._tree = tree;
        this._path = assetPath;
        this._kind = kind;
        this._dirty = false;
        this._undoStack = [];
        this._snapshot = null;
    }
    // ===== Getters =====
    get kind() { return this._kind; }
    get dbUrl() { return this._path; }
    get isDirty() { return this._dirty; }
    get rootName() { return this._tree?.name || ''; }
    // ===== Static factories =====
    static open(projectPath, assetPath, kind) {
        const resolvedKind = kind || (assetPath && /\.scene$/i.test(assetPath) ? 'scene' : 'prefab');
        const normalized = (0, path_utils_1.normalizeAssetPath)(assetPath);
        const fullPath = path.join(projectPath, normalized.fsPath);
        if (!fs.existsSync(fullPath)) {
            return { ok: false, error: `File not found: ${assetPath}`, code: error_codes_2.ERR_DOC_ASSET_NOT_FOUND };
        }
        let json;
        try {
            const content = fs.readFileSync(fullPath, 'utf8').replace(/^﻿/, '');
            json = JSON.parse(content);
        }
        catch (e) {
            return { ok: false, error: `Failed to parse: ${e.message}`, code: error_codes_2.ERR_DOC_PARSE_ERROR };
        }
        if (!Array.isArray(json)) {
            return { ok: false, error: 'Invalid format: not an array', code: error_codes_2.ERR_DOC_INVALID_FORMAT };
        }
        const treeResult = Document._buildTree(json);
        if (!treeResult.ok)
            return treeResult;
        const doc = new Document(json, normalized.fsPath, resolvedKind, treeResult.rootTree);
        doc.rebuildFlatIndex(treeResult._flatIndex);
        return { ok: true, doc };
    }
    static create(rootName, kind = 'prefab') {
        const fileId = (0, id_utils_1.generateFileId)();
        const wrapper = {
            __type__: kind === 'scene' ? 'cc.SceneAsset' : 'cc.Prefab',
            _name: rootName,
            _objFlags: 0,
            data: { __id__: 1 },
        };
        // 节点模板：使用分离的 transform 字段（_lpos/_lrot/_lscale）
        const node = {
            __type__: 'cc.Node',
            _name: rootName,
            _objFlags: 0,
            __editorExtras__: {},
            _parent: null,
            _children: [],
            _active: true,
            _components: [],
            _prefab: { __id__: 2 },
            _lpos: { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 },
            _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 },
            _lscale: { __type__: 'cc.Vec3', x: 1, y: 1, z: 1 },
            _layer: LAYER_UI_2D,
            _euler: { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 },
            _id: '',
        };
        const prefabInfo = {
            __type__: 'cc.PrefabInfo',
            root: { __id__: 1 },
            asset: null,
            fileId,
            sync: false,
        };
        const json = [wrapper, node, prefabInfo];
        const treeResult = Document._buildTree(json);
        const doc = new Document(json, '', kind, treeResult.ok ? treeResult.rootTree : null);
        doc.rebuildFlatIndex(treeResult.ok ? treeResult._flatIndex : undefined);
        return { ok: true, doc };
    }
    // ===== Serialize =====
    serialize() {
        const compacted = Document._compact(this._json);
        return JSON.stringify(compacted, null, 2);
    }
    setPath(assetPath, kind) {
        this._path = assetPath;
        if (kind)
            this._kind = kind;
        this._dirty = false;
    }
    // ===== Query =====
    ctx() {
        if (!this._tree) {
            const treeResult = Document._buildTree(this._json);
            if (treeResult.ok) {
                this._tree = treeResult.rootTree;
                this.rebuildFlatIndex(treeResult._flatIndex);
            }
        }
        return {
            rootTree: this._tree,
            name: this._tree?.name || '',
            rootNodeUuid: this._tree?.nodeUuid || '',
            childCount: this._tree?.childCount || 0,
            capturedNodeCount: this._tree ? Document._countNodes(this._tree) : 0,
        };
    }
    detail(fileId) {
        const cleanId = fileId.startsWith('#') ? fileId.slice(1) : fileId;
        const found = this._findNodeInTree(this._tree, cleanId);
        if (!found)
            return null;
        return {
            nodeUuid: found.nodeUuid,
            name: found.name,
            path: found.path,
            active: found.active,
            childCount: found.childCount,
            children: found.children.map((c) => ({ name: c.name, nodeUuid: c.nodeUuid })),
            components: found.components,
        };
    }
    readProperty(rawRef, componentType, propertyName) {
        const fullType = normalizeComponentType(componentType);
        const resolved = this.resolveNodeRef(rawRef);
        if ('code' in resolved)
            return resolved;
        const nodeFound = resolved;
        const compRefs = nodeFound.nodeObj._components || [];
        let foundComp = null;
        for (const ref of compRefs) {
            const compIdx = ref.__id__;
            if (compIdx < 0 || compIdx >= this._json.length)
                continue;
            const compObj = this._json[compIdx];
            if (compObj && !compObj.__deleted__ && compObj.__type__ === fullType) {
                foundComp = compObj;
                break;
            }
        }
        if (!foundComp)
            return { ok: false, error: `Component not found: ${fullType}`, code: error_codes_2.ERR_DOC_COMPONENT_NOT_FOUND };
        if (propertyName) {
            const val = foundComp[propertyName] !== undefined
                ? foundComp[propertyName]
                : foundComp['_' + propertyName];
            return { ok: true, component: fullType, property: propertyName, value: val };
        }
        const allProps = {};
        for (const key of Object.keys(foundComp)) {
            if (!['__type__', 'node', '__prefab', '_rawProps', '_id', '_name', '_objFlags'].includes(key)) {
                allProps[key] = foundComp[key];
            }
        }
        return { ok: true, component: fullType, properties: allProps };
    }
    // ===== Find methods =====
    /** 惰性构建 PrefabInfo 索引（fileId → _json 数组下标），O(1) findNode */
    _ensurePrefabInfoIndex() {
        if (this._prefabInfoIndex !== null)
            return;
        this._prefabInfoIndex = new Map();
        for (let i = 0; i < this._json.length; i++) {
            const obj = this._json[i];
            if (obj && !obj.__deleted__ && obj.__type__ === 'cc.PrefabInfo' && obj.fileId) {
                this._prefabInfoIndex.set(obj.fileId, i);
            }
        }
    }
    /** _json 变异后使索引失效（惰性重建） */
    _invalidateCaches() {
        this._prefabInfoIndex = null;
        this._compToCpiIndex = null;
    }
    findNode(fileId) {
        this._ensurePrefabInfoIndex();
        // 1. 按 PrefabInfo.fileId 精确匹配（O(1) via _prefabInfoIndex）
        const piIdx = this._prefabInfoIndex.get(fileId);
        if (piIdx !== undefined) {
            for (let j = 0; j < this._json.length; j++) {
                const nodeObj = this._json[j];
                if (nodeObj && !nodeObj.__deleted__ && _isNodeOrScene(nodeObj.__type__) && nodeObj._prefab?.__id__ === piIdx) {
                    return { nodeObj, nodeIndex: j, prefabInfo: this._json[piIdx], prefabInfoIndex: piIdx };
                }
            }
        }
        // 2. Fallback: fileId 是 PrefabInfo 数组索引（当原始数据无 fileId 时 _buildTree 以此回退）
        //    排除 "0" — index 0 永远是 wrapper/Prefab 容器，不可能是节点
        if (fileId !== '0') {
            const idx = parseInt(fileId, 10);
            if (!isNaN(idx) && idx > 0 && idx < this._json.length) {
                const obj = this._json[idx];
                if (obj && !obj.__deleted__ && obj.__type__ === 'cc.PrefabInfo') {
                    for (let j = 0; j < this._json.length; j++) {
                        const nodeObj = this._json[j];
                        if (nodeObj && !nodeObj.__deleted__ && _isNodeOrScene(nodeObj.__type__) && nodeObj._prefab?.__id__ === idx) {
                            return { nodeObj, nodeIndex: j, prefabInfo: obj, prefabInfoIndex: idx };
                        }
                    }
                }
            }
        }
        return null;
    }
    /** 惰性构建 CompPrefabInfo → Component 反向索引 */
    _ensureCompToCpiIndex() {
        if (this._compToCpiIndex !== null)
            return;
        this._compToCpiIndex = new Map();
        for (let j = 0; j < this._json.length; j++) {
            const compObj = this._json[j];
            if (compObj && !compObj.__deleted__) {
                const cpiRef = compObj.__prefab;
                if (cpiRef?.__id__ != null) {
                    this._compToCpiIndex.set(cpiRef.__id__, j);
                }
            }
        }
    }
    findComponent(fileId) {
        this._ensureCompToCpiIndex();
        // 先找到 CompPrefabInfo（线性扫描，fileId 匹配通常仅一次调用）
        for (let i = 0; i < this._json.length; i++) {
            const obj = this._json[i];
            if (obj && !obj.__deleted__ && obj.__type__ === 'cc.CompPrefabInfo' && obj.fileId === fileId) {
                // O(1) 反向查 Component
                const compIdx = this._compToCpiIndex.get(i);
                if (compIdx !== undefined) {
                    const compObj = this._json[compIdx];
                    if (compObj && !compObj.__deleted__) {
                        return { compObj, compIndex: compIdx, compPrefabInfo: obj, compPrefabInfoIndex: i, fileId: obj.fileId || '' };
                    }
                }
                return null;
            }
        }
        return null;
    }
    findComponentByType(nodeFileId, componentType) {
        const nodeFound = this.findNode(nodeFileId);
        if (!nodeFound)
            return null;
        const fullType = normalizeComponentType(componentType);
        const compRefs = nodeFound.nodeObj._components || [];
        for (const ref of compRefs) {
            const compIdx = ref.__id__;
            if (compIdx < 0 || compIdx >= this._json.length)
                continue;
            const compObj = this._json[compIdx];
            if (compObj && !compObj.__deleted__ && compObj.__type__ === fullType) {
                const cpiRef = compObj.__prefab;
                const cpiIdx = cpiRef?.__id__ != null ? cpiRef.__id__ : -1;
                const cpi = cpiIdx >= 0 ? this._json[cpiIdx] : null;
                const cpiFileId = (cpi && cpi.fileId) || '';
                return { compObj, compIndex: compIdx, compPrefabInfo: cpi || {}, compPrefabInfoIndex: cpiIdx, fileId: cpiFileId };
            }
        }
        return null;
    }
    /** 统一节点引用解析入口。
     *  接受 #fileId / 路径 / 模糊名，返回 FindNodeResult 或错误。
     *  edit() 和 readProperty() 在处理前调用此方法。 */
    resolveNodeRef(ref) {
        if (!ref)
            return { ok: false, error: 'Missing node reference', code: error_codes_2.ERR_DOC_NODE_NOT_FOUND };
        const trimmed = ref.trim().replace(/^#+/, '');
        if (!trimmed)
            return { ok: false, error: 'Missing node reference', code: error_codes_2.ERR_DOC_NODE_NOT_FOUND };
        // 1. fileId（22-23 字符 base64url）
        if (/^[a-zA-Z0-9_\-+/]{22,23}$/.test(trimmed)) {
            const found = this.findNode(trimmed);
            if (found)
                return found;
            return { ok: false, error: `Node not found: ${trimmed}. Probe first: >probe(find-in-doc, name=X)`, code: error_codes_2.ERR_DOC_NODE_NOT_FOUND };
        }
        // 2. /Path/To/Node — 精确路径匹配
        if (trimmed.startsWith('/') || trimmed.includes('/')) {
            const path = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
            for (const entry of this._nodeFlatIndex) {
                if (entry.path === path) {
                    return this.findNode(entry.fileId) || { ok: false, error: `Node not found: ${trimmed}`, code: error_codes_2.ERR_DOC_NODE_NOT_FOUND };
                }
            }
            return { ok: false, error: `Node not found at path: ${trimmed}. Try >probe(find-in-doc, name=...) or use fileId.`, code: error_codes_2.ERR_DOC_NODE_NOT_FOUND };
        }
        // 3. 模糊名 — 精确匹配优先，回退 substring，再回退 Levenshtein
        const matches = this._fuzzyMatchNames(trimmed);
        if (matches.length === 1) {
            return this.findNode(matches[0].fileId) || { ok: false, error: `Node not found: ${trimmed}`, code: error_codes_2.ERR_DOC_NODE_NOT_FOUND };
        }
        if (matches.length > 1) {
            return {
                ok: false,
                error: `Ambiguous name '${trimmed}': ${matches.length} matches. Use fileId or full path.`,
                code: error_codes_2.ERR_DOC_AMBIGUOUS_NODE,
                matches: matches.map((m) => ({ name: m.name, path: '/' + m.path, fileId: m.fileId })),
            };
        }
        return { ok: false, error: `Node not found: ${trimmed}. Try >probe(find-in-doc, name=${trimmed}) first, then use the returned fileId.`, code: error_codes_2.ERR_DOC_NODE_NOT_FOUND };
    }
    /** 模糊名搜索（供 >probe(find-in-doc) 使用） */
    findNodesByFuzzyName(query, maxResults = 10) {
        return this._fuzzyMatchNames(query, maxResults).map((m) => ({
            name: m.name,
            path: '/' + m.path,
            fileId: m.fileId,
            childCount: m.childCount,
            compTypes: m.compTypes,
        }));
    }
    /** 模糊名匹配引擎 */
    _fuzzyMatchNames(query, max = 20) {
        if (!query)
            return [];
        const lower = query.toLowerCase();
        const exacts = [];
        const subs = [];
        const fuzzy = [];
        for (const entry of this._nodeFlatIndex) {
            const nl = entry.name.toLowerCase();
            if (nl === lower) {
                exacts.push(entry);
            }
            else if (nl.includes(lower)) {
                subs.push(entry);
            }
        }
        // 无截断名匹配时走 Levenshtein
        if (exacts.length === 0 && subs.length === 0) {
            for (const entry of this._nodeFlatIndex) {
                if (levenshtein(lower, entry.name.toLowerCase(), 2) <= 2) {
                    fuzzy.push(entry);
                }
            }
        }
        // 精确 > substring > fuzzy，各段按 childCount 降序（更大的树更可能是目标）
        const sortFn = (a, b) => b.childCount - a.childCount;
        exacts.sort(sortFn);
        subs.sort(sortFn);
        fuzzy.sort(sortFn);
        const combined = [...exacts, ...subs, ...fuzzy];
        if (combined.length > max) {
            process.stderr.write(`[comdr] document fuzzy search truncated: ${combined.length} → ${max} results for "${query}"\n`);
        }
        const result = combined.slice(0, max);
        return result.map((e) => ({ name: e.name, fileId: e.fileId, path: e.path, childCount: e.childCount, compTypes: e.compTypes }));
    }
    /** 从 TreeNode 重建扁平名索引
     *  @param prebuilt _buildTree 返回的预收集数据，传入则跳过独立遍历 */
    rebuildFlatIndex(prebuilt) {
        if (prebuilt) {
            this._nodeFlatIndex = prebuilt;
            return;
        }
        // 回退：独立树遍历（_buildTree 未提供预收集数据时）
        const index = [];
        const walk = (node) => {
            index.push({
                name: node.name,
                fileId: node.nodeUuid,
                path: node.path || node.name,
                compTypes: (node.components || []).map((c) => c.type),
                childCount: node.childCount,
            });
            for (const child of node.children)
                walk(child);
        };
        if (this._tree)
            walk(this._tree);
        this._nodeFlatIndex = index;
    }
    // ===== Edit (with snapshot + rollback) =====
    edit(editType, payload) {
        this._snapshot = JSON.parse(JSON.stringify(this._json));
        let result;
        try {
            // 统一解析 node 引用（支持 #fileId / 路径 / 模糊名）
            const rawNodeRef = (payload.nodeUuid || payload.node);
            if (rawNodeRef) {
                const resolved = this.resolveNodeRef(rawNodeRef);
                if ('code' in resolved)
                    return resolved; // 解析失败，直接返回错误
                payload = { ...payload, nodeUuid: resolved.prefabInfo.fileId };
            }
            // reparent / add-node-tree 的 parent 引用也需要解析
            const rawParentRef = payload.parent;
            if (rawParentRef && (editType === exports.EditType.REPARENT || editType === exports.EditType.ADD_NODE_TREE)) {
                const resolvedParent = this.resolveNodeRef(rawParentRef);
                if ('code' in resolvedParent)
                    return resolvedParent;
                payload = { ...payload, parent: resolvedParent.prefabInfo.fileId };
            }
            switch (editType) {
                case exports.EditType.ADD_COMPONENT:
                    result = this._addComponent((payload.nodeUuid || payload.node), (payload.component || payload.type), (payload.props || {}));
                    break;
                case exports.EditType.SET_PROP:
                    result = this._setProperty((payload.nodeUuid || payload.node), payload.component, payload.property, payload.value);
                    break;
                case exports.EditType.SET_PROPS:
                    result = this._setProperties((payload.nodeUuid || payload.node), payload.component, (payload.props || payload.properties || {}));
                    break;
                case exports.EditType.DELETE_NODE:
                    result = this._deleteNode((payload.nodeUuid || payload.node));
                    break;
                case exports.EditType.REPARENT:
                    result = this._reparentNode((payload.nodeUuid || payload.node), payload.parent);
                    break;
                case exports.EditType.DUPLICATE:
                    result = this._duplicateNode((payload.nodeUuid || payload.node), payload.name);
                    break;
                case exports.EditType.SET_ACTIVE:
                    result = this._setNodeActive((payload.nodeUuid || payload.node), payload.active);
                    break;
                case exports.EditType.ADD_NODE_TREE:
                    result = this._addNodeTree((payload.parent || payload.nodeUuid || payload.node), payload.subtree, (payload.idMap || {}));
                    break;
                default:
                    return { ok: false, error: `Unknown edit type: ${editType}`, code: error_codes_2.ERR_DOC_INVALID_EDIT_TYPE };
            }
            if (result.ok) {
                const treeResult = Document._buildTree(this._json);
                if (treeResult.ok) {
                    this._tree = treeResult.rootTree;
                    this.rebuildFlatIndex(treeResult._flatIndex);
                    this._dirty = true;
                    this._invalidateCaches();
                    this._undoStack.push(this._snapshot);
                    if (this._undoStack.length > this._maxUndo)
                        this._undoStack.shift();
                    this._snapshot = null;
                    if (treeResult._unreachable && treeResult._unreachable > 0) {
                        result._warning = `${treeResult._unreachable} unreachable objects detected in JSON array`;
                    }
                    // 墓碑超过阈值时自动压缩
                    const tombstoneCount = this._json.filter((o) => o?.__deleted__).length;
                    if (tombstoneCount > TOMBSTONE_COMPACT_THRESHOLD) {
                        const oldJson = this._json;
                        this._json = Document._compact(this._json);
                        const compactTree = Document._buildTree(this._json);
                        if (compactTree.ok) {
                            this._tree = compactTree.rootTree;
                            this.rebuildFlatIndex(compactTree._flatIndex);
                        }
                        else {
                            this._json = oldJson; // tree 重建失败，回滚
                        }
                    }
                }
                else {
                    this._rollback();
                    return { ok: false, error: `Tree rebuild failed: ${treeResult.error}`, code: error_codes_2.ERR_DOC_TREE_REBUILD_ERROR };
                }
            }
            else {
                this._rollback();
            }
            return result;
        }
        catch (e) {
            this._rollback();
            return { ok: false, error: e.message, code: error_codes_2.ERR_DOC_EDIT_ERROR };
        }
    }
    save() {
        if (!this._json)
            return { ok: false, error: error_codes_1.MSG_NO_DOCUMENT_OPEN };
        const targetPath = this._dbUrl || this._path;
        if (!targetPath)
            return { ok: false, error: 'No path set — use setPath() or open an existing asset first' };
        const content = this.serialize();
        fs.writeFileSync(targetPath, content, 'utf8');
        this._dirty = false;
        this._snapshot = null;
        this._undoStack = [];
        return { ok: true, path: this._dbUrl || this._path };
    }
    // ===== Undo =====
    undo() {
        if (this._undoStack.length === 0) {
            return { ok: false, error: 'Nothing to undo' };
        }
        const snapshot = this._undoStack.pop();
        this._json = snapshot;
        const treeResult = Document._buildTree(this._json);
        if (!treeResult.ok) {
            return { ok: false, error: `Undo tree rebuild failed: ${treeResult.error}` };
        }
        this._tree = treeResult.rootTree;
        this.rebuildFlatIndex(treeResult._flatIndex);
        this._invalidateCaches();
        this._dirty = true;
        return { ok: true };
    }
    // ===== Private: rollback =====
    get _dbUrl() { return this._path; }
    _rollback() {
        if (this._snapshot) {
            this._json = this._snapshot;
            this._snapshot = null;
            // 恢复 tree 和索引到 snapshot 对应的状态
            const treeResult = Document._buildTree(this._json);
            if (treeResult.ok) {
                this._tree = treeResult.rootTree;
                this.rebuildFlatIndex(treeResult._flatIndex);
                this._invalidateCaches();
            }
        }
    }
    // ===== Private: edit implementations =====
    _addComponent(nodeFileId, componentType, props) {
        const found = this.findNode(nodeFileId);
        if (!found)
            return { ok: false, error: `Node not found: ${nodeFileId}`, code: error_codes_2.ERR_DOC_NODE_NOT_FOUND };
        const fullType = normalizeComponentType(componentType);
        // 检查重复：Cocos 节点不允许同类型组件出现多次
        const existingComps = found.nodeObj._components || [];
        for (const ref of existingComps) {
            const comp = this._json[ref.__id__];
            if (comp && !comp.__deleted__ && comp.__type__ === fullType) {
                return { ok: false, error: `Component ${fullType} already exists on this node`, code: error_codes_2.ERR_DOC_DUPLICATE_COMPONENT };
            }
        }
        const template = getComponentTemplate(fullType);
        if (!template)
            return { ok: false, error: `Unknown component: ${fullType}`, code: error_codes_2.ERR_DOC_UNKNOWN_COMPONENT };
        const compObj = JSON.parse(JSON.stringify(template));
        for (const key of Object.keys(props)) {
            Document._applyProp(compObj, key, props[key]);
        }
        const newFileId = (0, id_utils_1.generateFileId)();
        const compPrefabInfo = {
            __type__: 'cc.CompPrefabInfo',
            fileId: newFileId,
        };
        const compIndex = this._json.length;
        this._json.push(compObj);
        const cpiIndex = this._json.length;
        this._json.push(compPrefabInfo);
        compObj.node = { __id__: found.nodeIndex };
        compObj.__prefab = { __id__: cpiIndex };
        if (!found.nodeObj._components)
            found.nodeObj._components = [];
        found.nodeObj._components.push({ __id__: compIndex });
        return { ok: true, compFileId: newFileId, compIndex };
    }
    /** 将 Gateway 组装的子树追加到已有文档末尾。
     *  subtree 带 local __id__，本方法做 offset+remap，
     *  与 _duplicateNode 共享 _remapObjRefs 核心逻辑。 */
    _addNodeTree(parentFileId, subtree, idMap) {
        const parentFound = this.findNode(parentFileId);
        if (!parentFound)
            return { ok: false, error: `Parent not found: ${parentFileId}`, code: error_codes_2.ERR_DOC_NODE_NOT_FOUND };
        if (!Array.isArray(subtree) || subtree.length === 0) {
            return { ok: false, error: 'Empty subtree', code: error_codes_2.ERR_DOC_INVALID_FORMAT };
        }
        // 1. 计算 offset 并构建 localId → offsetId 映射
        const offset = this._json.length;
        const localToOffset = {};
        // 同时找出 root node（local __id__ 最小的 cc.Node）
        let rootLocalId = Infinity;
        for (let i = 0; i < subtree.length; i++) {
            const obj = subtree[i];
            if (obj && obj.__type__) {
                const lid = obj.__id__;
                if (lid !== undefined) {
                    localToOffset[lid] = offset + i;
                    if (NODE_LIKE_TYPES.has(obj.__type__) && lid < rootLocalId) {
                        rootLocalId = lid;
                    }
                }
            }
        }
        if (!isFinite(rootLocalId)) {
            return { ok: false, error: 'Subtree has no root Node', code: error_codes_2.ERR_DOC_INVALID_FORMAT };
        }
        // 2. Offset 所有 __id__ 引用后 append
        // 诊断：dump 收到的 subtree（排查 Gateway→Bridge 传输问题）
        try {
            const fs = require('fs');
            const p = require('path');
            fs.writeFileSync(p.join(__dirname, '..', 'addnode-debug.json'), JSON.stringify({
                offset, localToOffset,
                subtreeLen: subtree.length,
                types: subtree.map((o) => ({ t: o.__type__, id: o.__id__, n: o._name })),
            }, null, 2), 'utf8');
        }
        catch (_) { /* best-effort */ }
        for (const obj of subtree) {
            Document._remapObjRefs(obj, localToOffset);
            this._json.push(JSON.parse(JSON.stringify(obj)));
        }
        // 3. 所有新 PrefabInfo.asset 指向已有 document wrapper（index 0）
        //    同时清理 typed object 的 __id__（否则 _compact 序列化时会替换为 marker）
        for (let i = offset; i < this._json.length; i++) {
            const obj = this._json[i];
            if (!obj || obj.__deleted__)
                continue;
            if (obj.__type__ === 'cc.PrefabInfo' && !obj.asset) {
                obj.asset = { __id__: 0 };
            }
            if (obj.__type__)
                delete obj.__id__;
        }
        // 4. 链接 parent ↔ root
        const rootOffsetId = localToOffset[rootLocalId];
        const rootNode = this._json[rootOffsetId];
        if (!parentFound.nodeObj._children)
            parentFound.nodeObj._children = [];
        parentFound.nodeObj._children.push({ __id__: rootOffsetId });
        rootNode._parent = { __id__: parentFound.nodeIndex };
        // 5. 收集 tempId → fileId 映射
        const mappings = {};
        for (const [tempId, localId] of Object.entries(idMap)) {
            const offsetId = localToOffset[localId];
            if (offsetId !== undefined) {
                const node = this._json[offsetId];
                if (node && NODE_LIKE_TYPES.has(node.__type__)) {
                    const prefabRef = node._prefab;
                    if (prefabRef?.__id__ != null) {
                        const pi = this._json[prefabRef.__id__];
                        if (pi?.fileId)
                            mappings[tempId] = pi.fileId;
                    }
                }
            }
        }
        // 6. 重建树
        const treeResult = Document._buildTree(this._json);
        if (treeResult.ok) {
            this._tree = treeResult.rootTree;
            this._dirty = true;
        }
        const rootPrefabRef = rootNode._prefab;
        const rootPi = rootPrefabRef?.__id__ != null ? this._json[rootPrefabRef.__id__] : null;
        const nodeFileId = (rootPi?.fileId) || '';
        return { ok: true, nodeFileId, nodeIndex: rootOffsetId, mappings };
    }
    /** 将 prop 值中的 fileId 字符串（22-23 char base64url）解析为 {__id__:N} */
    _resolvePropValue(value) {
        // DIAG: 记录每次调用（入口）
        const diagEntry = { inputValue: value };
        if (typeof value !== 'string') {
            diagEntry.passThrough = 'non-string';
            _appendResolveDiag(diagEntry);
            return value;
        }
        const fileId = value.startsWith('#') ? value.slice(1) : value;
        diagEntry.fileId = fileId;
        if (!/^[a-zA-Z0-9_\-+/]{22,23}$/.test(fileId)) {
            diagEntry.passThrough = 'no-fileid-match';
            _appendResolveDiag(diagEntry);
            return value;
        }
        const comp = this.findComponent(fileId);
        if (comp) {
            diagEntry.resolved = { __id__: comp.compIndex, via: 'component' };
            _appendResolveDiag(diagEntry);
            return { __id__: comp.compIndex };
        }
        const node = this.findNode(fileId);
        if (node) {
            diagEntry.resolved = { __id__: node.nodeIndex, via: 'node' };
            _appendResolveDiag(diagEntry);
            return { __id__: node.nodeIndex };
        }
        // NOT FOUND — write diag
        diagEntry.resolved = 'NOT_FOUND';
        _appendResolveDiag(diagEntry);
        try {
            const fs = require('fs');
            const p = require('path');
            fs.writeFileSync(p.join(__dirname, '..', 'resolve-diag.json'), JSON.stringify({
                inputValue: value, fileId, compFound: !!comp, nodeFound: !!node,
            }, null, 2), 'utf8');
        }
        catch (_) { /* */ }
        return value;
    }
    _setProperty(nodeFileId, componentType, property, value) {
        const resolvedValue = this._resolvePropValue(value);
        // cc.Node / 空 → 直接改节点级属性（如 _name, _active, _layer）
        if (!componentType || NODE_LIKE_TYPES.has(componentType)) {
            const nodeFound = this.findNode(nodeFileId);
            if (!nodeFound)
                return { ok: false, error: `Node not found: ${nodeFileId}`, code: error_codes_2.ERR_DOC_NODE_NOT_FOUND };
            Document._applyProp(nodeFound.nodeObj, property, resolvedValue);
            return { ok: true };
        }
        const found = this.findComponentByType(nodeFileId, componentType);
        if (!found)
            return { ok: false, error: `Component not found: ${componentType}`, code: error_codes_2.ERR_DOC_COMPONENT_NOT_FOUND };
        Document._applyProp(found.compObj, property, resolvedValue);
        return { ok: true };
    }
    _setProperties(nodeFileId, componentType, props) {
        const resolved = {};
        for (const [key, value] of Object.entries(props)) {
            resolved[key] = this._resolvePropValue(value);
        }
        if (!componentType || NODE_LIKE_TYPES.has(componentType)) {
            const nodeFound = this.findNode(nodeFileId);
            if (!nodeFound) {
                _flushSetPropsDiag({ stage: 'node-not-found', nodeFileId, componentType, props: resolved });
                return { ok: false, error: `Node not found: ${nodeFileId}`, code: error_codes_2.ERR_DOC_NODE_NOT_FOUND };
            }
            for (const key of Object.keys(resolved)) {
                Document._applyProp(nodeFound.nodeObj, key, resolved[key]);
            }
            return { ok: true };
        }
        const found = this.findComponentByType(nodeFileId, componentType);
        if (!found) {
            // DIAG: 列出节点上实际存在的组件类型，辅助排查
            const nodeFound = this.findNode(nodeFileId);
            const actualTypes = [];
            if (nodeFound) {
                for (const ref of (nodeFound.nodeObj._components || [])) {
                    const c = this._json[ref.__id__];
                    if (c && !c.__deleted__)
                        actualTypes.push(c.__type__ || '?');
                }
            }
            _flushSetPropsDiag({
                stage: 'comp-not-found',
                nodeFileId,
                componentType,
                actualTypesOnNode: actualTypes,
                props: resolved,
            });
            return { ok: false, error: `Component not found: ${componentType}`, code: error_codes_2.ERR_DOC_COMPONENT_NOT_FOUND };
        }
        // DIAG: 写入前快照 — 目标 key 的已有值
        const beforeSnap = {};
        const compRec = found.compObj;
        for (const key of Object.keys(resolved)) {
            const uKey = key.startsWith('_') ? key : '_' + key;
            beforeSnap[key] = uKey in compRec ? compRec[uKey] : (key in compRec ? compRec[key] : '<missing>');
        }
        for (const key of Object.keys(resolved)) {
            Document._applyProp(found.compObj, key, resolved[key]);
        }
        // DIAG: 写入后快照
        const afterSnap = {};
        for (const key of Object.keys(resolved)) {
            const uKey = key.startsWith('_') ? key : '_' + key;
            afterSnap[key] = uKey in compRec ? compRec[uKey] : (key in compRec ? compRec[key] : '<missing>');
        }
        _flushSetPropsDiag({
            stage: 'applied',
            nodeFileId,
            componentType: found.compObj.__type__,
            componentTypeQueried: componentType,
            compIndex: found.compIndex,
            beforeSnap,
            afterSnap,
            resolved,
            rawProps: props,
            allCompKeys: Object.keys(found.compObj).filter(k => !k.startsWith('__')),
        });
        return { ok: true };
    }
    _deleteNode(nodeFileId) {
        const found = this.findNode(nodeFileId);
        if (!found)
            return { ok: false, error: `Node not found: ${nodeFileId}`, code: error_codes_2.ERR_DOC_NODE_NOT_FOUND };
        const toTombstone = [];
        Document._collectSubtree(this._json, found.nodeIndex, toTombstone);
        for (const idx of toTombstone) {
            if (idx >= 0 && idx < this._json.length && this._json[idx]) {
                this._json[idx].__deleted__ = true;
            }
        }
        // Remove from all parents' _children
        for (const obj of this._json) {
            if (obj && !obj.__deleted__ && NODE_LIKE_TYPES.has(obj.__type__) && obj._children) {
                obj._children = obj._children.filter((ref) => ref.__id__ !== found.nodeIndex);
            }
        }
        // 清理所有存活对象中对已删除节点的 __id__ 引用
        const tombstoneSet = new Set(toTombstone);
        this._nullifyDeletedRefs(tombstoneSet);
        return { ok: true };
    }
    _reparentNode(nodeFileId, newParentFileId) {
        const nodeFound = this.findNode(nodeFileId);
        if (!nodeFound)
            return { ok: false, error: `Node not found: ${nodeFileId}`, code: error_codes_2.ERR_DOC_NODE_NOT_FOUND };
        // Remove from old parent
        for (const obj of this._json) {
            if (obj && !obj.__deleted__ && NODE_LIKE_TYPES.has(obj.__type__) && obj._children) {
                obj._children = obj._children.filter((ref) => ref.__id__ !== nodeFound.nodeIndex);
            }
        }
        // Make root
        if (newParentFileId === null || newParentFileId === 'null' || newParentFileId === undefined) {
            nodeFound.nodeObj._parent = null;
            return { ok: true };
        }
        // 防止自引用循环
        if (newParentFileId === nodeFileId) {
            return { ok: false, error: 'Cannot reparent a node to itself', code: error_codes_2.ERR_DOC_CYCLE_DETECTED };
        }
        const parentFound = this.findNode(newParentFileId);
        if (!parentFound)
            return { ok: false, error: `Parent not found: ${newParentFileId}`, code: error_codes_2.ERR_DOC_NODE_NOT_FOUND };
        if (!parentFound.nodeObj._children)
            parentFound.nodeObj._children = [];
        parentFound.nodeObj._children.push({ __id__: nodeFound.nodeIndex });
        nodeFound.nodeObj._parent = { __id__: parentFound.nodeIndex };
        return { ok: true };
    }
    _duplicateNode(nodeFileId, newName) {
        const found = this.findNode(nodeFileId);
        if (!found)
            return { ok: false, error: `Node not found: ${nodeFileId}`, code: error_codes_2.ERR_DOC_NODE_NOT_FOUND };
        const indexMap = {};
        const self = this;
        function cloneObject(oldIdx) {
            if (indexMap[oldIdx] !== undefined)
                return indexMap[oldIdx];
            const src = self._json[oldIdx];
            if (!src || src.__deleted__)
                return -1;
            const cloned = JSON.parse(JSON.stringify(src));
            const newIdx = self._json.length;
            self._json.push(cloned);
            indexMap[oldIdx] = newIdx;
            if (cloned.__type__ === 'cc.PrefabInfo' || cloned.__type__ === 'cc.CompPrefabInfo') {
                cloned.fileId = (0, id_utils_1.generateFileId)();
            }
            if (NODE_LIKE_TYPES.has(cloned.__type__) && newName) {
                cloned._name = newName;
            }
            return newIdx;
        }
        function cloneSubtree(nodeIdx) {
            const newNodeIdx = cloneObject(nodeIdx);
            if (newNodeIdx < 0)
                return -1;
            const nodeObj = self._json[nodeIdx];
            // Clone components
            const newCompRefs = [];
            for (const ref of nodeObj._components || []) {
                const compIdx = ref.__id__;
                if (compIdx < 0 || compIdx >= self._json.length)
                    continue;
                if (self._json[compIdx]?.__deleted__)
                    continue;
                const newCompIdx = cloneObject(compIdx);
                if (newCompIdx >= 0) {
                    newCompRefs.push({ __id__: newCompIdx });
                    const compObj = self._json[compIdx];
                    if (compObj?.__prefab) {
                        const cpiRef = compObj.__prefab;
                        if (cpiRef.__id__ != null) {
                            const newCpiIdx = cloneObject(cpiRef.__id__);
                            self._json[newCompIdx].__prefab = { __id__: newCpiIdx };
                        }
                    }
                    self._json[newCompIdx].node = { __id__: newNodeIdx };
                }
            }
            self._json[newNodeIdx]._components = newCompRefs;
            // Clone PrefabInfo
            const prefabRef = nodeObj._prefab;
            if (prefabRef?.__id__ != null) {
                const newPiIdx = cloneObject(prefabRef.__id__);
                self._json[newNodeIdx]._prefab = { __id__: newPiIdx };
            }
            // Clone children
            const newChildRefs = [];
            for (const ref of nodeObj._children || []) {
                const childIdx = ref.__id__;
                if (childIdx < 0 || childIdx >= self._json.length)
                    continue;
                if (self._json[childIdx]?.__deleted__)
                    continue;
                const newChildIdx = cloneSubtree(childIdx);
                if (newChildIdx >= 0) {
                    newChildRefs.push({ __id__: newChildIdx });
                    self._json[newChildIdx]._parent = { __id__: newNodeIdx };
                }
            }
            self._json[newNodeIdx]._children = newChildRefs;
            return newNodeIdx;
        }
        const newNodeIdx = cloneSubtree(found.nodeIndex);
        if (newNodeIdx < 0)
            return { ok: false, error: 'Failed to clone node' };
        // Remap cloned internal __id__ refs
        Document._remapRefs(this._json, indexMap);
        // Add to same parent
        const parentRef = found.nodeObj._parent;
        if (parentRef?.__id__ != null) {
            const parentObj = this._json[parentRef.__id__];
            if (parentObj?._children) {
                parentObj._children.push({ __id__: newNodeIdx });
            }
            this._json[newNodeIdx]._parent = { __id__: parentRef.__id__ };
        }
        const newPrefabInfoRef = this._json[newNodeIdx]._prefab;
        const newPrefabInfo = newPrefabInfoRef ? this._json[newPrefabInfoRef.__id__] : null;
        const newFileId = (newPrefabInfo?.fileId) || '';
        return { ok: true, nodeFileId: newFileId, nodeIndex: newNodeIdx };
    }
    _setNodeActive(nodeFileId, active) {
        const found = this.findNode(nodeFileId);
        if (!found)
            return { ok: false, error: `Node not found: ${nodeFileId}`, code: error_codes_2.ERR_DOC_NODE_NOT_FOUND };
        found.nodeObj._active = !!active;
        return { ok: true };
    }
    /** 将所有存活对象中对已删除索引的 { __id__: N } 引用替换为 null */
    _nullifyDeletedRefs(tombstoneSet) {
        const nullify = (obj, visited) => {
            if (!obj || typeof obj !== 'object' || visited.has(obj))
                return;
            visited.add(obj);
            if (Array.isArray(obj)) {
                for (const item of obj)
                    nullify(item, visited);
                return;
            }
            const record = obj;
            for (const key of Object.keys(record)) {
                const val = record[key];
                if (val && typeof val === 'object' && !Array.isArray(val)) {
                    const cocosObj = val;
                    if (typeof cocosObj.__id__ === 'number' && tombstoneSet.has(cocosObj.__id__)) {
                        record[key] = null;
                    }
                    else {
                        nullify(val, visited);
                    }
                }
                else if (Array.isArray(val)) {
                    nullify(val, visited);
                }
            }
        };
        for (const obj of this._json) {
            if (!obj || obj.__deleted__)
                continue;
            nullify(obj, new Set());
        }
    }
    // ===== Private: tree navigation =====
    _findNodeInTree(treeNode, fileId) {
        if (!treeNode)
            return null;
        if (treeNode.nodeUuid === fileId)
            return treeNode;
        for (const child of treeNode.children) {
            const found = this._findNodeInTree(child, fileId);
            if (found)
                return found;
        }
        return null;
    }
    // ===== Private static: tree building =====
    static _buildTree(jsonArray) {
        if (!Array.isArray(jsonArray) || jsonArray.length < 2) {
            return { ok: false, error: 'Invalid prefab JSON: array too short', code: error_codes_2.ERR_DOC_INVALID_FORMAT };
        }
        const wrapper = jsonArray[0];
        if (!wrapper?.__type__) {
            return { ok: false, error: 'Invalid prefab: wrapper missing', code: error_codes_2.ERR_DOC_INVALID_FORMAT };
        }
        const wrapperData = (wrapper.data ?? wrapper.scene);
        const rootNodeId = wrapperData?.__id__ ?? 1;
        const rootNode = jsonArray[rootNodeId];
        if (!rootNode || rootNode.__deleted__ || !_isNodeOrScene(rootNode.__type__)) {
            return { ok: false, error: `Root node not found at index ${rootNodeId}`, code: error_codes_2.ERR_DOC_ROOT_NOT_FOUND };
        }
        const visited = {};
        // 顺带收集 flat name index：fileId → entry（_buildPaths 中 O(1) 回填 path）
        const flatByFileId = new Map();
        const visit = (nodeIdx, depth = 0) => {
            if (depth > MAX_TREE_DEPTH) {
                process.stderr.write(`[bridge] _buildTree exceeded max depth ${MAX_TREE_DEPTH} at node index ${nodeIdx} — possible data corruption\n`);
                return null;
            }
            if (visited[nodeIdx])
                return null;
            visited[nodeIdx] = true;
            const nodeObj = jsonArray[nodeIdx];
            if (!nodeObj || nodeObj.__deleted__ || !_isNodeOrScene(nodeObj.__type__))
                return null;
            const prefabInfoRef = nodeObj._prefab;
            const prefabInfo = prefabInfoRef?.__id__ != null ? jsonArray[prefabInfoRef.__id__] : null;
            // PrefabInfo.fileId > PrefabInfo 数组索引 > 生成 fileId（永不回退到 node_${idx} 不可解析 ID）
            const fileId = (prefabInfo?.fileId)
                || (prefabInfoRef?.__id__ != null ? String(prefabInfoRef.__id__) : undefined);
            // 当 JSON 中无 PrefabInfo 时生成一个 fileId 并回填，确保后续 findNode 可解析
            const resolvedFileId = fileId || (() => {
                const synthetic = (0, id_utils_1.generateFileId)();
                if (prefabInfoRef?.__id__ != null && jsonArray[prefabInfoRef.__id__]) {
                    jsonArray[prefabInfoRef.__id__].fileId = synthetic;
                }
                return synthetic;
            })();
            // Components
            const componentRefs = Array.isArray(nodeObj._components) ? nodeObj._components : [];
            const components = [];
            for (const compRef of componentRefs) {
                const compIdx = compRef?.__id__;
                if (compIdx == null || compIdx < 0 || compIdx >= jsonArray.length)
                    continue;
                const compObj = jsonArray[compIdx];
                if (compObj && !compObj.__deleted__ && compObj.__type__
                    && compObj.__type__ !== 'cc.PrefabInfo' && compObj.__type__ !== 'cc.CompPrefabInfo') {
                    const compPrefabRef = compObj.__prefab;
                    const cpi = compPrefabRef?.__id__ != null ? jsonArray[compPrefabRef.__id__] : null;
                    const compFileId = (cpi?.fileId) || `comp_${compIdx}`;
                    const props = {};
                    for (const key of Object.keys(compObj)) {
                        if (['__type__', 'node', '__prefab', '_rawProps', '_name', '_objFlags', '_id', '__deleted__'].includes(key))
                            continue;
                        props[key] = Document._safeProp(compObj[key]);
                    }
                    const compType = compObj.__type__;
                    if (!compType)
                        continue;
                    components.push({
                        componentUuid: compFileId,
                        type: compType,
                        enabled: compObj._enabled !== false,
                        properties: props,
                    });
                }
            }
            // Children
            const childRefs = Array.isArray(nodeObj._children) ? nodeObj._children : [];
            const children = [];
            for (const childRef of childRefs) {
                const childIdx = childRef?.__id__;
                if (childIdx == null || childIdx < 0 || childIdx >= jsonArray.length)
                    continue;
                const childTree = visit(childIdx, depth + 1);
                if (childTree)
                    children.push(childTree);
            }
            const treeNode = {
                nodeUuid: resolvedFileId,
                name: nodeObj._name || '',
                path: '',
                active: nodeObj._active !== false,
                childCount: children.length,
                children,
                components,
            };
            // 顺带收集 flat index 条目（_buildPaths 中 O(1) 回填真实 path）
            flatByFileId.set(resolvedFileId, {
                name: treeNode.name,
                fileId: resolvedFileId,
                path: treeNode.name, // _buildPaths 中回填
                compTypes: components.map((c) => c.type),
                childCount: children.length,
            });
            return treeNode;
        };
        const rootTree = visit(rootNodeId);
        if (!rootTree)
            return { ok: false, error: 'Failed to build root node tree', code: error_codes_2.ERR_DOC_TREE_BUILD_ERROR };
        // 统计不可达对象（未被 rootTree 遍历到的非基础类型对象）
        let unreachable = 0;
        for (let i = 0; i < jsonArray.length; i++) {
            const obj = jsonArray[i];
            if (obj && !obj.__deleted__ && obj.__type__ && obj.__type__ !== 'cc.PrefabInfo'
                && obj.__type__ !== 'cc.CompPrefabInfo' && !visited[i]) {
                unreachable++;
            }
        }
        Document._buildPaths(rootTree, '', flatByFileId);
        return { ok: true, rootTree, _unreachable: unreachable, _flatIndex: [...flatByFileId.values()] };
    }
    static _countNodes(tree) {
        let n = 1;
        for (const child of tree.children)
            n += Document._countNodes(child);
        return n;
    }
    static _buildPaths(node, parentPath, flatByFileId) {
        const p = parentPath ? `${parentPath}/${node.name}` : node.name;
        node.path = p;
        // O(1) 回填 flat index 路径（由 _buildTree 传入，避免 rebuildFlatIndex 独立遍历）
        if (flatByFileId) {
            const entry = flatByFileId.get(node.nodeUuid);
            if (entry)
                entry.path = p;
        }
        for (const child of node.children)
            Document._buildPaths(child, p, flatByFileId);
    }
    static _safeProp(val) {
        if (val === null || val === undefined)
            return null;
        if (typeof val === 'boolean' || typeof val === 'number' || typeof val === 'string')
            return val;
        if (Array.isArray(val))
            return val.map(Document._safeProp);
        if (typeof val === 'object') {
            const obj = val;
            if (obj.__id__ != null)
                return { __ref_id__: obj.__id__ };
            if (obj.__uuid__ != null)
                return { __ref_uuid__: obj.__uuid__ };
            try {
                return JSON.parse(JSON.stringify(val));
            }
            catch {
                return { _unserializable: true };
            }
        }
        return String(val);
    }
    // ===== Private static: tombstone compaction =====
    static _compact(jsonArray) {
        const alive = [];
        const indexMap = {};
        for (let i = 0; i < jsonArray.length; i++) {
            if (!jsonArray[i]?.__deleted__) {
                indexMap[i] = alive.length;
                alive.push(jsonArray[i]);
            }
            else {
                indexMap[i] = -1;
            }
        }
        // _remapIds 构造新对象（不修改入参），无需 JSON 往返拷贝
        return alive.map((obj) => Document._remapIds(obj, indexMap));
    }
    static _remapIds(obj, indexMap) {
        if (!obj || typeof obj !== 'object')
            return obj;
        if (Array.isArray(obj)) {
            return obj.map((item) => Document._remapIds(item, indexMap));
        }
        if (obj.__id__ != null && typeof obj.__id__ === 'number') {
            const newId = indexMap[obj.__id__];
            if (newId >= 0)
                return { __id__: newId };
            return null;
        }
        const result = {};
        for (const key of Object.keys(obj)) {
            if (key !== '__deleted__') {
                result[key] = Document._remapIds(obj[key], indexMap);
            }
        }
        return result;
    }
    // ===== Private static: subtree + prop helpers =====
    static _collectSubtree(jsonArray, nodeIdx, result) {
        if (nodeIdx < 0 || nodeIdx >= jsonArray.length)
            return;
        const nodeObj = jsonArray[nodeIdx];
        if (!nodeObj || nodeObj.__deleted__ || !_isNodeOrScene(nodeObj.__type__))
            return;
        result.push(nodeIdx);
        if (nodeObj._prefab?.__id__ != null) {
            result.push(nodeObj._prefab.__id__);
        }
        for (const ref of nodeObj._components || []) {
            const compIdx = ref.__id__;
            if (compIdx >= 0 && compIdx < jsonArray.length) {
                result.push(compIdx);
                const compObj = jsonArray[compIdx];
                const cpiRef = compObj?.__prefab;
                if (cpiRef?.__id__ != null)
                    result.push(cpiRef.__id__);
            }
        }
        for (const ref of nodeObj._children || []) {
            Document._collectSubtree(jsonArray, ref.__id__, result);
        }
    }
    static _applyProp(compObj, key, value) {
        const obj = compObj;
        const underscored = key.startsWith('_') ? key : '_' + key;
        if (underscored in obj) {
            obj[underscored] = Document._normalizeValue(obj[underscored], value);
        }
        else if (key in obj) {
            obj[key] = Document._normalizeValue(obj[key], value);
        }
        else {
            // 新属性：_normalizeValue 对 null/undefined existing 会直接返回 value
            obj[underscored] = Document._normalizeValue(undefined, value);
        }
    }
    static _normalizeValue(existing, value) {
        if (existing === null || existing === undefined)
            return value;
        if (typeof existing === 'boolean') {
            if (typeof value === 'boolean')
                return value;
            if (typeof value === 'string') {
                const lower = value.toLowerCase();
                if (lower === 'true' || lower === '1')
                    return true;
                if (lower === 'false' || lower === '0' || lower === '')
                    return false;
            }
            // 值对象带 Cocos 标记字段 → 类型迁移
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                const vObj = value;
                if (vObj.__uuid__ || vObj.__type__ || typeof vObj.__id__ === 'number')
                    return value;
            }
            return Boolean(value);
        }
        if (typeof existing === 'number') {
            const n = Number(value);
            return isNaN(n) ? existing : n;
        }
        if (typeof existing === 'string') {
            // 值对象带 Cocos 标记字段（资产引用 / 类型值 / 内部引用）→ 类型迁移，直接返回
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                const vObj = value;
                if (vObj.__uuid__ || vObj.__type__ || typeof vObj.__id__ === 'number') {
                    return value;
                }
            }
            if (value === null || value === undefined) {
                process.stderr.write(`[comdr] _normalizeValue: coercing ${value} to empty string for string-typed field\n`);
                return '';
            }
            return String(value);
        }
        // 识别 { __uuid__: ..., __expectedType__: ... } 资产引用对象
        if (typeof existing === 'object' && existing.__uuid__) {
            if (typeof value === 'string') {
                // 裸 UUID 字符串 → 更新 __uuid__ 字段，保留 __expectedType__
                const ex = existing;
                ex.__uuid__ = value;
                return existing;
            }
            if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
                const ex = existing;
                for (const k of Object.keys(value)) {
                    if (k in ex)
                        ex[k] = value[k];
                }
                return existing;
            }
            return existing;
        }
        if (typeof existing === 'object' && existing.__type__) {
            if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
                const ex = existing;
                for (const k of Object.keys(value)) {
                    if (k in ex)
                        ex[k] = value[k];
                }
            }
            return existing;
        }
        return value;
    }
    // ===== Private static: __id__ remap for clones =====
    static _remapRefs(jsonArray, indexMap) {
        for (const oldIdx of Object.keys(indexMap).map(Number)) {
            const newIdx = indexMap[oldIdx];
            if (newIdx < 0)
                continue;
            const obj = jsonArray[newIdx];
            if (!obj || obj.__type__ === 'cc.PrefabInfo' || obj.__type__ === 'cc.CompPrefabInfo')
                continue;
            Document._remapObjRefs(obj, indexMap);
        }
    }
    static _remapObjRefs(obj, indexMap) {
        if (!obj || typeof obj !== 'object')
            return;
        if (Array.isArray(obj)) {
            // 逐个元素处理：引用标记 ({__id__:N}) 直接 remap，复杂对象递归
            for (let i = 0; i < obj.length; i++) {
                const item = obj[i];
                if (item && typeof item === 'object' && !Array.isArray(item)) {
                    const itemObj = item;
                    if (itemObj.__id__ != null && typeof itemObj.__id__ === 'number') {
                        const mapped = indexMap[itemObj.__id__];
                        if (mapped !== undefined && mapped >= 0) {
                            obj[i] = { __id__: mapped };
                            continue;
                        }
                    }
                }
                Document._remapObjRefs(item, indexMap);
            }
            return;
        }
        const record = obj;
        for (const key of Object.keys(record)) {
            const val = record[key];
            if (val && typeof val === 'object') {
                if (Array.isArray(val)) {
                    Document._remapObjRefs(val, indexMap);
                }
                else {
                    const cocosObj = val;
                    if (cocosObj.__id__ != null && typeof cocosObj.__id__ === 'number') {
                        const mapped = indexMap[cocosObj.__id__];
                        if (mapped !== undefined && mapped >= 0)
                            record[key] = { __id__: mapped };
                    }
                    else {
                        Document._remapObjRefs(val, indexMap);
                    }
                }
            }
        }
    }
}
exports.Document = Document;
/** 模块级 Levenshtein 距离辅助（模糊名匹配用）。
 *  单行 DP + 长度预过滤 — O(min(m,n)) 空间，O(m×n) 时间。 */
function levenshtein(a, b, maxDist = Infinity) {
    if (Math.abs(a.length - b.length) > maxDist)
        return maxDist + 1;
    if (a.length > b.length) {
        const t = a;
        a = b;
        b = t;
    }
    const m = a.length, n = b.length;
    let prev = new Array(m + 1);
    let curr = new Array(m + 1);
    for (let i = 0; i <= m; i++)
        prev[i] = i;
    for (let j = 1; j <= n; j++) {
        curr[0] = j;
        let rowMin = j;
        for (let i = 1; i <= m; i++) {
            curr[i] = a[i - 1] === b[j - 1] ? prev[i - 1] : 1 + Math.min(prev[i], curr[i - 1], prev[i - 1]);
            if (curr[i] < rowMin)
                rowMin = curr[i];
        }
        if (rowMin > maxDist)
            return maxDist + 1;
        [prev, curr] = [curr, prev];
    }
    return prev[m];
}
//# sourceMappingURL=document.js.map