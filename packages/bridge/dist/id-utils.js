"use strict";
// ============================================================
// ID 生成工具
// bridge 独立部署，不能 import @comdr/core 的 IdManager.generateFileId
// 实现与 core/src/translation/id-manager.ts 保持一致
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateFileId = generateFileId;
exports.generateUuid = generateUuid;
exports.compressUuid = compressUuid;
function generateFileIdFallback() {
    let d = Date.now();
    const rng = () => {
        d = Math.floor(d / 16);
        return (d + Math.random() * 16) % 16 | 0;
    };
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const v = c === 'x' ? rng() : (rng() & 0x3) | 0x8;
        return v.toString(16);
    });
}
// Cocos Creator 3.x 使用压缩 UUID 格式（16 随机字节 → base64url → 22 字符）
// bridge 独立部署，不能 import @comdr/core，实现保持一致
let _cryptoBytes = null;
function getCryptoBytes() {
    if (_cryptoBytes)
        return _cryptoBytes;
    try {
        if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
            _cryptoBytes = () => {
                const buf = new Uint8Array(16);
                crypto.getRandomValues(buf);
                // Uint8Array → base64url
                let binary = '';
                for (let i = 0; i < buf.length; i++)
                    binary += String.fromCharCode(buf[i]);
                return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            };
        }
        else {
            _cryptoBytes = generateFileIdFallback;
        }
    }
    catch {
        _cryptoBytes = generateFileIdFallback;
    }
    return _cryptoBytes;
}
function generateFileId() {
    return getCryptoBytes()();
}
// ===== 补充 =====
/** 生成标准 UUID v4 */
function generateUuid() {
    try {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
    }
    catch { /* fallback */ }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/** 将标准 UUID 压缩为 Cocos 3.x __type__ 使用的 23 字符格式。
 *  算法：前 5 个 hex 原样保留，剩余 27 个 hex 按 3→2 base64 压缩。 */
function compressUuid(uuid) {
    const hex = uuid.replace(/-/g, '');
    if (hex.length !== 32)
        return uuid;
    let result = hex.substring(0, 5); // 前 5 个 hex 原样
    for (let i = 5; i < 32; i += 3) {
        const val = parseInt(hex.substring(i, i + 3), 16);
        result += BASE64_CHARS[val >> 6] + BASE64_CHARS[val & 0x3F];
    }
    return result; // 5 + 18 = 23 chars
}
//# sourceMappingURL=id-utils.js.map