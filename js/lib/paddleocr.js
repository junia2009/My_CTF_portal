// PaddleOCR（PP-OCRv5 mobile）をブラウザで動かす：文字の検出（DB）→ 文字の認識（CTC）
// 画像は { width, height, data: RGBA の Uint8ClampedArray } で受け取る。モデルの実行には onnxruntime-web を使う

const DET_MEAN = [0.485, 0.456, 0.406], DET_STD = [0.229, 0.224, 0.225];

// ---------- 画像の基本操作 ----------
function resizeRGBA(src, w, h) {
  // 双線形補間で縮小・拡大
  const out = new Uint8ClampedArray(w * h * 4);
  const sx = src.width / w, sy = src.height / h;
  for (let y = 0; y < h; y++) {
    const fy = Math.max(0, (y + 0.5) * sy - 0.5), y0 = Math.floor(fy), y1 = Math.min(src.height - 1, y0 + 1), wy = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.max(0, (x + 0.5) * sx - 0.5), x0 = Math.floor(fx), x1 = Math.min(src.width - 1, x0 + 1), wx = fx - x0;
      const i00 = (y0 * src.width + x0) * 4, i01 = (y0 * src.width + x1) * 4, i10 = (y1 * src.width + x0) * 4, i11 = (y1 * src.width + x1) * 4;
      const o = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        out[o + c] = (src.data[i00 + c] * (1 - wx) + src.data[i01 + c] * wx) * (1 - wy) + (src.data[i10 + c] * (1 - wx) + src.data[i11 + c] * wx) * wy;
      }
      out[o + 3] = 255;
    }
  }
  return { width: w, height: h, data: out };
}

function crop(src, x0, y0, w, h) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(src.height - 1, Math.max(0, y0 + y));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(src.width - 1, Math.max(0, x0 + x));
      const i = (sy * src.width + sx) * 4, o = (y * w + x) * 4;
      out[o] = src.data[i]; out[o + 1] = src.data[i + 1]; out[o + 2] = src.data[i + 2]; out[o + 3] = 255;
    }
  }
  return { width: w, height: h, data: out };
}

// 反時計回りに 90° 回す（縦書きの領域を横向きにして読むため）
function rotate90(src) {
  const w = src.height, h = src.width;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const i = (y * src.width + x) * 4, o = ((src.width - 1 - x) * w + y) * 4;
      out[o] = src.data[i]; out[o + 1] = src.data[i + 1]; out[o + 2] = src.data[i + 2]; out[o + 3] = 255;
    }
  }
  return { width: w, height: h, data: out };
}

// RGBA → BGR の NCHW（PaddleOCR は OpenCV で読んだ BGR の並びで学習している）
function toTensorBGR(img, mean, std, scale = 1 / 255) {
  const { width: w, height: h, data } = img;
  const t = new Float32Array(3 * w * h);
  const plane = w * h;
  for (let i = 0; i < plane; i++) {
    const p = i * 4;
    t[i] = (data[p + 2] * scale - mean[0]) / std[0];
    t[plane + i] = (data[p + 1] * scale - mean[1]) / std[1];
    t[2 * plane + i] = (data[p] * scale - mean[2]) / std[2];
  }
  return t;
}

// ---------- 文字の検出（DB の後処理） ----------
export function dbPostprocess(prob, w, h, { thresh = 0.3, boxThresh = 0.5, unclip = 1.6, minSize = 3 } = {}) {
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = prob[i] > thresh ? 1 : 0;
  const seen = new Uint8Array(w * h);
  const boxes = [];
  const stack = new Int32Array(w * h);
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || seen[start]) continue;
    let sp = 0, n = 0, sum = 0, minx = w, miny = h, maxx = 0, maxy = 0;
    stack[sp++] = start;
    seen[start] = 1;
    while (sp) {
      const i = stack[--sp];
      const x = i % w, y = (i / w) | 0;
      n++;
      sum += prob[i];
      if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
      if (x > 0 && mask[i - 1] && !seen[i - 1]) { seen[i - 1] = 1; stack[sp++] = i - 1; }
      if (x < w - 1 && mask[i + 1] && !seen[i + 1]) { seen[i + 1] = 1; stack[sp++] = i + 1; }
      if (y > 0 && mask[i - w] && !seen[i - w]) { seen[i - w] = 1; stack[sp++] = i - w; }
      if (y < h - 1 && mask[i + w] && !seen[i + w]) { seen[i + w] = 1; stack[sp++] = i + w; }
    }
    const bw = maxx - minx + 1, bh = maxy - miny + 1;
    if (Math.min(bw, bh) < minSize || sum / n < boxThresh) continue;
    // 文字の中心部分だけが検出されるので、面積 × 比率 ÷ 周長 だけ外側へ広げる
    const d = (bw * bh * unclip) / (2 * (bw + bh));
    boxes.push({ x0: minx - d, y0: miny - d, x1: maxx + 1 + d, y1: maxy + 1 + d, score: sum / n });
  }
  return boxes;
}

// ---------- 文字の認識（CTC の読み取り） ----------
export function ctcDecode(logits, steps, classes, chars) {
  let text = '', last = -1, confSum = 0, count = 0;
  for (let t = 0; t < steps; t++) {
    let best = 0, bestV = -Infinity;
    const off = t * classes;
    for (let c = 0; c < classes; c++) {
      const v = logits[off + c];
      if (v > bestV) { bestV = v; best = c; }
    }
    if (best !== 0 && best !== last) {
      text += chars[best] ?? '';
      confSum += bestV;
      count++;
    }
    last = best;
  }
  return { text, conf: count ? confSum / count : 0 };
}

// 行ごとにまとめて、上から下・左から右の順に並べる
export function orderLines(items) {
  const sorted = [...items].sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2);
  const lines = [];
  for (const it of sorted) {
    const cy = (it.y0 + it.y1) / 2, hh = it.y1 - it.y0;
    const line = lines.find((l) => Math.abs(l.cy - cy) < Math.min(l.h, hh) * 0.5);
    if (line) {
      line.items.push(it);
      line.cy = (line.cy * (line.items.length - 1) + cy) / line.items.length;
    } else lines.push({ cy, h: hh, items: [it] });
  }
  return lines.map((l) => l.items.sort((a, b) => a.x0 - b.x0).reduce((s, it) => {
    if (!s) return it.text;
    const needSpace = /[A-Za-z0-9]$/.test(s) && /^[A-Za-z0-9]/.test(it.text);
    return s + (needSpace ? ' ' : ' ') + it.text;
  }, ''));
}

// ---------- 全体 ----------
export class PaddleOCR {
  static async create(ort, { detUrl, recUrl, dictUrl, onProgress } = {}) {
    const fetchBuf = async (url, label) => {
      onProgress?.(`${label}を読み込み中`, 0);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${label}を読み込めませんでした（${res.status}）`);
      return new Uint8Array(await res.arrayBuffer());
    };
    const [det, rec, dict] = await Promise.all([fetchBuf(detUrl, '検出モデル'), fetchBuf(recUrl, '認識モデル'), fetch(dictUrl).then((r) => r.text())]);
    onProgress?.('モデルを準備中', 0.5);
    const opts = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' };
    const self = new PaddleOCR();
    self.ort = ort;
    self.det = await ort.InferenceSession.create(det, opts);
    self.rec = await ort.InferenceSession.create(rec, opts);
    // 配布されている辞書には空行が紛れているので除く（残すと、それ以降の文字が1つずつずれる）
    self.dict = dict.replace(/\r/g, '').split('\n').filter((c) => c !== '');
    return self;
  }

  async detect(img, { maxSide = 1280 } = {}) {
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.max(32, Math.round((img.width * scale) / 32) * 32), h = Math.max(32, Math.round((img.height * scale) / 32) * 32);
    const resized = resizeRGBA(img, w, h);
    const input = new this.ort.Tensor('float32', toTensorBGR(resized, DET_MEAN, DET_STD), [1, 3, h, w]);
    const out = await this.det.run({ [this.det.inputNames[0]]: input });
    const prob = out[this.det.outputNames[0]].data;
    const rx = img.width / w, ry = img.height / h;
    return dbPostprocess(prob, w, h).map((b) => ({
      x0: Math.max(0, Math.floor(b.x0 * rx)), y0: Math.max(0, Math.floor(b.y0 * ry)),
      x1: Math.min(img.width, Math.ceil(b.x1 * rx)), y1: Math.min(img.height, Math.ceil(b.y1 * ry)), score: b.score,
    }));
  }

  async recognize(img) {
    const H = 48;
    const W = Math.max(16, Math.min(3200, Math.round((img.width * H) / img.height)));
    const resized = resizeRGBA(img, W, H);
    const input = new this.ort.Tensor('float32', toTensorBGR(resized, [0.5, 0.5, 0.5], [0.5, 0.5, 0.5]), [1, 3, H, W]);
    const out = await this.rec.run({ [this.rec.inputNames[0]]: input });
    const t = out[this.rec.outputNames[0]];
    const [, steps, classes] = t.dims;
    // 出力の0番は「空白（blank）」、最後は辞書に無い空白文字（スペース）
    const chars = ['', ...this.dict];
    if (classes === this.dict.length + 2) chars.push(' ');
    return ctcDecode(t.data, steps, classes, chars);
  }

  // 画像全体を読む。minConf 未満の結果は捨てる
  async read(img, { minConf = 0.5, onProgress } = {}) {
    const boxes = await this.detect(img);
    const items = [];
    for (const [i, b] of boxes.entries()) {
      onProgress?.(`読み取り中（${i + 1} / ${boxes.length}）`, (i + 1) / boxes.length);
      let part = crop(img, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      if (part.height >= part.width * 1.5) part = rotate90(part); // 縦書き
      const r = await this.recognize(part);
      if (r.text.trim() && r.conf >= minConf) items.push({ ...b, text: r.text.trim(), conf: r.conf });
    }
    return { lines: orderLines(items), items };
  }
}
