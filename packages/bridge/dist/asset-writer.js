"use strict";
// ============================================================
// AssetWriter — 资产写入处理器
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
exports.AssetWriter = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const path_utils_1 = require("./path-utils");
class AssetWriter {
    _projectPath;
    constructor(projectPath) {
        this._projectPath = projectPath;
    }
    async writeAsset(payload) {
        const rawPath = (payload.path || payload.dbUrl);
        const json = payload.json;
        // 从扩展名推断资产类型，Gateway 也可显式指定 payload.assetType 覆盖
        const assetType = payload.assetType || (rawPath.endsWith('.scene') ? 'scene' : 'prefab');
        const overwrite = !!payload.overwrite;
        if (!rawPath || !json) {
            return { ok: false, error: 'Missing path or json data' };
        }
        // Normalize: strip db://, ensure assets/ prefix, normalize slashes
        const normalized = (0, path_utils_1.normalizeAssetPath)(rawPath);
        let assetPath = normalized.fsPath;
        // 创建新文件时防同名；覆盖模式直接写
        if (!overwrite) {
            const originalPath = assetPath;
            let counter = 0;
            const MAX_RENAME_ATTEMPTS = 1000;
            while (counter < MAX_RENAME_ATTEMPTS) {
                const checkPath = path.resolve(this._projectPath, assetPath);
                if (!fs.existsSync(checkPath) && !fs.existsSync(checkPath + '.meta'))
                    break;
                counter++;
                const dot = originalPath.lastIndexOf('.');
                if (dot > 0) {
                    assetPath = originalPath.slice(0, dot) + '_' + counter + originalPath.slice(dot);
                }
                else {
                    assetPath = originalPath + '_' + counter;
                }
            }
            if (counter >= MAX_RENAME_ATTEMPTS) {
                return { ok: false, error: `Too many name conflicts for ${originalPath} (${MAX_RENAME_ATTEMPTS} attempts exhausted)` };
            }
        }
        const fullPath = path.resolve(this._projectPath, assetPath);
        // 确保目录存在
        const dir = path.dirname(fullPath);
        fs.mkdirSync(dir, { recursive: true });
        // 原子写入：先写 tmp 再 rename，防止进程崩溃损坏源文件
        const content = JSON.stringify(json, null, 2) + '\n';
        const tmpPath = fullPath + '.tmp.' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
        fs.writeFileSync(tmpPath, content, 'utf8');
        try {
            fs.renameSync(tmpPath, fullPath);
        }
        catch {
            // cross-device link fallback
            fs.writeFileSync(fullPath, content, 'utf8');
            try {
                fs.rmSync(tmpPath, { force: true });
            }
            catch { /* ignore */ }
        }
        // 写入 .meta 文件（如果不存在）
        const metaPath = fullPath + '.meta';
        if (!fs.existsSync(metaPath)) {
            const meta = this._generateMeta(assetType, assetPath);
            fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');
        }
        // 通知编辑器刷新
        try {
            await Editor.Message.request('asset-db', 'refresh-asset', fullPath);
        }
        catch (e) {
            console.warn(`[comdr] Editor refresh after write failed: ${e.message}`);
        }
        // 验证写回
        const verified = this._verifyWriteback(fullPath, json);
        return {
            ok: true,
            path: assetPath,
            fullPath,
            verified,
        };
    }
    _verifyWriteback(filePath, expected) {
        try {
            const raw = fs.readFileSync(filePath, 'utf8').replace(/^﻿/, '');
            const actual = JSON.parse(raw);
            if (!Array.isArray(actual)) {
                return { ok: false, issue: 'Not a JSON array' };
            }
            if (!Array.isArray(expected)) {
                return { ok: false, issue: 'Expected value is not an array' };
            }
            const expectedArr = expected;
            const actualArr = actual;
            // 类型分布对比（cc.Node, cc.PrefabInfo, cc.CompPrefabInfo 等关键类型计数）
            const countByType = (arr) => {
                const counts = {};
                for (const item of arr) {
                    const t = item?.__type__ || '(none)';
                    counts[t] = (counts[t] || 0) + 1;
                }
                return counts;
            };
            const expectedTypes = countByType(expectedArr);
            const actualTypes = countByType(actualArr);
            // 类型分布不一致的项
            const mismatchedTypes = {};
            const allTypes = new Set([...Object.keys(expectedTypes), ...Object.keys(actualTypes)]);
            for (const t of allTypes) {
                const e = expectedTypes[t] || 0;
                const a = actualTypes[t] || 0;
                if (e !== a)
                    mismatchedTypes[t] = { expected: e, actual: a };
            }
            return {
                ok: Object.keys(mismatchedTypes).length === 0,
                expectedCount: expectedArr.length,
                actualCount: actualArr.length,
                expectedNodes: expectedTypes['cc.Node'] || 0,
                actualNodes: actualTypes['cc.Node'] || 0,
                ...(Object.keys(mismatchedTypes).length > 0 ? { mismatchedTypes } : {}),
            };
        }
        catch (err) {
            return { ok: false, issue: err.message };
        }
    }
    _generateMeta(assetType, assetPath) {
        const uuid = this._generateUuid();
        return {
            ver: '1.1.0',
            importer: assetType === 'scene' ? 'scene' : 'prefab',
            imported: true,
            uuid,
            files: [path.basename(assetPath)],
            subMetas: {},
            userData: { comdr: { createdAt: new Date().toISOString() } },
        };
    }
    _generateUuid() {
        try {
            const crypto = require('crypto');
            // Node 19+: native randomUUID
            if (typeof crypto.randomUUID === 'function') {
                return crypto.randomUUID();
            }
            // Node 14+: randomBytes-based UUID v4
            const bytes = crypto.randomBytes(16);
            bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
            bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
            const hex = bytes.toString('hex');
            return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
        }
        catch {
            // Fallback: Math.random() when crypto is unavailable (should never happen in Cocos Editor)
            const hex = '0123456789abcdef';
            let uuid = '';
            for (let i = 0; i < 36; i++) {
                if (i === 8 || i === 13 || i === 18 || i === 23) {
                    uuid += '-';
                }
                else if (i === 14) {
                    uuid += '4';
                }
                else if (i === 19) {
                    uuid += hex[(Math.random() * 4) | 8];
                }
                else {
                    uuid += hex[(Math.random() * 16) | 0];
                }
            }
            return uuid;
        }
    }
}
exports.AssetWriter = AssetWriter;
//# sourceMappingURL=asset-writer.js.map