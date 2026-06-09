"use strict";
// ============================================================
// Comdr Image 能力组 — 统一入口
// 旧 read/slice/generate 已清空，新 AI 美术管线待建。
// 暂时只 re-export 基础设施模块。
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_SIZE_BYTES = exports.SUPPORTED_EXTENSIONS = exports.MIME_MAP = exports.validateImagePath = exports.TRIM_SKIP_TYPES = exports.UI_TYPES = exports.UI_TYPE_META = exports.USERDATA_NAMESPACE = exports.IMPORTER_SPRITE_FRAME = exports.IMPORTER_IMAGE = exports.META_VERSION = exports.META_EXT = exports.ASSETS_PREFIX = exports.ASSETS_DIR = exports.DB_PROTOCOL = exports.writeTextureMeta = exports.generateCocosUuid = exports.readMetaFile = exports.fromDbPath = exports.toCocosAssetPath = exports.stripAssetsPrefix = exports.resolveProjectPaths = void 0;
var paths_1 = require("./cocos/paths");
Object.defineProperty(exports, "resolveProjectPaths", { enumerable: true, get: function () { return paths_1.resolveProjectPaths; } });
Object.defineProperty(exports, "stripAssetsPrefix", { enumerable: true, get: function () { return paths_1.stripAssetsPrefix; } });
Object.defineProperty(exports, "toCocosAssetPath", { enumerable: true, get: function () { return paths_1.toCocosAssetPath; } });
Object.defineProperty(exports, "fromDbPath", { enumerable: true, get: function () { return paths_1.fromDbPath; } });
Object.defineProperty(exports, "readMetaFile", { enumerable: true, get: function () { return paths_1.readMetaFile; } });
var uuid_1 = require("./cocos/uuid");
Object.defineProperty(exports, "generateCocosUuid", { enumerable: true, get: function () { return uuid_1.generateCocosUuid; } });
var meta_writer_1 = require("./cocos/meta-writer");
Object.defineProperty(exports, "writeTextureMeta", { enumerable: true, get: function () { return meta_writer_1.writeTextureMeta; } });
var constants_1 = require("./cocos/constants");
Object.defineProperty(exports, "DB_PROTOCOL", { enumerable: true, get: function () { return constants_1.DB_PROTOCOL; } });
Object.defineProperty(exports, "ASSETS_DIR", { enumerable: true, get: function () { return constants_1.ASSETS_DIR; } });
Object.defineProperty(exports, "ASSETS_PREFIX", { enumerable: true, get: function () { return constants_1.ASSETS_PREFIX; } });
Object.defineProperty(exports, "META_EXT", { enumerable: true, get: function () { return constants_1.META_EXT; } });
Object.defineProperty(exports, "META_VERSION", { enumerable: true, get: function () { return constants_1.META_VERSION; } });
Object.defineProperty(exports, "IMPORTER_IMAGE", { enumerable: true, get: function () { return constants_1.IMPORTER_IMAGE; } });
Object.defineProperty(exports, "IMPORTER_SPRITE_FRAME", { enumerable: true, get: function () { return constants_1.IMPORTER_SPRITE_FRAME; } });
Object.defineProperty(exports, "USERDATA_NAMESPACE", { enumerable: true, get: function () { return constants_1.USERDATA_NAMESPACE; } });
Object.defineProperty(exports, "UI_TYPE_META", { enumerable: true, get: function () { return constants_1.UI_TYPE_META; } });
Object.defineProperty(exports, "UI_TYPES", { enumerable: true, get: function () { return constants_1.UI_TYPES; } });
Object.defineProperty(exports, "TRIM_SKIP_TYPES", { enumerable: true, get: function () { return constants_1.TRIM_SKIP_TYPES; } });
// 通用图片工具
var utils_1 = require("./utils");
Object.defineProperty(exports, "validateImagePath", { enumerable: true, get: function () { return utils_1.validateImagePath; } });
Object.defineProperty(exports, "MIME_MAP", { enumerable: true, get: function () { return utils_1.MIME_MAP; } });
Object.defineProperty(exports, "SUPPORTED_EXTENSIONS", { enumerable: true, get: function () { return utils_1.SUPPORTED_EXTENSIONS; } });
Object.defineProperty(exports, "MAX_SIZE_BYTES", { enumerable: true, get: function () { return utils_1.MAX_SIZE_BYTES; } });
//# sourceMappingURL=index.js.map