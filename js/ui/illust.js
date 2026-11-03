// ツールの使い方ガイドの挿絵：章の内容を「場面の並び」で 1 枚の図にする（すべて SVG のオリジナル）
const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs = {}, text) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
}
const txt = (x, y, s, cls = '', anchor = 'middle', size = null) => el('text', { x, y, class: cls, 'text-anchor': anchor, 'font-size': size }, s);
const rect = (x, y, w, h, cls = '', rx = 3) => el('rect', { x, y, width: w, height: h, rx, class: cls });
const line = (x1, y1, x2, y2, cls = '') => el('line', { x1, y1, x2, y2, class: cls });
const path = (d, cls = '') => el('path', { d, class: cls });
const circle = (cx, cy, r, cls = '') => el('circle', { cx, cy, r, class: cls });

// 半角を 1、全角を 2 と数えた幅
const units = (s) => [...s].reduce((n, ch) => n + (/[\u0000-ÿ]/.test(ch) ? 1 : 2), 0);
function wrap(s, max) {
  const out = [];
  let cur = '', w = 0;
  for (const ch of String(s)) {
    const cw = /[\u0000-ÿ]/.test(ch) ? 1 : 2;
    if (w + cw > max && cur) {
      out.push(cur);
      cur = '';
      w = 0;
    }
    cur += ch;
    w += cw;
  }
  if (cur) out.push(cur);
  return out;
}
// 枠に収まるよう文字を詰める（はみ出すなら … で切る）
const fit = (s, maxUnits) => {
  if (units(s) <= maxUnits) return s;
  let out = '';
  for (const ch of s) {
    if (units(out + ch) > maxUnits - 1) break;
    out += ch;
  }
  return out + '…';
};

// ---------- 場面の小さな絵（中心 cx, cy、使える幅 bw） ----------
// t がある絵は、その文字を絵の中に入れる。below が true の絵は、文字を絵の下に添える
const ICONS = {
  chip(cx, cy, t, bw) {
    const w = Math.min(bw, Math.max(64, units(t) * 6.6 + 22));
    return [rect(cx - w / 2, cy - 16, w, 32, 'il-box acc', 5), txt(cx, cy + 5, fit(t, Math.floor((w - 14) / 6.4)), 'il-mono acc', 'middle', 11)];
  },
  window(cx, cy, t, bw) {
    const w = Math.min(bw, 132);
    return [rect(cx - w / 2, cy - 32, w, 62, 'il-box', 4), rect(cx - w / 2, cy - 32, w, 13, 'il-bar'), circle(cx - w / 2 + 8, cy - 25.5, 2.4, 'il-dot'), circle(cx - w / 2 + 16, cy - 25.5, 2.4, 'il-dot'), circle(cx - w / 2 + 24, cy - 25.5, 2.4, 'il-dot'),
      txt(cx, cy + 6, fit(t, Math.floor((w - 10) / 6.4)), 'il-label strong', 'middle', 11)];
  },
  browser(cx, cy, t, bw) {
    const w = Math.min(bw, 132);
    const out = [rect(cx - w / 2, cy - 32, w, 62, 'il-box', 4), rect(cx - w / 2 + 6, cy - 27, w - 12, 12, 'il-field', 6)];
    if (t) out.push(txt(cx, cy - 18, fit(t, Math.floor((w - 20) / 5.6)), 'il-mono', 'middle', 9));
    for (let i = 0; i < 3; i++) out.push(rect(cx - w / 2 + 10, cy - 5 + i * 10, (w - 20) * [0.8, 0.55, 0.7][i], 5, 'il-line'));
    return out;
  },
  server(cx, cy) {
    const out = [];
    for (let i = 0; i < 3; i++) out.push(rect(cx - 28, cy - 30 + i * 21, 56, 17, 'il-box'), circle(cx - 18, cy - 21.5 + i * 21, 2.6, 'il-led'), rect(cx - 8, cy - 23 + i * 21, 28, 3, 'il-line'));
    return out;
  },
  file(cx, cy) {
    return [path(`M ${cx - 20} ${cy - 30} h 28 l 12 12 v 48 h -40 z`, 'il-doc'), path(`M ${cx + 8} ${cy - 30} v 12 h 12`, 'il-doc-fold'),
      ...[0, 1, 2, 3].map((i) => rect(cx - 13, cy - 10 + i * 9, [26, 20, 24, 14][i], 3.5, 'il-line'))];
  },
  zip(cx, cy) {
    const out = [path(`M ${cx - 30} ${cy - 20} h 22 l 6 6 h 32 v 44 h -60 z`, 'il-doc')];
    for (let i = 0; i < 5; i++) out.push(rect(cx - 3, cy - 10 + i * 8, 6, 4, i % 2 ? 'il-line' : 'il-bar-acc'));
    return out;
  },
  download(cx, cy) {
    return [path(`M ${cx - 28} ${cy + 6} v 16 h 56 v -16`, 'il-stroke'), path(`M ${cx} ${cy - 30} V ${cy + 8}`, 'il-arrow'), path(`M ${cx - 12} ${cy - 4} L ${cx} ${cy + 8} L ${cx + 12} ${cy - 4}`, 'il-stroke acc')];
  },
  search(cx, cy) {
    return [...[0, 1, 2, 3].map((i) => rect(cx - 36, cy - 26 + i * 12, [62, 48, 66, 40][i], 5, i === 2 ? 'il-bar-acc' : 'il-line')),
      circle(cx + 18, cy + 2, 15, 'il-lens'), line(cx + 29, cy + 13, cx + 40, cy + 25, 'il-lens-h')];
  },
  code(cx, cy, t, bw) {
    const lines = t.split('|');
    const w = Math.min(bw, 140);
    const max = Math.floor((w - 14) / 5.9);
    return [rect(cx - w / 2, cy - 32, w, 62, 'il-box', 4), ...lines.slice(0, 4).map((l, i) => txt(cx - w / 2 + 8, cy - 32 + 18 + i * 14 + (4 - Math.min(4, lines.length)) * 6, fit(l, max), i === lines.length - 1 && lines.length > 1 ? 'il-mono acc' : 'il-mono', 'start', 10))];
  },
  terminal(cx, cy, t, bw) {
    const lines = t.split('|');
    const w = Math.min(bw, 140);
    const max = Math.floor((w - 24) / 5.9);
    return [rect(cx - w / 2, cy - 32, w, 62, 'il-box dark', 4), circle(cx - w / 2 + 8, cy - 25, 2.4, 'il-dot'), circle(cx - w / 2 + 16, cy - 25, 2.4, 'il-dot'),
      ...lines.slice(0, 3).map((l, i) => txt(cx - w / 2 + 8, cy - 6 + i * 14, `$ ${fit(l, max)}`, 'il-term', 'start', 10))];
  },
  regs(cx, cy, t, bw) {
    const rows = t.split('|');
    const w = Math.min(bw, 140);
    return [rect(cx - w / 2, cy - 32, w, 62, 'il-box', 4), ...rows.slice(0, 3).map((r, i) => {
      const [k, ...v] = r.split(' ');
      const y = cy - 32 + 22 + i * 16 + (3 - Math.min(3, rows.length)) * 8;
      return [txt(cx - w / 2 + 10, y, k, 'il-mono dim', 'start', 10), txt(cx + w / 2 - 10, y, fit(v.join(' '), Math.floor((w - 50) / 5.9)), 'il-mono acc', 'end', 10)];
    }).flat()];
  },
  flag(cx, cy) {
    return [line(cx - 16, cy - 30, cx - 16, cy + 28, 'il-pole'), path(`M ${cx - 16} ${cy - 30} h 38 l -8 11 l 8 11 h -38 z`, 'il-flag')];
  },
  warn(cx, cy) {
    return [path(`M ${cx} ${cy - 28} L ${cx + 30} ${cy + 24} H ${cx - 30} Z`, 'il-warn'), txt(cx, cy + 17, '!', 'il-warn-t', 'middle', 26)];
  },
  question(cx, cy) {
    return [circle(cx, cy, 26, 'il-ring-acc'), txt(cx, cy + 10, '?', 'il-op', 'middle', 28)];
  },
  check(cx, cy) {
    return [circle(cx, cy, 26, 'il-ring-acc'), path(`M ${cx - 12} ${cy} l 8 9 l 16 -18`, 'il-check')];
  },
  filter(cx, cy) {
    return [path(`M ${cx - 32} ${cy - 26} H ${cx + 32} L ${cx + 8} ${cy + 2} V ${cy + 24} L ${cx - 8} ${cy + 16} V ${cy + 2} Z`, 'il-funnel'),
      ...[0, 1, 2].map((i) => circle(cx - 18 + i * 18, cy - 36, 3, i === 1 ? 'il-led' : 'il-dot'))];
  },
  chat(cx, cy) {
    return [rect(cx - 40, cy - 30, 58, 22, 'il-bubble c', 6), rect(cx - 18, cy - 2, 58, 22, 'il-bubble s', 6),
      rect(cx - 34, cy - 22, 40, 4, 'il-line'), rect(cx - 12, cy + 6, 44, 4, 'il-line')];
  },
  export(cx, cy) {
    return [rect(cx - 30, cy - 20, 44, 44, 'il-box', 4), path(`M ${cx - 6} ${cy + 2} L ${cx + 30} ${cy - 30}`, 'il-arrow'), rect(cx - 22, cy - 6, 20, 4, 'il-line'), rect(cx - 22, cy + 4, 28, 4, 'il-line')];
  },
  lock(cx, cy) {
    return [path(`M ${cx - 13} ${cy - 4} v -10 a 13 13 0 0 1 26 0 v 10`, 'il-stroke'), rect(cx - 22, cy - 4, 44, 32, 'il-box hi', 5), circle(cx, cy + 10, 4, 'il-led-hi')];
  },
  unlock(cx, cy) {
    return [path(`M ${cx - 13} ${cy - 4} v -10 a 13 13 0 0 1 26 0 v -4`, 'il-stroke acc'), rect(cx - 22, cy - 4, 44, 32, 'il-box acc', 5), circle(cx, cy + 10, 4, 'il-led')];
  },
  graph(cx, cy) {
    return [rect(cx - 14, cy - 32, 28, 14, 'il-box acc'), rect(cx - 44, cy - 4, 28, 14, 'il-box'), rect(cx + 16, cy - 4, 28, 14, 'il-box'), rect(cx - 14, cy + 22, 28, 12, 'il-box'),
      line(cx - 4, cy - 18, cx - 30, cy - 4, 'il-edge t'), line(cx + 4, cy - 18, cx + 30, cy - 4, 'il-edge f'), line(cx - 30, cy + 10, cx - 4, cy + 22, 'il-edge'), line(cx + 30, cy + 10, cx + 4, cy + 22, 'il-edge')];
  },
  breakpoint(cx, cy) {
    return [rect(cx - 44, cy - 30, 88, 60, 'il-box', 4), ...[0, 1, 2, 3].map((i) => rect(cx - 26, cy - 22 + i * 13, [50, 38, 56, 30][i], 5, i === 2 ? 'il-bar-acc' : 'il-line')), circle(cx - 35, cy + 6.5, 5, 'il-bp')];
  },
  cookie(cx, cy, t) {
    const out = [circle(cx, cy - 6, 22, 'il-cookie'), ...[[-8, -14], [8, -4], [-6, 4], [10, -18], [0, -8]].map(([dx, dy]) => circle(cx + dx, cy - 6 + dy, 2.6, 'il-chip-dot'))];
    if (t) out.push(rect(cx - 48, cy + 20, 96, 18, 'il-box acc', 4), txt(cx, cy + 33, fit(t, 15), 'il-mono acc', 'middle', 10));
    return out;
  },
  proxy(cx, cy, t) {
    return [rect(cx - 34, cy - 30, 68, 56, 'il-box hi', 6), rect(cx - 10, cy - 18, 7, 22, 'il-pause'), rect(cx + 3, cy - 18, 7, 22, 'il-pause'), txt(cx, cy + 20, fit(t || 'Burp', 11), 'il-mono hi', 'middle', 10)];
  },
  loop(cx, cy) {
    return [path(`M ${cx + 22} ${cy - 8} A 24 24 0 1 0 ${cx + 14} ${cy + 16}`, 'il-arrow')];
  },
  recipe(cx, cy, t, bw) {
    const ops = t.split('|');
    const w = Math.min(bw, 136);
    return ops.slice(0, 3).flatMap((o, i) => {
      const y = cy - 30 + i * 21;
      return [rect(cx - w / 2, y, w, 17, i === ops.length - 1 ? 'il-box acc' : 'il-box', 3), txt(cx, y + 12, fit(o, Math.floor((w - 10) / 6)), 'il-mono', 'middle', 10)];
    });
  },
  kbd(cx, cy, t) {
    const keys = t.split('+');
    const ws = keys.map((k) => Math.max(30, units(k) * 8 + 16));
    const total = ws.reduce((a, b) => a + b, 0) + (keys.length - 1) * 14;
    let x = cx - total / 2;
    return keys.flatMap((k, i) => {
      const out = [rect(x, cy - 18, ws[i], 34, 'il-key', 5), rect(x, cy + 12, ws[i], 4, 'il-key-edge', 2), txt(x + ws[i] / 2, cy + 4, k, 'il-key-t', 'middle', 13)];
      if (i < keys.length - 1) out.push(txt(x + ws[i] + 7, cy + 4, '+', 'il-label', 'middle', 12));
      x += ws[i] + 14;
      return out;
    });
  },
  hex(cx, cy, t) {
    const bs = t.split(' ');
    return bs.slice(0, 4).flatMap((b, i) => [rect(cx - 62 + i * 31, cy - 14, 27, 28, 'il-cell'), txt(cx - 48.5 + i * 31, cy + 5, b, 'il-mono', 'middle', 11.5)]);
  },
  bars(cx, cy) {
    return [...[22, 38, 14, 46, 28].map((v, i) => rect(cx - 40 + i * 17, cy + 22 - v, 12, v, i === 3 ? 'il-bar-acc' : 'il-line')), line(cx - 46, cy + 22, cx + 46, cy + 22, 'il-rule')];
  },
};
// 絵の中に文字を入れない絵（文字は下に添える）
const BELOW = new Set(['server', 'file', 'zip', 'download', 'search', 'flag', 'warn', 'question', 'check', 'filter', 'chat', 'export', 'lock', 'unlock', 'graph', 'breakpoint', 'loop', 'bars']);

let seq = 0;
// spec = { title, panels: [[絵, 絵の中の文字, 説明], ...], point }
export function sceneIllustration(spec) {
  const W = 720, Hh = 244;
  const svg = el('svg', { viewBox: `0 0 ${W} ${Hh}`, class: 'illust', role: 'img', 'aria-label': `${spec.title}：${spec.panels.map((p) => p[2]).join(' → ')}` });
  const mid = `il-arrow-${++seq}`;
  const defs = el('defs');
  const marker = el('marker', { id: mid, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' });
  marker.append(path('M0 0L10 5L0 10z', 'il-head'));
  defs.append(marker);
  svg.append(defs, rect(0.5, 0.5, W - 1, Hh - 1, 'il-frame', 8), txt(W / 2, 28, spec.title, 'il-title', 'middle', 15));
  const n = spec.panels.length, gap = 30, x0 = 14;
  const pw = (W - 2 * x0 - gap * (n - 1)) / n;
  const top = 44, ph = 148, cy = top + 54;
  spec.panels.forEach(([kind, t, caption], i) => {
    const x = x0 + i * (pw + gap), cx = x + pw / 2;
    svg.append(rect(x, top, pw, ph, `il-panel${i === n - 1 ? ' last' : ''}`, 6), path(`M ${x} ${top + 14} L ${x} ${top} L ${x + 14} ${top}`, 'il-corner'));
    const badge = el('g', { class: 'mn-no-il' });
    badge.append(circle(x + 14, top + 14, 9, 'il-num'), txt(x + 14, top + 18, String(i + 1), 'il-num-t', 'middle', 10.5));
    svg.append(badge);
    const draw = ICONS[kind] ?? ICONS.chip;
    svg.append(...draw(cx, cy, t ?? '', pw - 20).flat());
    let capY = top + ph - 30;
    if (BELOW.has(kind) && t) {
      svg.append(txt(cx, top + 104, fit(t, Math.floor((pw - 12) / 6.4)), 'il-mono acc', 'middle', 10.5));
    }
    const lines = wrap(caption, Math.floor((pw - 8) / 6.3)).slice(0, 2);
    lines.forEach((l, k) => svg.append(txt(cx, capY + (lines.length === 1 ? 8 : 0) + k * 17, l, 'il-caption', 'middle', 12)));
    if (i < n - 1) svg.append(path(`M ${x + pw + 5} ${cy} L ${x + pw + gap - 5} ${cy}`, 'il-arrow'));
  });
  if (spec.point) {
    svg.append(line(14, 206, W - 14, 206, 'il-sep'), txt(14, 229, 'POINT', 'il-tag', 'start', 10), txt(68, 229, spec.point, 'il-point', 'start', 12.5));
  }
  svg.querySelectorAll('.il-arrow').forEach((a) => a.setAttribute('marker-end', `url(#${mid})`));
  return svg;
}
