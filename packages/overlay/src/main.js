import { invoke } from '@tauri-apps/api/core';

// ====== DOM refs ======
const $ = id => document.getElementById(id);
const el = {
  app: $('app'), main: $('main'),
  dot: $('dot'), nm: $('nm'), doc: $('doc'), drag: $('drag'), sg: $('sg'),
  logi: $('logi'), log: $('log'), clr: $('clr'), tbar: $('tbar'), tp: $('tp'),
};

let cState = 'idle';
let typeTimer = 0;
let wasBridged = false;
let lastExecEventTime = 0;
const MAX_VISIBLE = 50; // 最多保留 50 条，超出从顶部移除
let undoSeq = 0; // 撤销步数计数器，每次成功命令 +1

// Layout 从 Rust 读取，单源尺寸（返回前用兜底值）
let L = { full_w: 380, full_h: 240, collapsed_h: 32 };
invoke('get_layout').then(v => { L = v; }).catch(e => { console.error('[overlay] get_layout failed:', e); });

// ====== C state machine ======
function setCState(state) {
  if (cState === state) return;
  cState = state;
  const nm = document.getElementById('nm');
  const bridged = nm.classList.contains('bridge-on');
  nm.className = '';
  if (bridged) nm.classList.add('bridge-on');
  void nm.offsetWidth;
  nm.className = 'c-' + state;
  if (bridged) nm.classList.add('bridge-on');
}

function backToIdle(delay) {
  clearTimeout(typeTimer);
  typeTimer = setTimeout(() => setCState('idle'), delay || 800);
}

// ====== Command icons & display ======
const CMD_META = {
  compile:     { icon: '⚙', label: 'BUILD' },
  write:       { icon: '⤓', label: 'WRITE' },
  probe:       { icon: '○', label: 'PROBE' },
  'add-node':  { icon: '＋', label: 'ADD' },
  'add-comp':  { icon: '⊕', label: 'COMP' },
  detail:      { icon: '○', label: 'NODE' },
  schema:      { icon: '◇', label: 'SCHEMA' },
  open:        { icon: '◁', label: 'OPEN' },
  'set-prop':  { icon: '✎', label: 'SET' },
  'set-props': { icon: '✎', label: 'SET' },
  'delete-node':{ icon: '✕', label: 'DEL' },
  reparent:    { icon: '⇅', label: 'MOVE' },
  duplicate:   { icon: '⭢', label: 'DUP' },
  'set-active':{ icon: '○', label: 'VIS' },
  ask:         { icon: '？', label: 'ASK' },
  save:        { icon: '⇧', label: 'SAVE' },
  undo:        { icon: '↩', label: 'UNDO' },
};

function fmtElapsed(ms) {
  if (ms == null) return '';
  if (ms < 1000) return ms + 'ms';
  return (ms / 1000).toFixed(1) + 's';
}

/** 从 enriched command 构建有意义的摘要文本。无数据时回退空字符串，不硬凑 */
function buildSummary(cmd) {
  const t = cmd.type;
  const p = (v) => typeof v === 'string' ? v.split('/').pop() : '';
  switch (t) {
    case 'compile': {
      const fp = p(cmd.targetPath);
      const n = cmd.nodeCount || 0;
      const comps = cmd.components || [];
      const parts = [fp, n > 0 ? `${n}n` : '', comps.length > 0 ? comps.map(c => c.replace('cc.','')).join('+') : ''].filter(Boolean);
      return parts.join(' • ');
    }
    case 'write':
      return p(cmd.targetPath);
    case 'probe':
      return [cmd.probeType, cmd.probePath].filter(Boolean).join(' ');
    case 'open':
      return p(cmd.filePath || cmd.assetPath);
    case 'schema':
      return cmd.component || '';
    case 'detail':
      return cmd.nodeUuid || '';
    case 'set-prop':
      return cmd.property ? `${cmd.property} ← ${truncVal(cmd.value)}` : '';
    case 'set-props': {
      const pc = cmd.propCount || 0;
      return pc > 0 ? `${pc} prop${pc > 1 ? 's' : ''}` : '';
    }
    case 'delete-node':
      return cmd.target || '';
    case 'reparent':
      return (cmd.target && cmd.newParent) ? `${cmd.target} → ${cmd.newParent}` : '';
    case 'duplicate':
      return cmd.target || '';
    case 'set-active':
      return cmd.target ? `${cmd.target} = ${cmd.active}` : '';
    case 'ask':
      return cmd.question || '';
    default:
      return '';
  }
}

function truncVal(v) {
  if (v === undefined || v === null) return '';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s; // CSS 层处理溢出，不在此截断
}

// ====== Compact card ======
function card(cmdType, summary, elapsed, status, error) {
  const meta = CMD_META[cmdType] || { icon: '▸', label: cmdType.toUpperCase() };
  const d = document.createElement('div');
  d.className = `log-card queue-in ${cmdType}${status === 'err' ? ' err' : ''}`;
  const eFmt = fmtElapsed(elapsed);
  const stIcon = status === 'ok' ? '✓' : status === 'err' ? '✗' : '◌';
  const cardUndoSeq = status === 'ok' ? ++undoSeq : 0;
  const undoBtn = cardUndoSeq > 0 ? `<button class="undo-btn" title="撤销此操作及之后所有操作" data-seq="${cardUndoSeq}">↩</button>` : '';
  d.innerHTML = `<span class="ci">${meta.icon}</span><span class="ct">${meta.label}</span><span class="s">${summary}</span>${eFmt ? `<span class="e">${eFmt}</span>` : ''}<span class="st ${status}">${stIcon}</span>${undoBtn}`;
  if (error) {
    const de = document.createElement('div');
    de.className = 'log-ed'; de.textContent = error;
    const stEl = d.querySelector('.st.err');
    if (stEl) stEl.onclick = () => { de.style.display = de.style.display === 'none' ? 'block' : 'none'; };
    d.appendChild(de);
  }
  setTimeout(() => d.classList.remove('queue-in'), 350);
  // Undo click handler
  const ub = d.querySelector('.undo-btn');
  if (ub) {
    ub.addEventListener('click', (e) => {
      e.stopPropagation();
      const count = undoSeq - cardUndoSeq + 1; // 从此卡到最新的步数
      if (count <= 0) return;
      ub.textContent = '↻';
      ub.disabled = true;
      invoke('request_undo', { count }).then(() => {
        undoSeq -= count;
        ub.textContent = '✓';
        // 此卡往后的卡片全部标记为已撤销
        let next = d.nextElementSibling;
        while (next) {
          const nub = next.querySelector('.undo-btn');
          if (nub) { nub.textContent = '—'; nub.disabled = true; nub.style.opacity = '0.3'; }
          next = next.nextElementSibling;
        }
        setTimeout(() => { ub.textContent = '↩'; ub.disabled = false; ub.style.opacity = ''; }, 1200);
      }).catch((err) => {
        console.error('[overlay] undo failed:', err);
        ub.textContent = '✗';
        setTimeout(() => { ub.textContent = '↩'; ub.disabled = false; }, 1200);
      });
    });
  }
  return d;
}

// ====== Auto-scroll ======
function scrollToBottom(force) {
  if (force || el.log.scrollHeight - el.log.scrollTop - el.log.clientHeight < 30) {
    el.log.scrollTop = el.log.scrollHeight;
  }
}

// ====== Queue: slide out old items beyond limit ======
function trimLog() {
  const items = [...el.logi.querySelectorAll('.log-card, .log-msg, .log-round-sep, .log-session-done')];
  const excess = items.length - MAX_VISIBLE;
  if (excess <= 0) return;
  // Animate out the oldest items
  for (let i = 0; i < excess; i++) {
    items[i].classList.add('queue-out');
    setTimeout(() => items[i].remove(), 250);
  }
}

// ====== Heartbeat ======
async function tick() {
  try {
    const hb = await invoke('heartbeat');
    el.dot.classList.toggle('bridge-on', hb.bridge_online);
    el.nm.classList.toggle('bridge-on', hb.bridge_online);
    el.doc.textContent = hb.current_doc ? '│ ' + hb.current_doc.split('/').pop() : '';
    if (hb.tokens) {
      el.tbar.classList.add('has-token');
      const pt = hb.tokens.promptTokens || 0;
      const ct = hb.tokens.completionTokens || 0;
      const total = pt + ct;
      const hit = hb.tokens.cacheHitTokens || 0;
      // 缓存节省率: hit = 未计费缓存token, pt = 计费输入token
      // 有效输入总量 = pt + hit, 节省比例 = hit / (pt + hit)
      const effectiveInput = pt + hit;
      const rate = (hit > 0 && effectiveInput > 0) ? Math.round(hit / effectiveInput * 100) : null;
      const newVal = total > 0 ? (rate !== null && rate >= 10 ? `${fmtK(total)} ↓${rate}%` : `${fmtK(total)}`) : '—';
      if (el.tp.textContent !== newVal && el.tp.textContent !== '—') {
        // 数字切换：旧值飞出，新值弹入
        el.tp.classList.add('flip');
        setTimeout(() => { el.tp.textContent = newVal; el.tp.classList.remove('flip'); }, 150);
      } else if (el.tp.textContent === '—') {
        el.tp.textContent = newVal;
      }
    } else {
      el.tbar.classList.remove('has-token');
      el.tp.textContent = '—';
    }
    if (hb.bridge_online && !wasBridged) { setCState('bridged'); backToIdle(3200); }
    wasBridged = hb.bridge_online;
  } catch (e) { console.error('[overlay] tick error:', e); }
}
tick(); setInterval(tick, 3000);

// ====== Execution log polling (passive watching) ======
async function pollExecLog() {
  try {
    const events = await invoke('poll_execution_log');
    if (events.length > 0) {
      lastExecEventTime = Date.now();
      // 批量渲染：一次性全量渲染，避免 stagger 导致滚动时机错乱
      events.forEach(evt => { renderExecEvent(evt); trimLog(); });
      el.log.scrollTop = el.log.scrollHeight;
    } else if (cState !== 'idle' && cState !== 'bridged' && Date.now() - lastExecEventTime > 5000) {
      backToIdle(0);
    }
  } catch (e) { console.error('[overlay] pollExecLog error:', e); }
}

const _seenEvents = new Set();
function renderExecEvent(evt) {
  // 去重：cursor 从 0 开始重放全量日志时跳过已渲染事件
  const dedupKey = `${evt.timestamp}|${evt.seq}|${evt.kind}`;
  if (_seenEvents.has(dedupKey)) return;
  _seenEvents.add(dedupKey);
  switch (evt.kind) {
    case 'session-start': {
      setCState('racing');
      el.app.classList.add('hover','active');
      if (evt.message) {
        const sep = document.createElement('div');
        sep.className = 'log-msg queue-in';
        sep.textContent = evt.message;
        el.logi.appendChild(sep);
        setTimeout(() => sep.classList.remove('queue-in'), 300);
      }
      break;
    }
    case 'round-start': {
      setCState('watching');
      break;
    }
    case 'command-executed': {
      setCState('executing'); backToIdle(600);
      const cmdType = evt.command?.type || '?';
      const ok = evt.result?.ok;
      const status = ok ? 'ok' : 'err';
      const error = evt.result?.error || '';
      const summary = buildSummary(evt.command || { type: cmdType }) || cmdType;
      const cardEl = card(cmdType, summary, evt.elapsedMs, status, error);
      el.logi.appendChild(cardEl);
      break;
    }
    case 'session-done': {
      setCState('done'); backToIdle(1500);
      el.app.classList.remove('active');
      if (!cursorInside()) el.app.classList.remove('hover');
      const sep = document.createElement('div');
      sep.className = 'log-session-done queue-in';
      if (evt.doneReport && evt.doneReport.summary) {
        sep.textContent = '── ' + evt.doneReport.summary + ' ──';
      } else {
        sep.textContent = '── done ──';
      }
      el.logi.appendChild(sep);
      setTimeout(() => sep.classList.remove('queue-in'), 300);
      break;
    }
    case 'session-error': {
      setCState('error'); backToIdle(2500);
      el.app.classList.remove('active');
      if (!cursorInside()) el.app.classList.remove('hover');
      const sep = document.createElement('div');
      sep.className = 'log-session-done queue-in';
      sep.textContent = `── ${evt.error || 'error'} ──`;
      el.logi.appendChild(sep);
      setTimeout(() => sep.classList.remove('queue-in'), 300);
      break;
    }
  }
}

pollExecLog(); setInterval(pollExecLog, 1000);


function fmtK(n) {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'K';
  return String(n);
}

// ====== Snap state machine ======
// States: normal → docked → peeking → docked → normal
// Rust owns normal↔docked (Y position). JS owns docked↔peeking (hover).
import { listen } from '@tauri-apps/api/event';
let snapState = 'normal';
let mx = -1, my = -1;
let collapseTimer = 0;
document.addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; });
function cursorInside() { return mx >= 0 && my >= 0 && mx < window.innerWidth && my < window.innerHeight; }

function transition(newState) {
  if (snapState === newState) return;
  snapState = newState;
  el.app.classList.remove('docked', 'peeking');
  if (newState === 'docked') el.app.classList.add('docked');
  if (newState === 'peeking') el.app.classList.add('peeking');
  const h = (newState === 'docked') ? L.collapsed_h : L.full_h;
  invoke('resize_window', { width: L.full_w, height: h });
}

// Rust 决议 normal↔docked
listen('snap-changed', (evt) => {
  if (evt.payload.collapsed) {
    transition('docked');
    // 吸附后自动 peek，让用户看到内容
    setTimeout(() => transition('peeking'), 400);
  } else {
    transition('normal');
  }
});

// JS 决议 docked↔peeking（鼠标 hover）
el.app.addEventListener('mouseenter', () => {
  el.app.classList.add('hover');
  clearTimeout(collapseTimer);
  if (snapState === 'docked') transition('peeking');
});
el.app.addEventListener('mouseleave', () => {
  el.app.classList.remove('hover');
  mx = -1; my = -1;
  clearTimeout(collapseTimer);
  if (snapState === 'peeking') {
    collapseTimer = setTimeout(() => {
      if (snapState === 'peeking' && !cursorInside()) transition('docked');
    }, 200);
  }
});

// Init
setCState('idle');

// ====== 清空日志：视野外直接删，视野内逐条飞出 ======
el.clr.addEventListener('click', () => {
  _seenEvents.clear();
  undoSeq = 0;
  const items = [...el.logi.querySelectorAll('.log-card, .log-msg, .log-round-sep, .log-session-done')];
  if (items.length === 0) return;
  const logRect = el.log.getBoundingClientRect();
  const visible = items.filter(el => {
    const r = el.getBoundingClientRect();
    return r.bottom > logRect.top && r.top < logRect.bottom;
  });
  // 视野外的直接删
  for (const el of items) {
    if (!visible.includes(el)) el.remove();
  }
  // 视野内的逐条动画
  visible.forEach((item, idx) => {
    setTimeout(() => {
      item.classList.add('clearing');
      setTimeout(() => item.remove(), 400);
    }, idx * 50);
  });
});

