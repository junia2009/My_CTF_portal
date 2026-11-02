// ツールの使い方ガイド：一覧と、各ガイドの表示（目次・章・図・練習）
import { MANUALS } from '../data/manuals.js';
import { SAMPLES } from '../data/samples.js';
import { icon } from '../data/tools.js';
import { $, h, copy, download, sendSample, toast } from './common.js';

const svgNS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, ...kids) => {
  const e = document.createElementNS(svgNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const k of kids) e.append(k);
  return e;
};

// Ghidra の CodeBrowser の配置を表した見取り図（実際の画面を簡略化したオリジナルの図）
function codeBrowserDiagram() {
  const W = 720, H = 400;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'mn-diagram', role: 'img', 'aria-label': 'Ghidra の解析画面の配置図' });
  const panel = (x, y, w, hh, no, title, lines, cls = '') => {
    const g = s('g', { class: `mn-pane ${cls}` });
    g.append(s('rect', { x, y, width: w, height: hh, rx: 3, class: 'mn-box' }));
    g.append(s('rect', { x, y, width: w, height: 22, rx: 3, class: 'mn-bar' }));
    const t = s('text', { x: x + 30, y: y + 15, class: 'mn-title' });
    t.textContent = title;
    g.append(t);
    // 中身の行（文字の代わりに線で表す）
    for (let i = 0; i < lines; i++) {
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
  };
  svg.append(s('rect', { x: 0.5, y: 0.5, width: W - 1, height: H - 1, rx: 4, class: 'mn-frame' }));
  // メニューとツールバー
  const menu = s('text', { x: 14, y: 20, class: 'mn-menu' });
  menu.textContent = 'File   Edit   Analysis   Graph   Navigation   Search   Select   Tools   Window   Help';
  svg.append(menu, s('line', { x1: 0, y1: 30, x2: W, y2: 30, class: 'mn-sep' }));
  svg.append(
    panel(10, 40, 170, 92, '④', 'Program Trees', 4, 'dim'),
    panel(10, 140, 170, 140, '①', 'Symbol Tree', 7),
    panel(10, 288, 170, 102, '④', 'Data Type Manager', 5, 'dim'),
    panel(190, 40, 270, 280, '②', 'Listing', 17),
    panel(470, 40, 240, 280, '③', 'Decompile', 17, 'hot'),
    panel(190, 328, 520, 62, '⑤', 'Console', 2, 'dim'),
  );
  // Listing と Decompile の連動を示す矢印
  svg.append(s('path', { d: 'M 400 200 C 430 186, 470 186, 500 200', class: 'mn-link' }));
  const sync = s('text', { x: 450, y: 180, 'text-anchor': 'middle', class: 'mn-note' });
  sync.textContent = '連動';
  svg.append(sync);
  return svg;
}

export function initManuals() {
  const root = $('manualsBody');

  function renderIndex() {
    root.replaceChildren(
      h('p', { class: 'lead' }, '大会でよく使う外部ツールの、インストールから CTF での使い方までをまとめたガイドです。ポータルのツールと組み合わせて使いましょう。'),
      h('div', { class: 'mn-index' }, ...MANUALS.map((m) => h('a', { class: 'mn-card', href: `#manuals/${m.id}` },
        h('span', { class: 'mn-card-icon' }, icon(m.icon)),
        h('span', { class: 'mn-card-body' },
          h('b', {}, m.name, m.kana ? h('small', {}, `（${m.kana}）`) : ''),
          h('span', {}, m.tagline),
          h('span', { class: 'mn-card-meta' }, ...m.genres.map((g) => h('span', { class: 'tag' }, g)), h('span', { class: 'hint' }, `${m.chapters.length} 章・${m.level}`)),
        ),
        h('span', { class: 'mn-card-go' }, '›'),
      ))),
      h('p', { class: 'hint mn-more' }, 'ガイドは順次追加していきます。'),
    );
  }

  const block = (b) => {
    switch (b.type) {
      case 'p': return h('p', { class: 'mn-p' }, b.text);
      case 'list': return h('div', { class: 'mn-list' }, b.title ? h('div', { class: 'mn-sub' }, b.title) : '', h('ul', {}, ...b.items.map((x) => h('li', {}, x))));
      case 'steps': return h('ol', { class: 'mn-steps' }, ...b.items.map((x) => h('li', {}, h('b', {}, x.title), h('p', {}, x.text))));
      case 'tip':
      case 'warn': return h('div', { class: `mn-callout ${b.type}` },
        h('span', { class: 'mn-callout-label' }, b.type === 'tip' ? 'TIP' : '注意'),
        h('div', {}, b.title ? h('b', {}, b.title) : '', h('p', {}, b.text), b.link ? h('a', { class: 'btn ghost small', href: b.link.href }, b.link.label) : ''));
      case 'code': return h('div', { class: 'mn-code' },
        h('div', { class: 'mn-code-head' }, h('span', {}, b.title ?? 'コード'), h('button', { type: 'button', class: 'ghost small', onclick: () => copy(b.code) }, 'コピー')),
        h('pre', {}, b.code));
      case 'keys': return h('table', { class: 'mn-keys' }, ...b.items.map(([k, d]) => h('tr', {}, h('th', {}, ...k.split(' + ').flatMap((x, i) => [i ? ' + ' : '', h('kbd', {}, x)])), h('td', {}, d))));
      case 'defs': return h('dl', { class: 'mn-defs' }, ...b.items.flatMap(([t, d]) => [h('dt', {}, t), h('dd', {}, d)]));
      case 'faq': return h('div', { class: 'mn-faq' }, ...b.items.map(([q, a]) => h('details', {}, h('summary', {}, q), h('p', {}, a))));
      case 'diagram': return h('figure', { class: 'mn-figure' }, codeBrowserDiagram(), h('figcaption', {}, '解析画面（CodeBrowser）の配置。番号は下の説明に対応しています。'));
      case 'practice': return h('div', { class: 'mn-practice' },
        h('button', { type: 'button', onclick: downloadCrackme }, '練習用クラックミーをダウンロード'),
        h('button', { type: 'button', class: 'ghost', onclick: () => openInPortal() }, 'ポータルのバイナリ解析で答え合わせ'),
        h('span', { class: 'hint' }, 'ファイル名：crackme（約 16KB、Linux x86-64）'));
      case 'answer': return h('details', { class: 'mn-answer' }, h('summary', {}, '答えを見る（自分で解いてから！）'), h('p', {}, b.text));
      default: return '';
    }
  };

  async function downloadCrackme() {
    const f = await SAMPLES.rev();
    download(new Uint8Array(await f.arrayBuffer()), 'crackme');
    toast('ダウンロードしました');
  }
  async function openInPortal() {
    location.hash = '#rev';
    await sendSample('rev', SAMPLES.rev);
  }

  function renderGuide(m) {
    const toc = h('nav', { class: 'mn-toc', 'aria-label': '目次' },
      h('div', { class: 'mn-toc-title' }, 'CONTENTS'),
      ...m.chapters.map((c, i) => h('button', { type: 'button', 'data-ch': c.id, onclick: () => document.getElementById(`mn-${c.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) },
        h('span', {}, String(i + 1).padStart(2, '0')), c.title)));
    const chapters = m.chapters.map((c, i) => h('section', { class: 'card mn-chapter', id: `mn-${c.id}` },
      h('h2', { class: 'mn-h' }, h('span', { class: 'mn-h-no' }, String(i + 1).padStart(2, '0')), c.title),
      ...c.blocks.map(block)));
    root.replaceChildren(
      h('a', { class: 'mn-back', href: '#manuals' }, '‹ ガイドの一覧'),
      h('header', { class: 'mn-hero' },
        h('span', { class: 'mn-hero-icon' }, icon(m.icon)),
        h('div', {},
          h('div', { class: 'mn-hero-name' }, m.name, m.kana ? h('small', {}, m.kana) : ''),
          h('p', {}, m.tagline),
          h('div', { class: 'mn-meta' },
            h('span', {}, h('i', {}, 'ジャンル'), m.genres.join(' / ')),
            h('span', {}, h('i', {}, 'むずかしさ'), m.level),
            h('span', {}, h('i', {}, '準備'), m.prep),
            h('a', { href: m.site, target: '_blank', rel: 'noopener' }, m.siteLabel, ' ↗'),
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
  }

  return (arg) => {
    const m = MANUALS.find((x) => x.id === arg);
    if (m) renderGuide(m);
    else renderIndex();
  };
}
