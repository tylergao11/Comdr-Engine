import { ComponentCatalog } from '../model/component-catalog';
import { ToolCenter } from '../tool-center/tool-center';
import { AssetCache } from '../memory/asset-cache';
/** 判断字符串是否看起来像资产路径（非 UUID） */
export declare function looksLikeAssetPath(value: string): boolean;
/** 判断属性是否需要资产引用（组件 schema 查询） */
export declare function isAssetProperty(componentType: string, propertyName: string, catalog?: ComponentCatalog | null): boolean;
/** 单次资产路径解析：路径 → UUID（优先从缓存读，miss 则 probe Bridge 并回写缓存）
 *  自动尝试补全 assets/ 前缀（Commander 可能给出 package/xxx.png 而非 assets/package/xxx.png） */
export declare function resolveAssetPath(value: string, toolCenter: ToolCenter, signal?: AbortSignal, cache?: AssetCache | null): Promise<string | null>;
/** 解析组件属性值中的资产路径 → UUID（含子资产 @ 后缀） */
export declare function resolveAssetValue(componentType: string, property: string, value: unknown, toolCenter: ToolCenter, signal?: AbortSignal, cache?: AssetCache | null, projectPath?: string, catalog?: ComponentCatalog | null): Promise<{
    resolved: unknown;
    resolvedPath?: string;
    expectedType?: string;
}>;
/** 批量解析：遍历 props，自动解析 asset 类型的值 */
export declare function resolveAssetValues(componentType: string, props: Record<string, unknown>, toolCenter: ToolCenter, signal?: AbortSignal, cache?: AssetCache | null, projectPath?: string, catalog?: ComponentCatalog | null): Promise<{
    props: Record<string, unknown>;
    resolved: Array<{
        property: string;
        path: string;
        uuid: string;
    }>;
}>;
//# sourceMappingURL=asset-resolver.d.ts.map