# Comdr Overlay — 执行状态仪表台

> Tauri v2 透明悬浮窗 · 实时监控 Comdr Bridge 执行状态

---

## 技术栈

| 层 | 技术 | 文件 |
|----|------|------|
| 窗口框架 | Tauri v2 | `src-tauri/tauri.conf.json` |
| 后端命令 | Rust | `src-tauri/src/lib.rs`, `config.rs`, `history.rs`, `execution_log.rs` |
| 前端 UI | vanilla JS + CSS | `src/main.js`, `src/style.css` |
| 前端结构 | 静态 HTML | `index.html` |
| 通信 | `invoke()` ↔ `#[tauri::command]` | JS→Rust 双向 |

**无框架。** 前端零依赖（除 `@tauri-apps/api` 做桥接），纯 DOM 操作 + CSS 动画。

## 窗口配置

```
type:       无边框透明 (decorations: false, transparent: true)
默认尺寸:   380 × 240
最小尺寸:   280 × 90
层级:       alwaysOnTop + skipTaskbar
圆角:       22px (CSS border-radius)
阴影:       无 (shadow: false)
```

## 架构

```
┌─────────────────────────────────────────┐
│  Rust 后端 (src-tauri/src/)              │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │ heartbeat│ │ request  │ │ poll    │ │
│  │ 心跳检测  │ │ _undo    │ │ exec log│ │
│  └────┬─────┘ └────┬─────┘ └────┬────┘ │
│       │            │            │       │
│  config.rs    history.rs   execution_log.rs
├───────┼────────────┼────────────┼───────┤
│  Tauri invoke_handler                 │
├───────┼────────────┼────────────┼───────┤
│  JS 前端 (src/)                       │
│  ┌──────────────────────────────────┐ │
│  │  invoke('heartbeat') 每 3s      │ │
│  │  invoke('poll_execution_log') 1s │ │
│  │  C 状态机 + DOM 渲染             │ │
│  │  CSS 动画 (GPU accelerated)     │ │
│  └──────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Rust 后端命令

| 命令 | 功能 |
|------|------|
| `heartbeat` | 读 `bridge.json` + `latest-tokens.json`，返回在线状态、当前文档、token 用量 |
| `load_history` | 读 `history.json`，返回最近 20 条 |
| `load_config` | 读 `overlay-config.json` |
| `save_config` | 写 `overlay-config.json` |
| `get_layout` | 返回预定义尺寸常量 |
| `resize_window` | 调整窗口宽高 |
| `request_undo` | 向 Bridge inbox 写入撤销任务卡片 |
| `poll_execution_log` | 读取 Gateway 写入的 `execution-log.jsonl`，返回增量事件 |

### C 状态机（JS 端）

```
idle → bridged → racing → watching → executing → done → idle
                                    ↘ error → idle
```

8 种状态，每种对应不同的 CSS 动画 class：
- `c-idle` — 缓慢呼吸，安静基线
- `c-bridged` — Bridge 重连，3 次弹跳后回归
- `c-racing` — session 启动，快速旋转 + 绿色发光
- `c-watching` — 轮询等待 Commander 输出
- `c-executing` — 命令执行中，快速微动
- `c-done` — 任务完成，轻快旋转收尾
- `c-error` — 出错，急剧抖动

### 执行事件渲染

`poll_execution_log` 返回的 `execution-log.jsonl` 事件按 `kind` 分发：

| kind | 渲染 |
|------|------|
| `session-start` | 居中消息行 + 切换到 `racing` |
| `round-start` | 仅状态切换 → `watching` |
| `command-executed` | 紧凑日志卡片（图标 + 标签 + 摘要 + 耗时 + ✓/✗） |
| `session-done` | 分隔线 `── summary ──` |
| `session-error` | 红色错误分隔线 |

日志卡片按命令类型着色（琥珀=compile，绿=write，蓝=probe，青=open，紫=schema/detail，金=set-prop/edit，红=delete/error）。最多保留 50 条，超出从顶部推出。

### 撤销

每条成功的日志卡片显示 `↩` 按钮。点击向 Bridge inbox 写入 `undo-N` 任务卡片，count 从该卡算起到最新。撤销后该卡及之后所有卡标记为已撤销。

### 窗口吸附

```
normal → (拖到顶部 Y≤25px) → docked → (hover) → peeking → (离开) → docked → (拖下 Y>65px) → normal
```

- **Rust 端**：通过 `WindowEvent::Moved` 检测 Y 坐标，触发 snap 状态切换并 emit `snap-changed` 事件
- **JS 端**：监听 `snap-changed` 事件 + `mouseenter`/`mouseleave`，控制 docked/peeking 的 CSS class

---

## 配色

```
底色      rgba(8,8,8,0.40)   毛玻璃暗底
hover     rgba(8,8,8,1)      鼠标悬停变实
边框      rgba(255,255,255,0.035) → hover 0.08
文字      #e6e6e6   亮白
次文字    #8c8c8c   灰色辅助
三次文字  #5c5c5c   最弱辅助
强调      #f59e0b   琥珀金 — 焦点态 / 错误 / 高亮
成功      #22c55e   绿色 — Bridge 在线 / 命令成功
错误      #ef4444   红色 — 失败 / 熔断
```

无毛玻璃，无渐变，无阴影扩散。暗底 + border + backdrop-blur。

## 字体

| 用途 | 字体 | Weight | 大小 |
|------|------|--------|------|
| UI 文本 | Inter | 400 | 13px |
| 数字/耗时 | JetBrains Mono | 400 | 10-12px |
| 命令标签 | JetBrains Mono | 400 | 9px |
| 标题 | Inter | 500 | 11px |

## 动画

全部 CSS `@keyframes`，GPU 加速（transform + opacity）。

| 动画 | 时长 | 曲线 | 说明 |
|------|------|------|------|
| 卡片入场 | 320ms | spring | queue-in: translateY + scale |
| 卡片退出 | 220ms | ease-in | queue-out: translateY + opacity |
| 状态灯呼吸 | 2.4s | ease | 亮灭淡变 |
| 毛玻璃 hover | 500ms | ease | blur + background + border 过渡 |
| 边框呼吸 (active) | 1s | ease | box-shadow 明暗交替 |
| token 数字翻转 | 300ms | ease | 旧值飞出，新值弹入 |
| 清空飞出 | 350ms | ease-out | translateX(-120px) + rotate |
| 撤销按钮 hover | 150ms | — | opacity → 金色 + 微背景 |
| 进度旋转 (pending) | 800ms | linear | spin-pending 持续旋转 |

---

## 组件

### TitleBar (28px)
- 左：6px 状态圆点（Bridge 在线=绿色呼吸，离线=灰色暗光）+ "Comdr" 11px 灰色
- C 字母独立 class `c-wobble`，8 种状态动画
- 中：文档名 10px 灰色，过长 CSS ellipsis 截断
- 右：拖拽手柄 (`-webkit-app-region: drag`)
- 无隐藏/关闭按钮——托盘右键控制

### CommandLog
- 格式：`图标 标签 摘要 耗时 ✓/✗`
- 每条命令按 `CMD_META` 映射图标和标签（17 种命令类型）
- max 50 条，超出从顶部 queue-out 推出
- 错误行点击展开详情，底部可重试
- undo 按钮 hover 才显示

### TokenDisplay (InfoBar 底部)
- 格式：`Token ▓▓▓▓▓▓░░░░░ 12K ↓38%`
- 缓存命中率 ≥10% 时显示 `↓N%`
- 数字切换时 flip 动画
- Bridge 离线时显示 `—`

### TrayIcon
- 右键菜单：显示/隐藏 | 退出
- 左键单击：显示窗口 + 定位到右下角 + 聚焦

---

## 数据流

```
Gateway (assembly-gateway.ts)
  │  emitEvent() → execution-log.jsonl
  │  token usage → latest-tokens.json
  ▼
{project}/temp/comdr/
  ├── execution-log.jsonl    ← Overlay 每 1s 增量读取
  ├── latest-tokens.json     ← Overlay 每 3s 读取
  ├── bridge.json            ← 心跳检测依据
  └── inbox/                 ← undo 任务写入目标
```

Overlay 是被动观察者——只读文件，不主动调用任何 API。撤销是唯一的写操作（向 inbox 写入任务卡片）。
