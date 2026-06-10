// ============================================================
// Bridge Probe Library — Cocos 场景脚本层探针函数
// 通过 scene:execute-scene-script 调用，运行在 Cocos 运行时内
// ============================================================

// 注意：此文件在 Cocos 编辑器场景脚本环境中运行
// cc 和 EditorExtends 由 Cocos 运行时注入
// 类型声明仅用于 IDE 提示，编译时会被剥离

// ===== 本地常量（与 core/src/foundation/constants.ts 保持一致） =====
const CONSOLE_BUF_MAX = 500;        // BUFFER_CONSOLE_LOGS
const CONSOLE_DEFAULT_LIMIT = 20;
const CONSOLE_MAX_LIMIT = 100;
const TREE_MAX_NODES = 240;
const TREE_MAX_DEPTH = 6;
const TREE_MAX_COMPS = 16;

// ====== Global Console Interceptor ======

declare var globalThis: {
  __comdr_console_logs?: Array<{ level: string; message: string; timestamp: number }>;
  __comdr_console_max?: number;
  [key: string]: unknown;
};

if (!globalThis.__comdr_console_logs) {
  globalThis.__comdr_console_logs = [];
  globalThis.__comdr_console_max = CONSOLE_BUF_MAX;

  const _origLog = console.log;
  const _origWarn = console.warn;
  const _origError = console.error;
  const _origDebug = console.debug;

  function _pushLog(level: string, args: IArguments | unknown[]): void {
    const logs = globalThis.__comdr_console_logs!;
    if (logs.length >= (globalThis.__comdr_console_max || CONSOLE_BUF_MAX)) logs.shift();
    logs.push({
      level,
      message: Array.prototype.slice.call(args).join(' '),
      timestamp: Date.now(),
    });
  }

  console.log = function () { _pushLog('log', arguments); _origLog.apply(console, arguments as unknown as Parameters<typeof console.log>); };
  console.warn = function () { _pushLog('warn', arguments); _origWarn.apply(console, arguments as unknown as Parameters<typeof console.warn>); };
  console.error = function () { _pushLog('error', arguments); _origError.apply(console, arguments as unknown as Parameters<typeof console.error>); };
  console.debug = function () { _pushLog('debug', arguments); _origDebug.apply(console, arguments as unknown as Parameters<typeof console.debug>); };
}

// ====== Main Factory ======

export = function createProbeLib(
  cc: CcModule,
  EditorExtends: { serialize: (obj: unknown) => string }
): ProbeLibApi {
  const { director } = cc;

  // ====== 工具函数 ======

  function getSceneRoot(): CcNode {
    const scene = director.getScene();
    if (!scene) throw new Error('No open scene.');
    return scene as unknown as CcNode;
  }

  function findNodeByUuid(uuid: string): CcNode | null {
    if (!uuid) return null;
    let found: CcNode | null = null;
    getSceneRoot().walk((node: CcNode) => {
      if (node.uuid === uuid) found = node;
    });
    return found;
  }

  function buildNodePath(node: CcNode): string {
    const names: string[] = [];
    let cur: CcNode | null = node;
    while (cur) { names.unshift(cur.name); cur = cur.parent; }
    return names.join('/');
  }

  function safeSerialize(val: unknown): unknown {
    if (val === null || val === undefined) return null;
    if (typeof val === 'boolean' || typeof val === 'number' || typeof val === 'string') return val;
    if (typeof val === 'object') {
      const obj = val as Record<string, unknown>;
      if (obj.x !== undefined && obj.y !== undefined) {
        return { x: obj.x, y: obj.y, z: obj.z, w: obj.w };
      }
      if (obj.r !== undefined && obj.g !== undefined) {
        return { r: obj.r, g: obj.g, b: obj.b, a: obj.a };
      }
      if (Array.isArray(val)) return val.map(safeSerialize);
      try { return JSON.parse(JSON.stringify(val)); } catch { return String(val); }
    }
    return String(val);
  }

  function componentTypeName(component: CcComponent): string {
    if (!component) return '';
    const js = (cc as Record<string, unknown>).js as { getClassName?: (ctor: unknown) => string } | undefined;
    if (component.constructor && typeof js?.getClassName === 'function') {
      const cn = js.getClassName(component.constructor);
      if (cn) return String(cn);
    }
    return component.constructor?.name || '';
  }

  // ====== 节点描述 ======

  function describeNode(node: CcNode, options?: { includeComponents?: boolean }): Record<string, unknown> | null {
    if (!node) return null;
    const item: Record<string, unknown> = {
      nodeUuid: node.uuid || '',
      name: node.name || '',
      path: buildNodePath(node),
      active: node.active !== false,
    };
    if (options?.includeComponents) {
      item.components = describeNodeComponents(node);
    }
    return item;
  }

  function describeNodeTree(
    node: CcNode,
    state?: { count: number },
    options?: { maxNodes?: number; maxDepth?: number }
  ): Record<string, unknown> | null {
    if (!state) state = { count: 0 };
    if (!options) options = {};
    const maxNodes = options.maxNodes ?? TREE_MAX_NODES;
    const maxDepth = options.maxDepth ?? TREE_MAX_DEPTH;

    function visit(current: CcNode, depth: number): Record<string, unknown> | null {
      if (!current || state!.count >= maxNodes) return null;
      state!.count += 1;
      const item: Record<string, unknown> = {
        nodeUuid: current.uuid || '',
        name: current.name || '',
        path: buildNodePath(current),
        active: current.active !== false,
        childCount: (current.children || []).length,
        children: [] as Record<string, unknown>[],
      };
      item.components = describeNodeComponents(current);
      if (depth < maxDepth && current.children && current.children.length) {
        (item.children as Record<string, unknown>[]).push(
          ...current.children
            .map((child) => visit(child, depth + 1))
            .filter((x): x is Record<string, unknown> => x !== null)
        );
      }
      return item;
    }

    return visit(node, 0);
  }

  function describeNodeComponents(node: CcNode): Record<string, unknown>[] {
    const components = (Array.isArray((node as unknown as Record<string, unknown>)._components)
      ? (node as unknown as Record<string, unknown>)._components
      : node.components || []) as CcComponent[];
    const filtered = components.filter(Boolean);
    if (filtered.length > TREE_MAX_COMPS) {
      process.stderr.write(`[comdr] bridge-probe-lib components truncated: ${filtered.length} → ${TREE_MAX_COMPS} for node ${node.name || node.uuid || 'unnamed'}\n`);
    }
    return filtered
      .slice(0, TREE_MAX_COMPS)
      .map((c) => describeComponent(c))
      .filter((x): x is Record<string, unknown> => x !== null);
  }

  function describeComponent(component: CcComponent): Record<string, unknown> | null {
    if (!component) return null;
    return {
      componentUuid: component.uuid || '',
      type: componentTypeName(component),
      enabled: component.enabled !== false,
      properties: describeComponentProperties(component),
    };
  }

  function describeComponentProperties(component: CcComponent): Record<string, unknown> {
    const props: Record<string, unknown> = {};
    if (!component) return props;

    const cls = component.constructor as { __props__?: Array<string | { name: string }> } | undefined;
    const propNamesRaw = cls?.__props__ || [];
    const propNameSet: Record<string, boolean> = {};

    for (const pn of propNamesRaw) {
      const name = typeof pn === 'string' ? pn : pn.name;
      if (name) {
        propNameSet[name] = true;
        propNameSet[name.charAt(0) === '_' ? name.substring(1) : '_' + name] = true;
      }
    }

    const allKeys: string[] = [];
    for (const pn of propNamesRaw) {
      const name = typeof pn === 'string' ? pn : pn.name;
      if (name && allKeys.indexOf(name) < 0) allKeys.push(name);
    }
    for (const key in component) {
      if (component.hasOwnProperty(key) && allKeys.indexOf(key) < 0) allKeys.push(key);
    }

    for (const k of allKeys) {
      if (k === 'node') continue;
      if (k.charAt(0) === '_' && !propNameSet[k] && !propNameSet[k.substring(1)]) continue;
      try {
        const val = (component as unknown as Record<string, unknown>)[k];
        if (val === undefined || val === null || typeof val === 'function') continue;

        // Node 引用
        if (typeof cc.Node === 'function' && val instanceof cc.Node) {
          const nodeVal = val as CcNode;
          props[k] = { _refType: 'node', _nodeUuid: nodeVal.uuid || '', _nodeName: nodeVal.name || '' };
          continue;
        }
        // Component 引用
        if (typeof cc.Component === 'function' && val instanceof cc.Component) {
          const compVal = val as CcComponent;
          const js = (cc as Record<string, unknown>).js as { getClassName?: (ctor: unknown) => string } | undefined;
          const compCn = (js?.getClassName?.(compVal.constructor)) || compVal.constructor?.name || '';
          props[k] = {
            _refType: 'component', _compType: compCn, _compUuid: compVal.uuid || '',
            _nodeUuid: (compVal.node?.uuid) || '', _nodeName: (compVal.node?.name) || '',
          };
          continue;
        }
        // Asset 引用
        const objVal = val as Record<string, unknown> | null;
        if (objVal?._uuid) {
          props[k] = { _refType: 'asset', _assetUuid: objVal._uuid };
          continue;
        }
        props[k] = safeSerialize(val);
      } catch { /* skip inaccessible properties */ }
    }
    return props;
  }

  // ====== 主要 Probe 函数 ======

  function resolveEffectiveRoot(sceneRoot: CcNode): CcNode {
    if (!sceneRoot?.children) return sceneRoot;
    for (const child of sceneRoot.children) {
      if (child && child.name === 'should_hide_in_hierarchy') {
        if (child.children && child.children.length > 0) {
          return child.children[0];
        }
      }
    }
    return sceneRoot;
  }

  function probeCurrentStage(): Record<string, unknown> {
    const sceneRoot = getSceneRoot();
    const root = resolveEffectiveRoot(sceneRoot);
    const rootInfo = describeNode(root);
    const treeState = { count: 0 };
    const rootTree = describeNodeTree(root, treeState);

    return {
      schema: 'Comdr.cocos-stage-state.v1',
      runtime: { ccVersion: (cc as Record<string, unknown>).VERSION || '' },
      activeStage: { kind: 'unknown', confidence: 'scene_graph_probe', root: rootInfo },
      executionTarget: { kind: 'current_scene_graph', root: rootInfo },
      scene: {
        root: rootInfo, rootTree, name: root?.name || '',
        rootNodeUuid: root?.uuid || '',
        childCount: root?.children ? root.children.length : 0,
        capturedNodeCount: treeState.count,
      },
      prefabStage: { current: null, confidence: 'queried_by_bridge' },
      warnings: [],
    };
  }

  function getNodeDetail(args: { nodeUuid?: string } | Array<{ nodeUuid?: string }>): Record<string, unknown> {
    if (!args) return { schema: 'Comdr.node-detail-result-card.v1', status: 'error', error: 'args required' };
    const nodeUuid = typeof args === 'object' && !Array.isArray(args)
      ? (args.nodeUuid || '')
      : (Array.isArray(args) && args[0]?.nodeUuid) || '';

    if (!nodeUuid) return { schema: 'Comdr.node-detail-result-card.v1', status: 'error', error: 'nodeUuid required' };

    const node = findNodeByUuid(nodeUuid);
    if (!node) return { schema: 'Comdr.node-detail-result-card.v1', status: 'not_found', nodeUuid };

    const components = ((node as unknown as Record<string, unknown>)._components || node.components || []) as CcComponent[];
    const detail: Record<string, unknown> = {
      schema: 'Comdr.node-detail-result-card.v1', status: 'ok', nodeUuid,
      name: node.name || '', path: buildNodePath(node), active: node.active,
      childCount: (node.children || []).length,
      children: (node.children || []).map((c) => ({ name: c.name || '', nodeUuid: c.uuid || '' })),
      components: [] as Record<string, unknown>[],
    };

    for (const comp of components) {
      if (!comp) continue;
      (detail.components as Record<string, unknown>[]).push({
        type: comp.constructor?.name || 'Unknown',
        enabled: comp.enabled !== false,
        properties: describeComponentProperties(comp),
      });
    }
    return detail;
  }

  function probePrefabRootInfo(): Record<string, unknown> {
    const scene = getSceneRoot();
    const children = (scene.children || []).filter((c) => c && typeof c.isValid !== 'undefined' && (c as unknown as Record<string, unknown>).isValid !== false);
    if (!children.length) return { ok: false, error: 'No content node in editing context.' };

    const contentRoot = children[0];
    let prefabInfo: Record<string, unknown> | null = null;

    const pf = (contentRoot as unknown as Record<string, unknown>)._prefab as Record<string, unknown> | undefined;
    if (pf?.fileId) {
      prefabInfo = { fileId: pf.fileId, nodeUuid: contentRoot.uuid, nodeName: contentRoot.name };
    }

    if (!prefabInfo) {
      contentRoot.walk((node) => {
        if (prefabInfo) return;
        const pf2 = (node as unknown as Record<string, unknown>)._prefab as Record<string, unknown> | undefined;
        if (pf2?.fileId) {
          prefabInfo = { fileId: pf2.fileId, nodeUuid: node.uuid, nodeName: node.name };
        }
      });
    }

    return {
      ok: !!prefabInfo,
      rootUuid: prefabInfo?.fileId || '',
      fileId: prefabInfo?.fileId || '',
      nodeUuid: prefabInfo?.nodeUuid || '',
      nodeName: prefabInfo?.nodeName || '',
      contentRootName: contentRoot.name || '',
      contentRootUuid: contentRoot.uuid || '',
    };
  }

  function serializeCurrentDocument(): Record<string, unknown> {
    const scene = getSceneRoot();
    const children = (scene.children || []).filter((c) => c && typeof (c as unknown as Record<string, unknown>).isValid !== 'undefined' && (c as unknown as Record<string, unknown>).isValid !== false);
    if (!children.length) throw new Error('No content node found to serialize.');

    const contentRoot = children[0];
    const Prefab = (cc as Record<string, unknown>).Prefab as { new(): { name: string; data: CcNode } };
    const prefab = new Prefab();
    prefab.name = contentRoot.name || '';
    prefab.data = contentRoot;

    const serialized = EditorExtends.serialize(prefab);
    return {
      name: contentRoot.name || '',
      nodeUuid: contentRoot.uuid || '',
      serialized,
      chars: String(serialized || '').length,
    };
  }

  function getNodePropertyValue(args: Record<string, unknown>): Record<string, unknown> {
    if (!args) return { ok: false, error: 'args required' };
    const nodeUuid = (args.nodeUuid as string) || '';
    const componentName = (args.component as string) || '';
    const propertyName = (args.property as string) || '';

    if (!nodeUuid) return { ok: false, error: 'nodeUuid required' };
    if (!componentName) return { ok: false, error: 'component required' };

    const node = findNodeByUuid(nodeUuid);
    if (!node) return { ok: false, error: 'Node not found: ' + nodeUuid };

    const components = (Array.isArray((node as unknown as Record<string, unknown>)._components)
      ? (node as unknown as Record<string, unknown>)._components
      : node.components || []) as CcComponent[];

    let targetComp: CcComponent | null = null;
    for (const comp of components) {
      if (!comp) continue;
      const cname = componentTypeName(comp);
      if (cname === componentName || cname === 'cc.' + componentName) { targetComp = comp; break; }
      if (componentName.startsWith('cc.') && cname === componentName.substring(3)) { targetComp = comp; break; }
    }

    if (!targetComp) return { ok: false, error: `Component ${componentName} not found on node` };

    if (propertyName) {
      try {
        let val = (targetComp as unknown as Record<string, unknown>)[propertyName];
        if (val === undefined) val = (targetComp as unknown as Record<string, unknown>)['_' + propertyName];

        if (typeof cc.Node === 'function' && val instanceof cc.Node) {
          const nodeVal = val as CcNode;
          return { ok: true, nodeUuid, component: componentName, property: propertyName,
            value: { _refType: 'node', _nodeUuid: nodeVal.uuid || '', _nodeName: nodeVal.name || '' } };
        }
        if (typeof cc.Component === 'function' && val instanceof cc.Component) {
          const compCn = componentTypeName(val as unknown as CcComponent);
          return { ok: true, nodeUuid, component: componentName, property: propertyName,
            value: { _refType: 'component', _compType: compCn, _compUuid: (val as unknown as CcComponent).uuid || '',
              _nodeUuid: ((val as unknown as CcComponent).node?.uuid) || '', _nodeName: ((val as unknown as CcComponent).node?.name) || '' } };
        }
        const objVal = val as Record<string, unknown> | null;
        if (objVal?._uuid) {
          return { ok: true, nodeUuid, component: componentName, property: propertyName,
            value: { _refType: 'asset', _assetUuid: objVal._uuid } };
        }
        return { ok: true, nodeUuid, component: componentName, property: propertyName, value: safeSerialize(val) };
      } catch (e) {
        return { ok: false, error: (e as Error).message, code: 'PROPERTY_READ_ERROR' };
      }
    } else {
      const allProps = describeComponentProperties(targetComp);
      return { ok: true, nodeUuid, component: componentName, properties: allProps };
    }
  }

  function getConsoleLog(args?: { level?: string; limit?: number; since?: number }): Record<string, unknown> {
    if (!args) args = {};
    const level = args.level || '';
    const limit = Math.min(args.limit || 20, 100);
    const since = args.since || 0;
    const logs = globalThis.__comdr_console_logs || [];
    let result = [...logs];
    if (since > 0) result = result.filter((l) => l.timestamp >= since);
    if (level) result = result.filter((l) => l.level === level);
    result = result.slice(-limit);

    return {
      ok: true,
      schema: 'Comdr.console-log.v1',
      entries: result,
      count: result.length,
      totalBuffered: logs.length,
      levels: level || 'all',
      since: since > 0 ? since : undefined,
    };
  }

  // ====== Engine Schema Dump ======

  function dumpEngineSchema(): Record<string, unknown> {
    try {
      const components: Record<string, { properties: Record<string, { type: string; default?: unknown }> }> = {};
      // cc.js._registeredClasses 包含所有已注册的引擎类
      const registered = (cc as Record<string, unknown>).js as Record<string, unknown> | undefined;
      const classes = registered?._registeredClasses as Map<string, unknown> | Record<string, unknown> | undefined;
      if (!classes) return { ok: false, error: 'Cannot access engine class registry' };

      const entries = classes instanceof Map ? [...classes.entries()] : Object.entries(classes);
      for (const [name, cls] of entries) {
        if (!name || typeof name !== 'string') continue;
        // 只处理 cc. 前缀的组件类
        if (!name.startsWith('cc.')) continue;
        const clsObj = cls as Record<string, unknown>;
        if (!clsObj || typeof clsObj !== 'object') continue;
        // 跳过非组件类型
        if (name === 'cc.Node' || name === 'cc.Prefab' || name === 'cc.Component') continue;

        const props = extractClassProperties(clsObj);
        if (Object.keys(props).length > 0) {
          components[name] = { properties: props };
        }
      }
      return { ok: true, schema: 'Comdr.engine-schema.v1', components, totalComponents: Object.keys(components).length };
    } catch (e) {
      return { ok: false, error: `Schema dump failed: ${(e as Error).message}` };
    }
  }

  function getComponentSchema(typeName: string): Record<string, unknown> {
    try {
      const registered = (cc as Record<string, unknown>).js as Record<string, unknown> | undefined;
      const classes = registered?._registeredClasses as Map<string, unknown> | Record<string, unknown> | undefined;
      if (!classes) return { ok: false, error: 'Cannot access engine class registry' };

      const entries = classes instanceof Map ? [...classes.entries()] : Object.entries(classes);
      for (const [name, cls] of entries) {
        if (name === typeName || name === `cc.${typeName}`) {
          const clsObj = cls as Record<string, unknown>;
          if (!clsObj || typeof clsObj !== 'object') continue;
          const props = extractClassProperties(clsObj);
          return { ok: true, componentType: name as string, isScript: false, properties: Object.entries(props).map(([k, v]) => ({ name: k, type: v.type, default: v.default })) };
        }
      }
      return { ok: false, error: `Component "${typeName}" not found in engine registry`, isScript: true, properties: [] };
    } catch (e) {
      return { ok: false, error: `Schema probe failed: ${(e as Error).message}` };
    }
  }

  function extractClassProperties(clsObj: Record<string, unknown>): Record<string, { type: string; default?: unknown }> {
    const result: Record<string, { type: string; default?: unknown }> = {};
    const proto = (clsObj.prototype || clsObj) as Record<string, unknown>;
    // 遍历原型链上的属性描述符
    for (const key of Object.getOwnPropertyNames(proto)) {
      if (key.startsWith('_') || key === 'constructor' || key === 'name') continue;
      try {
        const desc = Object.getOwnPropertyDescriptor(proto, key);
        if (!desc) continue;
        const val = desc.value !== undefined ? desc.value : undefined;
        result[key] = { type: classifyValue(val), default: val };
      } catch { /* skip */ }
    }
    return result;
  }

  function classifyValue(val: unknown): string {
    if (val === null || val === undefined) return 'asset';
    switch (typeof val) {
      case 'string': return 'string';
      case 'number': return Number.isInteger(val) ? 'int' : 'float';
      case 'boolean': return 'bool';
      case 'object':
        if (val instanceof Array) return 'array';
        if ((val as Record<string, unknown>).x !== undefined && (val as Record<string, unknown>).y !== undefined) {
          if ((val as Record<string, unknown>).z !== undefined) {
            if ((val as Record<string, unknown>).w !== undefined) return 'vec4';
            return 'vec3';
          }
          return 'vec2';
        }
        if ((val as Record<string, unknown>).r !== undefined) return 'color';
        if ((val as Record<string, unknown>).width !== undefined) return 'size';
        return 'asset';
      default: return 'any';
    }
  }

  // ====== Public API ======

  return {
    probeCurrentStage,
    getNodeDetail,
    probePrefabRootInfo,
    serializeCurrentDocument,
    getNodePropertyValue,
    getConsoleLog,
    dumpEngineSchema,
    getComponentSchema,
  };
};

// ====== Type Declarations (compile-time only, stripped in JS output) ======

interface CcNode {
  uuid: string;
  name: string;
  children: CcNode[];
  parent: CcNode | null;
  active: boolean;
  isValid?: boolean;
  components?: CcComponent[];
  walk(fn: (node: CcNode) => void): void;
  destroy(): void;
  addComponent(ctor: { new(): unknown }): unknown;
}

interface CcComponent {
  uuid: string;
  enabled: boolean;
  node: CcNode;
  constructor: { name?: string };
}

interface CcModule {
  Node: { new(): CcNode };
  Component: { new(): CcComponent };
  Prefab: { new(): { name: string; data: CcNode } };
  director: { getScene(): unknown };
  js?: { getClassName(ctor: unknown): string };
  VERSION?: string;
  [key: string]: unknown;
}

interface ProbeLibApi {
  probeCurrentStage(): Record<string, unknown>;
  getNodeDetail(args: { nodeUuid?: string }): Record<string, unknown>;
  probePrefabRootInfo(): Record<string, unknown>;
  serializeCurrentDocument(): Record<string, unknown>;
  getNodePropertyValue(args: Record<string, unknown>): Record<string, unknown>;
  getConsoleLog(args?: { level?: string; limit?: number; since?: number }): Record<string, unknown>;
  dumpEngineSchema(): Record<string, unknown>;
  getComponentSchema(typeName: string): Record<string, unknown>;
}
