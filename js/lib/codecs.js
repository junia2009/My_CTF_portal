// エンコード / デコード系の純粋関数（ブラウザ・Node 両対応）

const te = new TextEncoder();
const td = new TextDecoder('utf-8');

export const toBytes = (s) => te.encode(s);
export const fromBytes = (b) => td.decode(b);

const strictTd = new TextDecoder('utf-8', { fatal: true });
export function isUtf8(b) {
  try {
    strictTd.decode(b);
    return true;
  } catch {
    return false;
  }
}

// 1バイト = 1文字として扱う（バイナリを壊さずに文字列化する）
export function latin1Decode(b) {
  let s = '';
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192));
  return s;
}
export const latin1Encode = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);

// UTF-8 として正しければ UTF-8、そうでなければ 1バイト1文字で文字列にする
export const bytesToText = (b) => (isUtf8(b) ? strictTd.decode(b) : latin1Decode(b));

// 表示可能な文字（ASCII 印字可能文字と改行・タブ、UTF-8 の多バイト文字）の割合
export function printableRatio(b) {
  if (!b.length) return 0;
  const utf8 = isUtf8(b);
  let n = 0;
  for (const x of b) {
    if ((x >= 0x20 && x <= 0x7e) || x === 0x0a || x === 0x0d || x === 0x09 || (utf8 && x >= 0x80)) n++;
  }
  return n / b.length;
}

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


// ---------- Base58 (Bitcoin 方式) ----------
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function b58Encode(bytes) {
  let n = 0n;
  for (const b of bytes) n = n * 256n + BigInt(b);
  let out = '';
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = '1' + out;
  }
  return out;
}

export function b58Decode(s) {
  const t = s.trim();
  if (!t) throw new Error('入力が空です');
  let n = 0n;
  for (const c of t) {
    const i = B58.indexOf(c);
    if (i < 0) throw new Error('不正なBase58文字列です');
    n = n * 58n + BigInt(i);
  }
  const out = [];
  while (n > 0n) {
    out.unshift(Number(n % 256n));
    n /= 256n;
  }
  for (const c of t) {
    if (c !== '1') break;
    out.unshift(0);
  }
  return Uint8Array.from(out);
}

// ---------- Base85 (ASCII85 / Adobe 方式) ----------
export function b85Encode(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 4) {
    const chunk = bytes.subarray(i, i + 4);
    const pad = 4 - chunk.length;
    let v = 0;
    for (let j = 0; j < 4; j++) v = v * 256 + (chunk[j] ?? 0);
    if (v === 0 && pad === 0) {
      out += 'z';
      continue;
    }
    let s = '';
    for (let j = 0; j < 5; j++) {
      s = String.fromCharCode(33 + (v % 85)) + s;
      v = Math.floor(v / 85);
    }
    out += s.slice(0, 5 - pad);
  }
  return '<~' + out + '~>';
}

export function b85Decode(s) {
  let t = s.replace(/\s+/g, '');
  if (t.startsWith('<~')) t = t.slice(2);
  if (t.endsWith('~>')) t = t.slice(0, -2);
  t = t.replace(/z/g, '!!!!!');
  if (!/^[!-u]*$/.test(t)) throw new Error('不正なBase85文字列です');
  const out = [];
  for (let i = 0; i < t.length; i += 5) {
    const chunk = t.slice(i, i + 5);
    if (chunk.length === 1) throw new Error('Base85 の長さが不正です');
    const pad = 5 - chunk.length;
    let v = 0;
    for (const c of chunk + 'u'.repeat(pad)) v = v * 85 + (c.charCodeAt(0) - 33);
    if (v > 0xffffffff) throw new Error('Base85 の値が範囲外です');
    out.push(...[(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255].slice(0, 4 - pad));
  }
  return Uint8Array.from(out);
}

// ---------- uuencode / xxencode ----------
// uuencode: 1 文字 = 6 ビット。各値 v を chr(v + 32) で表す（v=0 は空白か ` のことも）。
// 行頭はその行のバイト数（同じく +32）。begin/end 行は読み飛ばす。
const XXTAB = '+-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function uuLikeDecode(s, mode) {
  const raw = s.replace(/\r/g, '');
  const all = raw.split('\n');
  const hadBegin = all.some((l) => /^\s*begin[ \t]/i.test(l));
  // begin / end と空行を落とし、データ行だけ残す
  let body = [];
  for (const l of all) {
    if (/^\s*begin[ \t]/i.test(l) || /^\s*end\s*$/i.test(l) || l.trim() === '' || l.trim() === '`') continue;
    body.push(l.replace(/\s+$/, ''));
  }
  // 改行が消えて 1 行に潰れている場合（コピペでよくある）：ヘッダと end を外し、空白区切りで切り直す
  if (hadBegin && (!body.length || (body.length === 1 && /\bend\b/i.test(body[0])))) {
    let m = raw.replace(/^[\s\S]*?begin[ \t]+[0-7]{3}[ \t]+\S+/i, '').replace(/\bend\b[\s\S]*$/i, '');
    body = m.split(/\s+/).filter((t) => t && t !== '`');
  }
  if (!body.length) {
    if (hadBegin) return new Uint8Array(0); // begin/end はあるが中身が空
    throw new Error('データ行が見つかりません（begin/end の間に本文がありません）');
  }
  const val = mode === 'xx'
    ? (c) => { const i = XXTAB.indexOf(c); if (i < 0) throw new Error(`xxencode にない文字「${c}」`); return i; }
    : (c) => (c === '`' ? 0 : (c.charCodeAt(0) - 0x20) & 0x3f); // 本家 uudecode と同じく 6 ビットにマスク（寛容）
  const out = [];
  for (const line of body) {
    const count = mode === 'xx' ? XXTAB.indexOf(line[0]) : (line.charCodeAt(0) - 0x20) & 0x3f;
    if (count <= 0) continue;
    const data = line.slice(1);
    const need = Math.ceil(count / 3) * 4;
    const chars = data.slice(0, need);
    const bytes = [];
    for (let i = 0; i < chars.length; i += 4) {
      const g = chars.slice(i, i + 4).padEnd(4, mode === 'xx' ? '+' : '`');
      const n = (val(g[0]) << 18) | (val(g[1]) << 12) | (val(g[2]) << 6) | val(g[3]);
      bytes.push((n >> 16) & 255, (n >> 8) & 255, n & 255);
    }
    out.push(...bytes.slice(0, count));
  }
  return Uint8Array.from(out);
}

export const uuDecode = (s) => uuLikeDecode(s, 'uu');
export const xxDecode = (s) => uuLikeDecode(s, 'xx');

export function uuEncode(bytes, name = '<data>') {
  const enc = (v) => String.fromCharCode(v ? v + 0x20 : 0x60); // 0 は ` で表す
  const lines = [`begin 644 ${name}`];
  for (let p = 0; p < bytes.length; p += 45) {
    const chunk = bytes.slice(p, p + 45);
    let line = enc(chunk.length);
    for (let i = 0; i < chunk.length; i += 3) {
      const b0 = chunk[i], b1 = chunk[i + 1] ?? 0, b2 = chunk[i + 2] ?? 0;
      const n = (b0 << 16) | (b1 << 8) | b2;
      line += enc((n >> 18) & 0x3f) + enc((n >> 12) & 0x3f) + enc((n >> 6) & 0x3f) + enc(n & 0x3f);
    }
    lines.push(line);
  }
  lines.push('`', 'end');
  return lines.join('\n');
}

// ---------- モールス信号 ----------
const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
  K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
  U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-',
  '&': '.-...', ':': '---...', ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', _: '..--.-', '"': '.-..-.',
  $: '...-..-', '@': '.--.-.',
};
const MORSE_REV = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

export function morseEncode(s) {
  return s
    .toUpperCase()
    .trim()
    .split(/\s+/)
    .map((w) => Array.from(w, (c) => MORSE[c] ?? '#').join(' '))
    .join(' / ');
}

export function morseDecode(s) {
  const t = s.replace(/[_−–—]/g, '-').replace(/[·•*]/g, '.').trim();
  if (!/^[.\-\s/|]+$/.test(t)) throw new Error('モールス信号は . - / と空白で入力してください');
  return t
    .split(/\s*[/|]\s*|\s{3,}/)
    .map((w) => w.split(/\s+/).filter(Boolean).map((c) => MORSE_REV[c] ?? '?').join(''))
    .join(' ');
}
