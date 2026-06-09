# Comdr 上下文与记忆系统设计

## 对比：Claude Code vs Comdr

### Claude Code 记忆模型

```
CLAUDE.md（项目指令，每次加载）
memory/
  ├── MEMORY.md（索引文件）
  └── *.md（每条记忆一个文件，frontmatter + 正文）
       ├── name: xxx（标识符）
       ├── description: xxx（摘要）
       ├── metadata.type: user|feedback|project|reference
       ├── [[link]] 交叉引用
       └── 正文：事实 + Why + How to apply

计划文件（plans/），持久化
对话历史（会话级）
工具调用历史（会话级）
```

特点：跨会话持久化、结构化元数据、内部链接、计划系统。

### Comdr 记忆模型

```
compact-codec.ts（Commander 系统提示，静态）
assembly-gateway.ts（编排器，运行时上下文注入）

内存层：
  CommanderState      — 会话级，tempId→UUID，不持久化
  DocumentState       — 会话级，打开文档追踪
  AssetCache          — 持久化，路径→UUID
  ScriptRegistry      — 持久化，脚本元数据
  SessionStore        — 持久化，会话历史
  SnapshotManager     — 会话级，快照/回滚
  KnowledgeBase       — 静态，组件默认值+结构
  ComponentSchemas    — 生成，233 组件类型
  ExecutionLogger     — 持久化，事件日志（供 Overlay）
  ValueStore          — 会话级，泛型 KV（未使用）
```

### 差距分析

| 能力 | Claude Code | Comdr | 差距 |
|---|---|---|---|
| 跨会话记忆 | memory/*.md，结构化 | SessionStore（仅会话记录） | Comdr 缺用户反馈/经验记忆 |
| 项目指令 | CLAUDE.md | compact-codec.ts | 同级，但 Comdr 是静态 prompt |
| 计划持久化 | plans/*.md | 无 | Comdr 缺 |
| 内部引用 | `[[link]]` | 无 | Comdr 缺 |
| 模板保持 | frontmatter 元数据 | 无 | Comdr 缺 |
| 引擎级上下文 | 无 | 233 组件 schema、知识库、资产缓存 | Comdr 优势 |
| 实时文档状态 | 无 | Bridge 心跳 → DocumentState | Comdr 优势 |
| 安全执行 | 无 | Snapshot/Undo | Comdr 优势 |

### 核心差异：共享环境 vs 独占环境

Claude Code 是**独占操作者**——只有 Claude 在操作代码仓库。状态是自己产生的，不会过期。

Comdr 是**共享环境**——用户也在手动操作 Cocos Creator：
- 用户在编辑器里改名、删节点、拖层级
- 用户导入新资源、删除旧资源
- 用户打开/关闭不同的文档
- 用户可能**先手动改了东西，再让 Comdr 继续操作**

这意味着 Comdr 的**所有状态都是可能过期的**。AssetCache、ScriptRegistry、DocumentState、甚至正在编辑的文档内容都可能已被用户手动修改。

### 设计原则：现实锚定（Reality Anchoring）

1. **操作前必须探测**：edit 命令之前必须先 probe，不假设任何状态
2. **心跳监控变化**：Bridge 心跳检测文档变化（用户手动打开/关闭/保存）
3. **缓存可失效**：AssetCache、ScriptRegistry 通过文件时间戳或内容 hash 检测变化
4. **乐观执行 + 回滚**：操作假定状态正确，但 Bridge 端检测到冲突时回滚
5. **不缓存文档内容**：文档 `_json` 只在 open 时读一次，操作期间不假设内容不变

### 结论

**Comdr 不需要的计划系统**：Comdr 是共享环境——用户随时手动改 Cocos。任何跨步骤计划都可能在执行前就过期。Comdr 的定位是"现在帮我做这个"，不是"按计划逐步推进"。

**Comdr 需要的**：
- 跨会话记忆：记住用户偏好、常见操作模式、项目特定的组件命名规范。这些**不依赖编辑器状态**，不会过期
- 现实锚定：每步操作前 probe 确认状态

**Claude Code 优势**：跨会话学习、计划系统、结构化记忆
**Comdr 优势**：引擎级上下文、实时编辑器状态、安全回滚
**不需要的**：持久计划——共享环境让它不可靠

---

## Comdr 上下文注入规范

以下定义 Gateway 向 Commander 注入的上下文内容及格式。

### 初始上下文（首轮 user message）

```
# Open: prefab=assets/TestPanel.prefab
{request}
```

- `# Open:` 行来自 `DocumentState.getCurrent()`
- `{request}` 是用户自然语言指令原文

### 每轮反馈（后续 user messages）

```
[ok] >probe: ok
[ok] >set-prop: ok
+ @R1
```

- `[ok]/[err]` 行来自 `formatCommandResults()`
- `+ @R1` 来自 `buildTurnDelta()`——本轮新创建节点
- 错误时附 `[err]` 行和 Bridge 控制台 warn/error

### 裁剪摘要（历史超出上限时注入）

```
# Active tempId mappings: R1→abc123, N1→def456
# Open: prefab=assets/TestPanel.prefab
# Project: C:\Ai\HelloWorld
```

- tempId 映射来自 `CommanderState.getTempIdMappings()`
- 文档状态来自 `DocumentState.getCurrent()`

---

## Commander ↔ Gateway 分工

Commander 是填空引擎，Gateway 是做事的。

| 层 | 职责 | 不负责 |
|---|---|---|
| **Commander** | 选命令模板、填名称/类型/值/路径 | schema 查表、UUID 解析、结构展开 |
| **Gateway** | DSL 解析、schema 纠错、knowledge 展开、asset→UUID、快照回滚、引用解析 | 判断用户意图（由 Claude 负责） |

原则：所有"标准流程"放 Gateway。Commander 只填空。

## 编码规范

### 原则

1. **规则优先**：prompt 靠规则定义（类型、约束、禁止项），不靠例子教学
2. **类型明确**：每个参数的可接受格式在命令签名中定义
3. **接口优先**：Gateway probe 转发用 spread DSL 字段，不逐字段手写
4. **常量统一**：所有阈值从 `foundation/constants.ts` 导入，不硬编码数字
5. **错误可追溯**：catch 块必须写 `process.stderr.write`，不静默吞错误

### 禁止项

- prompt 中写占位符（`<placeholder>`、`#fileId` 字面量）
- 魔法数字（`500`、`120000`、`33554432`）
- 静默 catch（`catch {}` 不写日志）
- probe 转发逐字段手写（新字段会漏）
- 手工维护的类型列表（REF_ANNOTATIONS 已删）
