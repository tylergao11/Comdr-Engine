# Comdr-Engine

> Cocos Creator 3.x 引擎级 AI 操作层。编排层 + 执行层承担大部分任务，LLM 只负责高层决策——对抗 LLM 漂移和犯错。

## 架构全景

```
┌──────────────────────────────────────────────────┐
│                  Gateway 编排层                    │
│  AssemblyGateway: 主循环 + 命令分发 + 错误修正     │
│  Commander: LLM API 抽象 (DeepSeek/Anthropic)     │
│  Prompt: 动态系统提示词生成                        │
│  ExecutionLogger: NDJSON 执行事件流               │
└────────────┬─────────────────────────────────────┘
             │
┌────────────▼─────────────────────────────────────┐
│                  DSL 层                            │
│  Parser:  ">cmd(k=v);" → DslCommand[]             │
│  Formatter: 执行结果 → Commander 反馈文本          │
└────────────┬─────────────────────────────────────┘
             │
┌────────────▼─────────────────────────────────────┐
│              5 阶段组装管线 (纯函数)               │
│  validate → enrich → build → serialize → clean   │
└────────────┬─────────────────────────────────────┘
             │
┌────────────▼─────────────────────────────────────┐
│              领域模型层 (Cocos World)              │
│  Asset / Node / Component / Value / Reference     │
│  ComponentCatalog: 统一组件目录                   │
│  InternalAssetCatalog: Cocos 内置资源              │
│  ProbeProtocol: Bridge 查询协议定义               │
└────────────┬─────────────────────────────────────┘
             │
┌────────────▼─────────────────────────────────────┐
│              基础支撑层                            │
│  constants.ts (全局常量) / value-kit (纯工具函数)  │
│  memory/ (会话存储/快照/撤销)                      │
│  perception/ (资源解析/名称解析/Prefab 差异)       │
│  config/ (多供应商配置)                            │
└──────────────────────────────────────────────────┘
```

## Cocos 世界模型

Cocos Creator 的世界由五个基础元素构成，全系统以此模型为唯一真相源：

| 元素 | 说明 | 关键特征 |
|------|------|---------|
| **Asset** | 文件资源 | UUID + path + importer type + subAssets |
| **Node** | 场景图节点 | fileId + parent/children + component 列表 |
| **Component** | 组件 | 用 `__type__` 格式区分引擎组件(`cc.Sprite`)/用户脚本(压缩UUID) |
| **Value** | 属性值 | 原始值 / Cocos 数学类型(Vec2/3/Color等) / 引用 / 数组 |
| **Reference** | 关系线 | `{__id__: N}` 数组内引用，`{__uuid__: "..."}` 资源引用 |

**核心洞察：`__type__` 格式即身份。** `"cc.Sprite"` = 引擎组件，`"a1b2c3..."`（23位压缩UUID）= 自定义脚本。不需要外部查表。

## Monorepo 包结构

```
comdr-engine/
├── packages/
│   ├── core/          ← 引擎核心：编排、DSL、组装管线、领域模型
│   ├── bridge/        ← Cocos Creator 编辑器扩展（运行在编辑器进程内）
│   ├── mcp-server/    ← MCP stdio JSON-RPC 服务器（暴露给外部 LLM）
│   ├── cli/           ← 命令行测试入口（最小封装）
│   └── overlay/       ← Tauri v2 桌面悬浮窗（执行状态实时监控）
├── scripts/           ← 构建/部署脚本（sync-bridge, extract-schema 等）
├── docs/              ← 设计文档
└── .claude/           ← Claude Code 项目配置
```

包间依赖：

```
@comdr/mcp-server ──→ @comdr/core
@comdr/cli        ──→ @comdr/core + @comdr/mcp-server
@comdr/bridge       (独立，不依赖 core — 运行在 Cocos 编辑器进程内)
@comdr/overlay       (独立，Rust + 原生 JS，被动观察者)
```

## Agent 主循环

[AssemblyGateway](packages/core/src/gateway/assembly-gateway.ts)（~1830 行）是整个系统的总指挥：

```
1. 初始化 ToolCenter (确认 Bridge 在线)
2. 读取 Bridge 心跳 (引擎源码路径、内置资源、当前文档)
3. 加载 ComponentCatalog + InternalAssetCatalog
4. 构建消息 [system | state-anchor | user-request]
5. LOOP (最多 20 轮):
   a. 调用 Commander (LLM) → 获取 DSL 输出
   b. 解析 DSL → DslCommand[]
   c. 逐条执行命令 (破坏性操作前自动抓快照)
   d. ask()? → 快照状态，返回问询给调用方
   e. 命令失败? → 回滚 + 错误反馈
   f. 熔断检查 (连续相同错误 >=2 或累计编辑错误 >=4)
   g. 自动补 write (compile 成功但忘了 write → 网关补上)
   h. 自动补 save  (编辑了但忘了 save → 网关补上)
   i. done()? → 终态快照 → diff → 返回结果
   j. 构建反馈 (State Window) → 继续循环
```

### 核心反漂移机制

| 机制 | 说明 |
|------|------|
| **State Window** | 差异化上下文窗口（最多 5 条），不累积历史，只传"变化了什么" |
| **本地纠错** | 组件名模糊匹配 (Levenshtein ≤ 2)、路径自动解析在 Gateway 层完成，不走 LLM |
| **快照/回滚** | 破坏性操作前自动抓取 `before` 快照，失败自动 `rollback` |
| **熔断器** | 连续相同错误 ≥2 次或累计编辑错误 ≥4 次即终止 |
| **自动补全** | compile 后忘 write、编辑后忘 save → Gateway 自动补上 |

### 纠错三级

| 级别 | 场景 | 行为 |
|------|------|------|
| 静默修正 | 组件名缺 `cc.` 前缀、拼写错误 | `catalog.resolve()` + `fuzzyFind()` 自动修正 |
| 修正告知 | 修正成功 | 结果带 `[fix] Sprite → cc.Sprite`，不浪费轮次 |
| 无法修正 | 完全未知的类型 | 返回结构化 `errorCode`，Gateway 不替 LLM 做决策 |

## DSL 命令体系

共 20 种命令，LLM 通过 DSL 与引擎交互：

```
>probe(assets)             查询项目资源
>probe(scripts)            查询项目脚本
>probe(ctx, nodeUuid)      查询场景节点树
>detail(nodeUuid, prop)    查询节点/组件详情
>schema(component)         查询组件 schema
>open(path)                打开文档
>compile(...)              组装 Prefab
  >node(...)               定义节点
    >comp(...)             挂载组件
    >child()               子节点
>write(path)               写入文件
>set-prop(id, prop, val)   设置单个属性
>set-props(id, {...})      批量设置属性
>add-node(...)             增量添加节点
>add-comp(...)             增量添加组件
>delete-node(id)           删除节点
>reparent(id, parent)      移动节点到新父节点
>duplicate(id)             复制节点
>set-active(id, bool)      设置节点激活状态
>save()                    保存文档
>undo()                    撤销上一步操作
>ask(question)             暂停并向调用者提问
>done()                    标记完成
>note(message)             备注（不影响执行）
>help                      显示可用命令
```

DSL 解析器具备容错能力——自动恢复缺失的分号，类型强制转换。

## 5 阶段组装管线

[translation/assembler/](packages/core/src/translation/assembler/) — 将 LLM 的 `CompileSpec` 转换为 Cocos Prefab JSON：

| 阶段 | 文件 | 职责 |
|------|------|------|
| **validate** | validate.ts | 检查多根、重复tempId、非法父引用 |
| **enrich** | enrich.ts | 知识扩展：默认值填充、UITransform 自动补全、子节点展开(如 Button→Label) |
| **build** | build.ts | 构建节点树 → Prefab 对象层级、ID 分配、PrefabInfo 注入 |
| **serialize** | serialize.ts | 对象树 → Cocos 原生扁平数组、引用规范化 |
| **clean** | clean.ts | 移除内部标记、统计计算 |

全部是**纯函数**，依赖通过参数注入，无模块级可变状态。引擎组件和自定义脚本在 enrich 阶段同一入口——有 knowledge 则补，没有就跳过。

## ComponentCatalog — 统一组件目录

合并了旧架构中分散的 COMPONENT_REGISTRY + ScriptRegistry + Knowledge。引擎组件和自定义脚本的查询接口完全一致。

数据来源：

1. `component-cache.json` — 引擎组件 schema（Bridge 从引擎 TS 源码自动提取）
2. `resource-index.json` — 用户脚本列表（Bridge 从编辑器心跳输出）
3. `knowledge-data.ts` — 组件结构约束和默认值（编译时内嵌）

```typescript
const catalog = new ComponentCatalog();
catalog.load(projectPath);

catalog.get('cc.Sprite');     // → { identity, schema, knowledge, template }
catalog.get('testComdr');     // → { identity, schema, knowledge: null, template }
catalog.resolve('Sprite');    // → 'cc.Sprite'
catalog.resolve('testComdr'); // → 'a1b2c3d4...'（压缩 UUID）
```

## IPC 设计：Gateway ↔ Bridge

Gateway 运行在 MCP Server 进程中，Bridge 运行在 Cocos 编辑器进程内，通信通过文件系统完成：

```
Gateway (MCP进程)                 Bridge (Cocos编辑器进程)
     │                                    │
     │  ──write──→  temp/comdr/inbox/     │  (轮询 250ms)
     │                                    │  ──move→ temp/comdr/processing/
     │                                    │  ──execute→ probe/write/edit/save
     │  ←──poll──  temp/comdr/outbox/     │  ←──write──
     │                                    │
     │  ←──poll──  temp/comdr/bridge.json  (心跳/能力，15s)
     │
     │  ──write──→ execution-log.jsonl    (执行日志，Overlay 轮询)
```

- Schema 版本化：`Comdr.cocos-task-request.v1` / `Comdr.cocos-task-result.v1`
- 5 种任务类型：`probe / write / open / edit / save`
- 原子写入：先写 `.tmp` 再 `rename`，防止读取半写文件
- 超时：任务 120s，心跳 30s 过期判定

## MCP Server

[mcp-server](packages/mcp-server/) 实现 JSON-RPC 2.0 over stdio，暴露单个工具 `comdr-engine-ask`：

| 参数 | 必填 | 说明 |
|------|------|------|
| `request` | ✓ | 自然语言指令 |
| `projectPath` | | Cocos 项目路径 |
| `model` | | 模型选择 |
| `sessionId` | | 会话续接 |

返回 `[ok] / [err] / [ask] / [note]` 结构化输出。

### 跨调用对话恢复

Comdr ask 不打断对话流。当 Commander 需要澄清时：

```
MCP call 1 → Commander ask → [ask] 问题 + [session] cmdr-xxx
MCP call 2 + sessionId → Commander 继续 → 完成 → session 清理
```

传入 `sessionId` 参数即可恢复上下文，无需每次重述背景。

**关键设计：每次调用自动清除 `require.cache`** — 改 core 代码无需重启 MCP 进程。

## Overlay 悬浮窗

Tauri v2 构建的透明置顶桌面窗口（380×240），Rust 后端 + 原生 JS/CSS 前端：

- **被动观察者** — 只读文件不调 API，唯一写操作是撤销请求
- 轮询 `execution-log.jsonl` (1s) + `bridge.json` (3s) + `latest-tokens.json`
- **C 状态机**：idle → bridged → racing → watching → executing → done/error
- GPU 加速 CSS 动画，玻璃拟态设计，支持撤销请求

## 关键设计原则

| 原则 | 体现 |
|------|------|
| **单一真实源** | Cocos World 五元素统一定义在 `cocos-world.ts`；全局常量在 `constants.ts` |
| **编排层承担复杂性** | Gateway 负责模糊匹配、路径解析、自动补全、回滚 — 不让 LLM 处理细节 |
| **纯函数管线** | Assembler 5 阶段全部纯函数，依赖注入 |
| **快照/回滚** | 所有破坏性操作前自动抓快照，失败自动恢复 |
| **文件 IPC** | Gateway ↔ Bridge 无 socket/RPC，纯文件轮询，零网络依赖 |
| **热更新** | MCP Server 每次调用清除 require cache，改 core 即时生效 |
| **LLM 容错** | DSL 解析器容忍缺失分号、自动类型转换；Gateway 自动补 write/save |
| **组件对等** | 引擎组件和用户脚本走同一套 enrich → build 管线，仅靠 `__type__` 区分 |

## 核心文件索引

| 文件 | 职责 |
|------|------|
| `core/src/model/cocos-world.ts` | 全系统类型定义 — 唯一真相源 |
| `core/src/model/component-catalog.ts` | 统一组件目录 |
| `core/src/model/probe-protocol.ts` | 统一 Bridge 查询协议 |
| `core/src/gateway/assembly-gateway.ts` | 主编排器 — Agent 主循环 |
| `core/src/gateway/commander.ts` | LLM API 调用封装 |
| `core/src/gateway/prompt.ts` | 动态系统提示词生成 |
| `core/src/translation/assembler/index.ts` | 组装器入口 — 5 阶段管线 |
| `core/src/translation/assembler/enrich.ts` | 统一补全（engine/script 同入口） |
| `core/src/translation/assembler/build.ts` | 扁平 JSON 构建 + ID 分配 |
| `core/src/dsl/parser.ts` | DSL 解析 |
| `core/src/dsl/formatter.ts` | 结果格式化 |
| `core/src/memory/undo-manager.ts` | 快照/回滚管理 |
| `core/src/perception/asset-resolver.ts` | 路径→UUID（含 @ 子资产） |
| `core/src/knowledge/knowledge-data.ts` | 组件知识库数据（编译时内嵌） |
| `core/src/foundation/constants.ts` | 全局常量（单一真实源） |
| `bridge/src/document.ts` | prefab/scene JSON 生命周期 |
| `bridge/src/probe-v2.ts` | 统一探针入口 |
| `bridge/src/bridge-probe-lib.ts` | 引擎探针库（scene-script 注入） |
| `bridge/src/task-bridge.ts` | 文件 IPC 轮询 |
| `mcp-server/src/handlers/comdr-engine-ask.ts` | MCP 工具处理 |

## 环境

- Cocos Creator 3.x / Node.js ≥18 / Windows / macOS
- Bridge 部署：`~/.CocosCreator/extensions/comdr-cocos-bridge/` + **项目级** `{project}/extensions/comdr-cocos-bridge/`（Cocos 加载优先级：项目 > 全局）
- 改 bridge 源码后需重启 Cocos 扩展（Bridge 在编辑器进程内运行）

## 快速开始

```bash
git clone <url> comdr-engine && cd comdr-engine
npm install                    # 安装依赖
npm run build                  # 编译所有包
npm run sync-bridge:project    # 部署 Bridge 到 Cocos 项目（项目级优先）
```

1. 打开 Cocos Creator → 启用 `comdr-cocos-bridge` → 重启
2. 确认 `.mcp.json` 已配置 → MCP 客户端自动加载 `comdr-engine-ask` 工具
