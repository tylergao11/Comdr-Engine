/** DiffEntry.type — 通过 DiffEntry 间接使用，非直接 import */
export type DiffType = 'added' | 'removed' | 'modified';
export interface DiffEntry {
    type: DiffType;
    nodeName: string;
    nodeId: string;
    componentType?: string;
    property?: string;
    beforeValue?: unknown;
    afterValue?: unknown;
    /** 人可读摘要，例如 "Button: normalColor #FFF → #F00" */
    summary: string;
}
export interface PrefabDiffResult {
    path: string;
    entries: DiffEntry[];
    empty: boolean;
}
/** 比较两个 prefab JSON 数组，返回结构化差异 */
export declare function diffPrefab(path: string, before: unknown[], after: unknown[]): PrefabDiffResult;
/** 批量 diff，返回所有有差异的结果 */
export declare function diffAllSnapshots(snapshots: Array<{
    path: string;
    before: unknown[];
    after: unknown[];
}>): PrefabDiffResult[];
/** 汇总差异为多行文本 */
export declare function formatDiffResults(diffs: PrefabDiffResult[]): string;
//# sourceMappingURL=prefab-diff.d.ts.map