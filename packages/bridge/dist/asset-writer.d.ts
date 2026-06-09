export declare class AssetWriter {
    private _projectPath;
    constructor(projectPath: string);
    writeAsset(payload: Record<string, unknown>): Promise<unknown>;
    private _verifyWriteback;
    private _generateMeta;
    private _generateUuid;
}
//# sourceMappingURL=asset-writer.d.ts.map