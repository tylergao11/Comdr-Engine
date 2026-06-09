/** Cocos 资源协议前缀 */
export declare const DB_PROTOCOL = "db://";
/** Cocos 项目 assets 目录名 */
export declare const ASSETS_DIR = "assets";
export declare const ASSETS_PREFIX = "assets/";
/** Cocos .meta 文件扩展名 */
export declare const META_EXT = ".meta";
/** .meta 文件格式版本（对齐 Cocos 3.8.3 原生格式） */
export declare const META_VERSION = "1.0.27";
/** Cocos 3.x 图片导入器（值即名，不强转） */
export declare const IMPORTER_IMAGE = "image";
/** Cocos 3.x SpriteFrame 子资产导入器 */
export declare const IMPORTER_SPRITE_FRAME = "sprite-frame";
/** .meta userData 命名空间 */
export declare const USERDATA_NAMESPACE = "comdr";
/** 默认切片输出目录（Cocos 项目内） */
export declare const DEFAULT_SLICE_OUTPUT_DIR = "comdr-slices";
/** 最小切片区域尺寸（像素），小于此值跳过 */
export declare const MIN_REGION_SIZE = 4;
/** 默认区域类型（未知类型回退） */
export declare const DEFAULT_REGION_TYPE = "icon";
export interface UiTypeMeta {
    label: string;
    prefix: string;
    folder: string;
}
export declare const UI_TYPE_META: Record<string, UiTypeMeta>;
/** 所有支持的 UI 类型名 */
export declare const UI_TYPES: string[];
/** trim 跳过的类型（不需要自动裁剪的类型） */
export declare const TRIM_SKIP_TYPES: Set<string>;
//# sourceMappingURL=constants.d.ts.map