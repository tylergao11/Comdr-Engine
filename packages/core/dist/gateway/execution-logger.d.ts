import { ExecutionEvent } from '../types';
export declare class ExecutionLogger {
    private _logPath;
    private _dirEnsured;
    private _writeCount;
    constructor(projectPath: string);
    /** 追加一行 JSON 事件到日志文件，写失败静默（最佳努力原则）。
     *  每 20 次写入检查一次文件大小，超过 1MB 自动保留最末 500 行。 */
    write(event: ExecutionEvent): void;
}
//# sourceMappingURL=execution-logger.d.ts.map