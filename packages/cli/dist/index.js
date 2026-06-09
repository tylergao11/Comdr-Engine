"use strict";
// ============================================================
// @comdr/cli — 独立测试入口
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@comdr/core");
const core_2 = require("@comdr/core");
const core_3 = require("@comdr/core");
const core_4 = require("@comdr/core");
async function main() {
    const args = process.argv.slice(2);
    const request = args[0];
    const projectPath = args[1];
    if (!request) {
        console.log('Usage: npx tsx packages/cli/src/index.ts "<request>" [projectPath]');
        process.exit(1);
    }
    // 解析项目
    const ctx = (0, core_1.resolveProjectContext)({
        mode: projectPath ? 'validate' : 'discover',
        projectPath,
    });
    if (!(0, core_1.isSpecializedProjectContext)(ctx)) {
        console.error(`Not a Cocos project: ${ctx.reason}`);
        process.exit(1);
    }
    console.log(`Project: ${ctx.projectName} (${ctx.projectPath})`);
    // 加载配置
    const config = (0, core_3.loadGatewayConfig)();
    const provider = (0, core_3.getActiveProvider)(config);
    if (!provider.hasApiKey) {
        console.error(`No API key configured. Set ${provider.apiKeyEnv}.`);
        process.exit(1);
    }
    console.log(`Provider: ${provider.provider}, Model: ${provider.model}`);
    // 实例化
    const sessionMemory = core_2.SessionMemory.create();
    const assetCache = new core_2.AssetCache(ctx.projectPath);
    assetCache.load();
    const documentState = new core_2.DocumentState();
    console.log(`Request: ${request}`);
    console.log('---');
    // 执行
    const result = await (0, core_4.runAssemblyProcess)({
        request,
        projectPath: ctx.projectPath,
        sessionMemory,
        assetCache,
        documentState,
        provider: provider.provider,
        model: provider.model,
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
    });
    console.log('---');
    console.log(`Status: ${result.status}, Round: ${result.round}`);
    if (result.error) {
        console.error(`Error: ${result.error}`);
    }
    if (result.results) {
        for (const { command, result: cmdResult } of result.results) {
            const icon = cmdResult.ok ? '✓' : '✗';
            console.log(`  ${icon} >${command.type}`);
        }
    }
}
main().catch((err) => {
    console.error('CLI Fatal:', err.message);
    process.exit(1);
});
//# sourceMappingURL=index.js.map