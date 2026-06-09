declare class McpServer {
    private _rl;
    private _pendingAborts;
    start(): Promise<void>;
    stop(): void;
    private _processLine;
    private _handleToolsCall;
    private _respond;
    private _write;
}
export declare const MCP_SERVER: McpServer;
export {};
//# sourceMappingURL=server.d.ts.map