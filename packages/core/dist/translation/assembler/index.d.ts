import { CompileSpec, AssemblerResult, RefResolver, PrefabJson } from '../../model/cocos-world';
import { ComponentCatalog } from '../../model/component-catalog';
import { InternalAssetCatalog } from '../../model/internal-catalog';
/**
 * 将 CompileSpec 组装为 Cocos prefab JSON。
 * 纯函数，所有依赖通过参数注入。无线程/模块级可变状态。
 *
 * @param spec         Commander 编译规格
 * @param catalog      统一组件目录
 * @param resolver     引用解析器（schema 驱动）
 * @param prefabLoader 嵌套 prefab 加载器（可选）
 */
export declare function assemble(spec: CompileSpec, catalog: ComponentCatalog, resolver?: RefResolver, prefabLoader?: (path: string) => PrefabJson | null, internalCatalog?: InternalAssetCatalog): AssemblerResult;
/**
 * 增量子树组装（用于 add-node 编辑操作）。
 * 不创建 Prefab wrapper，保留 __id__ 供 Bridge offset remap。
 */
export declare function assembleSubtree(spec: CompileSpec, catalog: ComponentCatalog, resolver?: RefResolver, internalCatalog?: InternalAssetCatalog): AssemblerResult & {
    idMap?: Record<string, number>;
};
export { validate } from './validate';
export { enrich } from './enrich';
export { build } from './build';
export { serialize } from './serialize';
export { clean, computeStats } from './clean';
export { generateFileId } from './id-alloc';
//# sourceMappingURL=index.d.ts.map