import { PropertySchema } from './cocos-world';
export type ProbeKind = 'project-summary' | 'assets' | 'asset' | 'asset-search' | 'find-in-doc' | 'node-detail' | 'document-serialize' | 'schema' | 'scripts' | 'console' | 'property';
export interface ProbeRequest {
    kind: ProbeKind;
    path?: string;
    paths?: string[];
    pattern?: string;
    name?: string;
    fileId?: string;
    componentType?: string;
    property?: string;
    level?: string;
    limit?: number;
    query?: string;
    [key: string]: unknown;
}
export interface ProbeResponse {
    ok: boolean;
    kind: ProbeKind;
    error?: string;
    errorCode?: string;
    data?: ProbeData;
}
/** 所有探针返回的数据联合类型 */
export type ProbeData = ProjectSummaryData | AssetListData | AssetDetailData | FindInDocData | NodeDetailData | DocumentData | SchemaData | ScriptListData | ConsoleData | PropertyData;
export interface ProjectSummaryData {
    kind: 'project-summary';
    scenes: number;
    prefabs: number;
    scripts: number;
    scriptList?: Array<{
        name: string;
        path: string;
        compressedId: string;
    }>;
}
export interface AssetListData {
    kind: 'assets';
    path: string;
    entries: Array<{
        name: string;
        path: string;
        isDir: boolean;
        uuid?: string;
    }>;
}
export interface AssetDetailData {
    kind: 'asset';
    path: string;
    uuid: string;
    importer: string;
    subAssets?: Array<{
        name: string;
        uuid: string;
    }>;
}
export interface FindInDocData {
    kind: 'find-in-doc';
    matches: Array<{
        fileId: string;
        name: string;
        path: string;
        components: string[];
        childCount: number;
    }>;
}
export interface NodeDetailData {
    kind: 'node-detail';
    fileId: string;
    name: string;
    active: boolean;
    components: Array<{
        __type__: string;
        fileId?: string;
        enabled?: boolean;
    }>;
    children: Array<{
        fileId: string;
        name: string;
    }>;
}
export interface DocumentData {
    kind: 'document';
    path: string;
    json: unknown[];
    rootFileId: string;
    nodeCount: number;
}
export interface SchemaData {
    kind: 'schema';
    componentType: string;
    isScript: boolean;
    className?: string;
    properties: PropertySchema[];
}
export interface ScriptListData {
    kind: 'scripts';
    path: string;
    scripts: Array<{
        name: string;
        path: string;
        compressedId: string;
        methods: string[];
        properties: string[];
    }>;
}
export interface ConsoleData {
    kind: 'console';
    entries: Array<{
        level: string;
        message: string;
        timestamp: number;
    }>;
}
export interface PropertyData {
    kind: 'property';
    fileId: string;
    componentType: string;
    property: string;
    value: unknown;
}
//# sourceMappingURL=probe-protocol.d.ts.map