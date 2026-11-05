// 位置特定：EXIF の GPS・OCR（PaddleOCR、端末内で処理）・手がかりの抽出・逆引き検索・チェックリスト
import { readMetadata } from '../lib/exif.js';
import { PaddleOCR } from '../lib/paddleocr.js';
import { extractClues, mapLinks, coordLinks, CHECKLIST } from '../lib/geo.js';
import { $, h, store, toast, copy, debounce, fmtSize, setTable, registerReceiver, pallasSay } from './common.js';

const abs = (p) => new URL(p, location.href).href;
const link = (href, label, cls = 'btn ghost small') => h('a', { class: cls, href, target: '_blank', rel: 'noopener' }, label);

export function initGeo() {
  let current = null; // { file, bitmap, rot, sel }

  function dropzone() {
    const zone = $('geoDrop');
    ['dragenter', 'dragover'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove('over'); }));
    zone.addEventListener('drop', (e) => e.dataTransfer.files[0] && load(e.dataTransfer.files[0]));
    $('geoIn').addEventListener('change', (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (f) load(f);
    });
  }

  async function load(file) {
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      toast('画像として読み込めませんでした');
      return;
    }
    current = { file, bitmap, rot: 0, sel: null };
    $('geoResult').hidden = false;
    $('geoDrop').querySelector('.dz-main').textContent = `${file.name}（${fmtSize(file.size)}）— 別の画像を選ぶ`;
    $('geoInfo').replaceChildren(h('span', {}, `${bitmap.width} × ${bitmap.height}`), h('span', {}, file.type || '形式不明'));
    $('geoText').value = '';
    draw();
    renderClues();
    await renderExif(file);
  }

  // ---- ① EXIF ----
  async function renderExif(file) {
    const out = $('geoExif');
    const m = await readMetadata(new Uint8Array(await file.arrayBuffer()));
    const pick = (n) => m.entries.find((e) => e.name === n)?.value;
    const rows = [['撮影日時', pick('DateTimeOriginal') ?? pick('DateTime')], ['機種', [pick('Make'), pick('Model')].filter(Boolean).join(' ')], ['ソフトウェア', pick('Software')], ['コメント', pick('UserComment') ?? pick('Comment') ?? pick('ImageDescription')]].filter(([, v]) => v);
    out.replaceChildren(
      m.gps
        ? h('div', { class: 'alert ok' }, `GPS 座標が残っています：${m.gps.lat.toFixed(6)}, ${m.gps.lon.toFixed(6)}`,
            link(coordLinks(m.gps.lat, m.gps.lon).google, 'Google マップで開く', 'btn small'), link(coordLinks(m.gps.lat, m.gps.lon).osm, 'OpenStreetMap'))
        : h('p', { class: 'hint' }, 'GPS 座標はありません（SNS などに上げた画像や、CTF の問題画像では消されていることが多いです）。写っている文字や景色から探しましょう。'),
      rows.length ? h('table', { class: 'kv' }, ...rows.map(([k, v]) => h('tr', {}, h('th', {}, k), h('td', {}, v)))) : '',
    );
    if (m.gps) pallasSay({ kind: 'geoGps', mood: 'happy', anchor: '#geoExif' });
  }

  // ---- 画像の表示（回転を反映）と範囲選択 ----
  function draw() {
    const b = current.bitmap, rot = current.rot;
    const c = $('geoCanvas');
    const swap = rot % 180 !== 0;
    c.width = swap ? b.height : b.width;
    c.height = swap ? b.width : b.height;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.save();
    x.translate(c.width / 2, c.height / 2);
    x.rotate((rot * Math.PI) / 180);
    x.drawImage(b, -b.width / 2, -b.height / 2);
    x.restore();
    current.sel = null;
    $('geoSel').hidden = true;
    $('geoBoxes').replaceChildren();
  }
  const rotate = (d) => {
    if (!current) return;
    current.rot = (current.rot + d + 360) % 360;
    draw();
  };
  $('geoRotL').addEventListener('click', () => rotate(-90));
  $('geoRotR').addEventListener('click', () => rotate(90));
  $('geoClearSel').addEventListener('click', () => {
    if (!current) return;
    current.sel = null;
    $('geoSel').hidden = true;
  });

  // 画面上の座標 → 画像上の座標
  const toImage = (ev) => {
    const c = $('geoCanvas'), r = c.getBoundingClientRect();
    return { x: Math.max(0, Math.min(c.width, ((ev.clientX - r.left) / r.width) * c.width)), y: Math.max(0, Math.min(c.height, ((ev.clientY - r.top) / r.height) * c.height)) };
  };
  const place = (el, b) => {
    const c = $('geoCanvas');
    Object.assign(el.style, { left: `${(b.x0 / c.width) * 100}%`, top: `${(b.y0 / c.height) * 100}%`, width: `${((b.x1 - b.x0) / c.width) * 100}%`, height: `${((b.y1 - b.y0) / c.height) * 100}%` });
  };
  let dragStart = null;
  const stage = $('geoStage');
  stage.addEventListener('pointerdown', (e) => {
    if (!current || e.target.closest('.geo-box')) return;
    dragStart = toImage(e);
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (!dragStart) return;
    const p = toImage(e);
    const b = { x0: Math.min(dragStart.x, p.x), y0: Math.min(dragStart.y, p.y), x1: Math.max(dragStart.x, p.x), y1: Math.max(dragStart.y, p.y) };
    if (b.x1 - b.x0 < 8 || b.y1 - b.y0 < 8) return;
    current.sel = b;
    $('geoSel').hidden = false;
    place($('geoSel'), b);
  });
  stage.addEventListener('pointerup', () => (dragStart = null));
  stage.addEventListener('pointercancel', () => (dragStart = null));

  // ---- ② OCR（PaddleOCR） ----
  let engine = null, engineLoading = null;
  async function getEngine() {
    if (engine) return engine;
    engineLoading ??= (async () => {
      const ort = await import('../../vendor/onnxruntime/ort.wasm.min.mjs');
      ort.env.wasm.wasmPaths = abs('vendor/onnxruntime/');
      // GitHub Pages ではクロスオリジン分離ができないため、マルチスレッドは使えない
      ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
      engine = await PaddleOCR.create(ort, {
        detUrl: abs('vendor/paddleocr/PP-OCRv5_mobile_det_infer.ort'),
        recUrl: abs('vendor/paddleocr/PP-OCRv5_mobile_rec_infer.onnx'),
        dictUrl: abs('vendor/paddleocr/ppocrv5_dict.txt'),
        onProgress: prog,
      });
      return engine;
    })();
    try {
      return await engineLoading;
    } catch (e) {
      engineLoading = null;
      throw e;
    }
  }

  const prog = (label, p) => {
    const el = $('geoProg');
    el.hidden = false;
    el.querySelector('i').style.width = `${Math.round((p ?? 0) * 100)}%`;
    el.querySelector('span').textContent = label;
  };

  // 読み取る範囲を取り出す。小さい範囲は拡大して、検出しやすい大きさにする
  function region() {
    const c = $('geoCanvas');
    const s = current.sel ?? { x0: 0, y0: 0, x1: c.width, y1: c.height };
    const w = Math.round(s.x1 - s.x0), hh = Math.round(s.y1 - s.y0);
    const scale = current.sel ? Math.min(4, Math.max(1, 960 / Math.max(w, hh))) : 1;
    const out = document.createElement('canvas');
    out.width = Math.round(w * scale);
    out.height = Math.round(hh * scale);
    const x = out.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingQuality = 'high';
    x.drawImage(c, s.x0, s.y0, w, hh, 0, 0, out.width, out.height);
    return { img: { width: out.width, height: out.height, data: x.getImageData(0, 0, out.width, out.height).data }, ox: s.x0, oy: s.y0, scale };
  }

  function showBoxes(items, r) {
    $('geoBoxes').replaceChildren(...items.map((it) => {
      const el = h('button', { type: 'button', class: 'geo-box', title: `${it.text}（確信度 ${Math.round(it.conf * 100)}%）クリックでコピー`, onclick: () => copy(it.text) }, h('span', {}, it.text));
      place(el, { x0: r.ox + it.x0 / r.scale, y0: r.oy + it.y0 / r.scale, x1: r.ox + it.x1 / r.scale, y1: r.oy + it.y1 / r.scale });
      if (it.conf < 0.8) el.classList.add('low');
      return el;
    }));
  }

  $('geoOcr').addEventListener('click', async () => {
    if (!current) return;
    const btn = $('geoOcr');
    btn.disabled = true;
    try {
      const ocr = await getEngine();
      prog('文字の場所を探しています', 0);
      const r = region();
      const res = await ocr.read(r.img, { onProgress: prog });
      showBoxes(res.items, r);
      $('geoText').value = res.lines.join('\n');
      $('geoProg').hidden = true;
      const c = renderClues();
      if (!res.items.length) toast('文字が見つかりませんでした。看板の部分を囲んで、もう一度試してください');
      pallasSay({ kind: 'geoClues', mood: c.clues.length ? 'happy' : 'think', n: c.clues.length, anchor: '#geoClues' });
    } catch (e) {
      $('geoProg').hidden = true;
      toast('読み取りに失敗しました：' + (e?.message ?? e));
    } finally {
      btn.disabled = false;
    }
  });

  $('geoPaste').addEventListener('click', async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (!t.trim()) return toast('クリップボードに文字がありません');
      $('geoText').value = ($('geoText').value ? $('geoText').value + '\n' : '') + t.trim();
      renderClues();
    } catch {
      toast('この端末ではクリップボードを読めません。文字欄に直接貼り付けてください');
    }
  });

  // ---- 手がかり ----
  function renderClues() {
    const r = extractClues($('geoText').value);
    $('geoHints').replaceChildren(...r.hints.map((x) => h('div', { class: 'alert ok' }, x)));
    if (!r.clues.length) {
      $('geoClues').replaceChildren(h('tr', {}, h('td', { class: 'hint' }, $('geoText').value.trim() ? '地図で調べられる手がかりは見つかりませんでした。景色の特徴（チェックリスト）から絞り込みましょう。' : 'まだ文字がありません。「読み取る」を押すか、看板の文字を手で書き込んでください。')));
      return r;
    }
    setTable($('geoClues'), ['種類', '内容', '補足', '地図で調べる'], r.clues.map((c) => {
      const links = c.coords ? coordLinks(c.coords.lat, c.coords.lon) : mapLinks(c.query);
      return h('tr', {},
        h('td', { class: 'num' }, c.type),
        h('td', { class: 'copyable', onclick: () => copy(c.value) }, c.value),
        h('td', { class: 'hint' }, c.note ?? ''),
        h('td', { class: 'actions' }, link(links.google, 'Google マップ', 'btn small'), link(links.osm, 'OSM'), c.extra ? link(c.extra.url, c.extra.label) : ''),
      );
    }));
    return r;
  }
  $('geoText').addEventListener('input', debounce(renderClues, 300));

  const syncQuery = () => {
    const q = $('geoQuery').value.trim() || '日本';
    const l = mapLinks(q);
    $('geoQGoogle').href = l.google;
    $('geoQOsm').href = l.osm;
  };
  $('geoQuery').addEventListener('input', syncQuery);
  syncQuery();

  // ---- ④ 逆引き検索：画像をクリップボードへ ----
  $('geoCopy').addEventListener('click', async () => {
    if (!current) return;
    try {
      const c = $('geoCanvas');
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast('画像をコピーしました。検索サービスで貼り付けてください');
    } catch {
      toast('この端末では画像のコピーができません。各サービスでファイルをアップロードしてください');
    }
  });

  // ---- ⑤ チェックリスト ----
  const KEY = 'ctfportal.geoChecklist';
  const state = store.get(KEY, { checked: [], memo: '' });
  function renderChecklist() {
    $('geoCheck').replaceChildren(...CHECKLIST.map(([cat, items]) =>
      h('div', { class: 'geo-check-group' },
        h('div', { class: 'geo-check-cat' }, cat),
        ...items.map((it) => {
          const id = `${cat}:${it}`;
          const cb = h('input', { type: 'checkbox', onchange: (e) => { state.checked = e.target.checked ? [...new Set([...state.checked, id])] : state.checked.filter((x) => x !== id); store.set(KEY, state); } });
          cb.checked = state.checked.includes(id);
          return h('label', { class: 'check geo-item' }, cb, it);
        }),
      )));
    $('geoMemo').value = state.memo;
  }
  $('geoMemo').addEventListener('input', debounce(() => { state.memo = $('geoMemo').value; store.set(KEY, state); }, 300));
  $('geoCheckReset').addEventListener('click', () => {
    state.checked = [];
    state.memo = '';
    store.set(KEY, state);
    renderChecklist();
  });
  renderChecklist();

  dropzone();
  registerReceiver('geo', (f) => load(f));
}
