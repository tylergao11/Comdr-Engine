// ============================================================
// MCP Server — JSON-RPC 2.0 over stdio
// ============================================================

import * as readline from 'readline';
import { handleInitialize, handleCancel, TOOL_DEFINITION } from './handlers/comdr-engine-ask';

/** 动态加载 handler，每次调用前清除缓存确保热重载生效 */
function reloadHandlerModule(): typeof import('./handlers/comdr-engine-ask') {
  // 精确清除 handler 模块缓存（require.resolve 拿到绝对路径）
  try { delete require.cache[require.resolve('./handlers/comdr-engine-ask')]; } catch { /* 首次加载 */ }
  // 清除所有 @comdr/mcp-server 相关模块（monorepo 和 npm 两种路径）
  for (const key of Object.keys(require.cache)) {
    const normalized = key.replace(/\\/g, '/');
    if (normalized.includes('/comdr/mcp-server/')) {
      delete require.cache[key];
    }
  }
  return require('./handlers/comdr-engine-ask');
}

// ===== 类型 =====

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// ===== 服务器 =====

class McpServer {
  private _rl: readline.Interface | null = null;
  private _pendingAborts: Map<string, AbortController> = new Map();

  async start(): Promise<void> {
    this._rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    this._rl.on('line', (line: string) => {
      this._processLine(line).catch((err) => {
        process.stderr.write(`[comdr] Unhandled error: ${(err as Error).message}\n`);
      });
    });

    // 通知就绪
    process.stderr.write('[comdr] Ready — listening on stdin\n');
  }

  stop(): void {
    if (this._rl) {
      this._rl.close();
      this._rl = null;
    }
    // 取消所有正在进行的任务
    for (const [id, ctrl] of this._pendingAborts) {
      ctrl.abort();
      this._pendingAborts.delete(id);
    }
  }

  private async _processLine(line: string): Promise<void> {
    if (!line.trim()) return;

    let request: JsonRpcRequest;
    try {
      request = JSON.parse(line);
    } catch {
      this._write({
        jsonrpc: '2.0',
        id: undefined as unknown as string | number,
        error: { code: -32700, message: 'Parse error' },
      });
      return;
    }

    if (!request.method) return;

    // 验证 JSON-RPC 2.0 规范
    if (request.jsonrpc !== '2.0') {
      this._write({
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32600, message: 'Invalid Request: jsonrpc must be "2.0"' },
      });
      return;
    }

    const reqId = request.id;
    if (reqId == null) return; // 通知无需响应

    try {
      switch (request.method) {
        case 'initialize':
          await this._respond(request, handleInitialize(reqId, request.params || {}));
          break;
        case 'notifications/initialized':
          // 无需响应
          break;
        case 'tools/list':
          await this._respond(request, {
            tools: [TOOL_DEFINITION],
          });
          break;
        case 'tools/call':
          await this._handleToolsCall(request);
          break;
        case 'notifications/cancelled':
          handleCancel(request.params || {}, this._pendingAborts);
          break;
        default:
          this._write({
            jsonrpc: '2.0',
            id: request.id,
            error: { code: -32601, message: `Method not found: ${request.method}` },
          });
      }
    } catch (err) {
      this._write({
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32603, message: (err as Error).message },
      });
    }
  }

  private async _handleToolsCall(request: JsonRpcRequest): Promise<void> {
    const params = request.params as { name?: string; arguments?: Record<string, unknown> } | undefined;
    const toolName = params?.name;

    // ---- comdr-engine-ask（唯一 MCP 工具）----
    if (toolName !== 'comdr-engine-ask') {
      this._write({
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32601, message: `Tool not found: ${params?.name}` },
      });
      return;
    }

    const abortController = new AbortController();
    const taskId = String(request.id || Date.now());
    this._pendingAborts.set(taskId, abortController);

    try {
      const { handleToolsCall } = reloadHandlerModule();
      const result = await handleToolsCall(params?.arguments || {}, abortController.signal);
      this._write({
        jsonrpc: '2.0',
        id: request.id,
        result: {
          content: [{ type: 'text', text: result.text }],
          isError: result.isError,
          rollbacks: result.rollbacks || null,
          diffs: result.diffs || null,
        },
      });
    } catch (err) {
      this._write({
        jsonrpc: '2.0',
        id: request.id,
        result: {
          content: [{ type: 'text', text: `Tool error: ${(err as Error).message}` }],
          isError: true,
        },
      });
    } finally {
      this._pendingAborts.delete(taskId);
    }
  }

  private async _respond(request: JsonRpcRequest, result: unknown): Promise<void> {
    this._write({ jsonrpc: '2.0', id: request.id, result });
  }

  private _write(response: JsonRpcResponse): void {
    process.stdout.write(JSON.stringify(response) + '\n');
  }
}

export const MCP_SERVER = new McpServer();
