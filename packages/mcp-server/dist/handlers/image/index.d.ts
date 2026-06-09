export type { CocosProjectPaths, CocosAssetPath } from './cocos/paths';
export { resolveProjectPaths, stripAssetsPrefix, toCocosAssetPath, fromDbPath, readMetaFile } from './cocos/paths';
export { generateCocosUuid } from './cocos/uuid';
export type { MetaWriteOptions, MetaWriteResult } from './cocos/meta-writer';
export { writeTextureMeta } from './cocos/meta-writer';
export { DB_PROTOCOL, ASSETS_DIR, ASSETS_PREFIX, META_EXT, META_VERSION, IMPORTER_IMAGE, IMPORTER_SPRITE_FRAME, USERDATA_NAMESPACE, UI_TYPE_META, UI_TYPES, TRIM_SKIP_TYPES } from './cocos/constants';
export type { UiTypeMeta } from './cocos/constants';
export { validateImagePath, MIME_MAP, SUPPORTED_EXTENSIONS, MAX_SIZE_BYTES } from './utils';
export type { ImageValidationResult, ImageValidationError } from './utils';
//# sourceMappingURL=index.d.ts.map