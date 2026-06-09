"use strict";
// ============================================================
// Cocos 路径工具 — db:// ↔ fs 互转
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
exports.resolveProjectPaths = resolveProjectPaths;
exports.stripAssetsPrefix = stripAssetsPrefix;
exports.toCocosAssetPath = toCocosAssetPath;
exports.fromDbPath = fromDbPath;
exports.readMetaFile = readMetaFile;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const constants_1 = require("./constants");
/**
 * 校验并解析 Cocos 项目路径。
 * 检查 {projectPath}/assets/ 目录是否存在。
 */
function resolveProjectPaths(rawPath) {
    const projectPath = path.resolve(rawPath.trim());
    const assetsDir = path.join(projectPath, constants_1.ASSETS_DIR);
    if (!fs.existsSync(projectPath)) {
        return { projectPath, assetsDir, valid: false, error: `Project path not found: ${projectPath}` };
    }
    if (!fs.existsSync(assetsDir) || !fs.statSync(assetsDir).isDirectory()) {
        return { projectPath, assetsDir, valid: false, error: `No ${constants_1.ASSETS_DIR}/ directory in project: ${projectPath}` };
    }
    return { projectPath, assetsDir, valid: true };
}
/**
 * 去掉 assets/ 前缀（如 "assets/ui/btn.png" → "ui/btn.png"）。
 * 切片和生图工具共用。
 */
function stripAssetsPrefix(input) {
    const trimmed = input.trim().replace(/^[\\/]+/, '');
    if (trimmed.startsWith(constants_1.ASSETS_PREFIX)) {
        return trimmed.slice(constants_1.ASSETS_PREFIX.length);
    }
    return trimmed;
}
/**
 * 将文件系统绝对路径转为 Cocos 资产路径。
 * 要求文件在项目的 assets/ 目录下。
 */
function toCocosAssetPath(fsPath, projectPath) {
    const assetsDir = path.join(projectPath, constants_1.ASSETS_DIR);
    const normalized = path.resolve(fsPath);
    const rel = path.relative(assetsDir, normalized).replace(/\\/g, '/');
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
        return null;
    }
    return {
        dbPath: `${constants_1.DB_PROTOCOL}${constants_1.ASSETS_DIR}/${rel}`,
        relativePath: `${constants_1.ASSETS_DIR}/${rel}`,
        fsPath: normalized,
    };
}
/**
 * 将 db://assets/... 或 assets/... 路径转为文件系统绝对路径。
 */
function fromDbPath(dbPath, projectPath) {
    let rel = dbPath.trim();
    if (rel.startsWith(constants_1.DB_PROTOCOL)) {
        rel = rel.slice(constants_1.DB_PROTOCOL.length);
    }
    if (rel.startsWith(constants_1.ASSETS_PREFIX)) {
        rel = rel.slice(constants_1.ASSETS_PREFIX.length);
    }
    else if (rel === constants_1.ASSETS_DIR) {
        rel = '';
    }
    const fsPath = path.join(projectPath, constants_1.ASSETS_DIR, rel);
    if (!fs.existsSync(fsPath))
        return null;
    return fsPath;
}
/**
 * 读 .meta 文件，返回 UUID 和 importer 类型。
 */
function readMetaFile(filePath) {
    const metaPath = filePath + constants_1.META_EXT;
    if (!fs.existsSync(metaPath))
        return null;
    try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        return {
            uuid: meta.uuid || '',
            importer: meta.importer || '',
            meta,
        };
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=paths.js.map