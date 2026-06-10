"use strict";
// ============================================================
// Commander — LLM 调用抽象层
// 支持 DeepSeek / OpenAI 兼容 API，带重试 + 指数退避
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
exports.callCommander = callCommander;
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const error_codes_1 = require("../errors/error-codes");
const constants_1 = require("../foundation/constants");
// ===== HTTP 请求 =====
function httpsPost(url, headers, body, signal, timeoutMs = 120000) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const isHttps = parsed.protocol === 'https:';
        const mod = isHttps ? https : http;
        const options = {
            hostname: parsed.hostname,
            port: parsed.port || (isHttps ? 443 : 80),
            path: parsed.pathname + parsed.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                ...headers,
            },
            timeout: timeoutMs,
        };
        const req = mod.request(options, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                resolve({
                    status: res.statusCode || 0,
                    data: Buffer.concat(chunks).toString('utf8'),
                });
            });
        });
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        if (signal) {
            signal.addEventListener('abort', () => {
                req.destroy();
                reject(new Error('Aborted'));
            }, { once: true });
        }
        req.write(body);
        req.end();
    });
}
// ===== 重试逻辑 =====
function classifyHttpError(status) {
    if (status === 429)
        return { retryable: true, code: error_codes_1.ERR_CMD_RATE_LIMIT };
    if (status === 401 || status === 403)
        return { retryable: false, code: error_codes_1.ERR_CMD_AUTH };
    if (status >= 500)
        return { retryable: true, code: error_codes_1.ERR_CMD_SERVER_ERROR };
    return { retryable: false, code: error_codes_1.ERR_CMD_NETWORK };
}
/** 统一的 HTTP 响应处理：状态码检查 + JSON 解析。OpenAI/Anthropic 共用。 */
function _handleHttpResponse(resp) {
    // 状态码错误 → 抛出分类好的错误
    if (resp.status !== 200) {
        const classified = classifyHttpError(resp.status);
        let detail = resp.data;
        try {
            const parsed = JSON.parse(resp.data);
            detail = parsed.error?.message || parsed.message || resp.data;
        }
        catch { /* raw text */ }
        throw {
            ...(0, error_codes_1.makeError)(classified.code, `HTTP ${resp.status}: ${String(detail).slice(0, constants_1.LLM_ERROR_DETAIL_MAX)}`),
            retryable: classified.retryable || resp.status >= 500,
        };
    }
    // JSON 解析
    let data;
    try {
        data = JSON.parse(resp.data);
    }
    catch {
        throw { ...(0, error_codes_1.makeError)(error_codes_1.ERR_CMD_NETWORK, 'Invalid JSON response'), retryable: false };
    }
    return data;
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
// ===== 主调用 =====
async function callCommander(opts) {
    const maxRetries = constants_1.LLM_MAX_RETRIES;
    let lastError = '';
    let lastCode = '';
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (opts.signal?.aborted) {
            throw (0, error_codes_1.makeError)(error_codes_1.ERR_CANCELLED, 'Aborted by user');
        }
        try {
            const result = await _callOnce(opts);
            return result;
        }
        catch (err) {
            const error = err;
            lastError = error.message || String(err);
            lastCode = error.code || error_codes_1.ERR_CMD_NETWORK;
            // 不可重试的错误直接抛
            if (error.retryable === false)
                break;
            // 最后一次不等待
            if (attempt < maxRetries) {
                const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 10000);
                await sleep(delay);
            }
        }
    }
    throw (0, error_codes_1.makeError)(lastCode || error_codes_1.ERR_CMD_MAX_RETRIES, `Commander call failed after ${maxRetries} retries: ${lastError}`);
}
async function _callOnce(opts) {
    if (opts.provider === 'anthropic') {
        return _callAnthropic(opts);
    }
    return _callOpenAiCompatible(opts);
}
/** 标记 message 前缀缓存：缓存到最后一条之前的所有消息（前缀跨轮次不变） */
function markCacheable(msgs) {
    if (msgs.length < 2)
        return msgs.map((m) => ({ role: m.role, content: m.content }));
    // 最后一条是当轮新注入的反馈+状态，不缓存；它之前的所有消息跨轮次不变
    return msgs.map((m, i) => {
        const block = { role: m.role, content: m.content };
        if (i === msgs.length - 2)
            block.cache_control = { type: 'ephemeral' };
        return block;
    });
}
// ===== OpenAI 兼容 API (DeepSeek / OpenAI / etc.) =====
async function _callOpenAiCompatible(opts) {
    const url = `${opts.baseUrl}/chat/completions`;
    const headers = {
        Authorization: `Bearer ${opts.apiKey}`,
    };
    // OpenAI 路径: system 在 messages[0]，单独标 cache_control；其余走 markCacheable
    const openAiMessages = opts.messages.map((m, i) => {
        const block = { role: m.role, content: m.content };
        if (i === 0 && m.role === 'system')
            block.cache_control = { type: 'ephemeral' };
        return block;
    });
    const nonSystem = openAiMessages.slice(1).map(m => ({ role: m.role, content: m.content }));
    const allMessages = [openAiMessages[0], ...markCacheable(nonSystem)];
    const body = JSON.stringify({
        model: opts.model,
        messages: allMessages,
        temperature: opts.temperature ?? constants_1.LLM_TEMPERATURE,
        max_tokens: opts.maxTokens ?? constants_1.LLM_MAX_TOKENS,
    });
    const resp = await httpsPost(url, headers, body, opts.signal, 120000);
    const data = _handleHttpResponse(resp);
    const choices = data.choices;
    if (!choices || choices.length === 0) {
        throw { ...(0, error_codes_1.makeError)(error_codes_1.ERR_CMD_NETWORK, 'No choices in response'), retryable: false };
    }
    const text = choices[0].message?.content || '';
    const finishReason = choices[0].finish_reason;
    const usage = data.usage;
    return {
        text,
        raw: data,
        finishReason,
        usage: usage
            ? { promptTokens: usage.prompt_tokens || 0, completionTokens: usage.completion_tokens || 0 }
            : undefined,
    };
}
// ===== Anthropic Messages API =====
async function _callAnthropic(opts) {
    const url = `${opts.baseUrl}/messages`;
    const headers = {
        'x-api-key': opts.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
    };
    // Anthropic: system prompt 是顶层字段，不在 messages 数组中
    const systemMsg = opts.messages.find((m) => m.role === 'system');
    const chatMessages = opts.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role, content: m.content }));
    const bodyObj = {
        model: opts.model,
        messages: markCacheable(chatMessages),
        temperature: opts.temperature ?? constants_1.LLM_TEMPERATURE,
        max_tokens: opts.maxTokens ?? constants_1.LLM_MAX_TOKENS,
    };
    if (systemMsg) {
        bodyObj.system = [{ type: 'text', text: systemMsg.content, cache_control: { type: 'ephemeral' } }];
    }
    const body = JSON.stringify(bodyObj);
    const resp = await httpsPost(url, headers, body, opts.signal, 120000);
    const data = _handleHttpResponse(resp);
    // Anthropic 响应格式: content[{type, text}] → 提取 text
    const contentArray = data.content;
    if (!contentArray || contentArray.length === 0) {
        throw { ...(0, error_codes_1.makeError)(error_codes_1.ERR_CMD_NETWORK, 'No content in Anthropic response'), retryable: false };
    }
    const text = contentArray
        .filter((c) => c.type === 'text')
        .map((c) => c.text || '')
        .join('\n');
    const finishReason = data.stop_reason;
    const usage = data.usage;
    return {
        text,
        raw: data,
        finishReason,
        usage: usage
            ? { promptTokens: usage.input_tokens || 0, completionTokens: usage.output_tokens || 0 }
            : undefined,
    };
}
//# sourceMappingURL=commander.js.map