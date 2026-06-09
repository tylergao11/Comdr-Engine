export interface ScriptInfo {
    name: string;
    path: string;
    compressedId: string;
    methods: string[];
    properties: string[];
}
export declare class ResourceIndex {
    private _projectPath;
    private _scripts;
    private _assetPaths;
    constructor(projectPath: string);
    fullScan(): Promise<void>;
    getScripts(): ScriptInfo[];
    getSummary(): Record<string, unknown>;
    private _scanDir;
    private _processFile;
}
//# sourceMappingURL=resource-index.d.ts.map