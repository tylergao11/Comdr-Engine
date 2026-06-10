export declare const DOCUMENT_KINDS: {
    readonly SCENE: "scene";
    readonly PREFAB: "prefab";
    readonly NONE: "none";
};
export type DocumentKind = (typeof DOCUMENT_KINDS)[keyof typeof DOCUMENT_KINDS];
export interface DocumentStateInfo {
    kind: DocumentKind;
    dbUrl: string | null;
    path: string | null;
    assetUuid: string | null;
    rootUuid: string | null;
    name: string | null;
}
/** 与 tool-center.ts:BridgeHeartbeatInfo 同源 bridge.json，保持兼容 */
export interface BridgeHeartbeatDocument {
    kind?: string;
    path?: string;
    dbUrl?: string;
    assetUuid?: string;
    rootNodeUuid?: string;
    name?: string;
}
/** 与 tool-center.ts:BridgeHeartbeatInfo 同源 bridge.json，保持兼容 */
export interface BridgeHeartbeat {
    openDocument?: BridgeHeartbeatDocument;
    hasOpenDocument?: boolean;
    currentScene?: Record<string, unknown>;
}
export declare class DocumentState {
    private _current;
    private _history;
    openScene(dbUrl: string, assetUuid?: string, rootUuid?: string, name?: string): void;
    openPrefab(dbUrl: string, assetUuid?: string, rootUuid?: string, name?: string): void;
    close(): void;
    getCurrent(): Readonly<DocumentStateInfo>;
    isEditingScene(): boolean;
    isEditingPrefab(): boolean;
    hasOpen(): boolean;
    /** 从 Bridge 心跳更新文档状态 */
    updateFromHeartbeat(hb: BridgeHeartbeat): void;
    /** 是否匹配给定的目标 */
    matchesTarget(targetKind: string, targetPath?: string): boolean;
    getHistory(n?: number): DocumentStateInfo[];
    private _pushHistory;
    private _sameDoc;
}
//# sourceMappingURL=document-state.d.ts.map