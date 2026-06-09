import { ComponentIdentity, PropertySchema } from './cocos-world';
export interface KnowledgeChildComponent {
    type: string;
    optional?: boolean;
    props?: Record<string, unknown>;
}
export interface KnowledgeChildNode {
    id: string;
    name: string;
    required: boolean;
    autoCreateCondition?: string;
    parent?: string;
    components: KnowledgeChildComponent[];
    children?: KnowledgeChildNode[];
}
export interface KnowledgeRef {
    targetType: 'node' | 'component';
    targetChild?: string;
    componentType?: string;
    optional?: boolean;
}
export interface ComponentKnowledge {
    description?: string;
    autoAdd?: boolean;
    autoAddCondition?: string;
    requires?: string[];
    conflicts?: string[];
    constraint?: string;
    children?: KnowledgeChildNode[];
    refs?: Record<string, KnowledgeRef>;
    defaults?: Record<string, unknown>;
}
export interface ComponentEntry {
    identity: ComponentIdentity;
    schema: PropertySchema[];
    knowledge: ComponentKnowledge | null;
    template: Record<string, unknown>;
}
export declare class ComponentCatalog {
    /** 规范类型名 → 条目 */
    private _entries;
    /** 类名 → 规范名（Sprite → cc.Sprite, testComdr → compressedUuid） */
    private _nameIndex;
    /** 压缩 UUID → 规范名（反向查脚本） */
    private _uuidIndex;
    private _loaded;
    /** 一次性加载所有组件数据 */
    load(projectPath: string): number;
    /** 重新加载 */
    reload(projectPath: string): void;
    get isLoaded(): boolean;
    /** 获取单个组件条目（接受类名、cc.Xxx 全名、或压缩 UUID） */
    get(typeName: string): ComponentEntry | null;
    /** 解析类型名为规范形式。
     *   "Sprite"      → "cc.Sprite"
     *   "cc.Sprite"   → "cc.Sprite"
     *   "testComdr"   → "a1b2c3d4..."（压缩 UUID）
     *   "a1b2c3d4..." → "a1b2c3d4..."（已是压缩 UUID，验证后返回） */
    resolve(typeName: string): string;
    /** 获取组件身份 */
    identityOf(typeName: string): ComponentIdentity | null;
    /** 获取属性 schema */
    schemaOf(typeName: string): PropertySchema[];
    /** 获取 JSON 模板 */
    templateOf(typeName: string): Record<string, unknown> | null;
    /** 获取组件知识 */
    knowledgeOf(typeName: string): ComponentKnowledge | null;
    /** 通过压缩 UUID 查类名 */
    classNameOf(compressedId: string): string;
    /** 通过类名查压缩 UUID */
    compressedIdOf(className: string): string;
    /** 列出所有组件类型名 */
    list(): string[];
    /** 列出所有脚本组件 */
    listScripts(): ComponentEntry[];
    /** 列出所有引擎组件 */
    listEngine(): ComponentEntry[];
    /** 模糊搜索组件 — 返回所有匹配项（按距离排序）。供 Gateway 判断歧义。 */
    fuzzyFindAll(pattern: string): string[];
    /** 模糊搜索组件（Levenshtein 距离 ≤ 2）— 返回单个最佳匹配 */
    fuzzyFind(pattern: string): string | null;
    /** 检查两个组件类型是否冲突 */
    hasConflict(typeA: string, typeB: string): boolean;
    /** 获取组件的必需依赖（同节点其他组件） */
    getRequiredComponents(typeName: string): string[];
    /** 获取组件属性的知识库默认值 */
    getKnowledgeDefaults(typeName: string): Record<string, unknown>;
    get count(): number;
}
import { RefResolver } from './cocos-world';
/** 基于 Catalog schema 的引用解析器 */
export declare function createRefResolver(catalog: ComponentCatalog): RefResolver;
//# sourceMappingURL=component-catalog.d.ts.map