import { CompileSpec } from '../../model/cocos-world';
import { ComponentCatalog } from '../../model/component-catalog';
import { InternalAssetCatalog } from '../../model/internal-catalog';
export declare function resetEnrichCounters(): void;
/** Enrich：返回一个新的 CompileSpec，包含所有 knowledge 展开 */
export declare function enrich(spec: CompileSpec, catalog: ComponentCatalog, internalCatalog?: InternalAssetCatalog): CompileSpec;
//# sourceMappingURL=enrich.d.ts.map