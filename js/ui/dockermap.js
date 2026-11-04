// コマンド辞典：Docker の全体マップ（1 枚絵）。イメージを中心に、Dockerfile・レジストリ・コンテナのつながりと、目的別のコマンド一覧
// チップを押すと onPick(コマンド名) を呼ぶ。Git マップと同じ gm-* の見た目を流用する
const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs = {}, ...kids) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  for (const k of kids.flat()) if (k != null) e.append(k);
  return e;
}
const txt = (x, y, s, cls, anchor = 'middle') => el('text', { x, y, class: cls, 'text-anchor': anchor }, s);
const units = (s) => [...s].reduce((n, ch) => n + (/[\u0000-ÿ]/.test(ch) ? 1 : 2), 0);
const short = (name) => name.replace(/^docker /, '');

const W = 1020;
// 目的別のコマンド（図の下の一覧）。名前は COMMANDS.docker の name と同じにする
const GROUPS = [
  ['① 動かす', ['docker run', 'docker ps', 'docker exec', 'docker logs', 'docker stop / start / restart']],
  ['② イメージ', ['docker pull', 'docker images', 'docker build', 'docker tag', 'docker push', 'docker rmi', 'docker history']],
  ['③ データ・ネットワーク', ['docker volume', 'docker cp', 'docker network']],
  ['④ 調べる', ['docker inspect', 'docker stats']],
  ['⑤ 片付け', ['docker rm', 'docker system prune']],
  ['⑥ Compose・その他', ['docker compose', 'docker login']],
  ['⑦ 書き方', ['Dockerfile', 'compose.yaml']],
];

export function dockerMap(onPick, known = () => true) {
  const all = new Set();
  const chip = (x, y, name, { hot = false, label = short(name) } = {}) => {
    all.add(name);
    const w = units(label) * 6.7 + 16;
    const g = el('g', { class: `gm-chip${hot ? ' hot' : ''}${known(name) ? '' : ' off'}`, transform: `translate(${x - w / 2} ${y - 11})`, tabindex: 0, role: 'button', 'aria-label': `${name} の説明を開く` },
      el('title', {}, `${name} の説明を開く`),
      el('rect', { width: w, height: 22, rx: 4 }),
      txt(w / 2, 15, label, 'gm-chip-t'));
    const go = () => onPick(name);
    g.addEventListener('click', go);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    return g;
  };
  const chipRow = (cx, y, names, opt) => {
    const ws = names.map((n) => units((opt && opt.labels && opt.labels[n]) || short(n)) * 6.7 + 16);
    let x = cx - (ws.reduce((a, b) => a + b, 0) + (ws.length - 1) * 6) / 2;
    return names.map((n, i) => {
      const o = { ...opt };
      if (opt && opt.labels && opt.labels[n]) o.label = opt.labels[n];
      const c = chip(x + ws[i] / 2, y, n, o);
      x += ws[i] + 6;
      return c;
    });
  };
  const arrow = (d, cls = '') => el('path', { d, class: `gm-arrow ${cls}`, 'marker-end': `url(#dmHead${cls.includes('back') ? 'B' : ''})` });
  const cap = (x, y, s, anchor = 'middle') => txt(x, y, s, 'gm-cap', anchor);
  const zone = (x, y, w, h, cls = '') => el('rect', { x, y, width: w, height: h, rx: 8, class: `gm-zone ${cls}` });

  // ---------- 場所の絵 ----------
  const icon = (kind, cx, cy) => {
    if (kind === 'file') return el('g', {}, el('path', { d: `M${cx - 14} ${cy - 18} h20 l8 8 v28 h-28 z`, class: 'gm-ico' }),
      el('rect', { x: cx - 8, y: cy - 2, width: 16, height: 2.6, class: 'gm-ico-line' }), el('rect', { x: cx - 8, y: cy + 5, width: 20, height: 2.6, class: 'gm-ico-line' }));
    if (kind === 'image') return el('g', {}, // 積み重ねた箱（イメージ＝層）
      ...[8, 2, -4].map((dy, i) => el('path', { d: `M${cx} ${cy - 20 + dy} l22 11 l-22 11 l-22 -11 z`, class: i === 0 ? 'gm-commit head' : 'gm-commit' })));
    if (kind === 'box') return el('g', {}, el('rect', { x: cx - 22, y: cy - 16, width: 44, height: 32, rx: 4, class: 'gm-ico' }),
      el('path', { d: `M${cx - 22} ${cy - 6} h44`, class: 'gm-ico-line' }), el('circle', { cx: cx - 14, cy: cy - 11, r: 1.8, class: 'gm-led' }), el('circle', { cx: cx - 8, cy: cy - 11, r: 1.8, class: 'gm-led' }));
    return el('g', {}, // registry：サーバー
      ...[-14, 0, 14].map((dy) => el('rect', { x: cx - 20, y: cy - 20 + (dy + 14), width: 40, height: 10, rx: 2, class: 'gm-ico' })),
      ...[-9, 5, 19].map((dy) => el('circle', { cx: cx + 12, cy: cy - 20 + (dy + 14) + 5, r: 1.8, class: 'gm-led' })));
  };

  const top = [];
  // 4 つの場所
  const DF = [40, 40, 190, 70], RG = [40, 168, 190, 70], IM = [410, 86, 200, 96], CT = [790, 86, 190, 96];
  const box = (b, title, sub, ic) => {
    const [x, y, w, h] = b;
    top.push(zone(x, y, w, h), icon(ic, x + 40, y + h / 2 + 2), txt(x + w / 2 + 14, y + h / 2 - 4, title, 'gm-zone-t'), txt(x + w / 2 + 14, y + h / 2 + 14, sub, 'gm-zone-s'));
  };
  box(DF, 'Dockerfile', '設計図（作り方）', 'file');
  box(RG, 'レジストリ', 'Hub・社内', 'registry');
  top.push(zone(IM[0], IM[1], IM[2], IM[3], 'z2'), icon('image', IM[0] + 42, IM[1] + IM[3] / 2), txt(IM[0] + IM[2] / 2 + 18, IM[1] + IM[3] / 2 - 4, 'イメージ', 'gm-zone-t'), txt(IM[0] + IM[2] / 2 + 18, IM[1] + IM[3] / 2 + 14, '層を重ねた雛形', 'gm-zone-s'));
  box(CT, 'コンテナ', '動いているもの', 'box');

  // 矢印：Dockerfile → イメージ（build）
  top.push(arrow(`M${DF[0] + DF[2]} ${DF[1] + 35} L${IM[0] - 6} ${IM[1] + 28}`), chip(312, 60, 'docker build', { hot: true, label: 'build' }), cap(312, 82, '設計図から作る'));
  // レジストリ → イメージ（pull）、イメージ → レジストリ（push）
  top.push(arrow(`M${RG[0] + RG[2]} ${RG[1] + 26} L${IM[0] - 6} ${IM[1] + IM[3] - 22}`), chip(300, 158, 'docker pull', { label: 'pull' }), cap(300, 180, '取ってくる'));
  top.push(arrow(`M${IM[0] - 6} ${IM[1] + IM[3] - 6} L${RG[0] + RG[2]} ${RG[1] + 48}`, 'back'), chip(328, 206, 'docker push', { label: 'push' }), cap(360, 210, '送る', 'start'));
  // イメージ → コンテナ（run）
  top.push(arrow(`M${IM[0] + IM[2]} ${IM[1] + IM[3] / 2} H${CT[0] - 6}`), chip((IM[0] + IM[2] + CT[0]) / 2, IM[1] + IM[3] / 2 - 16, 'docker run', { hot: true, label: 'run' }), cap((IM[0] + IM[2] + CT[0]) / 2, IM[1] + IM[3] / 2 + 15, '動かす'));

  // 下の小箱：データ・ネットワーク（イメージ/コンテナの下）／コンテナの操作
  const DN = [410, 200, 230, 92], OP = [700, 200, 280, 92];
  top.push(zone(DN[0], DN[1], DN[2], DN[3], 'stash'), txt(DN[0] + DN[2] / 2, DN[1] + 20, 'データ・ネットワーク', 'gm-zone-s strong'),
    ...chipRow(DN[0] + DN[2] / 2, DN[1] + 46, ['docker volume', 'docker network'], { labels: { 'docker volume': 'volume', 'docker network': 'network' } }), cap(DN[0] + DN[2] / 2, DN[1] + 74, 'データを残す / 名前でつなぐ'),
    arrow(`M${IM[0] + 60} ${IM[1] + IM[3]} V${DN[1]}`, 'back'));
  top.push(zone(OP[0], OP[1], OP[2], OP[3], 'stash'), txt(OP[0] + OP[2] / 2, OP[1] + 20, 'コンテナの操作', 'gm-zone-s strong'),
    ...chipRow(OP[0] + OP[2] / 2, OP[1] + 44, ['docker exec', 'docker logs', 'docker stop / start / restart'], { labels: { 'docker exec': 'exec', 'docker logs': 'logs', 'docker stop / start / restart': 'stop' } }),
    ...chipRow(OP[0] + OP[2] / 2, OP[1] + 72, ['docker cp', 'docker inspect', 'docker stats', 'docker rm'], { labels: { 'docker cp': 'cp', 'docker inspect': 'inspect', 'docker stats': 'stats', 'docker rm': 'rm' } }),
    arrow(`M${CT[0] + CT[2] / 2} ${CT[1] + CT[3]} V${OP[1]}`, 'back'));

  // ---------- 目的別の一覧（Git マップと同じ並べ方） ----------
  const PY = 316, COLS = 4, GAP = 12;
  const pw = (W - 40 - GAP * (COLS - 1)) / COLS;
  const panels = [];
  let rowY = PY, rowH = 0;
  GROUPS.forEach(([title, names], i) => {
    const col = i % COLS;
    if (col === 0 && i) {
      rowY += rowH + GAP;
      rowH = 0;
    }
    const px = 20 + col * (pw + GAP);
    const chips = [];
    let cx = px + 12, cy = rowY + 46;
    for (const n of names) {
      const w = units(short(n)) * 6.7 + 16;
      if (cx + w > px + pw - 10) {
        cx = px + 12;
        cy += 28;
      }
      chips.push(chip(cx + w / 2, cy, n));
      cx += w + 6;
    }
    rowH = Math.max(rowH, cy - rowY + 24);
    panels.push({ px, rowY, title, chips, row: Math.floor(i / COLS) });
  });
  const rowHeights = [];
  panels.forEach((p) => {
    const bottom = Math.max(...p.chips.map((c) => +c.getAttribute('transform').match(/ ([\d.]+)\)/)[1] + 22)) + 12;
    rowHeights[p.row] = Math.max(rowHeights[p.row] || 0, bottom - p.rowY);
  });
  // 「基本の流れ」の枠が入る最後の行は、ステップの絵が収まる高さを確保する
  if (panels.length % COLS) rowHeights[panels[panels.length - 1].row] = Math.max(rowHeights[panels[panels.length - 1].row], 112);
  const low = [];
  panels.forEach((p) => {
    low.push(el('rect', { x: p.px, y: p.rowY, width: pw, height: rowHeights[p.row], rx: 6, class: 'gm-panel' }),
      el('rect', { x: p.px, y: p.rowY, width: 3, height: rowHeights[p.row], class: 'gm-panel-bar' }),
      txt(p.px + 14, p.rowY + 22, p.title, 'gm-panel-t', 'start'), ...p.chips);
  });
  // 最後の枠：基本の流れ
  const last = panels.length;
  if (last % COLS) {
    const px = 20 + (last % COLS) * (pw + GAP), py = panels[panels.length - 1].rowY, ph = rowHeights[panels[panels.length - 1].row];
    const steps = ['build', 'run', 'exec', 'logs', 'rm'];
    const sw = (pw - 24) / steps.length;
    low.push(el('rect', { x: px, y: py, width: pw, height: ph, rx: 6, class: 'gm-panel flow' }),
      txt(px + 14, py + 22, '基本の流れ', 'gm-panel-t', 'start'),
      ...steps.flatMap((s, i) => {
        const x = px + 12 + sw * i + sw / 2, y = py + 48;
        return [el('circle', { cx: x, cy: y, r: 13, class: 'gm-step' }), txt(x, y + 4, String(i + 1), 'gm-step-n'), txt(x, y + 28, s, 'gm-step-t'),
          i < steps.length - 1 ? el('line', { x1: x + 15, y1: y, x2: x + sw - 15, y2: y, class: 'gm-edge' }) : null];
      }),
      txt(px + pw / 2, py + ph - 12, '迷ったら docker ps / logs', 'gm-cap acc'));
  }

  const height = rowY + rowHeights[rowHeights.length - 1] + 10;
  const svg = el('svg', { viewBox: `0 0 ${W} ${height}`, class: 'gitmap', role: 'group', 'aria-label': 'Docker の全体マップ' },
    el('defs', {},
      el('marker', { id: 'dmHead', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, el('path', { d: 'M0 0 L10 5 L0 10 z', class: 'gm-head' })),
      el('marker', { id: 'dmHeadB', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, el('path', { d: 'M0 0 L10 5 L0 10 z', class: 'gm-head back' }))),
    ...top, ...low);
  return { svg, names: all };
}
