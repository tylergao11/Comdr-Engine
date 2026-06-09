export { VERSION } from './version';
export declare function load(): Promise<void>;
export declare function unload(): void;
export declare function open(assetPath: string): Promise<unknown>;
export declare function getProjectInfo(): Record<string, unknown>;
export { runTaskCardFromEditor as runTaskCard };
declare function runTaskCardFromEditor(taskCard: {
    type: string;
    payload?: Record<string, unknown>;
}): Promise<unknown>;
//# sourceMappingURL=index.d.ts.map