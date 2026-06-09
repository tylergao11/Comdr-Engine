// ============================================================
// ResourceIndex — 项目范围资产索引
// 扫描 .meta、@ccclass、组件使用情况
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import { compressUuid, generateUuid } from './id-utils';

export interface ScriptInfo {
  name: string;
  path: string;
  compressedId: string;
  methods: string[];
  properties: string[];
}

export class ResourceIndex {
  private _projectPath: string;
  private _scripts: ScriptInfo[] = [];
  private _assetPaths: Map<string, string> = new Map(); // path → uuid

  constructor(projectPath: string) {
    this._projectPath = projectPath;
  }

  async fullScan(): Promise<void> {
    this._scripts = [];
    this._assetPaths.clear();

    const assetsDir = path.join(this._projectPath, 'assets');
    this._scanDir(assetsDir);

    // 保存到 temp/comdr/resource-index.json
    const outputDir = path.join(this._projectPath, 'temp', 'comdr');
    fs.mkdirSync(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, 'resource-index.json');
    const data = {
      schema: 'Comdr.resource-index.v2',
      updatedAt: new Date().toISOString(),
      scripts: this._scripts.map((s) => ({
        name: s.name,
        path: s.path,
        compressedId: s.compressedId,
        methods: s.methods,
        properties: s.properties,
      })),
      assetCount: this._assetPaths.size,
    };

    const tmp = outputPath + '.tmp.' + Date.now();
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    try {
      fs.renameSync(tmp, outputPath);
    } catch {
      fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
      try { fs.rmSync(tmp, { force: true }); } catch (e) { console.warn('[comdr] resource-index scan error:', (e as Error).message); }
    }
  }

  getScripts(): ScriptInfo[] {
    return this._scripts;
  }

  getSummary(): Record<string, unknown> {
    return {
      scriptCount: this._scripts.length,
      assetCount: this._assetPaths.size,
      scripts: this._scripts.slice(0, 50).map((s) => ({
        name: s.name,
        path: s.path,
        methodCount: s.methods.length,
      })),
    };
  }

  private _scanDir(dir: string): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          this._scanDir(fullPath);
        } else {
          this._processFile(fullPath);
        }
      }
    } catch (e) { console.warn('[comdr] resource-index scan error:', (e as Error).message); }
  }

  private _processFile(filePath: string): void {
    // .meta 文件：提取 UUID
    if (filePath.endsWith('.meta')) {
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const meta = JSON.parse(raw);
        if (meta.uuid) {
          const assetPath = filePath.replace(/\.meta$/, '');
          this._assetPaths.set(assetPath, meta.uuid);
        }
      } catch (e) { console.warn('[comdr] resource-index scan error:', (e as Error).message); }
    }

    // .ts/.js 文件：提取 @ccclass
    if (filePath.endsWith('.ts') || filePath.endsWith('.js')) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');

        // 简单的 @ccclass 正则匹配
        const ccclassMatch = content.match(/@ccclass\s*\(\s*['"](\w+)['"]\s*\)/);
        if (!ccclassMatch) return;

        const className = ccclassMatch[1];

        // 读取对应 .meta 文件的 UUID 并压缩；不存在则自动生成
        let compressedId = '';
        let uuid = '';
        const metaPath = filePath + '.meta';
        try {
          if (fs.existsSync(metaPath)) {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            uuid = meta.uuid || '';
          }
        } catch { /* meta read failed */ }

        // 无 .meta → 自动生成（不等 Cocos 编译，秒认新脚本）
        if (!uuid) {
          uuid = generateUuid();
          try {
            fs.writeFileSync(metaPath, JSON.stringify({
              ver: '1.1.0',
              importer: 'typescript',
              imported: true,
              uuid,
              files: [],
              subMetas: {},
              userData: {}
            }, null, 2), 'utf8');
            // 同时将 UUID 加入 _assetPaths
            this._assetPaths.set(filePath, uuid);
          } catch { /* best-effort */ }
        }
        if (uuid) {
          compressedId = compressUuid(uuid);
        }

        // 提取方法
        const methodRe = /\b(?:public\s+|private\s+|protected\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{/g;
        const methods: string[] = [];
        let m: RegExpExecArray | null;
        while ((m = methodRe.exec(content)) !== null) {
          if (!methods.includes(m[1])) methods.push(m[1]);
        }

        // 提取 @property 声明（支持同行/跨行、泛型/联合类型、null! 初始化）
        const propRe = /@property\s*(?:\([^)]*\))?[\s\n]*(?:public\s+|private\s+|protected\s+)?(\w+)\s*(?::\s*[\w<>\[\]|&\s]+)?\s*[=;]/g;
        const properties: string[] = [];
        let p: RegExpExecArray | null;
        while ((p = propRe.exec(content)) !== null) {
          if (!properties.includes(p[1])) properties.push(p[1]);
        }

        this._scripts.push({
          name: className,
          path: filePath,
          compressedId,
          methods,
          properties,
        });
      } catch (e) { console.warn('[comdr] resource-index scan error:', (e as Error).message); }
    }
  }
}
