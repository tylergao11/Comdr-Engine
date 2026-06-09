import type { Document } from './document';
import type { ResourceIndex } from './resource-index';
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
    data?: Record<string, unknown>;
}
export declare class ProbeV2 {
    private _projectPath;
    private _assetsDir;
    private _currentDoc;
    private _resourceIndex;
    /** 注入 ResourceIndex（由 index.ts 在初始化后调用） */
    setResourceIndex(ri: ResourceIndex): void;
    constructor(projectPath: string, currentDoc?: Document | null);
    setDocument(doc: Document | null): void;
    /** 统一探针入口 */
    handle(request: ProbeRequest): Promise<ProbeResponse>;
    private projectSummary;
    private listAssets;
    private resolveAsset;
    private searchAssets;
    private findInDoc;
    private nodeDetail;
    private serializeDocument;
    private getSchema;
    private listScripts;
    private getConsoleLogs;
    private readProperty;
    private safeDir;
    private _walkDirCache;
    private walkDir;
    private fuzzyAssetSearch;
}
//# sourceMappingURL=probe-v2.d.ts.map