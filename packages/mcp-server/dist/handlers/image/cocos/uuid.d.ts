/**
 * 生成 Cocos 兼容的 UUID v4。
 * 优先使用 crypto.randomUUID() (Node 19+)，
 * 降级到 randomBytes 手动构造。
 */
export declare function generateCocosUuid(): string;
//# sourceMappingURL=uuid.d.ts.map