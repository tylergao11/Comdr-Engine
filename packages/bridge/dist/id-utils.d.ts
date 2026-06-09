export declare function generateFileId(): string;
/** 生成标准 UUID v4 */
export declare function generateUuid(): string;
/** 将标准 UUID 压缩为 Cocos 3.x __type__ 使用的 23 字符格式。
 *  算法：前 5 个 hex 原样保留，剩余 27 个 hex 按 3→2 base64 压缩。 */
export declare function compressUuid(uuid: string): string;
//# sourceMappingURL=id-utils.d.ts.map