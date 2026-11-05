// サイドメニューまわり：お気に入り（ピン留め）とそのページ・スマホで横に続きがあることを示すぼかし・本文へのスキップ
import { $, h, store } from './common.js';
import { TOOLS, icon } from '../data/tools.js';

const PIN_KEY = 'ctf.pins';
// ツール一覧（TOOLS）に無い入口のページの説明
const EXTRA = {
  guide: { name: 'はじめての CTF', desc: '進め方・ジャンル別の第一歩・用語集' },
  identify: { name: '迷ったら診断', desc: '文字列を貼るだけで正体と使うツールを推測' },
};
const notTool = (id) => id === 'home' || id === 'favorites';

// ---------- お気に入り（ピン留め） ----------
// 本来のメニューの並び（モジュール順）はそのまま残す。
// PC：サイドメニューのホームの直後に「お気に入り」の複製を並べる（スマホでは出さない。横に長くなるため）
// スマホ：メニュー先頭の ★ から、お気に入りのページ（#favorites）を開く
// どちらも並びはモジュール順にそろえる（登録した順にはしない）。
export function initPins(onChange) {
  const nav = $('nav');
  const original = [...nav.querySelectorAll('a[data-route]')].filter((a) => !notTool(a.dataset.route));
  const order = original.map((a) => a.dataset.route);
  const valid = (id) => order.includes(id);
  let pins = store.get(PIN_KEY, []).filter(valid);
  const listeners = new Set();
  const sorted = () => order.filter((id) => pins.includes(id));

  const renderNav = () => {
    nav.querySelectorAll('.nav-pinned, .nav-pins-title').forEach((e) => e.remove());
    const count = $('favCount');
    if (count) count.textContent = pins.length ? String(pins.length) : '';
    if (!pins.length) return;
    const home = nav.querySelector('a[data-route="home"]');
    const items = sorted().map((id) => {
      const a = original.find((x) => x.dataset.route === id).cloneNode(true);
      a.classList.add('nav-pinned');
      a.classList.remove('nav-hot');
      a.querySelector('.badge')?.remove();
      return a;
    });
    home.after(h('div', { class: 'nav-group nav-pins-title' }, 'お気に入り'), ...items);
  };

  const buttons = new Map();
  const renderButtons = () => {
    for (const [id, btn] of buttons) {
      const on = pins.includes(id);
      btn.setAttribute('aria-pressed', String(on));
      btn.classList.toggle('on', on);
      const label = on ? 'お気に入りから外す' : 'お気に入りに追加';
      btn.lastChild.textContent = label;
      btn.title = label;
    }
  };

  const toggle = (id) => {
    if (!valid(id)) return;
    pins = pins.includes(id) ? pins.filter((x) => x !== id) : [...pins, id];
    store.set(PIN_KEY, pins);
    renderNav();
    renderButtons();
    listeners.forEach((f) => f());
    onChange?.();
  };

  // 各ツールの見出しの上（MODULE 番号の行）の右端にボタンを置く
  for (const id of order) {
    const eyebrow = document.querySelector(`[data-page="${id}"] .eyebrow`);
    if (!eyebrow) continue;
    const btn = h('button', { type: 'button', class: 'pin-btn', 'data-pin': id, onclick: () => toggle(id) },
      h('span', { class: 'pin-star', 'aria-hidden': 'true' }), h('span', { class: 'pin-label' }, ''));
    eyebrow.append(btn);
    buttons.set(id, btn);
  }

  // メニューの区切り（はじめに・変換…）ごとの並び。お気に入りのページで追加するときに使う
  const groups = [];
  for (const el of nav.children) {
    if (el.classList.contains('nav-group') && !el.classList.contains('nav-pins-title')) groups.push({ name: el.textContent.trim(), ids: [] });
    else if (el.matches('a[data-route]') && valid(el.dataset.route) && !el.classList.contains('nav-pinned')) groups.at(-1)?.ids.push(el.dataset.route);
  }
  const info = (id) => {
    const t = TOOLS.find((x) => x.id === id) ?? EXTRA[id];
    const navText = original.find((a) => a.dataset.route === id)?.textContent.replace('NEW', '').trim();
    return { id, name: t?.name ?? navText ?? id, desc: t?.desc ?? '', no: String(order.indexOf(id) + 1).padStart(2, '0') };
  };

  renderNav();
  renderButtons();
  return {
    get: () => sorted(),
    toggle,
    has: (id) => pins.includes(id),
    groups,
    info,
    total: order.length,
    subscribe: (f) => listeners.add(f),
  };
}

// ---------- お気に入りのページ ----------
// 1 画面で見渡せるタイルの一覧。「編集」で、このページの中だけで追加・削除できる。
export function initFavorites(pins) {
  const root = $('favRoot');
  let editing = false;

  const tile = (t, i) => h('li', { class: 'fav-tile', style: `--i:${i}` },
    h('a', { class: 'fav-link', href: `#${t.id}`, tabindex: editing ? '-1' : null, 'aria-label': `${t.name}（MODULE ${t.no}）を開く` },
      h('span', { class: 'fav-ico' }, icon(t.id)),
      h('span', { class: 'fav-no' }, `M${t.no}`),
      h('b', { class: 'fav-name' }, t.name),
      t.desc && h('span', { class: 'fav-desc' }, t.desc),
      icon('arrow', 'ico fav-go'),
    ),
    editing && h('button', { type: 'button', class: 'fav-remove', 'aria-label': `${t.name}をお気に入りから外す`, onclick: () => pins.toggle(t.id) }, '×'),
  );

  // 一覧から選んだあとは編集中のままにする（空の状態から 1 件目を足しても一覧が消えないように）
  const picker = () => h('div', { class: 'fav-picker' },
    h('p', { class: 'fav-picker-head' }, 'タップで追加 / 解除（並びはメニューと同じモジュール順）'),
    ...pins.groups.filter((g) => g.ids.length).map((g) => h('div', { class: 'fav-pick-group' },
      h('div', { class: 'fav-pick-name' }, g.name),
      h('div', { class: 'fav-chips' },
        ...g.ids.map((id) => {
          const t = pins.info(id), on = pins.has(id);
          return h('button', { type: 'button', class: `fav-chip${on ? ' on' : ''}`, 'aria-pressed': String(on), 'data-fav': id, onclick: () => { editing = true; pins.toggle(id); } },
            icon(id, 'ico'), h('span', {}, t.name));
        }),
      ),
    )),
  );

  function render() {
    const list = pins.get().map(pins.info);
    const empty = !list.length;
    const showPicker = editing || empty;
    root.classList.toggle('editing', editing);
    root.replaceChildren(...[
      h('div', { class: 'fav-bar' },
        h('div', { class: 'fav-stat' }, h('b', {}, String(list.length).padStart(2, '0')), h('span', {}, ` / ${pins.total} LINKED`)),
        !empty && h('button', { type: 'button', class: `ghost small fav-edit${editing ? ' on' : ''}`, 'aria-pressed': String(editing), onclick: () => { editing = !editing; render(); } }, editing ? '完了' : '編集'),
      ),
      empty
        ? h('div', { class: 'fav-empty' },
          h('span', { class: 'fav-empty-ico' }, icon('favorites')),
          h('p', {}, h('b', {}, 'まだお気に入りがありません'), h('span', {}, 'よく使うツールを下から選ぶと、ここから 1 タップで開けます。各ツールの見出しの上の ☆ からも登録できます。')))
        : h('ol', { class: 'fav-grid' }, ...list.map(tile)),
      showPicker && picker(),
    ].filter(Boolean));
  }

  pins.subscribe(() => { if (!root.closest('[hidden]')) render(); });
  // ページを開くたびに編集をやめて描き直す
  return () => { editing = false; render(); };
}

// ---------- スマホ：横スクロールのメニューに続きがあることを端のぼかしで示す ----------
export function initNavFade() {
  const nav = $('nav');
  const update = () => {
    const max = nav.scrollWidth - nav.clientWidth;
    nav.classList.toggle('more-left', max > 1 && nav.scrollLeft > 1);
    nav.classList.toggle('more-right', max > 1 && nav.scrollLeft < max - 1);
  };
  nav.addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  update();
  return update;
}

// ---------- キーボード操作：本文へのスキップと、ページ移動後のフォーカス ----------
const visiblePage = () => document.querySelector('[data-page]:not([hidden])');

// 表示中のページの見出しにフォーカスを移す（Tab で次に進むと本文の部品から始まる）
export function focusPage() {
  const page = visiblePage();
  const target = page?.querySelector('h1') ?? $('main');
  if (!target) return;
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}

export function initSkipLink() {
  const link = document.querySelector('.skip-link');
  link?.addEventListener('click', (e) => {
    e.preventDefault();
    focusPage();
  });
}

// ページを移ったあと、フォーカスがもう見えない場所（メニューや前のページ）に残っていれば見出しへ移す。
// 移動先のページが自分で入力欄などにフォーカスしたときは、それを優先する。
export function focusAfterRoute() {
  const page = visiblePage();
  const active = document.activeElement;
  if (page && active && active !== document.body && page.contains(active)) return;
  if (active && active.closest?.('#pallas')) return;
  focusPage();
}
