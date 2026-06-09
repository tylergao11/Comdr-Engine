# Comdr Overlay v4 — Grok Noir

> 纯黑底 × 琥珀暖光 × 极端克制 × 即时反馈

---

## 配色

```
底色      #0a0a0a   纯黑，不发灰
面板      #141414   微提亮，区分层级
边框      #222222   极暗描边
文字      #f0f0f0   亮白，高对比
次文字    #888888   灰色辅助
强调      #f59e0b   琥珀金 — 仅焦点态 / 错误 / 高亮
错误      #ef4444   暖红，仅错误用
```

无毛玻璃，无渐变，无阴影扩散。干净暗底 + 精确描边。

## 字体

| 用途 | 字体 | Weight | 大小 |
|------|------|--------|------|
| UI 文本 | Inter | 400 | 13px |
| 数字/耗时 | JetBrains Mono | 450 | 12px |
| 输入 | Inter | 400 | 14px |
| 标题 | Inter | 500 | 12px |

## 窗口

```
默认      380 × 144
resizable: true
minWidth:  280
minHeight: 120
decorations: false
alwaysOnTop: true
背景色:    #0a0a0a
圆角:      16px
```

## 三态 + 比例驱动

```
Collapsed  w × max(120, w*0.38)
Expanded   w × min(screenH-40, w*1.25)
Folded     40 × 120 竖条标签
```

展开/收起 150ms，即时反馈。无弹性，无 spring。

## 组件

### TitleBar (28px)
- 左：6px 琥珀圆点（在线亮/离线灭）+ "Comdr" 12px 灰色
- 中：文档名 11px 灰色，过长截断
- 右：— 隐藏按钮
- 双击空白 → 折叠/恢复
- 拖拽手柄仅占中部空白区域

### CommandLog
- 格式：`▸ <摘要> <耗时右对齐> <✓/✗>`
- 折叠 3 条，展开全部 + 滚动
- 错误行点击展开详情，底部可重试
- 空态："等待指令..." 居中浅灰
- 成功 ✓ 淡出 100ms，失败 ✗ 微抖 200ms + 变红
- 新条目直接从底部出现，无滑动动画

### InputBox (36px)
- 前缀 `>` 固定，JetBrains Mono 灰色
- 输入 Inter 14px
- 下划线失焦 `#222` → 聚焦 `#f59e0b`，100ms
- ↑↓ 翻历史，Enter 提交
- `>` 开头 DSL 直发

### ActionBar (28px)
```
[展开 ▲]                              [↩ 撤销]
```
- 两个按钮，仅左键
- 琥珀仅在可撤销时亮
- hover: 100ms 文字变亮，无缩放

### InfoPanel (展开态 40px)
```
Token ▓▓▓▓▓▓░░░░░  38%  │  Schema  │  Bridge ◉
```
- `|` 分隔，等宽字体 11px
- Token >85% 变琥珀

---

## 动画

QML 原生 GPU 动画。Spring 用 `SpringAnimation`，数字过渡用 `Behavior on`。

| 动画 | 时长 | 曲线 | 说明 |
|------|------|------|------|
| 展开/收起 | 320ms | Spring(0.3, 0.8, 1.0) | 高度过渡，微弹不抖 |
| 命令入场 | 280ms | Spring | slideInRight，每条 stagger 40ms |
| 成功 ✓ | 240ms | Spring | 微放大弹入 + 淡入 |
| 失败 ✗ | 360ms | EaseOut | shake 水平抖动 + 变红 |
| 等待 ⏳ | 500ms 循环 | Linear | 三点 dotBreathe 循环 |
| 状态灯 | 200ms | EaseInOut | 亮灭淡变 |
| 输入聚焦 | 200ms | EaseOut | 描边 `#222` → `#f59e0b`，微发光 |
| 按钮 hover | 120ms | EaseOut | scale(1.03) + 文字变亮 |
| 按钮 press | 80ms | EaseIn | scale(0.97) |
| 信息面板 | 250ms | Spring | fadeUp + 微移入 |
| 毛玻璃微光 | 8s 循环 | Linear | 窗口表面光晕缓慢流动 |

---

## 操作栏

仅两个按钮，全部左键：

| 按钮 | 功能 |
|---|---|
| 展开 ▲ / 收起 ▼ | 保持宽度，调高度 |
| ↩ 撤销 | 可撤销时亮(琥珀)，否则灰 |

托盘右键：显示/隐藏 | 退出。设置通过配置文件修改。

---

## Rust/JS 后端

保留现有 Rust 后端逻辑，Qt 侧用 C++ 重写窗口 + QML UI：

```
packages/overlay/
├── DESIGN.md
├── CMakeLists.txt
├── src/
│   ├── main.cpp              Qt 入口
│   ├── mcpclient.h/.cpp      MCP 子进程 (从 Rust mcp_client.rs 移植)
│   ├── config.h/.cpp         配置读写
│   ├── history.h/.cpp        历史持久化
│   └── bridgewatcher.h/.cpp  bridge.json 心跳
└── qml/
    ├── main.qml              根窗口 + 状态机
    ├── TitleBar.qml
    ├── CommandLog.qml
    ├── InputBox.qml
    ├── ActionBar.qml
    └── InfoPanel.qml
```
