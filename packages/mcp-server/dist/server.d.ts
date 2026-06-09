declare class McpServer {
    private _rl;
    private _pendingAborts;
    start(): Promise<void>;
    stop(): void;
    private _processLine;
    private _handleToolsCall;
    /** Image 工具统一响应包装 — 三个工具（read/slice/generate）共享同一 try/catch 结构 */
    private _handleImageTool;
    private _respond;
    private _write;
}
export declare const MCP_SERVER: McpServer;
export {};
//# sourceMappingURL=server.d.ts.map