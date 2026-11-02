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
