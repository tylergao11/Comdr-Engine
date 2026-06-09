export declare const TOOL_DEFINITION: {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            request: {
                type: string;
                description: string;
            };
            projectPath: {
                type: string;
                description: string;
            };
            model: {
                type: string;
                description: string;
            };
            sessionId: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare function handleInitialize(_id: string | number | undefined, _params: Record<string, unknown>): Record<string, unknown>;
export declare function handleToolsList(_id: string | number | undefined): Record<string, unknown>;
export declare function handleCancel(params: Record<string, unknown>, pendingAborts: Map<string, AbortController>): void;
export interface ToolCallResult {
    text: string;
    isError: boolean;
    rollbacks?: unknown[];
    diffs?: unknown[];
}
export declare function handleToolsCall(args: Record<string, unknown>, signal: AbortSignal): Promise<ToolCallResult>;
//# sourceMappingURL=comdr-ask.d.ts.map