// ============================================================
// Comdr Image 能力组 — 统一入口
// 旧 read/slice/generate 已清空，新 AI 美术管线待建。
// 暂时只 re-export 基础设施模块。
// ============================================================

// Cocos 基础设施（.meta 写入、UUID、路径转换、asset-type 映射）
export { CocosPaths } from './cocos/paths';
export { generateCocosUuid, compressCocosUuid } from './cocos/uuid';
export { writeMetaFile } from './cocos/meta-writer';
export { ASSET_TYPE_MAP } from './cocos/constants';

// 通用图片工具
export { validateImagePath, MIME_MAP, SUPPORTED_EXTENSIONS, MAX_SIZE_BYTES } from './utils';
export type { ImageValidationResult, ImageValidationError } from './utils';
