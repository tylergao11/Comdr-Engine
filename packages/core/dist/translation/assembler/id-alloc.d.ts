export declare function generateFileId(): string;
export interface IdAllocResult {
    objects: Record<string, unknown>[];
    idMap: Map<Record<string, unknown>, number>;
    rootId: number | null;
}
/** 深度遍历对象树，为所有 __type__ 对象分配递增 ID（值类型除外） */
export declare function allocateIds(root: Record<string, unknown>): IdAllocResult;
//# sourceMappingURL=id-alloc.d.ts.map