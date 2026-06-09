export interface ProjectContextInput {
    mode?: 'discover' | 'validate';
    projectPath?: string;
    editorProjectPath?: string;
    cwd?: string;
    roots?: string[];
    maxDepth?: number;
}
export interface ProjectCandidate {
    schema: string;
    projectPath: string;
    projectName: string;
    score: number;
    markers: string[];
    source: string;
}
export interface ProjectContext {
    schema: string;
    status: string;
    kind: string;
    specialized: boolean;
    source: string;
    projectPath: string;
    projectName: string;
    reason: string;
    checkedPath: string;
    score: number;
    markers: string[];
    candidates: ProjectCandidate[];
    role: string;
    instruction: string;
}
/** 对给定路径进行 Cocos 项目评分 */
export declare function scoreCocosProjectPath(projectPath: string): ProjectCandidate;
export declare function discoverCandidates(input?: Partial<ProjectContextInput>): ProjectCandidate[];
export declare function resolveProjectContext(input?: ProjectContextInput): ProjectContext;
export declare function isSpecializedProjectContext(ctx: ProjectContext): boolean;
//# sourceMappingURL=project-context.d.ts.map