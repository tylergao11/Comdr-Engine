export interface InternalAssetEntry {
    uuid: string;
    type: string;
    name: string;
    subAsset?: string;
}
/** 是否为 internal: 引用 */
export declare function isInternalRef(value: unknown): value is string;
/** 从 internal:xxx 提取资产名 */
export declare function parseInternalRef(value: string): string | null;
export declare class InternalAssetCatalog {
    private _assets;
    private _loaded;
    /** 从 Bridge 心跳加载（优先于内置回退） */
    loadFromBridge(bridgeAssets: Record<string, {
        uuid: string;
        type: string;
        name: string;
    }> | undefined, _projectPath?: string): number;
    /** 获取资产条目 */
    get(name: string): InternalAssetEntry | null;
    /** 解析 internal:xxx 引用 → 完整条目 */
    resolve(ref: string): InternalAssetEntry | null;
    /** 解析为 Cocos 引用对象 { __uuid__: ..., __expectedType__: ... } */
    resolveToAssetRef(ref: string): Record<string, string> | null;
    get loaded(): boolean;
    get size(): number;
    /** 列出所有已知 key（供 Commander 提示） */
    listKeys(): string[];
}
//# sourceMappingURL=internal-catalog.d.ts.map