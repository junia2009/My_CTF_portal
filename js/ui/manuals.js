// ツールの使い方ガイド：一覧と、各ガイドの表示（目次・章・図・練習）
import { MANUALS } from '../data/manuals.js';
import { SAMPLES } from '../data/samples.js';
import { icon } from '../data/tools.js';
import { MANUAL_ILLUST } from '../data/manual-illust.js';
import { sceneIllustration } from './illust.js';
import { $, h, copy, download, sendSample, toast, store } from './common.js';

// 学ぶページなどから図・部品を足せるようにする
const FIGURES = {};
const WIDGETS = {};
export const registerFigures = (o) => Object.assign(FIGURES, o);
export const registerWidgets = (o) => Object.assign(WIDGETS, o);

const svgNS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, ...kids) => {
  const e = document.createElementNS(svgNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const k of kids) e.append(k);
  return e;
};

// 画面の見取り図（実際の画面を簡略化したオリジナルの図）。ツールごとに配置だけを変える
function diagramFrame(W, H, label, menuText) {
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'mn-diagram', role: 'img', 'aria-label': label });
  svg.append(s('rect', { x: 0.5, y: 0.5, width: W - 1, height: H - 1, rx: 4, class: 'mn-frame' }));
  if (menuText) {
    const menu = s('text', { x: 14, y: 20, class: 'mn-menu' });
    menu.textContent = menuText;
    svg.append(menu, s('line', { x1: 0, y1: 30, x2: W, y2: 30, class: 'mn-sep' }));
  }
  return svg;
}
function pane(x, y, w, hh, no, title, lines, cls = '') {
  const g = s('g', { class: `mn-pane ${cls}` });
  g.append(s('rect', { x, y, width: w, height: hh, rx: 3, class: 'mn-box' }));
  g.append(s('rect', { x, y, width: w, height: 22, rx: 3, class: 'mn-bar' }));
  const t = s('text', { x: x + 30, y: y + 15, class: 'mn-title' });
  t.textContent = title;
  g.append(t);
  // 中身の行（文字の代わりに線で表す）
  for (let i = 0; i < lines && 34 + i * 14 < hh - 4; i++) {
    const len = (0.35 + ((i * 37) % 50) / 100) * (w - 24);
    g.append(s('rect', { x: x + 12 + (i % 3 === 1 ? 14 : 0), y: y + 34 + i * 14, width: Math.max(24, len - (i % 3 === 1 ? 14 : 0)), height: 5, rx: 2, class: 'mn-line' }));
  }
  const badge = s('g', { class: 'mn-no' });
  badge.append(s('circle', { cx: x + 15, cy: y + 11, r: 9 }));
  const n = s('text', { x: x + 15, y: y + 15, 'text-anchor': 'middle' });
  n.textContent = no;
  badge.append(n);
  g.append(badge);
  return g;
}
const note = (x, y, text, anchor = 'middle') => {
  const t = s('text', { x, y, 'text-anchor': anchor, class: 'mn-note' });
  t.textContent = text;
  return t;
};

const DIAGRAMS = {
  // Ghidra の解析画面（CodeBrowser）
  ghidra() {
    const svg = diagramFrame(720, 400, 'Ghidra の解析画面の配置図', 'File   Edit   Analysis   Graph   Navigation   Search   Select   Tools   Window   Help');
    svg.append(
      pane(10, 40, 170, 92, '④', 'Program Trees', 4, 'dim'),
      pane(10, 140, 170, 140, '①', 'Symbol Tree', 7),
      pane(10, 288, 170, 102, '④', 'Data Type Manager', 5, 'dim'),
      pane(190, 40, 270, 280, '②', 'Listing', 17),
      pane(470, 40, 240, 280, '③', 'Decompile', 17, 'hot'),
      pane(190, 328, 520, 62, '⑤', 'Console', 2, 'dim'),
      s('path', { d: 'M 400 200 C 430 186, 470 186, 500 200', class: 'mn-link' }),
      note(450, 180, '連動'),
    );
    return svg;
  },
  // Wireshark のメイン画面
  wireshark() {
    const svg = diagramFrame(720, 420, 'Wireshark の画面の配置図', 'File   Edit   View   Go   Capture   Analyze   Statistics   Telephony   Wireless   Tools   Help');
    // 表示フィルタの入力欄
    const g = s('g', { class: 'mn-pane hot' });
    g.append(s('rect', { x: 10, y: 40, width: 700, height: 28, rx: 3, class: 'mn-box' }));
    const ft = s('text', { x: 40, y: 58, class: 'mn-filter' });
    ft.textContent = 'http.request || frame contains "flag"';
    const badge = s('g', { class: 'mn-no' });
    badge.append(s('circle', { cx: 25, cy: 54, r: 9 }));
    const n = s('text', { x: 25, y: 58, 'text-anchor': 'middle' });
    n.textContent = '①';
    badge.append(n);
    g.append(ft, badge);
    svg.append(g,
      pane(10, 76, 700, 132, '②', 'Packet List（No. / Time / Source / Destination / Protocol / Info）', 7, 'hot'),
      pane(10, 216, 700, 104, '③', 'Packet Details（Frame / Ethernet / IP / TCP / HTTP…）', 5),
      pane(10, 328, 700, 66, '④', 'Packet Bytes（16 進ダンプ）', 2, 'dim'),
    );
    svg.append(s('line', { x1: 0, y1: 400, x2: 720, y2: 400, class: 'mn-sep' }), note(14, 414, '⑤ ステータスバー：表示中 / 全パケット数', 'start'));
    return svg;
  },
  // CyberChef の画面
  cyberchef() {
    const svg = diagramFrame(720, 380, 'CyberChef の画面の配置図', 'Download CyberChef                                                          Options   About / Support');
    svg.append(
      pane(10, 40, 170, 330, '①', 'Operations', 18),
      pane(190, 40, 190, 330, '②', 'Recipe', 6, 'hot'),
      pane(390, 40, 320, 160, '③', 'Input', 8),
      pane(390, 210, 320, 160, '④', 'Output', 8, 'hot'),
    );
    // 料理する（BAKE!）ボタン
    const btn = s('g', { class: 'mn-bake' });
    btn.append(s('rect', { x: 200, y: 328, width: 170, height: 32, rx: 3 }));
    const bt = s('text', { x: 285, y: 349, 'text-anchor': 'middle' });
    bt.textContent = 'BAKE!';
    btn.append(bt);
    svg.append(btn, s('path', { d: 'M 182 120 L 196 120', class: 'mn-link' }), note(285, 314, 'ドラッグで追加'));
    return svg;
  },
  // QGIS の画面
  qgis() {
    const svg = diagramFrame(720, 400, 'QGIS の画面の配置図', 'プロジェクト  編集  ビュー  レイヤ  設定  プラグイン  ベクタ  ラスタ  データベース  Web  メッシュ  プロセシング  ヘルプ');
    const bar = s('g', { class: 'mn-pane dim' });
    bar.append(s('rect', { x: 10, y: 38, width: 700, height: 22, rx: 3, class: 'mn-box' }));
    for (let i = 0; i < 22; i++) bar.append(s('rect', { x: 18 + i * 30, y: 43, width: 14, height: 12, rx: 2, class: 'mn-line' }));
    svg.append(bar,
      pane(10, 68, 190, 150, '①', 'ブラウザ（XYZ Tiles など）', 8),
      pane(10, 226, 190, 136, '②', 'レイヤー', 7, 'hot'),
      pane(210, 68, 500, 294, '③', '地図（マップキャンバス）', 0, 'hot'),
    );
    // 地図の中の点
    for (const [x, y] of [[330, 180], [350, 200], [370, 220], [520, 160], [540, 190], [600, 260], [460, 300]]) svg.append(s('circle', { cx: x, cy: y, r: 5, class: 'mn-dot' }));
    svg.append(s('path', { d: 'M 240 330 C 330 250, 430 330, 690 200', class: 'mn-link' }));
    svg.append(s('line', { x1: 0, y1: 370, x2: 720, y2: 370, class: 'mn-sep' }), note(14, 389, '④ 座標  139.7671,35.6812   縮尺 1:5,000   回転 0.0°   EPSG:4326', 'start'));
    return svg;
  },
  // Postman の画面
  postman() {
    const svg = diagramFrame(720, 400, 'Postman の画面の配置図', 'Home   Workspaces   API Network                                        Environment ⑤ ▾');
    svg.append(pane(10, 40, 170, 350, '①', 'Collections', 16));
    const url = s('g', { class: 'mn-pane hot' });
    url.append(s('rect', { x: 190, y: 40, width: 520, height: 30, rx: 3, class: 'mn-box' }));
    const ut = s('text', { x: 230, y: 60, class: 'mn-filter' });
    ut.textContent = 'GET ▾   {{baseUrl}}/get?name=pallas';
    const sendb = s('rect', { x: 640, y: 44, width: 64, height: 22, rx: 3, class: 'mn-send' });
    const st = s('text', { x: 672, y: 59, 'text-anchor': 'middle', class: 'mn-send-t' });
    st.textContent = 'Send';
    const badge = s('g', { class: 'mn-no' });
    badge.append(s('circle', { cx: 205, cy: 55, r: 9 }));
    const n = s('text', { x: 205, y: 59, 'text-anchor': 'middle' });
    n.textContent = '②';
    badge.append(n);
    url.append(ut, sendb, st, badge);
    svg.append(url,
      pane(190, 78, 520, 120, '③', 'Params ・ Authorization ・ Headers ・ Body ・ Scripts', 5),
      pane(190, 206, 520, 184, '④', 'Response  200 OK  120 ms  1.2 KB ／ Body ・ Headers ・ Test Results', 9, 'hot'),
    );
    return svg;
  },
};

// 確認問題：選ぶと正解・不正解と解説を表示
function quiz(b) {
  const res = h('div', { class: 'mn-quiz-res', hidden: '' });
  const btns = b.choices.map((c, i) => h('button', { type: 'button', class: 'mn-quiz-c', onclick: () => {
    btns.forEach((x, j) => {
      x.disabled = true;
      x.classList.toggle('ok', j === b.answer);
      x.classList.toggle('ng', j === i && i !== b.answer);
    });
    res.hidden = false;
    res.replaceChildren(h('b', { class: i === b.answer ? 'ok' : 'ng' }, i === b.answer ? '正解！' : '残念……'), h('p', {}, b.explain));
  } }, h('span', {}, 'ABCD'[i]), c));
  return h('div', { class: 'mn-quiz' }, h('div', { class: 'mn-quiz-q' }, h('span', { class: 'mn-quiz-tag' }, 'Q'), b.q), h('div', { class: 'mn-quiz-cs' }, ...btns), res);
}

export const block = (b) => {
  switch (b.type) {
    case 'p': return h('p', { class: 'mn-p' }, b.text);
    case 'list': return h('div', { class: 'mn-list' }, b.title ? h('div', { class: 'mn-sub' }, b.title) : '', h('ul', {}, ...b.items.map((x) => h('li', {}, x))));
    case 'steps': return h('ol', { class: 'mn-steps' }, ...b.items.map((x) => h('li', {}, h('b', {}, x.title), h('p', {}, x.text))));
    case 'tip':
    case 'warn': return h('div', { class: `mn-callout ${b.type}` },
      h('span', { class: 'mn-callout-label' }, b.type === 'tip' ? 'TIP' : '注意'),
      h('div', {}, b.title ? h('b', {}, b.title) : '', h('p', {}, b.text), b.link ? h('a', { class: 'btn ghost small', href: b.link.href, ...(/^https?:/.test(b.link.href) ? { target: '_blank', rel: 'noopener' } : {}) }, b.link.label, /^https?:/.test(b.link.href) ? ' ↗' : '') : ''));
    case 'code': return h('div', { class: 'mn-code' },
      h('div', { class: 'mn-code-head' }, h('span', {}, b.title ?? 'コード'), h('button', { type: 'button', class: 'ghost small', onclick: () => copy(b.code) }, 'コピー')),
      h('pre', {}, b.code));
    case 'keys': return h('table', { class: `mn-keys${b.copy ? ' copyable' : ''}` }, ...b.items.map(([k, d]) => h('tr', {},
      // フィルタの表は、1つの式としてクリックでコピーできるようにする
      h('th', {}, ...(b.copy ? [h('kbd', { title: 'クリックでコピー', onclick: () => copy(k) }, k)] : k.split(' + ').flatMap((x, i) => [i ? ' + ' : '', h('kbd', {}, x)]))),
      h('td', {}, d))));
    case 'defs': return h('dl', { class: 'mn-defs' }, ...b.items.flatMap(([t, d]) => [h('dt', {}, t), h('dd', {}, d)]));
    case 'faq': return h('div', { class: 'mn-faq' }, ...b.items.map(([q, a]) => h('details', {}, h('summary', {}, q), h('p', {}, a))));
    case 'diagram': return h('figure', { class: 'mn-figure' }, DIAGRAMS[b.name](), h('figcaption', {}, b.caption));
    case 'practice': return h('div', { class: 'mn-practice' },
      b.download ? h('button', { type: 'button', onclick: () => downloadSample(b.download) }, b.download.label) : '',
      b.input ? h('div', { class: 'mn-input' }, h('code', {}, b.input), h('button', { type: 'button', class: 'ghost small', onclick: () => copy(b.input) }, 'コピー')) : '',
      b.portal ? h('button', { type: 'button', class: 'ghost', onclick: () => openInPortal(b.portal) }, b.portal.label) : '',
      b.note ? h('span', { class: 'hint' }, b.note) : '');
    case 'devlab': return devLab();
    case 'table': return h('div', { class: 'mn-table-wrap' }, h('table', { class: 'mn-table' },
      b.head ? h('thead', {}, h('tr', {}, ...b.head.map((x) => h('th', {}, x)))) : '',
      h('tbody', {}, ...b.rows.map((r) => h('tr', {}, ...r.map((x, i) => h(i === 0 && b.rowHead !== false ? 'th' : 'td', {}, x)))))));
    case 'quiz': return quiz(b);
    case 'scene': return h('figure', { class: 'mn-illust' }, sceneIllustration(b.spec));
    case 'figure': return h('figure', { class: 'mn-figure' }, FIGURES[b.name](), b.caption ? h('figcaption', {}, b.caption) : '');
    case 'widget': return WIDGETS[b.name](b);
    case 'answer': return h('details', { class: 'mn-answer' }, h('summary', {}, '答えを見る（自分で解いてから！）'), h('p', {}, b.text));
    default: return '';
  }
};

async function downloadSample({ sample, filename }) {
  const f = await SAMPLES[sample]();
  download(new Uint8Array(await f.arrayBuffer()), filename);
  toast('ダウンロードしました');
}
// ポータルのツールで答え合わせ（例のファイル、または指定した文字列を送る）
async function openInPortal({ page, sample, payload }) {
  location.hash = '#' + page;
  await sendSample(page, sample ? SAMPLES[sample] : () => payload);
}

// 開発者ツールの練習：コメント・押せないボタン・Cookie の3つ（ポータルの中だけで完結）
function devLab() {
  const dec = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
  const COOKIE = 'ctfportal_lab_role';
  if (!document.cookie.split('; ').some((c) => c.startsWith(COOKIE + '='))) document.cookie = `${COOKIE}=guest; path=/; SameSite=Lax; max-age=2592000`;
  const out2 = h('output', { class: 'mn-lab-out' }, '');
  const out3 = h('output', { class: 'mn-lab-out' }, '');
  const btn = h('button', { type: 'button', class: 'small', disabled: '' }, 'フラグを見る');
  btn.addEventListener('click', () => (out2.textContent = dec('ZmxhZ3tkMXM0YmwzZF9idXQ3MG59')));
  const check = h('button', { type: 'button', class: 'ghost small' }, '権限を確認');
  check.addEventListener('click', () => {
    const role = document.cookie.split('; ').find((c) => c.startsWith(COOKIE + '='))?.split('=')[1] ?? '（なし）';
    out3.textContent = role === 'admin' ? `ようこそ管理者さん：${dec('ZmxhZ3tjMDBrMTNfbTBuc3Qzcn0=')}` : `あなたの権限：${role}（admin ならフラグが見られます）`;
  });
  const box = h('div', { class: 'mn-lab', 'data-lab': 'devtools' },
    h('div', { class: 'mn-lab-title' }, 'TRAINING TARGET'),
    h('div', { class: 'mn-lab-row' }, h('b', {}, '①'), h('span', {}, 'この枠の HTML のどこかに、コメントが隠れています。')),
    h('div', { class: 'mn-lab-row' }, h('b', {}, '②'), h('span', {}, 'このボタンは押せません……本当に？'), btn, out2),
    h('div', { class: 'mn-lab-row' }, h('b', {}, '③'), h('span', {}, '管理者だけが見られる情報があります。'), check, out3),
  );
  box.insertBefore(document.createComment(` ${dec('ZmxhZ3toMWRkM25fMW5fYzBtbTNudH0=')} `), box.children[1]);
  return box;
}

export function renderGuide(root, m, { back = '#manuals', backLabel = 'ガイドの一覧', illust = MANUAL_ILLUST, readKey = null } = {}) {
  const read = new Set(readKey ? store.get(readKey, []) : []);
  const toc = h('nav', { class: 'mn-toc', 'aria-label': '目次' },
    h('div', { class: 'mn-toc-title' }, 'CONTENTS'),
    ...m.chapters.map((c, i) => h('button', { type: 'button', 'data-ch': c.id, onclick: () => document.getElementById(`mn-${c.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) },
      h('span', {}, read.has(`${m.id}/${c.id}`) ? '✓' : String(i + 1).padStart(2, '0')), c.title)));
  const chapters = m.chapters.map((c, i) => h('section', { class: 'card mn-chapter', id: `mn-${c.id}` },
    h('h2', { class: 'mn-h' }, h('span', { class: 'mn-h-no' }, String(i + 1).padStart(2, '0')), c.title),
    // 章の挿絵（1 枚絵）。画面の配置図がある章は、そちらを優先して挿絵は付けない
    illust[`${m.id}/${c.id}`] ? h('figure', { class: 'mn-illust' }, sceneIllustration(illust[`${m.id}/${c.id}`])) : '',
    ...c.blocks.map(block),
    readKey ? readButton(c) : ''));
  root.replaceChildren(
    h('a', { class: 'mn-back', href: back }, `‹ ${backLabel}`),
    h('header', { class: 'mn-hero' },
      h('span', { class: 'mn-hero-icon' }, icon(m.icon)),
      h('div', {},
        h('div', { class: 'mn-hero-name' }, m.name, m.kana ? h('small', {}, m.kana) : ''),
        h('p', {}, m.tagline),
        h('div', { class: 'mn-meta' },
          m.genres ? h('span', {}, h('i', {}, 'ジャンル'), m.genres.join(' / ')) : '',
          m.level ? h('span', {}, h('i', {}, 'むずかしさ'), m.level) : '',
          m.prep ? h('span', {}, h('i', {}, m.prepLabel ?? '準備'), m.prep) : '',
          m.site ? h('a', { href: m.site, target: '_blank', rel: 'noopener' }, m.siteLabel, ' ↗') : '',
        ),
      ),
    ),
    h('div', { class: 'mn-layout' }, toc, h('div', { class: 'mn-chapters' }, ...chapters)),
  );
  // 読んでいる章を目次で光らせる
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      toc.querySelectorAll('button').forEach((b) => b.classList.toggle('active', `mn-${b.dataset.ch}` === e.target.id));
    }
  }, { rootMargin: '-30% 0px -60% 0px' });
  chapters.forEach((c) => io.observe(c));

  // 章の「読んだ」印（目次に ✓ が付き、一覧に進み具合が出る）
  function readButton(c) {
    const key = `${m.id}/${c.id}`;
    const btn = h('button', { type: 'button', class: 'ghost small mn-read' });
    const paint = () => {
      btn.textContent = read.has(key) ? '✓ 読んだ（取り消す）' : 'この章を読んだ';
      btn.classList.toggle('on', read.has(key));
      const tb = toc.querySelector(`[data-ch="${c.id}"] span`);
      if (tb) tb.textContent = read.has(key) ? '✓' : String(m.chapters.indexOf(c) + 1).padStart(2, '0');
    };
    btn.addEventListener('click', () => {
      if (read.has(key)) read.delete(key);
      else read.add(key);
      store.set(readKey, [...read]);
      paint();
    });
    paint();
    return h('div', { class: 'mn-read-row' }, btn);
  }
}

export function initManuals() {
  const root = $('manualsBody');

  function renderIndex() {
    root.replaceChildren(
      h('p', { class: 'lead' }, '大会でよく使う外部ツールの、インストールから CTF での使い方までをまとめたガイドです。ポータルのツールと組み合わせて使いましょう。'),
      h('div', { class: 'mn-index' }, ...MANUALS.map((m) => {
        const more = h('button', { type: 'button', class: 'lr-more', 'aria-label': '説明を開く', 'aria-expanded': 'false' }, '⌄');
        const card = h('article', { class: 'mn-card lr-card' },
          h('a', { class: 'lr-stretch', href: `#manuals/${m.id}`, 'aria-label': `${m.name} を開く` }),
          h('span', { class: 'mn-card-icon' }, icon(m.icon)),
          h('div', { class: 'mn-card-body' },
            h('b', {}, m.name, m.kana ? h('small', {}, `（${m.kana}）`) : ''),
            h('p', { class: 'lr-tagline' }, m.tagline),
            h('span', { class: 'mn-card-meta' }, ...m.genres.map((g) => h('span', { class: 'tag' }, g)), h('span', { class: 'hint' }, `${m.chapters.length} 章・${m.level}`)),
          ),
          more,
          h('span', { class: 'mn-card-go' }, '›'),
        );
        more.addEventListener('click', () => {
          const open = card.classList.toggle('open');
          more.setAttribute('aria-expanded', String(open));
          more.setAttribute('aria-label', open ? '説明を閉じる' : '説明を開く');
        });
        return card;
      })),
      h('p', { class: 'hint mn-more' }, 'ガイドは順次追加していきます。'),
    );
  }

  return (arg) => {
    const m = MANUALS.find((x) => x.id === arg);
    if (m) renderGuide(root, m);
    else renderIndex();
  };
}
