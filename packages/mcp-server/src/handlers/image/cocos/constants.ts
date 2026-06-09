// ============================================================
// Cocos 相关常量 — 全 image/ 目录唯一真相源
// ============================================================

/** Cocos 资源协议前缀 */
export const DB_PROTOCOL = 'db://';

/** Cocos 项目 assets 目录名 */
export const ASSETS_DIR = 'assets';
export const ASSETS_PREFIX = 'assets/';

/** Cocos .meta 文件扩展名 */
export const META_EXT = '.meta';

/** .meta 文件格式版本（对齐 Cocos 3.8.3 原生格式） */
export const META_VERSION = '1.0.27';

/** Cocos 3.x 图片导入器（值即名，不强转） */
export const IMPORTER_IMAGE = 'image';
/** Cocos 3.x SpriteFrame 子资产导入器 */
export const IMPORTER_SPRITE_FRAME = 'sprite-frame';

/** .meta userData 命名空间 */
export const USERDATA_NAMESPACE = 'comdr';

/** 默认切片输出目录（Cocos 项目内） */
export const DEFAULT_SLICE_OUTPUT_DIR = 'comdr-slices';

/** 最小切片区域尺寸（像素），小于此值跳过 */
export const MIN_REGION_SIZE = 4;

/** 默认区域类型（未知类型回退） */
export const DEFAULT_REGION_TYPE = 'icon';

// ============================================================
// UI 类型元数据 — 与 comdr-image-slicer 的 TYPE_META 对齐
// ============================================================

export interface UiTypeMeta {
  label: string;
  prefix: string;
  folder: string;
}

export const UI_TYPE_META: Record<string, UiTypeMeta> = {
  button:     { label: '按钮',     prefix: 'btn',    folder: 'buttons' },
  panel:      { label: '面板',     prefix: 'panel',  folder: 'panels' },
  icon:       { label: 'Icon',     prefix: 'icon',   folder: 'icons' },
  text:       { label: '文本区域', prefix: 'txt',    folder: 'texts' },
  nine_slice: { label: '九宫格',   prefix: 'nine',   folder: 'nine-slices' },
  glow:       { label: '发光层',   prefix: 'glow',   folder: 'effects' },
  shadow:     { label: '阴影层',   prefix: 'shadow', folder: 'effects' },
  bg:         { label: '背景',     prefix: 'bg',     folder: 'backgrounds' },
  effect:     { label: '特效',     prefix: 'fx',     folder: 'effects' },
};

/** 所有支持的 UI 类型名 */
export const UI_TYPES = Object.keys(UI_TYPE_META);

/** trim 跳过的类型（不需要自动裁剪的类型） */
export const TRIM_SKIP_TYPES = new Set(['bg']);
