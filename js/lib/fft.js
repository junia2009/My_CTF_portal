// FFT とスペクトログラム（音声に隠された画像・文字を見るため）

// 基数2の FFT（その場で計算）。re, im は長さ 2^k の Float32Array
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
      }
    }
  }
}

// samples（Float32Array, -1〜1）から、各時刻の周波数ごとの強さ（dB）を求める
export function spectrogram(samples, { fftSize = 2048, hop = fftSize / 4, maxFrames = 4000 } = {}) {
  const win = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1)); // Hann 窓
  let step = hop;
  let frames = Math.max(1, Math.floor((samples.length - fftSize) / step) + 1);
  if (frames > maxFrames) {
    step = Math.floor((samples.length - fftSize) / (maxFrames - 1));
    frames = maxFrames;
  }
  const bins = fftSize / 2;
  const data = new Float32Array(frames * bins);
  const re = new Float32Array(fftSize), im = new Float32Array(fftSize);
  let max = -Infinity;
  for (let f = 0; f < frames; f++) {
    const off = f * step;
    for (let i = 0; i < fftSize; i++) {
      re[i] = (samples[off + i] ?? 0) * win[i];
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 0; k < bins; k++) {
      const db = 10 * Math.log10(re[k] * re[k] + im[k] * im[k] + 1e-12);
      data[f * bins + k] = db;
      if (db > max) max = db;
    }
  }
  return { data, frames, bins, max, step };
}
