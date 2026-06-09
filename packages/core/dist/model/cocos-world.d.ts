export interface CocosVec2 {
    __type__: 'cc.Vec2';
    x: number;
    y: number;
}
export interface CocosVec3 {
    __type__: 'cc.Vec3';
    x: number;
    y: number;
    z: number;
}
export interface CocosVec4 {
    __type__: 'cc.Vec4';
    x: number;
    y: number;
    z: number;
    w: number;
}
export interface CocosSize {
    __type__: 'cc.Size';
    width: number;
    height: number;
}
export interface CocosColor {
    __type__: 'cc.Color';
    r: number;
    g: number;
    b: number;
    a: number;
}
export interface CocosQuat {
    __type__: 'cc.Quat';
    x: number;
    y: number;
    z: number;
    w: number;
}
export interface CocosRect {
    __type__: 'cc.Rect';
    x: number;
    y: number;
    width: number;
    height: number;
}
export type CocosMathType = CocosVec2 | CocosVec3 | CocosVec4 | CocosSize | CocosColor | CocosQuat | CocosRect;
/** { __id__: number } — prefab 内部数组下标引用，Cocos 引擎基础件 */
export interface IdRef {
    __id__: number;
}
/** { __uuid__: string } — 资产 UUID 引用，可选 __expectedType__ 提示 */
export interface UuidRef {
    __uuid__: string;
    __expectedType__?: string;
}
export type CocosReference = IdRef | UuidRef;
export type CocosPrimitive = string | number | boolean;
export interface CocosValueMap {
    [key: string]: CocosValue;
}
export type CocosValue = CocosPrimitive | CocosMathType | CocosReference | CocosValue[] | CocosValueMap | null;
/**
 * 组件身份 — 从 __type__ 字符串派生。
 * __type__ 格式本身就是引擎/脚本的天然分界，不需要外部查表。
 */
export interface ComponentIdentity {
    /** 'Sprite' 或 'testComdr' — 人类可读名 */
    name: string;
    /** 'cc' 为引擎组件，null 为自定义脚本 */
    namespace: string | null;
    /** true = 自定义脚本（__type__ 是压缩 UUID），false = 引擎组件 */
    isScript: boolean;
    /** Cocos JSON 中实际出现的 __type__ 字符串 */
    rawType: string;
}
/** 组件属性的 schema 字段 */
export interface PropertySchema {
    name: string;
    type: string;
    default?: unknown;
}
/** 运行时组件表示 */
export interface CocosComponent {
    identity: ComponentIdentity;
    properties: Record<string, CocosValue>;
    enabled: boolean;
    fileId?: string;
}
export interface CocosNode {
    fileId: string;
    name: string;
    parent: CocosNode | null;
    children: CocosNode[];
    components: CocosComponent[];
    active: boolean;
    position: CocosVec3;
    rotation: CocosVec3;
    scale: CocosVec3;
    contentSize?: CocosSize;
    anchorPoint?: CocosVec2;
    layer: number;
}
export interface CocosAsset {
    uuid: string;
    path: string;
    fsPath: string;
    importer: string;
    subAssets: CocosAsset[];
}
export interface NodeSpec {
    tempId: string;
    name: string;
    parent: string | null;
    prefab?: string;
    prefabUuid?: string;
    active?: boolean;
    position?: {
        x: number;
        y: number;
        z: number;
    };
    scale?: {
        x: number;
        y: number;
        z: number;
    };
    contentSize?: {
        width: number;
        height: number;
    };
    anchorPoint?: {
        x: number;
        y: number;
    };
    components: ComponentSpec[];
    children?: NodeSpec[];
}
export interface ComponentSpec {
    type: string;
    props: Record<string, unknown>;
}
export interface CompileSpec {
    path?: string;
    name?: string;
    nodes: NodeSpec[];
}
export interface SerializedComponent {
    __type__: string;
    _name: string;
    _objFlags: number;
    node: IdRef;
    _enabled: boolean;
    _id: string;
    __prefab?: IdRef;
    [key: string]: unknown;
}
export interface SerializedNode {
    __type__: 'cc.Node';
    _name: string;
    _objFlags: number;
    _parent: IdRef | null;
    _children: IdRef[];
    _components: IdRef[];
    _prefab: IdRef;
    _active: boolean;
    _lpos: CocosVec3;
    _lrot: CocosQuat;
    _lscale: CocosVec3;
    _euler: CocosVec3;
    _layer: number;
    _id: string;
    _contentSize?: CocosSize;
    _anchorPoint?: CocosVec2;
    [key: string]: unknown;
}
export interface SerializedPrefab {
    __type__: 'cc.Prefab';
    _name: string;
    _objFlags: number;
    data: IdRef;
    [key: string]: unknown;
}
export interface SerializedPrefabInfo {
    __type__: 'cc.PrefabInfo';
    root: IdRef | null;
    asset: IdRef | UuidRef | null;
    fileId: string;
    instance?: IdRef;
    nestedPrefabInstanceRoots?: IdRef[];
    [key: string]: unknown;
}
export interface SerializedCompPrefabInfo {
    __type__: 'cc.CompPrefabInfo';
    fileId: string;
    [key: string]: unknown;
}
export type SerializedObject = Record<string, unknown>;
export type PrefabJson = SerializedObject[];
/** 构建期 Node — 持有实体引用，normalizeRefs 后转为 IdRef */
export interface BuiltNode {
    __type__: 'cc.Node';
    __id__: number;
    _name: string;
    _objFlags: number;
    _parent: BuiltNode | null;
    _children: BuiltNode[];
    _components: SerializedComponent[];
    _prefab: SerializedPrefabInfo;
    _active: boolean;
    _lpos: CocosVec3;
    _lrot: CocosQuat;
    _lscale: CocosVec3;
    _euler: CocosVec3;
    _layer: number;
    _id: string;
    _contentSize?: CocosSize;
    _anchorPoint?: CocosVec2;
    tempId: string;
    _comdr_tempId?: string;
    _nestedSource?: string;
    _nestedRoot?: BuiltNode;
    _prefabInstance?: SerializedObject;
    [key: string]: unknown;
}
/** 构建期 Prefab 包装器 */
export interface BuiltPrefab {
    __type__: 'cc.Prefab';
    __id__: number;
    _name: string;
    _objFlags: number;
    data: BuiltNode | IdRef;
    [key: string]: unknown;
}
export declare const VALUE_TYPE_TEMPLATES: Record<string, Record<string, unknown>>;
/** 值类型名称集合 — 内嵌序列化，不分配 __id__ */
export declare const VALUE_TYPE_NAMES: ReadonlySet<string>;
/** 层级节点类型 — cc.Node 和 cc.Scene 在树结构中行为一致 */
export declare const NODE_LIKE_TYPES: ReadonlySet<string>;
export declare const NODE_TEMPLATE: Record<string, unknown>;
export declare const PREFAB_WRAPPER_TEMPLATE: Record<string, unknown>;
export declare const PREFAB_INFO_TEMPLATE: Record<string, unknown>;
export declare const COMP_PREFAB_INFO_TEMPLATE: Record<string, unknown>;
export declare const PREFAB_INSTANCE_TEMPLATE: Record<string, unknown>;
export declare const TARGET_INFO_TEMPLATE: Record<string, unknown>;
export declare const PROPERTY_OVERRIDE_INFO_TEMPLATE: Record<string, unknown>;
/** 从 schema 字段列表生成组件 JSON 模板 */
export declare function generateComponentTemplate(rawType: string, fields: PropertySchema[]): Record<string, unknown>;
/** 最小组件模板（无 schema 时使用，如自定义脚本） */
export declare function minimalComponentTemplate(rawType: string): Record<string, unknown>;
/** 判断 __type__ 字符串是否是压缩 UUID（→ 自定义脚本） */
export declare function isCompressedUuidType(typeName: string): boolean;
/** 判断 __type__ 字符串是否是值类型（内嵌序列化，不分配 __id__） */
export declare function isValueType(typeName: string): boolean;
/** 判断 __type__ 是否是引擎基础设施类型（Node/Prefab/PrefabInfo 等） */
export declare function isInfraType(typeName: string): boolean;
/** 判断 __type__ 是否是用户可见的引擎组件（cc.Xxx，排除基础设施和值类型） */
export declare function isEngineComponentType(typeName: string): boolean;
/** 从 __type__ 解析 ComponentIdentity。
 *  @param rawType    Cocos JSON 中的 __type__ 值
 *  @param classNameLookup  压缩 UUID → @ccclass 类名（可选，ScriptRegistry 提供） */
export declare function parseComponentIdentity(rawType: string, classNameLookup?: (compressedId: string) => string): ComponentIdentity;
export interface AssemblyStats {
    nodes: number;
    components: number;
    totalObjects: number;
}
export type AssemblerResult = {
    ok: true;
    json: unknown[];
    stats: AssemblyStats;
} | {
    ok: false;
    error: string;
    errorCode: string;
};
export interface RefResolver {
    isNodeRef(componentType: string, propName: string): boolean;
    isComponentRef(componentType: string, propName: string): string | null;
    isAssetRef(componentType: string, propName: string): boolean;
}
export declare const NOOP_RESOLVER: RefResolver;
//# sourceMappingURL=cocos-world.d.ts.map