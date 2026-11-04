// コマンド辞典：Git の全体マップ（1 枚絵）。4 つの場所と、その間を動かすコマンド、目的別のコマンドの一覧
// コマンドのチップを押すと onPick(コマンド名) を呼ぶ
const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs = {}, ...kids) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  for (const k of kids.flat()) if (k != null) e.append(k);
  return e;
}
const txt = (x, y, s, cls, anchor = 'middle') => el('text', { x, y, class: cls, 'text-anchor': anchor }, s);
const units = (s) => [...s].reduce((n, ch) => n + (/[\u0000-ÿ]/.test(ch) ? 1 : 2), 0);
const short = (name) => name.replace(/^git /, '');

const W = 1020;
const ZONES = [
  { x: 20, title: '作業フォルダ', sub: '今編集しているファイル', icon: 'folder' },
  { x: 300, title: 'ステージ', sub: '次のコミットに入れるもの', icon: 'tray' },
  { x: 580, title: 'ローカルリポジトリ', sub: '手元の履歴（.git）', icon: 'chain' },
  { x: 860, title: 'リモート', sub: 'サーバー（origin）', icon: 'server' },
];
const ZW = 140, ZY = 78, ZH = 132;

// 目的別のコマンド（図の下の一覧）。名前は COMMANDS.git の name と同じにする
const GROUPS = [
  ['① 始める・設定', ['git init', 'git clone', 'git config', '.gitignore']],
  ['② 見る', ['git status', 'git diff', 'git log', 'git show', 'git blame', 'git shortlog', 'git grep']],
  ['③ ブランチ', ['git branch', 'git switch', 'git checkout', 'git merge', 'git rebase', 'git cherry-pick', 'git tag']],
  ['④ 取り消す・救出', ['git restore', 'git reset', 'git revert', 'git commit --amend', 'git reflog', 'git clean']],
  ['⑤ リモート', ['git remote', 'git fetch', 'git pull', 'git push', 'git submodule']],
  ['⑥ 調べる（CTF・調査）', ['git bisect', 'git cat-file', 'git fsck', 'git ls-files', 'git rev-list', 'git count-objects', 'git gc']],
  ['⑦ 便利', ['git stash', 'git worktree', 'git archive', 'git describe', 'git format-patch / am']],
];

export function gitMap(onPick, known = () => true) {
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
  // 横に並べるチップ（中心 cx に収める）
  const chipRow = (cx, y, names, opt) => {
    const ws = names.map((n) => units(short(n)) * 6.7 + 16);
    let x = cx - (ws.reduce((a, b) => a + b, 0) + (ws.length - 1) * 6) / 2;
    return names.map((n, i) => {
      const c = chip(x + ws[i] / 2, y, n, opt);
      x += ws[i] + 6;
      return c;
    });
  };
  const arrow = (d, cls = '') => el('path', { d, class: `gm-arrow ${cls}`, 'marker-end': `url(#gmHead${cls.includes('back') ? 'B' : ''})` });
  const cap = (x, y, s, anchor = 'middle') => txt(x, y, s, 'gm-cap', anchor);

  // ---------- 場所の絵 ----------
  const icon = (kind, cx, cy) => {
    if (kind === 'folder') return el('g', {}, el('path', { d: `M${cx - 26} ${cy - 14} h18 l5 6 h29 v30 h-52 z`, class: 'gm-ico' }),
      el('rect', { x: cx - 18, y: cy - 2, width: 20, height: 3, class: 'gm-ico-line' }), el('rect', { x: cx - 18, y: cy + 5, width: 30, height: 3, class: 'gm-ico-line' }));
    if (kind === 'tray') return el('g', {}, el('rect', { x: cx - 12, y: cy - 20, width: 24, height: 28, rx: 2, class: 'gm-ico doc' }),
      el('path', { d: `M${cx - 28} ${cy} h12 l4 8 h24 l4 -8 h12 v14 h-56 z`, class: 'gm-ico' }));
    if (kind === 'chain') {
      const xs = [-30, -10, 10, 30];
      return el('g', {}, el('line', { x1: cx - 30, y1: cy, x2: cx + 30, y2: cy, class: 'gm-edge' }),
        ...xs.map((dx, i) => el('circle', { cx: cx + dx, cy, r: 7, class: `gm-commit${i === 3 ? ' head' : ''}` })),
        txt(cx + 30, cy - 12, 'HEAD', 'gm-tiny acc'));
    }
    return el('g', {}, el('rect', { x: cx - 22, y: cy - 18, width: 44, height: 14, rx: 2, class: 'gm-ico' }), el('rect', { x: cx - 22, y: cy, width: 44, height: 14, rx: 2, class: 'gm-ico' }),
      el('circle', { cx: cx + 14, cy: cy - 11, r: 2.2, class: 'gm-led' }), el('circle', { cx: cx + 14, cy: cy + 7, r: 2.2, class: 'gm-led' }));
  };

  const top = [];
  ZONES.forEach((z, i) => {
    top.push(el('rect', { x: z.x, y: ZY, width: ZW, height: ZH, rx: 8, class: `gm-zone z${i}` }),
      txt(z.x + 12, ZY + 20, `0${i + 1}`, 'gm-zone-n', 'start'),
      icon(z.icon, z.x + ZW / 2, ZY + 58),
      txt(z.x + ZW / 2, ZY + 102, z.title, 'gm-zone-t'),
      txt(z.x + ZW / 2, ZY + 120, z.sub, 'gm-zone-s'));
  });
  const midY1 = ZY + 46, midY2 = ZY + 92;
  const gaps = [[160, 300], [440, 580], [720, 860]];
  const pairs = [
    [['git add', 'git rm', 'git mv'], ['git restore'], 'ステージに載せる', '変更を捨てる'],
    [['git commit'], ['git reset'], '履歴に記録', '取り消し（--soft など）'],
    [['git push'], ['git fetch', 'git clone'], '送る', '取ってくる'],
  ];
  gaps.forEach(([a, b], i) => {
    const [fw, bw, fc, bc] = pairs[i];
    top.push(arrow(`M${a + 6} ${midY1} H${b - 8}`), ...chipRow((a + b) / 2, midY1 - 16, fw, { hot: true }), cap((a + b) / 2, midY1 + 15, fc),
      arrow(`M${b - 6} ${midY2} H${a + 8}`, 'back'), ...chipRow((a + b) / 2, midY2 - 16, bw), cap((a + b) / 2, midY2 + 15, bc));
  });
  // 上の小さな箱：stash と、リポジトリを作る・接続先を登録する
  const sx = ZONES[0].x + ZW / 2;
  top.push(el('rect', { x: ZONES[0].x + 10, y: 4, width: ZW - 20, height: 30, rx: 6, class: 'gm-zone stash' }),
    txt(sx, 24, 'stash（退避場所）', 'gm-zone-s strong'),
    arrow(`M${sx - 18} ${ZY - 4} V38`), arrow(`M${sx + 18} 38 V${ZY - 4}`, 'back'),
    chip(sx + 72, 56, 'git stash'), cap(sx - 26, 60, 'しまう', 'end'), cap(sx + 24, 60, 'pop', 'start'));
  top.push(chip(ZONES[2].x + ZW / 2, 52, 'git init'), cap(ZONES[2].x + ZW / 2, 30, 'ここを作る'),
    chip(ZONES[3].x + ZW / 2, 52, 'git remote'), cap(ZONES[3].x + ZW / 2, 30, '接続先を登録'));
  // 下を回る長い矢印：取り出し（ローカル → 作業）と pull（リモート → 作業）
  const wx = ZONES[0].x + ZW / 2;
  const y1 = ZY + ZH + 30, y2 = ZY + ZH + 72;
  top.push(arrow(`M${ZONES[2].x + ZW / 2} ${ZY + ZH + 2} V${y1} H${wx + 22} V${ZY + ZH + 8}`, 'back'),
    ...chipRow(440, y1, ['git switch', 'git checkout', 'git reset', 'git merge', 'git rebase']), cap(440, y1 + 22, 'ブランチ・版を取り出して、作業フォルダに反映（reset は --hard で全部戻す）'),
    arrow(`M${ZONES[3].x + ZW / 2} ${ZY + ZH + 2} V${y2} H${wx - 22} V${ZY + ZH + 8}`, 'back pull'),
    chip(560, y2, 'git pull', { hot: true }), cap(560, y2 + 26, 'pull ＝ fetch ＋ merge（または rebase）をまとめて'));

  // ---------- 目的別の一覧 ----------
  const PY = y2 + 46, COLS = 4, GAP = 12;
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
    const h = cy - rowY + 24;
    rowH = Math.max(rowH, h);
    panels.push({ px, rowY, title, chips, row: Math.floor(i / COLS) });
  });
  const rowHeights = [];
  panels.forEach((p) => {
    const bottom = Math.max(...p.chips.map((c) => +c.getAttribute('transform').match(/ ([\d.]+)\)/)[1] + 22)) + 12;
    rowHeights[p.row] = Math.max(rowHeights[p.row] || 0, bottom - p.rowY);
  });
  const low = [];
  panels.forEach((p) => {
    low.push(el('rect', { x: p.px, y: p.rowY, width: pw, height: rowHeights[p.row], rx: 6, class: 'gm-panel' }),
      el('rect', { x: p.px, y: p.rowY, width: 3, height: rowHeights[p.row], class: 'gm-panel-bar' }),
      txt(p.px + 14, p.rowY + 22, p.title, 'gm-panel-t', 'start'), ...p.chips);
  });
  // 8 枠目：基本の流れ
  const last = panels.length;
  if (last % COLS) {
    const px = 20 + (last % COLS) * (pw + GAP), py = panels[panels.length - 1].rowY, ph = rowHeights[panels[panels.length - 1].row];
    const steps = ['switch', '編集', 'add', 'commit', 'push'];
    const sw = (pw - 24) / steps.length;
    low.push(el('rect', { x: px, y: py, width: pw, height: ph, rx: 6, class: 'gm-panel flow' }),
      txt(px + 14, py + 22, '基本の流れ', 'gm-panel-t', 'start'),
      ...steps.flatMap((s, i) => {
        const x = px + 12 + sw * i + sw / 2, y = py + 50;
        return [el('circle', { cx: x, cy: y, r: 13, class: 'gm-step' }), txt(x, y + 4, String(i + 1), 'gm-step-n'), txt(x, y + 30, s, 'gm-step-t'),
          i < steps.length - 1 ? el('line', { x1: x + 15, y1: y, x2: x + sw - 15, y2: y, class: 'gm-edge' }) : null];
      }),
      txt(px + pw / 2, py + ph - 10, '迷ったら git status', 'gm-cap acc'));
  }

  const height = rowY + rowHeights[rowHeights.length - 1] + 10;
  const svg = el('svg', { viewBox: `0 0 ${W} ${height}`, class: 'gitmap', role: 'group', 'aria-label': 'Git の全体マップ' },
    el('defs', {},
      el('marker', { id: 'gmHead', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, el('path', { d: 'M0 0 L10 5 L0 10 z', class: 'gm-head' })),
      el('marker', { id: 'gmHeadB', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, el('path', { d: 'M0 0 L10 5 L0 10 z', class: 'gm-head back' }))),
    ...top, ...low);
  return { svg, names: all };
}
