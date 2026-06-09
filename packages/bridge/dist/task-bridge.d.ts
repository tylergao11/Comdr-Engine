export interface TaskBridgeOptions {
    getProjectPath: () => string;
    getEditorAppPath?: () => string;
    getOpenDocument?: () => {
        kind: string;
        path: string;
        name: string;
    } | null;
    runTaskCard: (taskCard: {
        type: string;
        payload?: Record<string, unknown>;
    }) => Promise<unknown>;
    intervalMs?: number;
    taskTimeoutMs?: number;
}
export declare class TaskBridge {
    private _opts;
    private _timer;
    private _processing;
    private _engineSourceInfo;
    private _engineSourceDiscovered;
    private _internalAssetInfo;
    private _internalAssetDiscovered;
    constructor(options: TaskBridgeOptions);
    start(): void;
    stop(): void;
    private _getDirs;
    private _tick;
    private _processFile;
    private _writeResult;
    private _recoverProcessing;
    private _discoverEngineSource;
    /** 加载 sync 脚本预提取的 internal 资产目录（构建时生成，零运行时路径依赖） */
    private _discoverInternalAssets;
    private _writeHeartbeat;
    private _withTimeout;
}
//# sourceMappingURL=task-bridge.d.ts.map