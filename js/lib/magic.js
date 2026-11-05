// Magic: 重ね掛けされたエンコードを自動で探索して剥がす
import {
  toBytes, latin1Decode, bytesToText, printableRatio,
  b64Decode, b32Decode, b58Decode, b85Decode, hexToBytes, binToBytes, decToBytes,
  htmlDecode, unicodeUnescape, morseDecode, caesar, rot47, atbash, reverse, uuDecode,
} from './codecs.js';
import { streamTransform } from './recipe.js';
import { englishScore } from './ciphers.js';
import { identifyType } from './file.js';
import { DEFAULT_PREFIXES } from './flag.js';

const ascii = (b) => latin1Decode(b).trim();
const tryInflate = (fmt) => async (b) => {
  try {
    return await streamTransform(b, new DecompressionStream(fmt));
  } catch {
    return null;
  }
};

// [名前, 適用条件と処理（当てはまらなければ null を返す）]
const DECODERS = [
  ['Base64', (b) => {
    const s = ascii(b);
    return s.length >= 4 && /^[A-Za-z0-9+/_\-\s]+={0,2}$/.test(s) ? b64Decode(s) : null;
  }],
  ['Base32', (b) => {
    const s = ascii(b);
    return s.length >= 8 && /^[A-Z2-7\s]+=*$/.test(s) ? b32Decode(s) : null;
  }],
  ['Base58', (b) => {
    const s = ascii(b);
    return s.length >= 4 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(s) ? b58Decode(s) : null;
  }],
  ['Base85', (b) => {
    const s = ascii(b);
    return /^<~[\s\S]*~>$/.test(s) || (s.length >= 10 && /^[!-u\s]+$/.test(s) && /[^A-Za-z0-9\s]/.test(s)) ? b85Decode(s) : null;
  }],
  ['Hex', (b) => {
    const s = ascii(b);
    return s.length >= 4 && /^(?:0x|\\x|[0-9a-fA-F]|[\s:,])+$/.test(s) && /[0-9a-fA-F]{2}/.test(s) ? hexToBytes(s) : null;
  }],
  ['2進数', (b) => {
    const s = ascii(b);
    return s.length >= 8 && /^[01\s]+$/.test(s) ? binToBytes(s) : null;
  }],
  ['10進数', (b) => {
    const s = ascii(b);
    return /^\d{1,3}(?:[\s,]+\d{1,3}){2,}$/.test(s) ? decToBytes(s) : null;
  }],
  ['URL', (b) => {
    const s = latin1Decode(b);
    // uuencode などは % を普通の記号として使うので、URL エンコードと誤認しない
    if (/^\s*begin[ \t]+[0-7]{3}[ \t]/i.test(s)) return null;
    // %XX が 2 か所以上、または文字全体の 1 割以上を占めるときだけ URL エンコードとみなす
    const n = (s.match(/%[0-9a-fA-F]{2}/g) || []).length;
    return n >= 2 || (n === 1 && s.length <= 30) ? toBytes(decodeURIComponent(s.replace(/\+/g, ' '))) : null;
  }],
  ['HTML エンティティ', (b) => {
    const s = bytesToText(b);
    return /&(#x?[0-9a-f]+|[a-z]+);/i.test(s) ? toBytes(htmlDecode(s)) : null;
  }],
  ['Unicode エスケープ', (b) => {
    const s = bytesToText(b);
    return /\\u[0-9a-f]{4}|\\u\{[0-9a-f]+\}|\\x[0-9a-f]{2}/i.test(s) ? toBytes(unicodeUnescape(s)) : null;
  }],
  ['モールス信号', (b) => {
    const s = ascii(b);
    return s.length >= 3 && /^[.\-\s/|]+$/.test(s) && /[.]/.test(s) && /-/.test(s) ? toBytes(morseDecode(s)) : null;
  }],
  ['uudecode', (b) => {
    const s = latin1Decode(b);
    return /^\s*begin[ \t]+[0-7]{3}[ \t]/i.test(s) && /\bend\b/.test(s) ? uuDecode(s) : null;
  }],
  ['gzip 展開', (b) => (b[0] === 0x1f && b[1] === 0x8b ? tryInflate('gzip')(b) : null)],
  ['zlib 展開', (b) => (b[0] === 0x78 && [0x01, 0x5e, 0x9c, 0xda].includes(b[1]) ? tryInflate('deflate')(b) : null)],
];

// 最後の仕上げとして試す、文字をずらす系の変換（フラグが見つかったときだけ採用）
const FINISHERS = [
  ['ROT47', rot47],
  ['Atbash', atbash],
  ['反転', reverse],
  ...Array.from({ length: 25 }, (_, i) => [i + 1 === 13 ? 'ROT13' : `シーザー +${i + 1}`, (s) => caesar(s, i + 1)]),
];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function flagRegex(prefixes = DEFAULT_PREFIXES) {
  const p = prefixes.map((x) => x.trim()).filter(Boolean).map(escapeRe);
  return new RegExp(`(?:${p.length ? p.join('|') : '[A-Za-z0-9_]{2,20}'})\\{[^{}\\s]{1,200}\\}`, 'i');
}

function evaluate(bytes, re) {
  const text = bytesToText(bytes);
  const ratio = printableRatio(bytes);
  const flag = text.match(re)?.[0] ?? null;
  const type = identifyType(bytes);
  const score = (flag ? 1000 : 0) + ratio * 100 + (ratio > 0.9 ? englishScore(text) * 3 : 0) + (type ? 40 : 0);
  return { text, ratio, flag, type: type?.name ?? null, score };
}

export async function magic(input, { maxDepth = 30, prefixes = DEFAULT_PREFIXES, limit = 12 } = {}) {
  const start = typeof input === 'string' ? toBytes(input) : input;
  const re = flagRegex(prefixes);
  const results = [];
  const seen = new Set([latin1Decode(start.subarray(0, 4096))]);
  let queue = [{ bytes: start, chain: [] }];
  let budget = 400;

  for (let depth = 0; depth < maxDepth && queue.length; depth++) {
    const next = [];
    for (const node of queue) {
      for (const [name, fn] of DECODERS) {
        if (--budget < 0) break;
        let out;
        try {
          out = await fn(node.bytes);
        } catch {
          continue;
        }
        if (!out || !out.length) continue;
        const key = latin1Decode(out.subarray(0, 4096));
        if (seen.has(key)) continue;
        seen.add(key);
        const chain = [...node.chain, name];
        const ev = evaluate(out, re);
        results.push({ chain, bytes: out, ...ev });
        // 読める結果か、圧縮データなど既知の形式なら、さらに掘り下げる
        if (ev.ratio >= 0.75 || ev.type) next.push({ bytes: out, chain });
      }
    }
    queue = next;
  }

  // 文字をずらす系は、フラグが出てきたときだけ結果に加える
  const bases = [{ chain: [], bytes: start, ratio: printableRatio(start) }, ...results];
  for (const r of bases) {
    if (r.flag || r.ratio < 0.9) continue;
    const text = bytesToText(r.bytes);
    for (const [name, fn] of FINISHERS) {
      const out = fn(text);
      const flag = out.match(re)?.[0];
      if (flag) {
        const bytes = toBytes(out);
        results.push({ chain: [...r.chain, name], bytes, ...evaluate(bytes, re) });
        break;
      }
    }
  }

  results.sort((a, b) => b.score - a.score || a.chain.length - b.chain.length);
  return results.slice(0, limit);
}
