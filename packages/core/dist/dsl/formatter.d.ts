import { ExecutedCommand, DslCommand } from '../types';
import { CommanderState } from '../memory/session-memory';
import { ComponentCatalog } from '../model/component-catalog';
/** 将执行结果格式化为多行文本反馈 */
export declare function formatCommandResults(results: ExecutedCommand[], catalog?: ComponentCatalog | null): string;
/** 格式化链式失败信息 */
export declare function formatChainFailure(completed: ExecutedCommand[], failedCmd: DslCommand, failedResult: {
    ok: boolean;
    error?: string;
}, remaining: DslCommand[]): string;
/** 构建本轮增量：只输出本轮新创建的 tempId（短名，不含 UUID） */
export declare function buildTurnDelta(commanderState: CommanderState | null): string;
//# sourceMappingURL=formatter.d.ts.map