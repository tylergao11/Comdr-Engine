import { ParsedDslOutput } from '../types';
/** 标准化文本 + 按 ; 分割，检测缺少 ; 时用 > 作为辅助分隔符 */
export declare function splitTokens(text: string): string[];
/** 解析单个 token: >name(args) → { name, args } */
export declare function parseToken(token: string): {
    name: string;
    args: Record<string | number, unknown>;
} | null;
/** 解析参数列表 */
export declare function parseArgs(argsStr: string): Record<string | number, unknown>;
/** 按逗号分割，尊重引号和括号 */
export declare function splitByComma(str: string): string[];
/** 类型强制转换 */
export declare function coerceVal(v: string): unknown;
export declare function parseDslOutput(text: string): ParsedDslOutput;
//# sourceMappingURL=parser.d.ts.map