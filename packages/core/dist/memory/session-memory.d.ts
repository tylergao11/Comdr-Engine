export interface DocumentInfo {
    kind: 'scene' | 'prefab' | 'none';
    path: string | null;
    rootUuid: string | null;
    name: string | null;
}
export declare class CommanderState {
    private _tempIdMap;
    private _pendingDelta;
    private _currentDocument;
    private _turn;
    static create(): CommanderState;
    setTempIdMapping(tempId: string, realUuid: string): void;
    setTempIdMappings(map: Record<string, string>): void;
    /** 本轮新增的 tempId 列表（仅 ID 名，不含 UUID），调用后清空 pending */
    flushDelta(): string[];
    getRealUuid(tempId: string): string | null;
    /** 将文本中所有已知 tempId 替换为真实 UUID。按长度降序避免短名破坏长名 */
    resolveTempIds(text: string): string;
    getTempIdMappings(): Record<string, string>;
    setCurrentDocument(doc: DocumentInfo): void;
    getCurrentDocument(): DocumentInfo;
    hasOpenDocument(): boolean;
    nextTurn(): number;
    getTurn(): number;
    reset(): void;
}
/** @deprecated 使用 CommanderState */
export declare const SessionMemory: typeof CommanderState;
//# sourceMappingURL=session-memory.d.ts.map