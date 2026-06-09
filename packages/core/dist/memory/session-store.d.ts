export interface CreatedAsset {
    path: string;
    uuid: string;
    purpose: string;
    at: string;
}
/** Commander 跨调用恢复所需的完整对话状态 */
export interface CommanderSnapshot {
    messages: Array<{
        role: string;
        content: string;
    }>;
    tempIdMappings: Record<string, string>;
    knownNodes: Record<string, string>;
    probeQueries: Record<string, number>;
    turn: number;
}
export interface Session {
    sessionId: string;
    projectPath: string;
    createdAt: string;
    modifiedAt: string;
    createdAssets: CreatedAsset[];
    modifiedAssets: string[];
    openDocument: {
        kind: string;
        path: string;
    } | null;
    /** Commander ask 时的对话快照，下次调用恢复后可继续对话 */
    commanderSnapshot?: CommanderSnapshot;
}
/** 加载会话，不存在则创建新的 */
export declare function loadSession(sessionId: string): Session;
/** 保存会话到磁盘 */
export declare function saveSession(session: Session): void;
/** 记录创建的资产 */
export declare function recordCreated(session: Session, assetPath: string, uuid: string, purpose: string): void;
/** 记录修改的资产 */
export declare function recordModified(session: Session, assetPath: string): void;
/** 记录打开的文档 */
export declare function recordOpenDocument(session: Session, kind: string, filePath: string): void;
/** 生成会话摘要（给 Commander 用） */
export declare function buildSummary(session: Session): Record<string, unknown>;
//# sourceMappingURL=session-store.d.ts.map