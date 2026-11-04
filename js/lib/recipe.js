// 変換レシピ：すべての操作をバイト列 → バイト列で行うので、途中でバイナリになっても壊れない
// 操作の定義：{ id, cat（目的別の分類）, name（日本語）, desc（説明）, kw（検索用の別名）, params（設定項目）, fn(bytes, args) }
import {
  toBytes, latin1Decode, latin1Encode, bytesToText, isUtf8, printableRatio,
  b64Encode, b64Decode, b32Encode, b32Decode, b58Encode, b58Decode, b85Encode, b85Decode,
  bytesToHex, hexToBytes, bytesToBin, binToBytes, bytesToDec, decToBytes,
  htmlEncode, htmlDecode, unicodeEscape, unicodeUnescape, morseEncode, morseDecode, reverse,
} from './codecs.js';
import { blockCrypt, rc4, aesGcm } from './blockcipher.js';
import { vigenere, affineDecrypt, railFenceEncrypt, railFenceDecrypt, caesarAll, englishRank, xorBruteSingle } from './ciphers.js';
import { md5, crc32 } from './hash.js';
import { decodeJwt } from './jwt.js';
import { findFlags, DEFAULT_PREFIXES } from './flag.js';
import { entropy, scanSignatures, identifyType } from './file.js';

// ---------- 共通の部品 ----------
const asText = (f) => (b, a) => toBytes(f(bytesToText(b), a));
const asAscii = (f) => (b, a) => f(latin1Decode(b), a);
const mapAscii = (f) => (b) => b.map(f);
const shiftLetter = (k) => (x) => {
  if (x >= 65 && x <= 90) return ((x - 65 + k) % 26) + 65;
  if (x >= 97 && x <= 122) return ((x - 97 + k) % 26) + 97;
  return x;
};
const lines = (b) => bytesToText(b).split(/\r?\n/);
const joinLines = (arr) => toBytes(arr.join('\n'));

export async function streamTransform(bytes, stream) {
  const piped = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(piped).arrayBuffer());
}
const decompress = (fmt, label) => async (b) => {
  try {
    return await streamTransform(b, new DecompressionStream(fmt));
  } catch {
    throw new Error(`${label}として展開できませんでした（先頭のバイトを確認：gzip は 1f 8b、zlib は 78 で始まる）`);
  }
};
const compress = (fmt) => (b) => streamTransform(b, new CompressionStream(fmt));

// 鍵・IV などの値：形式を指定して読む（auto は「16進らしければ16進、そうでなければ文字」）
export function parseValue(s, fmt = 'auto') {
  const t = String(s ?? '').trim();
  if (!t) return new Uint8Array();
  if (fmt === 'text') return toBytes(String(s));
  if (fmt === 'b64') return b64Decode(t);
  if (fmt === 'hex') return hexToBytes(t);
  if (fmt === 'dec') return decToBytes(t);
  if (/^(0x)?[0-9a-f]+$/i.test(t.replace(/[\s:]/g, '')) && t.replace(/^0x|[\s:]/gi, '').length % 2 === 0 && t.replace(/^0x|[\s:]/gi, '').length >= 2) return hexToBytes(t);
  if (/^(\\x[0-9a-f]{2})+$/i.test(t)) return hexToBytes(t);
  return toBytes(String(s));
}
// どう読んだかの説明（画面に出す）
export function describeValue(s, fmt = 'auto') {
  try {
    const b = parseValue(s, fmt);
    if (!b.length) return '';
    const t = String(s ?? '').trim();
    const how = fmt !== 'auto' ? { text: '文字', hex: '16進', b64: 'Base64', dec: '10進' }[fmt] : /^(0x)?[0-9a-f\s:]+$/i.test(t) && b.length * 2 <= t.replace(/[^0-9a-f]/gi, '').length + 2 && !/[g-z]/i.test(t.replace(/^0x/i, '')) && t.length > 1 ? '16進' : /^\\x/i.test(t) ? '16進' : '文字';
    return `${how}として ${b.length} バイト`;
  } catch (e) {
    return e.message;
  }
}
// 旧版との互換：parseKey は「0x… / \x… なら16進、それ以外は文字」
export function parseKey(s) {
  const t = s.trim();
  if (/^0x[0-9a-f\s]+$/i.test(t) || /^(\\x[0-9a-f]{2})+$/i.test(t)) return hexToBytes(t);
  return toBytes(s);
}
const keyOf = (a, name = 'key') => parseValue(a[name], a[`${name}Fmt`] ?? 'auto');

function urlEncodeBytes(b, a) {
  let out = '';
  for (const x of b) {
    const c = String.fromCharCode(x);
    out += a?.all === 'yes' || !/[A-Za-z0-9\-_.~]/.test(c) ? '%' + x.toString(16).toUpperCase().padStart(2, '0') : c;
  }
  return toBytes(out);
}
function urlDecodeBytes(b) {
  const out = [];
  const hx = (x) => (x >= 48 && x <= 57) || (x >= 65 && x <= 70) || (x >= 97 && x <= 102);
  for (let i = 0; i < b.length; i++) {
    if (b[i] === 0x25 && hx(b[i + 1]) && hx(b[i + 2])) {
      out.push(parseInt(String.fromCharCode(b[i + 1], b[i + 2]), 16));
      i += 2;
    } else out.push(b[i] === 0x2b ? 0x20 : b[i]);
  }
  return Uint8Array.from(out);
}

// ---------- 追加の形式 ----------
const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
function bigFromBytes(b) {
  let n = 0n;
  for (const x of b) n = (n << 8n) | BigInt(x);
  return n;
}
function bytesFromBig(n) {
  if (n === 0n) return new Uint8Array([0]);
  const out = [];
  while (n > 0n) {
    out.unshift(Number(n & 255n));
    n >>= 8n;
  }
  return Uint8Array.from(out);
}
function baseNEncode(b, alpha) {
  let zeros = 0;
  while (zeros < b.length && b[zeros] === 0) zeros++;
  let n = bigFromBytes(b), s = '';
  const base = BigInt(alpha.length);
  while (n > 0n) {
    s = alpha[Number(n % base)] + s;
    n /= base;
  }
  return alpha[0].repeat(zeros) + s;
}
function baseNDecode(s, alpha, name) {
  const t = s.replace(/\s+/g, '');
  if (!t) throw new Error('入力が空です');
  let n = 0n, zeros = 0;
  while (zeros < t.length && t[zeros] === alpha[0]) zeros++;
  for (const ch of t) {
    const i = alpha.indexOf(ch);
    if (i < 0) throw new Error(`${name} で使えない文字「${ch}」があります`);
    n = n * BigInt(alpha.length) + BigInt(i);
  }
  const body = n === 0n ? new Uint8Array() : bytesFromBig(n);
  return Uint8Array.from([...new Uint8Array(zeros), ...body]);
}

// basE91
const B91 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~"';
function b91Encode(b) {
  let out = '', q = 0, n = 0;
  for (const x of b) {
    q |= x << n;
    n += 8;
    if (n > 13) {
      let v = q & 8191;
      if (v > 88) {
        q >>= 13;
        n -= 13;
      } else {
        v = q & 16383;
        q >>= 14;
        n -= 14;
      }
      out += B91[v % 91] + B91[Math.floor(v / 91)];
    }
  }
  if (n) {
    out += B91[q % 91];
    if (n > 7 || q > 90) out += B91[Math.floor(q / 91)];
  }
  return out;
}
function b91Decode(s) {
  const out = [];
  let v = -1, q = 0, n = 0;
  for (const ch of s.replace(/\s+/g, '')) {
    const c = B91.indexOf(ch);
    if (c < 0) throw new Error(`basE91 で使えない文字「${ch}」があります`);
    if (v < 0) v = c;
    else {
      v += c * 91;
      q |= v << n;
      n += (v & 8191) > 88 ? 13 : 14;
      do {
        out.push(q & 255);
        q >>= 8;
        n -= 8;
      } while (n > 7);
      v = -1;
    }
  }
  if (v > -1) out.push((q | (v << n)) & 255);
  return Uint8Array.from(out);
}

// \x41 \n A などのエスケープ
function unescapeBytes(s) {
  const out = [];
  const push = (str) => out.push(...toBytes(str));
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '\\' || i === s.length - 1) {
      push(s[i]);
      continue;
    }
    const c = s[++i];
    const simple = { n: 10, r: 13, t: 9, 0: 0, '\\': 92, "'": 39, '"': 34, a: 7, b: 8, f: 12, v: 11 };
    if (c === 'x' && /^[0-9a-f]{2}$/i.test(s.substr(i + 1, 2))) {
      out.push(parseInt(s.substr(i + 1, 2), 16));
      i += 2;
    } else if (c === 'u' && s[i + 1] === '{') {
      const e = s.indexOf('}', i);
      push(String.fromCodePoint(parseInt(s.slice(i + 2, e), 16)));
      i = e;
    } else if (c === 'u' && /^[0-9a-f]{4}$/i.test(s.substr(i + 1, 4))) {
      push(String.fromCharCode(parseInt(s.substr(i + 1, 4), 16)));
      i += 4;
    } else if (/[0-7]/.test(c) && /^[0-7]{1,3}/.test(s.substr(i, 3)) && c !== '0') {
      const m = /^[0-7]{1,3}/.exec(s.substr(i, 3))[0];
      out.push(parseInt(m, 8) & 255);
      i += m.length - 1;
    } else if (c in simple) out.push(simple[c]);
    else push('\\' + c);
  }
  return Uint8Array.from(out);
}
const escapeBytes = (b, a) => toBytes(Array.from(b, (x) => (a?.all !== 'yes' && x >= 0x20 && x < 0x7f && x !== 0x5c ? String.fromCharCode(x) : '\\x' + x.toString(16).padStart(2, '0'))).join(''));

// Quoted-Printable（メールでよく使う）
function qpDecode(s) {
  const t = s.replace(/=\r?\n/g, '');
  const out = [];
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '=' && /^[0-9A-F]{2}$/i.test(t.substr(i + 1, 2))) {
      out.push(parseInt(t.substr(i + 1, 2), 16));
      i += 2;
    } else out.push(...toBytes(t[i]));
  }
  return Uint8Array.from(out);
}
const qpEncode = (b) => toBytes(Array.from(b, (x) => ((x >= 33 && x <= 126 && x !== 61) || x === 32 ? String.fromCharCode(x) : '=' + x.toString(16).toUpperCase().padStart(2, '0'))).join(''));

// 8進数
const octToBytes = (s) => {
  const nums = s.trim().split(/[\s,]+/).filter(Boolean);
  if (!nums.every((n) => /^[0-7]{1,3}$/.test(n))) throw new Error('8進数（0〜7 の 1〜3 桁）を空白で区切って入力してください');
  return Uint8Array.from(nums.map((n) => parseInt(n, 8) & 255));
};

// A1Z26（A=1 … Z=26）
const a1z26Decode = (s) => {
  const nums = s.trim().split(/[^0-9]+/).filter(Boolean);
  if (!nums.length || nums.some((n) => +n < 1 || +n > 26)) throw new Error('1〜26 の数を区切って入力してください');
  return nums.map((n) => String.fromCharCode(64 + +n)).join('');
};
const a1z26Encode = (s) => [...s.toUpperCase()].filter((c) => /[A-Z]/.test(c)).map((c) => c.charCodeAt(0) - 64).join(' ');

// Bacon 暗号（A/B の 5 文字で 1 文字。24 文字版と 26 文字版）
function baconDecode(s, a) {
  const t = s.replace(/[^ABab01]/g, '').toUpperCase().replace(/0/g, 'A').replace(/1/g, 'B');
  if (t.length < 5) throw new Error('A と B（または 0 と 1）の並びを入力してください');
  const alpha = a?.variant === '24' ? 'ABCDEFGHIKLMNOPQRSTUWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let out = '';
  for (let i = 0; i + 5 <= t.length; i += 5) {
    const v = parseInt(t.slice(i, i + 5).replace(/A/g, '0').replace(/B/g, '1'), 2);
    out += alpha[v] ?? '?';
  }
  return out;
}

// HMAC（MD5 は自前、SHA 系は WebCrypto）
async function hmac(alg, key, data) {
  if (alg === 'MD5') {
    let k = key.length > 64 ? hexToBytes(md5(key)) : key;
    const kp = new Uint8Array(64);
    kp.set(k);
    const ipad = kp.map((x) => x ^ 0x36), opad = kp.map((x) => x ^ 0x5c);
    const inner = hexToBytes(md5(Uint8Array.from([...ipad, ...data])));
    return hexToBytes(md5(Uint8Array.from([...opad, ...inner])));
  }
  const k = await crypto.subtle.importKey('raw', key.length ? key : new Uint8Array(1), { name: 'HMAC', hash: alg }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}
const sha = (alg) => async (b) => toBytes(bytesToHex(new Uint8Array(await crypto.subtle.digest(alg, b))));

// 正規表現を作る（エラーは日本語に）
const regex = (p, flags) => {
  try {
    return new RegExp(p, flags);
  } catch (e) {
    throw new Error('正規表現が正しくありません: ' + e.message);
  }
};

// ---------- 設定項目の型 ----------
const KEY = (label = '鍵', def = '') => ({ key: 'key', label, type: 'value', default: def });
const IV = { key: 'iv', label: 'IV', type: 'value', default: '' };
const DIR = { key: 'dir', label: '方向', type: 'select', options: [['dec', '復号'], ['enc', '暗号化']], default: 'dec' };
const LINESEP = { key: 'sep', label: '区切り', type: 'select', options: [['nl', '改行'], ['space', '空白'], ['comma', 'カンマ']], default: 'nl' };
const sepOf = (a) => ({ nl: '\n', space: ' ', comma: ',' }[a?.sep] ?? '\n');

// ---------- 操作の一覧 ----------
export const CATS = [
  ['decode', '形式を戻す', 'Base64 や Hex などの「書き方」を元のデータに戻す'],
  ['encode', '形式に変える', 'データを Base64 や Hex などの書き方にする'],
  ['cipher', '暗号を解く', '鍵を使う暗号・古典暗号・XOR'],
  ['compress', '圧縮・展開', 'gzip / zlib の展開と圧縮'],
  ['extract', '取り出す', 'フラグ・URL・IP・決まった形の文字列を抜き出す'],
  ['text', '文字を加工', '置換・並べ替え・区切りなど'],
  ['calc', '計算・確認', 'ハッシュ・HMAC・エントロピー'],
];

export const OPS = [
  // ===== 形式を戻す =====
  { id: 'b64d', cat: 'decode', name: 'Base64 → 元に戻す', desc: '英数字と + / = の並び。URL 用（- _）も読める', kw: 'base64 from decode べーす', fn: asAscii((s) => b64Decode(s)) },
  {
    id: 'b64cd', cat: 'decode', name: 'Base64（独自の文字表）→ 元に戻す', desc: '文字の並び順を入れ替えた Base64', kw: 'base64 custom alphabet',
    params: [{ key: 'alpha', label: '文字表（64 文字）', type: 'text', default: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/' }],
    fn: asAscii((s, a) => {
      const std = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      if ([...new Set(a.alpha)].length !== 64) throw new Error('文字表は重複のない 64 文字にしてください');
      return b64Decode([...s.replace(/[\s=]/g, '')].map((c) => {
        const i = a.alpha.indexOf(c);
        if (i < 0) throw new Error(`文字表に無い文字「${c}」があります`);
        return std[i];
      }).join(''));
    }),
  },
  { id: 'b32d', cat: 'decode', name: 'Base32 → 元に戻す', desc: '大文字と 2〜7 の並び', kw: 'base32', fn: asAscii((s) => b32Decode(s)) },
  { id: 'b58d', cat: 'decode', name: 'Base58 → 元に戻す', desc: '0 O I l を使わない英数字（暗号通貨のアドレスなど）', kw: 'base58 bitcoin', fn: asAscii((s) => b58Decode(s)) },
  { id: 'b62d', cat: 'decode', name: 'Base62 → 元に戻す', desc: '記号を使わない英数字', kw: 'base62', fn: asAscii((s) => baseNDecode(s, B62, 'Base62')) },
  { id: 'b85d', cat: 'decode', name: 'Base85 → 元に戻す', desc: '記号の多い並び。<~ ~> で囲まれることも（Ascii85）', kw: 'base85 ascii85', fn: asAscii((s) => b85Decode(s)) },
  { id: 'b91d', cat: 'decode', name: 'basE91 → 元に戻す', desc: '記号の多い並び（basE91）', kw: 'base91', fn: asAscii((s) => b91Decode(s)) },
  { id: 'hexd', cat: 'decode', name: '16進（Hex）→ 元に戻す', desc: '0〜9 と a〜f の並び。空白・0x・\\x 区切りも可', kw: 'hex 16進 from', fn: asAscii((s) => hexToBytes(s)) },
  { id: 'bind', cat: 'decode', name: '2進数 → 元に戻す', desc: '0 と 1 の並び（8 桁で 1 文字）', kw: 'binary 2進', fn: asAscii((s) => binToBytes(s)) },
  { id: 'octd', cat: 'decode', name: '8進数 → 元に戻す', desc: '0〜7 の 3 桁の数の並び', kw: 'octal 8進', fn: asAscii(octToBytes) },
  { id: 'decd', cat: 'decode', name: '10進の文字コード → 元に戻す', desc: '102 108 97 103 のような数の並び', kw: 'decimal charcode 10進 文字コード', fn: asAscii((s) => decToBytes(s)) },
  { id: 'urld', cat: 'decode', name: 'URL エンコード → 元に戻す', desc: '%41 や + を戻す', kw: 'url percent', fn: urlDecodeBytes },
  { id: 'htmld', cat: 'decode', name: 'HTML エンティティ → 元に戻す', desc: '&#65; や &amp; を戻す', kw: 'html entity', fn: asText(htmlDecode) },
  { id: 'unid', cat: 'decode', name: 'Unicode エスケープ → 元に戻す', desc: '\\u0041 の形を戻す', kw: 'unicode escape', fn: asText(unicodeUnescape) },
  { id: 'escd', cat: 'decode', name: 'エスケープ（\\x41 \\n など）→ 元に戻す', desc: 'プログラムの文字列でよく見る形を戻す', kw: 'escape backslash \\x', fn: asAscii(unescapeBytes) },
  { id: 'qpd', cat: 'decode', name: 'Quoted-Printable → 元に戻す', desc: 'メールの =E3=81=82 の形を戻す', kw: 'quoted printable mail', fn: asAscii(qpDecode) },
  { id: 'morsed', cat: 'decode', name: 'モールス信号 → 文字', desc: '. と - の並び（区切りは空白、単語は /）', kw: 'morse', fn: asText(morseDecode) },
  { id: 'a1z26d', cat: 'decode', name: 'A1Z26（数 → 英字）', desc: '1=A … 26=Z', kw: 'a1z26 number letter', fn: asText(a1z26Decode) },
  { id: 'bacon', cat: 'decode', name: 'Bacon 暗号 → 英字', desc: 'A と B（0 と 1）の 5 文字で 1 文字', kw: 'bacon baconian', params: [{ key: 'variant', label: '種類', type: 'select', options: [['26', '26 文字'], ['24', '24 文字（I=J・U=V）']], default: '26' }], fn: asText(baconDecode) },
  {
    id: 'jwt', cat: 'decode', name: 'JWT の中身を表示', desc: 'eyJ で始まるトークンのヘッダと中身', kw: 'jwt token json',
    fn: asText((s) => {
      const r = decodeJwt(s);
      return `// ヘッダ\n${JSON.stringify(r.header, null, 2)}\n// 中身（ペイロード）\n${JSON.stringify(r.payload, null, 2)}${r.notes.length ? '\n// 注意\n' + r.notes.join('\n') : ''}`;
    }),
  },
  {
    id: 'bigd', cat: 'decode', name: '大きな整数 → バイト列', desc: 'RSA の結果などの 10 進（0x なら 16 進）の数を文字に戻す', kw: 'bigint long_to_bytes integer number',
    fn: asAscii((s) => {
      const t = s.trim();
      if (!/^(0x[0-9a-f]+|\d+)$/i.test(t)) throw new Error('10 進の整数（または 0x で始まる 16 進）を入力してください');
      return bytesFromBig(BigInt(t));
    }),
  },

  // ===== 形式に変える =====
  { id: 'b64e', cat: 'encode', name: 'Base64 にする', kw: 'base64 to encode', fn: (b) => toBytes(b64Encode(b)) },
  { id: 'b32e', cat: 'encode', name: 'Base32 にする', kw: 'base32', fn: (b) => toBytes(b32Encode(b)) },
  { id: 'b58e', cat: 'encode', name: 'Base58 にする', kw: 'base58', fn: (b) => toBytes(b58Encode(b)) },
  { id: 'b62e', cat: 'encode', name: 'Base62 にする', kw: 'base62', fn: (b) => toBytes(baseNEncode(b, B62)) },
  { id: 'b85e', cat: 'encode', name: 'Base85 にする', kw: 'base85', fn: (b) => toBytes(b85Encode(b)) },
  { id: 'b91e', cat: 'encode', name: 'basE91 にする', kw: 'base91', fn: (b) => toBytes(b91Encode(b)) },
  { id: 'hexe', cat: 'encode', name: '16進（Hex）にする', kw: 'hex to', params: [{ key: 'sep', label: '区切り', type: 'select', options: [['', 'なし'], [' ', '空白'], ['\\x', '\\x'], [':', ':']], default: '' }], fn: (b, a) => toBytes(a.sep === '\\x' ? bytesToHex(b, '').replace(/../g, '\\x$&') : bytesToHex(b, a.sep ?? '')) },
  { id: 'bine', cat: 'encode', name: '2進数にする', kw: 'binary', fn: (b) => toBytes(bytesToBin(b)) },
  { id: 'octe', cat: 'encode', name: '8進数にする', kw: 'octal', fn: (b) => toBytes(Array.from(b, (x) => x.toString(8).padStart(3, '0')).join(' ')) },
  { id: 'dece', cat: 'encode', name: '10進の文字コードにする', kw: 'decimal charcode', fn: (b) => toBytes(bytesToDec(b)) },
  { id: 'urle', cat: 'encode', name: 'URL エンコードする', kw: 'url percent', params: [{ key: 'all', label: '対象', type: 'select', options: [['no', '記号だけ'], ['yes', 'すべての文字']], default: 'no' }], fn: urlEncodeBytes },
  { id: 'htmle', cat: 'encode', name: 'HTML エンティティにする', kw: 'html entity', fn: asText(htmlEncode) },
  { id: 'unie', cat: 'encode', name: 'Unicode エスケープにする', kw: 'unicode escape', fn: asText(unicodeEscape) },
  { id: 'esce', cat: 'encode', name: 'エスケープ（\\x41）にする', kw: 'escape', params: [{ key: 'all', label: '対象', type: 'select', options: [['no', '読めない文字だけ'], ['yes', 'すべての文字']], default: 'no' }], fn: escapeBytes },
  { id: 'qpe', cat: 'encode', name: 'Quoted-Printable にする', kw: 'quoted printable', fn: qpEncode },
  { id: 'morsee', cat: 'encode', name: 'モールス信号にする', kw: 'morse', fn: asText(morseEncode) },
  { id: 'a1z26e', cat: 'encode', name: 'A1Z26 にする（英字 → 数）', kw: 'a1z26', fn: asText(a1z26Encode) },
  { id: 'bige', cat: 'encode', name: 'バイト列 → 大きな整数', desc: 'bytes_to_long と同じ', kw: 'bigint bytes_to_long integer', fn: (b) => toBytes(bigFromBytes(b).toString()) },

  // ===== 暗号を解く =====
  {
    id: 'aes', cat: 'cipher', name: 'AES', desc: '鍵（16・24・32 バイト）と、多くの場合 IV が必要', kw: 'aes rijndael decrypt encrypt cbc ecb ctr gcm',
    params: [DIR, { key: 'mode', label: 'モード', type: 'select', options: [['cbc', 'CBC'], ['ecb', 'ECB'], ['ctr', 'CTR'], ['gcm', 'GCM'], ['cfb', 'CFB'], ['ofb', 'OFB']], default: 'cbc' }, KEY('鍵'), IV,
      { key: 'padding', label: 'パディング', type: 'select', options: [['pkcs7', 'PKCS#7'], ['none', 'なし'], ['zero', '0 で埋める']], default: 'pkcs7', when: (a) => ['cbc', 'ecb'].includes(a.mode) },
      { key: 'tag', label: 'タグ（空なら末尾16バイト）', type: 'value', default: '', when: (a) => a.mode === 'gcm' && a.dir === 'dec' }],
    fn: (b, a) => {
      const key = keyOf(a), iv = keyOf(a, 'iv');
      if (a.mode === 'gcm') return aesGcm({ key, iv, tag: keyOf(a, 'tag'), decrypt: a.dir !== 'enc' }, b);
      return blockCrypt({ algo: 'aes', key, iv, mode: a.mode, padding: a.padding, decrypt: a.dir !== 'enc' }, b);
    },
  },
  {
    id: 'des', cat: 'cipher', name: 'DES / 3DES', desc: 'DES は 8 バイト、3DES は 16 か 24 バイトの鍵', kw: 'des 3des triple tdes',
    params: [DIR, { key: 'algo', label: '種類', type: 'select', options: [['des', 'DES'], ['3des', '3DES']], default: 'des' }, { key: 'mode', label: 'モード', type: 'select', options: [['cbc', 'CBC'], ['ecb', 'ECB'], ['cfb', 'CFB'], ['ofb', 'OFB']], default: 'cbc' }, KEY('鍵'), IV,
      { key: 'padding', label: 'パディング', type: 'select', options: [['pkcs7', 'PKCS#7'], ['none', 'なし'], ['zero', '0 で埋める']], default: 'pkcs7', when: (a) => ['cbc', 'ecb'].includes(a.mode) }],
    fn: (b, a) => blockCrypt({ algo: a.algo, key: keyOf(a), iv: keyOf(a, 'iv'), mode: a.mode, padding: a.padding, decrypt: a.dir !== 'enc' }, b),
  },
  { id: 'rc4', cat: 'cipher', name: 'RC4', desc: '暗号化と復号は同じ操作', kw: 'rc4 arc4 arcfour', params: [KEY('鍵')], fn: (b, a) => rc4(keyOf(a), b) },
  {
    id: 'xor', cat: 'cipher', name: 'XOR（鍵を指定）', desc: '同じ鍵でもう一度 XOR すると元に戻る', kw: 'xor', params: [KEY('鍵', '0x20')],
    fn: (b, a) => {
      const key = keyOf(a);
      if (!key.length) throw new Error('鍵を指定してください');
      return b.map((x, i) => x ^ key[i % key.length]);
    },
  },
  {
    id: 'xorbrute', cat: 'cipher', name: 'XOR 総当たり（1 バイトの鍵）', desc: '256 通りの鍵を試し、読める順に並べる', kw: 'xor brute force single byte',
    params: [{ key: 'limit', label: '表示する数', type: 'number', default: '10' }],
    fn: (b, a) => toBytes(xorBruteSingle(b, Math.max(1, Math.min(256, +a.limit || 10))).map((r) => `鍵 0x${r.key.toString(16).padStart(2, '0')}: ${r.text.replace(/[^\x20-\x7e\n]/g, '·')}`).join('\n')),
  },
  { id: 'rot13', cat: 'cipher', name: 'ROT13', desc: '英字を 13 ずらす（2 回で元に戻る）', kw: 'rot13 caesar', fn: mapAscii(shiftLetter(13)) },
  {
    id: 'caesar', cat: 'cipher', name: 'シーザー暗号（ずらす数を指定）', kw: 'caesar shift rot', params: [{ key: 'arg', label: 'ずらす数', type: 'number', default: '3' }],
    fn: (b, a) => {
      const n = parseInt(a.arg, 10);
      if (Number.isNaN(n)) throw new Error('ずらす数は整数で指定してください');
      return mapAscii(shiftLetter(((n % 26) + 26) % 26))(b);
    },
  },
  {
    id: 'caesarbrute', cat: 'cipher', name: 'シーザー総当たり', desc: '25 通りを並べ、英語らしい順に表示', kw: 'caesar brute all rot',
    fn: (b) => toBytes(caesarAll(bytesToText(b)).filter((r) => r.shift).map((r) => ({ ...r, ...englishRank(r.text) })).sort((x, y) => x.rank - y.rank).map((r) => `+${String(r.shift).padStart(2)}: ${r.text}`).join('\n')),
  },
  { id: 'rot47', cat: 'cipher', name: 'ROT47', desc: '記号も含めて 47 ずらす', kw: 'rot47', fn: mapAscii((x) => (x >= 33 && x <= 126 ? 33 + ((x - 33 + 47) % 94) : x)) },
  { id: 'rot5', cat: 'cipher', name: 'ROT5（数字を 5 ずらす）', kw: 'rot5 rot18 digits', fn: mapAscii((x) => (x >= 48 && x <= 57 ? 48 + ((x - 48 + 5) % 10) : x)) },
  { id: 'atbash', cat: 'cipher', name: 'Atbash（A↔Z を入れ替え）', kw: 'atbash', fn: mapAscii((x) => (x >= 65 && x <= 90 ? 155 - x : x >= 97 && x <= 122 ? 219 - x : x)) },
  { id: 'vigenere', cat: 'cipher', name: 'Vigenère 暗号', desc: '英字の鍵で 1 文字ずつずらす量を変える', kw: 'vigenere vigenère', params: [DIR, { key: 'key', label: '鍵（英字）', type: 'text', default: 'KEY' }], fn: asText((s, a) => { if (!/[a-z]/i.test(a.key)) throw new Error('鍵は英字で指定してください'); return vigenere(s, a.key, a.dir !== 'enc'); }) },
  {
    id: 'affine', cat: 'cipher', name: 'Affine 暗号（復号）', desc: 'y = a·x + b（a は 26 と互いに素）', kw: 'affine',
    params: [{ key: 'a', label: 'a', type: 'number', default: '5' }, { key: 'b', label: 'b', type: 'number', default: '8' }],
    fn: asText((s, a) => {
      const x = parseInt(a.a, 10), y = parseInt(a.b, 10);
      if (![1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25].includes(((x % 26) + 26) % 26)) throw new Error('a は 26 と互いに素な数（1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25）にしてください');
      return affineDecrypt(s, x, y);
    }),
  },
  { id: 'railfence', cat: 'cipher', name: 'Rail Fence 暗号', desc: 'ジグザグに書いて行ごとに読む', kw: 'rail fence zigzag', params: [DIR, { key: 'rails', label: 'レールの数', type: 'number', default: '3' }], fn: asText((s, a) => { const r = parseInt(a.rails, 10); if (!(r >= 2)) throw new Error('レールの数は 2 以上にしてください'); return a.dir === 'enc' ? railFenceEncrypt(s, r) : railFenceDecrypt(s, r); }) },

  // ===== 圧縮・展開 =====
  { id: 'gunzip', cat: 'compress', name: 'gzip を展開', desc: '1f 8b で始まるデータ（Base64 なら H4sI）', kw: 'gunzip gzip decompress', fn: decompress('gzip', 'gzip ') },
  { id: 'inflate', cat: 'compress', name: 'zlib を展開', desc: '78 9c などで始まるデータ（Base64 なら eJ）', kw: 'zlib inflate', fn: decompress('deflate', 'zlib ') },
  { id: 'inflateRaw', cat: 'compress', name: 'raw deflate を展開', desc: 'ヘッダの無い deflate', kw: 'raw deflate inflate', fn: decompress('deflate-raw', 'raw deflate ') },
  { id: 'gzip', cat: 'compress', name: 'gzip で圧縮', kw: 'gzip compress', fn: compress('gzip') },
  { id: 'zlib', cat: 'compress', name: 'zlib で圧縮', kw: 'zlib deflate compress', fn: compress('deflate') },

  // ===== 取り出す =====
  {
    id: 'flags', cat: 'extract', name: 'フラグを抜き出す', desc: 'flag{…} の形（デコードして見つかるものも）', kw: 'flag extract find',
    params: [{ key: 'prefix', label: '接頭辞（カンマ区切り）', type: 'text', default: DEFAULT_PREFIXES.join(',') }],
    fn: asText((s, a) => {
      const r = findFlags(s, undefined, String(a.prefix ?? '').split(','));
      return r.length ? r.map((x) => `${x.match}    （${x.source}）`).join('\n') : '（フラグは見つかりませんでした）';
    }),
  },
  { id: 'urls', cat: 'extract', name: 'URL を抜き出す', kw: 'url extract', fn: asText((s) => [...new Set(s.match(/\bhttps?:\/\/[^\s"'<>]+/gi) ?? [])].join('\n')) },
  { id: 'ips', cat: 'extract', name: 'IP アドレスを抜き出す', kw: 'ip address extract', fn: asText((s) => [...new Set(s.match(/\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g) ?? [])].join('\n')) },
  { id: 'emails', cat: 'extract', name: 'メールアドレスを抜き出す', kw: 'email mail extract', fn: asText((s) => [...new Set(s.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? [])].join('\n')) },
  {
    id: 'regex', cat: 'extract', name: '正規表現で抜き出す', desc: 'グループ番号を指定すると、その部分だけ', kw: 'regex regexp match grep',
    params: [{ key: 'pattern', label: 'パターン', type: 'text', default: '[A-Za-z0-9+/]{16,}={0,2}' }, { key: 'group', label: 'グループ', type: 'number', default: '0' }, { key: 'flags', label: 'フラグ', type: 'text', default: 'gi' }],
    fn: asText((s, a) => {
      const re = regex(a.pattern, (a.flags || '').includes('g') ? a.flags : (a.flags || '') + 'g');
      return [...s.matchAll(re)].map((m) => m[+a.group || 0] ?? '').join('\n');
    }),
  },
  {
    id: 'strings', cat: 'extract', name: '読める文字列を抜き出す', desc: 'strings コマンドと同じ', kw: 'strings printable',
    params: [{ key: 'min', label: '最小の長さ', type: 'number', default: '4' }],
    fn: (b, a) => {
      const min = Math.max(1, +a.min || 4);
      const out = [];
      let cur = '';
      for (const x of [...b, 0]) {
        if (x >= 0x20 && x < 0x7f) cur += String.fromCharCode(x);
        else {
          if (cur.length >= min) out.push(cur);
          cur = '';
        }
      }
      return toBytes(out.join('\n'));
    },
  },
  {
    id: 'files', cat: 'extract', name: '埋め込まれたファイルを探す', desc: '中に入っている別のファイルの位置を一覧', kw: 'extract files binwalk carve',
    fn: (b) => toBytes(scanSignatures(b).map((s) => `0x${s.offset.toString(16).padStart(6, '0')}  ${s.name}`).join('\n') || '（見つかりませんでした）'),
  },
  {
    id: 'slice', cat: 'extract', name: '一部を切り出す', desc: '開始位置と長さ（バイト）。0x も使える', kw: 'slice cut substring offset',
    params: [{ key: 'start', label: '開始', type: 'text', default: '0' }, { key: 'len', label: '長さ（空なら最後まで）', type: 'text', default: '' }],
    fn: (b, a) => {
      const n = (v) => (/^0x/i.test(v) ? parseInt(v, 16) : parseInt(v, 10));
      const st = n(a.start || '0');
      if (Number.isNaN(st)) throw new Error('開始位置は数で指定してください');
      return b.slice(st < 0 ? b.length + st : st, a.len ? (st < 0 ? b.length + st : st) + n(a.len) : undefined);
    },
  },

  // ===== 文字を加工 =====
  { id: 'rev', cat: 'text', name: '逆順にする', kw: 'reverse', fn: (b) => (isUtf8(b) ? toBytes(reverse(bytesToText(b))) : b.slice().reverse()) },
  { id: 'upper', cat: 'text', name: '大文字にする', kw: 'upper', fn: mapAscii((x) => (x >= 97 && x <= 122 ? x - 32 : x)) },
  { id: 'lower', cat: 'text', name: '小文字にする', kw: 'lower', fn: mapAscii((x) => (x >= 65 && x <= 90 ? x + 32 : x)) },
  { id: 'trim', cat: 'text', name: '空白・改行を取り除く', kw: 'trim whitespace remove', fn: (b) => b.filter((x) => ![9, 10, 13, 32].includes(x)) },
  {
    id: 'replace', cat: 'text', name: '置き換える', desc: '正規表現も使える（$1 でグループを参照）', kw: 'replace find sed',
    params: [{ key: 'find', label: '探す', type: 'text', default: '' }, { key: 'to', label: '置き換え後', type: 'text', default: '' }, { key: 're', label: '方式', type: 'select', options: [['no', 'そのまま'], ['yes', '正規表現']], default: 'no' }],
    fn: asText((s, a) => (!a.find ? s : a.re === 'yes' ? s.replace(regex(a.find, 'g'), a.to) : s.split(a.find).join(a.to))),
  },
  { id: 'keep', cat: 'text', name: '決まった文字だけ残す', desc: 'Hex・Base64 に使う文字以外を消す（ゴミ混じりのデータ用）', kw: 'filter keep clean', params: [{ key: 'set', label: '残す文字', type: 'select', options: [['hex', 'Hex（0-9a-f）'], ['b64', 'Base64'], ['alnum', '英数字'], ['print', '読める文字']], default: 'hex' }], fn: asText((s, a) => s.replace({ hex: /[^0-9a-f]/gi, b64: /[^A-Za-z0-9+/=_-]/g, alnum: /[^A-Za-z0-9]/g, print: /[^\x20-\x7e\n]/g }[a.set], '')) },
  { id: 'chunk', cat: 'text', name: 'n 文字ごとに区切る', kw: 'split chunk group', params: [{ key: 'n', label: '文字数', type: 'number', default: '2' }, LINESEP], fn: asText((s, a) => { const n = Math.max(1, +a.n || 2); return (s.match(new RegExp(`[\\s\\S]{1,${n}}`, 'g')) ?? []).join(sepOf(a)); }) },
  { id: 'sortlines', cat: 'text', name: '行を並べ替える', kw: 'sort lines', params: [{ key: 'order', label: '順番', type: 'select', options: [['asc', '昇順'], ['desc', '降順'], ['num', '数として']], default: 'asc' }], fn: (b, a) => { const l = lines(b); l.sort(a.order === 'num' ? (x, y) => parseFloat(x) - parseFloat(y) : undefined); if (a.order === 'desc') l.reverse(); return joinLines(l); } },
  { id: 'uniqlines', cat: 'text', name: '重複した行を消す', kw: 'unique uniq dedupe lines', fn: (b) => joinLines([...new Set(lines(b))]) },
  { id: 'revlines', cat: 'text', name: '行の順番を逆にする', kw: 'reverse lines tac', fn: (b) => joinLines(lines(b).reverse()) },
  {
    id: 'eachline', cat: 'text', name: '1 行ずつ同じ変換をする', desc: '行ごとに選んだ変換を当てる（CyberChef の Fork）', kw: 'fork each line map',
    params: [{ key: 'op', label: '変換', type: 'select', options: 'decodeOps', default: 'b64d' }],
    fn: async (b, a) => {
      const op = getOp(a.op);
      if (!op) throw new Error('変換を選んでください');
      const out = [];
      for (const [i, l] of lines(b).entries()) {
        if (!l.trim()) {
          out.push('');
          continue;
        }
        try {
          out.push(bytesToText(await op.fn(toBytes(l), defaultArgs(op))));
        } catch (e) {
          throw new Error(`${i + 1} 行目で失敗：${e.message}`);
        }
      }
      return joinLines(out);
    },
  },
  {
    id: 'swap', cat: 'text', name: 'エンディアンを入れ替える', desc: '2・4・8 バイトごとに並びを逆にする', kw: 'endian swap byteswap',
    params: [{ key: 'n', label: '単位', type: 'select', options: [['2', '2 バイト'], ['4', '4 バイト'], ['8', '8 バイト']], default: '4' }],
    fn: (b, a) => {
      const n = +a.n, out = b.slice();
      for (let i = 0; i + n <= b.length; i += n) out.set(b.slice(i, i + n).reverse(), i);
      return out;
    },
  },

  // ===== 計算・確認 =====
  { id: 'md5', cat: 'calc', name: 'MD5', kw: 'md5 hash', fn: (b) => toBytes(md5(b)) },
  { id: 'sha1', cat: 'calc', name: 'SHA-1', kw: 'sha1 hash', fn: sha('SHA-1') },
  { id: 'sha256', cat: 'calc', name: 'SHA-256', kw: 'sha256 hash', fn: sha('SHA-256') },
  { id: 'sha512', cat: 'calc', name: 'SHA-512', kw: 'sha512 hash', fn: sha('SHA-512') },
  { id: 'crc32', cat: 'calc', name: 'CRC32', kw: 'crc32 checksum', fn: (b) => toBytes((crc32(b) >>> 0).toString(16).padStart(8, '0')) },
  {
    id: 'hmac', cat: 'calc', name: 'HMAC', desc: '鍵つきのハッシュ（署名の確認など）', kw: 'hmac signature',
    params: [{ key: 'alg', label: '種類', type: 'select', options: [['SHA-256', 'SHA-256'], ['SHA-1', 'SHA-1'], ['SHA-512', 'SHA-512'], ['MD5', 'MD5']], default: 'SHA-256' }, KEY('鍵')],
    fn: async (b, a) => toBytes(bytesToHex(await hmac(a.alg, keyOf(a), b))),
  },
  {
    id: 'stats', cat: 'calc', name: 'データの性質を調べる', desc: '大きさ・エントロピー・読める文字の割合', kw: 'entropy stats analyze',
    fn: (b) => {
      const e = entropy(b);
      return toBytes([
        `大きさ　　　：${b.length} バイト`,
        `エントロピー：${e.toFixed(3)} / 8　${e > 7.5 ? '（暗号化・圧縮されたデータらしい）' : e < 5 ? '（文字や規則的なデータらしい）' : ''}`,
        `読める文字　：${Math.round(printableRatio(b) * 100)}%`,
        `UTF-8 として：${isUtf8(b) ? '正しい' : '正しくない（バイナリ）'}`,
      ].join('\n'));
    },
  },
];

export const getOp = (id) => OPS.find((o) => o.id === id);
// 「1 行ずつ」で選べる変換（設定の要らないデコード系）
export const DECODE_OPS = OPS.filter((o) => (o.cat === 'decode' || ['rot13', 'rot47', 'atbash', 'rev', 'md5', 'b64e', 'hexe'].includes(o.id)) && !o.params);
for (const o of OPS) for (const p of o.params ?? []) if (p.options === 'decodeOps') p.options = DECODE_OPS.map((d) => [d.id, d.name]);

export function defaultArgs(op) {
  const a = {};
  for (const p of op.params ?? []) {
    a[p.key] = p.default;
    if (p.type === 'value') a[`${p.key}Fmt`] = 'auto';
  }
  return a;
}

// 操作の検索（日本語の名前・説明・英語の別名・ひらがな）
export function searchOps(q) {
  const t = q.trim().toLowerCase();
  if (!t) return OPS;
  const words = t.split(/\s+/);
  return OPS.filter((o) => {
    const hay = `${o.name} ${o.desc ?? ''} ${o.kw ?? ''} ${o.id}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

// items: ['b64d', { id: 'xor', arg: 'key' }, { id: 'aes', args: {...}, off: true }, ...]
function normalize(it) {
  const { id, arg, args, off } = typeof it === 'string' ? { id: it } : it;
  const op = getOp(id);
  if (!op) return { id, op: null };
  const a = { ...defaultArgs(op), ...(args ?? {}) };
  if (arg !== undefined && op.params?.[0]) a[op.params[0].key] = arg;
  return { id, op, args: a, off: !!off };
}

export async function runRecipe(input, items) {
  let cur = typeof input === 'string' ? toBytes(input) : input;
  const steps = [];
  for (const it of items) {
    const { id, op, args, off } = normalize(it);
    if (!op) return { output: null, steps, error: `不明な操作: ${id}` };
    if (off) {
      steps.push({ op, ok: true, off: true, out: cur });
      continue;
    }
    try {
      cur = await op.fn(cur, args);
      steps.push({ op, ok: true, out: cur });
    } catch (e) {
      steps.push({ op, ok: false, error: e.message });
      return { output: null, steps, error: `「${op.name}」で失敗: ${e.message}` };
    }
  }
  return { output: cur, steps, error: null };
}

// ---------- 次の一手の候補 ----------
// データの見た目から、試す価値のある操作を挙げる（理由つき）
export function suggestNext(b) {
  const out = [];
  const add = (id, reason, args) => out.push({ id, reason, args });
  if (!b.length) return out;
  const raw = latin1Decode(b.subarray(0, 4096));
  const s = raw.trim();
  const compact = s.replace(/\s+/g, '');
  // 単語の区切りの空白がある（改行以外の空白を含む）ものは、Base64 などではなく文章とみなす
  const spaced = / /.test(s.replace(/\r?\n/g, ''));
  const isBin = /^[01]{8}(?:\s*[01]{8})*$/.test(s);
  if (b[0] === 0x1f && b[1] === 0x8b) add('gunzip', '先頭が 1f 8b（gzip の印）');
  if (b[0] === 0x78 && [0x01, 0x5e, 0x9c, 0xda].includes(b[1])) add('inflate', '先頭が 78（zlib の印）');
  // 画像や zip などのファイルそのものなら、文字としての候補は出さない（保存して専用のツールで調べる）
  const ftype = identifyType(b);
  if (ftype && !['gz'].includes(ftype.ext)) {
    if (ftype.ext === 'zip' || ftype.ext === 'gz') add('files', 'ファイルの中に別のファイルが無いか探す');
    return out;
  }
  // 読めない文字が多いデータに、文字の形の判定は当てない
  if (printableRatio(b.subarray(0, 4096)) < 0.75) {
    add('xorbrute', '読めないバイナリ（1 バイト XOR かも）');
    if (b.length >= 16 && b.length % 16 === 0 && entropy(b) > Math.min(6, Math.log2(b.length) - 0.5)) add('aes', `${b.length} バイト＝16 の倍数で乱雑（AES かも・鍵が必要）`);
    add('stats', 'まずデータの性質を確認');
    add('files', '中に別のファイルが無いか探す');
    return out;
  }
  if (/^eyJ[\w-]+\.[\w-]+\.?[\w-]*$/.test(compact)) add('jwt', 'eyJ で始まる（JWT）');
  if (isBin) add('bind', '0 と 1 の 8 桁ずつ（2進）');
  else if (/^(?:0x)?(?:[0-9a-f]{2}[\s:,]*){2,}$/i.test(s) || /^(?:\\x[0-9a-f]{2})+$/i.test(compact)) add('hexd', '0〜9 と a〜f だけ（16進）');
  if (/^[0-7]{3}(?:\s+[0-7]{3})+$/.test(s)) add('octd', '3 桁の 0〜7 の並び（8進）');
  if (/^\d{1,3}(?:[\s,]+\d{1,3}){2,}$/.test(s)) {
    const nums = s.split(/[\s,]+/).map(Number);
    if (nums.every((n) => n >= 32 && n <= 126)) add('decd', '32〜126 の数の並び（文字コード）');
    if (nums.every((n) => n >= 1 && n <= 26)) add('a1z26d', '1〜26 の数の並び（A1Z26）');
  }
  if (/^\d{20,}$/.test(compact)) add('bigd', 'とても大きな整数（文字を数にしたもの？）');
  if (!spaced && /^[A-Za-z0-9+/]{8,}={0,2}$/.test(compact) && compact.length % 4 !== 1 && !/^[0-9a-f]+$/i.test(compact)) add('b64d', compact.startsWith('H4sI') ? 'H4sI で始まる（gzip を Base64 にしたもの）' : '英数字と + / = の並び（Base64）');
  else if (!spaced && /^[A-Za-z0-9_-]{8,}={0,2}$/.test(compact) && /[_-]/.test(compact)) add('b64d', '英数字と - _ の並び（URL 用の Base64）');
  if (!spaced && /^[A-Z2-7]{8,}=*$/.test(compact)) add('b32d', '大文字と 2〜7 だけ（Base32）');
  if (!spaced && /^[1-9A-HJ-NP-Za-km-z]{8,}$/.test(compact) && !/^[0-9a-f]+$/i.test(compact)) add('b58d', '0 O I l を含まない英数字（Base58 かも）');
  if (/^<~[\s\S]*~>$/.test(s)) add('b85d', '<~ ~> で囲まれている（Ascii85）');
  if (/%[0-9a-f]{2}/i.test(s)) add('urld', '%xx を含む（URL エンコード）');
  if (/&(#x?[0-9a-f]+|[a-z]+);/i.test(s)) add('htmld', '&#…; を含む（HTML エンティティ）');
  if (/\\u[0-9a-f]{4}|\\u\{/i.test(s)) add('unid', '\\u を含む（Unicode エスケープ）');
  if (/\\x[0-9a-f]{2}/i.test(s) && !/^(?:\\x[0-9a-f]{2})+$/i.test(compact)) add('escd', '\\x を含む（エスケープ）');
  if (/=[0-9A-F]{2}/.test(s) && /(=[0-9A-F]{2}){3,}/.test(s)) add('qpd', '=E3=81 のような形（Quoted-Printable）');
  if (/^[.\-\s/|]{5,}$/.test(s) && /[.-]/.test(s)) add('morsed', '. と - の並び（モールス信号）');
  if (/^[ABab\s]{10,}$/.test(s) && compact.length % 5 === 0) add('bacon', 'A と B の並び（Bacon 暗号）');
  if (/^[\x20-\x7e\s]+$/.test(raw) && /[a-z]/i.test(s) && (spaced || /\{/.test(s) || !out.length)) {
    const letters = s.replace(/[^a-z]/gi, '').length;
    if (letters / Math.max(1, compact.length) > 0.6) {
      const flagLike = /^[a-z]{2,8}\{/i.test(s) && !/^(flag|ctf)\{/i.test(s);
      add('caesarbrute', flagLike ? '「xxxx{」の形。英字がずれたフラグかも' : 'ほとんど英字（シーザー暗号かも）');
      add('rot13', 'ROT13 は CTF の定番');
      add('atbash', 'A↔Z の入れ替え');
    }
  }
  if (/(flag|ctf)\{/i.test(raw)) add('flags', 'フラグらしい形を含む');
  // 読めないバイナリ：XOR や鍵つきの暗号を疑う
  if (printableRatio(b) < 0.75 && !out.length) {
    add('xorbrute', '読めないバイナリ（1 バイト XOR かも）');
    if (b.length >= 16 && b.length % 16 === 0 && entropy(b) > Math.min(6, Math.log2(b.length) - 0.5)) add('aes', `${b.length} バイト＝16 の倍数で乱雑（AES かも・鍵が必要）`);
    add('stats', 'まずデータの性質を確認');
    add('files', '中に別のファイルが無いか探す');
  }
  return out;
}
