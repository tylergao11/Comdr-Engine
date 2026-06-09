/** 文档编辑操作类型 */
export declare const EditType: {
    readonly ADD_COMPONENT: "add-component";
    readonly SET_PROP: "set-prop";
    readonly SET_PROPS: "set-props";
    readonly DELETE_NODE: "delete-node";
    readonly REPARENT: "reparent";
    readonly DUPLICATE: "duplicate";
    readonly SET_ACTIVE: "set-active";
    readonly ADD_NODE_TREE: "add-node-tree";
};
export type EditType = (typeof EditType)[keyof typeof EditType];
export type DocumentKind = 'scene' | 'prefab';
interface CocosObject {
    __type__?: string;
    __id__?: number;
    __uuid__?: string;
    __deleted__?: boolean;
    _name?: string;
    _objFlags?: number;
    _children?: Array<{
        __id__: number;
    }>;
    _components?: Array<{
        __id__: number;
    }>;
    _prefab?: {
        __id__: number;
    };
    _parent?: {
        __id__: number;
    } | null;
    _active?: boolean;
    _enabled?: boolean;
    _id?: string;
    node?: {
        __id__: number;
    };
    fileId?: string;
    data?: {
        __id__: number;
    };
    root?: {
        __id__: number;
    };
    asset?: null | {
        __uuid__: string;
    };
    sync?: boolean;
    [key: string]: unknown;
}
interface TreeNode {
    nodeUuid: string;
    name: string;
    path: string;
    active: boolean;
    childCount: number;
    children: TreeNode[];
    components: ComponentInfo[];
}
interface ComponentInfo {
    componentUuid: string;
    type: string;
    enabled: boolean;
    properties: Record<string, unknown>;
}
interface FindNodeResult {
    nodeObj: CocosObject;
    nodeIndex: number;
    prefabInfo: CocosObject;
    prefabInfoIndex: number;
}
interface FindComponentResult {
    compObj: CocosObject;
    compIndex: number;
    compPrefabInfo: CocosObject;
    compPrefabInfoIndex: number;
    fileId: string;
}
export declare function setComponentTemplateProvider(fn: (typeName: string) => Record<string, unknown> | null): void;
export declare class Document {
    private _json;
    private _tree;
    private _path;
    private _kind;
    private _dirty;
    private _undoStack;
    private _maxUndo;
    private _snapshot;
    private _nodeFlatIndex;
    private _prefabInfoIndex;
    private _compToCpiIndex;
    constructor(jsonArray: CocosObject[], assetPath: string, kind: DocumentKind, tree: TreeNode | null);
    get kind(): DocumentKind;
    get dbUrl(): string;
    get isDirty(): boolean;
    get rootName(): string;
    static open(projectPath: string, assetPath: string, kind?: DocumentKind): {
        ok: true;
        doc: Document;
    } | {
        ok: false;
        error: string;
        code: string;
    };
    static create(rootName: string, kind?: DocumentKind): {
        ok: true;
        doc: Document;
    };
    serialize(): string;
    setPath(assetPath: string, kind?: DocumentKind): void;
    ctx(): {
        rootTree: TreeNode | null;
        name: string;
        rootNodeUuid: string;
        childCount: number;
        capturedNodeCount: number;
    };
    detail(fileId: string): Record<string, unknown> | null;
    readProperty(rawRef: string, componentType: string, propertyName?: string): Record<string, unknown>;
    /** 惰性构建 PrefabInfo 索引（fileId → _json 数组下标），O(1) findNode */
    private _ensurePrefabInfoIndex;
    /** _json 变异后使索引失效（惰性重建） */
    private _invalidateCaches;
    findNode(fileId: string): FindNodeResult | null;
    /** 惰性构建 CompPrefabInfo → Component 反向索引 */
    private _ensureCompToCpiIndex;
    findComponent(fileId: string): FindComponentResult | null;
    findComponentByType(nodeFileId: string, componentType: string): FindComponentResult | null;
    /** 统一节点引用解析入口。
     *  接受 #fileId / 路径 / 模糊名，返回 FindNodeResult 或错误。
     *  edit() 和 readProperty() 在处理前调用此方法。 */
    resolveNodeRef(ref: string): FindNodeResult | {
        ok: false;
        error: string;
        code: string;
        matches?: Array<{
            name: string;
            path: string;
            fileId: string;
        }>;
    };
    /** 模糊名搜索（供 >probe(find-in-doc) 使用） */
    findNodesByFuzzyName(query: string, maxResults?: number): Array<{
        name: string;
        path: string;
        fileId: string;
        childCount: number;
        compTypes: string[];
    }>;
    /** 模糊名匹配引擎 */
    private _fuzzyMatchNames;
    /** 从 TreeNode 重建扁平名索引
     *  @param prebuilt _buildTree 返回的预收集数据，传入则跳过独立遍历 */
    rebuildFlatIndex(prebuilt?: Array<{
        name: string;
        fileId: string;
        path: string;
        compTypes: string[];
        childCount: number;
    }>): void;
    edit(editType: string, payload: Record<string, unknown>): Record<string, unknown>;
    save(): {
        ok: boolean;
        path?: string;
        error?: string;
    };
    undo(): {
        ok: boolean;
        error?: string;
    };
    private get _dbUrl();
    private _rollback;
    private _addComponent;
    /** 将 Gateway 组装的子树追加到已有文档末尾。
     *  subtree 带 local __id__，本方法做 offset+remap，
     *  与 _duplicateNode 共享 _remapObjRefs 核心逻辑。 */
    private _addNodeTree;
    /** 将 prop 值中的 fileId 字符串（22-23 char base64url）解析为 {__id__:N} */
    private _resolvePropValue;
    private _setProperty;
    private _setProperties;
    private _deleteNode;
    private _reparentNode;
    private _duplicateNode;
    private _setNodeActive;
    /** 将所有存活对象中对已删除索引的 { __id__: N } 引用替换为 null */
    private _nullifyDeletedRefs;
    private _findNodeInTree;
    private static _buildTree;
    private static _countNodes;
    private static _buildPaths;
    private static _safeProp;
    private static _compact;
    private static _remapIds;
    private static _collectSubtree;
    private static _applyProp;
    private static _normalizeValue;
    private static _remapRefs;
    private static _remapObjRefs;
}
export {};
//# sourceMappingURL=document.d.ts.map