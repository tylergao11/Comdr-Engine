"use strict";
// ============================================================
// ComponentCatalog — 统一组件目录
// 合并旧 COMPONENT_REGISTRY + ScriptRegistry + KnowledgeBase
// 引擎组件和自定义脚本的查询接口完全一致
//
// 数据来源：
//   1. component-cache.json — 引擎组件 schema（Bridge 从引擎 TS 源码提取）
//   2. resource-index.json  — 用户脚本列表（Bridge 从编辑器提取）
//   3. component-knowledge.json — 组件结构约束和默认值（手写）
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
exports.ComponentCatalog = void 0;
exports.createRefResolver = createRefResolver;
const path = __importStar(require("path"));
const value_kit_1 = require("../foundation/value-kit");
const knowledge_data_1 = require("../knowledge/knowledge-data");
const cocos_world_1 = require("./cocos-world");
// ============================================================
// Catalog 实现
// ============================================================
class ComponentCatalog {
    /** 规范类型名 → 条目 */
    _entries = new Map();
    /** 类名 → 规范名（Sprite → cc.Sprite, testComdr → compressedUuid） */
    _nameIndex = new Map();
    /** 压缩 UUID → 规范名（反向查脚本） */
    _uuidIndex = new Map();
    _loaded = false;
    // ===== 加载 =====
    /** 一次性加载所有组件数据 */
    load(projectPath) {
        const root = (0, value_kit_1.normalizeSlash)(projectPath);
        const tempDir = path.join(root, 'temp', 'comdr');
        let count = 0;
        // 1. 加载引擎组件 schema（component-cache.json）
        const cachePath = path.join(tempDir, 'component-cache.json');
        const cacheData = (0, value_kit_1.readJsonUtf8)(cachePath);
        if (cacheData?.components) {
            for (const [typeName, comp] of Object.entries(cacheData.components)) {
                const fields = Object.entries(comp.properties).map(([name, prop]) => ({ name, type: prop.type, default: prop.default }));
                const identity = (0, cocos_world_1.parseComponentIdentity)(typeName);
                const template = (0, cocos_world_1.generateComponentTemplate)(typeName, fields);
                const entry = {
                    identity,
                    schema: fields,
                    knowledge: null, // 后面从 knowledge 文件合并
                    template,
                };
                this._entries.set(typeName, entry);
                this._nameIndex.set(typeName.toLowerCase().replace(/^cc\./, ''), typeName);
                this._nameIndex.set(typeName.toLowerCase(), typeName);
                count++;
            }
        }
        // 2. 加载用户脚本（resource-index.json）
        const resourcePath = path.join(tempDir, 'resource-index.json');
        const resourceData = (0, value_kit_1.readJsonUtf8)(resourcePath);
        if (resourceData?.scripts) {
            for (const s of resourceData.scripts) {
                if (!s.name || !s.compressedId)
                    continue;
                const identity = (0, cocos_world_1.parseComponentIdentity)(s.compressedId, () => s.name);
                // 脚本的 schema：只有属性名，类型都是 'any'
                const schema = (s.properties || []).map((p) => ({
                    name: p,
                    type: 'any',
                }));
                const template = (0, cocos_world_1.minimalComponentTemplate)(s.compressedId);
                const entry = {
                    identity,
                    schema,
                    knowledge: null,
                    template,
                };
                this._entries.set(s.compressedId, entry);
                // 防止脚本类名覆盖引擎组件：如脚本名为 "Sprite" 不应遮蔽 cc.Sprite
                const engineKey = s.name.toLowerCase();
                const engineConflict = this._nameIndex.get(engineKey);
                if (engineConflict && engineConflict.startsWith('cc.')) {
                    process.stderr.write(`[comdr] WARNING: Script "${s.name}" shadows engine component "${engineConflict}". Use compressed UUID or full class name to disambiguate.\n`);
                }
                else {
                    this._nameIndex.set(s.name, s.compressedId);
                    this._nameIndex.set(engineKey, s.compressedId);
                }
                this._uuidIndex.set(s.compressedId, s.compressedId);
                // path-based lookup (for compressed UUID lookup by path)
                if (s.path) {
                    this._nameIndex.set((0, value_kit_1.normalizeSlash)(s.path), s.compressedId);
                }
                count++;
            }
        }
        // 3. 加载组件知识库（编译时内嵌，运行时零文件依赖）
        const knowledgeData = (0, knowledge_data_1.getKnowledgeData)();
        if (knowledgeData && Object.keys(knowledgeData).length > 0) {
            for (const [typeName, k] of Object.entries(knowledgeData)) {
                const entry = this._entries.get(typeName);
                if (entry) {
                    entry.knowledge = k;
                    // 知识库的 defaults 合并到模板
                    if (k.defaults) {
                        for (const [key, value] of Object.entries(k.defaults)) {
                            const underscored = key.startsWith('_') ? key : '_' + key;
                            if (!(underscored in entry.template)) {
                                entry.template[underscored] = value;
                            }
                        }
                    }
                }
                else {
                    // knowledge 中提到了但 schema cache 中没有的组件：创建最小条目
                    const identity = (0, cocos_world_1.parseComponentIdentity)(typeName);
                    const entry = {
                        identity,
                        schema: [],
                        knowledge: k,
                        template: (0, cocos_world_1.minimalComponentTemplate)(typeName),
                    };
                    this._entries.set(typeName, entry);
                    this._nameIndex.set(typeName.toLowerCase().replace(/^cc\./, ''), typeName);
                    this._nameIndex.set(typeName.toLowerCase(), typeName);
                }
            }
        }
        this._loaded = true;
        return count;
    }
    /** 重新加载 */
    reload(projectPath) {
        this._entries.clear();
        this._nameIndex.clear();
        this._uuidIndex.clear();
        this._loaded = false;
        this.load(projectPath);
    }
    get isLoaded() {
        return this._loaded;
    }
    // ===== 查询 =====
    /** 获取单个组件条目（接受类名、cc.Xxx 全名、或压缩 UUID） */
    get(typeName) {
        // 直接命中
        if (this._entries.has(typeName)) {
            return this._entries.get(typeName);
        }
        // 通过 name index 查找
        const canonical = this._nameIndex.get(typeName)
            || this._nameIndex.get(typeName.toLowerCase())
            || this._uuidIndex.get(typeName);
        if (canonical) {
            return this._entries.get(canonical) || null;
        }
        return null;
    }
    /** 解析类型名为规范形式。
     *   "Sprite"      → "cc.Sprite"
     *   "cc.Sprite"   → "cc.Sprite"
     *   "testComdr"   → "a1b2c3d4..."（压缩 UUID）
     *   "a1b2c3d4..." → "a1b2c3d4..."（已是压缩 UUID，验证后返回） */
    resolve(typeName) {
        if (!typeName)
            return typeName;
        // 已是规范引擎组件名
        if (this._entries.has(typeName))
            return typeName;
        // 压缩 UUID → 验证
        if ((0, cocos_world_1.isCompressedUuidType)(typeName) && this._uuidIndex.has(typeName)) {
            return typeName;
        }
        // 类名/短名 → 查找
        const canonical = this._nameIndex.get(typeName)
            || this._nameIndex.get(typeName.toLowerCase())
            || (typeName.startsWith('cc.') ? null : this._nameIndex.get(`cc.${typeName}`));
        return canonical || typeName;
    }
    /** 获取组件身份 */
    identityOf(typeName) {
        const entry = this.get(typeName);
        return entry?.identity || null;
    }
    /** 获取属性 schema */
    schemaOf(typeName) {
        const entry = this.get(typeName);
        return entry?.schema || [];
    }
    /** 获取 JSON 模板 */
    templateOf(typeName) {
        const entry = this.get(typeName);
        return entry?.template || null;
    }
    /** 获取组件知识 */
    knowledgeOf(typeName) {
        const entry = this.get(typeName);
        return entry?.knowledge || null;
    }
    /** 通过压缩 UUID 查类名 */
    classNameOf(compressedId) {
        const entry = this._entries.get(compressedId);
        return entry?.identity.name || '';
    }
    /** 通过类名查压缩 UUID */
    compressedIdOf(className) {
        const canonical = this._nameIndex.get(className) || this._nameIndex.get(className.toLowerCase());
        if (canonical && (0, cocos_world_1.isCompressedUuidType)(canonical))
            return canonical;
        return '';
    }
    /** 列出所有组件类型名 */
    list() {
        return [...this._entries.keys()].sort();
    }
    /** 列出所有脚本组件 */
    listScripts() {
        return [...this._entries.values()].filter((e) => e.identity.isScript);
    }
    /** 列出所有引擎组件 */
    listEngine() {
        return [...this._entries.values()].filter((e) => !e.identity.isScript);
    }
    /** 模糊搜索组件 — 返回所有匹配项（按距离排序）。供 Gateway 判断歧义。 */
    fuzzyFindAll(pattern) {
        const lower = pattern.toLowerCase().replace(/^cc\./, '');
        const candidates = [...this._entries.keys()];
        // 精确匹配（不分大小写）
        const exact = candidates.find((t) => t.toLowerCase() === `cc.${lower}` || t.toLowerCase().replace('cc.', '') === lower);
        if (exact)
            return [exact];
        const viaIndex = this._nameIndex.get(lower) || this._nameIndex.get(`cc.${lower}`);
        if (viaIndex)
            return [viaIndex];
        // Levenshtein ≤ 2，按距离排序
        const matches = [];
        for (const t of candidates) {
            const bare = t.replace('cc.', '').toLowerCase();
            const dist = (0, value_kit_1.levenshtein)(lower, bare, 2);
            if (dist <= 2)
                matches.push({ type: t, dist });
        }
        matches.sort((a, b) => a.dist - b.dist);
        return matches.map((m) => m.type);
    }
    /** 模糊搜索组件（Levenshtein 距离 ≤ 2）— 返回单个最佳匹配 */
    fuzzyFind(pattern) {
        const all = this.fuzzyFindAll(pattern);
        return all.length > 0 ? all[0] : null;
    }
    /** 检查两个组件类型是否冲突 */
    hasConflict(typeA, typeB) {
        const kA = this.knowledgeOf(typeA);
        const kB = this.knowledgeOf(typeB);
        if (kA?.conflicts?.includes(typeB))
            return true;
        if (kB?.conflicts?.includes(typeA))
            return true;
        return false;
    }
    /** 获取组件的必需依赖（同节点其他组件） */
    getRequiredComponents(typeName) {
        return this.knowledgeOf(typeName)?.requires || [];
    }
    /** 获取组件属性的知识库默认值 */
    getKnowledgeDefaults(typeName) {
        return (this.knowledgeOf(typeName)?.defaults || {});
    }
    get count() {
        return this._entries.size;
    }
}
exports.ComponentCatalog = ComponentCatalog;
/** 基于 Catalog schema 的引用解析器 */
function createRefResolver(catalog) {
    return {
        isNodeRef(compType, propName) {
            const entry = catalog.get(compType);
            if (!entry)
                return false;
            const field = entry.schema.find((f) => f.name === propName || f.name === `_${propName}`);
            return field?.type === 'node';
        },
        isComponentRef(compType, propName) {
            const entry = catalog.get(compType);
            if (!entry)
                return null;
            const field = entry.schema.find((f) => f.name === propName || f.name === `_${propName}`);
            return field?.type === 'component' ? 'cc.Component' : null;
        },
        isAssetRef(compType, propName) {
            const entry = catalog.get(compType);
            if (!entry)
                return false;
            const field = entry.schema.find((f) => f.name === propName || f.name === `_${propName}`);
            return field?.type === 'asset';
        },
    };
}
//# sourceMappingURL=component-catalog.js.map