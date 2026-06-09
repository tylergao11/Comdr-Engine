"use strict";
// ============================================================
// Cocos 相关常量 — 全 image/ 目录唯一真相源
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRIM_SKIP_TYPES = exports.UI_TYPES = exports.UI_TYPE_META = exports.DEFAULT_REGION_TYPE = exports.MIN_REGION_SIZE = exports.DEFAULT_SLICE_OUTPUT_DIR = exports.USERDATA_NAMESPACE = exports.IMPORTER_SPRITE_FRAME = exports.IMPORTER_IMAGE = exports.META_VERSION = exports.META_EXT = exports.ASSETS_PREFIX = exports.ASSETS_DIR = exports.DB_PROTOCOL = void 0;
/** Cocos 资源协议前缀 */
exports.DB_PROTOCOL = 'db://';
/** Cocos 项目 assets 目录名 */
exports.ASSETS_DIR = 'assets';
exports.ASSETS_PREFIX = 'assets/';
/** Cocos .meta 文件扩展名 */
exports.META_EXT = '.meta';
/** .meta 文件格式版本（对齐 Cocos 3.8.3 原生格式） */
exports.META_VERSION = '1.0.27';
/** Cocos 3.x 图片导入器（值即名，不强转） */
exports.IMPORTER_IMAGE = 'image';
/** Cocos 3.x SpriteFrame 子资产导入器 */
exports.IMPORTER_SPRITE_FRAME = 'sprite-frame';
/** .meta userData 命名空间 */
exports.USERDATA_NAMESPACE = 'comdr';
/** 默认切片输出目录（Cocos 项目内） */
exports.DEFAULT_SLICE_OUTPUT_DIR = 'comdr-slices';
/** 最小切片区域尺寸（像素），小于此值跳过 */
exports.MIN_REGION_SIZE = 4;
/** 默认区域类型（未知类型回退） */
exports.DEFAULT_REGION_TYPE = 'icon';
exports.UI_TYPE_META = {
    button: { label: '按钮', prefix: 'btn', folder: 'buttons' },
    panel: { label: '面板', prefix: 'panel', folder: 'panels' },
    icon: { label: 'Icon', prefix: 'icon', folder: 'icons' },
    text: { label: '文本区域', prefix: 'txt', folder: 'texts' },
    nine_slice: { label: '九宫格', prefix: 'nine', folder: 'nine-slices' },
    glow: { label: '发光层', prefix: 'glow', folder: 'effects' },
    shadow: { label: '阴影层', prefix: 'shadow', folder: 'effects' },
    bg: { label: '背景', prefix: 'bg', folder: 'backgrounds' },
    effect: { label: '特效', prefix: 'fx', folder: 'effects' },
};
/** 所有支持的 UI 类型名 */
exports.UI_TYPES = Object.keys(exports.UI_TYPE_META);
/** trim 跳过的类型（不需要自动裁剪的类型） */
exports.TRIM_SKIP_TYPES = new Set(['bg']);
//# sourceMappingURL=constants.js.map