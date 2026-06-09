export interface ProviderConfig {
    baseUrl: string;
    model: string;
    fastModel: string;
    strongModel: string;
    baseUrlMode: string;
    callMode: 'normal' | 'streaming';
    thinking: string;
    reasoningEffort: string;
    cacheProfile: string;
    apiKeyEnv: string;
    apiKey: string;
    timeoutMs: number;
}
export interface GatewayConfig {
    schema: 'Comdr.gateway-config.v1';
    configPath: string;
    defaultProvider: string;
    providers: Record<string, ProviderConfig>;
    defaults: {
        timeoutMs: number;
        audit: boolean;
    };
}
export interface ActiveProvider extends ProviderConfig {
    provider: string;
    hasApiKey: boolean;
}
export declare const MODEL_TIERS: {
    readonly fast: "fast";
    readonly balanced: "balanced";
    readonly strong: "strong";
};
export type ModelTier = keyof typeof MODEL_TIERS;
export declare function loadGatewayConfig(options?: Partial<{
    configPath: string;
}>): GatewayConfig;
export declare function saveGatewayConfig(input: Partial<GatewayConfig>, options?: {
    configPath?: string;
}): GatewayConfig;
export declare function getActiveProvider(config?: GatewayConfig): ActiveProvider;
/** 解析 Commander 使用的模型名 */
export declare function resolveCommanderModel(provider: ActiveProvider, tier?: ModelTier): string;
export declare function getConfig(): GatewayConfig | null;
//# sourceMappingURL=config-store.d.ts.map