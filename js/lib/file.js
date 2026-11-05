// ファイル解析：種類の判定、埋め込みファイルの検出、文字列抽出、エントロピー、PNG 解析
import { crc32 } from './hash.js';

const a = (s) => Array.from(s, (c) => c.charCodeAt(0));

// sig 内の null は「任意の1バイト」。head: true はファイル先頭（offset）でのみ判定する
export const SIGNATURES = [
  { name: 'PNG 画像', ext: 'png', sig: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { name: 'JPEG 画像', ext: 'jpg', sig: [0xff, 0xd8, 0xff] },
  { name: 'GIF 画像', ext: 'gif', sig: a('GIF8') },
  // 2バイトだけの署名は誤判定しやすいので、ヘッダの構造も確認する
  { name: 'BMP 画像', ext: 'bmp', sig: a('BM'), head: true, check: (b) => b.length >= 26 && b[6] === 0 && b[7] === 0 && b[8] === 0 && b[9] === 0 },
  { name: 'TIFF 画像', ext: 'tif', sig: [0x49, 0x49, 0x2a, 0x00] },
  { name: 'TIFF 画像', ext: 'tif', sig: [0x4d, 0x4d, 0x00, 0x2a] },
  { name: 'WebP 画像', ext: 'webp', sig: [...a('RIFF'), null, null, null, null, ...a('WEBP')] },
  { name: 'WAV 音声', ext: 'wav', sig: [...a('RIFF'), null, null, null, null, ...a('WAVE')] },
  { name: 'MP3 音声 (ID3)', ext: 'mp3', sig: a('ID3') },
  { name: 'FLAC 音声', ext: 'flac', sig: a('fLaC') },
  { name: 'Ogg', ext: 'ogg', sig: a('OggS') },
  { name: 'ZIP（docx / xlsx / jar / apk も含む）', ext: 'zip', sig: [0x50, 0x4b, 0x03, 0x04] },
  { name: 'gzip', ext: 'gz', sig: [0x1f, 0x8b, 0x08] },
  { name: 'bzip2', ext: 'bz2', sig: [...a('BZh'), null, ...a('1AY&SY')] },
  { name: 'xz', ext: 'xz', sig: [0xfd, ...a('7zXZ'), 0x00] },
  { name: '7-Zip', ext: '7z', sig: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c] },
  { name: 'RAR', ext: 'rar', sig: [...a('Rar!'), 0x1a, 0x07] },
  { name: 'TAR', ext: 'tar', sig: a('ustar'), head: true, offset: 257 },
  { name: 'PDF', ext: 'pdf', sig: a('%PDF-') },
  { name: 'MS Office 旧形式 (OLE)', ext: 'doc', sig: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
  { name: 'SQLite データベース', ext: 'sqlite', sig: [...a('SQLite format 3'), 0x00] },
  { name: 'ELF 実行ファイル', ext: 'elf', sig: [0x7f, 0x45, 0x4c, 0x46] },
  {
    name: 'Windows 実行ファイル (PE)', ext: 'exe', sig: a('MZ'), head: true,
    check: (b) => {
      const off = b.length >= 64 ? (b[0x3c] | (b[0x3d] << 8) | (b[0x3e] << 16) | (b[0x3f] << 24)) >>> 0 : -1;
      return off >= 0 && off + 4 <= b.length && b[off] === 0x50 && b[off + 1] === 0x45 && b[off + 2] === 0 && b[off + 3] === 0;
    },
  },
  { name: 'Mach-O 実行ファイル', ext: 'macho', sig: [0xcf, 0xfa, 0xed, 0xfe], head: true },
  { name: 'Java class', ext: 'class', sig: [0xca, 0xfe, 0xba, 0xbe], head: true },
  { name: 'Android DEX', ext: 'dex', sig: [...a('dex'), 0x0a], head: true },
  { name: 'WebAssembly', ext: 'wasm', sig: [0x00, 0x61, 0x73, 0x6d], head: true },
  { name: 'pcap パケットキャプチャ', ext: 'pcap', sig: [0xd4, 0xc3, 0xb2, 0xa1], head: true },
  { name: 'pcap パケットキャプチャ', ext: 'pcap', sig: [0xa1, 0xb2, 0xc3, 0xd4], head: true },
  { name: 'pcapng パケットキャプチャ', ext: 'pcapng', sig: [0x0a, 0x0d, 0x0d, 0x0a], head: true },
  { name: 'PEM（鍵・証明書）', ext: 'pem', sig: a('-----BEGIN ') },
  { name: 'OpenSSH 秘密鍵', ext: 'key', sig: a('openssh-key-v1') },
];

const matchAt = (b, sig, off) => {
  if (off < 0 || off + sig.length > b.length) return false;
  for (let i = 0; i < sig.length; i++) if (sig[i] !== null && b[off + i] !== sig[i]) return false;
  return true;
};

export function identifyType(bytes) {
  return SIGNATURES.find((s) => matchAt(bytes, s.sig, s.offset ?? 0) && (!s.check || s.check(bytes))) ?? null;
}

// ファイル内に埋め込まれた別ファイルの署名を探す（binwalk の簡易版）
export function scanSignatures(bytes, maxPerSig = 50) {
  const hits = [];
  for (const s of SIGNATURES) {
    if (s.head) continue;
    let pos = 0, n = 0;
    const first = s.sig[0];
    while (n < maxPerSig) {
      pos = bytes.indexOf(first, pos);
      if (pos < 0) break;
      if (matchAt(bytes, s.sig, pos)) {
        hits.push({ offset: pos, name: s.name, ext: s.ext });
        n++;
      }
      pos++;
    }
  }
  return hits.sort((x, y) => x.offset - y.offset);
}

// ---------- 末尾に付け足されたデータ ----------
function findSeq(b, seq, from = 0) {
  let pos = from;
  while ((pos = b.indexOf(seq[0], pos)) >= 0) {
    if (matchAt(b, seq, pos)) return pos;
    pos++;
  }
  return -1;
}

function lastSeq(b, seq) {
  for (let pos = b.length - seq.length; pos >= 0; pos--) if (matchAt(b, seq, pos)) return pos;
  return -1;
}

function jpegEnd(b) {
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return -1;
    const m = b[i + 1];
    if (m === 0xd9) return i + 2;
    if (m === 0xda) {
      // 画像データ本体の後ろにある最初の EOI を探す
      for (let j = i + 2; j + 1 < b.length; j++) if (b[j] === 0xff && b[j + 1] === 0xd9) return j + 2;
      return -1;
    }
    if (m === 0xff) {
      i++;
      continue;
    }
    if ((m >= 0xd0 && m <= 0xd7) || m === 0x01) {
      i += 2;
      continue;
    }
    i += 2 + ((b[i + 2] << 8) | b[i + 3]);
  }
  return -1;
}

export function findTrailingData(bytes) {
  const type = identifyType(bytes);
  if (!type) return null;
  let end = -1;
  if (type.ext === 'png') {
    const p = findSeq(bytes, a('IEND'));
    if (p >= 0) end = p + 8;
  } else if (type.ext === 'jpg') {
    end = jpegEnd(bytes);
  } else if (type.ext === 'zip') {
    const p = lastSeq(bytes, [0x50, 0x4b, 0x05, 0x06]);
    if (p >= 0 && p + 22 <= bytes.length) end = p + 22 + (bytes[p + 20] | (bytes[p + 21] << 8));
  } else if (type.ext === 'pdf') {
    const p = lastSeq(bytes, a('%%EOF'));
    if (p >= 0) {
      end = p + 5;
      while (end < bytes.length && (bytes[end] === 0x0a || bytes[end] === 0x0d)) end++;
    }
  } else if (type.ext === 'gif') {
    if (bytes[bytes.length - 1] !== 0x3b) {
      const p = bytes.lastIndexOf(0x3b);
      if (p > 0) end = p + 1;
    }
  }
  if (end < 0 || end >= bytes.length) return null;
  return { type: type.name, end, size: bytes.length - end };
}

// ---------- エントロピー ----------
export function entropy(bytes, start = 0, end = bytes.length) {
  const n = end - start;
  if (n <= 0) return 0;
  const c = new Uint32Array(256);
  for (let i = start; i < end; i++) c[bytes[i]]++;
  let e = 0;
  for (const k of c) if (k) e -= (k / n) * Math.log2(k / n);
  return e;
}

export function entropyBlocks(bytes, blocks = 64) {
  const size = Math.max(1, Math.ceil(bytes.length / blocks));
  const out = [];
  for (let i = 0; i < bytes.length; i += size) out.push({ offset: i, value: entropy(bytes, i, Math.min(bytes.length, i + size)) });
  return out;
}

// ---------- 文字列抽出 ----------
export function extractStrings(bytes, minLen = 4, limit = 5000) {
  const out = [];
  const isP = (x) => x >= 0x20 && x <= 0x7e;
  // ASCII
  let start = -1;
  for (let i = 0; i <= bytes.length && out.length < limit; i++) {
    if (i < bytes.length && (isP(bytes[i]) || bytes[i] === 0x09)) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      if (i - start >= minLen) out.push({ offset: start, enc: 'ASCII', text: String.fromCharCode(...bytes.subarray(start, i)) });
      start = -1;
    }
  }
  // UTF-16LE（Windows の文字列によくある）
  for (let par = 0; par < 2; par++) {
    start = -1;
    let chars = [];
    for (let i = par; i <= bytes.length + 1 && out.length < limit; i += 2) {
      const ok = i + 1 < bytes.length && isP(bytes[i]) && bytes[i + 1] === 0;
      if (ok) {
        if (start < 0) start = i;
        chars.push(bytes[i]);
      } else {
        if (start >= 0 && chars.length >= minLen) out.push({ offset: start, enc: 'UTF-16LE', text: String.fromCharCode(...chars) });
        start = -1;
        chars = [];
      }
    }
  }
  return out.sort((x, y) => x.offset - y.offset);
}

// ---------- 16進ダンプ ----------
export function hexdump(bytes, offset = 0, length = 512) {
  const lines = [];
  const end = Math.min(bytes.length, offset + length);
  for (let i = offset - (offset % 16); i < end; i += 16) {
    const row = bytes.subarray(i, Math.min(i + 16, end));
    const hex = Array.from(row, (x) => x.toString(16).padStart(2, '0'));
    const left = hex.slice(0, 8).join(' ').padEnd(23);
    const right = hex.slice(8).join(' ').padEnd(23);
    const asc = Array.from(row, (x) => (x >= 0x20 && x <= 0x7e ? String.fromCharCode(x) : '.')).join('');
    lines.push(`${i.toString(16).padStart(8, '0')}  ${left}  ${right}  |${asc}|`);
  }
  return lines.join('\n');
}

// ---------- PNG ----------
const be32 = (b, i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;

export function parsePng(bytes) {
  if (!matchAt(bytes, SIGNATURES[0].sig, 0)) return null;
  const chunks = [];
  let i = 8;
  while (i + 12 <= bytes.length && chunks.length < 2000) {
    const len = be32(bytes, i);
    const type = String.fromCharCode(...bytes.subarray(i + 4, i + 8));
    if (i + 12 + len > bytes.length) {
      chunks.push({ offset: i, type, length: len, crcOk: false, truncated: true });
      break;
    }
    const stored = be32(bytes, i + 8 + len);
    const actual = crc32(bytes, i + 4, i + 8 + len);
    chunks.push({ offset: i, type, length: len, crcOk: stored === actual, stored, actual });
    i += 12 + len;
    if (type === 'IEND') break;
  }
  const ihdr = chunks.find((c) => c.type === 'IHDR');
  const info = ihdr
    ? {
        width: be32(bytes, ihdr.offset + 8),
        height: be32(bytes, ihdr.offset + 12),
        bitDepth: bytes[ihdr.offset + 16],
        colorType: bytes[ihdr.offset + 17],
      }
    : null;
  return { chunks, info };
}

// IHDR の CRC が合わないとき、CRC が一致する幅・高さを探す（画像の高さ改ざん問題の定番）
export function pngFixDimensions(bytes, maxDim = 4096) {
  const png = parsePng(bytes);
  const ihdr = png?.chunks.find((c) => c.type === 'IHDR');
  if (!ihdr) throw new Error('IHDR チャンクが見つかりません');
  if (ihdr.crcOk) return { alreadyOk: true, width: png.info.width, height: png.info.height };
  const buf = bytes.slice(ihdr.offset + 4, ihdr.offset + 8 + 13); // "IHDR" + データ13バイト
  const set = (w, h) => {
    buf[4] = w >>> 24; buf[5] = (w >>> 16) & 255; buf[6] = (w >>> 8) & 255; buf[7] = w & 255;
    buf[8] = h >>> 24; buf[9] = (h >>> 16) & 255; buf[10] = (h >>> 8) & 255; buf[11] = h & 255;
  };
  const target = ihdr.stored;
  const { width: W, height: H } = png.info;
  const tryPair = (w, h) => {
    set(w, h);
    return crc32(buf) === target;
  };
  let found = null;
  for (let h = 1; h <= maxDim && !found; h++) if (tryPair(W, h)) found = { width: W, height: h };
  for (let w = 1; w <= maxDim && !found; w++) if (tryPair(w, H)) found = { width: w, height: H };
  const lim = Math.min(maxDim, 2048);
  for (let w = 1; w <= lim && !found; w++) for (let h = 1; h <= lim && !found; h++) if (tryPair(w, h)) found = { width: w, height: h };
  if (!found) return null;
  const fixed = bytes.slice();
  const o = ihdr.offset + 8;
  fixed.set(buf.subarray(4, 12), o);
  return { ...found, fixed };
}

// ---------- 暗号の手がかり（どの暗号・ハッシュを使っていそうか） ----------
// 既知の定数テーブル（コンパイルしても値が変わらない）と、RC4 の S-box 初期化コードを探す。
const hx = (s) => Uint8Array.from(s.match(/../g).map((x) => parseInt(x, 16)));
const CRYPTO_SIGS = [
  { name: 'AES（S-box）', sig: hx('637c777bf26b6fc5300167'), note: 'AES。鍵が分かれば「AES」で復号（CBC / ECB / CTR / GCM）' },
  { name: 'AES（復号用 逆 S-box）', sig: hx('52096ad53036a538bf40a3'), note: 'AES の復号テーブル' },
  { name: 'AES（Te0 テーブル）', sig: hx('c66363a5f87c7c84'), note: 'AES（テーブル実装）' },
  { name: 'SHA-256（初期値 H）', sig: hx('67e6096a85ae67bb'), note: 'SHA-256' },
  { name: 'SHA-256（定数 K）', sig: hx('982f8a4291443771'), note: 'SHA-256' },
  { name: 'SHA-512（初期値）', sig: hx('08c9bcf367e6096a'), note: 'SHA-512' },
  { name: 'MD5（正弦テーブル T）', sig: hx('78a46ad7'), note: 'MD5（先頭定数 0xd76aa478）' },
  { name: 'SHA-1 / MD5（初期値 A）', sig: hx('0123456789abcdef'), note: 'SHA-1 や MD5 の初期値（0x67452301…）。ほかの手がかりと合わせて判断' },
  { name: 'CRC32（多項式テーブル）', sig: hx('00000000963007770ec'), note: 'CRC32' },
  { name: 'Blowfish（円周率 P 配列）', sig: hx('886a3f2403d308a3'), note: 'Blowfish' },
  { name: 'base64 の文字表', sig: toBytesAscii('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'), note: 'Base64。独自の並び順なら「Base64（独自の文字表）」' },
];
function toBytesAscii(s) { return Uint8Array.from(s, (c) => c.charCodeAt(0)); }

export function detectCrypto(bytes) {
  const hits = [];
  for (const s of CRYPTO_SIGS) {
    const at = indexOfSeqB(bytes, s.sig, 0);
    if (at >= 0) hits.push({ name: s.name, offset: at, note: s.note, kind: 'const' });
  }
  // RC4 などの「256 要素テーブルを 0..255 で初期化」するコード： inc eax; cmp eax,0x100; jl/jb
  for (let i = 0; i + 7 < bytes.length; i++) {
    if (bytes[i] === 0x40 && bytes[i + 1] === 0x3d && bytes[i + 2] === 0x00 && bytes[i + 3] === 0x01 && bytes[i + 4] === 0x00 && bytes[i + 5] === 0x00 && (bytes[i + 6] === 0x7c || bytes[i + 6] === 0x72)) {
      hits.push({ name: 'RC4 らしきコード（S-box の初期化）', offset: i, note: '256 要素を 0..255 で初期化 → RC4 の可能性。鍵が分かれば「RC4」で復号（暗号化と復号は同じ）', kind: 'code' });
      break;
    }
  }
  return hits;
}

function indexOfSeqB(b, seq, from) {
  for (let i = from; i <= b.length - seq.length; i++) {
    let ok = true;
    for (let j = 0; j < seq.length; j++) if (b[i + j] !== seq[j]) { ok = false; break; }
    if (ok) return i;
  }
  return -1;
}

// 鍵・パスワードらしい文字列（ランダムっぽい英数字の並び）を拾う。すでに抽出した文字列から選ぶ。
export function keyCandidates(strings, limit = 12) {
  const out = [];
  const seen = new Set();
  for (const s of strings) {
    const t = (s.text ?? s).trim();
    if (seen.has(t) || !/^[A-Za-z0-9+/=_\-]{8,64}$/.test(t)) continue;
    const lower = (t.match(/[a-z]/g) || []).length, upper = (t.match(/[A-Z]/g) || []).length, digit = (t.match(/[0-9]/g) || []).length;
    const classes = [lower, upper, digit].filter((n) => n > 0).length;
    const longWord = /[a-z]{6,}|[A-Z]{6,}/.test(t); // GetProcAddress のような普通の単語を除く
    // 長さが 8/16/24/32 だと鍵らしさが上がる
    const niceLen = [8, 16, 24, 32, 44].includes(t.length);
    const uniq = new Set(t).size;
    if (classes >= 2 && digit >= 1 && !longWord && uniq >= t.length * 0.55) {
      seen.add(t);
      out.push({ text: t, score: (niceLen ? 2 : 0) + classes + (digit && upper && lower ? 1 : 0) });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.text);
}
