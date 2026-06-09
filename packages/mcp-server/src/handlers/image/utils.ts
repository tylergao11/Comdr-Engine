// ============================================================
// Comdr Image 能力组 — 共享工具
// MIME 检测、路径校验、尺寸检查
// ============================================================

import * as fs from 'fs';
import * as path from 'path';

/** MIME 类型映射 */
export const MIME_MAP: Record<string, string> = {
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.bmp':  'image/bmp',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
};

/** 文件大小上限：10MB */
export const MAX_SIZE_BYTES = 10 * 1024 * 1024;

/** 支持的扩展名列表 */
export const SUPPORTED_EXTENSIONS = Object.keys(MIME_MAP);

export interface ImageValidationResult {
  ok: true;
  filePath: string;
  mimeType: string;
  ext: string;
  size: number;
}

export interface ImageValidationError {
  ok: false;
  error: string;
}

/**
 * 统一图片路径 + 存在性 + 大小 + 类型校验。
 * read-image / slice-image / generate-image 共用。
 */
export function validateImagePath(rawPath: string | undefined): ImageValidationResult | ImageValidationError {
  if (!rawPath || !rawPath.trim()) {
    return { ok: false, error: '[err] Missing required parameter: path' };
  }

  const filePath = path.resolve(rawPath.trim());

  if (!fs.existsSync(filePath)) {
    return { ok: false, error: `[err] ENOENT: File not found: ${filePath}` };
  }

  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    return { ok: false, error: `[err] Path is a directory: ${filePath}` };
  }

  if (stat.size > MAX_SIZE_BYTES) {
    const mb = (stat.size / (1024 * 1024)).toFixed(1);
    return { ok: false, error: `[err] Image too large: ${mb} MB (max 10 MB)` };
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_MAP[ext];
  if (!mimeType) {
    return {
      ok: false,
      error: `[err] Unsupported image type: ${ext || '(none)'}. Supports: ${SUPPORTED_EXTENSIONS.join(', ')}`,
    };
  }

  return { ok: true, filePath, mimeType, ext, size: stat.size };
}
