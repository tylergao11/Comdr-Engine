/** MIME 类型映射 */
export declare const MIME_MAP: Record<string, string>;
/** 文件大小上限：10MB */
export declare const MAX_SIZE_BYTES: number;
/** 支持的扩展名列表 */
export declare const SUPPORTED_EXTENSIONS: string[];
export interface ImageValidationResult {
    ok: true;
    filePath: string;
    mimeType: string;
    ext: string;
    size: number;
}
export interface ImageValidationError {
    ok: false;
    error: string;
}
/**
 * 统一图片路径 + 存在性 + 大小 + 类型校验。
 * read-image / slice-image / generate-image 共用。
 */
export declare function validateImagePath(rawPath: string | undefined): ImageValidationResult | ImageValidationError;
//# sourceMappingURL=utils.d.ts.map