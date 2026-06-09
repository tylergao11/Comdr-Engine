export interface NormalizedPath {
    /** Filesystem path relative to project root (always uses assets/ prefix, forward slashes) */
    fsPath: string;
    /** db:// URL form for Cocos asset-db API */
    dbUrl: string;
}
/**
 * Normalize an asset path from any supported input format.
 *
 * Input                          → fsPath                            → dbUrl
 * model/helloWorld/sky.png       → assets/model/helloWorld/sky.png   → db://assets/model/helloWorld/sky.png
 * assets/model/helloWorld/sky.png→ assets/model/helloWorld/sky.png   → db://assets/model/helloWorld/sky.png
 * db://assets/model/helloWorld/sky.png → assets/model/helloWorld/sky.png → db://assets/model/helloWorld/sky.png
 */
export declare function normalizeAssetPath(raw: string): NormalizedPath;
//# sourceMappingURL=path-utils.d.ts.map