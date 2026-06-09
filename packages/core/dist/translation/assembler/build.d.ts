import { CompileSpec, BuiltNode, BuiltPrefab, PrefabJson } from '../../model/cocos-world';
import { ComponentCatalog } from '../../model/component-catalog';
import { IdAllocResult } from './id-alloc';
export interface BuildResult {
    ok: true;
    prefabRoot: BuiltPrefab;
    rootNode: BuiltNode;
    idResult: IdAllocResult;
    flatJson: PrefabJson;
}
export declare function build(spec: CompileSpec, catalog: ComponentCatalog, prefabLoader?: (path: string) => PrefabJson | null): BuildResult | {
    ok: false;
    error: string;
    errorCode: string;
};
//# sourceMappingURL=build.d.ts.map