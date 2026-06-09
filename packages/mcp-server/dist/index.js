"use strict";
// ============================================================
// @comdr/mcp-server — MCP stdio JSON-RPC 入口
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = require("./server");
// 启动服务器
process.stderr.write('[comdr] MCP Server starting...\n');
server_1.MCP_SERVER.start().catch((err) => {
    process.stderr.write(`[comdr] Fatal: ${err.message}\n`);
    process.exit(1);
});
//# sourceMappingURL=index.js.map