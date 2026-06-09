"use strict";
// ============================================================
// ConfigStore — 多提供商网关配置管理
// 存储位置: ~/.comdr/gateway.config.json
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODEL_TIERS = void 0;
exports.loadGatewayConfig = loadGatewayConfig;
exports.saveGatewayConfig = saveGatewayConfig;
exports.getActiveProvider = getActiveProvider;
exports.resolveCommanderModel = resolveCommanderModel;
exports.getConfig = getConfig;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const value_kit_1 = require("../foundation/value-kit");
exports.MODEL_TIERS = {
    fast: 'fast',
    balanced: 'balanced',
    strong: 'strong',
};
// ===== 默认配置 =====
const CONFIG_SCHEMA = 'Comdr.gateway-config.v1';
const OLD_CONFIG_SCHEMA = 'Cmdr.gateway-config.v1'; // 旧版本兼容
const DEFAULT_CONFIG_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.comdr');
const OLD_CONFIG_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.cmdr');
const DEFAULT_CONFIG_PATH = path.join(DEFAULT_CONFIG_DIR, 'gateway.config.json');
const OLD_CONFIG_PATH = path.join(OLD_CONFIG_DIR, 'gateway.config.json');
const DEFAULT_OPENAI = {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    fastModel: 'gpt-4o-mini',
    strongModel: 'gpt-4o',
    baseUrlMode: 'path',
    callMode: 'normal',
    thinking: 'disabled',
    reasoningEffort: 'medium',
    cacheProfile: 'claude-default',
    apiKeyEnv: 'OPENAI_API_KEY',
    apiKey: '',
    timeoutMs: 120000,
};
const DEFAULT_ANTHROPIC = {
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-sonnet-4-6',
    fastModel: 'claude-haiku-4-5-20251001',
    strongModel: 'claude-opus-4-8',
    baseUrlMode: 'path',
    callMode: 'normal',
    thinking: 'disabled',
    reasoningEffort: 'medium',
    cacheProfile: 'claude-default',
    apiKeyEnv: 'ANTHROPIC_AUTH_TOKEN',
    apiKey: '',
    timeoutMs: 120000,
};
function defaultConfig(configPath) {
    return {
        schema: CONFIG_SCHEMA,
        configPath: configPath || DEFAULT_CONFIG_PATH,
        defaultProvider: 'anthropic',
        providers: {
            anthropic: { ...DEFAULT_ANTHROPIC },
            openai: { ...DEFAULT_OPENAI },
        },
        defaults: {
            timeoutMs: 120000,
            audit: false,
        },
    };
}
// ===== 加载/保存 =====
let _config = null;
function loadGatewayConfig(options) {
    if (_config)
        return _config;
    const configPath = options?.configPath || DEFAULT_CONFIG_PATH;
    let data = (0, value_kit_1.readJsonUtf8)(configPath);
    // 迁移：新路径无数据时尝试旧路径 (cmdr → comdr 重命名兼容)
    if (!data) {
        const oldPath = options?.configPath
            ? options.configPath.replace(/[\\/]\.comdr[\\/]/, (sep) => `${sep}.cmdr${sep}`)
            : OLD_CONFIG_PATH;
        const oldData = (0, value_kit_1.readJsonUtf8)(oldPath);
        if (oldData && (oldData.schema === OLD_CONFIG_SCHEMA || oldData.schema === CONFIG_SCHEMA)) {
            data = { ...oldData, schema: CONFIG_SCHEMA };
            // 写入新位置
            fs.mkdirSync(path.dirname(configPath), { recursive: true });
            (0, value_kit_1.writeJsonAtomic)(configPath, data, true);
        }
    }
    if (data && (data.schema === CONFIG_SCHEMA || data.schema === OLD_CONFIG_SCHEMA)) {
        // 合并默认值（保证新增字段存在）
        const defaults = defaultConfig(configPath);
        _config = {
            ...defaults,
            ...data,
            providers: { ...defaults.providers, ...data.providers },
            defaults: { ...defaults.defaults, ...data.defaults },
        };
    }
    else {
        _config = defaultConfig(configPath);
    }
    return _config;
}
function saveGatewayConfig(input, options) {
    const config = loadGatewayConfig(options);
    const merged = {
        ...config,
        ...input,
        providers: { ...config.providers, ...input.providers },
        defaults: { ...config.defaults, ...input.defaults },
    };
    const configPath = options?.configPath || config.configPath || DEFAULT_CONFIG_PATH;
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    (0, value_kit_1.writeJsonAtomic)(configPath, merged, true);
    _config = merged;
    return merged;
}
// ===== Claude Code 主机检测 =====
/** Claude Code 作为主机时自动注入的凭据，无需用户额外配置 */
function detectClaudeCodeCredentials() {
    const token = process.env['ANTHROPIC_AUTH_TOKEN'] || '';
    const baseUrl = process.env['ANTHROPIC_BASE_URL'] || '';
    const model = process.env['ANTHROPIC_MODEL'] || '';
    const fastModel = process.env['ANTHROPIC_DEFAULT_HAIKU_MODEL'] || '';
    const strongModel = process.env['ANTHROPIC_DEFAULT_OPUS_MODEL'] || '';
    return { apiKey: token, baseUrl, model, fastModel, strongModel };
}
// ===== 活动提供商 =====
function getActiveProvider(config) {
    const cfg = config || loadGatewayConfig();
    const providerName = cfg.defaultProvider || 'anthropic';
    const provider = cfg.providers[providerName]
        || cfg.providers['anthropic']
        || (() => { throw new Error('No provider configured — missing anthropic default'); })();
    // Claude Code 自动凭据检测：如果主机已注入 ANTHROPIC_AUTH_TOKEN，自动使用
    const ccCreds = detectClaudeCodeCredentials();
    // API Key 优先级：显式配置 > 提供商 env var > Claude Code 注入
    const apiKey = provider.apiKey
        || process.env[provider.apiKeyEnv]
        || ccCreds.apiKey
        || '';
    const hasApiKey = apiKey.length > 0;
    // Base URL 优先级：Claude Code 注入 > 显式配置
    const effectiveBaseUrl = ccCreds.baseUrl || provider.baseUrl;
    // 根据 Claude Code 注入的 baseUrl 自动推断真实 API 格式
    let effectiveProvider = providerName;
    if (ccCreds.baseUrl) {
        // /anthropic 路径 → Anthropic Messages API 格式
        if (ccCreds.baseUrl.endsWith('/anthropic') || ccCreds.baseUrl.includes('api.anthropic.com'))
            effectiveProvider = 'anthropic';
        // 否则走 OpenAI 兼容格式（/v1 路径等）
        else if (ccCreds.baseUrl.endsWith('/v1') || ccCreds.baseUrl.includes('/v1/'))
            effectiveProvider = 'openai';
    }
    // 模型优先级：Claude Code 注入的 model 优先（跟随主机配置）
    // 剥掉 Claude Code 内部标记如 [1m]（API 不认）
    const cleanModel = (m) => m.replace(/\[\d+m\]/g, '').trim();
    const effectiveModel = cleanModel(ccCreds.model || provider.model);
    const effectiveFastModel = cleanModel(ccCreds.fastModel || provider.fastModel);
    const effectiveStrongModel = cleanModel(ccCreds.strongModel || provider.strongModel);
    return {
        ...provider,
        provider: effectiveProvider,
        baseUrl: effectiveBaseUrl,
        model: effectiveModel,
        fastModel: effectiveFastModel,
        strongModel: effectiveStrongModel,
        apiKey,
        hasApiKey,
    };
}
/** 解析 Commander 使用的模型名 */
function resolveCommanderModel(provider, tier = 'balanced') {
    switch (tier) {
        case 'fast':
            return provider.fastModel || provider.model;
        case 'strong':
            return provider.strongModel || provider.model;
        default:
            return provider.model;
    }
}
function getConfig() {
    return _config;
}
//# sourceMappingURL=config-store.js.map