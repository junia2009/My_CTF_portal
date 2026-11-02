// エンコード / デコード系の純粋関数（ブラウザ・Node 両対応）

const te = new TextEncoder();
const td = new TextDecoder('utf-8');

export const toBytes = (s) => te.encode(s);
export const fromBytes = (b) => td.decode(b);

// ---------- Hex ----------
export const bytesToHex = (b, sep = '') =>
  Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(sep);

export function hexToBytes(s) {
  const h = s.replace(/0x|\\x|[\s:,]/gi, '');
  if (!/^[0-9a-f]*$/i.test(h) || h.length % 2) throw new Error('不正なHex文字列です');
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
  return out;
}

// ---------- Base64 ----------
export function b64Encode(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function b64Decode(s) {
  let t = s.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  if (!/^[A-Za-z0-9+/]*$/.test(t) || t.length % 4 === 1) throw new Error('不正なBase64文字列です');
  while (t.length % 4) t += '=';
  const bin = atob(t);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// ---------- Base32 (RFC 4648) ----------
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function b32Encode(bytes) {
  let bits = 0, val = 0, out = '';
  for (const b of bytes) {
    val = (val << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(val >>> (bits - 5)) & 31];
      bits -= 5;
    }
    val &= (1 << bits) - 1;
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  while (out.length % 8) out += '=';
  return out;
}

export function b32Decode(s) {
  const t = s.replace(/[\s=]/g, '').toUpperCase();
  let bits = 0, val = 0;
  const out = [];
  for (const c of t) {
    const i = B32.indexOf(c);
    if (i < 0) throw new Error('不正なBase32文字列です');
    val = (val << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((val >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
    val &= (1 << bits) - 1;
  }
  return Uint8Array.from(out);
}

// ---------- 2進 / 10進 ----------
export const bytesToBin = (b) => Array.from(b, (x) => x.toString(2).padStart(8, '0')).join(' ');

export function binToBytes(s) {
  const t = s.replace(/[^01]/g, '');
  if (!t.length || t.length % 8) throw new Error('2進数のビット数が8の倍数ではありません');
  const out = new Uint8Array(t.length / 8);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(t.substr(i * 8, 8), 2);
  return out;
}

export const bytesToDec = (b) => Array.from(b).join(' ');

export function decToBytes(s) {
  const nums = s.split(/[^0-9]+/).filter(Boolean).map(Number);
  if (nums.some((n) => n > 255)) throw new Error('255を超える値が含まれています');
  return Uint8Array.from(nums);
}

// ---------- URL / HTML / Unicode ----------
export const urlEncode = (s) => encodeURIComponent(s);
export const urlDecode = (s) => decodeURIComponent(s.replace(/\+/g, ' '));

export function htmlEncode(s) {
  return Array.from(s, (c) => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    if (map[c]) return map[c];
    const cp = c.codePointAt(0);
    return cp > 126 ? `&#x${cp.toString(16)};` : c;
  }).join('');
}

export function htmlDecode(s) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const cp = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return String.fromCodePoint(cp);
    }
    return named[e.toLowerCase()] ?? m;
  });
}

export const unicodeEscape = (s) =>
  Array.from(s, (c) => {
    const cp = c.codePointAt(0);
    return cp > 0xffff ? `\\u{${cp.toString(16)}}` : `\\u${cp.toString(16).padStart(4, '0')}`;
  }).join('');

export const unicodeUnescape = (s) =>
  s
    .replace(/\\u\{([0-9a-f]+)\}/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\x([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));

// ---------- 文字のずらし系 ----------
export function caesar(s, n) {
  const k = ((n % 26) + 26) % 26;
  return s.replace(/[a-z]/gi, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + k) % 26) + base);
  });
}

export const rot13 = (s) => caesar(s, 13);

export const rot47 = (s) =>
  s.replace(/[!-~]/g, (c) => String.fromCharCode(33 + ((c.charCodeAt(0) - 33 + 47) % 94)));

export const atbash = (s) =>
  s.replace(/[a-z]/gi, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(25 - (c.charCodeAt(0) - base) + base);
  });

export const reverse = (s) => Array.from(s).reverse().join('');

// ---------- 整数の基数変換 ----------
export function convertInteger(input) {
  const s = input.trim().replace(/_/g, '').toLowerCase();
  if (!s) throw new Error('値を入力してください');
  let n;
  if (/^0x[0-9a-f]+$/.test(s) || /^0b[01]+$/.test(s) || /^0o[0-7]+$/.test(s) || /^\d+$/.test(s)) {
    n = BigInt(s);
  } else {
    throw new Error('10進 / 0x(16進) / 0b(2進) / 0o(8進) の形式で入力してください');
  }
  let hex = n.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  const bytes = hexToBytes(hex);
  const printable = Array.from(bytes).every((b) => b >= 0x20 && b <= 0x7e);
  return {
    dec: n.toString(10),
    hex: '0x' + n.toString(16),
    oct: '0o' + n.toString(8),
    bin: '0b' + n.toString(2),
    ascii: printable ? String.fromCharCode(...bytes) : '(表示可能なASCIIではありません)',
  };
}

export function textToInteger(s) {
  const hex = bytesToHex(toBytes(s));
  return hex ? BigInt('0x' + hex).toString(10) : '0';
}

// ---------- 変換レシピ用の操作一覧 ----------
export const OPS = [
  { id: 'b64e', name: 'Base64 エンコード', fn: (s) => b64Encode(toBytes(s)) },
  { id: 'b64d', name: 'Base64 デコード', fn: (s) => fromBytes(b64Decode(s)) },
  { id: 'b32e', name: 'Base32 エンコード', fn: (s) => b32Encode(toBytes(s)) },
  { id: 'b32d', name: 'Base32 デコード', fn: (s) => fromBytes(b32Decode(s)) },
  { id: 'hexe', name: 'Hex エンコード', fn: (s) => bytesToHex(toBytes(s)) },
  { id: 'hexd', name: 'Hex デコード', fn: (s) => fromBytes(hexToBytes(s)) },
  { id: 'bine', name: '2進数 エンコード', fn: (s) => bytesToBin(toBytes(s)) },
  { id: 'bind', name: '2進数 デコード', fn: (s) => fromBytes(binToBytes(s)) },
  { id: 'dece', name: '10進数 エンコード', fn: (s) => bytesToDec(toBytes(s)) },
  { id: 'decd', name: '10進数 デコード', fn: (s) => fromBytes(decToBytes(s)) },
  { id: 'urle', name: 'URL エンコード', fn: urlEncode },
  { id: 'urld', name: 'URL デコード', fn: urlDecode },
  { id: 'htmle', name: 'HTML エンティティ化', fn: htmlEncode },
  { id: 'htmld', name: 'HTML エンティティ解除', fn: htmlDecode },
  { id: 'unie', name: 'Unicode エスケープ', fn: unicodeEscape },
  { id: 'unid', name: 'Unicode エスケープ解除', fn: unicodeUnescape },
  { id: 'rot13', name: 'ROT13', fn: rot13 },
  { id: 'rot47', name: 'ROT47', fn: rot47 },
  { id: 'atbash', name: 'Atbash', fn: atbash },
  { id: 'rev', name: '文字列を反転', fn: reverse },
  { id: 'upper', name: '大文字に変換', fn: (s) => s.toUpperCase() },
  { id: 'lower', name: '小文字に変換', fn: (s) => s.toLowerCase() },
  { id: 'trim', name: '空白・改行を除去', fn: (s) => s.replace(/\s+/g, '') },
];

export function runRecipe(input, opIds) {
  const steps = [];
  let cur = input;
  for (const id of opIds) {
    const op = OPS.find((o) => o.id === id);
    try {
      cur = op.fn(cur);
      steps.push({ op, ok: true, out: cur });
    } catch (e) {
      steps.push({ op, ok: false, error: e.message });
      return { output: null, steps, error: `「${op.name}」で失敗: ${e.message}` };
    }
  }
  return { output: cur, steps, error: null };
}
