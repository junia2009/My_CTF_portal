// ハッシュ計算・ハッシュ形式の推定
import { bytesToHex } from './codecs.js';

// MD5（Web Crypto API に無いため自前実装）
export function md5(bytes) {
  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const K = new Int32Array(64);
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) | 0;

  const len = bytes.length;
  const nBlocks = ((len + 8) >> 6) + 1;
  const w = new Int32Array(nBlocks * 16);
  for (let i = 0; i < len; i++) w[i >> 2] |= bytes[i] << ((i % 4) * 8);
  w[len >> 2] |= 0x80 << ((len % 4) * 8);
  w[nBlocks * 16 - 2] = (len * 8) | 0;
  w[nBlocks * 16 - 1] = Math.floor(len / 0x20000000);

  let a0 = 0x67452301 | 0, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476 | 0;
  for (let blk = 0; blk < nBlocks; blk++) {
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      F = (F + A + K[i] + w[blk * 16 + g]) | 0;
      A = D; D = C; C = B;
      B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) | 0;
    }
    a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
  }
  const out = new Uint8Array(16);
  [a0, b0, c0, d0].forEach((v, i) => {
    for (let j = 0; j < 4; j++) out[i * 4 + j] = (v >>> (j * 8)) & 0xff;
  });
  return bytesToHex(out);
}

// CRC32（zip / PNG などで使われる）
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes, start = 0, end = bytes.length) {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export async function computeHashes(bytes) {
  const res = { CRC32: crc32(bytes).toString(16).padStart(8, '0'), MD5: md5(bytes) };
  for (const alg of ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512']) {
    const buf = await crypto.subtle.digest(alg, bytes);
    res[alg] = bytesToHex(new Uint8Array(buf));
  }
  return res;
}

// 文字列の形からハッシュの種類を推定する
const PATTERNS = [
  { re: /^\$2[abxy]?\$\d{2}\$[./A-Za-z0-9]{53}$/, names: ['bcrypt'] },
  { re: /^\$1\$[^$]{0,8}\$[./A-Za-z0-9]{22}$/, names: ['MD5-crypt ($1$)'] },
  { re: /^\$5\$(rounds=\d+\$)?[^$]{0,16}\$[./A-Za-z0-9]{43}$/, names: ['SHA-256-crypt ($5$)'] },
  { re: /^\$6\$(rounds=\d+\$)?[^$]{0,16}\$[./A-Za-z0-9]{86}$/, names: ['SHA-512-crypt ($6$)'] },
  { re: /^\$y\$/, names: ['yescrypt ($y$)'] },
  { re: /^\$argon2(id|i|d)\$/, names: ['Argon2'] },
  { re: /^\$apr1\$/, names: ['Apache MD5 ($apr1$)'] },
  { re: /^pbkdf2_sha256\$/, names: ['Django PBKDF2-SHA256'] },
  { re: /^\{SHA\}[A-Za-z0-9+/=]{28}$/, names: ['LDAP SHA-1 (Base64)'] },
  { re: /^[0-9a-f]{8}$/i, names: ['CRC32', 'Adler-32'] },
  { re: /^[0-9a-f]{16}$/i, names: ['MySQL323', 'CRC64'] },
  { re: /^[0-9a-f]{32}$/i, names: ['MD5', 'NTLM', 'MD4', 'LM'] },
  { re: /^[0-9a-f]{40}$/i, names: ['SHA-1', 'RIPEMD-160'] },
  { re: /^\*[0-9a-f]{40}$/i, names: ['MySQL 4.1+ (SHA1(SHA1))'] },
  { re: /^[0-9a-f]{56}$/i, names: ['SHA-224', 'SHA3-224'] },
  { re: /^[0-9a-f]{64}$/i, names: ['SHA-256', 'SHA3-256', 'BLAKE2s'] },
  { re: /^[0-9a-f]{96}$/i, names: ['SHA-384', 'SHA3-384'] },
  { re: /^[0-9a-f]{128}$/i, names: ['SHA-512', 'SHA3-512', 'BLAKE2b', 'Whirlpool'] },
];

export function identifyHash(s) {
  const t = s.trim();
  if (!t) return [];
  const hits = PATTERNS.filter((p) => p.re.test(t)).flatMap((p) => p.names);
  return hits;
}
