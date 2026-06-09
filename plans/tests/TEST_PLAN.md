# Comdr 测试覆盖计划

## 当前状态

**0 测试。** 项目尚未编写任何测试文件，`tests/` 目录为空。所有代码靠"跑起来看"验证。

## 优先级

| 优先级 | 模块 | 理由 |
|--------|------|------|
| P0 | ComponentCatalog + knowledge-data | Comdr 的"脑子"——组件目录、纠错补全、默认值。坏了用户不会知道，只会看到错误结果 |
| P0 | Prefab Diff | 写操作的安全网——Snapshot/Diff/Rollback 管线 |
| P1 | UndoManager (Snapshot) | Snapshot/Diff/Rollback 核心 |
| P1 | Tool Center | Bridge IPC 通信协议 |
| P2 | Commander | LLM 调用重试/退避 |
| P2 | Assembly Gateway | 主编排器集成测试 |
| P3 | MCP Server | JSON-RPC 协议处理 |

---

## P0: ComponentCatalog + knowledge-data（~20 tests）

**目标**：组件目录加载、模糊匹配、纠错补全、依赖检测全部有覆盖。

### 测试文件：`tests/component-catalog.test.ts`

#### 1. 加载与基础查询（4 tests）

| # | 测试 | 断言 |
|---|------|------|
| 1 | `catalog.load loads from project path` | `load(projectPath)` → count > 20 |
| 2 | `catalog.get with cc. prefix` | `get('cc.Button')` → ComponentEntry 非 null |
| 3 | `catalog.resolve auto-prefixes cc.` | `resolve('Button')` → `'cc.Button'` |
| 4 | `catalog.get returns undefined for unknown` | `get('cc.NonExistent')` → undefined |

#### 2. 子结构与 knowledge（4 tests）

| # | 测试 | 断言 |
|---|------|------|
| 5 | `knowledge.children for Button returns label child` | entry.knowledge.children[0].id === 'label' |
| 6 | `knowledge.children for ScrollView returns view→content nesting` | 2 层嵌套 |
| 7 | `knowledge.children for UITransform returns empty` | [] 或 undefined |
| 8 | `knowledge.children for unknown component returns empty` | undefined |

#### 3. 依赖与冲突（4 tests）

| # | 测试 | 断言 |
|---|------|------|
| 9 | `knowledge.requires for Button` | includes 'cc.UITransform' |
| 10 | `knowledge.requires for UITransform returns empty` | [] 或 undefined |
| 11 | `knowledge.conflicts Widget vs Layout` | Widget.conflicts includes 'cc.Layout' |
| 12 | `knowledge.conflicts Label vs Sprite` | undefined |

#### 4. 模糊匹配（4 tests）

| # | 测试 | 断言 |
|---|------|------|
| 13 | `resolve exact match` | `resolve('cc.Button')` → `'cc.Button'` |
| 14 | `fuzzyFindAll typo distance 1` | `fuzzyFindAll('cc.Buton')` includes `'cc.Button'` |
| 15 | `fuzzyFindAll typo distance 2` | `fuzzyFindAll('cc.ScrolView')` includes `'cc.ScrollView'` |
| 16 | `fuzzyFindAll distance > 2 returns empty` | `fuzzyFindAll('cc.XyzAbcQwe')` → [] |

#### 5. 默认值（2 tests）

| # | 测试 | 断言 |
|---|------|------|
| 17 | `knowledge.defaults for UITransform` | contentSize 有默认值 |
| 18 | `knowledge.defaults for ScrollView` | horizontal=true, bounceDuration≈0.23 |

#### 6. Refs（2 tests）

| # | 测试 | 断言 |
|---|------|------|
| 19 | `knowledge.refs for ScrollView` | content.targetType === 'node', content.targetChild === 'content' |
| 20 | `knowledge.refs for component without refs` | undefined |

#### 特殊处理

- 每个测试前 new 新的 `ComponentCatalog` 实例，隔离状态
- 加载真实 `component-cache.json`（`{projectPath}/temp/comdr/component-cache.json`）

---

## P0: Prefab Diff（~10 tests）

**目标**：验证 diff 管线——added / removed / modified 三种变化正确检测。

### 测试文件：`tests/diff.test.ts`

#### 1. 基本 Diff（4 tests）

| # | 测试 | 断言 |
|---|------|------|
| 1 | `diffPrefab detects added node` | 两个相同 prefab，after 加一个 Node → entries 中有 type=added |
| 2 | `diffPrefab detects removed node` | after 比 before 少一个 Node → entries 中有 type=removed |
| 3 | `diffPrefab detects modified property` | 同一个 Node 的 Label.string 改了 → type=modified |
| 4 | `diffPrefab returns empty for identical arrays` | 同一个 json 两次 → empty=true, entries=[] |

#### 2. 复杂场景（3 tests）

| # | 测试 | 断言 |
|---|------|------|
| 5 | `diffPrefab detects component added` | 同一个 Node，after 多了 cc.Sprite → added |
| 6 | `diffPrefab detects component removed` | 同一个 Node，after 少了 cc.Label → removed |
| 7 | `diffPrefab handles multi-node hierarchy` | 3 个 Node，改其中 1 个的 name → 只有 1 个 modified |

#### 3. diffAllSnapshots（2 tests）

| # | 测试 | 断言 |
|---|------|------|
| 8 | `diffAllSnapshots processes multiple files` | 2 组 before/after → 返回 2 个 PrefabDiffResult |
| 9 | `formatDiffResults produces readable output` | 包含路径、nodeName、change summary |

#### 4. 边界（1 test）

| # | 测试 | 断言 |
|---|------|------|
| 10 | `diffPrefab handles empty before` | before=[] → entries 全是 added |

---

## P1: SnapshotManager（~10 tests）

**目标**：Snapshot 生命周期——capture → diff → consume → restore。

### 测试文件：`tests/snapshot.test.ts`

现有 UndoManager 测试只有 2 个（store/retrieve legacy API）。需要补新 API 测试。

#### 新 API（7 tests）

| # | 测试 | 断言 |
|---|------|------|
| 1 | `captureBefore creates entry` | captureBefore → hasBefore=true, snapshotCount=1 |
| 2 | `captureBefore is idempotent` | 同一 path 调用 2 次 → still count=1 |
| 3 | `captureAfter pairs with captureBefore` | before → after → getSnapshot 的 before 和 after 都非空 |
| 4 | `captureAfter fails without captureBefore` | 先 captureAfter → 返回 false |
| 5 | `touchedPaths returns all paths` | 3 次 captureBefore → 3 paths |
| 6 | `consumeSnapshot removes entry` | getSnapshot → consumeSnapshot → hasBefore=false |
| 7 | `restoreSnapshot puts entry back` | consumeSnapshot → restoreSnapshot → hasBefore=true |

#### Legacy API 兼容（3 tests）

| # | 测试 | 断言 |
|---|------|------|
| 8 | `storeBackup stores JSON` | storeBackup → canUndo=true |
| 9 | `getBackup consumes backup` | getBackup → canUndo=false |
| 10 | `restoreBackup restores slot` | restoreBackup → canUndo=true |

---

## P1: Tool Center（~8 tests）

**目标**：Bridge IPC 通信协议——文件写入、轮询、超时、心跳。

### 测试文件：`tests/tool-center.test.ts`

**需要 Mock**：`fs` 模块的所有文件操作（mkdirSync、writeFileSync、renameSync、existsSync、readFileSync、rmSync）。使用临时目录或 mock-fs。

#### 1. 心跳检测（2 tests）

| # | 测试 | 断言 |
|---|------|------|
| 1 | `health returns true when fresh bridge.json exists` | 写入时间戳 < 30s 的 bridge.json → health()=true |
| 2 | `health returns false when bridge.json is stale` | bridge.json > 30s → health()=false |

#### 2. 任务提交（3 tests）

| # | 测试 | 断言 |
|---|------|------|
| 3 | `submit writes task to inbox` | submit → inbox 目录下有 {id}.json |
| 4 | `submit polls outbox and returns result` | 写入 outbox/{id}.json → submit 返回 CmdResult |
| 5 | `submit times out after timeoutMs` | 不写 outbox → submit 返回 timeout error |

#### 3. 原子性（2 tests）

| # | 测试 | 断言 |
|---|------|------|
| 6 | `submit cleans up inbox on timeout` | timeout → inbox/{id}.json 被删除 |
| 7 | `submit cleans up inbox on abort` | signal.abort() → inbox/{id}.json 被删除 |

#### 4. 健康检查（1 test）

| # | 测试 | 断言 |
|---|------|------|
| 8 | `start/stop health checks` | startHealthChecks → isOnline flips when bridge.json appears |

---

## P2: Commander（~6 tests）

**目标**：LLM 调用重试、退避、错误处理。

### 测试文件：`tests/commander.test.ts`

**需要 Mock**：`https.request`。使用 nock 或手动 mock Node http 模块。

| # | 测试 | 断言 |
|---|------|------|
| 1 | `callCommander returns response on 200` | Mock 200 → CommanderResponse 非空 |
| 2 | `callCommander retries on 429` | 第一次 429、第二次 200 → 重试成功 |
| 3 | `callCommander retries on 5xx` | 502、503 → 重试 |
| 4 | `callCommander fails on 401 without retry` | 401 → 立即失败 |
| 5 | `callCommander exhausts retries` | 连续 4 次失败 → ERR_CMD_MAX_RETRIES |
| 6 | `callCommander aborts on signal` | signal.abort() → 不重试 |

---

## P2: Assembly Gateway 集成测试（~4 tests）

**目标**：主编排器 session 循环。

### 测试文件：`tests/gateway.test.ts`

**需要 Mock**：ToolCenter.submit、callCommander、SnapshotManager。

| # | 测试 | 断言 |
|---|------|------|
| 1 | `runAssemblyProcess completes probe→done cycle` | Mock Commander 返回 probe+done → status=completed |
| 2 | `runAssemblyProcess handles DSL parse error` | 无效 DSL → status=error |
| 3 | `runAssemblyProcess passes context to Commander` | 验证 Commander 收到的 messages 包含 system prompt |
| 4 | `runAssemblyProcess triggers snapshot on write` | compile-block → captureBefore/captureAfter 被调用 |

---

## P3: MCP Server（~4 tests）

**目标**：JSON-RPC 协议处理。

### 测试文件：`tests/mcp-server.test.ts`

| # | 测试 | 断言 |
|---|------|------|
| 1 | `initialize returns server info` | {jsonrpc:'2.0', method:'initialize'} → capabilities.tools |
| 2 | `tools/list returns definitions` | tools/list → comdr-ask tool |
| 3 | `tools/call with invalid name returns error` | 未知 tool → -32602 |
| 4 | `invalid JSON returns -32700` | 发送 "{invalid" → Parse error |

---

## 实施计划

| 阶段 | 内容 | 预估测试数 |
|------|------|-----------|
| 1 | Knowledge Store | ~20 |
| 2 | Prefab Diff + SnapshotManager | ~20 |
| 3 | Tool Center + Commander | ~14 |
| 4 | Gateway + MCP Server | ~8 |
| **合计** | | **~62 new tests** |

实施后：0 + 62 = **~62 tests**，管线 + 智能层 + IPC + 编排全部有覆盖。
