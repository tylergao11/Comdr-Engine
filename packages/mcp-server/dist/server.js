"use strict";
// ============================================================
// MCP Server — JSON-RPC 2.0 over stdio
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
exports.MCP_SERVER = void 0;
const readline = __importStar(require("readline"));
const comdr_ask_1 = require("./handlers/comdr-engine-ask");
/** 动态加载 image handler 模块（只清除 image/ 目录缓存，不波及 comdr-ask 及 @comdr/core 依赖树） */
function loadImageModules() {
    for (const key of Object.keys(require.cache)) {
        const normalized = key.replace(/\\/g, '/');
        if (normalized.includes('/comdr/mcp-server/src/handlers/image/')) {
            delete require.cache[key];
        }
    }
    return require('./handlers/image');
}
/** 动态加载 handler，每次调用前清除缓存确保热重载生效 */
function reloadHandlerModule() {
    // 精确清除 handler 模块缓存（require.resolve 拿到绝对路径）
    try {
        delete require.cache[require.resolve('./handlers/comdr-ask')];
    }
    catch { /* 首次加载 */ }
    // 清除所有 @comdr/mcp-server 相关模块（monorepo 和 npm 两种路径）
    for (const key of Object.keys(require.cache)) {
        const normalized = key.replace(/\\/g, '/');
        if (normalized.includes('/comdr/mcp-server/')) {
            delete require.cache[key];
        }
    }
    return require('./handlers/comdr-ask');
}
// ===== 服务器 =====
class McpServer {
    _rl = null;
    _pendingAborts = new Map();
    async start() {
        this._rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: false,
        });
        this._rl.on('line', (line) => {
            this._processLine(line).catch((err) => {
                process.stderr.write(`[comdr] Unhandled error: ${err.message}\n`);
            });
        });
        // 通知就绪
        process.stderr.write('[comdr] Ready — listening on stdin\n');
    }
    stop() {
        if (this._rl) {
            this._rl.close();
            this._rl = null;
        }
        // 取消所有正在进行的任务
        for (const [id, ctrl] of this._pendingAborts) {
            ctrl.abort();
            this._pendingAborts.delete(id);
        }
    }
    async _processLine(line) {
        if (!line.trim())
            return;
        let request;
        try {
            request = JSON.parse(line);
        }
        catch {
            this._write({
                jsonrpc: '2.0',
                id: undefined,
                error: { code: -32700, message: 'Parse error' },
            });
            return;
        }
        if (!request.method)
            return;
        // 验证 JSON-RPC 2.0 规范
        if (request.jsonrpc !== '2.0') {
            this._write({
                jsonrpc: '2.0',
                id: request.id,
                error: { code: -32600, message: 'Invalid Request: jsonrpc must be "2.0"' },
            });
            return;
        }
        const reqId = request.id;
        if (reqId == null)
            return; // 通知无需响应
        try {
            switch (request.method) {
                case 'initialize':
                    await this._respond(request, (0, comdr_ask_1.handleInitialize)(reqId, request.params || {}));
                    break;
                case 'notifications/initialized':
                    // 无需响应
                    break;
                case 'tools/list':
                    await this._respond(request, {
                        tools: (() => { const im = loadImageModules(); return [comdr_ask_1.TOOL_DEFINITION, im.READ_IMAGE_TOOL, im.SLICE_IMAGE_TOOL, im.GENERATE_IMAGE_TOOL]; })(),
                    });
                    break;
                case 'tools/call':
                    await this._handleToolsCall(request);
                    break;
                case 'notifications/cancelled':
                    (0, comdr_ask_1.handleCancel)(request.params || {}, this._pendingAborts);
                    break;
                default:
                    this._write({
                        jsonrpc: '2.0',
                        id: request.id,
                        error: { code: -32601, message: `Method not found: ${request.method}` },
                    });
            }
        }
        catch (err) {
            this._write({
                jsonrpc: '2.0',
                id: request.id,
                error: { code: -32603, message: err.message },
            });
        }
    }
    async _handleToolsCall(request) {
        const params = request.params;
        const toolName = params?.name;
        // ---- Image 工具（统一入口，每次调用前自动清除 image/ 模块缓存）----
        if (toolName === 'comdr-read-image') {
            return this._handleImageTool(request, (args) => loadImageModules().handleReadImage(args));
        }
        if (toolName === 'comdr-slice-image') {
            return this._handleImageTool(request, (args) => loadImageModules().handleSliceImage(args));
        }
        if (toolName === 'comdr-generate-image') {
            return this._handleImageTool(request, (args) => loadImageModules().handleGenerateImage(args));
        }
        // ---- comdr-engine-ask（重量，需要 hot-reload + abort）----
        if (toolName !== 'comdr-engine-ask') {
            this._write({
                jsonrpc: '2.0',
                id: request.id,
                error: { code: -32601, message: `Tool not found: ${params?.name}` },
            });
            return;
        }
        const abortController = new AbortController();
        const taskId = String(request.id || Date.now());
        this._pendingAborts.set(taskId, abortController);
        try {
            const { handleToolsCall } = reloadHandlerModule();
            const result = await handleToolsCall(params?.arguments || {}, abortController.signal);
            this._write({
                jsonrpc: '2.0',
                id: request.id,
                result: {
                    content: [{ type: 'text', text: result.text }],
                    isError: result.isError,
                    rollbacks: result.rollbacks || null,
                    diffs: result.diffs || null,
                },
            });
        }
        catch (err) {
            this._write({
                jsonrpc: '2.0',
                id: request.id,
                result: {
                    content: [{ type: 'text', text: `Tool error: ${err.message}` }],
                    isError: true,
                },
            });
        }
        finally {
            this._pendingAborts.delete(taskId);
        }
    }
    /** Image 工具统一响应包装 — 三个工具（read/slice/generate）共享同一 try/catch 结构 */
    async _handleImageTool(request, handler) {
        const params = request.params;
        try {
            const result = await handler(params?.arguments || {});
            this._write({
                jsonrpc: '2.0', id: request.id,
                result: { content: result.content, isError: result.isError },
            });
        }
        catch (err) {
            this._write({
                jsonrpc: '2.0', id: request.id,
                result: {
                    content: [{ type: 'text', text: `Tool error: ${err.message}` }],
                    isError: true,
                },
            });
        }
    }
    async _respond(request, result) {
        this._write({ jsonrpc: '2.0', id: request.id, result });
    }
    _write(response) {
        process.stdout.write(JSON.stringify(response) + '\n');
    }
}
exports.MCP_SERVER = new McpServer();
//# sourceMappingURL=server.js.map