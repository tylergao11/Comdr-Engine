declare const _default: (cc: CcModule, EditorExtends: {
    serialize: (obj: unknown) => string;
}) => ProbeLibApi;
export = _default;
interface CcNode {
    uuid: string;
    name: string;
    children: CcNode[];
    parent: CcNode | null;
    active: boolean;
    isValid?: boolean;
    components?: CcComponent[];
    walk(fn: (node: CcNode) => void): void;
    destroy(): void;
    addComponent(ctor: {
        new (): unknown;
    }): unknown;
}
interface CcComponent {
    uuid: string;
    enabled: boolean;
    node: CcNode;
    constructor: {
        name?: string;
    };
}
interface CcModule {
    Node: {
        new (): CcNode;
    };
    Component: {
        new (): CcComponent;
    };
    Prefab: {
        new (): {
            name: string;
            data: CcNode;
        };
    };
    director: {
        getScene(): unknown;
    };
    js?: {
        getClassName(ctor: unknown): string;
    };
    VERSION?: string;
    [key: string]: unknown;
}
interface ProbeLibApi {
    probeCurrentStage(): Record<string, unknown>;
    getNodeDetail(args: {
        nodeUuid?: string;
    }): Record<string, unknown>;
    probePrefabRootInfo(): Record<string, unknown>;
    serializeCurrentDocument(): Record<string, unknown>;
    getNodePropertyValue(args: Record<string, unknown>): Record<string, unknown>;
    getConsoleLog(args?: {
        level?: string;
        limit?: number;
        since?: number;
    }): Record<string, unknown>;
    dumpEngineSchema(): Record<string, unknown>;
    getComponentSchema(typeName: string): Record<string, unknown>;
}
//# sourceMappingURL=bridge-probe-lib.d.ts.map