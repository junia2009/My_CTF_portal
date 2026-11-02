// 文字列から flag{...} 形式を探す。よくある変換を掛けた結果も一緒に探す。
import {
  b64Decode, b32Decode, hexToBytes, binToBytes, decToBytes, fromBytes,
  urlDecode, htmlDecode, unicodeUnescape, caesar, rot47, atbash, reverse,
} from './codecs.js';

export const DEFAULT_FLAG_PATTERN = '[A-Za-z0-9_\\-]{2,20}\\{[^{}\\s]{1,200}\\}';
export const DEFAULT_PREFIXES = ['flag', 'ctf'];

// 全体に掛ける変換。strict: 文字をずらすだけの変換は何でも一致しやすいので、接頭辞が既知のものだけ採用する
const WHOLE = [
  ['そのまま', (s) => s, false],
  ['Base64 デコード', (s) => fromBytes(b64Decode(s)), false],
  ['Base32 デコード', (s) => fromBytes(b32Decode(s)), false],
  ['Hex デコード', (s) => fromBytes(hexToBytes(s)), false],
  ['2進数 デコード', (s) => fromBytes(binToBytes(s)), false],
  ['10進数 デコード', (s) => fromBytes(decToBytes(s)), false],
  ['URL デコード', urlDecode, false],
  ['HTML エンティティ解除', htmlDecode, false],
  ['Unicode エスケープ解除', unicodeUnescape, false],
  ['ROT47', rot47, true],
  ['Atbash', atbash, true],
  ['反転', reverse, true],
  ...Array.from({ length: 25 }, (_, i) => [
    `シーザー +${i + 1}${i + 1 === 13 ? ' (ROT13)' : ''}`,
    (s) => caesar(s, i + 1),
    true,
  ]),
];

// 文章に埋め込まれた部分文字列ごとに試すデコード
const TOKENS = [
  ['Base64 デコード（部分）', /[A-Za-z0-9+/_-]{8,}={0,2}/g, (s) => fromBytes(b64Decode(s))],
  ['Base32 デコード（部分）', /[A-Z2-7]{8,}={0,6}/g, (s) => fromBytes(b32Decode(s))],
  ['Hex デコード（部分）', /(?:[0-9a-fA-F]{2}){4,}/g, (s) => fromBytes(hexToBytes(s))],
];

export function findFlags(text, pattern = DEFAULT_FLAG_PATTERN, prefixes = DEFAULT_PREFIXES) {
  let re;
  try {
    re = new RegExp(pattern, 'g');
  } catch (e) {
    throw new Error('正規表現が不正です: ' + e.message);
  }
  const pre = prefixes.map((p) => p.trim().toLowerCase()).filter(Boolean);
  const known = (m) => pre.some((p) => m.toLowerCase().startsWith(p));

  const results = [];
  const seen = new Set();
  const collect = (name, out, strict) => {
    for (const m of out.matchAll(re)) {
      if (!m[0] || seen.has(m[0])) continue;
      if (strict && !known(m[0])) continue;
      seen.add(m[0]);
      results.push({ source: name, match: m[0] });
    }
  };

  for (const [name, fn, strict] of WHOLE) {
    try {
      collect(name, fn(text), strict);
    } catch {
      /* この変換は当てはまらない */
    }
  }
  for (const [name, tokRe, fn] of TOKENS) {
    for (const tok of text.matchAll(tokRe)) {
      try {
        collect(name, fn(tok[0]), false);
      } catch {
        /* デコードできない部分は無視 */
      }
    }
  }
  return results;
}
