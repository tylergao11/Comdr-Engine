"use strict";
// ============================================================
// ExecutionLogger — 执行事件 NDJSON 日志写入器
// 追加模式写 <project>/temp/comdr/execution-log.jsonl
// Overlay 被动轮询该文件以实时显示执行数据流
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
exports.ExecutionLogger = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/** 日志文件最大字节数（~1000 条事件） */
const MAX_LOG_BYTES = 1_000_000;
/** 超过上限时保留最末的行数 */
const KEEP_LINES = 500;
class ExecutionLogger {
    _logPath;
    _dirEnsured = false;
    _writeCount = 0;
    constructor(projectPath) {
        this._logPath = path.join(projectPath, 'temp', 'comdr', 'execution-log.jsonl');
    }
    /** 追加一行 JSON 事件到日志文件，写失败静默（最佳努力原则）。
     *  每 20 次写入检查一次文件大小，超过 1MB 自动保留最末 500 行。 */
    write(event) {
        if (!this._dirEnsured) {
            fs.mkdirSync(path.dirname(this._logPath), { recursive: true });
            this._dirEnsured = true;
        }
        try {
            fs.appendFileSync(this._logPath, JSON.stringify(event) + '\n', 'utf8');
        }
        catch (e) {
            process.stderr.write(`[comdr] exec log write failed: ${e.message}\n`);
            return;
        }
        // 日志旋转：每 N 次写入后检查，超过阈值则截断保留尾部
        if (++this._writeCount % 20 === 0) {
            try {
                const stat = fs.statSync(this._logPath);
                if (stat.size > MAX_LOG_BYTES) {
                    const lines = fs.readFileSync(this._logPath, 'utf8').split('\n').filter(Boolean);
                    if (lines.length > KEEP_LINES) {
                        const kept = lines.slice(-KEEP_LINES);
                        fs.writeFileSync(this._logPath, kept.join('\n') + '\n', 'utf8');
                        process.stderr.write(`[comdr] execution-log.jsonl rotated: ${lines.length} → ${KEEP_LINES} lines\n`);
                    }
                }
            }
            catch { /* rotation fails silently — log continues growing until next check */ }
        }
    }
}
exports.ExecutionLogger = ExecutionLogger;
//# sourceMappingURL=execution-logger.js.map