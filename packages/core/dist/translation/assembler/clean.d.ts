import { PrefabJson, AssemblyStats } from '../../model/cocos-world';
/** 清除内部标记：tempId, _comdr_tempId, _nestedSource, _nestedRoot, _prefabInstance, __id__ */
export declare function clean(json: PrefabJson): PrefabJson;
/** 统计组装结果 */
export declare function computeStats(json: PrefabJson): AssemblyStats;
//# sourceMappingURL=clean.d.ts.map