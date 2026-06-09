// ============================================================
// @comdr/cli — 独立测试入口
// ============================================================

import { resolveProjectContext, isSpecializedProjectContext } from '@comdr/core';
import { SessionMemory, AssetCache, DocumentState } from '@comdr/core';
import { loadGatewayConfig, getActiveProvider } from '@comdr/core';
import { runAssemblyProcess } from '@comdr/core';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const request = args[0];
  const projectPath = args[1];

  if (!request) {
    console.log('Usage: npx tsx packages/cli/src/index.ts "<request>" [projectPath]');
    process.exit(1);
  }

  // 解析项目
  const ctx = resolveProjectContext({
    mode: projectPath ? 'validate' : 'discover',
    projectPath,
  });

  if (!isSpecializedProjectContext(ctx)) {
    console.error(`Not a Cocos project: ${ctx.reason}`);
    process.exit(1);
  }

  console.log(`Project: ${ctx.projectName} (${ctx.projectPath})`);

  // 加载配置
  const config = loadGatewayConfig();
  const provider = getActiveProvider(config);

  if (!provider.hasApiKey) {
    console.error(`No API key configured. Set ${provider.apiKeyEnv}.`);
    process.exit(1);
  }

  console.log(`Provider: ${provider.provider}, Model: ${provider.model}`);

  // 实例化
  const sessionMemory = SessionMemory.create();
  const assetCache = new AssetCache(ctx.projectPath);
  assetCache.load();
  const documentState = new DocumentState();

  console.log(`Request: ${request}`);
  console.log('---');

  // 执行
  const result = await runAssemblyProcess({
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
  console.error('CLI Fatal:', (err as Error).message);
  process.exit(1);
});
