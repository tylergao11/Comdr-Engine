"use strict";
// ============================================================
// Assembler — 纯函数 assemble(spec, catalog, resolver?, prefabLoader?)
// 5 阶段管线：Validate → Enrich → Build → Serialize → Clean
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateFileId = exports.computeStats = exports.clean = exports.serialize = exports.build = exports.enrich = exports.validate = void 0;
exports.assemble = assemble;
exports.assembleSubtree = assembleSubtree;
const cocos_world_1 = require("../../model/cocos-world");
const validate_1 = require("./validate");
const enrich_1 = require("./enrich");
const build_1 = require("./build");
const serialize_1 = require("./serialize");
const clean_1 = require("./clean");
/**
 * 将 CompileSpec 组装为 Cocos prefab JSON。
 * 纯函数，所有依赖通过参数注入。无线程/模块级可变状态。
 *
 * @param spec         Commander 编译规格
 * @param catalog      统一组件目录
 * @param resolver     引用解析器（schema 驱动）
 * @param prefabLoader 嵌套 prefab 加载器（可选）
 */
function assemble(spec, catalog, resolver = cocos_world_1.NOOP_RESOLVER, prefabLoader, internalCatalog) {
    // Stage 1: Validate
    const validationError = (0, validate_1.validate)(spec);
    if (validationError) {
        return {
            ok: false,
            error: validationError.error,
            errorCode: validationError.errorCode,
        };
    }
    // Stage 2: Enrich
    const enriched = (0, enrich_1.enrich)(spec, catalog, internalCatalog);
    // Stage 3: Build
    const buildResult = (0, build_1.build)(enriched, catalog, prefabLoader);
    if (!buildResult.ok) {
        return buildResult;
    }
    // Stage 4: Serialize
    const serialized = (0, serialize_1.serialize)(buildResult.flatJson, enriched, catalog, resolver);
    // Stage 5: Clean
    const finalJson = (0, clean_1.clean)(serialized);
    const stats = (0, clean_1.computeStats)(finalJson);
    return { ok: true, json: finalJson, stats };
}
/**
 * 增量子树组装（用于 add-node 编辑操作）。
 * 不创建 Prefab wrapper，保留 __id__ 供 Bridge offset remap。
 */
function assembleSubtree(spec, catalog, resolver = cocos_world_1.NOOP_RESOLVER, internalCatalog) {
    // 1. 构建节点树（简化版，无 wrapper）
    const enriched = (0, enrich_1.enrich)(spec, catalog, internalCatalog);
    // 使用 build 的简化路径：只建子树
    const buildResult = (0, build_1.build)(enriched, catalog);
    if (!buildResult.ok)
        return buildResult;
    // 收集 tempId → localId 映射
    const idMap = {};
    for (const ns of enriched.nodes) {
        // 遍历 flatJson 找对应节点
        const nodeObj = buildResult.flatJson.find((o) => o.__type__ === 'cc.Node' && o._comdr_tempId === ns.tempId);
        if (nodeObj && typeof nodeObj.__id__ === 'number') {
            idMap[ns.tempId] = nodeObj.__id__;
        }
    }
    // 2. Serialize + 半清理（保留 __id__ 供 Bridge offset remap）
    const serialized = (0, serialize_1.serialize)(buildResult.flatJson, enriched, catalog, resolver);
    // 清理内部标记但保留 __id__
    const visited = new Set();
    function partialClean(obj) {
        if (!obj || typeof obj !== 'object' || visited.has(obj))
            return;
        visited.add(obj);
        if (Array.isArray(obj)) {
            for (const item of obj)
                partialClean(item);
            return;
        }
        const record = obj;
        delete record.tempId;
        delete record._rawProps;
        delete record._comdr_tempId;
        delete record._nestedSource;
        delete record._nestedRoot;
        delete record._prefabInstance;
        for (const value of Object.values(record)) {
            if (value && typeof value === 'object')
                partialClean(value);
        }
    }
    for (const obj of serialized)
        partialClean(obj);
    const stats = (0, clean_1.computeStats)(serialized);
    return { ok: true, json: serialized, stats, idMap };
}
// Re-export stages for direct use
var validate_2 = require("./validate");
Object.defineProperty(exports, "validate", { enumerable: true, get: function () { return validate_2.validate; } });
var enrich_2 = require("./enrich");
Object.defineProperty(exports, "enrich", { enumerable: true, get: function () { return enrich_2.enrich; } });
var build_2 = require("./build");
Object.defineProperty(exports, "build", { enumerable: true, get: function () { return build_2.build; } });
var serialize_2 = require("./serialize");
Object.defineProperty(exports, "serialize", { enumerable: true, get: function () { return serialize_2.serialize; } });
var clean_2 = require("./clean");
Object.defineProperty(exports, "clean", { enumerable: true, get: function () { return clean_2.clean; } });
Object.defineProperty(exports, "computeStats", { enumerable: true, get: function () { return clean_2.computeStats; } });
var id_alloc_1 = require("./id-alloc");
Object.defineProperty(exports, "generateFileId", { enumerable: true, get: function () { return id_alloc_1.generateFileId; } });
//# sourceMappingURL=index.js.map