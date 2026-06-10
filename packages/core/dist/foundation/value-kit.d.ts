/** 深拷贝 JSON 安全对象。优先使用 structuredClone（Node 17+），回退到 JSON 序列化 */
export declare function cloneJson<T>(value: T): T;
/** 稳定哈希 (SHA-256 截断)，用于去重和缓存 key */
export declare function stableHash(input: string, length?: number): string;
/** 读 UTF-8 JSON 文件，解析失败返回 null。调用方必须在 null 时做 fallback 处理。
 *  ENOENT（文件不存在）静默返回 null；其他错误写 stderr 后返回 null。 */
export declare function readJsonUtf8(filePath: string): unknown | null;
/** 原子写 JSON：先写 tmp，再 rename */
export declare function writeJsonAtomic(filePath: string, data: unknown, pretty?: boolean): void;
/** 反斜杠统一为斜杠 */
export declare function normalizeSlash(s: string): string;
/** 路径是否相等（忽略斜杠方向，忽略末尾斜杠） */
export declare function samePath(a: string, b: string): boolean;
/** 若输入非数组，包装为数组 */
export declare function stringArray(v: unknown): string[];
/** 去重 + 排序 */
export declare function uniqueStrings(arr: string[]): string[];
/** 安全的 ID 字符（取前 120 字符，仅保留字母数字和 . _ -） */
export declare function safeId(value: string): string;
/**
 * 计算两个字符串的 Levenshtein 编辑距离。
 * 单行 DP — O(min(m,n)) 空间，O(m×n) 时间。
 * @param maxDist 超过此距离提前退出（用于模糊匹配阈值过滤）
 */
export declare function levenshtein(a: string, b: string, maxDist?: number): number;
/** 从对象中挑选指定 key，跳过 null/undefined/空字符串 */
export declare function compactObject<T extends Record<string, unknown>>(value: T | null | undefined, keys: string[]): Partial<T> | null;
/** 浅合并，b 覆盖 a */
export declare function mergeShallow<T extends Record<string, unknown>>(a: T, b: Partial<T>): T;
/** ISO 时间戳 */
export declare function nowISO(): string;
/** UUID v4 生成器 */
export declare function generateUuid(): string;
/** LCG 伪随机 UUID（crypto 不可用时的回退） */
export declare function generateFileIdFallback(): string;
//# sourceMappingURL=value-kit.d.ts.map