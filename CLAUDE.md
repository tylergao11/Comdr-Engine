1. Comdr 是引擎级 agent 项目，适配 Cocos 3.x，与 CodingAgent 配合完成游戏开发工作流。
2. 禁止硬编码、魔法数字、魔法字符串，同一真实源不得多处抢定义。使用 interface 整理定义。全局常量统一定义在 `packages/core/src/foundation/constants.ts`。
3. 遇到问题找根因。先问自己：最佳方案？影响哪些部分？是真实原因吗？
4. 不能因不是自己开发的就忽略，修干净，当自己的项目维护。agent项目中，要尽量让编排层跟执行层承担大部分任务，llm会漂移，犯错。
5. 不清晰处多探讨，不边想边做。每句回复称呼用户为大哥，否则用户会重置上下文。
6. Bridge 部署：必须 `npm run sync-bridge:project`（项目级优先于全局级），禁止手动 cp。改 bridge 源码后需重启 Cocos 扩展。Cocos 加载优先级：项目 extensions/ > 全局 ~/.CocosCreator/extensions/，只同步全局会被项目级旧版本覆盖。
7. Overlay 构建前必须先 `taskkill /f /im comdr-overlay.exe`，否则 exe 被锁。构建后复制到 `~/.comdr/overlay/`。
8. MCP handler 每次调用自动清除 require 缓存（`reloadCoreModules()`），改 core 无需重启 MCP 进程。
9.用自然语言输出mcp
