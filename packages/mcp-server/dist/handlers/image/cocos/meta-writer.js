"use strict";
// ============================================================
// Cocos .meta 文件生成器
// 为图片资产生成 TextureImporter 兼容的 .meta，
// 含 SpriteFrame 子资产（九宫格场景）
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
exports.writeTextureMeta = writeTextureMeta;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const uuid_1 = require("./uuid");
const constants_1 = require("./constants");
/**
 * 为 PNG 文件生成并写入 Cocos TextureImporter 兼容的 .meta 文件。
 *
 * 生成的 .meta 格式:
 *   importer: IMPORTER_IMAGE       → Cocos 识别为图片，自动生成 ImageAsset/Texture2D
 *   subMetas                → SpriteFrame 子资产（九宫格场景含 borders）
 *   userData.comdr          → Comdr 元数据（类型、时间戳、九宫格参数）
 *
 * 如果 .meta 已存在，不覆盖（保留编辑器生成的 subMetas）。
 */
function writeTextureMeta(pngPath, options = {}) {
    const fileName = path.basename(pngPath);
    const baseName = fileName.replace(/\.[^.]+$/, '');
    const metaPath = pngPath + constants_1.META_EXT;
    // 如果已存在 .meta，不覆盖（Cocos 可能已注册资源引用）
    if (fs.existsSync(metaPath)) {
        try {
            const existing = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            return { uuid: existing.uuid || '', metaPath };
        }
        catch {
            // 损坏的 .meta，继续覆盖写入
        }
    }
    const textureUuid = (0, uuid_1.generateCocosUuid)();
    const spriteUuid = (0, uuid_1.generateCocosUuid)();
    const meta = {
        ver: constants_1.META_VERSION,
        importer: constants_1.IMPORTER_IMAGE,
        imported: true,
        uuid: textureUuid,
        files: ['.json', fileName],
        subMetas: {},
        userData: {
            [constants_1.USERDATA_NAMESPACE]: {
                createdAt: new Date().toISOString(),
                ...(options.assetType ? { type: options.assetType } : {}),
                ...(options.nineSlice ? { nineSlice: options.nineSlice } : {}),
            },
        },
    };
    // 九宫格：写入 SpriteFrame 子资产的 borders（Cocos _capInsets 格式）
    if (options.nineSlice) {
        const ns = options.nineSlice;
        meta.subMetas[baseName] = {
            importer: constants_1.IMPORTER_SPRITE_FRAME,
            uuid: spriteUuid,
            userData: {
                borders: [ns.left, ns.top, ns.right, ns.bottom],
            },
        };
    }
    // 原子写入
    const content = JSON.stringify(meta, null, 2) + '\n';
    const tmpPath = metaPath + '.tmp.' + Date.now();
    fs.writeFileSync(tmpPath, content, 'utf8');
    try {
        fs.renameSync(tmpPath, metaPath);
    }
    catch {
        fs.writeFileSync(metaPath, content, 'utf8');
        try {
            fs.rmSync(tmpPath, { force: true });
        }
        catch { /* ignore */ }
    }
    return { uuid: textureUuid, metaPath };
}
//# sourceMappingURL=meta-writer.js.map