// ============================================================
// Cocos 路径工具 — db:// ↔ fs 互转
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import { DB_PROTOCOL, ASSETS_DIR, ASSETS_PREFIX, META_EXT } from './constants';

export interface CocosProjectPaths {
  projectPath: string;
  assetsDir: string;
  valid: boolean;
  error?: string;
}

export interface CocosAssetPath {
  dbPath: string;
  relativePath: string;
  fsPath: string;
}

/**
 * 校验并解析 Cocos 项目路径。
 * 检查 {projectPath}/assets/ 目录是否存在。
 */
export function resolveProjectPaths(rawPath: string): CocosProjectPaths {
  const projectPath = path.resolve(rawPath.trim());
  const assetsDir = path.join(projectPath, ASSETS_DIR);

  if (!fs.existsSync(projectPath)) {
    return { projectPath, assetsDir, valid: false, error: `Project path not found: ${projectPath}` };
  }
  if (!fs.existsSync(assetsDir) || !fs.statSync(assetsDir).isDirectory()) {
    return { projectPath, assetsDir, valid: false, error: `No ${ASSETS_DIR}/ directory in project: ${projectPath}` };
  }

  return { projectPath, assetsDir, valid: true };
}

/**
 * 去掉 assets/ 前缀（如 "assets/ui/btn.png" → "ui/btn.png"）。
 * 切片和生图工具共用。
 */
export function stripAssetsPrefix(input: string): string {
  const trimmed = input.trim().replace(/^[\\/]+/, '');
  if (trimmed.startsWith(ASSETS_PREFIX)) {
    return trimmed.slice(ASSETS_PREFIX.length);
  }
  return trimmed;
}

/**
 * 将文件系统绝对路径转为 Cocos 资产路径。
 * 要求文件在项目的 assets/ 目录下。
 */
export function toCocosAssetPath(fsPath: string, projectPath: string): CocosAssetPath | null {
  const assetsDir = path.join(projectPath, ASSETS_DIR);
  const normalized = path.resolve(fsPath);

  const rel = path.relative(assetsDir, normalized).replace(/\\/g, '/');
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return null;
  }

  return {
    dbPath: `${DB_PROTOCOL}${ASSETS_DIR}/${rel}`,
    relativePath: `${ASSETS_DIR}/${rel}`,
    fsPath: normalized,
  };
}

/**
 * 将 db://assets/... 或 assets/... 路径转为文件系统绝对路径。
 */
export function fromDbPath(dbPath: string, projectPath: string): string | null {
  let rel = dbPath.trim();

  if (rel.startsWith(DB_PROTOCOL)) {
    rel = rel.slice(DB_PROTOCOL.length);
  }
  if (rel.startsWith(ASSETS_PREFIX)) {
    rel = rel.slice(ASSETS_PREFIX.length);
  } else if (rel === ASSETS_DIR) {
    rel = '';
  }

  const fsPath = path.join(projectPath, ASSETS_DIR, rel);
  if (!fs.existsSync(fsPath)) return null;
  return fsPath;
}

/**
 * 读 .meta 文件，返回 UUID 和 importer 类型。
 */
export function readMetaFile(filePath: string): { uuid: string; importer: string; meta: Record<string, unknown> } | null {
  const metaPath = filePath + META_EXT;
  if (!fs.existsSync(metaPath)) return null;

  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    return {
      uuid: (meta.uuid as string) || '',
      importer: (meta.importer as string) || '',
      meta,
    };
  } catch {
    return null;
  }
}
