// ============================================================
// NameResolver — 将用户语言中的裸名字解析为项目实体
// ============================================================

import { ProjectSnapshot, findNodeByName, collectNodeNames } from './project-snapshot';
import { ComponentCatalog } from '../model/component-catalog';

export interface ResolvedName {
  original: string;      // 原始文本
  kind: 'node' | 'prefab' | 'scene' | 'script' | 'component' | 'resource' | 'unknown';
  value: string;          // 解析后的标识符（fileId / 路径 / 完整类型名）
  display: string;        // 可读名称
  ambiguous: boolean;     // 是否有歧义
  alternatives: string[]; // 歧义时的候选列表
}

export interface NameResolution {
  resolved: ResolvedName[];
  unresolved: string[];
  questions: string[];    // 需要反问 Claude 的问题
}

const COMPONENT_NAME_PATTERN = /\b(cc\.\w+)\b/gi;

/** 从 Claude 指令中提取所有需要解析的裸名字，并尝试解析 */
export function resolveNames(
  request: string,
  snapshot: ProjectSnapshot,
  catalog?: ComponentCatalog | null,
): NameResolution {
  const resolved: ResolvedName[] = [];
  const unresolved: string[] = [];
  const questions: string[] = [];

  // 1. 先识别已知模式（cc.xxx 组件名）
  const knownComponents = new Set<string>();
  let compMatch;
  while ((compMatch = COMPONENT_NAME_PATTERN.exec(request)) !== null) {
    const raw = compMatch[1];
    const corrected = catalog?.fuzzyFind(raw) || raw;
    if (corrected !== raw) {
      resolved.push({
        original: raw,
        kind: 'component',
        value: corrected,
        display: corrected,
        ambiguous: false,
        alternatives: [],
      });
    }
    knownComponents.add(raw.toLowerCase());
  }

  // 2. 对非组件裸名，在 project snapshot 里搜索
  // 提取引号内的名字和驼峰/大写开头的名字作为候选
  const candidateNames = extractCandidateNames(request, knownComponents);

  for (const name of candidateNames) {
    const matches = findMatches(name, snapshot);
    if (matches.length === 1) {
      resolved.push({ ...matches[0], ambiguous: false, alternatives: [] });
    } else if (matches.length > 1) {
      const altNames = matches.map((m) => m.display);
      questions.push(
        `"${name}" can refer to: ${altNames.join(' | ')}. Which one?`
      );
      resolved.push({
        original: name,
        kind: 'unknown',
        value: name,
        display: name,
        ambiguous: true,
        alternatives: matches.map((m) => m.display),
      });
    } else {
      unresolved.push(name);
    }
  }

  return { resolved, unresolved, questions };
}

/** 提取请求中的人名/节点名/预制体名候选 */
function extractCandidateNames(
  request: string,
  exclude: Set<string>
): string[] {
  const candidates: string[] = [];
  // 匹配引号内的字符串
  const quoted = request.match(/"([^"]+)"/g);
  if (quoted) {
    for (const q of quoted) {
      const inner = q.slice(1, -1);
      if (!exclude.has(inner.toLowerCase())) {
        candidates.push(inner);
      }
    }
  }
  // 匹配驼峰命名或 PascalCase 的单词
  const camelWords = request.match(/\b([A-Z][a-z]+(?:[A-Z][a-z]+)+)\b/g);
  if (camelWords) {
    for (const w of camelWords) {
      if (!exclude.has(w.toLowerCase())) {
        candidates.push(w);
      }
    }
  }
  return [...new Set(candidates)];
}

/** 在 snapshot 里搜索匹配 */
function findMatches(
  name: string,
  snapshot: ProjectSnapshot
): Omit<ResolvedName, 'ambiguous' | 'alternatives'>[] {
  const matches: Omit<ResolvedName, 'ambiguous' | 'alternatives'>[] = [];
  const lower = name.toLowerCase();

  // 打开的文档节点
  if (snapshot.openDocument.kind !== 'none') {
    const node = findNodeByName(snapshot.openDocument.nodes, name);
    if (node) {
      matches.push({
        original: name,
        kind: 'node',
        value: node.fileId || name,
        display: `node:${name} (in ${snapshot.openDocument.path})`,
      });
    }
  }

  // prefab 列表
  for (const p of snapshot.prefabs) {
    const prefabName = p.path.split('/').pop()?.replace('.prefab', '') || '';
    const rootLower = p.rootName?.toLowerCase() || '';
    if (prefabName.toLowerCase() === lower || rootLower === lower) {
      matches.push({
        original: name,
        kind: 'prefab',
        value: p.path,
        display: `prefab:${p.path}`,
      });
    }
  }

  // 脚本列表
  for (const s of snapshot.scripts) {
    if (s.className.toLowerCase() === lower) {
      matches.push({
        original: name,
        kind: 'script',
        value: s.className,
        display: `script:${s.className}`,
      });
    }
  }

  // 资源路径（模糊：路径中包含该名字）
  for (const r of snapshot.resources) {
    const fileName = r.path.split('/').pop()?.split('.')[0]?.toLowerCase() || '';
    if (fileName === lower) {
      matches.push({
        original: name,
        kind: 'resource',
        value: r.uuid,
        display: `resource:${r.path}`,
      });
    }
  }

  return matches;
}

/** 生成带解析标注的增强版指令文本 */
export function buildResolvedRequest(
  originalRequest: string,
  resolution: NameResolution
): string {
  // 按 original 长度降序排序，避免短名替换污染长名的注解文本
  const sorted = [...resolution.resolved]
    .filter((r) => !r.ambiguous)
    .sort((a, b) => b.original.length - a.original.length);

  let result = originalRequest;
  for (const r of sorted) {
    const annotation = `{${r.kind}:${r.value}}`;
    result = result.replace(new RegExp(escapeRegex(r.original), 'g'), `${r.original}${annotation}`);
  }
  return result;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
