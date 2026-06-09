# Comdr

> Cocos Creator 引擎级 AI 操作层。coding agent 管脚本，Comdr 管编辑器。

## MCP 能力矩阵

| 工具 | 用途 | 触发词 |
|------|------|--------|
| `comdr-ask` | 自然语言操作 Cocos 编辑器 — 创建/编辑 prefab/scene、挂脚本、设属性、查 schema | 一切 Cocos 操作 |

### 跨调用对话恢复

Comdr ask 不打断对话流。当 Commander 需要澄清时：
```
MCP call 1 → Commander ask → [ask] 问题 + [session] cmdr-xxx
MCP call 2 + sessionId → Commander 继续 → 完成 → session 清理
```
传入 `sessionId` 参数即可恢复上下文。无需每次重述背景。

## Cocos 世界模型

Cocos Creator 的世界由五个基础元素构成，全系统以此模型为唯一真相源：

```
Asset      — 文件资源（UUID + 路径 + 类型 + 子资产）
Node       — 层级容器（fileId + 名称 + 父子关系 + 组件列表）
Component  — 类型化数据（引擎组件 cc.Xxx / 自定义脚本 压缩UUID）
Value      — 属性值（原始类型 | Vec2/Vec3/Color | 引用 | 数组）
Reference  — 关系连线（__id__ 内部引 | __uuid__ 资产引）
```

**核心洞察：`__type__` 格式即身份。** `"cc.Sprite"` = 引擎组件，`"a1b2c3..."`（23位压缩UUID）= 自定义脚本。不需要外部查表。

## 架构

```
外部 LLM (Claude)
  │  自然语言意图："给 MainPanel 加 ScrollView"
  ▼
Gateway (assembly-gateway.ts)
  │  Commander 调用 → DSL 解析 → 命令执行 → 反馈
  │  本地纠错：组件名模糊匹配、路径补全——不进 LLM
  ▼
Assembler (translation/assembler/)
  │  5 阶段纯函数管线：Validate → Enrich → Build → Serialize → Clean
  ▼
Bridge (Cocos Editor 扩展)
  │  prefab/scene JSON 原位编辑、心跳通信、资产查询
  ▼
Cocos Creator
```

## 包结构

```
comdr/
├── packages/
│   ├── core/                 # Gateway + Assembler + 模型 + DSL + 感知
│   │   └── src/
│   │       ├── model/                    # 统一 Cocos 世界模型 — 全系统唯一真相源
│   │       │   ├── cocos-world.ts        #   五个基础类型 + 模板 + 工具函数
│   │       │   ├── component-catalog.ts  #   统一组件目录（engine + script）
│   │       │   └── probe-protocol.ts     #   统一 Bridge 查询协议
│   │       ├── gateway/                  # 主编排器
│   │       │   ├── assembly-gateway.ts   #   初始化、主循环、命令分发、本地纠错
│   │       │   ├── commander.ts          #   LLM 调用封装
│   │       │   ├── prompt.ts             #   系统提示生成
│   │       │   └── execution-logger.ts   #   执行日志
│   │       ├── translation/              # 组装管线
│   │       │   └── assembler/
│   │       │       ├── validate.ts       #   Stage 1: 验证 CompileSpec
│   │       │       ├── enrich.ts         #   Stage 2: 统一补全（knowledge + defaults + UITransform）
│   │       │       ├── build.ts          #   Stage 3: 构建扁平 JSON + ID 分配
│   │       │       ├── serialize.ts      #   Stage 4: 引用标准化 + 资产引用包装
│   │       │       └── clean.ts          #   Stage 5: 清除内部标记 + 统计
│   │       ├── dsl/                      # DSL 解析与格式化
│   │       ├── perception/               # 资产路径解析、名称解析、快照、diff
│   │       ├── knowledge/                # 组件知识库（编译时内嵌，零文件依赖）
│   │       ├── memory/                   # 会话状态、资产缓存、文档状态、撤销管理
│   │       ├── context/                  # 项目上下文解析
│   │       ├── config/                   # Gateway 配置加载
│   │       ├── tool-center/              # 文件 IPC 客户端
│   │       ├── errors/                   # 集中式错误码
│   │       └── foundation/               # 常量、工具函数
│   ├── bridge/               # Cocos Editor 扩展（在编辑器进程内运行）
│   │   └── src/
│   │       ├── document.ts              # prefab/scene JSON 生命周期
│   │       ├── asset-probe.ts           # 资产查询
│   │       ├── asset-writer.ts          # 资产写入
│   │       ├── probe-v2.ts              # 统一探针入口
│   │       ├── task-bridge.ts           # 文件 IPC 轮询
│   │       ├── path-utils.ts            # 路径标准化
│   │       └── error-codes.ts           # Bridge 错误码
│   ├── mcp-server/           # MCP 入口
│   │   └── src/
│   │       ├── server.ts                 # JSON-RPC 2.0 over stdio
│   │       └── handlers/
│   │           └── comdr-ask.ts          #   自然语言 Cocos 操作
│   └── overlay/              # Rust + Tauri v2，执行状态仪表台
└── scripts/                  # 构建、同步、schema 提取、版本管理
```

## 核心 Pipeline

```
Commander 输出 DSL
    │
    ▼
Gateway: executeCommand()
    │  本地纠错：组件名模糊匹配、路径补全（不进 LLM）
    │
    ▼
Assembler: assemble(spec, catalog)
    │  Stage 1  Validate   — 检查多根、重复 tempId、非法父引用
    │  Stage 2  Enrich     — knowledge 展开 + 默认值 + UITransform 自动补（engine/script 同一入口）
    │  Stage 3  Build      — 构建扁平 JSON + ID 分配 + PrefabInfo 注入
    │  Stage 4  Serialize  — 引用标准化 + 资产 UUID 包装
    │  Stage 5  Clean      — 清除内部标记
    ▼
Bridge: JSON 原位编辑 → Cocos Creator
```

### Assembler 设计原则

- **纯函数管线**：5 个阶段，每个纯函数，依赖注入。无模块级可变状态。
- **组件平等**：引擎组件和自定义脚本在 enrich 阶段同一入口。有 knowledge 则补，没有就跳过。
- **`__type__` 格式驱动**：引擎组件（`cc.Xxx`）→ 完整模板；脚本组件（压缩 UUID）→ 最小模板。格式本身决定行为。

### Gateway 本地纠错

错误恢复分三级，本地执行的绝不进 LLM prompt：

| 级别 | 场景 | 行为 |
|------|------|------|
| 静默修正 | 组件名缺 `cc.` 前缀、拼写错误 | `catalog.resolve()` + `fuzzyFind()` 自动修正 |
| 修正告知 | 修正成功 | 结果带 `[fix] Sprite → cc.Sprite`，不浪费轮次 |
| 无法修正 | 完全未知的类型 | 返回结构化 `errorCode`，Gateway 不替 LLM 做决策 |

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

## 关键文件

| 文件 | 职责 |
|------|------|
| `core/src/model/cocos-world.ts` | 全系统类型定义 — 唯一真相源 |
| `core/src/model/component-catalog.ts` | 统一组件目录 |
| `core/src/model/probe-protocol.ts` | 统一 Bridge 查询协议 |
| `core/src/gateway/assembly-gateway.ts` | 主编排器 |
| `core/src/gateway/prompt.ts` | 系统提示生成 |
| `core/src/translation/assembler/index.ts` | 组装器入口 — 5 阶段管线 |
| `core/src/translation/assembler/enrich.ts` | 统一补全（engine/script 同入口） |
| `core/src/translation/assembler/build.ts` | 扁平 JSON 构建 + ID 分配 |
| `core/src/dsl/parser.ts` | DSL 解析 |
| `core/src/dsl/formatter.ts` | 结果格式化 |
| `core/src/perception/asset-resolver.ts` | 路径→UUID（含 @ 子资产） |
| `core/src/knowledge/knowledge-data.ts` | 组件知识库数据（内嵌） |
| `bridge/src/document.ts` | prefab/scene JSON 生命周期 |
| `bridge/src/asset-probe.ts` | 资产查询 |
| `bridge/src/probe-v2.ts` | 统一探针入口 |
| `mcp-server/src/handlers/comdr-ask.ts` | MCP 工具 |

## 环境

- Cocos Creator 3.x / Node.js ≥18 / Windows / macOS
- Bridge 部署: `~/.CocosCreator/extensions/comdr-cocos-bridge/` + **项目级** `{project}/extensions/comdr-cocos-bridge/`（Cocos 加载优先级：项目 > 全局）
- MCP handler 每次调用清除 require 缓存，修改 core 无需重启 MCP 进程
- 改 bridge 源码后需重启 Cocos（Bridge 在编辑器进程内运行）

## 快速开始

```bash
git clone <url> comdr && cd comdr
npm run setup    # 依赖 + 编译 + Overlay + Bridge
```

1. 打开 Cocos Creator → 启用 `comdr-cocos-bridge` → 重启
2. 确认 `.mcp.json` 已配置 → MCP 客户端自动加载 `comdr-ask` 工具
