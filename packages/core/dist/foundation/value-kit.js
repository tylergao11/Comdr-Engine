"use strict";
// ============================================================
// @comdr/core/foundation/value-kit
// 基础纯函数工具集 — 零依赖、零副作用
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
exports.cloneJson = cloneJson;
exports.stableHash = stableHash;
exports.readJsonUtf8 = readJsonUtf8;
exports.writeJsonAtomic = writeJsonAtomic;
exports.normalizeSlash = normalizeSlash;
exports.samePath = samePath;
exports.stringArray = stringArray;
exports.uniqueStrings = uniqueStrings;
exports.safeId = safeId;
exports.levenshtein = levenshtein;
exports.compactObject = compactObject;
exports.mergeShallow = mergeShallow;
exports.nowISO = nowISO;
exports.generateUuid = generateUuid;
exports.generateFileIdFallback = generateFileIdFallback;
const fs = __importStar(require("fs"));
const crypto = __importStar(require("crypto"));
// ----- JSON 工具 -----
/** 深拷贝 JSON 安全对象。优先使用 structuredClone（Node 17+），回退到 JSON 序列化 */
function cloneJson(value) {
    if (typeof structuredClone === 'function')
        return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
}
/** 稳定哈希 (SHA-256 截断)，用于去重和缓存 key */
function stableHash(input, length = 16) {
    return crypto.createHash('sha256').update(input).digest('hex').slice(0, length);
}
/** 读 UTF-8 JSON 文件，解析失败返回 null。调用方必须在 null 时做 fallback 处理。 */
function readJsonUtf8(filePath) {
    try {
        const raw = fs.readFileSync(filePath, 'utf8').replace(/^﻿/, '');
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
/** 原子写 JSON：先写 tmp，再 rename */
function writeJsonAtomic(filePath, data, pretty) {
    const tmp = filePath + '.tmp.' + Date.now();
    const content = pretty
        ? JSON.stringify(data, null, 2) + '\n'
        : JSON.stringify(data) + '\n';
    fs.writeFileSync(tmp, content, 'utf8');
    try {
        fs.renameSync(tmp, filePath);
    }
    catch {
        // rename 跨设备可能失败，回退到直接写
        fs.writeFileSync(filePath, content, 'utf8');
        try {
            fs.rmSync(tmp, { force: true });
        }
        catch (e) {
            process.stderr.write(`[comdr] tmp cleanup failed: ${tmp} — ${e.message}\n`);
        }
    }
}
// ----- 字符串工具 -----
/** 反斜杠统一为斜杠 */
function normalizeSlash(s) {
    return s.replace(/\\/g, '/');
}
/** 路径是否相等（忽略斜杠方向，忽略末尾斜杠） */
function samePath(a, b) {
    return normalizeSlash(a).replace(/\/$/, '') === normalizeSlash(b).replace(/\/$/, '');
}
/** 若输入非数组，包装为数组 */
function stringArray(v) {
    if (Array.isArray(v))
        return v.map(String);
    if (v === undefined || v === null)
        return [];
    return [String(v)];
}
/** 去重 + 排序 */
function uniqueStrings(arr) {
    return [...new Set(arr)].sort();
}
/** 安全的 ID 字符（取前 120 字符，仅保留字母数字和 . _ -） */
function safeId(value) {
    return String(value || '')
        .replace(/[^A-Za-z0-9_.\-]/g, '_')
        .slice(0, 120);
}
// ----- Levenshtein 编辑距离（单行 DP + 长度预过滤）-----
/**
 * 计算两个字符串的 Levenshtein 编辑距离。
 * 单行 DP — O(min(m,n)) 空间，O(m×n) 时间。
 * @param maxDist 超过此距离提前退出（用于模糊匹配阈值过滤）
 */
function levenshtein(a, b, maxDist = Infinity) {
    // 长度预过滤：差超过 maxDist 不可能匹配
    if (Math.abs(a.length - b.length) > maxDist)
        return maxDist + 1;
    // 确保 a 是较短的串（空间更省）
    if (a.length > b.length) {
        const t = a;
        a = b;
        b = t;
    }
    const m = a.length;
    const n = b.length;
    // 单行 DP
    let prev = new Array(m + 1);
    let curr = new Array(m + 1);
    for (let i = 0; i <= m; i++)
        prev[i] = i;
    for (let j = 1; j <= n; j++) {
        curr[0] = j;
        let rowMin = j;
        for (let i = 1; i <= m; i++) {
            curr[i] = a[i - 1] === b[j - 1]
                ? prev[i - 1]
                : 1 + Math.min(prev[i], curr[i - 1], prev[i - 1]);
            if (curr[i] < rowMin)
                rowMin = curr[i];
        }
        // 整行最小值已超阈值 → 提前退出
        if (rowMin > maxDist)
            return maxDist + 1;
        [prev, curr] = [curr, prev];
    }
    return prev[m];
}
// ----- 对象工具 -----
/** 从对象中挑选指定 key，跳过 null/undefined/空字符串 */
function compactObject(value, keys) {
    const output = {};
    for (const key of keys) {
        const v = value?.[key];
        if (v === undefined || v === null || v === '')
            continue;
        output[key] = v;
    }
    return Object.keys(output).length > 0 ? output : null;
}
/** 浅合并，b 覆盖 a */
function mergeShallow(a, b) {
    return { ...a, ...b };
}
// ----- 时间工具 -----
/** ISO 时间戳 */
function nowISO() {
    return new Date().toISOString();
}
// ----- ID 生成 -----
/** UUID v4 生成器 */
function generateUuid() {
    return crypto.randomUUID();
}
/** LCG 伪随机 UUID（crypto 不可用时的回退） */
function generateFileIdFallback() {
    const hex = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
    let seed = Date.now() % 2147483647;
    const rng = () => {
        seed = (seed * 16807) % 2147483647;
        return seed;
    };
    return hex.replace(/[xy]/g, (c) => {
        const r = (rng() % 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
//# sourceMappingURL=value-kit.js.map