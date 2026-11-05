// 画像解析（ビットプレーン・LSB・メタデータ・QR）と音声解析（スペクトログラム）
import { bitPlane, channelOnly, extractBits } from '../lib/stego.js';
import { readMetadata } from '../lib/exif.js';
import { identifyType, hexdump } from '../lib/file.js';
import { latin1Decode, bytesToHex, printableRatio } from '../lib/codecs.js';
import { flagRegex } from '../lib/magic.js';
import { spectrogram } from '../lib/fft.js';
import { $, h, copy, toast, download, fmtSize, getPrefixes, setTable, registerReceiver, sendTo, pallasSay } from './common.js';

const CH_NAMES = ['R', 'G', 'B', 'A'];

function dropzone(zoneId, inputId, onFile) {
  const zone = $(zoneId);
  ['dragenter', 'dragover'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove('over'); }));
  zone.addEventListener('drop', (e) => e.dataTransfer.files[0] && onFile(e.dataTransfer.files[0]));
  $(inputId).addEventListener('change', (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) onFile(f);
  });
}

const canvasFrom = (rgba, w, hgt) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = hgt;
  c.getContext('2d').putImageData(new ImageData(rgba, w, hgt), 0, 0);
  return c;
};

// ================= 画像解析 =================
export function initImage() {
  let img = null; // { name, bytes, w, h, rgba }
  let lsbBytes = null;
  let qrLoaded = null;

  async function load(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let bmp;
    try {
      bmp = await createImageBitmap(new Blob([bytes], { type: file.type || 'image/png' }));
    } catch {
      toast('画像として読み込めませんでした（ファイル解析で中身を確認してみてください）');
      return;
    }
    const c = document.createElement('canvas');
    c.width = bmp.width;
    c.height = bmp.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0);
    img = { name: file.name, bytes, w: bmp.width, h: bmp.height, rgba: ctx.getImageData(0, 0, bmp.width, bmp.height).data };
    const hasAlpha = img.rgba.some((v, i) => i % 4 === 3 && v !== 255);
    $('imgResult').hidden = false;
    $('imgDrop').querySelector('.dz-main').textContent = `${file.name}（${fmtSize(bytes.length)}）— 別の画像を選ぶ`;
    $('imgInfo').replaceChildren(
      h('span', {}, `${img.w} × ${img.h}`),
      h('span', {}, identifyType(bytes)?.name ?? '形式不明'),
      h('span', {}, hasAlpha ? 'アルファあり' : 'アルファなし'),
    );
    showMain(canvasFrom(new Uint8ClampedArray(img.rgba), img.w, img.h), '元の画像');
    renderPlanes(hasAlpha);
    renderMeta();
    $('qrOut').replaceChildren();
    $('lsbScanOut').replaceChildren();
    $('lsbOut').textContent = '';
    $('lsbInfo').textContent = '';
  }

  function showMain(canvas, title) {
    const main = $('planeCanvas');
    main.width = canvas.width;
    main.height = canvas.height;
    main.getContext('2d').drawImage(canvas, 0, 0);
    $('planeTitle').textContent = title;
  }

  function renderPlanes(hasAlpha) {
    const grid = $('planeGrid');
    grid.replaceChildren();
    const chans = hasAlpha ? [0, 1, 2, 3] : [0, 1, 2];
    const scale = Math.min(1, 140 / Math.max(img.w, img.h));
    const tw = Math.max(1, Math.round(img.w * scale)), th = Math.max(1, Math.round(img.h * scale));
    // チャンネルごとに少しずつ描いて、画面が固まらないようにする
    chans.forEach((ch, ci) => setTimeout(() => {
      const row = h('div', { class: 'plane-row' }, h('div', { class: `plane-ch ch${ch}` }, CH_NAMES[ch]));
      const items = [{ label: '全体', make: () => channelOnly(img.rgba, ch) }, ...[7, 6, 5, 4, 3, 2, 1, 0].map((bit) => ({ label: `bit ${bit}`, bit, make: () => bitPlane(img.rgba, ch, bit) }))];
      for (const it of items) {
        const full = canvasFrom(it.make(), img.w, img.h);
        const thumb = document.createElement('canvas');
        thumb.width = tw;
        thumb.height = th;
        const tctx = thumb.getContext('2d');
        tctx.imageSmoothingEnabled = false;
        tctx.drawImage(full, 0, 0, tw, th);
        const title = `${CH_NAMES[ch]} ${it.label}`;
        row.append(h('button', { type: 'button', class: `plane-item${it.bit !== undefined && it.bit <= 1 ? ' low' : ''}`, title, onclick: () => showMain(full, title) }, thumb, h('span', {}, it.label)));
      }
      grid.append(row);
    }, ci * 30));
  }

  $('planeOrig').addEventListener('click', () => img && showMain(canvasFrom(new Uint8ClampedArray(img.rgba), img.w, img.h), '元の画像'));
  $('planeSave').addEventListener('click', () => $('planeCanvas').toBlob((b) => b && b.arrayBuffer().then((ab) => download(new Uint8Array(ab), `${$('planeTitle').textContent.replace(/\s+/g, '_')}.png`))));

  // ---- LSB ----
  const describe = (bytes) => {
    const head = bytes.subarray(0, 96);
    const ratio = printableRatio(head);
    const text = latin1Decode(bytes.subarray(0, 4096));
    const flag = text.match(flagRegex(getPrefixes()))?.[0] ?? null;
    const type = identifyType(bytes);
    return { ratio, flag, type, preview: latin1Decode(head).replace(/[^\x20-\x7e]/g, '·') };
  };

  $('lsbScan').addEventListener('click', () => {
    if (!img) return;
    const hits = [];
    for (const channels of ['RGB', 'BGR', 'RGBA', 'R', 'G', 'B']) {
      for (const bits of [[0], [1], [1, 0]]) {
        for (const order of ['row', 'col']) {
          for (const msbFirst of [true, false]) {
            const out = extractBits(img.rgba, img.w, img.h, { channels, bits, order, msbFirst, maxBytes: 4096 });
            const d = describe(out);
            if (d.flag || d.type || d.ratio > 0.9) hits.push({ channels, bits, order, msbFirst, ...d, score: (d.flag ? 100 : 0) + (d.type ? 50 : 0) + d.ratio * 10 });
          }
        }
      }
    }
    hits.sort((a, b) => b.score - a.score);
    if (!hits.length) {
      $('lsbScanOut').replaceChildren(h('tr', {}, h('td', { class: 'hint' }, 'それらしいデータは見つかりませんでした。ビットプレーンの見た目や、メタデータも確認しましょう。')));
      return;
    }
    setTable($('lsbScanOut'), ['条件', '先頭', ''], hits.slice(0, 12).map((x) =>
      h('tr', { class: x.flag || x.type ? 'hl' : '' },
        h('td', { class: 'num' }, `${x.channels} / bit ${x.bits.join(',')} / ${x.order === 'row' ? '横' : '縦'} / ${x.msbFirst ? '上位から' : '下位から'}`),
        h('td', {}, x.flag ? h('b', { class: 'flag-hit' }, x.flag) : x.preview.slice(0, 60), x.type ? h('span', { class: 'tag warn' }, x.type.name) : ''),
        h('td', { class: 'num' }, h('button', {
          type: 'button', class: 'ghost small',
          onclick: () => {
            $('lsbCh').value = x.channels;
            $('lsbBits').value = x.bits.join(',');
            $('lsbOrder').value = x.order;
            $('lsbMsb').value = x.msbFirst ? '1' : '0';
            runLsb();
          },
        }, '開く')),
      ),
    ));
    const best = hits.find((x) => x.flag);
    if (best) pallasSay({ kind: 'imageFlag', mood: 'happy', flag: best.flag, where: `LSB（${best.channels} / bit ${best.bits.join(',')}）`, anchor: '#lsbScanOut' });
  });

  function runLsb() {
    if (!img) return;
    lsbBytes = extractBits(img.rgba, img.w, img.h, {
      channels: $('lsbCh').value,
      bits: $('lsbBits').value.split(',').map(Number),
      order: $('lsbOrder').value,
      msbFirst: $('lsbMsb').value === '1',
    });
    const d = describe(lsbBytes);
    $('lsbInfo').replaceChildren(
      h('span', {}, fmtSize(lsbBytes.length)),
      h('span', {}, `先頭の表示可能率 ${Math.round(d.ratio * 100)}%`),
      d.type ? h('span', { class: 'accent' }, `形式: ${d.type.name}`) : '',
      d.flag ? h('b', { class: 'flag-hit copyable', onclick: () => copy(d.flag) }, d.flag) : '',
    );
    $('lsbOut').textContent = hexdump(lsbBytes, 0, 2048);
  }
  $('lsbRun').addEventListener('click', runLsb);
  $('lsbSave').addEventListener('click', () => lsbBytes && download(lsbBytes, `${img.name}.lsb.bin`));
  $('lsbToCodec').addEventListener('click', () => lsbBytes && sendTo('codec', { hex: bytesToHex(lsbBytes.subarray(0, 65536)), magic: true }));

  // ---- メタデータ ----
  async function renderMeta() {
    const out = $('metaOut');
    const m = await readMetadata(img.bytes);
    if (!m.entries.length) {
      out.replaceChildren(h('p', { class: 'hint' }, 'メタデータは見つかりませんでした（SNS などに上げた画像は削除されていることが多いです）。'));
      return;
    }
    const re = flagRegex(getPrefixes());
    out.replaceChildren(
      m.gps ? h('div', { class: 'alert ok' }, `位置情報があります：緯度 ${m.gps.lat.toFixed(6)} / 経度 ${m.gps.lon.toFixed(6)}`,
        h('a', { class: 'btn ghost small', href: `https://www.openstreetmap.org/?mlat=${m.gps.lat}&mlon=${m.gps.lon}#map=16/${m.gps.lat}/${m.gps.lon}`, target: '_blank', rel: 'noopener' }, '地図で開く')) : '',
      h('table', { class: 'list' },
        h('tr', {}, h('th', {}, '分類'), h('th', {}, '項目'), h('th', {}, '値')),
        ...m.entries.map((e) => h('tr', { class: re.test(e.value) ? 'hl' : '' },
          h('td', { class: 'num' }, e.group), h('td', { class: 'num' }, e.name),
          h('td', { class: 'copyable', onclick: () => copy(e.value) }, e.value.length > 500 ? e.value.slice(0, 500) + '…' : e.value))),
      ),
    );
    const f = m.entries.map((e) => e.value.match(re)?.[0]).find(Boolean);
    if (f) pallasSay({ kind: 'imageFlag', mood: 'happy', flag: f, where: 'メタデータ', anchor: '#metaOut' });
  }

  // ---- QR ----
  async function loadQr() {
    if (window.jsQR) return window.jsQR;
    qrLoaded ??= new Promise((res, rej) => {
      const s = h('script', { src: 'vendor/jsqr/jsQR.js' });
      s.onload = () => res(window.jsQR);
      s.onerror = rej;
      document.head.append(s);
    });
    return qrLoaded;
  }
  $('qrRun').addEventListener('click', async () => {
    if (!img) return;
    const out = $('qrOut');
    out.replaceChildren(h('p', { class: 'hint' }, 'READING…'));
    let jsQR;
    try {
      jsQR = await loadQr();
    } catch {
      out.replaceChildren(h('p', { class: 'error' }, 'QR の読み取り部品を読み込めませんでした'));
      return;
    }
    const tries = [['元の画像', img.rgba], ['白黒反転', img.rgba.map((v, i) => (i % 4 === 3 ? v : 255 - v))]];
    for (const ch of [0, 1, 2]) for (const bit of [0, 1]) tries.push([`${CH_NAMES[ch]} bit ${bit}`, bitPlane(img.rgba, ch, bit)]);
    for (const [label, data] of tries) {
      const r = jsQR(new Uint8ClampedArray(data), img.w, img.h, { inversionAttempts: 'attemptBoth' });
      if (r?.data) {
        out.replaceChildren(
          h('div', { class: 'alert ok' }, `QR コードを読み取りました（${label}）`),
          h('div', { class: 'mono-out', onclick: () => copy(r.data) }, r.data),
          h('div', { class: 'row' },
            h('button', { type: 'button', class: 'ghost small', onclick: () => sendTo('identify', { text: r.data }) }, '迷ったら診断へ'),
            h('button', { type: 'button', class: 'ghost small', onclick: () => sendTo('codec', { text: r.data, magic: true }) }, 'エンコード・デコードへ'),
          ),
        );
        const f = r.data.match(flagRegex(getPrefixes()))?.[0];
        pallasSay(f ? { kind: 'imageFlag', mood: 'happy', flag: f, where: 'QR コード', anchor: '#qrOut' } : { kind: 'qrRead', mood: 'talk', anchor: '#qrOut' });
        return;
      }
    }
    out.replaceChildren(h('p', { class: 'hint' }, 'QR コードは見つかりませんでした。一部が欠けている・傾いている場合は、ビットプレーンで形を確認してみましょう。'));
  });

  $('imgToGeo').addEventListener('click', () => img && sendTo('geo', new File([img.bytes], img.name, { type: 'image/' + (identifyType(img.bytes)?.ext === 'jpg' ? 'jpeg' : identifyType(img.bytes)?.ext ?? 'png') })));
  dropzone('imgDrop', 'imgIn', load);
  registerReceiver('image', (f) => load(f));
}

// ================= 音声解析 =================
export function initAudio() {
  let buf = null; // AudioBuffer
  let url = null;

  async function load(file) {
    const ab = await file.arrayBuffer();
    // WAV ならヘッダの本来のサンプリング周波数のままデコードする（変換されると周波数の目盛りがずれるため）
    const head = new DataView(ab, 0, Math.min(ab.byteLength, 44));
    let rate = 44100;
    if (ab.byteLength >= 28 && head.getUint32(0, false) === 0x52494646 && head.getUint32(8, false) === 0x57415645) {
      const r = head.getUint32(24, true);
      if (r >= 3000 && r <= 384000) rate = r;
    }
    try {
      const ctx = new OfflineAudioContext(1, 1, rate);
      buf = await ctx.decodeAudioData(ab.slice(0));
    } catch {
      toast('音声として読み込めませんでした（この端末が対応していない形式かもしれません）');
      return;
    }
    $('audResult').hidden = false;
    $('audDrop').querySelector('.dz-main').textContent = `${file.name}（${fmtSize(file.size)}）— 別のファイルを選ぶ`;
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(file);
    $('audPlayer').src = url;
    $('audInfo').replaceChildren(
      h('span', {}, `${buf.duration.toFixed(2)} 秒`),
      h('span', {}, `${buf.sampleRate} Hz`),
      h('span', {}, `${buf.numberOfChannels} ch`),
    );
    $('audCh').replaceChildren(
      ...(buf.numberOfChannels > 1 ? [h('option', { value: 'mix' }, '合成')] : []),
      ...Array.from({ length: buf.numberOfChannels }, (_, i) => h('option', { value: String(i) }, buf.numberOfChannels === 2 ? (i ? '右' : '左') : `ch ${i + 1}`)),
    );
    render();
    pallasSay({ kind: 'audioLoaded', mood: 'talk', anchor: '#audCanvas' });
  }

  function samples() {
    const ch = $('audCh').value;
    if (ch !== 'mix') return buf.getChannelData(Number(ch));
    const out = new Float32Array(buf.length);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < d.length; i++) out[i] += d[i] / buf.numberOfChannels;
    }
    return out;
  }

  // 暗い紺 → テーマ色 → 白 のカラーマップ
  function colormap() {
    const css = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#36e6ff';
    const m = css.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    const acc = m ? m.slice(1).map((x) => parseInt(x, 16)) : [54, 230, 255];
    const stops = [[0, [4, 8, 15]], [0.35, [20, 40, 90]], [0.7, acc], [1, [255, 255, 255]]];
    const lut = new Uint8Array(256 * 3);
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      let k = 0;
      while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
      const [t0, c0] = stops[k], [t1, c1] = stops[k + 1];
      const u = (t - t0) / (t1 - t0);
      for (let j = 0; j < 3; j++) lut[i * 3 + j] = Math.round(c0[j] + (c1[j] - c0[j]) * u);
    }
    return lut;
  }

  function render() {
    if (!buf) return;
    const fftSize = Number($('audFft').value);
    const sp = spectrogram(samples(), { fftSize, maxFrames: 2400 });
    const H = 512, W = sp.frames;
    const c = $('audCanvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    const im = ctx.createImageData(W, H);
    const lut = colormap();
    const range = Number($('audGain').value);
    const floor = sp.max - range;
    const log = $('audScale').value === 'log';
    const nyq = buf.sampleRate / 2, fmin = 20;
    for (let y = 0; y < H; y++) {
      const r = 1 - y / (H - 1);
      const freq = log ? fmin * (nyq / fmin) ** r : r * nyq;
      const bin = Math.min(sp.bins - 1, Math.round((freq / nyq) * (sp.bins - 1)));
      for (let x = 0; x < W; x++) {
        const v = Math.max(0, Math.min(1, (sp.data[x * sp.bins + bin] - floor) / range));
        const i = Math.round(v * 255) * 3, p = (y * W + x) * 4;
        im.data[p] = lut[i];
        im.data[p + 1] = lut[i + 1];
        im.data[p + 2] = lut[i + 2];
        im.data[p + 3] = 255;
      }
    }
    ctx.putImageData(im, 0, 0);
    $('audAxis').replaceChildren(
      h('span', { class: 'ax-top' }, `${(nyq / 1000).toFixed(1)} kHz`),
      h('span', { class: 'ax-bottom' }, log ? `${fmin} Hz` : '0 Hz'),
      h('span', { class: 'ax-right' }, `${buf.duration.toFixed(1)} 秒`),
    );
  }

  for (const id of ['audFft', 'audScale', 'audCh']) $(id).addEventListener('change', render);
  $('audGain').addEventListener('change', render);
  $('audSave').addEventListener('click', () => $('audCanvas').toBlob((b) => b && b.arrayBuffer().then((ab) => download(new Uint8Array(ab), 'spectrogram.png'))));
  dropzone('audDrop', 'audIn', load);
  registerReceiver('audio', (f) => load(f));
}

