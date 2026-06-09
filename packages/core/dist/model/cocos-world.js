"use strict";
// ============================================================
// CocosWorld — Cocos Creator 世界模型的五个基础元素
// 全系统唯一真相源。每层都从这里引用类型，不做二次定义。
//
//   1. Asset      — 文件资源（UUID + 路径 + 类型 + 子资产）
//   2. Node       — 层级容器（fileId + 名称 + 父子关系 + 组件列表）
//   3. Component  — 类型化数据（ComponentIdentity + 属性表）
//   4. Value      — 属性值（原始类型 | 数学类型 | 引用 | 数组）
//   5. Reference  — 关系连线（__id__ 内部引 | __uuid__ 资产引）
//
// 核心洞察：__type__ 格式即身份
//   "cc.Sprite"         → 引擎组件，去 Catalog 查 schema/knowledge
//   "a1b2c3d4..."       → 自定义脚本（23位压缩UUID），去 Catalog 查类名
//   不需要外部查表就能区分！
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOOP_RESOLVER = exports.PROPERTY_OVERRIDE_INFO_TEMPLATE = exports.TARGET_INFO_TEMPLATE = exports.PREFAB_INSTANCE_TEMPLATE = exports.COMP_PREFAB_INFO_TEMPLATE = exports.PREFAB_INFO_TEMPLATE = exports.PREFAB_WRAPPER_TEMPLATE = exports.NODE_TEMPLATE = exports.NODE_LIKE_TYPES = exports.VALUE_TYPE_NAMES = exports.VALUE_TYPE_TEMPLATES = void 0;
exports.generateComponentTemplate = generateComponentTemplate;
exports.minimalComponentTemplate = minimalComponentTemplate;
exports.isCompressedUuidType = isCompressedUuidType;
exports.isValueType = isValueType;
exports.isInfraType = isInfraType;
exports.isEngineComponentType = isEngineComponentType;
exports.parseComponentIdentity = parseComponentIdentity;
const value_kit_1 = require("../foundation/value-kit");
// ============================================================
// 模板常量
// ============================================================
exports.VALUE_TYPE_TEMPLATES = {
    'cc.Vec2': { __type__: 'cc.Vec2', x: 0, y: 0 },
    'cc.Vec3': { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 },
    'cc.Vec4': { __type__: 'cc.Vec4', x: 0, y: 0, z: 0, w: 0 },
    'cc.Size': { __type__: 'cc.Size', width: 100, height: 100 },
    'cc.Color': { __type__: 'cc.Color', r: 255, g: 255, b: 255, a: 255 },
    'cc.Quat': { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 },
    'cc.Rect': { __type__: 'cc.Rect', x: 0, y: 0, width: 0, height: 0 },
};
/** 值类型名称集合 — 内嵌序列化，不分配 __id__ */
exports.VALUE_TYPE_NAMES = new Set(Object.keys(exports.VALUE_TYPE_TEMPLATES));
/** 非用户组件的引擎基础设施类型 */
const INFRA_TYPES = new Set([
    'cc.Node', 'cc.Prefab', 'cc.Scene', 'cc.SceneAsset',
    'cc.PrefabInfo', 'cc.CompPrefabInfo', 'cc.PrefabInstance',
    'cc.TargetInfo', 'CCPropertyOverrideInfo', 'cc.ClickEvent',
]);
/** 层级节点类型 — cc.Node 和 cc.Scene 在树结构中行为一致 */
exports.NODE_LIKE_TYPES = new Set(['cc.Node', 'cc.Scene']);
exports.NODE_TEMPLATE = {
    __type__: 'cc.Node',
    _name: '',
    _objFlags: 0,
    _parent: null,
    _children: [],
    _active: true,
    _components: [],
    _prefab: null,
    _lpos: { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 },
    _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 },
    _lscale: { __type__: 'cc.Vec3', x: 1, y: 1, z: 1 },
    _layer: 1 << 25, // UI_2D (Cocos built-in layer mask = 33554432)
    _euler: { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 },
    _id: '',
};
exports.PREFAB_WRAPPER_TEMPLATE = {
    __type__: 'cc.Prefab',
    _name: '',
    _objFlags: 0,
    _native: '',
    data: null,
    optimizationPolicy: 0,
    asyncLoadAssets: false,
    persistent: false,
};
exports.PREFAB_INFO_TEMPLATE = {
    __type__: 'cc.PrefabInfo',
    root: null,
    asset: null,
    fileId: '',
};
exports.COMP_PREFAB_INFO_TEMPLATE = {
    __type__: 'cc.CompPrefabInfo',
    fileId: '',
};
exports.PREFAB_INSTANCE_TEMPLATE = {
    __type__: 'cc.PrefabInstance',
    fileId: '',
    prefabRootNode: null,
    mountedChildren: [],
    mountedComponents: [],
    propertyOverrides: [],
    removedComponents: [],
};
exports.TARGET_INFO_TEMPLATE = {
    __type__: 'cc.TargetInfo',
    localID: [],
};
exports.PROPERTY_OVERRIDE_INFO_TEMPLATE = {
    __type__: 'CCPropertyOverrideInfo',
    targetInfo: null,
    propertyPath: [],
    value: null,
};
// ============================================================
// 组件模板生成
// ============================================================
/** 从 schema 字段列表生成组件 JSON 模板 */
function generateComponentTemplate(rawType, fields) {
    const template = {
        __type__: rawType,
        _name: '',
        _objFlags: 0,
        node: null,
        _enabled: true,
        _id: '',
    };
    const skipKeys = new Set([
        '_name', '_enabled', 'enabled', '_id', 'id',
        '_objFlags', 'objFlags', '__editorExtras__', 'node',
    ]);
    for (const field of fields) {
        if (skipKeys.has(field.name))
            continue;
        // Cocos 序列化用 _ 前缀，已带 _ 的不再加
        const key = field.name.startsWith('_') ? field.name : '_' + field.name;
        template[key] = defaultValueForSchemaType(field.type);
    }
    // 合成 _contentSize（如有 _width/_height 字段 — schema 使用下划线前缀命名）
    if ('_width' in template || '_height' in template) {
        const sz = { ...(0, value_kit_1.cloneJson)(exports.VALUE_TYPE_TEMPLATES['cc.Size']) };
        if (template._width !== undefined)
            sz.width = template._width;
        if (template._height !== undefined)
            sz.height = template._height;
        delete template._width;
        delete template._height;
        template._contentSize = sz;
    }
    // 合成 _anchorPoint
    if ('_anchorX' in template || '_anchorY' in template) {
        const ap = { ...(0, value_kit_1.cloneJson)(exports.VALUE_TYPE_TEMPLATES['cc.Vec2']) };
        if (template._anchorX !== undefined)
            ap.x = template._anchorX;
        if (template._anchorY !== undefined)
            ap.y = template._anchorY;
        delete template._anchorX;
        delete template._anchorY;
        template._anchorPoint = ap;
    }
    return template;
}
function defaultValueForSchemaType(type) {
    switch (type) {
        case 'string': return '';
        case 'int':
        case 'float':
        case 'number': return 0;
        case 'bool':
        case 'boolean': return false;
        case 'color': return (0, value_kit_1.cloneJson)(exports.VALUE_TYPE_TEMPLATES['cc.Color']);
        case 'vec2': return (0, value_kit_1.cloneJson)(exports.VALUE_TYPE_TEMPLATES['cc.Vec2']);
        case 'vec3': return (0, value_kit_1.cloneJson)(exports.VALUE_TYPE_TEMPLATES['cc.Vec3']);
        case 'vec4': return (0, value_kit_1.cloneJson)(exports.VALUE_TYPE_TEMPLATES['cc.Vec4']);
        case 'size': return (0, value_kit_1.cloneJson)(exports.VALUE_TYPE_TEMPLATES['cc.Size']);
        case 'rect': return (0, value_kit_1.cloneJson)(exports.VALUE_TYPE_TEMPLATES['cc.Rect']);
        case 'node':
        case 'component':
        case 'asset': return null;
        case 'array': return [];
        default: return 0; // 'any' → 0，确保字段存在
    }
}
/** 最小组件模板（无 schema 时使用，如自定义脚本） */
function minimalComponentTemplate(rawType) {
    return {
        __type__: rawType,
        _name: '',
        _objFlags: 0,
        node: null,
        _enabled: true,
        _id: '',
    };
}
// ============================================================
// __type__ 格式判断工具
// ============================================================
/** 压缩 UUID：22-23 字符，base64 变体（Cocos compressed UUID 格式） */
const COMPRESSED_UUID_RE = /^[0-9a-zA-Z+/]{22,23}$/;
/** 判断 __type__ 字符串是否是压缩 UUID（→ 自定义脚本） */
function isCompressedUuidType(typeName) {
    if (!typeName || typeName.startsWith('cc.'))
        return false;
    return COMPRESSED_UUID_RE.test(typeName);
}
/** 判断 __type__ 字符串是否是值类型（内嵌序列化，不分配 __id__） */
function isValueType(typeName) {
    return exports.VALUE_TYPE_NAMES.has(typeName);
}
/** 判断 __type__ 是否是引擎基础设施类型（Node/Prefab/PrefabInfo 等） */
function isInfraType(typeName) {
    return INFRA_TYPES.has(typeName);
}
/** 判断 __type__ 是否是用户可见的引擎组件（cc.Xxx，排除基础设施和值类型） */
function isEngineComponentType(typeName) {
    return typeName.startsWith('cc.') && !isValueType(typeName) && !isInfraType(typeName);
}
/** 从 __type__ 解析 ComponentIdentity。
 *  @param rawType    Cocos JSON 中的 __type__ 值
 *  @param classNameLookup  压缩 UUID → @ccclass 类名（可选，ScriptRegistry 提供） */
function parseComponentIdentity(rawType, classNameLookup) {
    if (isCompressedUuidType(rawType)) {
        const name = classNameLookup ? classNameLookup(rawType) : rawType;
        return { name: name || rawType, namespace: null, isScript: true, rawType };
    }
    if (rawType.startsWith('cc.')) {
        const name = rawType.slice(3); // 去掉 'cc.' 前缀
        return { name, namespace: 'cc', isScript: false, rawType };
    }
    // 未知格式—按脚本类名处理
    return { name: rawType, namespace: null, isScript: true, rawType };
}
exports.NOOP_RESOLVER = {
    isNodeRef: () => false,
    isComponentRef: () => null,
    isAssetRef: () => false,
};
//# sourceMappingURL=cocos-world.js.map