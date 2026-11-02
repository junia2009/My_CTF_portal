// 位置特定アシスタント：EXIF の GPS・OCR（Tesseract.js、端末内で処理）・手がかりの抽出・逆引き検索・チェックリスト
import { readMetadata } from '../lib/exif.js';
import { extractClues, mapLinks, coordLinks, CHECKLIST } from '../lib/geo.js';
import { $, h, store, toast, copy, debounce, fmtSize, setTable, registerReceiver, pallasSay } from './common.js';

const abs = (p) => new URL(p, location.href).href;
const link = (href, label, cls = 'btn ghost small') => h('a', { class: cls, href, target: '_blank', rel: 'noopener' }, label);

export function initGeo() {
  let current = null; // { file, url, bitmap }
  let ocr = null; // { lang, worker }
  let tessLoading = null;

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
    if (current?.url) URL.revokeObjectURL(current.url);
    current = { file, url: URL.createObjectURL(file), bitmap };
    $('geoResult').hidden = false;
    $('geoDrop').querySelector('.dz-main').textContent = `${file.name}（${fmtSize(file.size)}）— 別の画像を選ぶ`;
    $('geoImg').src = current.url;
    $('geoInfo').replaceChildren(h('span', {}, `${bitmap.width} × ${bitmap.height}`), h('span', {}, file.type || '形式不明'));
    $('geoText').value = '';
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

  // ---- ② OCR ----
  async function tesseract() {
    if (window.Tesseract) return window.Tesseract;
    tessLoading ??= new Promise((res, rej) => {
      const s = h('script', { src: 'vendor/tesseract/tesseract.min.js' });
      s.onload = () => res(window.Tesseract);
      s.onerror = rej;
      document.head.append(s);
    });
    return tessLoading;
  }

  // 小さい画像は拡大し、白黒にしてコントラストを上げると読み取りやすい
  function prepare() {
    const b = current.bitmap;
    const pre = $('geoPre').checked;
    const scale = pre ? Math.min(3, Math.max(1, 1600 / Math.max(b.width, b.height))) : 1;
    const c = document.createElement('canvas');
    c.width = Math.round(b.width * scale);
    c.height = Math.round(b.height * scale);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(b, 0, 0, c.width, c.height);
    if (pre) {
      const im = ctx.getImageData(0, 0, c.width, c.height);
      const d = im.data;
      let lo = 255, hi = 0;
      for (let i = 0; i < d.length; i += 4) {
        const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        d[i] = g;
        if (g < lo) lo = g;
        if (g > hi) hi = g;
      }
      const k = 255 / Math.max(1, hi - lo);
      for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = (d[i] - lo) * k;
      ctx.putImageData(im, 0, 0);
    }
    return c;
  }

  const prog = (label, p) => {
    const el = $('geoProg');
    el.hidden = false;
    el.querySelector('i').style.width = `${Math.round((p ?? 0) * 100)}%`;
    el.querySelector('span').textContent = label;
  };

  $('geoOcr').addEventListener('click', async () => {
    if (!current) return;
    const btn = $('geoOcr');
    btn.disabled = true;
    try {
      const T = await tesseract();
      const lang = $('geoLang').value;
      if (!ocr || ocr.lang !== lang) {
        await ocr?.worker.terminate();
        prog('読み取りエンジンを準備中…（初回はデータをダウンロードします）', 0);
        const worker = await T.createWorker(lang, 1, {
          workerPath: abs('vendor/tesseract/worker.min.js'),
          corePath: abs('vendor/tesseract/core'),
          langPath: abs('vendor/tesseract/lang'),
          workerBlobURL: false,
          cacheMethod: 'none',
          logger: (m) => {
            const label = { 'loading tesseract core': 'エンジンを読み込み中', 'loading language traineddata': '言語データを読み込み中', 'initializing api': '初期化中', 'recognizing text': '読み取り中' }[m.status] ?? m.status;
            prog(label, m.progress);
          },
        });
        ocr = { lang, worker };
      }
      prog('読み取り中', 0);
      const { data } = await ocr.worker.recognize(prepare());
      // 日本語は文字の間（漢字と数字の間も）に空白が入りやすいので詰める
      const text = data.text
        .replace(/([　-鿿＀-￯])[ \t]+(?=[　-鿿＀-￯\d])/g, '$1')
        .replace(/(\d)[ \t]+(?=[　-鿿＀-￯])/g, '$1')
        .trim();
      $('geoText').value = text;
      $('geoProg').hidden = true;
      const r = renderClues();
      pallasSay({ kind: 'geoClues', mood: r.clues.length ? 'happy' : 'think', n: r.clues.length, anchor: '#geoClues' });
    } catch (e) {
      $('geoProg').hidden = true;
      toast('読み取りに失敗しました：' + (e?.message ?? e));
    } finally {
      btn.disabled = false;
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
      const c = document.createElement('canvas');
      c.width = current.bitmap.width;
      c.height = current.bitmap.height;
      c.getContext('2d').drawImage(current.bitmap, 0, 0);
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
