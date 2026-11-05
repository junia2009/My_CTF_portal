// サイドメニューまわり：よく使うツールのピン留め・スマホで横に続きがあることを示すぼかし・本文へのスキップ
import { $, h, store } from './common.js';

const PIN_KEY = 'ctf.pins';

// ---------- よく使うツール（ピン留め） ----------
// 本来のメニューの並び（モジュール順）はそのまま残し、ホームの直後に「よく使う」の複製を並べる。
// 複製の並びもモジュール順にそろえる（ピン留めした順にはしない）。
export function initPins(onChange) {
  const nav = $('nav');
  const original = [...nav.querySelectorAll('a[data-route]')].filter((a) => a.dataset.route !== 'home');
  const order = original.map((a) => a.dataset.route);
  const valid = (id) => order.includes(id);
  let pins = store.get(PIN_KEY, []).filter(valid);

  const renderNav = () => {
    nav.querySelectorAll('.nav-pinned, .nav-pins-title').forEach((e) => e.remove());
    if (!pins.length) return;
    const home = nav.querySelector('a[data-route="home"]');
    const items = order.filter((id) => pins.includes(id)).map((id) => {
      const a = original.find((x) => x.dataset.route === id).cloneNode(true);
      a.classList.add('nav-pinned');
      a.classList.remove('nav-hot');
      a.querySelector('.badge')?.remove();
      return a;
    });
    home.after(h('div', { class: 'nav-group nav-pins-title' }, 'よく使う'), ...items);
  };

  const buttons = new Map();
  const renderButtons = () => {
    for (const [id, btn] of buttons) {
      const on = pins.includes(id);
      btn.setAttribute('aria-pressed', String(on));
      btn.classList.toggle('on', on);
      const label = on ? 'よく使うから外す' : 'よく使うに追加';
      btn.lastChild.textContent = label;
      btn.title = label;
    }
  };

  const toggle = (id) => {
    pins = pins.includes(id) ? pins.filter((x) => x !== id) : [...pins, id];
    store.set(PIN_KEY, pins);
    renderNav();
    renderButtons();
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

  renderNav();
  renderButtons();
  return { get: () => [...pins], toggle };
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
