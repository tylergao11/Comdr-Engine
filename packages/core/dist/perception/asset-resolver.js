"use strict";
// ============================================================
// AssetResolver — 自动将资产路径解析为 UUID
// 当 set-prop/compile 的值看起来像文件路径，且目标属性
// 是 asset 引用类型时，自动 probe 解析路径 → UUID
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
exports.looksLikeAssetPath = looksLikeAssetPath;
exports.isAssetProperty = isAssetProperty;
exports.resolveAssetPath = resolveAssetPath;
exports.resolveAssetValue = resolveAssetValue;
exports.resolveAssetValues = resolveAssetValues;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// ===== 子资产映射 =====
/** property → 期望的 subMetas importer（用于从 .meta 中定位正确的子资产 UUID） */
const PROPERTY_IMPORTER_MAP = {
    spriteFrame: 'sprite-frame',
    _spriteFrame: 'sprite-frame',
    normalSprite: 'sprite-frame',
    pressedSprite: 'sprite-frame',
    hoverSprite: 'sprite-frame',
    disabledSprite: 'sprite-frame',
    spriteAtlas: 'sprite-atlas',
    _spriteAtlas: 'sprite-atlas',
    _atlas: 'sprite-atlas',
};
/** subMetas importer → __expectedType__ */
const IMPORTER_EXPECTED_TYPE = {
    'sprite-frame': 'cc.SpriteFrame',
    'texture': 'cc.Texture2D',
    'image': 'cc.ImageAsset',
    'sprite-atlas': 'cc.SpriteAtlas',
};
/**
 * 读 .meta 的 subMetas，找与 property 匹配的子资产 UUID。
 * @returns { uuid, expectedType } 或 null（无需子资产解析）
 */
function resolveSubAssetFromMeta(mainUuid, projectPath, originalAssetPath, propertyName) {
    if (!mainUuid || mainUuid.includes('@'))
        return null; // 已是子资产 UUID
    try {
        // 从 originalAssetPath 推导 .meta 路径
        const cleanPath = originalAssetPath.replace(/^db:\/\/assets\//, '').replace(/^assets\//, '');
        const metaPath = path.join(projectPath, 'assets', cleanPath + '.meta');
        if (!fs.existsSync(metaPath))
            return null;
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        const subMetas = meta.subMetas;
        if (!subMetas || Object.keys(subMetas).length === 0)
            return null;
        // 1. 精确匹配：property → importer 映射
        const targetImporter = PROPERTY_IMPORTER_MAP[propertyName];
        if (targetImporter) {
            for (const [id, entry] of Object.entries(subMetas)) {
                if (entry.importer === targetImporter && entry.uuid) {
                    return {
                        uuid: entry.uuid,
                        expectedType: IMPORTER_EXPECTED_TYPE[targetImporter],
                    };
                }
            }
        }
        // 2. 回退：property name 匹配 subMeta.name（去掉 _ 前缀）
        const cleanProp = propertyName.replace(/^_/, '');
        for (const [id, entry] of Object.entries(subMetas)) {
            if (entry.name === cleanProp && entry.uuid) {
                return {
                    uuid: entry.uuid,
                    expectedType: entry.importer ? IMPORTER_EXPECTED_TYPE[entry.importer] : undefined,
                };
            }
        }
        return null;
    }
    catch {
        return null;
    }
}
/** 判断字符串是否看起来像资产路径（非 UUID） */
function looksLikeAssetPath(value) {
    if (!value || value.length < 5)
        return false;
    // UUID 格式：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(value))
        return false;
    // 资产路径特征
    if (value.startsWith('assets/') || value.startsWith('db://assets/'))
        return true;
    // 资源文件扩展名（图片、音频、字体等）
    if (/\.(png|jpe?g|gif|webp|svg|bmp|tga|psd|ttf|otf|mp3|wav|ogg|aac|json|plist|atlas|prefab|scene|anim|fbx|gltf|glb|mesh|mat|mtl|astc|pkm|pvr|dds|bin|bytes|csv|txt)(\.[a-z0-9]+)?$/i.test(value))
        return true;
    return false;
}
/** 判断属性是否需要资产引用（组件 schema 查询） */
function isAssetProperty(componentType, propertyName, catalog) {
    if (!catalog)
        return false;
    const entry = catalog.get(componentType);
    if (!entry)
        return false;
    const field = entry.schema.find((f) => f.name === propertyName || f.name === `_${propertyName}`);
    return field?.type === 'asset';
}
/** 单次资产路径解析：路径 → UUID（优先从缓存读，miss 则 probe Bridge 并回写缓存）
 *  自动尝试补全 assets/ 前缀（Commander 可能给出 package/xxx.png 而非 assets/package/xxx.png） */
async function resolveAssetPath(value, toolCenter, signal, cache) {
    // 尝试的路径顺序：原路径 → assets/ → db://assets/
    const candidates = [value];
    if (!value.startsWith('db://') && !value.startsWith('/')) {
        if (!value.startsWith('assets/'))
            candidates.push('assets/' + value);
        candidates.push('db://assets/' + value.replace(/^assets\//, ''));
    }
    for (const p of candidates) {
        if (cache) {
            const c = cache.get(p);
            if (c)
                return c;
        }
        try {
            const result = await toolCenter.submit({ type: 'probe', payload: { probeType: 'asset', path: p } }, signal);
            if (result.ok && result.data) {
                const data = result.data;
                const uuid = (typeof data.uuid === 'string' && data.uuid)
                    || (data.data && typeof data.data === 'object' && typeof data.data.uuid === 'string'
                        ? data.data.uuid : null);
                if (uuid) {
                    if (cache)
                        cache.set(p, uuid);
                    return uuid;
                }
            }
        }
        catch (e) {
            process.stderr.write(`[comdr] asset resolve failed for ${p}: ${e.message}\n`);
        }
    }
    return null;
}
/** 解析组件属性值中的资产路径 → UUID（含子资产 @ 后缀） */
async function resolveAssetValue(componentType, property, value, toolCenter, signal, cache, projectPath, catalog) {
    if (typeof value !== 'string')
        return { resolved: value };
    if (!looksLikeAssetPath(value))
        return { resolved: value };
    if (!isAssetProperty(componentType, property, catalog))
        return { resolved: value };
    const mainUuid = await resolveAssetPath(value, toolCenter, signal, cache);
    if (!mainUuid) {
        // 检查 Bridge 是否返回了模糊匹配候选列表
        let candidates = [];
        try {
            const result = await toolCenter.submit({ type: 'probe', payload: { probeType: 'asset', path: value } }, signal);
            if (result.ok && result.data) {
                const data = result.data;
                const fuzzyList = data.candidates;
                if (fuzzyList && fuzzyList.length > 0) {
                    candidates = fuzzyList.map((c) => c.path);
                }
            }
        }
        catch { /* best-effort */ }
        if (candidates.length > 0) {
            throw new Error(`Asset "${value}" not found. Did you mean one of:\n  ${candidates.join('\n  ')}`);
        }
        throw new Error(`Asset not found: "${value}". Did you truncate the path? Use the full relative path from probe result (e.g. model/helloWorld/sky.png), not just the filename.`);
    }
    // 子资产解析：读取 .meta → subMetas → 匹配 @f9941 等后缀
    if (projectPath) {
        const sub = resolveSubAssetFromMeta(mainUuid, projectPath, value, property);
        if (sub) {
            // 包装为 Cocos 资产引用格式 { __uuid__: ..., __expectedType__: ... }
            return {
                resolved: sub.expectedType
                    ? { __uuid__: sub.uuid, __expectedType__: sub.expectedType }
                    : { __uuid__: sub.uuid },
                resolvedPath: value,
                expectedType: sub.expectedType,
            };
        }
    }
    // 包装为 Cocos 资产引用格式 { __uuid__: ... }
    const expectedType = guessExpectedType(property);
    const wrapped = expectedType
        ? { __uuid__: mainUuid, __expectedType__: expectedType }
        : { __uuid__: mainUuid };
    return { resolved: wrapped, resolvedPath: value, expectedType };
}
/** 根据属性名推测期望的资产类型（用于 __expectedType__）
 *  通过启发式命名规则推断，与 serialize.ts 中的 expectedTypeForProp 保持一致 */
function guessExpectedType(property) {
    const clean = property.replace(/^_/, '');
    if (/spriteFrame$/i.test(clean) || /^sprite$/i.test(clean))
        return 'cc.SpriteFrame';
    if (/spriteAtlas$/i.test(clean) || /atlas$/i.test(clean))
        return 'cc.SpriteAtlas';
    if (/Material$/i.test(clean))
        return 'cc.Material';
    if (/Font$/i.test(clean))
        return 'cc.TTFFont';
    if (/Texture$/i.test(clean))
        return 'cc.Texture2D';
    return undefined;
}
/** 批量解析：遍历 props，自动解析 asset 类型的值 */
async function resolveAssetValues(componentType, props, toolCenter, signal, cache, projectPath, catalog) {
    const resolved = [];
    const newProps = {};
    for (const [key, value] of Object.entries(props)) {
        const result = await resolveAssetValue(componentType, key, value, toolCenter, signal, cache, projectPath, catalog);
        newProps[key] = result.resolved;
        if (result.resolvedPath && typeof result.resolvedPath === 'string') {
            const uuid = typeof result.resolved === 'object' && result.resolved !== null
                ? result.resolved.__uuid__
                : typeof result.resolved === 'string' ? result.resolved : '';
            if (uuid)
                resolved.push({ property: key, path: result.resolvedPath, uuid });
        }
    }
    return { props: newProps, resolved };
}
//# sourceMappingURL=asset-resolver.js.map