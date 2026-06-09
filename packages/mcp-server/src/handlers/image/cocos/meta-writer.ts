// ============================================================
// Cocos .meta 文件生成器
// 为图片资产生成 TextureImporter 兼容的 .meta，
// 含 SpriteFrame 子资产（九宫格场景）
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import { generateCocosUuid } from './uuid';
import {
  META_VERSION, META_EXT,
  IMPORTER_IMAGE, IMPORTER_SPRITE_FRAME,
  USERDATA_NAMESPACE,
} from './constants';

export interface MetaWriteOptions {
  /** 九宫格参数（像素） */
  nineSlice?: { left: number; right: number; top: number; bottom: number };
  /** 资产类型标签（存 userData.comdr.type） */
  assetType?: string;
}

export interface MetaWriteResult {
  uuid: string;
  metaPath: string;
}

/**
 * 为 PNG 文件生成并写入 Cocos TextureImporter 兼容的 .meta 文件。
 *
 * 生成的 .meta 格式:
 *   importer: IMPORTER_IMAGE       → Cocos 识别为图片，自动生成 ImageAsset/Texture2D
 *   subMetas                → SpriteFrame 子资产（九宫格场景含 borders）
 *   userData.comdr          → Comdr 元数据（类型、时间戳、九宫格参数）
 *
 * 如果 .meta 已存在，不覆盖（保留编辑器生成的 subMetas）。
 */
export function writeTextureMeta(pngPath: string, options: MetaWriteOptions = {}): MetaWriteResult {
  const fileName = path.basename(pngPath);
  const baseName = fileName.replace(/\.[^.]+$/, '');
  const metaPath = pngPath + META_EXT;

  // 如果已存在 .meta，不覆盖（Cocos 可能已注册资源引用）
  if (fs.existsSync(metaPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      return { uuid: (existing.uuid as string) || '', metaPath };
    } catch {
      // 损坏的 .meta，继续覆盖写入
    }
  }

  const textureUuid = generateCocosUuid();
  const spriteUuid = generateCocosUuid();

  const meta: Record<string, unknown> = {
    ver: META_VERSION,
    importer: IMPORTER_IMAGE,
    imported: true,
    uuid: textureUuid,
    files: ['.json', fileName],
    subMetas: {},
    userData: {
      [USERDATA_NAMESPACE]: {
        createdAt: new Date().toISOString(),
        ...(options.assetType ? { type: options.assetType } : {}),
        ...(options.nineSlice ? { nineSlice: options.nineSlice } : {}),
      },
    },
  };

  // 九宫格：写入 SpriteFrame 子资产的 borders（Cocos _capInsets 格式）
  if (options.nineSlice) {
    const ns = options.nineSlice;
    (meta.subMetas as Record<string, unknown>)[baseName] = {
      importer: IMPORTER_SPRITE_FRAME,
      uuid: spriteUuid,
      userData: {
        borders: [ns.left, ns.top, ns.right, ns.bottom],
      },
    };
  }

  // 原子写入
  const content = JSON.stringify(meta, null, 2) + '\n';
  const tmpPath = metaPath + '.tmp.' + Date.now();
  fs.writeFileSync(tmpPath, content, 'utf8');
  try {
    fs.renameSync(tmpPath, metaPath);
  } catch {
    fs.writeFileSync(metaPath, content, 'utf8');
    try { fs.rmSync(tmpPath, { force: true }); } catch { /* ignore */ }
  }

  return { uuid: textureUuid, metaPath };
}
