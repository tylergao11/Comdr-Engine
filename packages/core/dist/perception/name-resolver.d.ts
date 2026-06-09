import { ProjectSnapshot } from './project-snapshot';
import { ComponentCatalog } from '../model/component-catalog';
export interface ResolvedName {
    original: string;
    kind: 'node' | 'prefab' | 'scene' | 'script' | 'component' | 'resource' | 'unknown';
    value: string;
    display: string;
    ambiguous: boolean;
    alternatives: string[];
}
export interface NameResolution {
    resolved: ResolvedName[];
    unresolved: string[];
    questions: string[];
}
/** 从 Claude 指令中提取所有需要解析的裸名字，并尝试解析 */
export declare function resolveNames(request: string, snapshot: ProjectSnapshot, catalog?: ComponentCatalog | null): NameResolution;
/** 生成带解析标注的增强版指令文本 */
export declare function buildResolvedRequest(originalRequest: string, resolution: NameResolution): string;
//# sourceMappingURL=name-resolver.d.ts.map