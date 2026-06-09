"use strict";
// ============================================================
// Assembler Stage 4: Serialize
// 纯函数 serialize(json, spec, catalog, resolver) → PrefabJson
// 1. normalizeRefs — 内嵌实体 → { __id__: N }
// 2. wrapAssetRefs — UUID 字符串 → { __uuid__: ... }
// 3. resolveReferences — tempId/路径引用 → __id__/UUID 引用
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.serialize = serialize;
const cocos_world_1 = require("../../model/cocos-world");
function serialize(json, spec, catalog, resolver = cocos_world_1.NOOP_RESOLVER) {
    // 1. 替换内嵌引用为 { __id__: N }
    normalizeRefs(json);
    // 2. 资产 UUID 包装
    wrapAssetRefs(json, resolver);
    // 3. 引用解析
    resolveReferences(json, spec, resolver);
    return json;
}
// ===== normalizeRefs =====
function normalizeRefs(json) {
    for (const obj of json) {
        normalizeObj(obj, new Set());
    }
}
function normalizeObj(obj, visited) {
    if (visited.has(obj))
        return;
    visited.add(obj);
    for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (!val || typeof val !== 'object')
            continue;
        if (Array.isArray(val)) {
            for (let i = 0; i < val.length; i++) {
                const item = val[i];
                if (item && typeof item === 'object' && !Array.isArray(item)) {
                    const itemRec = item;
                    const typeName = itemRec.__type__;
                    if (typeName && !cocos_world_1.VALUE_TYPE_NAMES.has(typeName) && typeof itemRec.__id__ === 'number') {
                        val[i] = { __id__: itemRec.__id__ };
                    }
                    else {
                        normalizeObj(itemRec, visited);
                    }
                }
            }
        }
        else {
            const valRec = val;
            const typeName = valRec.__type__;
            if (typeName && !cocos_world_1.VALUE_TYPE_NAMES.has(typeName) && typeof valRec.__id__ === 'number') {
                obj[key] = { __id__: valRec.__id__ };
            }
            else {
                normalizeObj(valRec, visited);
            }
        }
    }
}
// ===== wrapAssetRefs =====
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(@[0-9a-fA-F]+)?$/;
const COCOS_UUID_RE = /^[0-9a-zA-Z+/]{22,23}$/;
const ASSET_PROP_PATTERNS = /Frame$|Material$|Clip$|Font$|Atlas$|Texture$|Sprite$/i;
function expectedTypeForProp(propName) {
    const clean = propName.replace(/^_/, '');
    if (/spriteFrame$/i.test(clean) || /^sprite$/i.test(clean))
        return 'cc.SpriteFrame';
    if (/spriteAtlas$/i.test(clean) || /atlas$/i.test(clean))
        return 'cc.SpriteAtlas';
    if (/Material$/i.test(clean))
        return 'cc.Material';
    if (/Font$/i.test(clean))
        return 'cc.TTFFont';
    if (/Texture$/i.test(clean))
        return 'cc.Texture2D';
    return undefined;
}
function wrapAssetRefs(json, resolver) {
    for (const obj of json) {
        const compType = obj.__type__;
        if (!compType)
            continue;
        if ((0, cocos_world_1.isInfraType)(compType))
            continue;
        if (cocos_world_1.VALUE_TYPE_NAMES.has(compType))
            continue;
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value !== 'string')
                continue;
            if (!UUID_RE.test(value) && !COCOS_UUID_RE.test(value))
                continue;
            if (resolver.isAssetRef(compType, key) || ASSET_PROP_PATTERNS.test(key)) {
                const expectedType = expectedTypeForProp(key);
                obj[key] = expectedType
                    ? { __uuid__: value, __expectedType__: expectedType }
                    : { __uuid__: value };
            }
        }
    }
}
// ===== resolveReferences =====
function resolveReferences(json, spec, resolver) {
    // 构建 tempId → node object 映射。
    // 依赖 clean stage 尚未运行（_comdr_tempId 标记仍存在）。若管线顺序变更导致
    // clean 先于 serialize 执行，_comdr_tempId 已被清除，此映射会为空，后续引用解析失败。
    // 当前管线 order: enrich → build → serialize → clean，标记仍存在。
    const tempIdToNode = new Map();
    for (const obj of json) {
        if (obj.__type__ === 'cc.Node' && obj._comdr_tempId) {
            tempIdToNode.set(obj._comdr_tempId, obj);
        }
    }
    // 预建组件索引：nodeId → compType → compObj（供 resolveCompRef O(1) 查）
    const compIndex = new Map();
    for (const obj of json) {
        const type = obj.__type__;
        const nodeRef = obj.node;
        if (!type || !nodeRef || (0, cocos_world_1.isInfraType)(type))
            continue;
        if (cocos_world_1.VALUE_TYPE_NAMES.has(type))
            continue;
        const nid = nodeRef.__id__;
        let typeMap = compIndex.get(nid);
        if (!typeMap) {
            typeMap = new Map();
            compIndex.set(nid, typeMap);
        }
        typeMap.set(type, obj);
    }
    for (const obj of json) {
        scanAndResolve(obj, json, spec, resolver, tempIdToNode, compIndex, new Set());
    }
}
function scanAndResolve(obj, json, spec, resolver, tempIdToNode, compIndex, visited) {
    if (visited.has(obj))
        return;
    visited.add(obj);
    const compType = obj.__type__;
    for (const [key, value] of Object.entries(obj)) {
        // 跳过系统字段
        if (key === 'node' || key === '_parent' || key === '_name' ||
            key === '_id' || key === 'fileId')
            continue;
        if (typeof value === 'string') {
            // tempId 引用（@R1 或 bare R1）
            const resolved = resolveTempIdRef(value, tempIdToNode);
            if (resolved !== value) {
                obj[key] = resolved;
            }
            // Schema 驱动的引用包装（engine 组件有精确 schema）
            if (compType && resolver.isNodeRef(compType, key)) {
                const nodeObj = tempIdToNode.get(value);
                if (nodeObj)
                    obj[key] = { __id__: nodeObj.__id__ };
            }
            if (compType && resolver.isComponentRef(compType, key)) {
                const compRef = resolveCompRef(value, tempIdToNode, compIndex);
                if (compRef)
                    obj[key] = compRef;
            }
            // 启发式回退：脚本组件属性类型都是 'any'，schema 无法识别引用
            // 用值格式推断：@开头的字符串很可能是节点引用
            if (value.startsWith('@') && tempIdToNode.has(value.slice(1))) {
                const nodeObj = tempIdToNode.get(value.slice(1));
                if (nodeObj)
                    obj[key] = { __id__: nodeObj.__id__ };
            }
            // UUID 格式字符串很可能是资产引用
            if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value)) {
                obj[key] = { __uuid__: value };
            }
        }
        // 递归
        if (value && typeof value === 'object') {
            if (Array.isArray(value)) {
                for (let i = 0; i < value.length; i++) {
                    const item = value[i];
                    if (typeof item === 'string') {
                        if (compType && resolver.isAssetRef(compType, key)) {
                            value[i] = resolveAssetStr(item, spec);
                        }
                    }
                    else if (item && typeof item === 'object' && !Array.isArray(item)) {
                        scanAndResolve(item, json, spec, resolver, tempIdToNode, compIndex, visited);
                    }
                }
            }
            else {
                scanAndResolve(value, json, spec, resolver, tempIdToNode, compIndex, visited);
            }
        }
    }
}
/** tempId → node {__id__} 解析。tempIdToNode 已包含所有有效 tempId，直接用 Map 验证。 */
function resolveTempIdRef(value, tempIdToNode) {
    const cleaned = value.startsWith('@') ? value.slice(1) : value;
    const nodeObj = tempIdToNode.get(cleaned);
    if (!nodeObj)
        return value;
    return { __id__: nodeObj.__id__ };
}
/** 组件引用解析 — 用预建 compIndex O(1) 查，替代遍历 json 数组 */
function resolveCompRef(value, tempIdToNode, compIndex) {
    const match = value.match(/^@?(\w+)\[(.+)\]$/);
    if (!match)
        return null;
    const [, tempId, compType] = match;
    const targetNode = tempIdToNode.get(tempId);
    if (!targetNode) {
        process.stderr.write(`[comdr] resolveCompRef: tempId "${tempId}" not found in assembled nodes\n`);
        return null;
    }
    const typeMap = compIndex.get(targetNode.__id__);
    const matched = typeMap?.get(compType);
    if (matched)
        return { __id__: matched.__id__ };
    process.stderr.write(`[comdr] resolveCompRef: component "${compType}" not found on node @${tempId}\n`);
    return null;
}
function resolveAssetStr(value, _spec) {
    if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value)) {
        return { __uuid__: value };
    }
    return value; // 路径引用，保留给上层处理
}
//# sourceMappingURL=serialize.js.map