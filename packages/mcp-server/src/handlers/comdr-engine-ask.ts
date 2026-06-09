// ============================================================
// comdr-engine-ask 工具处理程序
// 使用动态 require 加载 @comdr/core，每次调用自动重载最新编译产物
// ============================================================

function buildServerInfo(): Record<string, unknown> {
  let build = 'unknown';
  try { build = require('@comdr/core').VERSION as string; } catch { /* core not loaded yet */ }
  return {
    protocolVersion: '2025-03-26',
    serverInfo: { name: 'comdr-engine-mcp', version: '1.0.0', build },
    capabilities: { tools: {} },
  };
}

export const TOOL_DEFINITION = {
  name: 'comdr-engine-ask',
  description: 'Comdr — Cocos Creator editor. Send natural language instructions, Comdr handles everything else internally.',
  inputSchema: {
    type: 'object',
    properties: {
      request: { type: 'string', description: 'Describe WHAT you want in natural language. Do NOT guess property names, field keys, or component internals — Comdr resolves those via schema probing.' },
      projectPath: { type: 'string', description: 'Cocos project root path.' },
      model: { type: 'string', description: 'Optional model override.' },
      sessionId: { type: 'string', description: 'Optional session ID.' },
    },
    required: ['request'],
  },
};

export function handleInitialize(_id: string | number | undefined, _params: Record<string, unknown>): Record<string, unknown> {
  return buildServerInfo();
}

export function handleToolsList(_id: string | number | undefined): Record<string, unknown> {
  return { tools: [TOOL_DEFINITION] };
}

export function handleCancel(params: Record<string, unknown>, pendingAborts: Map<string, AbortController>): void {
  const requestId = params.requestId as string | undefined;
  if (requestId && pendingAborts.has(requestId)) {
    pendingAborts.get(requestId)!.abort();
    pendingAborts.delete(requestId);
  }
}

export interface ToolCallResult {
  text: string;
  isError: boolean;
  rollbacks?: unknown[];
  diffs?: unknown[];
}

/**
 * 清除 @comdr/core 的 require 缓存，确保下次 require 加载最新编译产物。
 * 同时处理 symlink 场景：Node.js resolve symlink 后 cache key 是真实路径。
 *
 * 安全性：@comdr/core 模块是纯函数/类定义，无模块级可变状态（单例、全局计数器等）。
 * require.cache 清除后重新 require 会得到全新的类定义引用，但实例状态由 Gateway
 * 在堆上持有（AssemblyGateway、ComponentCatalog 等），不受缓存清除影响。
 * 其他模块缓存的 core 引用仍指向旧类定义，但 MCP 只用 core 的静态工厂/纯函数，
 * 旧引用与新引用行为一致（函数闭包不依赖模块级状态）。
 */
function reloadCoreModules(): void {
  const resolved = (() => {
    try { return require.resolve('@comdr/core'); } catch { return ''; }
  })();
  const realDir = resolved ? resolved.replace(/\\/g, '/').replace(/\/dist\/.*$/, '') : '';
  for (const key of Object.keys(require.cache)) {
    const normalized = key.replace(/\\/g, '/');
    if (normalized.includes('node_modules/@comdr/core') || (realDir && normalized.startsWith(realDir))) {
      delete require.cache[key];
    }
  }
}

let _bridgeVersionCache: { version: string; path: string; time: number } | null = null;

function bridgeVersion(projectPath: string): string {
  const now = Date.now();
  if (_bridgeVersionCache && _bridgeVersionCache.path === projectPath && (now - _bridgeVersionCache.time) < 5000) {
    return _bridgeVersionCache.version;
  }
  try {
    const fs = require('fs') as typeof import('fs');
    const bp = `${projectPath}/temp/comdr/bridge.json`;
    if (fs.existsSync(bp)) {
      const raw = JSON.parse(fs.readFileSync(bp, 'utf8'));
      const v = raw?.editorCapabilities?.bridgeVersion ?? 'no heartbeat';
      _bridgeVersionCache = { version: v as string, path: projectPath, time: now };
      return v as string;
    }
  } catch { /* */ }
  _bridgeVersionCache = { version: 'offline', path: projectPath, time: now };
  return 'offline';
}

// ===== Overlay 自动拉起 =====

function ensureOverlayRunning(projectPath: string): void {
  const { HOME, USERPROFILE } = process.env;
  const home = HOME || USERPROFILE || '.';
  const alivePath = `${home}/.comdr/overlay-alive`;
  const configPath = `${home}/.comdr/overlay-config.json`;

  try {
    const fs = require('fs') as typeof import('fs');

    // 始终同步 project_path 到 overlay 配置
    try {
      let cfg: Record<string, unknown> = {};
      if (fs.existsSync(configPath)) {
        cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
      if (cfg.project_path !== projectPath) {
        cfg.project_path = projectPath;
        const dir = `${home}/.comdr`;
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf8');
      }
    } catch (e) {
      // 非致命：配置写入失败不阻塞主流程
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
        process.stderr.write(`[comdr] overlay config write failed: ${(e as Error).message}\n`);
      }
    }

    // 心跳文件 10s 内有效 → overlay 还活着，不重复拉起
    if (fs.existsSync(alivePath)) {
      const age = Date.now() - Number(fs.readFileSync(alivePath, 'utf8'));
      if (age < 10000) return;
    }

    // 找到 overlay 二进制
    const bin = findOverlayBinary();
    if (!bin) return;

    const { spawn } = require('child_process') as typeof import('child_process');
    const proc = spawn(bin, [], { detached: true, stdio: 'ignore', shell: true });
    proc.unref();
    process.stderr.write(`[comdr] Overlay launched: ${bin}\n`);
  } catch (e) {
    process.stderr.write(`[comdr] overlay launch failed: ${(e as Error).message}\n`);
  }
}

function findOverlayBinary(): string | null {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const exeName = process.platform === 'win32' ? 'comdr-overlay.exe' : 'comdr-overlay';

  // 1. 环境变量显式指定（最高优先级）
  const envPath = process.env.COMDR_OVERLAY_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;

  // 2. 标准安装路径 ~/.comdr/overlay/（生产环境）
  const { HOME, USERPROFILE } = process.env;
  const home = HOME || USERPROFILE || '.';
  const stdPath = path.join(home, '.comdr', 'overlay', exeName);
  if (fs.existsSync(stdPath)) return stdPath;

  // 3. 向上爬 __dirname 兜底（开发 monorepo 环境）
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    const distBin = path.join(dir, 'packages', 'overlay', 'dist-bin', exeName);
    if (fs.existsSync(distBin)) return distBin;
    const base = path.join(dir, 'packages', 'overlay', 'src-tauri', 'target');
    for (const profile of ['release', 'debug']) {
      const exe = path.join(base, profile, exeName);
      if (fs.existsSync(exe)) return exe;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // 4. 从 cwd 查找（兼容直接从 monorepo 根目录启动）
  const cwd = process.cwd();
  const cwdDistBin = path.join(cwd, 'packages', 'overlay', 'dist-bin', exeName);
  if (fs.existsSync(cwdDistBin)) return cwdDistBin;
  const fromCwd = path.join(cwd, 'packages', 'overlay', 'src-tauri', 'target');
  for (const profile of ['release', 'debug']) {
    const exe = path.join(fromCwd, profile, exeName);
    if (fs.existsSync(exe)) return exe;
  }

  return null;
}

export async function handleToolsCall(args: Record<string, unknown>, signal: AbortSignal): Promise<ToolCallResult> {
  // 每次调用前清除缓存 + 动态加载 core，确保使用最新编译产物
  reloadCoreModules();
  const core = require('@comdr/core') as typeof import('@comdr/core');

  const request = args.request as string;
  if (!request || !request.trim()) {
    return { text: '[err] Missing required parameter: request', isError: true };
  }

  const ctx = core.resolveProjectContext({
    mode: args.projectPath ? 'validate' : 'discover',
    projectPath: args.projectPath as string | undefined,
  });

  if (!core.isSpecializedProjectContext(ctx)) {
    return {
      text: `[err] E_NO_COCOS_PROJECT: ${ctx.reason}\n\nProvide a Cocos project path or open a Cocos project folder.`,
      isError: true,
    };
  }

  // 自动拉起 Overlay（如果还没跑），自动写入 projectPath 到配置
  ensureOverlayRunning(ctx.projectPath);

  const config = core.loadGatewayConfig();
  const provider = core.getActiveProvider(config);
  if (!provider.hasApiKey) {
    return {
      text: `[err] E_NO_API_KEY: No API key for provider '${provider.provider}'. Set ${provider.apiKeyEnv}.`,
      isError: true,
    };
  }

  interface SessionHandle {
    sessionId: string;
    projectPath: string;
    createdAt: string;
    modifiedAt: string;
    createdAssets: Array<{ path: string; uuid: string; purpose: string; at: string }>;
    modifiedAssets: string[];
    openDocument: { kind: string; path: string } | null;
  }
  let session: SessionHandle | null = null;
  let commanderSnapshot: Record<string, unknown> | undefined;
  const sessionId = (args.sessionId as string) || `cmdr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  if (sessionId) {
    session = core.loadSession(sessionId) as SessionHandle;
    if (session) {
      // clone 避免跨项目 session 污染：loadSession 返回同一个内存对象
      session = { ...session, projectPath: ctx.projectPath };
      // 提取上一轮保存的 Commander 对话快照
      commanderSnapshot = (session as unknown as Record<string, unknown>).commanderSnapshot as Record<string, unknown> | undefined;
    }
  }

  const sessionMemory = core.SessionMemory.create();
  const assetCache = new core.AssetCache(ctx.projectPath);
  assetCache.load();
  assetCache.enableAutoFlush();
  const documentState = new core.DocumentState();

  // 执行事件日志 → Overlay 实时观察
  const executionLogger = new core.ExecutionLogger(ctx.projectPath);

  // Commander 默认用 fast 模型（轻量 DSL 翻译），Claude 可传 model 参数临时覆盖
  const model = (args.model as string) || core.resolveCommanderModel(provider, core.MODEL_TIERS.fast);

  const result = await core.runAssemblyProcess({
    request: request.trim(),
    projectPath: ctx.projectPath,
    sessionMemory,
    assetCache,
    documentState,
    provider: provider.provider,
    model,
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    signal,
    onExecutionEvent: (event) => executionLogger.write(event),
    onFeedback: (text) => process.stderr.write(`[comdr] ${text}\n`),
    commanderSnapshot: commanderSnapshot as import('@comdr/core').CommanderSnapshot | undefined,
  });

  // 清理 assetCache 自动刷新定时器（避免 MCP 进程持有未解除的定时器）
  try { assetCache.disableAutoFlush?.(); } catch { /* best-effort */ }

  if (result.ok) {
    const lines: string[] = [];
    // Commander 发出 ask → 保存对话快照到 session，输出 sessionId 供下次恢复
    if (result.ask?.question) {
      // 确保有 session 对象（首次 ask 也可能没有显式 sessionId）
      if (!session) {
        session = core.loadSession(sessionId) as SessionHandle;
        session.projectPath = ctx.projectPath;
      }
      // 保存 Commander 对话快照
      (session as unknown as Record<string, unknown>).commanderSnapshot = result.commanderSnapshot;
      core.saveSession(session);
      lines.push(`[ask] ${result.ask.question}`);
      lines.push(`[session] ${sessionId}`);
      return { text: lines.join('\n'), isError: false };
    }
    if (result.doneReport && Object.keys(result.doneReport).length > 0) {
      const reportEntries = Object.entries(result.doneReport)
        .map(([k, v]) => `${k}=${typeof v === 'string' && /[\s,]/.test(v) ? `"${v}"` : v}`);
      lines.push(`[report] ${reportEntries.join(', ')}`);
    }
    lines.push(`[ok] Completed in ${result.round} rounds`);
      lines.push(`[ver] gateway=${core.VERSION} bridge=${bridgeVersion(ctx.projectPath)}`);
    if (result.results) {
      for (const { command, result: cmdResult } of result.results) {
        lines.push(`${cmdResult.ok ? '[ok]' : '[err]'} >${command.type}: ${cmdResult.ok ? 'ok' : cmdResult.error}`);
      }
    }
    if (result.notes && result.notes.length > 0) {
      for (const note of result.notes) {
        lines.push(`[note] ${note.kind}: ${note.text}`);
      }
    }
    if (session) {
      for (const r of result.results || []) {
        if (r.result.ok && r.command.type === 'write' && r.command.path) {
          core.recordCreated(session, r.command.path, '', 'Created asset');
        }
      }
      // 对话完成 → 清除对话快照（下次用同 sessionId 不会恢复旧对话）
      delete (session as unknown as Record<string, unknown>).commanderSnapshot;
      core.saveSession(session);
    }
    return {
      text: lines.join('\n'),
      isError: false,
      rollbacks: result.rollbacks as unknown[] | undefined,
      diffs: result.diffs as unknown[] | undefined,
    };
  }

  const errLines = [`[err] ${result.error || 'Assembly failed'} (round ${result.round})`];
  if (result.results) {
    for (const { command, result: cmdResult } of result.results) {
      errLines.push(`${cmdResult.ok ? '[ok]' : '[err]'} >${command.type}: ${cmdResult.ok ? 'ok' : cmdResult.error}`);
    }
  }
  if (result.notes && result.notes.length > 0) {
    for (const note of result.notes) {
      errLines.push(`[note] ${note.kind}: ${note.text}`);
    }
  }
  return {
    text: errLines.join('\n'),
    isError: true,
    rollbacks: result.rollbacks as unknown[] | undefined,
    diffs: result.diffs as unknown[] | undefined,
  };
}
