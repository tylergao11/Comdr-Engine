// ============================================================
// Comdr Image 能力组 — 统一入口
// 旧 read/slice/generate 已清空，新 AI 美术管线待建。
// 暂时只 re-export 基础设施模块。
// ============================================================

// Cocos 基础设施（.meta 写入、UUID、路径转换）
export type { CocosProjectPaths, CocosAssetPath } from './cocos/paths';
export { resolveProjectPaths, stripAssetsPrefix, toCocosAssetPath, fromDbPath, readMetaFile } from './cocos/paths';
export { generateCocosUuid } from './cocos/uuid';
export type { MetaWriteOptions, MetaWriteResult } from './cocos/meta-writer';
export { writeTextureMeta } from './cocos/meta-writer';
export { DB_PROTOCOL, ASSETS_DIR, ASSETS_PREFIX, META_EXT, META_VERSION, IMPORTER_IMAGE, IMPORTER_SPRITE_FRAME, USERDATA_NAMESPACE, UI_TYPE_META, UI_TYPES, TRIM_SKIP_TYPES } from './cocos/constants';
export type { UiTypeMeta } from './cocos/constants';

// 通用图片工具
export { validateImagePath, MIME_MAP, SUPPORTED_EXTENSIONS, MAX_SIZE_BYTES } from './utils';
export type { ImageValidationResult, ImageValidationError } from './utils';
