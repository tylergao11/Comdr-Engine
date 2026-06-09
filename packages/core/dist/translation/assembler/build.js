"use strict";
// ============================================================
// Assembler Stage 3: Build
// 纯函数 build(spec, catalog) → { prefabRoot, rootNode, idResult }
// 将 CompileSpec 构建为完整的 Cocos prefab 对象树
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.build = build;
const cocos_world_1 = require("../../model/cocos-world");
const id_alloc_1 = require("./id-alloc");
const value_kit_1 = require("../../foundation/value-kit");
// ===== 入口 =====
function build(spec, catalog, prefabLoader) {
    // 1. 构建节点树
    const nodeMap = new Map();
    for (const ns of spec.nodes) {
        const node = createNode(ns, catalog, prefabLoader);
        nodeMap.set(ns.tempId, node);
    }
    // 2. 建立父子关系
    for (const ns of spec.nodes) {
        if (ns.parent && nodeMap.has(ns.parent)) {
            const parent = nodeMap.get(ns.parent);
            const child = nodeMap.get(ns.tempId);
            parent._children.push(child);
            child._parent = parent;
        }
    }
    // 3. 找根节点
    const rootSpec = spec.nodes.find((n) => !n.parent);
    if (!rootSpec) {
        return { ok: false, error: 'No root node', errorCode: 'ASM_NO_ROOT' };
    }
    const rootNode = nodeMap.get(rootSpec.tempId);
    // 4. 创建 Prefab wrapper
    const prefabRoot = (0, value_kit_1.cloneJson)(cocos_world_1.PREFAB_WRAPPER_TEMPLATE);
    prefabRoot._name = spec.name || rootNode._name || '';
    // 5. PrefabInfo root refs（对象引用，allocateIds 会就地设 __id__，引用自动更新）
    walkAndSetPrefabInfoRoots(rootNode, rootNode);
    // 6. wrapper.data → root（必须在 ID 分配前设置引用，allocator 才能遍历整棵树）
    prefabRoot.data = rootNode;
    // 7. ID 分配：单次遍历整棵树（prefabRoot → data → rootNode → children → components）
    //    prefabRoot 得到 __id__=0，后续对象顺序递增。root refs 自动获得正确 ID。
    const idResult = (0, id_alloc_1.allocateIds)(prefabRoot);
    // 8. PrefabInfo.asset → { __id__: 0 }（必须在 ID 分配后，prefabRoot.__id__ 才有值）
    walkAndSetPrefabInfoAssets(rootNode, prefabRoot);
    // 9. Collect nested roots for root PrefabInfo（使用已分配的 __id__）
    const nestedRoots = [];
    collectNestedRoots(rootNode, nestedRoots);
    if (nestedRoots.length > 0) {
        rootNode._prefab.nestedPrefabInstanceRoots =
            nestedRoots.map((n) => ({ __id__: n.__id__ }));
    }
    // 9a. 解析 knowledge refs — 组件字段 → 子节点引用（如 ScrollView._content → content 子节点、Toggle.checkMark → checkmark 子节点）
    resolveKnowledgeRefs(rootNode, catalog);
    // 10. 扁平化
    const flatJson = flattenHierarchy(idResult, prefabRoot, rootNode);
    return {
        ok: true,
        prefabRoot,
        rootNode,
        idResult,
        flatJson,
    };
}
// ===== 节点创建 =====
function createNode(spec, catalog, _prefabLoader) {
    const node = (0, value_kit_1.cloneJson)(cocos_world_1.NODE_TEMPLATE);
    node._name = spec.name;
    node._active = spec.active !== false;
    node._children = [];
    node._components = [];
    node._parent = null;
    node.tempId = spec.tempId;
    node._comdr_tempId = spec.tempId;
    node._id = '';
    node.__id__ = -1; // IdManager 会重新分配
    // Transform
    if (spec.position) {
        node._lpos = {
            __type__: 'cc.Vec3', x: spec.position.x, y: spec.position.y,
            z: spec.position.z ?? 0,
        };
    }
    if (spec.scale) {
        node._lscale = {
            __type__: 'cc.Vec3', x: spec.scale.x, y: spec.scale.y,
            z: spec.scale.z ?? 1,
        };
    }
    if (spec.contentSize) {
        node._contentSize = {
            __type__: 'cc.Size', width: spec.contentSize.width,
            height: spec.contentSize.height,
        };
    }
    if (spec.anchorPoint) {
        node._anchorPoint = {
            __type__: 'cc.Vec2', x: spec.anchorPoint.x,
            y: spec.anchorPoint.y,
        };
    }
    // Components: 按规范化类型去重
    const seenTypes = new Set();
    const droppedProps = [];
    for (const compSpec of spec.components) {
        const resolved = catalog.resolve(compSpec.type);
        if (seenTypes.has(resolved))
            continue;
        seenTypes.add(resolved);
        const { comp, dropped } = buildComponent(compSpec, resolved, catalog);
        droppedProps.push(...dropped);
        comp.node = node;
        const cpi = (0, value_kit_1.cloneJson)(cocos_world_1.COMP_PREFAB_INFO_TEMPLATE);
        cpi.fileId = (0, id_alloc_1.generateFileId)();
        comp.__prefab = cpi;
        node._components.push(comp);
    }
    // 暂存被丢弃的属性名，供 Gateway 反馈给 Commander
    if (droppedProps.length > 0) {
        node._comdr_dropped = droppedProps;
    }
    // PrefabInfo
    const prefabInfo = (0, value_kit_1.cloneJson)(cocos_world_1.PREFAB_INFO_TEMPLATE);
    prefabInfo.fileId = (0, id_alloc_1.generateFileId)();
    delete prefabInfo.sync;
    node._prefab = prefabInfo;
    return node;
}
function buildComponent(spec, resolvedType, catalog) {
    // 类型校验
    if (!spec.type || spec.type === 'cc.' || spec.type === 'cc') {
        throw new Error(`Empty component type. Use >schema(component=cc.Type) to find valid types.`);
    }
    if ((0, cocos_world_1.isInfraType)(resolvedType)) {
        throw new Error(`"${resolvedType}" is not a component type. Use >schema() to verify.`);
    }
    // 获取模板（engine 有完整模板，script 有最小模板）
    const template = catalog.templateOf(resolvedType);
    const comp = template ? (0, value_kit_1.cloneJson)(template) : {
        __type__: resolvedType, _name: '', _objFlags: 0,
        node: null, _enabled: true, _id: '',
    };
    // 应用 Commander 指定的属性，捕获被丢弃的 key
    const dropped = applyProps(comp, spec.props, resolvedType);
    return { comp: comp, dropped };
}
// ===== 属性应用 =====
const FLAT_TO_NESTED = {
    width: ['_contentSize', 'width'],
    height: ['_contentSize', 'height'],
    anchorX: ['_anchorPoint', 'x'],
    anchorY: ['_anchorPoint', 'y'],
};
const OBJECT_RENAME = {
    contentSize: { target: '_contentSize', typeKey: 'cc.Size' },
    anchorPoint: { target: '_anchorPoint', typeKey: 'cc.Vec2' },
};
/** 应用 Commander 指定的属性。返回被丢弃的属性名列表（模板中不存在的 key）。
 *  @param compType 组件的规范化类型名（用于限定 FLAT_TO_NESTED/OBJECT_RENAME 仅对 UITransform 生效） */
function applyProps(comp, props, compType) {
    const isUITransform = compType === 'cc.UITransform';
    const dropped = [];
    for (const [key, value] of Object.entries(props)) {
        // 扁平映射（width → _contentSize.width）— 仅 UITransform 有此结构
        if (isUITransform && FLAT_TO_NESTED[key]) {
            const path = FLAT_TO_NESTED[key];
            let target = comp;
            for (let i = 0; i < path.length - 1; i++) {
                if (!target[path[i]] || typeof target[path[i]] !== 'object') {
                    target[path[i]] = {};
                }
                target = target[path[i]];
            }
            target[path[path.length - 1]] = value;
            if (['width', 'height'].includes(key) && !comp._contentSize?.__type__) {
                comp._contentSize = { __type__: 'cc.Size', width: 100, height: 100 };
            }
            if (['anchorX', 'anchorY'].includes(key) && !comp._anchorPoint?.__type__) {
                comp._anchorPoint = { __type__: 'cc.Vec2', x: 0.5, y: 0.5 };
            }
            continue;
        }
        // 对象级重命名（contentSize → _contentSize）— 仅 UITransform
        if (isUITransform && value && typeof value === 'object' && !Array.isArray(value) && OBJECT_RENAME[key]) {
            const { target, typeKey } = OBJECT_RENAME[key];
            const existing = comp[target];
            comp[target] = existing?.__type__
                ? { ...existing, ...value }
                : { __type__: typeKey, ...value };
            continue;
        }
        // 标准属性
        const underscored = key.startsWith('_') ? key : '_' + key;
        const targetKey = underscored in comp ? underscored : (key in comp ? key : null);
        // 模板中不存在 → 直接以 _key 追加（schema 提取可能不完整，如 Label._string）
        if (!targetKey) {
            comp[underscored] = value;
            continue;
        }
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            const existing = comp[targetKey];
            comp[targetKey] = existing?.__type__
                ? { ...existing, ...value }
                : value;
        }
        else {
            comp[targetKey] = value;
        }
    }
    return dropped;
}
// ===== PrefabInfo 引用回填 =====
function walkAndSetPrefabInfoRoots(node, rootNode) {
    const pi = node._prefab;
    if (pi) {
        pi.root = node._nestedRoot
            ? node._nestedRoot
            : rootNode;
    }
    for (const child of node._children) {
        walkAndSetPrefabInfoRoots(child, rootNode);
    }
}
function walkAndSetPrefabInfoAssets(node, prefabRoot) {
    const pi = node._prefab;
    if (pi) {
        if (node._nestedSource) {
            pi.asset = { __uuid__: node._nestedSource, __expectedType__: 'cc.Prefab' };
        }
        else {
            pi.asset = { __id__: prefabRoot.__id__ };
        }
    }
    for (const child of node._children) {
        walkAndSetPrefabInfoAssets(child, prefabRoot);
    }
}
function collectNestedRoots(node, result) {
    if (node._prefabInstance)
        result.push(node);
    for (const child of node._children)
        collectNestedRoots(child, result);
}
/** 遍历整棵树，解析组件 knowledge refs：
 *  如 ScrollView._content → { __id__: contentChild.__id__ }
 *  如 Toggle._checkMark → { __id__: checkmarkChild.__id__ } */
function resolveKnowledgeRefs(rootNode, catalog) {
    const walk = (node) => {
        for (const comp of node._components) {
            const compType = comp.__type__;
            if (!compType)
                continue;
            const knowledge = catalog.knowledgeOf(compType);
            if (!knowledge?.refs)
                continue;
            const compObj = comp;
            for (const [propName, ref] of Object.entries(knowledge.refs)) {
                if (ref.targetType !== 'node' || !ref.targetChild)
                    continue;
                // 在子节点中找 knowledge id 匹配的（_comdr_tempId 以 _<childId>_ 开头）
                const found = findChildById(node, ref.targetChild);
                if (found) {
                    const targetProp = propName.startsWith('_') ? propName : '_' + propName;
                    compObj[targetProp] = { __id__: found.__id__ };
                }
            }
        }
        for (const child of node._children)
            walk(child);
    };
    walk(rootNode);
}
/** 在节点的所有后代中按 knowledge child id 查找 */
function findChildById(parent, childId) {
    // BFS 搜索整棵子树，用 index pointer 替代 shift() 避免 O(n²)
    const queue = [...parent._children];
    let head = 0;
    while (head < queue.length) {
        const child = queue[head++];
        const tempId = child._comdr_tempId;
        if (tempId && tempId.startsWith('_' + childId + '_'))
            return child;
        if (child._name === childId)
            return child;
        for (const c of child._children)
            queue.push(c);
    }
    return null;
}
// ===== 扁平化 =====
function flattenHierarchy(idResult, prefabRoot, rootNode) {
    const allObjects = idResult.objects;
    const visited = new Set();
    const result = [];
    // 预建对象 → 下标映射（WeakMap 不支持 number key，用 Map<number, number>）
    // allocateIds 已为每个对象分配唯一 __id__，直接以 __id__ 为 key 索引
    const idToIndex = new Map();
    for (let i = 0; i < allObjects.length; i++) {
        idToIndex.set(allObjects[i].__id__, i);
    }
    /** O(1) 查对象在 allObjects 中的下标 */
    function indexOf(obj) {
        return idToIndex.get(obj.__id__) ?? -1;
    }
    // 先放 Prefab wrapper（index 0）
    const pfIdx = indexOf(prefabRoot);
    if (pfIdx >= 0) {
        visited.add(prefabRoot.__id__);
        result.push(allObjects[pfIdx]);
    }
    // DFS 遍历节点树
    function pushNode(node) {
        const nodeIdx = indexOf(node);
        if (nodeIdx >= 0 && !visited.has(node.__id__)) {
            visited.add(node.__id__);
            result.push(allObjects[nodeIdx]);
        }
        for (const comp of node._components) {
            const compIdx = indexOf(comp);
            if (compIdx >= 0 && !visited.has(comp.__id__)) {
                visited.add(comp.__id__);
                result.push(allObjects[compIdx]);
            }
            // CompPrefabInfo
            const cpi = comp.__prefab;
            if (cpi) {
                const cpiIdx = indexOf(cpi);
                if (cpiIdx >= 0 && !visited.has(cpi.__id__)) {
                    visited.add(cpi.__id__);
                    result.push(allObjects[cpiIdx]);
                }
            }
        }
        // PrefabInfo
        const piIdx = indexOf(node._prefab);
        if (piIdx >= 0 && !visited.has(node._prefab.__id__)) {
            visited.add(node._prefab.__id__);
            result.push(allObjects[piIdx]);
        }
        for (const child of node._children)
            pushNode(child);
    }
    pushNode(rootNode);
    // 剩余对象（嵌套的 PrefabInstance 等）— 用 idToIndex 判定是否已收集
    for (const obj of allObjects) {
        if (!visited.has(obj.__id__)) {
            result.push(obj);
        }
    }
    // 按 ID 排序
    result.sort((a, b) => (a.__id__ ?? 0) - (b.__id__ ?? 0));
    return result;
}
//# sourceMappingURL=build.js.map