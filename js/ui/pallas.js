// 案内役 PALLAS：吹き出しでの案内・ツアー・出来事への反応。3D 表示は pallas3d.js を後から読み込む
import { GREETING, GREETING_AGAIN, PAGE_LINES, TOUR, TIPS } from '../data/pallas.js';
import { SAMPLES } from '../data/samples.js';
import { $, h, store, sendTo } from './common.js';

const KEY = 'ctfportal.pallas';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initPallas() {
  const state = { intro: false, auto: true, hidden: false, seen: [], ...store.get(KEY, {}) };
  const save = () => store.set(KEY, state);
  let page = 'home';
  let drone = null; // 3D 表示（読み込み後）
  let tourStep = -1;
  let closeTimer = 0, typeTimer = 0;
  let booting = true; // 起動直後のあいさつが終わるまでは、ページ案内を保留する

  // ---------- DOM ----------
  const text = h('p', { class: 'pb-text', onclick: () => finishTyping() });
  const actions = h('div', { class: 'pb-actions' });
  const auto = h('input', { type: 'checkbox', onchange: (e) => { state.auto = e.target.checked; save(); } });
  auto.checked = state.auto;
  const bubble = h('div', { class: 'pallas-bubble', role: 'dialog', 'aria-label': 'PALLAS の案内', 'aria-live': 'polite', hidden: '' },
    h('div', { class: 'pb-head' },
      h('span', { class: 'pb-name' }, 'PALLAS'),
      h('span', { class: 'pb-role' }, '作戦支援ドローン'),
      h('button', { type: 'button', class: 'pb-close', 'aria-label': '閉じる', onclick: () => close() }, '×'),
    ),
    text,
    actions,
    h('div', { class: 'pb-foot' },
      h('label', { class: 'check' }, auto, 'ページを開いたときに案内する'),
      h('button', { type: 'button', class: 'pb-link', onclick: () => setHidden(true) }, '隠れる'),
    ),
  );
  bubble.addEventListener('pointerenter', () => clearTimeout(closeTimer));
  const stage = h('div', { class: 'pd-stage' }, h('img', { class: 'pd-fallback', src: 'icons/icon.svg', alt: '' }));
  const droneBtn = h('button', { type: 'button', class: 'pallas-drone', 'aria-label': '案内役 PALLAS と話す', onclick: () => (bubble.hidden ? menu() : close()) }, stage);
  const mini = h('button', { type: 'button', class: 'pallas-mini', hidden: '', onclick: () => setHidden(false) },
    h('span', { class: 'dot' }), 'PALLAS');
  const root = h('div', { class: 'pallas', id: 'pallas' }, bubble, droneBtn, mini);
  document.body.append(root);

  // ---------- 話す ----------
  function finishTyping() {
    if (!typeTimer) return;
    clearInterval(typeTimer);
    typeTimer = 0;
    text.textContent = text.dataset.full;
    drone?.setTalking(false);
  }

  function say(lines, { acts = [], mood = null, autoClose = 0 } = {}) {
    if (state.hidden) {
      mini.classList.add('ping');
      setTimeout(() => mini.classList.remove('ping'), 2400);
      return;
    }
    clearTimeout(closeTimer);
    finishTyping();
    const full = Array.isArray(lines) ? lines.join('\n') : lines;
    bubble.hidden = false;
    root.classList.add('open');
    text.dataset.full = full;
    actions.replaceChildren(...acts.map((a) =>
      h('button', { type: 'button', class: a.primary ? 'small' : 'ghost small', onclick: a.run }, a.label)));
    if (mood) drone?.setMood(mood, 2.5);
    if (reduce) {
      text.textContent = full;
    } else {
      text.textContent = '';
      drone?.setTalking(true);
      let i = 0;
      const chars = Array.from(full);
      typeTimer = setInterval(() => {
        i += 2;
        text.textContent = chars.slice(0, i).join('');
        if (i >= chars.length) finishTyping();
      }, 22);
    }
    if (autoClose) closeTimer = setTimeout(close, autoClose);
  }

  function close() {
    clearTimeout(closeTimer);
    finishTyping();
    bubble.hidden = true;
    root.classList.remove('open');
    if (tourStep >= 0) endTour();
  }

  function setHidden(v) {
    state.hidden = v;
    save();
    if (v) close();
    droneBtn.hidden = v;
    mini.hidden = !v;
    if (!v) say('呼んだ？ いつでも案内するよ。', { mood: 'happy', autoClose: 4000 });
  }

  // ---------- メニュー（タップしたとき） ----------
  function menu() {
    const acts = [
      { label: 'ヒントをちょうだい', run: tip },
      { label: 'ツアーを見る', run: () => startTour() },
    ];
    if (SAMPLES[page]) acts.unshift({ label: '▶ この画面の例を試す', primary: true, run: async () => { sendTo(page, await SAMPLES[page]()); close(); } });
    if (!['identify', 'guide'].includes(page)) acts.push({ label: '迷ったら診断へ', run: () => { location.hash = '#identify'; } });
    say(PAGE_LINES[page] ?? 'どうしたの？', { acts });
  }

  function tip() {
    say(TIPS[Math.floor(Math.random() * TIPS.length)], {
      mood: 'happy',
      acts: [{ label: 'もうひとつ', run: tip }, { label: 'ありがとう', run: close }],
    });
  }

  // ---------- ツアー ----------
  const clearFocus = () => document.querySelectorAll('.pallas-focus').forEach((e) => e.classList.remove('pallas-focus'));

  function startTour() {
    tourStep = 0;
    state.intro = true;
    save();
    showStep();
  }

  function showStep() {
    const step = TOUR[tourStep];
    clearFocus();
    if (location.hash.slice(1).split('/')[0] !== step.page) location.hash = '#' + step.page;
    setTimeout(() => {
      const el = document.querySelector(step.selector);
      if (el) {
        el.classList.add('pallas-focus');
        el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      }
      const last = tourStep === TOUR.length - 1;
      say(`${tourStep + 1} / ${TOUR.length}　${step.text}`, {
        mood: last ? 'happy' : 'talk',
        acts: [
          { label: last ? 'ツアーを終わる' : '次へ ›', primary: true, run: () => (last ? close() : (tourStep++, showStep())) },
          !last ? { label: 'やめる', run: close } : null,
        ].filter(Boolean),
      });
    }, 350);
  }

  function endTour() {
    tourStep = -1;
    clearFocus();
  }

  // ---------- ページ移動 ----------
  function onRoute(p) {
    page = p;
    if (booting || tourStep >= 0 || !state.intro) return;
    if (state.auto && !state.seen.includes(p) && PAGE_LINES[p]) {
      state.seen.push(p);
      save();
      setTimeout(() => say(PAGE_LINES[p], { autoClose: 9000 }), 400);
    } else if (!bubble.hidden && tourStep < 0) {
      close();
    }
  }

  // ---------- 出来事への反応（他の画面から window に 'pallas' イベントで届く） ----------
  window.addEventListener('pallas', (e) => {
    const d = e.detail ?? {};
    if (tourStep >= 0) return;
    const acts = [];
    if (d.flag) acts.push({ label: '問題メモに記録', primary: true, run: () => { sendTo('notes', { flag: d.flag }); close(); } });
    acts.push({ label: 'OK', run: close });
    say(d.text, { mood: d.mood ?? 'talk', acts, autoClose: d.flag ? 0 : 7000 });
  });

  // ---------- 初回のあいさつ ----------
  if (state.hidden) {
    droneBtn.hidden = true;
    mini.hidden = false;
  }
  const bootShown = !$('boot').hidden;
  setTimeout(() => {
    booting = false;
    if (state.hidden) return;
    if (!state.intro) {
      say(GREETING, {
        mood: 'happy',
        acts: [
          { label: 'ツアーを始める', primary: true, run: startTour },
          { label: 'あとで', run: () => { state.intro = true; save(); say('了解！ 困ったらいつでもぼくをタップしてね。', { autoClose: 4000 }); } },
        ],
      });
    } else if (state.auto && !state.seen.includes(page) && PAGE_LINES[page]) {
      // まだ案内していないページで開いたときは、あいさつの代わりにそのページの案内をする
      state.seen.push(page);
      save();
      say(PAGE_LINES[page], { autoClose: 9000 });
    } else {
      say(GREETING_AGAIN, { autoClose: 5000 });
    }
  }, bootShown ? 2700 : 900);

  // ---------- 3D 表示を後から読み込む ----------
  const load3d = async () => {
    try {
      const probe = document.createElement('canvas');
      if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return;
      const { createDrone } = await import('./pallas3d.js');
      drone = await createDrone(stage, { modelUrl: 'models/pallas_drone.glb', reducedMotion: reduce });
      stage.classList.add('ready');
      const accent = () => drone.setAccent(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#36e6ff');
      accent();
      new MutationObserver(accent).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      window.addEventListener('pointermove', (ev) => {
        const r = droneBtn.getBoundingClientRect();
        drone.lookAt((ev.clientX - (r.left + r.width / 2)) / 500, -(ev.clientY - (r.top + r.height / 2)) / 500);
      }, { passive: true });
    } catch {
      /* 3D が使えない環境ではアイコン表示のまま */
    }
  };
  if ('requestIdleCallback' in window) requestIdleCallback(load3d, { timeout: 2500 });
  else setTimeout(load3d, 1200);

  return { onRoute, say };
}
