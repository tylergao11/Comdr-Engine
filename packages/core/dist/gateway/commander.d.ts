export interface CommanderMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
export interface CommanderOptions {
    messages: CommanderMessage[];
    request?: string;
    context?: string;
    provider: string;
    model: string;
    baseUrl: string;
    apiKey: string;
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
}
export interface CommanderResponse {
    text: string;
    raw: Record<string, unknown>;
    finishReason?: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
    };
}
export declare function callCommander(opts: CommanderOptions): Promise<CommanderResponse>;
//# sourceMappingURL=commander.d.ts.map