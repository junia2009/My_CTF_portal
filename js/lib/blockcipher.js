// ブロック暗号（AES / DES / 3DES）とその利用モード。ブラウザの WebCrypto では ECB や
// パディングなしの CBC、DES が使えないため、ここで自前で実装する（CTF の問題を解くための読みやすさ重視）

// ---------- AES ----------
const SBOX = new Uint8Array(256), INV = new Uint8Array(256);
(() => {
  // 有限体 GF(2^8) の逆元とアフィン変換から S-box を作る
  let p = 1, q = 1;
  do {
    p = p ^ ((p << 1) & 0xff) ^ (p & 0x80 ? 0x1b : 0);
    q ^= q << 1;
    q ^= q << 2;
    q ^= q << 4;
    q &= 0xff;
    if (q & 0x80) q ^= 0x09;
    const x = q ^ ((q << 1) | (q >> 7)) ^ ((q << 2) | (q >> 6)) ^ ((q << 3) | (q >> 5)) ^ ((q << 4) | (q >> 4));
    SBOX[p] = (x ^ 0x63) & 0xff;
  } while (p !== 1);
  SBOX[0] = 0x63;
  for (let i = 0; i < 256; i++) INV[SBOX[i]] = i;
})();
const xt = (a) => ((a << 1) ^ (a & 0x80 ? 0x1b : 0)) & 0xff;
const mul = (a, b) => {
  let r = 0;
  while (b) {
    if (b & 1) r ^= a;
    a = xt(a);
    b >>= 1;
  }
  return r;
};

function aesExpand(key) {
  const nk = key.length / 4;
  if (![4, 6, 8].includes(nk)) throw new Error(`AES の鍵は 16・24・32 バイトです（今は ${key.length} バイト）`);
  const nr = nk + 6, w = new Uint8Array(16 * (nr + 1));
  w.set(key);
  let rcon = 1;
  for (let i = nk; i < 4 * (nr + 1); i++) {
    let t = w.slice((i - 1) * 4, i * 4);
    if (i % nk === 0) {
      t = Uint8Array.of(SBOX[t[1]] ^ rcon, SBOX[t[2]], SBOX[t[3]], SBOX[t[0]]);
      rcon = xt(rcon);
    } else if (nk > 6 && i % nk === 4) t = t.map((x) => SBOX[x]);
    for (let j = 0; j < 4; j++) w[i * 4 + j] = w[(i - nk) * 4 + j] ^ t[j];
  }
  return { w, nr };
}

function aesEncryptBlock({ w, nr }, inp) {
  const s = Uint8Array.from(inp);
  const addKey = (r) => { for (let i = 0; i < 16; i++) s[i] ^= w[r * 16 + i]; };
  addKey(0);
  for (let r = 1; r <= nr; r++) {
    for (let i = 0; i < 16; i++) s[i] = SBOX[s[i]];
    // 行のシフト（状態は列優先で並ぶ）
    const t = s.slice();
    for (let c = 0; c < 4; c++) for (let rr = 0; rr < 4; rr++) s[c * 4 + rr] = t[((c + rr) % 4) * 4 + rr];
    if (r !== nr) {
      for (let c = 0; c < 4; c++) {
        const [a0, a1, a2, a3] = s.subarray(c * 4, c * 4 + 4);
        s[c * 4] = xt(a0) ^ xt(a1) ^ a1 ^ a2 ^ a3;
        s[c * 4 + 1] = a0 ^ xt(a1) ^ xt(a2) ^ a2 ^ a3;
        s[c * 4 + 2] = a0 ^ a1 ^ xt(a2) ^ xt(a3) ^ a3;
        s[c * 4 + 3] = xt(a0) ^ a0 ^ a1 ^ a2 ^ xt(a3);
      }
    }
    addKey(r);
  }
  return s;
}

function aesDecryptBlock({ w, nr }, inp) {
  const s = Uint8Array.from(inp);
  const addKey = (r) => { for (let i = 0; i < 16; i++) s[i] ^= w[r * 16 + i]; };
  addKey(nr);
  for (let r = nr - 1; r >= 0; r--) {
    const t = s.slice();
    for (let c = 0; c < 4; c++) for (let rr = 0; rr < 4; rr++) s[((c + rr) % 4) * 4 + rr] = t[c * 4 + rr];
    for (let i = 0; i < 16; i++) s[i] = INV[s[i]];
    addKey(r);
    if (r !== 0) {
      for (let c = 0; c < 4; c++) {
        const [a0, a1, a2, a3] = s.subarray(c * 4, c * 4 + 4);
        s[c * 4] = mul(a0, 14) ^ mul(a1, 11) ^ mul(a2, 13) ^ mul(a3, 9);
        s[c * 4 + 1] = mul(a0, 9) ^ mul(a1, 14) ^ mul(a2, 11) ^ mul(a3, 13);
        s[c * 4 + 2] = mul(a0, 13) ^ mul(a1, 9) ^ mul(a2, 14) ^ mul(a3, 11);
        s[c * 4 + 3] = mul(a0, 11) ^ mul(a1, 13) ^ mul(a2, 9) ^ mul(a3, 14);
      }
    }
  }
  return s;
}

// ---------- DES ----------
const IP = [58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4, 62, 54, 46, 38, 30, 22, 14, 6, 64, 56, 48, 40, 32, 24, 16, 8, 57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3, 61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7];
const FP = [40, 8, 48, 16, 56, 24, 64, 32, 39, 7, 47, 15, 55, 23, 63, 31, 38, 6, 46, 14, 54, 22, 62, 30, 37, 5, 45, 13, 53, 21, 61, 29, 36, 4, 44, 12, 52, 20, 60, 28, 35, 3, 43, 11, 51, 19, 59, 27, 34, 2, 42, 10, 50, 18, 58, 26, 33, 1, 41, 9, 49, 17, 57, 25];
const E = [32, 1, 2, 3, 4, 5, 4, 5, 6, 7, 8, 9, 8, 9, 10, 11, 12, 13, 12, 13, 14, 15, 16, 17, 16, 17, 18, 19, 20, 21, 20, 21, 22, 23, 24, 25, 24, 25, 26, 27, 28, 29, 28, 29, 30, 31, 32, 1];
const P = [16, 7, 20, 21, 29, 12, 28, 17, 1, 15, 23, 26, 5, 18, 31, 10, 2, 8, 24, 14, 32, 27, 3, 9, 19, 13, 30, 6, 22, 11, 4, 25];
const PC1 = [57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18, 10, 2, 59, 51, 43, 35, 27, 19, 11, 3, 60, 52, 44, 36, 63, 55, 47, 39, 31, 23, 15, 7, 62, 54, 46, 38, 30, 22, 14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 28, 20, 12, 4];
const PC2 = [14, 17, 11, 24, 1, 5, 3, 28, 15, 6, 21, 10, 23, 19, 12, 4, 26, 8, 16, 7, 27, 20, 13, 2, 41, 52, 31, 37, 47, 55, 30, 40, 51, 45, 33, 48, 44, 49, 39, 56, 34, 53, 46, 42, 50, 36, 29, 32];
const SHIFTS = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];
const S = [
  [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7, 0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8, 4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0, 15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13],
  [15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10, 3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5, 0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15, 13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9],
  [10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8, 13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1, 13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7, 1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12],
  [7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15, 13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9, 10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4, 3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14],
  [2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9, 14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6, 4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14, 11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3],
  [12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11, 10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8, 9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6, 4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13],
  [4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1, 13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6, 1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2, 6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12],
  [13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7, 1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2, 7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8, 2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11],
];
const bits = (bytes) => Array.from({ length: bytes.length * 8 }, (_, i) => (bytes[i >> 3] >> (7 - (i & 7))) & 1);
const perm = (b, table) => table.map((i) => b[i - 1]);
const toBytesB = (b) => Uint8Array.from({ length: b.length / 8 }, (_, i) => b.slice(i * 8, i * 8 + 8).reduce((a, x) => (a << 1) | x, 0));

function desKeys(key) {
  const k = perm(bits(key), PC1);
  let c = k.slice(0, 28), d = k.slice(28);
  return SHIFTS.map((s) => {
    c = [...c.slice(s), ...c.slice(0, s)];
    d = [...d.slice(s), ...d.slice(0, s)];
    return perm([...c, ...d], PC2);
  });
}
function desBlock(subkeys, block, decrypt) {
  const b = perm(bits(block), IP);
  let l = b.slice(0, 32), r = b.slice(32);
  for (let i = 0; i < 16; i++) {
    const k = subkeys[decrypt ? 15 - i : i];
    const x = perm(r, E).map((v, j) => v ^ k[j]);
    const out = [];
    for (let s = 0; s < 8; s++) {
      const six = x.slice(s * 6, s * 6 + 6);
      const v = S[s][(six[0] << 5) | (six[5] << 4) | (six[1] << 3) | (six[2] << 2) | (six[3] << 1) | six[4]];
      out.push((v >> 3) & 1, (v >> 2) & 1, (v >> 1) & 1, v & 1);
    }
    const f = perm(out, P);
    [l, r] = [r, l.map((v, j) => v ^ f[j])];
  }
  return toBytesB(perm([...r, ...l], FP));
}

// ---------- 共通：アルゴリズムをブロック関数にまとめる ----------
function makeCipher(algo, key) {
  if (algo === 'aes') {
    const ks = aesExpand(key);
    return { size: 16, enc: (b) => aesEncryptBlock(ks, b), dec: (b) => aesDecryptBlock(ks, b) };
  }
  if (algo === 'des') {
    if (key.length !== 8) throw new Error(`DES の鍵は 8 バイトです（今は ${key.length} バイト）`);
    const ks = desKeys(key);
    return { size: 8, enc: (b) => desBlock(ks, b, false), dec: (b) => desBlock(ks, b, true) };
  }
  if (algo === '3des') {
    if (key.length !== 16 && key.length !== 24) throw new Error(`3DES の鍵は 16 か 24 バイトです（今は ${key.length} バイト）`);
    const k1 = desKeys(key.subarray(0, 8)), k2 = desKeys(key.subarray(8, 16)), k3 = desKeys(key.length === 24 ? key.subarray(16, 24) : key.subarray(0, 8));
    return {
      size: 8,
      enc: (b) => desBlock(k3, desBlock(k2, desBlock(k1, b, false), true), false),
      dec: (b) => desBlock(k1, desBlock(k2, desBlock(k3, b, true), false), true),
    };
  }
  throw new Error(`未対応の暗号: ${algo}`);
}

const xorInto = (a, b) => a.map((x, i) => x ^ b[i]);

function pad(data, size, mode) {
  if (mode === 'pkcs7') {
    const n = size - (data.length % size);
    const out = new Uint8Array(data.length + n);
    out.set(data);
    out.fill(n, data.length);
    return out;
  }
  if (mode === 'zero' && data.length % size) {
    const out = new Uint8Array(Math.ceil(data.length / size) * size);
    out.set(data);
    return out;
  }
  if (data.length % size) throw new Error(`データの長さが ${size} バイトの倍数ではありません（パディング「なし」のとき）`);
  return data;
}
function unpad(data, size, mode) {
  if (mode === 'pkcs7') {
    const n = data[data.length - 1];
    if (!data.length || n < 1 || n > size || data.subarray(data.length - n).some((x) => x !== n)) {
      throw new Error('パディングが正しくありません。鍵・IV・モードのどれかが違う可能性があります（確かめるならパディングを「なし」に）');
    }
    return data.subarray(0, data.length - n);
  }
  if (mode === 'zero') {
    let e = data.length;
    while (e > 0 && data[e - 1] === 0) e--;
    return data.subarray(0, e);
  }
  return data;
}

// 暗号化・復号。mode: ecb / cbc / ctr / cfb / ofb、padding: pkcs7 / zero / none
export function blockCrypt({ algo, key, iv, mode = 'cbc', padding = 'pkcs7', decrypt = true }, data) {
  // Node の Buffer は slice が元を共有するので、普通の Uint8Array に写してから扱う
  key = Uint8Array.from(key);
  iv = iv ? Uint8Array.from(iv) : iv;
  data = Uint8Array.from(data);
  const c = makeCipher(algo, key);
  const n = c.size;
  const stream = mode === 'ctr' || mode === 'cfb' || mode === 'ofb';
  if (mode !== 'ecb') {
    if (!iv || !iv.length) throw new Error(`${mode.toUpperCase()} モードには IV（${n} バイト）が必要です`);
    if (iv.length !== n) throw new Error(`IV は ${n} バイトです（今は ${iv.length} バイト）`);
  }
  if (!decrypt && !stream) data = pad(data, n, padding);
  if (decrypt && !stream && data.length % n) throw new Error(`暗号文の長さが ${n} バイトの倍数ではありません（${data.length} バイト）。モードや入力の形式（Hex / Base64）を確認してください`);
  const out = new Uint8Array(data.length);
  let prev = iv ? iv.slice() : null;
  for (let o = 0; o < data.length; o += n) {
    const blk = data.subarray(o, o + n);
    let res;
    if (mode === 'ecb') res = decrypt ? c.dec(blk) : c.enc(blk);
    else if (mode === 'cbc') {
      if (decrypt) {
        res = xorInto(c.dec(blk), prev);
        prev = blk.slice();
      } else {
        res = c.enc(xorInto(blk, prev));
        prev = res;
      }
    } else if (mode === 'ctr') {
      res = xorInto(blk, c.enc(prev));
      // カウンタはブロック全体を大きな数として 1 増やす
      for (let i = n - 1; i >= 0; i--) if (++prev[i] <= 255) break; else prev[i] = 0;
    } else if (mode === 'ofb') {
      prev = c.enc(prev);
      res = xorInto(blk, prev);
    } else if (mode === 'cfb') {
      const ks = c.enc(prev);
      res = xorInto(blk, ks);
      prev = (decrypt ? blk : res).slice();
      if (prev.length < n) prev = Uint8Array.from({ length: n }, (_, i) => prev[i] ?? 0);
    } else throw new Error(`未対応のモード: ${mode}`);
    out.set(res.subarray(0, blk.length), o);
  }
  return decrypt && !stream ? unpad(out, n, padding) : out;
}

// RC4（ストリーム暗号。暗号化と復号は同じ処理）
export function rc4(key, data) {
  if (!key.length) throw new Error('鍵を指定してください');
  const s = Uint8Array.from({ length: 256 }, (_, i) => i);
  for (let i = 0, j = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 255;
    [s[i], s[j]] = [s[j], s[i]];
  }
  const out = new Uint8Array(data.length);
  for (let k = 0, i = 0, j = 0; k < data.length; k++) {
    i = (i + 1) & 255;
    j = (j + s[i]) & 255;
    [s[i], s[j]] = [s[j], s[i]];
    out[k] = data[k] ^ s[(s[i] + s[j]) & 255];
  }
  return out;
}

// AES-GCM はブラウザの WebCrypto を使う（タグは暗号文の末尾 16 バイト、または別に指定）
export async function aesGcm({ key, iv, tag, aad, decrypt = true }, data) {
  if (![16, 24, 32].includes(key.length)) throw new Error(`AES の鍵は 16・24・32 バイトです（今は ${key.length} バイト）`);
  if (!iv?.length) throw new Error('GCM モードには IV（ふつうは 12 バイト）が必要です');
  const k = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, [decrypt ? 'decrypt' : 'encrypt']);
  const params = { name: 'AES-GCM', iv, tagLength: 128, ...(aad?.length ? { additionalData: aad } : {}) };
  if (!decrypt) return new Uint8Array(await crypto.subtle.encrypt(params, k, data));
  const body = tag?.length ? new Uint8Array([...data, ...tag]) : data;
  try {
    return new Uint8Array(await crypto.subtle.decrypt(params, k, body));
  } catch {
    throw new Error('GCM の認証に失敗しました。鍵・IV・タグ（暗号文の末尾 16 バイト、または別指定）・追加データが合っているか確認してください');
  }
}
