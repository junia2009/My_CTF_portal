// 案内役 PALLAS：画面を飛び回り、吹き出しで案内・ツアー・出来事への反応をする。3D 表示は pallas3d.js を後から読み込む
import * as P from '../data/pallas.js';
import { SAMPLES } from '../data/samples.js';
import { $, h, store, sendTo, sendSample } from './common.js';

const KEY = 'ctfportal.pallas';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => innerWidth <= 760;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);

export function initPallas() {
  const state = { intro: false, auto: true, roam: true, hidden: false, seen: [], home: null, ...store.get(KEY, {}) };
  const save = () => store.set(KEY, state);
  let page = 'home';
  let drone = null; // 3D 表示（読み込み後）
  let tourStep = -1;
  let closeTimer = 0, typeTimer = 0;
  let booting = true;
  // ページ案内は「ブラウザを開くたびに各ページ1回」。案内済みのページはセッションの間だけ覚えておく
  const SEEN_KEY = 'ctfportal.pallasSeen';
  const seen = new Set((() => { try { return JSON.parse(sessionStorage.getItem(SEEN_KEY) || '[]'); } catch { return []; } })());
  const markSeen = (p) => {
    seen.add(p);
    try { sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen])); } catch { /* 保存できなくても動作は続ける */ }
  };
  const shouldExplain = (p) => state.auto && !seen.has(p) && !!P.PAGE_LINES[p];
  let magicFails = 0;

  // ---------- DOM ----------
  const text = h('p', { class: 'pb-text', onclick: () => finishTyping() });
  const actions = h('div', { class: 'pb-actions' });
  const toggle = (key, label) => {
    const cb = h('input', { type: 'checkbox', onchange: (e) => { state[key] = e.target.checked; save(); } });
    cb.checked = state[key];
    return h('label', { class: 'check' }, cb, label);
  };
  const bubble = h('div', { class: 'pallas-bubble', role: 'dialog', 'aria-label': 'PALLAS の案内', 'aria-live': 'polite', hidden: '' },
    h('div', { class: 'pb-head' },
      h('span', { class: 'pb-name' }, 'PALLAS'),
      h('span', { class: 'pb-role' }, '作戦支援ドローン'),
      h('button', { type: 'button', class: 'pb-close', 'aria-label': '閉じる', onclick: () => close() }, '×'),
    ),
    text,
    actions,
    h('div', { class: 'pb-foot' },
      h('div', { class: 'pb-opts' }, toggle('auto', 'ページごとに案内'), toggle('roam', '自由に飛び回る')),
      h('button', { type: 'button', class: 'pb-link', onclick: () => setHidden(true) }, '隠れる'),
    ),
  );
  bubble.addEventListener('pointerenter', () => clearTimeout(closeTimer));
  const stage = h('div', { class: 'pd-stage' }, h('img', { class: 'pd-fallback', src: 'icons/icon.svg', alt: '' }));
  const droneBtn = h('button', { type: 'button', class: 'pallas-drone', 'aria-label': '案内役 PALLAS と話す（ドラッグで移動）' }, stage);
  const mini = h('button', { type: 'button', class: 'pallas-mini', hidden: '', onclick: () => setHidden(false) }, h('span', { class: 'dot' }), 'PALLAS');
  const layer = h('div', { class: 'pallas', id: 'pallas' }, bubble, droneBtn, mini);
  document.body.append(layer);

  // ================= 飛行 =================
  const size = () => droneBtn.offsetWidth || 120;
  const pos = { x: 0, y: 0 }, vel = { x: 0, y: 0 }, target = { x: 0, y: 0 };
  let dragging = null, lastActivity = performance.now(), nextRoam = performance.now() + rand(9000, 15000);
  let lastIdleTalk = performance.now();

  const bounds = () => ({ minX: 8, minY: 66, maxX: innerWidth - size() - 8, maxY: innerHeight - size() - 8 });
  const homePos = () => {
    const b = bounds();
    if (state.home) return { x: clamp(state.home.rx * innerWidth, b.minX, b.maxX), y: clamp(state.home.ry * innerHeight, b.minY, b.maxY) };
    return { x: b.maxX - 6, y: b.maxY - 2 };
  };
  const setTarget = (p) => {
    const b = bounds();
    target.x = clamp(p.x, b.minX, b.maxX);
    target.y = clamp(p.y, b.minY, b.maxY);
    if (reduce) {
      pos.x = target.x;
      pos.y = target.y;
    }
  };
  const goHome = () => setTarget(homePos());

  // 巡回先：本文の右側に余白があればそこ、無ければ画面下部
  function roamPoint() {
    const b = bounds(), s = size();
    const main = $('main').getBoundingClientRect();
    const gutter = innerWidth - main.right;
    if (!isMobile() && gutter > s + 30) return { x: rand(main.right + 10, b.maxX), y: rand(b.minY + 20, b.maxY) };
    const left = isMobile() ? b.minX : Math.max(b.minX, ($('nav').getBoundingClientRect().right || 0) + 10);
    return { x: rand(left, b.maxX), y: rand(Math.max(b.minY, innerHeight * 0.55), b.maxY) };
  }

  // 指定した要素の横（空いている側）へ飛ぶ
  function flyNear(el, scrolled = false) {
    if (!el) return;
    let r = el.getBoundingClientRect();
    // 画面外にあるなら、先にそこまでスクロールしてから飛ぶ
    // 上部（最大で画面の4割ぶん）が見えていなければスクロールが必要
    if (!scrolled && (r.top < 60 || r.top + Math.min(r.height, innerHeight * 0.4) > innerHeight)) {
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      whenSettled(el, () => flyNear(el, true));
      return;
    }
    r = el.getBoundingClientRect();
    const s = size(), b = bounds();
    let x, y = clamp(r.top + r.height / 2 - s / 2, b.minY, b.maxY);
    if (r.right + s + 12 <= innerWidth - 8) x = r.right + 12;
    else if (r.left - s - 12 >= 8) x = r.left - s - 12;
    else {
      x = r.right - s;
      y = r.bottom + 8 + s <= innerHeight ? r.bottom + 8 : r.top - s - 8;
    }
    setTarget({ x, y });
  }

  // スクロールが止まるのを待ってから実行する
  function whenSettled(el, fn) {
    let last = null, same = 0, n = 0, moved = false;
    const tick = () => {
      const top = Math.round(el.getBoundingClientRect().top);
      if (last !== null && top !== last) moved = true;
      same = top === last ? same + 1 : 0;
      last = top;
      // 一度動き出してから止まった（または、しばらく待っても動かない）ら実行
      if ((same >= 2 && (moved || n > 6)) || ++n > 30) fn();
      else setTimeout(tick, 80);
    };
    setTimeout(tick, 80);
  }

  // 吹き出しをドローンの空いている側に置く
  function placeBubble() {
    if (bubble.hidden) return;
    const s = size(), bw = bubble.offsetWidth, bh = bubble.offsetHeight;
    let x, y;
    if (isMobile()) {
      x = (innerWidth - bw) / 2;
      y = pos.y - bh - 6 >= 60 ? pos.y - bh - 6 : pos.y + s + 6;
    } else {
      const roomLeft = pos.x - 8, roomRight = innerWidth - (pos.x + s) - 8;
      x = roomLeft >= bw || roomLeft >= roomRight ? pos.x - bw + s * 0.12 : pos.x + s * 0.88;
      y = pos.y + s * 0.5 - bh * 0.75;
    }
    x = clamp(x, 8, innerWidth - bw - 8);
    y = clamp(y, 64, Math.max(64, innerHeight - bh - 8));
    bubble.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    bubble.classList.toggle('tail-right', !isMobile() && x + bw / 2 < pos.x + s / 2);
  }

  let lastT = performance.now();
  function loop(now) {
    // 経過時間どおりに進める（描画が重くてフレームが少ない端末でも、移動が遅れないように細かく分けて計算する）
    const total = Math.min((now - lastT) / 1000, 0.5);
    lastT = now;
    if (!dragging) {
      // ばね・ダンパーで目標へ近づく（減衰を少しだけ弱くして、着地でわずかに揺れるように）
      const k = 20, c = 8.4;
      const steps = Math.max(1, Math.ceil(total / 0.016)), dt = total / steps;
      for (let i = 0; i < steps; i++) {
        vel.x += ((target.x - pos.x) * k - vel.x * c) * dt;
        vel.y += ((target.y - pos.y) * k - vel.y * c) * dt;
        pos.x += vel.x * dt;
        pos.y += vel.y * dt;
      }
    }
    const moving = Math.hypot(vel.x, vel.y) > 25;
    droneBtn.style.transform = `translate(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px)`;
    droneBtn.classList.toggle('moving', moving && !dragging);
    drone?.setMotion(vel.x, vel.y);
    placeBubble();

    // 巡回：吹き出しが閉じていて、操作が落ち着いているとき
    if (state.roam && !reduce && !state.hidden && bubble.hidden && tourStep < 0 && !dragging && !document.hidden
      && now > nextRoam && now - lastActivity > 3500) {
      setTarget(Math.random() < 0.3 ? homePos() : roamPoint());
      nextRoam = now + rand(14000, 26000);
    }
    // しばらく操作が無ければ、ひとりごと
    if (state.auto && !state.hidden && bubble.hidden && tourStep < 0 && now - lastActivity > 75000 && now - lastIdleTalk > 240000 && !document.hidden) {
      lastIdleTalk = now;
      say(P.pick(P.IDLE), { autoClose: 6000 });
    }
    requestAnimationFrame(loop);
  }

  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => window.addEventListener(ev, () => (lastActivity = performance.now()), { passive: true }));
  window.addEventListener('resize', () => {
    const b = bounds();
    setTarget({ x: clamp(target.x, b.minX, b.maxX), y: clamp(target.y, b.minY, b.maxY) });
  });

  // ---------- ドラッグ / タップ ----------
  let pokes = [];
  droneBtn.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    dragging = { sx: e.clientX, sy: e.clientY, ox: e.clientX - pos.x, oy: e.clientY - pos.y, moved: false, lx: e.clientX, ly: e.clientY, lt: performance.now() };
    droneBtn.setPointerCapture(e.pointerId);
  });
  droneBtn.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    if (!dragging.moved && Math.hypot(e.clientX - dragging.sx, e.clientY - dragging.sy) < 8) return;
    dragging.moved = true;
    droneBtn.classList.add('dragging');
    const b = bounds(), now = performance.now(), dt = Math.max((now - dragging.lt) / 1000, 0.001);
    vel.x = (e.clientX - dragging.lx) / dt;
    vel.y = (e.clientY - dragging.ly) / dt;
    dragging.lx = e.clientX; dragging.ly = e.clientY; dragging.lt = now;
    pos.x = clamp(e.clientX - dragging.ox, b.minX, b.maxX);
    pos.y = clamp(e.clientY - dragging.oy, b.minY, b.maxY);
  });
  const endDrag = (e) => {
    if (!dragging) return;
    const moved = dragging.moved;
    dragging = null;
    droneBtn.classList.remove('dragging');
    if (moved) {
      vel.x = 0;
      vel.y = 0;
      // 置いた場所を新しい定位置にする
      state.home = { rx: pos.x / innerWidth, ry: pos.y / innerHeight };
      save();
      setTarget(pos);
      nextRoam = performance.now() + 30000;
      if (Math.random() < 0.35 && bubble.hidden) say(P.pick(P.LINES.moved), { autoClose: 3000 });
      e?.preventDefault();
    } else {
      onTap();
    }
  };
  droneBtn.addEventListener('pointerup', endDrag);
  droneBtn.addEventListener('pointercancel', () => { dragging = null; droneBtn.classList.remove('dragging'); });
  droneBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTap();
    }
  });

  function onTap() {
    const now = performance.now();
    pokes = pokes.filter((t) => now - t < 2500);
    pokes.push(now);
    if (pokes.length >= 4) {
      pokes = [];
      drone?.setMood('alert', 1.2);
      say(P.pick(P.LINES.poke), { autoClose: 3500 });
      return;
    }
    if (bubble.hidden) menu();
    else close();
  }

  // ================= 話す =================
  function finishTyping() {
    if (!typeTimer) return;
    clearInterval(typeTimer);
    typeTimer = 0;
    text.textContent = text.dataset.full;
    drone?.setTalking(false);
  }

  function say(lines, { acts = [], mood = null, autoClose = 0, anchor = null } = {}) {
    if (state.hidden) {
      mini.classList.add('ping');
      setTimeout(() => mini.classList.remove('ping'), 2400);
      return;
    }
    clearTimeout(closeTimer);
    finishTyping();
    const full = Array.isArray(lines) ? lines.join('\n') : lines;
    bubble.hidden = false;
    text.dataset.full = full;
    actions.replaceChildren(...acts.map((a) =>
      h('button', { type: 'button', class: a.primary ? 'small' : 'ghost small', onclick: a.run }, a.label)));
    if (mood) drone?.setMood(mood, 2.5);
    if (anchor) flyNear(typeof anchor === 'string' ? document.querySelector(anchor) : anchor);
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
    placeBubble();
    if (autoClose) closeTimer = setTimeout(close, autoClose + full.length * 25);
  }

  function close() {
    clearTimeout(closeTimer);
    finishTyping();
    bubble.hidden = true;
    if (!state.intro && !booting) {
      state.intro = true;
      save();
    }
    if (tourStep >= 0) endTour();
    nextRoam = performance.now() + rand(6000, 12000);
  }

  function setHidden(v) {
    if (v) say(P.LINES.hide, { autoClose: 1500 });
    setTimeout(() => {
      state.hidden = v;
      save();
      if (v) close();
      droneBtn.hidden = v;
      mini.hidden = !v;
      if (!v) {
        goHome();
        say(P.pick(P.LINES.restore), { mood: 'happy', autoClose: 3500 });
      }
    }, v ? 1600 : 0);
  }

  // ---------- メニュー（タップしたとき） ----------
  function menu() {
    const acts = [
      { label: 'ヒントをちょうだい', run: tip },
      { label: 'ツアーを見る', run: () => startTour() },
    ];
    if (SAMPLES[page]) acts.unshift({ label: '▶ この画面の例を試す', primary: true, run: async () => { close(); await sendSample(page, SAMPLES[page]); } });
    if (!['identify', 'guide'].includes(page)) acts.push({ label: '迷ったら診断へ', run: () => { location.hash = '#identify'; } });
    if (state.home || Math.hypot(pos.x - homePos().x, pos.y - homePos().y) > 40) acts.push({ label: '定位置に戻る', run: () => { state.home = null; save(); goHome(); close(); } });
    say(P.PAGE_LINES[page] ?? 'どうした、相棒？', { acts });
  }

  function tip() {
    say(P.pick(P.TIPS), { mood: 'happy', acts: [{ label: 'もうひとつ', run: tip }, { label: 'ありがとう', run: close }] });
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
    const step = P.TOUR[tourStep];
    clearFocus();
    bubble.hidden = true;
    if (location.hash.slice(1).split('/')[0] !== step.page) location.hash = '#' + step.page;
    setTimeout(() => {
      const el = document.querySelector(step.selector);
      if (el) {
        el.classList.add('pallas-focus');
        el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      }
      // スクロールが落ち着いてから、要素の横へ飛んで話す
      const speak = () => {
        const last = tourStep === P.TOUR.length - 1;
        say(`${tourStep + 1} / ${P.TOUR.length}　${step.text}`, {
          anchor: el,
          mood: last ? 'happy' : 'talk',
          acts: [
            { label: last ? 'ツアーを終わる' : '次へ ›', primary: true, run: () => (last ? (close(), goHome()) : (tourStep++, showStep())) },
            !last ? { label: 'やめる', run: () => { close(); goHome(); } } : null,
          ].filter(Boolean),
        });
      };
      if (el) whenSettled(el, speak);
      else speak();
    }, 300);
  }

  function endTour() {
    tourStep = -1;
    clearFocus();
  }

  // ---------- ページ移動 ----------
  function onRoute(p) {
    page = p;
    if (booting || tourStep >= 0 || !state.intro) return;
    if (shouldExplain(p)) {
      markSeen(p);
      setTimeout(() => page === p && say(P.PAGE_LINES[p], { autoClose: 7000 }), 400);
    } else if (!bubble.hidden) {
      close();
    }
  }

  // ---------- 出来事への反応（各画面から window の 'pallas' イベントで届く） ----------
  window.addEventListener('pallas', (e) => {
    const d = e.detail ?? {};
    if (tourStep >= 0) return;
    let kind = d.kind;
    if (kind === 'magicFail') kind = ++magicFails >= 2 ? 'magicFailAgain' : 'magicFail';
    if (kind === 'magicFlag') magicFails = 0;
    const lines = P.REACTIONS[kind];
    const msg = lines ? P.pick(lines)(d) : d.text;
    if (!msg) return;
    const acts = [];
    if (d.flag) acts.push({ label: '問題メモに記録', primary: true, run: () => { sendTo('notes', { flag: d.flag }); close(); } });
    acts.push({ label: 'OK', run: close });
    say(msg, { mood: d.mood ?? 'talk', acts, anchor: d.anchor, autoClose: d.flag ? 0 : 6000 });
  });

  // テーマ変更へのひとこと
  new MutationObserver(() => {
    const t = document.documentElement.dataset.theme;
    if (!booting && bubble.hidden && P.LINES.theme[t] && Math.random() < 0.6) say(P.LINES.theme[t], { autoClose: 2500 });
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // ================= 起動 =================
  if (state.hidden) {
    droneBtn.hidden = true;
    mini.hidden = false;
  }
  // 画面外（右下）から飛んでくる
  const h0 = homePos();
  pos.x = reduce ? h0.x : h0.x + size() / 2 < innerWidth / 2 ? -size() - 40 : innerWidth + 40;
  pos.y = reduce ? h0.y : h0.y - 120;
  goHome();
  requestAnimationFrame(loop);

  const bootShown = !$('boot').hidden;
  setTimeout(() => {
    booting = false;
    if (state.hidden) return;
    const hour = new Date().getHours();
    if (!state.intro) {
      say(P.GREETING, {
        mood: 'happy',
        acts: [
          { label: 'ツアーを始める', primary: true, run: startTour },
          { label: 'あとで', run: () => { state.intro = true; save(); say(P.LINES.later, { autoClose: 3500 }); } },
        ],
      });
    } else if (shouldExplain(page)) {
      markSeen(page);
      say(P.PAGE_LINES[page], { autoClose: 7000 });
    } else {
      say(P.pick(hour < 5 ? P.GREETING_NIGHT : P.GREETING_AGAIN), { autoClose: 4000 });
    }
  }, bootShown ? 2700 : 1000);

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
        const s = size();
        drone.lookAt((ev.clientX - (pos.x + s / 2)) / 500, -(ev.clientY - (pos.y + s / 2)) / 500);
      }, { passive: true });
    } catch {
      /* 3D が使えない環境ではアイコン表示のまま */
    }
  };
  if ('requestIdleCallback' in window) requestIdleCallback(load3d, { timeout: 2500 });
  else setTimeout(load3d, 1200);

  return { onRoute, say };
}
