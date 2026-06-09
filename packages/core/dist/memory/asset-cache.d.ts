export interface CacheEntry {
    uuid: string;
    updatedAt: string;
}
export interface AssetCacheData {
    schema: 'Comdr.asset-cache.v1';
    projectRoot: string;
    updatedAt: string;
    entries: Record<string, CacheEntry>;
}
export declare class AssetCache {
    private _projectRoot;
    private _cachePath;
    private _entries;
    private _dirty;
    private _autoFlushTimer;
    constructor(projectRoot: string, cachePath?: string);
    load(): void;
    get(assetPath: string): string | null;
    getBatch(paths: string[]): (string | null)[];
    has(assetPath: string): boolean;
    allEntries(): Record<string, CacheEntry>;
    set(assetPath: string, uuid: string): void;
    setBatch(map: Record<string, string>): void;
    invalidate(assetPath: string): void;
    invalidateAll(): void;
    get isDirty(): boolean;
    flush(): void;
    /** 启用自动刷新（5 分钟间隔） */
    enableAutoFlush(intervalMs?: number): void;
    /** 停用自动刷新定时器（不 flush） */
    disableAutoFlush(): void;
    /** 销毁定时器并刷新 */
    destroy(): void;
}
//# sourceMappingURL=asset-cache.d.ts.map