"use strict";
// ============================================================
// IdAlloc — 扁平化 ID 分配器（新模型版本）
// 纯函数风格，无类状态泄漏
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateFileId = generateFileId;
exports.allocateIds = allocateIds;
const cocos_world_1 = require("../../model/cocos-world");
// ---- fileId 生成 ----
let _cryptoBytes = null;
function tryCryptoBytes() {
    if (_cryptoBytes === null) {
        try {
            const crypto = require('crypto');
            if (typeof crypto.randomBytes === 'function') {
                _cryptoBytes = () => crypto.randomBytes(16).toString('base64').replace(/=+$/, '');
            }
            else {
                _cryptoBytes = () => {
                    const hex = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
                    let seed = Date.now() % 2147483647;
                    const rng = () => { seed = (seed * 16807) % 2147483647; return seed; };
                    return hex.replace(/[xy]/g, (c) => {
                        const r = (rng() % 16) | 0;
                        const v = c === 'x' ? r : (r & 0x3) | 0x8;
                        return v.toString(16);
                    });
                };
            }
        }
        catch {
            _cryptoBytes = () => {
                const hex = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
                let seed = Date.now() % 2147483647;
                const rng = () => { seed = (seed * 16807) % 2147483647; return seed; };
                return hex.replace(/[xy]/g, (c) => {
                    const r = (rng() % 16) | 0;
                    const v = c === 'x' ? r : (r & 0x3) | 0x8;
                    return v.toString(16);
                });
            };
        }
    }
    return _cryptoBytes();
}
function generateFileId() {
    return tryCryptoBytes();
}
// ---- ID 分配 ----
function isTypedObject(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v))
        return false;
    return Object.prototype.hasOwnProperty.call(v, '__type__');
}
/** 深度遍历对象树，为所有 __type__ 对象分配递增 ID（值类型除外） */
function allocateIds(root) {
    const objects = [];
    const idMap = new Map();
    let nextId = 0;
    const visited = new Set();
    const stack = [root];
    while (stack.length > 0) {
        const obj = stack.pop();
        if (!obj || visited.has(obj))
            continue;
        visited.add(obj);
        if (isTypedObject(obj)) {
            const typeName = obj.__type__;
            if (!cocos_world_1.VALUE_TYPE_NAMES.has(typeName)) {
                obj.__id__ = nextId++;
                objects.push(obj);
                idMap.set(obj, nextId - 1);
            }
        }
        for (const v of Object.values(obj)) {
            if (v && typeof v === 'object' && !visited.has(v)) {
                if (Array.isArray(v)) {
                    for (const item of v) {
                        if (item && typeof item === 'object') {
                            stack.push(item);
                        }
                    }
                }
                else {
                    stack.push(v);
                }
            }
        }
    }
    const rootId = idMap.get(root) ?? null;
    return { objects, idMap, rootId };
}
//# sourceMappingURL=id-alloc.js.map