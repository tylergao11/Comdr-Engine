import { AssemblyOptions, AssemblyResult } from '../types';
export declare function runAssemblyProcess(options: AssemblyOptions): Promise<AssemblyResult>;
export declare class AssemblyGateway {
    private opts;
    private toolCenter;
    private snapshotManager;
    private commanderMessages;
    private _catalog;
    private _internalCatalog;
    private resolver;
    private _diffs;
    private _rollbacks;
    private _lastErrorKey;
    private _consecutiveSameError;
    /** 跨轮编辑错误计数（不因 probe 成功重置），key = type:errorCode */
    private _editErrorCounts;
    /** 已探测摘要：query → hit count */
    private _probeQueries;
    /** 已知节点：name → fileId */
    private _knownNodes;
    /** 状态窗口（diff-based，最多 5 条）：key → entry，保持插入顺序 */
    private _stateWindow;
    /** 上次 done() 任务摘要，新 task 启动时注入 session state */
    private _previousTaskSummary;
    constructor(options: AssemblyOptions);
    run(): Promise<AssemblyResult>;
    /** 破坏性操作前捕获 before 快照（以资源路径为 key，幂等）。
     *  只对编辑类命令生效——compile+write 创建新资产，无需回滚。 */
    private _captureBeforeIfNeeded;
    /** done() 成功后：拍 after 快照 → diff */
    private _finalizeSnapshots;
    /** 命令失败时回滚受影响的资源 */
    private _rollbackAffectedResource;
    /** 拉取指定时间窗口内的 console 日志 */
    private _pullConsoleLogs;
    /** 从命令中解析出目标资源路径 */
    private _resolveCommandPath;
    /** 从本轮结果更新累积状态（已探测查询 + 已知节点）+ 状态窗口 */
    private _updateCumulativeState;
    /** 从本轮命令结果构建状态窗口条目（diff-based，同 key 覆盖，最多 5 条） */
    private _updateStateWindow;
    /** 从单条命令结果提取状态条目（可能 0-多条）。
     *  条目仅做身份标记，组件详情见 # Results: 中的 probe 结果。 */
    private _extractStateEntries;
    /** 插入或覆盖状态条目（同 key 覆盖，保持插入顺序，超出上限移除最旧）。
     *  新 node:* 条目自动清理同名的 del:* 条目（重建场景）。 */
    private _upsertStateEntry;
    /** 移除指定 key 的状态条目 */
    private _removeStateEntry;
    /** 根据 fileId 在 _knownNodes 里反向查找节点名 */
    private _lookupNodeName;
    /** 构建状态窗口摘要文本，替代旧的累积摘要 */
    private _buildStateWindow;
    /** 裁剪对话历史，保持最多 MAX_HISTORY_TURNS 个来回，注入状态摘要。
     *  messages[0] = system, messages[1] = session锚点 — 不裁剪，永久保留。 */
    private _trimHistory;
}
//# sourceMappingURL=assembly-gateway.d.ts.map