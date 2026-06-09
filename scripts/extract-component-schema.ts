// ============================================================
// extract-component-schema — 从 Cocos Creator 引擎 TS 源码提取组件 schema
// 用法: npx tsx scripts/extract-component-schema.ts [engineCocosPath] [outputPath]
//
// 扫描引擎源码目录，通过 TS Compiler API 遍历 AST：
//   @ccclass('cc.Xxx')  → 组件全名
//   @type(ClassName)    → 属性序列化类型
//   @serializable + = initValue → 默认值
//
// 输出: component-cache.json (Comdr.component-schema.v1)
// ============================================================

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

// ===== 类型 =====

interface ExtractedProperty {
  name: string;
  type: string;
  default?: unknown;
}

interface ExtractedComponent {
  fullType: string;
  className: string;
  properties: ExtractedProperty[];
}

// ===== 类型分类 =====

/** 引擎值类型 → Comdr type */
const VALUE_TYPE_MAP: Record<string, string> = {
  Vec2: 'vec2', Vec3: 'vec3', Vec4: 'vec4',
  Size: 'size', Color: 'color', Rect: 'rect', Quat: 'quat',
  Mat4: 'object', Mat3: 'object',
};

/** 引擎 asset 类型（类名 → Comdr type: asset） */
const ASSET_TYPE_NAMES = new Set([
  'Asset', 'Texture2D', 'TextureCube', 'RenderTexture',
  'SpriteFrame', 'SpriteAtlas', 'Material', 'MaterialVariant',
  'EffectAsset', 'Font', 'TTFFont', 'BitmapFont', 'LabelAtlas',
  'AnimationClip', 'AudioClip', 'VideoClip', 'Mesh', 'Skeleton',
  'Prefab', 'SceneAsset', 'ImageAsset', 'JsonAsset', 'TextAsset',
  'BufferAsset', 'ParticleAsset',
  'TextureBase', 'SimpleTexture', 'FontAtlas',
]);

/** 引擎组件基类 */
const COMPONENT_BASE_NAMES = new Set([
  'Component', 'UIRenderer', 'RenderComponent', 'UIRenderable',
]);

/** 已知的 ccenum 注册类型 */
const ENUM_TYPE_SET = new Set<string>();

/** 跳过的字段名（引擎内部字段，不序列化） */
const SKIP_FIELDS = new Set([
  '_name', '_enabled', '_isValid', '__type__',
  '_objFlags', '__editorExtras__', '_id', 'node',
  '__prefab', '_native', '_nativeAsset',
  'constructor', 'length', 'prototype', 'name',
]);

// ===== AST 遍历 =====

/** 收集文件中的 enum 声明（TS enum + ccenum 注册） */
function collectEnums(sourceFile: ts.SourceFile): void {
  ts.forEachChild(sourceFile, (node) => {
    // TS enum: enum Foo { A, B }
    if (ts.isEnumDeclaration(node) && node.name) {
      ENUM_TYPE_SET.add(node.name.text);
    }
    // ccenum(): ccenum(Foo) 注册
    if (ts.isExpressionStatement(node)) {
      const expr = node.expression;
      if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression) && expr.expression.text === 'ccenum') {
        const arg = expr.arguments[0];
        if (arg && ts.isIdentifier(arg)) {
          ENUM_TYPE_SET.add(arg.text);
        }
      }
    }
  });
}

/** 第一遍扫描：收集所有文件的 enum 名 */
function collectAllEnums(files: string[]): void {
  for (const filePath of files) {
    try {
      const code = fs.readFileSync(filePath, 'utf8');
      const sf = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true);
      collectEnums(sf);
    } catch { /* skip */ }
  }
}

function extractFromFile(filePath: string): ExtractedComponent[] {
  const code = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true);

  const components: ExtractedComponent[] = [];

  // 第二遍：查找 @ccclass 类
  ts.forEachChild(sourceFile, (node) => {
    if (!ts.isClassDeclaration(node) || !node.name) return;

    const className = node.name.text;
    const ccclassDecorator = ts.getDecorators(node)?.find((d) => {
      if (!ts.isCallExpression(d.expression)) return false;
      const expr = d.expression.expression;
      return ts.isIdentifier(expr) && expr.text === 'ccclass';
    });

    if (!ccclassDecorator || !ts.isCallExpression(ccclassDecorator.expression)) return;

    const ccclassArg = ccclassDecorator.expression.arguments[0];
    let fullType: string;
    if (ccclassArg && ts.isStringLiteral(ccclassArg)) {
      fullType = ccclassArg.text;
    } else {
      // @ccclass 可能没参数（使用类名），构造 cc.ClassName
      fullType = `cc.${className}`;
    }

    // 提取属性 Map: getter name → type + backing field default
    const propMap = new Map<string, ExtractedProperty>();

    // ------ 收集 @serializable 字段 + 初始值 ------
    const serializableFields = new Map<string, unknown>();
    for (const member of node.members) {
      if (!ts.isPropertyDeclaration(member)) continue;
      const hasSerializable = ts.getDecorators(member)?.some((d) => {
        if (!ts.isDecorator(d)) return false;
        const expr = d.expression;
        return ts.isIdentifier(expr) && expr.text === 'serializable';
      });
      if (!hasSerializable) continue;

      const fieldName = member.name.getText();
      // 过滤内部字段
      if (SKIP_FIELDS.has(fieldName)) continue;

      // 提取初始值
      const initializer = member.initializer;
      const defVal = initializer ? evaluateInitializer(initializer) : undefined;
      serializableFields.set(fieldName, defVal);
    }

    // ------ 收集 @type getter + 对应 @serializable 字段 ------
    for (const member of node.members) {
      if (!ts.isGetAccessor(member)) continue;
      const getterName = member.name.getText();
      if (SKIP_FIELDS.has(getterName)) continue;

      // 找 @type 装饰器
      const typeDecorator = ts.getDecorators(member)?.find((d) => {
        if (!ts.isDecorator(d) || !ts.isCallExpression(d.expression)) return false;
        const expr = d.expression.expression;
        return ts.isIdentifier(expr) && expr.text === 'type';
      });

      if (!typeDecorator || !ts.isCallExpression(typeDecorator.expression)) continue;

      const typeArg = typeDecorator.expression.arguments[0];
      if (!typeArg) continue;

      const engineType = typeArg.getText();
      const comdrType = classifyType(engineType);

      // 找对应的 @serializable 字段
      // 约定：getter "spriteFrame" → 字段 "_spriteFrame"
      const backingName = '_' + getterName;
      let defVal: unknown = undefined;
      if (serializableFields.has(backingName)) {
        defVal = serializableFields.get(backingName);
      }

      // 跳过重复（子类覆盖父类）
      if (propMap.has(getterName)) continue;

      propMap.set(getterName, { name: getterName, type: comdrType, default: defVal });
    }

    // ------ @serializable 字段无 @type getter 时，从 TS 类型注解 / initializer 推断 ------
    for (const member of node.members) {
      if (!ts.isPropertyDeclaration(member)) continue;
      const hasSerializable = ts.getDecorators(member)?.some((d) => {
        if (!ts.isDecorator(d)) return false;
        return ts.isIdentifier(d.expression) && d.expression.text === 'serializable';
      });
      if (!hasSerializable) continue;

      const fieldName = member.name.getText();
      if (SKIP_FIELDS.has(fieldName)) continue;

      // 是否已被 getter 覆盖？字段名去掉 _ 前缀匹配 getter
      const getterCandidate = fieldName.startsWith('_') ? fieldName.slice(1) : fieldName;
      if (propMap.has(getterCandidate)) continue;
      // 如果字段名本身（如 _atlas）也被已提取的某个 getter 映射到同一个 backing field，跳过
      // getter "spriteAtlas" → backing "_atlas" → field "_atlas" 不应单独出现
      let isBackingField = false;
      for (const [getterName] of propMap) {
        if ('_' + getterName === fieldName) { isBackingField = true; break; }
      }
      if (isBackingField) continue;

      // 推断类型：1) TS 类型注解  2) new Xxx() initializer  3) 跳过
      let comdrType = 'any';
      if (member.type) {
        comdrType = classifyType(member.type.getText());
      } else if (member.initializer && ts.isNewExpression(member.initializer)) {
        const ctorName = member.initializer.expression.getText();
        comdrType = classifyType(ctorName);
      }
      if (comdrType === 'any') continue;

      // 字段名保留原样（如 _contentSize 无 getter，直接用 _contentSize）
      const propName = fieldName;
      const defVal = serializableFields.get(fieldName);
      propMap.set(propName, { name: propName, type: comdrType, default: defVal });
    }

    if (propMap.size > 0) {
      components.push({
        fullType,
        className,
        properties: [...propMap.values()],
      });
    }
  });

  return components;
}

/** 分类引擎类型名 → Comdr schema 类型 */
function classifyType(engineType: string): string {
  // [T] 数组语法: [ComponentEventHandler] → ComponentEventHandler
  const arrayMatch = engineType.match(/^\[(.+)\]$/);
  if (arrayMatch) {
    // 数组类型 → 递归取元素类型
    const inner = classifyType(arrayMatch[1]);
    return inner === 'any' ? 'array' : inner; // 保留元素类型标记，上层可判断为数组
  }

  // 去掉 union: Vec3 | null → Vec3
  const clean = engineType.replace(/\s*\|\s*(null|undefined)/g, '').trim();
  const base = clean.replace(/<.*>/, '').replace(/\[]$/, '');

  // cc.Node
  if (base === 'Node') return 'node';

  // Component 基类 → component
  if (COMPONENT_BASE_NAMES.has(base)) return 'component';

  // enum (TS enum + ccenum 注册)
  if (ENUM_TYPE_SET.has(base)) return 'int';

  // 值类型
  if (VALUE_TYPE_MAP[base]) return VALUE_TYPE_MAP[base];

  // Asset 类型
  if (ASSET_TYPE_NAMES.has(base)) return 'asset';

  // 其他 PascalCase 类型 → component
  if (/^[A-Z]/.test(base)) return 'component';

  // Primitive
  switch (clean) {
    case 'number': return 'float';
    case 'string': return 'string';
    case 'boolean': return 'bool';
    case 'any': return 'any';
  }

  return 'any';
}

/** 评估 AST initializer → 字面量值 */
function evaluateInitializer(init: ts.Expression): unknown {
  // null
  if (init.kind === ts.SyntaxKind.NullKeyword) return null;

  // string
  if (ts.isStringLiteral(init)) return init.text;

  // bool
  if (init.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (init.kind === ts.SyntaxKind.FalseKeyword) return false;

  // number
  if (ts.isNumericLiteral(init)) return Number(init.text);

  // enum 成员访问: SpriteType.SIMPLE
  if (ts.isPropertyAccessExpression(init)) {
    // 递归解析 enum 值需要跨文件 —— 回退到 0
    return 0;
  }

  // new Vec2(0, 0), new Vec3(...), new Color(...), new Size(...)
  if (ts.isNewExpression(init) && init.expression) {
    const ctorName = init.expression.getText();
    const args = init.arguments?.map((a) => {
      if (ts.isNumericLiteral(a)) return Number(a.text);
      if (a.kind === ts.SyntaxKind.TrueKeyword) return true;
      if (a.kind === ts.SyntaxKind.FalseKeyword) return false;
      if (ts.isStringLiteral(a)) return a.text;
      return 0;
    }) || [];

    switch (ctorName) {
      case 'Vec2': return { x: args[0] || 0, y: args[1] || 0 };
      case 'Vec3': return { x: args[0] || 0, y: args[1] || 0, z: args[2] || 0 };
      case 'Vec4': return { x: args[0] || 0, y: args[1] || 0, z: args[2] || 0, w: args[3] || 0 };
      case 'Color': return { r: args[0] || 255, g: args[1] || 255, b: args[2] || 255, a: args[3] || 255 };
      case 'Size': return { width: args[0] || 0, height: args[1] || 0 };
      case 'Rect': return { x: args[0] || 0, y: args[1] || 0, width: args[2] || 0, height: args[3] || 0 };
      case 'Quat': return { x: args[0] || 0, y: args[1] || 0, z: args[2] || 0, w: args[3] || 1 };
      default: return null;
    }
  }

  // new Set() / new Map() / etc.
  if (ts.isNewExpression(init)) return null;

  // 未识别的表达式
  return undefined;
}

// ===== 主流程 =====

function main(): void {
  const args = process.argv.slice(2);
  const engineCocosPath = args[0] || findDefaultEnginePath();
  const outputPath = args[1] || path.join(__dirname, '..', 'packages', 'bridge', 'dist', 'component-cache.json');

  if (!engineCocosPath || !fs.existsSync(engineCocosPath)) {
    console.error('Engine cocos source path not found.');
    console.error('Usage: npx tsx scripts/extract-component-schema.ts <engineCocosPath> [outputPath]');
    console.error('Example: npx tsx scripts/extract-component-schema.ts "C:/.../3.8.3/resources/resources/3d/engine/cocos"');
    process.exit(1);
  }

  // 全引擎递归扫描所有 .ts 文件
  // 排除：assembler（渲染层）、deprecated（废弃）、index（聚合导出）、node_modules
  const skipDirs = new Set(['assembler', 'node_modules', '.git', 'dist', 'compiled']);
  function shouldSkipDir(dirName: string): boolean {
    return skipDirs.has(dirName) || dirName.startsWith('.');
  }

  function scanAll(dir: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fp = path.join(dir, entry.name);
        if (entry.isDirectory() && !shouldSkipDir(entry.name)) {
          results.push(...scanAll(fp));
        } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts') && !entry.name.startsWith('deprecated')) {
          results.push(fp);
        }
      }
    } catch { /* skip inaccessible */ }
    return results;
  }

  console.log(`Scanning all .ts files in ${engineCocosPath}...`);
  const files = scanAll(engineCocosPath);
  console.log(`Found ${files.length} .ts files to process`);

  // 第一遍：收集所有 enum 名（TS enum + ccenum 注册）
  console.log('Pass 1: collecting all enum names...');
  collectAllEnums(files);
  console.log(`  Collected ${ENUM_TYPE_SET.size} enum type names`);

  // 第二遍：提取组件 schema
  console.log('Pass 2: extracting component schemas...');
  const allComponents = new Map<string, ExtractedComponent>();

  let processed = 0;
  for (const file of files) {
    try {
      const components = extractFromFile(file);
      for (const comp of components) {
        const existing = allComponents.get(comp.fullType);
        if (!existing) {
          allComponents.set(comp.fullType, comp);
        } else {
          // 合并属性（同一组件可能在多个文件声明）
          const existingNames = new Set(existing.properties.map((p) => p.name));
          for (const p of comp.properties) {
            if (!existingNames.has(p.name)) {
              existing.properties.push(p);
            }
          }
        }
      }
      processed++;
    } catch (e) {
      // 跳过解析失败的文件
    }
  }
  console.log(`Processed ${processed}/${files.length} files`);

  // 构建输出
  const output: Record<string, unknown> = {
    schema: 'Comdr.component-schema.v1',
    source: 'engine-ts-source',
    generatedBy: 'extract-component-schema',
    version: path.basename(path.dirname(path.dirname(path.dirname(path.dirname(engineCocosPath))))),
    parsedAt: new Date().toISOString(),
    components: {} as Record<string, unknown>,
  };

  const components = output.components as Record<string, unknown>;
  for (const [fullType, comp] of allComponents) {
    const props: Record<string, { type: string; default?: unknown }> = {};
    for (const p of comp.properties) {
      const entry: { type: string; default?: unknown } = { type: p.type };
      if (p.default !== undefined) entry.default = p.default;
      props[p.name] = entry;
    }
    components[fullType] = { properties: props };
  }

  // 原子写入
  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = outputPath + '.tmp.' + Date.now();
  fs.writeFileSync(tmp, JSON.stringify(output, null, 2), 'utf8');
  try {
    fs.renameSync(tmp, outputPath);
  } catch {
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
    try { fs.rmSync(tmp, { force: true }); } catch { /* ignore */ }
  }

  console.log(`Extracted ${allComponents.size} components → ${outputPath}`);

  // 列表前 15 个
  const top = [...allComponents.keys()].sort().slice(0, 15);
  console.log('Top components:', top.join(', '));
}

function findDefaultEnginePath(): string | null {
  const platform = process.platform;
  let editorsRoot: string;
  if (platform === 'win32') {
    editorsRoot = 'C:\\ProgramData\\cocos\\editors\\Creator';
  } else {
    editorsRoot = path.join(process.env.HOME || '.', 'Library', 'Application Support', 'CocosDashboard', 'editors');
  }

  if (!fs.existsSync(editorsRoot)) return null;

  const versions = fs.readdirSync(editorsRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^\d+\.\d+/.test(e.name))
    .map((e) => e.name)
    .sort()
    .reverse();

  for (const ver of versions) {
    const cocosPath = path.join(editorsRoot, ver, 'resources', 'resources', '3d', 'engine', 'cocos');
    if (fs.existsSync(cocosPath)) return cocosPath;
  }

  return null;
}

main();
