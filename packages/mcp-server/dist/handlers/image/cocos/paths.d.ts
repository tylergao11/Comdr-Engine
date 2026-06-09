export interface CocosProjectPaths {
    projectPath: string;
    assetsDir: string;
    valid: boolean;
    error?: string;
}
export interface CocosAssetPath {
    dbPath: string;
    relativePath: string;
    fsPath: string;
}
/**
 * 校验并解析 Cocos 项目路径。
 * 检查 {projectPath}/assets/ 目录是否存在。
 */
export declare function resolveProjectPaths(rawPath: string): CocosProjectPaths;
/**
 * 去掉 assets/ 前缀（如 "assets/ui/btn.png" → "ui/btn.png"）。
 * 切片和生图工具共用。
 */
export declare function stripAssetsPrefix(input: string): string;
/**
 * 将文件系统绝对路径转为 Cocos 资产路径。
 * 要求文件在项目的 assets/ 目录下。
 */
export declare function toCocosAssetPath(fsPath: string, projectPath: string): CocosAssetPath | null;
/**
 * 将 db://assets/... 或 assets/... 路径转为文件系统绝对路径。
 */
export declare function fromDbPath(dbPath: string, projectPath: string): string | null;
/**
 * 读 .meta 文件，返回 UUID 和 importer 类型。
 */
export declare function readMetaFile(filePath: string): {
    uuid: string;
    importer: string;
    meta: Record<string, unknown>;
} | null;
//# sourceMappingURL=paths.d.ts.map