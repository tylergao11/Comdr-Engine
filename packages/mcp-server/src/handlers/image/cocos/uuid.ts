// ============================================================
// Cocos UUID v4 生成器
// 与 asset-writer.ts 中 _generateUuid() 逻辑一致
// ============================================================

import * as crypto from 'crypto';

/**
 * 生成 Cocos 兼容的 UUID v4。
 * 优先使用 crypto.randomUUID() (Node 19+)，
 * 降级到 randomBytes 手动构造。
 */
export function generateCocosUuid(): string {
  // Node 19+: native randomUUID
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Node 14+: randomBytes-based UUID v4
  const bytes = crypto.randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
