// diag: directly test Commander call
const { callCommander } = require('./packages/core/dist/gateway/commander');
const { buildCommanderSystemPrompt } = require('./packages/core/dist/gateway/compact-codec');
const { buildCommanderContext } = require('./packages/core/dist/dsl/formatter');
const { loadGatewayConfig, getActiveProvider } = require('./packages/core/dist/config/config-store');

async function main() {
  const config = loadGatewayConfig();
  const provider = getActiveProvider(config);

  const context = buildCommanderContext(null, null, 'D:\\Mahjong');
  const systemPrompt = buildCommanderSystemPrompt();
  const request = '创建一个 prefab 文件 assets/llll.prefab：根节点名为 "llll"，挂载 cc.UITransform 组件，width=100, height=100';

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: context + '\n\n' + request },
  ];

  console.log('=== Model:', provider.model);
  console.log('=== Base URL:', provider.baseUrl);
  console.log('=== User message ===');
  console.log(messages[1].content);
  console.log('=== Calling Commander... ===');

  try {
    const resp = await callCommander({
      messages,
      provider: provider.provider,
      model: provider.model,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
    });
    console.log('=== RAW OUTPUT ===');
    console.log(resp.text);
    console.log('=== Finish:', resp.finishReason);
    console.log('=== Tokens:', resp.usage);
  } catch (err) {
    console.error('ERROR:', err.message);
  }
}

main();
