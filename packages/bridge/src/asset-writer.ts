// ============================================================
// AssetWriter — 资产写入处理器
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import { normalizeAssetPath } from './path-utils';

declare const Editor: {
  Message: { request: (scope: string, method: string, ...args: unknown[]) => Promise<unknown> };
  Project: { path: string };
};

export class AssetWriter {
  private _projectPath: string;

  constructor(projectPath: string) {
    this._projectPath = projectPath;
  }

  async writeAsset(payload: Record<string, unknown>): Promise<unknown> {
    const rawPath = (payload.path || payload.dbUrl) as string;
    const json = payload.json;
    // 从扩展名推断资产类型，Gateway 也可显式指定 payload.assetType 覆盖
    const assetType = (payload.assetType as string) || (rawPath.endsWith('.scene') ? 'scene' : 'prefab');
    const overwrite = !!payload.overwrite;

    if (!rawPath || !json) {
      return { ok: false, error: 'Missing path or json data' };
    }

    // Normalize: strip db://, ensure assets/ prefix, normalize slashes
    const normalized = normalizeAssetPath(rawPath);
    let assetPath = normalized.fsPath;

    // 创建新文件时防同名；覆盖模式直接写
    if (!overwrite) {
      const originalPath = assetPath;
      let counter = 0;
      const MAX_RENAME_ATTEMPTS = 1000;
      while (counter < MAX_RENAME_ATTEMPTS) {
        const checkPath = path.resolve(this._projectPath, assetPath);
        if (!fs.existsSync(checkPath) && !fs.existsSync(checkPath + '.meta')) break;
        counter++;
        const dot = originalPath.lastIndexOf('.');
        if (dot > 0) {
          assetPath = originalPath.slice(0, dot) + '_' + counter + originalPath.slice(dot);
        } else {
          assetPath = originalPath + '_' + counter;
        }
    }
    if (counter >= MAX_RENAME_ATTEMPTS) {
      return { ok: false, error: `Too many name conflicts for ${originalPath} (${MAX_RENAME_ATTEMPTS} attempts exhausted)` };
    }
    }

    const fullPath = path.resolve(this._projectPath, assetPath);

    // 确保目录存在
    const dir = path.dirname(fullPath);
    fs.mkdirSync(dir, { recursive: true });

    // 原子写入：先写 tmp 再 rename，防止进程崩溃损坏源文件
    const content = JSON.stringify(json, null, 2) + '\n';
    const tmpPath = fullPath + '.tmp.' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    fs.writeFileSync(tmpPath, content, 'utf8');
    try {
      fs.renameSync(tmpPath, fullPath);
    } catch {
      // cross-device link fallback
      fs.writeFileSync(fullPath, content, 'utf8');
      try { fs.rmSync(tmpPath, { force: true }); } catch { /* ignore */ }
    }

    // 写入 .meta 文件（如果不存在）
    const metaPath = fullPath + '.meta';
    if (!fs.existsSync(metaPath)) {
      const meta = this._generateMeta(assetType, assetPath);
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');
    }

    // 通知编辑器刷新
    try {
      await Editor.Message.request('asset-db', 'refresh-asset', fullPath);
    } catch (e) { console.warn(`[comdr] Editor refresh after write failed: ${(e as Error).message}`); }

    // 验证写回
    const verified = this._verifyWriteback(fullPath, json);

    return {
      ok: true,
      path: assetPath,
      fullPath,
      verified,
    };
  }

  private _verifyWriteback(filePath: string, expected: unknown): Record<string, unknown> {
    try {
      const raw = fs.readFileSync(filePath, 'utf8').replace(/^﻿/, '');
      const actual = JSON.parse(raw);

      if (!Array.isArray(actual)) {
        return { ok: false, issue: 'Not a JSON array' };
      }

      if (!Array.isArray(expected)) {
        return { ok: false, issue: 'Expected value is not an array' };
      }
      const expectedArr = expected as unknown[];
      const actualArr = actual as unknown[];

      // 类型分布对比（cc.Node, cc.PrefabInfo, cc.CompPrefabInfo 等关键类型计数）
      const countByType = (arr: unknown[]): Record<string, number> => {
        const counts: Record<string, number> = {};
        for (const item of arr) {
          const t = (item as Record<string, unknown>)?.__type__ as string || '(none)';
          counts[t] = (counts[t] || 0) + 1;
        }
        return counts;
      };
      const expectedTypes = countByType(expectedArr);
      const actualTypes = countByType(actualArr);

      // 类型分布不一致的项
      const mismatchedTypes: Record<string, { expected: number; actual: number }> = {};
      const allTypes = new Set([...Object.keys(expectedTypes), ...Object.keys(actualTypes)]);
      for (const t of allTypes) {
        const e = expectedTypes[t] || 0;
        const a = actualTypes[t] || 0;
        if (e !== a) mismatchedTypes[t] = { expected: e, actual: a };
      }

      return {
        ok: Object.keys(mismatchedTypes).length === 0,
        expectedCount: expectedArr.length,
        actualCount: actualArr.length,
        expectedNodes: expectedTypes['cc.Node'] || 0,
        actualNodes: actualTypes['cc.Node'] || 0,
        ...(Object.keys(mismatchedTypes).length > 0 ? { mismatchedTypes } : {}),
      };
    } catch (err) {
      return { ok: false, issue: (err as Error).message };
    }
  }

  private _generateMeta(assetType: string, assetPath: string): Record<string, unknown> {
    const uuid = this._generateUuid();
    return {
      ver: '1.1.0',
      importer: assetType === 'scene' ? 'scene' : 'prefab',
      imported: true,
      uuid,
      files: [path.basename(assetPath)],
      subMetas: {},
      userData: { comdr: { createdAt: new Date().toISOString() } },
    };
  }

  private _generateUuid(): string {
    try {
      const crypto = require('crypto') as typeof import('crypto');
      // Node 19+: native randomUUID
      if (typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
      // Node 14+: randomBytes-based UUID v4
      const bytes = crypto.randomBytes(16);
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
      const hex = bytes.toString('hex');
      return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    } catch {
      // Fallback: Math.random() when crypto is unavailable (should never happen in Cocos Editor)
      const hex = '0123456789abcdef';
      let uuid = '';
      for (let i = 0; i < 36; i++) {
        if (i === 8 || i === 13 || i === 18 || i === 23) {
          uuid += '-';
        } else if (i === 14) {
          uuid += '4';
        } else if (i === 19) {
          uuid += hex[(Math.random() * 4) | 8];
        } else {
          uuid += hex[(Math.random() * 16) | 0];
        }
      }
      return uuid;
    }
  }
}
