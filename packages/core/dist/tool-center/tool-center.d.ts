import { CmdResult } from '../types';
export interface ToolCenterTask {
    type: 'probe' | 'write' | 'open' | 'edit' | 'save';
    payload?: Record<string, unknown>;
}
export interface ToolCenterOptions {
    projectPath: string;
    timeoutMs?: number;
    pollMs?: number;
}
/** bridge.json 完整心跳包。与 document-state.ts:BridgeHeartbeat 同源，结构超集。 */
export interface BridgeHeartbeatInfo {
    schema: string;
    projectPath: string;
    root: string;
    inbox: string;
    processing: string;
    outbox: string;
    updatedAt: string;
    openDocument?: {
        kind: string;
        path: string;
    };
    hasOpenDocument?: boolean;
    editorCapabilities?: Record<string, unknown>;
    [key: string]: unknown;
}
export declare class ToolCenter {
    private _projectPath;
    private _root;
    private _inbox;
    private _processing;
    private _outbox;
    private _timeoutMs;
    private _pollMs;
    private _online;
    private _healthTimer;
    constructor(options: ToolCenterOptions);
    start(): Promise<boolean>;
    destroy(): void;
    submit(task: ToolCenterTask, signal?: AbortSignal): Promise<CmdResult>;
    health(): Promise<boolean>;
    getBridgeInfo(): BridgeHeartbeatInfo | null;
    getCapabilities(): Record<string, unknown> | null;
    get isOnline(): boolean;
    startHealthChecks(intervalMs?: number): void;
    stopHealthChecks(): void;
}
//# sourceMappingURL=tool-center.d.ts.map