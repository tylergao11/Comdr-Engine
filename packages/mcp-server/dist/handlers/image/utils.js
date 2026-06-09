"use strict";
// ============================================================
// Comdr Image 能力组 — 共享工具
// MIME 检测、路径校验、尺寸检查
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
exports.SUPPORTED_EXTENSIONS = exports.MAX_SIZE_BYTES = exports.MIME_MAP = void 0;
exports.validateImagePath = validateImagePath;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/** MIME 类型映射 */
exports.MIME_MAP = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
};
/** 文件大小上限：10MB */
exports.MAX_SIZE_BYTES = 10 * 1024 * 1024;
/** 支持的扩展名列表 */
exports.SUPPORTED_EXTENSIONS = Object.keys(exports.MIME_MAP);
/**
 * 统一图片路径 + 存在性 + 大小 + 类型校验。
 * read-image / slice-image / generate-image 共用。
 */
function validateImagePath(rawPath) {
    if (!rawPath || !rawPath.trim()) {
        return { ok: false, error: '[err] Missing required parameter: path' };
    }
    const filePath = path.resolve(rawPath.trim());
    if (!fs.existsSync(filePath)) {
        return { ok: false, error: `[err] ENOENT: File not found: ${filePath}` };
    }
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
        return { ok: false, error: `[err] Path is a directory: ${filePath}` };
    }
    if (stat.size > exports.MAX_SIZE_BYTES) {
        const mb = (stat.size / (1024 * 1024)).toFixed(1);
        return { ok: false, error: `[err] Image too large: ${mb} MB (max 10 MB)` };
    }
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = exports.MIME_MAP[ext];
    if (!mimeType) {
        return {
            ok: false,
            error: `[err] Unsupported image type: ${ext || '(none)'}. Supports: ${exports.SUPPORTED_EXTENSIONS.join(', ')}`,
        };
    }
    return { ok: true, filePath, mimeType, ext, size: stat.size };
}
//# sourceMappingURL=utils.js.map