export interface MetaWriteOptions {
    /** 九宫格参数（像素） */
    nineSlice?: {
        left: number;
        right: number;
        top: number;
        bottom: number;
    };
    /** 资产类型标签（存 userData.comdr.type） */
    assetType?: string;
}
export interface MetaWriteResult {
    uuid: string;
    metaPath: string;
}
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
export declare function writeTextureMeta(pngPath: string, options?: MetaWriteOptions): MetaWriteResult;
//# sourceMappingURL=meta-writer.d.ts.map