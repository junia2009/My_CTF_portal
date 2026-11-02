// 古典暗号・XOR・頻度分析
import { caesar } from './codecs.js';

// 英語の文字出現頻度（%）
const EN_FREQ = {
  a: 8.2, b: 1.5, c: 2.8, d: 4.3, e: 12.7, f: 2.2, g: 2.0, h: 6.1, i: 7.0, j: 0.15,
  k: 0.77, l: 4.0, m: 2.4, n: 6.7, o: 7.5, p: 1.9, q: 0.095, r: 6.0, s: 6.3, t: 9.1,
  u: 2.8, v: 0.98, w: 2.4, x: 0.15, y: 2.0, z: 0.074,
};

// 英文らしさのスコア（高いほど英文らしい）
export function englishScore(s) {
  if (!s.length) return 0;
  let score = 0;
  for (const c of s.toLowerCase()) {
    if (EN_FREQ[c]) score += EN_FREQ[c];
    else if (c === ' ') score += 13;
    else if (/[\x00-\x08\x0e-\x1f\x7f-￿]/.test(c)) score -= 20;
  }
  return score / s.length;
}

export function caesarAll(s) {
  const rows = [];
  for (let k = 0; k < 26; k++) {
    const text = caesar(s, k);
    rows.push({ shift: k, text, score: englishScore(text) });
  }
  return rows;
}

export function vigenere(s, key, decrypt = false) {
  const k = key.toLowerCase().replace(/[^a-z]/g, '');
  if (!k) throw new Error('鍵にはアルファベットを含めてください');
  let j = 0;
  return s.replace(/[a-z]/gi, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    let shift = k.charCodeAt(j++ % k.length) - 97;
    if (decrypt) shift = 26 - shift;
    return String.fromCharCode(((c.charCodeAt(0) - base + shift) % 26) + base);
  });
}

export function xorBytes(data, key) {
  if (!key.length) throw new Error('鍵が空です');
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = data[i] ^ key[i % key.length];
  return out;
}

const latin1 = (b) => Array.from(b, (x) => String.fromCharCode(x)).join('');

export function printableRatio(bytes) {
  if (!bytes.length) return 0;
  let n = 0;
  for (const b of bytes) if ((b >= 0x20 && b <= 0x7e) || b === 0x0a || b === 0x0d || b === 0x09) n++;
  return n / bytes.length;
}

// 1バイト鍵をすべて試し、それらしい順に並べる
export function xorBruteSingle(bytes, limit = 20) {
  const rows = [];
  for (let k = 0; k < 256; k++) {
    const out = xorBytes(bytes, [k]);
    const text = latin1(out);
    const ratio = printableRatio(out);
    // フラグらしい形（xxx{...}）を含む候補は大きく優先する
    const flagBonus = /(flag|ctf)\{/i.test(text) ? 50 : /[a-z0-9_]{2,}\{[\x20-\x7e]*\}/i.test(text) ? 10 : 0;
    rows.push({ key: k, text, ratio, score: ratio * 10 + englishScore(text) + flagBonus });
  }
  rows.sort((a, b) => b.score - a.score);
  return rows.slice(0, limit);
}

export function letterFrequency(s) {
  const counts = {};
  for (let i = 0; i < 26; i++) counts[String.fromCharCode(65 + i)] = 0;
  let total = 0;
  for (const c of s.toUpperCase()) {
    if (c >= 'A' && c <= 'Z') {
      counts[c]++;
      total++;
    }
  }
  return Object.entries(counts).map(([letter, count]) => ({
    letter,
    count,
    pct: total ? (count / total) * 100 : 0,
    en: EN_FREQ[letter.toLowerCase()],
  }));
}

// 鍵長の候補の並べ替え：本当の鍵長の倍数も統計値が良くなり、しかも文章に過剰に合わせ込めてしまうので、
// 「最良値に近いもの」を短い順に優先し、残りを統計値の良い順に並べる
function preferShort(list, metric, near, higherIsBetter) {
  const best = list.reduce((b, x) => (higherIsBetter ? Math.max(b, metric(x)) : Math.min(b, metric(x))), higherIsBetter ? -Infinity : Infinity);
  const len = (x) => x.length ?? x.size;
  const good = list.filter((x) => near(metric(x), best)).sort((a, b) => len(a) - len(b));
  const rest = list.filter((x) => !good.includes(x)).sort((a, b) => (higherIsBetter ? metric(b) - metric(a) : metric(a) - metric(b)));
  return [...good, ...rest];
}

// ---------- Vigenère 自動解読 ----------
const EN_VEC = 'abcdefghijklmnopqrstuvwxyz'.split('').map((c) => EN_FREQ[c] / 100);

function ioc(nums) {
  const n = nums.length;
  if (n < 2) return 0;
  const c = new Array(26).fill(0);
  for (const x of nums) c[x]++;
  return c.reduce((s, k) => s + k * (k - 1), 0) / (n * (n - 1));
}

function bestShift(col) {
  let best = 0, bestChi = Infinity;
  for (let s = 0; s < 26; s++) {
    const counts = new Array(26).fill(0);
    for (const c of col) counts[(c - s + 26) % 26]++;
    let chi = 0;
    for (let i = 0; i < 26; i++) {
      const exp = EN_VEC[i] * col.length;
      chi += (counts[i] - exp) ** 2 / exp;
    }
    if (chi < bestChi) {
      bestChi = chi;
      best = s;
    }
  }
  return best;
}

// "keykey" のような繰り返しを "key" に縮める
export function minimalPeriod(arr) {
  for (let p = 1; p < arr.length; p++) {
    if (arr.length % p === 0 && arr.every((x, i) => x === arr[i % p])) return arr.slice(0, p);
  }
  return arr;
}

export function vigenereCrack(s, maxLen = 20) {
  const nums = Array.from(s.toLowerCase().replace(/[^a-z]/g, ''), (c) => c.charCodeAt(0) - 97);
  if (nums.length < 20) throw new Error('アルファベットが20文字以上必要です');
  const lengths = [];
  for (let L = 1; L <= Math.min(maxLen, Math.floor(nums.length / 2)); L++) {
    let sum = 0;
    for (let k = 0; k < L; k++) sum += ioc(nums.filter((_, i) => i % L === k));
    lengths.push({ length: L, ioc: sum / L });
  }
  // 英文の IoC は約 0.066。長い鍵長は1列あたりの文字が少なく IoC がたまたま高くなるので、
  // 「英文らしい値（0.06）以上」を満たす最短の長さを優先する
  const order = preferShort(lengths, (x) => x.ioc, (v, best) => v >= Math.min(0.06, best * 0.85), true);
  const seen = new Set();
  const candidates = [];
  for (const { length: L } of order.slice(0, 6)) {
    const shifts = [];
    for (let k = 0; k < L; k++) shifts.push(bestShift(nums.filter((_, i) => i % L === k)));
    const key = minimalPeriod(shifts).map((x) => String.fromCharCode(97 + x)).join('');
    if (seen.has(key)) continue;
    seen.add(key);
    const plain = vigenere(s, key, true);
    candidates.push({ key, plain, score: englishScore(plain) });
  }
  return { lengths, candidates };
}

// ---------- Affine 暗号 ----------
const AFFINE_A = [1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25];

export function affineDecrypt(s, a, b) {
  const inv = AFFINE_A.find((x) => (a * x) % 26 === 1);
  if (inv === undefined) throw new Error('a は 26 と互いに素である必要があります');
  return s.replace(/[a-z]/gi, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((((inv * (c.charCodeAt(0) - base - b)) % 26) + 26) % 26) + base);
  });
}

export function affineBrute(s) {
  const rows = [];
  for (const a of AFFINE_A) {
    for (let b = 0; b < 26; b++) {
      const text = affineDecrypt(s, a, b);
      rows.push({ a, b, text, score: englishScore(text) });
    }
  }
  return rows.sort((x, y) => y.score - x.score);
}

// ---------- Rail Fence 暗号 ----------
function railPattern(n, rails) {
  const pat = [];
  let r = 0, dir = 1;
  for (let i = 0; i < n; i++) {
    pat.push(r);
    if (rails > 1) {
      if (r === 0) dir = 1;
      else if (r === rails - 1) dir = -1;
      r += dir;
    }
  }
  return pat;
}

export function railFenceEncrypt(s, rails) {
  const chars = Array.from(s);
  const pat = railPattern(chars.length, rails);
  let out = '';
  for (let r = 0; r < rails; r++) chars.forEach((c, i) => pat[i] === r && (out += c));
  return out;
}

export function railFenceDecrypt(s, rails) {
  const chars = Array.from(s);
  const pat = railPattern(chars.length, rails);
  const rows = [];
  let pos = 0;
  for (let r = 0; r < rails; r++) {
    const len = pat.filter((x) => x === r).length;
    rows.push(chars.slice(pos, pos + len));
    pos += len;
  }
  const idx = new Array(rails).fill(0);
  return pat.map((r) => rows[r][idx[r]++]).join('');
}

export function railFenceBrute(s, maxRails = 12) {
  const rows = [];
  const n = Array.from(s).length;
  for (let r = 2; r <= Math.min(maxRails, Math.max(2, n - 1)); r++) {
    const text = railFenceDecrypt(s, r);
    rows.push({ rails: r, text, score: englishScore(text) });
  }
  return rows;
}

// ---------- 単一換字式 ----------
export const EN_ORDER = 'ETAOINSHRDLCUMWFGYPBVKJXQZ';

// map: { A: 'e', ... }（暗号文字 → 平文字）。未割当は「_」
export function applySubstitution(s, map) {
  return s.replace(/[a-z]/gi, (c) => {
    const p = map[c.toUpperCase()];
    if (!p) return '_';
    return c === c.toUpperCase() ? p.toUpperCase() : p.toLowerCase();
  });
}

export function frequencyGuess(s) {
  const order = letterFrequency(s).filter((f) => f.count > 0).sort((a, b) => b.count - a.count);
  const map = {};
  order.forEach((f, i) => (map[f.letter] = EN_ORDER[i]));
  return map;
}

// ---------- 繰り返し鍵 XOR ----------
function scoreBytes(b) {
  return printableRatio(b) * 10 + englishScore(latin1(b));
}

function hamming(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = a[i] ^ b[i];
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

export function xorKeySizes(bytes, maxKey = 40) {
  const sizes = [];
  for (let k = 2; k <= Math.min(maxKey, Math.floor(bytes.length / 2)); k++) {
    const blocks = Math.min(8, Math.floor(bytes.length / k));
    let sum = 0, cnt = 0;
    for (let i = 0; i + 1 < blocks; i++) {
      sum += hamming(bytes.subarray(i * k, (i + 1) * k), bytes.subarray((i + 1) * k, (i + 2) * k)) / k;
      cnt++;
    }
    if (cnt) sizes.push({ size: k, dist: sum / cnt });
  }
  return sizes.sort((a, b) => a.dist - b.dist);
}

export function xorRepeatingCrack(bytes, maxKey = 40) {
  if (bytes.length < 8) throw new Error('データが短すぎます（8バイト以上必要）');
  const sizes = preferShort(xorKeySizes(bytes, maxKey), (x) => x.dist, (v, best) => v <= best * 1.15, false).slice(0, 5);
  const seen = new Set();
  const results = [];
  for (const { size } of sizes) {
    const key = [];
    for (let k = 0; k < size; k++) {
      const col = bytes.filter((_, i) => i % size === k);
      let best = 0, bestScore = -Infinity;
      for (let c = 0; c < 256; c++) {
        const sc = scoreBytes(col.map((x) => x ^ c));
        if (sc > bestScore) {
          bestScore = sc;
          best = c;
        }
      }
      key.push(best);
    }
    const k = minimalPeriod(key);
    const id = k.join(',');
    if (seen.has(id)) continue;
    seen.add(id);
    const plain = xorBytes(bytes, k);
    results.push({ key: Uint8Array.from(k), plain, text: latin1(plain), score: scoreBytes(plain) });
  }
  return results;
}

// ---------- 既知平文（crib）から鍵を推定 ----------
export function xorCrib(bytes, crib, limit = 40) {
  if (!crib.length) throw new Error('既知の平文を入力してください');
  const rows = [];
  for (let off = 0; off + crib.length <= bytes.length; off++) {
    const key = crib.map((c, i) => bytes[off + i] ^ c);
    const printable = key.every((x) => x >= 0x20 && x <= 0x7e);
    if (off === 0 || printable) rows.push({ offset: off, key: Uint8Array.from(key), printable });
    if (rows.length >= limit) break;
  }
  return rows;
}
