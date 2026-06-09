import type { CompileSpec, NodeSpec, ComponentSpec, AssemblerResult } from './model/cocos-world';
import type { PrefabDiffResult } from './perception/prefab-diff';
export type { CompileSpec, NodeSpec, ComponentSpec, AssemblerResult };
/** 成功结果，所有操作统一此格式 */
export interface OkResult<T = unknown> {
    ok: true;
    data?: T;
    [key: string]: unknown;
}
/** 失败结果，每个错误必定有 errorCode */
export interface ErrResult {
    ok: false;
    error: string;
    errorCode: string;
    needMoreContext?: boolean;
    fatal?: boolean;
    notes?: NoteEntry[];
}
export type Result<T = unknown> = OkResult<T> | ErrResult;
export interface NoteEntry {
    kind: 'guess' | 'warn';
    text: string;
}
export interface CmdResult {
    ok: boolean;
    type?: string;
    data?: unknown;
    error?: string;
    errorCode?: string;
    needMoreContext?: boolean;
    notes?: NoteEntry[];
    fatal?: boolean;
    /** Gateway 本地修正记录（不浪费 LLM 轮次） */
    autoCorrected?: {
        from: string;
        to: string;
    };
}
/** 完整的 DSL 命令类型 — parser 输出 + executor switch 必须穷尽此联合 */
export type DslCommandType = 'probe' | 'detail' | 'open' | 'schema' | 'compile' | 'write' | 'save' | 'undo' | 'add-node' | 'add-comp' | 'set-prop' | 'set-props' | 'delete-node' | 'reparent' | 'duplicate' | 'set-active' | 'note' | 'ask' | 'done' | 'help';
/** @deprecated 使用 DslCommandType */
export type DslCommandKind = DslCommandType;
/** 编辑子命令类型 */
export type EditKind = 'set-prop' | 'set-props' | 'delete-node' | 'reparent' | 'duplicate' | 'set-active' | 'add-component' | 'add-node-tree';
export interface DslCommand {
    type: DslCommandType;
    notes?: NoteEntry[];
    probeType?: string;
    path?: string;
    paths?: string[];
    nodeUuid?: string;
    component?: string;
    property?: string;
    pattern?: string;
    query?: string;
    assetPath?: string;
    spec?: CompileSpec;
    tempId?: string;
    parent?: string;
    name?: string;
    compType?: string;
    props?: Record<string, unknown>;
    contentSize?: {
        width: number;
        height: number;
    };
    anchorPoint?: {
        x: number;
        y: number;
    };
    position?: {
        x: number;
        y: number;
        z: number;
    };
    scale?: {
        x: number;
        y: number;
        z: number;
    };
    active?: boolean;
    assetType?: string;
    json?: unknown;
    dbUrl?: string;
    saveMode?: string;
    question?: string;
    editType?: EditKind;
    value?: unknown;
    values?: Record<string, unknown>;
    [key: string]: unknown;
}
export interface ParsedDslOutput {
    commands: DslCommand[];
    done: boolean;
    rawNotes?: NoteEntry[];
    /** done() 携带的汇报数据，Commander 用 key=value 总结本轮做了什么 */
    doneReport?: Record<string, unknown>;
    /** 被忽略的未知命令名列表，供 Gateway 反馈给 Commander */
    warnings?: string[];
}
export interface AssemblyOptions {
    request: string;
    projectPath: string;
    sessionMemory: import('./memory/session-memory').CommanderState;
    assetCache: import('./memory/asset-cache').AssetCache;
    documentState: import('./memory/document-state').DocumentState;
    provider: string;
    model: string;
    baseUrl: string;
    apiKey: string;
    temperature?: number;
    signal?: AbortSignal;
    onFeedback?: (text: string) => void;
    onExecutionEvent?: (event: ExecutionEvent) => void;
    /** 从上一轮 ask 恢复的对话状态，Gateway 自动恢复 messages + tempIds + 已知节点 */
    commanderSnapshot?: import('./memory/session-store').CommanderSnapshot;
}
export interface AssemblyResult {
    ok: boolean;
    status?: 'completed' | 'cancelled' | 'error' | 'ask';
    error?: string;
    round: number;
    results?: ExecutedCommand[];
    notes?: NoteEntry[];
    cancelled?: boolean;
    /** done() 携带的汇报数据，Commander 总结本轮做了什么 */
    doneReport?: Record<string, unknown>;
    /** Commander 发出 >ask() 时的问题数据 — 直接返回给外部 LLM */
    ask?: Record<string, unknown>;
    /** done() 成功时的结构化差异报告 */
    diffs?: PrefabDiffResult[];
    /** 回滚记录 */
    rollbacks?: RollbackResult[];
    /** Commander ask 时的完整对话快照 — 调用方保存到 session，下次恢复 */
    commanderSnapshot?: import('./memory/session-store').CommanderSnapshot;
}
export interface RollbackResult {
    path: string;
    success: boolean;
    error?: string;
    /** 回滚时的 console 错误/警告日志（操作时间窗口内） */
    consoleLogs?: ConsoleLogEntry[];
}
export interface ConsoleLogEntry {
    level: string;
    message: string;
    timestamp: number;
}
export interface ExecutedCommand {
    command: DslCommand;
    result: CmdResult;
}
export type ExecutionEventKind = 'session-start' | 'session-done' | 'session-error' | 'round-start' | 'command-executed';
export interface ExecutionEvent {
    schema: 'Comdr.execution-event.v1';
    seq: number;
    kind: ExecutionEventKind;
    round: number;
    index?: number;
    command?: {
        type: string;
        [key: string]: unknown;
    };
    result?: {
        ok: boolean;
        type?: string;
        error?: string;
        errorCode?: string;
        data?: unknown;
    };
    elapsedMs?: number;
    totalRounds?: number;
    status?: 'completed' | 'max_rounds' | 'cancelled' | 'error' | 'ask';
    ask?: string;
    error?: string;
    message?: string;
    /** done() 携带的汇报数据，Overlay 展示用 */
    doneReport?: Record<string, unknown>;
    timestamp: string;
}
export interface AssetPathRef {
    path: string;
    parent: Record<string, unknown>;
    key: string;
    resolved?: string;
}
//# sourceMappingURL=types.d.ts.map