export interface BackupData {
    json: unknown[];
    filePath: string;
    assetType: string;
}
export interface BackupInfo {
    timestamp: number;
    filePath: string;
    hasData: boolean;
}
export interface SnapshotEntry {
    path: string;
    kind: 'prefab' | 'scene';
    before: unknown[];
    after: unknown[] | null;
    capturedAt: number;
}
export declare class SnapshotManager {
    private _snapshots;
    private _backup;
    private _timestamp;
    /** @deprecated 使用 SnapshotManager */
    static create(): SnapshotManager;
    /** 记录操作前状态，path 已有时不重复拍 */
    captureBefore(path: string, kind: 'prefab' | 'scene', json: string): boolean;
    /** done() 成功时记录操作后状态 */
    captureAfter(path: string, json: string): boolean;
    /** 是否有该资源的快照 */
    hasBefore(path: string): boolean;
    /** 获取单个快照条目（只读） */
    getSnapshot(path: string): SnapshotEntry | null;
    /** 全部条目（供 diff 遍历） */
    getAllEntries(): SnapshotEntry[];
    /** 只读读取 before（不消耗） */
    peekBefore(path: string): {
        before: unknown[];
        kind: string;
    } | null;
    /** 消耗型读取（回滚用），取出后从 Map 中移除 */
    consumeSnapshot(path: string): SnapshotEntry | null;
    /** 回滚写入失败时放回快照 */
    restoreSnapshot(entry: SnapshotEntry): void;
    /** 清除单个资源快照 */
    clearSnapshot(path: string): void;
    /** 会话结束清理 */
    clearAll(): void;
    /** 本次调用触及的所有资源路径 */
    touchedPaths(): string[];
    /** 快照表中资源数量 */
    get snapshotCount(): number;
    /** @deprecated 使用 captureBefore 替代 */
    storeBackup(serializedJson: string, filePath: string, assetType: string): boolean;
    /** 非破坏性读取备份（不消耗） */
    peekBackup(): BackupData | null;
    /** 获取备份数据，一次读取后自动清除 */
    getBackup(): BackupData | null;
    /** 恢复备份（写入失败时调用） */
    restoreBackup(backup: BackupData): void;
    /** 是否有可用备份 */
    canUndo(): boolean;
    /** 清除备份（操作成功确认后调用） */
    clear(): void;
    /** 获取备份元信息（不消耗备份） */
    getInfo(): BackupInfo | null;
}
/** @deprecated 使用 SnapshotManager */
export declare const UndoManager: typeof SnapshotManager;
//# sourceMappingURL=undo-manager.d.ts.map