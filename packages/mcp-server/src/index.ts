// ============================================================
// @comdr/mcp-server — MCP stdio JSON-RPC 入口
// ============================================================

import { MCP_SERVER } from './server';

// 启动服务器
process.stderr.write('[comdr] MCP Server starting...\n');
MCP_SERVER.start().catch((err) => {
  process.stderr.write(`[comdr] Fatal: ${(err as Error).message}\n`);
  process.exit(1);
});
