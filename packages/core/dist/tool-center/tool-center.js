"use strict";
// ============================================================
// ToolCenter — 文件 IPC 客户端
// Gateway ↔ Bridge 通过 temp/comdr/inbox/ + outbox/ 通信
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
exports.ToolCenter = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const value_kit_1 = require("../foundation/value-kit");
const error_codes_1 = require("../errors/error-codes");
const constants_1 = require("../foundation/constants");
const REQUEST_SCHEMA = 'Comdr.cocos-task-request.v1';
const RESULT_SCHEMA = 'Comdr.cocos-task-result.v1';
class ToolCenter {
    _projectPath;
    _root;
    _inbox;
    _processing;
    _outbox;
    _timeoutMs;
    _pollMs;
    _online = false;
    _healthTimer = null;
    constructor(options) {
        this._projectPath = (0, value_kit_1.normalizeSlash)(options.projectPath);
        this._root = path.join(this._projectPath, 'temp', 'comdr');
        this._inbox = path.join(this._root, 'inbox');
        this._processing = path.join(this._root, 'processing');
        this._outbox = path.join(this._root, 'outbox');
        this._timeoutMs = options.timeoutMs || constants_1.IPC_TIMEOUT_MS;
        this._pollMs = options.pollMs || constants_1.IPC_POLL_MS;
    }
    // ===== 生命周期 =====
    async start() {
        // 确保目录存在
        fs.mkdirSync(this._inbox, { recursive: true });
        fs.mkdirSync(this._processing, { recursive: true });
        fs.mkdirSync(this._outbox, { recursive: true });
        this._online = await this.health();
        return this._online;
    }
    destroy() {
        this.stopHealthChecks();
        this._online = false;
    }
    // ===== 提交任务 =====
    async submit(task, signal) {
        if (!this._online) {
            const hb = await this.health();
            if (!hb) {
                return { ok: false, error: 'Bridge offline', errorCode: error_codes_1.ERR_BR_BRIDGE_OFFLINE };
            }
            this._online = true;
        }
        const id = (0, value_kit_1.generateUuid)();
        const request = {
            schema: REQUEST_SCHEMA,
            id,
            taskCard: task,
            createdAt: (0, value_kit_1.nowISO)(),
        };
        // 原子写入 inbox（复用 value-kit 的标准模式）
        const inboxPath = path.join(this._inbox, `${id}.json`);
        (0, value_kit_1.writeJsonAtomic)(inboxPath, request, true);
        // 轮询结果
        const startTime = Date.now();
        const outboxPath = path.join(this._outbox, `${id}.json`);
        while (Date.now() - startTime < this._timeoutMs) {
            if (signal?.aborted) {
                try {
                    fs.rmSync(inboxPath, { force: true });
                }
                catch { /* ignore */ }
                return { ok: false, error: 'Cancelled', errorCode: error_codes_1.ERR_CANCELLED };
            }
            await sleep(this._pollMs);
            if (!fs.existsSync(outboxPath))
                continue;
            // 读取结果（重试解析防止部分写入）
            let lastParseError = '';
            for (let retry = 0; retry < 3; retry++) {
                try {
                    const raw = fs.readFileSync(outboxPath, 'utf8').replace(/^﻿/, '');
                    const result = JSON.parse(raw);
                    if (result.schema !== RESULT_SCHEMA) {
                        return {
                            ok: false,
                            error: `Invalid result schema: ${result.schema}`,
                            errorCode: 'BR_INVALID_RESPONSE',
                        };
                    }
                    // 清理文件
                    try {
                        fs.rmSync(outboxPath, { force: true });
                    }
                    catch { /* ignore */ }
                    try {
                        fs.rmSync(inboxPath, { force: true });
                    }
                    catch { /* ignore */ }
                    // Bridge 返回 { ok, result, error, ... }，实际操作结果在 result 中
                    const bridgeOk = result.ok === true;
                    // Bridge 成功但缺 result 字段 → 编码异常，当作失败处理
                    if (bridgeOk && !result.result) {
                        process.stderr.write(`[comdr] Bridge response missing 'result' field for task ${id}\n`);
                        return {
                            ok: false,
                            type: task.type,
                            error: 'Bridge response missing result field',
                            errorCode: 'BR_INVALID_RESPONSE',
                        };
                    }
                    const inner = result.result || {};
                    // 如果 Bridge 层成功，取内层结果；否则 Bridge 本身失败
                    const actualOk = bridgeOk ? (inner.ok !== false) : false;
                    return {
                        ok: actualOk,
                        type: task.type,
                        data: bridgeOk ? result.result : undefined,
                        error: bridgeOk ? inner.error : result.error,
                        errorCode: bridgeOk
                            ? (inner.errorCode || inner.code)
                            : result.errorCode,
                    };
                }
                catch (e) {
                    lastParseError = e.message;
                    if (retry < 2)
                        await sleep(50);
                }
            }
            process.stderr.write(`[comdr] result parse failed after 3 retries for ${id}: ${lastParseError}\n`);
        }
        // 超时
        try {
            fs.rmSync(inboxPath, { force: true });
        }
        catch { /* ignore */ }
        return {
            ok: false,
            error: `Task timeout after ${this._timeoutMs}ms: ${id}`,
            errorCode: error_codes_1.ERR_BR_TASK_TIMEOUT,
        };
    }
    // ===== 健康检查 =====
    async health() {
        const info = this.getBridgeInfo();
        if (!info)
            return false;
        const age = Date.now() - new Date(info.updatedAt).getTime();
        return age < constants_1.IPC_HEARTBEAT_MAX_AGE_MS;
    }
    getBridgeInfo() {
        const bp = path.join(this._root, 'bridge.json');
        if (!fs.existsSync(bp))
            return null;
        try {
            const raw = fs.readFileSync(bp, 'utf8').replace(/^﻿/, '');
            return JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
    getCapabilities() {
        const info = this.getBridgeInfo();
        return info?.editorCapabilities || null;
    }
    get isOnline() {
        return this._online;
    }
    startHealthChecks(intervalMs = 15_000) {
        if (this._healthTimer)
            return;
        this._healthTimer = setInterval(async () => {
            this._online = await this.health();
        }, intervalMs);
        if (this._healthTimer.unref)
            this._healthTimer.unref();
    }
    stopHealthChecks() {
        if (this._healthTimer) {
            clearInterval(this._healthTimer);
            this._healthTimer = null;
        }
    }
}
exports.ToolCenter = ToolCenter;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=tool-center.js.map