// ============================================================
// ProbeV2 — 统一的 Bridge 探针入口
// 替代 asset-probe.ts 的 14 分支 switch。
// 统一请求形状 → 统一响应形状。一个入口，一种规则。
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import type { Document } from './document';
import type { ResourceIndex } from './resource-index';
import { normalizeAssetPath } from './path-utils';
import { MSG_NO_DOCUMENT_OPEN } from './error-codes';

declare const Editor: {
  Message: { request: (scope: string, method: string, ...args: unknown[]) => Promise<unknown> };
};

// ===== 统一协议类型（与 core/src/model/probe-protocol.ts 结构一致） =====

export type ProbeKind =
  | 'project-summary' | 'assets' | 'asset' | 'asset-search'
  | 'find-in-doc' | 'node-detail' | 'document-serialize'
  | 'schema' | 'scripts' | 'console' | 'property';

export interface ProbeRequest {
  kind: ProbeKind;
  path?: string;
  paths?: string[];
  pattern?: string;
  name?: string;
  fileId?: string;
  componentType?: string;
  property?: string;
  level?: string;
  limit?: number;
  query?: string;
  [key: string]: unknown;
}

export interface ProbeResponse {
  ok: boolean;
  kind: ProbeKind;
  error?: string;
  errorCode?: string;
  data?: Record<string, unknown>;
}

// ===== 统一入口 =====

export class ProbeV2 {
  private _projectPath: string;
  private _assetsDir: string;
  private _currentDoc: Document | null;
  private _resourceIndex: ResourceIndex | null = null;

  /** 注入 ResourceIndex（由 index.ts 在初始化后调用） */
  setResourceIndex(ri: ResourceIndex): void { this._resourceIndex = ri; }

  constructor(projectPath: string, currentDoc: Document | null = null) {
    this._projectPath = projectPath;
    this._assetsDir = path.join(projectPath, 'assets');
    this._currentDoc = currentDoc;
  }

  setDocument(doc: Document | null): void {
    this._currentDoc = doc;
  }

  /** 统一探针入口 */
  async handle(request: ProbeRequest): Promise<ProbeResponse> {
    switch (request.kind) {
      case 'project-summary':  return this.projectSummary();
      case 'assets':           return this.listAssets(request.path);
      case 'asset':            return this.resolveAsset(request.path || '');
      case 'asset-search':     return this.searchAssets(request.pattern || request.query || '');
      case 'find-in-doc':      return this.findInDoc(request.name || request.query || '');
      case 'node-detail':      return this.nodeDetail(request.fileId || '');
      case 'document-serialize': return this.serializeDocument();
      case 'schema':           return this.getSchema(request.componentType || '');
      case 'scripts':          return this.listScripts(request.path);
      case 'console':          return this.getConsoleLogs(request.level, request.limit);
      case 'property':         return this.readProperty(request.fileId || '', request.componentType || '', request.property);
      default:
        return { ok: false, kind: request.kind, error: `Unknown probe kind: ${request.kind}` };
    }
  }

  // ===== 各探针实现 =====

  private async projectSummary(): Promise<ProbeResponse> {
    const allFiles = this.walkDir(this._assetsDir);
    const scenes = allFiles.filter((f) => f.endsWith('.scene')).length;
    const prefabs = allFiles.filter((f) => f.endsWith('.prefab')).length;
    const tsFiles = allFiles.filter((f) => f.endsWith('.ts') || f.endsWith('.js'));
    const scripts = tsFiles.length;

    // 提取脚本类名
    const scriptList: Array<{ name: string; path: string; compressedId: string }> = [];
    for (const f of tsFiles) {
      const relPath = path.relative(this._assetsDir, f).replace(/\\/g, '/');
      // 尝试读 .meta 获取 UUID
      let uuid = '';
      try {
        const meta = JSON.parse(fs.readFileSync(f + '.meta', 'utf8'));
        uuid = meta.uuid || '';
      } catch { /* */ }
      // 提取可能的类名（从文件名）
      const name = path.basename(f, path.extname(f));
      scriptList.push({ name, path: relPath, compressedId: uuid });
    }

    return {
      ok: true,
      kind: 'project-summary',
      data: {
        kind: 'project-summary',
        scenes,
        prefabs,
        scripts,
        scriptList,
      },
    };
  }

  private async listAssets(subPath?: string): Promise<ProbeResponse> {
    if (subPath) {
      const target = this.safeDir(subPath);
      if (!target) return { ok: false, kind: 'assets', error: 'Invalid dir' };
      const files = this.walkDir(target)
        .filter((f) => !f.endsWith('.meta'))
        .map((f) => ({
          name: path.basename(f),
          path: path.relative(this._assetsDir, f).replace(/\\/g, '/'),
          isDir: false,
        }));
      return { ok: true, kind: 'assets', data: { kind: 'assets', path: subPath, entries: files } };
    }

    // 无 path：只返回一级子目录
    const dirents = fs.readdirSync(this._assetsDir, { withFileTypes: true });
    const entries = dirents
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => ({ name: d.name, path: d.name, isDir: true }));
    return { ok: true, kind: 'assets', data: { kind: 'assets', path: '', entries } };
  }

  private async resolveAsset(assetPath: string): Promise<ProbeResponse> {
    if (!assetPath) return { ok: false, kind: 'asset', error: 'Missing path' };
    const normalized = normalizeAssetPath(assetPath);

    // 1. asset-db API
    try {
      const result = await Editor.Message.request('asset-db', 'query-asset-info', normalized.dbUrl);
      if (result && typeof result === 'object' && !Array.isArray(result)) {
        const obj = result as Record<string, unknown>;
        return {
          ok: true, kind: 'asset',
          data: {
            kind: 'asset', path: normalized.fsPath,
            uuid: (obj.uuid as string) || '', importer: (obj.importer as string) || '',
          },
        };
      }
    } catch { /* fall through */ }

    // 2. .meta 文件直读
    const metaPath = path.join(this._projectPath, normalized.fsPath + '.meta');
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        const subAssets: Array<{ name: string; uuid: string }> = [];
        if (meta.subMetas) {
          for (const [key, val] of Object.entries(meta.subMetas as Record<string, unknown>)) {
            subAssets.push({ name: key, uuid: (val as Record<string, unknown>).uuid as string || '' });
          }
        }
        return {
          ok: true, kind: 'asset',
          data: {
            kind: 'asset', path: normalized.fsPath,
            uuid: meta.uuid || '', importer: meta.importer || '',
            subAssets: subAssets.length > 0 ? subAssets : undefined,
          },
        };
      } catch { /* fall through */ }
    }

    // 3. 模糊搜索回退 — 多项匹配时不静默选一，返回候选列表
    const fuzzy = this.fuzzyAssetSearch(assetPath);
    if (fuzzy.length === 1) {
      return {
        ok: true, kind: 'asset',
        data: {
          kind: 'asset', path: normalized.fsPath,
          uuid: fuzzy[0].uuid, importer: '',
        },
      };
    }
    if (fuzzy.length > 1) {
      return {
        ok: true, kind: 'asset',
        data: {
          kind: 'asset', path: normalized.fsPath,
          candidates: fuzzy,
        },
      };
    }

    return { ok: false, kind: 'asset', error: `Asset not found: ${assetPath}` };
  }

  private async searchAssets(pattern: string): Promise<ProbeResponse> {
    if (!pattern) return { ok: false, kind: 'asset-search', error: 'Missing pattern' };
    const lower = pattern.toLowerCase();
    const results: Array<{ name: string; path: string; isDir: boolean }> = [];
    const MAX_SEARCH_DEPTH = 20;

    const searchDir = (dir: string, depth: number): void => {
      if (depth > MAX_SEARCH_DEPTH) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const rel = path.relative(this._assetsDir, fullPath).replace(/\\/g, '/');
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            if (entry.name.toLowerCase().includes(lower)) {
              results.push({ name: entry.name, path: rel, isDir: true });
            }
            searchDir(fullPath, depth + 1);
          } else if (entry.name.toLowerCase().includes(lower)) {
            results.push({ name: entry.name, path: rel, isDir: false });
          }
        }
      } catch { /* ignore */ }
    };
    searchDir(this._assetsDir, 0);

    return {
      ok: true, kind: 'asset-search',
      data: { kind: 'assets', path: '', entries: results },
    };
  }

  private async findInDoc(query: string): Promise<ProbeResponse> {
    if (!this._currentDoc) return { ok: false, kind: 'find-in-doc', error: MSG_NO_DOCUMENT_OPEN };
    const maxResults = (this._currentDoc as unknown as Record<string, unknown>)?.maxResults as number || 0;
    const cap = maxResults || 500; // 0 = 不限，默认返回最多 500（防御值）
    const results = this._currentDoc.findNodesByFuzzyName(query, cap);
    return {
      ok: true, kind: 'find-in-doc',
      data: {
        kind: 'find-in-doc',
        query,
        count: results.length,
        truncated: results.length >= maxResults,
        matches: results.map((r: Record<string, unknown>) => ({
          fileId: r.fileId,
          name: r.name,
          path: r.path,
          compTypes: r.compTypes || [],
          childCount: r.childCount || 0,
        })),
      },
    };
  }

  private async nodeDetail(fileId: string): Promise<ProbeResponse> {
    if (!this._currentDoc) return { ok: false, kind: 'node-detail', error: MSG_NO_DOCUMENT_OPEN };
    const detail = this._currentDoc.detail(fileId);
    if (!detail) return { ok: false, kind: 'node-detail', error: `Node not found: ${fileId}` };
    return { ok: true, kind: 'node-detail', data: { kind: 'node-detail', ...detail } };
  }

  private async serializeDocument(): Promise<ProbeResponse> {
    if (!this._currentDoc) return { ok: false, kind: 'document-serialize', error: 'No open document' };
    try {
      const json = JSON.parse(this._currentDoc.serialize());
      return {
        ok: true, kind: 'document-serialize',
        data: { kind: 'document', path: this._currentDoc.dbUrl || '', json, rootFileId: '', nodeCount: json.length },
      };
    } catch (e) {
      return { ok: false, kind: 'document-serialize', error: `Serialize failed: ${(e as Error).message}` };
    }
  }

  private async getSchema(componentType: string): Promise<ProbeResponse> {
    if (!componentType) return { ok: false, kind: 'schema', error: 'Missing componentType' };

    // 安全：JSON.stringify 阻止任意代码注入，componentType 只能是字符串，无法突破引号边界。
    // require('./bridge-probe-lib') 依赖 Cocos Editor 的 scene 脚本执行环境的 cwd 为扩展目录。
    try {
      const scriptContent = `
        var probeLib = require('./bridge-probe-lib');
        probeLib(cc, EditorExtends).getComponentSchema(${JSON.stringify(componentType)});
      `;
      const result = await Editor.Message.request('scene', 'execute-scene-script', scriptContent);
      if (result && typeof result === 'object') {
        const obj = result as Record<string, unknown>;
        return {
          ok: true, kind: 'schema',
          data: {
            kind: 'schema',
            componentType,
            isScript: !!obj.isScript,
            className: obj.className as string,
            properties: obj.properties || [],
          },
        };
      }
      return { ok: false, kind: 'schema', error: 'Schema query returned no data' };
    } catch (e) {
      return { ok: false, kind: 'schema', error: `Schema probe failed: ${(e as Error).message}` };
    }
  }

  private async listScripts(subPath?: string): Promise<ProbeResponse> {
    if (subPath) {
      const target = this.safeDir(subPath);
      if (!target) return { ok: false, kind: 'scripts', error: 'Invalid dir' };
      const files = this.walkDir(target)
        .filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
        .map((f) => {
          const rel = path.relative(this._assetsDir, f).replace(/\\/g, '/');
          return { name: path.basename(f, path.extname(f)), path: rel, compressedId: '', methods: [], properties: [] };
        });
      return { ok: true, kind: 'scripts', data: { kind: 'scripts', path: subPath, scripts: files } };
    }

    // 全项目扫描：先触发 ResourceIndex 刷新（自动生成缺失 .meta）
    if (this._resourceIndex) {
      await this._resourceIndex.fullScan();
      const scripts = this._resourceIndex.getScripts().map((s) => ({
        name: s.name,
        path: path.relative(this._assetsDir, s.path).replace(/\\/g, '/'),
        compressedId: s.compressedId,
        methods: s.methods,
        properties: s.properties,
      }));
      return { ok: true, kind: 'scripts', data: { kind: 'scripts', path: '', scripts } };
    }

    // Fallback：ResourceIndex 未注入时内联扫描
    const files = this.walkDir(this._assetsDir)
      .filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
      .map((f) => {
        const rel = path.relative(this._assetsDir, f).replace(/\\/g, '/');
        return { name: path.basename(f, path.extname(f)), path: rel, compressedId: '', methods: [], properties: [] };
      });
    return { ok: true, kind: 'scripts', data: { kind: 'scripts', path: '', scripts: files } };
  }

  private async getConsoleLogs(level?: string, limit?: number): Promise<ProbeResponse> {
    try {
      const args = JSON.stringify({ level: level || undefined, limit, summary: !level });
      const scriptContent = `
        var probeLib = require('./bridge-probe-lib');
        probeLib(cc, EditorExtends).getConsoleLog(${args});
      `;
      const result = await Editor.Message.request('scene', 'execute-scene-script', scriptContent);
      return {
        ok: true, kind: 'console',
        data: { kind: 'console', entries: (result as unknown[]) || [] },
      };
    } catch (e) {
      return { ok: false, kind: 'console', error: `Console probe failed: ${(e as Error).message}` };
    }
  }

  private async readProperty(fileId: string, componentType: string, property?: string): Promise<ProbeResponse> {
    if (!this._currentDoc) return { ok: false, kind: 'property', error: MSG_NO_DOCUMENT_OPEN };
    const result = this._currentDoc.readProperty(fileId, componentType, property);
    return {
      ok: true, kind: 'property',
      data: {
        kind: 'property',
        fileId,
        componentType,
        property: property || '',
        value: result,
      },
    };
  }

  // ===== 工具方法 =====

  private safeDir(subPath: string): string {
    const resolved = path.resolve(this._assetsDir, subPath);
    if (!resolved.startsWith(this._assetsDir)) return '';
    return resolved;
  }

  // walkDir 缓存（TTL 5s，防御同一轮中重复全盘扫描）
  private _walkDirCache: { dir: string; files: string[]; time: number } | null = null;

  private walkDir(dir: string): string[] {
    const now = Date.now();
    if (this._walkDirCache && this._walkDirCache.dir === dir && (now - this._walkDirCache.time) < 5000) {
      return this._walkDirCache.files;
    }
    const results: string[] = [];
    const walk = (d: string): void => {
      try {
        const entries = fs.readdirSync(d, { withFileTypes: true });
        for (const entry of entries) {
          const fp = path.join(d, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            walk(fp);
          } else {
            results.push(fp);
          }
        }
      } catch (e) {
        const code = (e as NodeJS.ErrnoException).code;
        if (code === 'EACCES' || code === 'EPERM') {
          process.stderr.write(`[bridge] walkDir permission denied: ${d}\n`);
        } else if (code !== 'ENOENT') {
          process.stderr.write(`[bridge] walkDir error in ${d}: ${(e as Error).message}\n`);
        }
      }
    };
    walk(dir);
    this._walkDirCache = { dir, files: results, time: now };
    return results;
  }

  private fuzzyAssetSearch(query: string): Array<{ path: string; uuid: string }> {
    const lower = query.toLowerCase();
    const allFiles = this.walkDir(this._assetsDir)
      .filter((f) => !f.endsWith('.meta') && !f.endsWith('.ts') && !f.endsWith('.js'))
      .map((f) => ({
        absPath: f,
        relPath: path.relative(this._assetsDir, f).replace(/\\/g, '/'),
        name: path.basename(f).toLowerCase(),
      }));

    const matches = allFiles.filter(
      (f) => f.name.includes(lower) || f.relPath.toLowerCase().includes(lower),
    );

    if (matches.length === 0) {
      const fuzzy: Array<typeof allFiles[0] & { dist: number }> = [];
      for (const f of allFiles) {
        const d = Math.min(levenshtein(lower, f.name, 3), levenshtein(lower, f.relPath.toLowerCase(), 3));
        if (d <= 3) fuzzy.push({ ...f, dist: d });
      }
      fuzzy.sort((a, b) => a.dist - b.dist);
      if (fuzzy.length > 10) process.stderr.write(`[comdr] probe-v2 fuzzy search truncated: ${fuzzy.length} → 10 results for "${lower}"\n`);
      return fuzzy.slice(0, 10).map((f) => {
        let uuid = '';
        try { const meta = JSON.parse(fs.readFileSync(f.absPath + '.meta', 'utf8')); uuid = meta.uuid || ''; } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== 'ENOENT') process.stderr.write(`[comdr] probe-v2 .meta read failed: ${f.absPath}.meta — ${(e as Error).message}\n`);
        }
        return { path: f.relPath, uuid };
      });
    }

    matches.sort((a, b) => a.name.length - b.name.length);
    if (matches.length > 10) process.stderr.write(`[comdr] probe-v2 exact match truncated: ${matches.length} → 10 results for "${lower}"\n`);
    return matches.slice(0, 10).map((f) => {
      let uuid = '';
      try { const meta = JSON.parse(fs.readFileSync(f.absPath + '.meta', 'utf8')); uuid = meta.uuid || ''; } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') process.stderr.write(`[comdr] probe-v2 .meta read failed: ${f.absPath}.meta — ${(e as Error).message}\n`);
      }
      return { path: f.relPath, uuid };
    });
  }
}

/** 与 foundation/value-kit.ts 算法一致的 Levenshtein 实现。
 *  Bridge 独立部署不交叉 import，保留副本。单行 DP + 长度预过滤。 */
function levenshtein(a: string, b: string, maxDist: number = Infinity): number {
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;
  if (a.length > b.length) { const t = a; a = b; b = t; }
  const m = a.length, n = b.length;
  let prev = new Array<number>(m + 1);
  let curr = new Array<number>(m + 1);
  for (let i = 0; i <= m; i++) prev[i] = i;
  for (let j = 1; j <= n; j++) {
    curr[0] = j;
    let rowMin = j;
    for (let i = 1; i <= m; i++) {
      curr[i] = a[i - 1] === b[j - 1] ? prev[i - 1] : 1 + Math.min(prev[i], curr[i - 1], prev[i - 1]);
      if (curr[i] < rowMin) rowMin = curr[i];
    }
    if (rowMin > maxDist) return maxDist + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[m];
}
