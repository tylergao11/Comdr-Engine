export interface NodeEntry {
    name: string;
    fileId: string;
    components: string[];
    children: NodeEntry[];
}
export interface PrefabEntry {
    path: string;
    rootName: string;
}
export interface SceneEntry {
    path: string;
}
export interface ScriptEntry {
    className: string;
    path: string;
}
export interface ResourceEntry {
    path: string;
    uuid: string;
    type: string;
}
export interface ProjectSnapshot {
    openDocument: {
        kind: 'prefab' | 'scene' | 'none';
        path: string;
        nodes: NodeEntry[];
    };
    prefabs: PrefabEntry[];
    scenes: SceneEntry[];
    scripts: ScriptEntry[];
    resources: ResourceEntry[];
    collectedAt: string;
}
export declare const EMPTY_SNAPSHOT: ProjectSnapshot;
/** 从 assets probe 结果提取 prefab/scene/resource 列表 */
export declare function buildFromAssetsProbe(data: unknown): {
    prefabs: PrefabEntry[];
    scenes: SceneEntry[];
    resources: ResourceEntry[];
};
/** 从 scripts probe 结果提取脚本列表 */
export declare function buildFromScriptsProbe(data: unknown): ScriptEntry[];
/** 从 ctx() probe 结果的字符串摘要解析节点信息（受限于 Commander 返回的摘要文本） */
export declare function buildNodeEntriesFromCtx(data: unknown): NodeEntry[];
/** 在节点树中递归搜索匹配名字的节点 */
export declare function findNodeByName(nodes: NodeEntry[], name: string): NodeEntry | null;
/** 在节点树中收集所有节点名（扁平列表） */
export declare function collectNodeNames(nodes: NodeEntry[]): string[];
//# sourceMappingURL=project-snapshot.d.ts.map