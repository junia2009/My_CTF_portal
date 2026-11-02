// 変換レシピ：すべての操作をバイト列 → バイト列で行うので、途中でバイナリになっても壊れない
import {
  toBytes, latin1Decode, bytesToText, isUtf8,
  b64Encode, b64Decode, b32Encode, b32Decode, b58Encode, b58Decode, b85Encode, b85Decode,
  bytesToHex, hexToBytes, bytesToBin, binToBytes, bytesToDec, decToBytes,
  htmlEncode, htmlDecode, unicodeEscape, unicodeUnescape, morseEncode, morseDecode, reverse,
} from './codecs.js';

// 文字列として扱う操作（入力が UTF-8 でなければ 1バイト1文字として扱う）
const asText = (f) => (b) => toBytes(f(bytesToText(b)));
// エンコード結果などの「中身が ASCII のテキスト」を読む
const asAscii = (f) => (b) => f(latin1Decode(b));

const mapAscii = (f) => (b) => b.map(f);
const shiftLetter = (k) => (x) => {
  if (x >= 65 && x <= 90) return ((x - 65 + k) % 26) + 65;
  if (x >= 97 && x <= 122) return ((x - 97 + k) % 26) + 97;
  return x;
};

export async function streamTransform(bytes, stream) {
  const piped = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(piped).arrayBuffer());
}
const decompress = (fmt) => async (b) => {
  try {
    return await streamTransform(b, new DecompressionStream(fmt));
  } catch {
    throw new Error(`${fmt} として展開できませんでした`);
  }
};
const compress = (fmt) => (b) => streamTransform(b, new CompressionStream(fmt));

export function parseKey(s) {
  const t = s.trim();
  if (/^0x[0-9a-f\s]+$/i.test(t) || /^(\\x[0-9a-f]{2})+$/i.test(t)) return hexToBytes(t);
  return toBytes(s);
}

function urlEncodeBytes(b) {
  let out = '';
  for (const x of b) {
    const c = String.fromCharCode(x);
    out += /[A-Za-z0-9\-_.~]/.test(c) ? c : '%' + x.toString(16).toUpperCase().padStart(2, '0');
  }
  return toBytes(out);
}

function urlDecodeBytes(b) {
  const out = [];
  const hex = (x) => (x >= 48 && x <= 57) || (x >= 65 && x <= 70) || (x >= 97 && x <= 102);
  for (let i = 0; i < b.length; i++) {
    if (b[i] === 0x25 && hex(b[i + 1]) && hex(b[i + 2])) {
      out.push(parseInt(String.fromCharCode(b[i + 1], b[i + 2]), 16));
      i += 2;
    } else out.push(b[i] === 0x2b ? 0x20 : b[i]);
  }
  return Uint8Array.from(out);
}

export const OPS = [
  { id: 'b64e', group: 'エンコード', name: 'Base64 エンコード', fn: (b) => toBytes(b64Encode(b)) },
  { id: 'b64d', group: 'デコード', name: 'Base64 デコード', fn: asAscii(b64Decode) },
  { id: 'b32e', group: 'エンコード', name: 'Base32 エンコード', fn: (b) => toBytes(b32Encode(b)) },
  { id: 'b32d', group: 'デコード', name: 'Base32 デコード', fn: asAscii(b32Decode) },
  { id: 'b58e', group: 'エンコード', name: 'Base58 エンコード', fn: (b) => toBytes(b58Encode(b)) },
  { id: 'b58d', group: 'デコード', name: 'Base58 デコード', fn: asAscii(b58Decode) },
  { id: 'b85e', group: 'エンコード', name: 'Base85 エンコード', fn: (b) => toBytes(b85Encode(b)) },
  { id: 'b85d', group: 'デコード', name: 'Base85 デコード', fn: asAscii(b85Decode) },
  { id: 'hexe', group: 'エンコード', name: 'Hex エンコード', fn: (b) => toBytes(bytesToHex(b)) },
  { id: 'hexd', group: 'デコード', name: 'Hex デコード', fn: asAscii(hexToBytes) },
  { id: 'bine', group: 'エンコード', name: '2進数 エンコード', fn: (b) => toBytes(bytesToBin(b)) },
  { id: 'bind', group: 'デコード', name: '2進数 デコード', fn: asAscii(binToBytes) },
  { id: 'dece', group: 'エンコード', name: '10進数 エンコード', fn: (b) => toBytes(bytesToDec(b)) },
  { id: 'decd', group: 'デコード', name: '10進数 デコード', fn: asAscii(decToBytes) },
  { id: 'urle', group: 'エンコード', name: 'URL エンコード', fn: urlEncodeBytes },
  { id: 'urld', group: 'デコード', name: 'URL デコード', fn: urlDecodeBytes },
  { id: 'htmle', group: 'エンコード', name: 'HTML エンティティ化', fn: asText(htmlEncode) },
  { id: 'htmld', group: 'デコード', name: 'HTML エンティティ解除', fn: asText(htmlDecode) },
  { id: 'unie', group: 'エンコード', name: 'Unicode エスケープ', fn: asText(unicodeEscape) },
  { id: 'unid', group: 'デコード', name: 'Unicode エスケープ解除', fn: asText(unicodeUnescape) },
  { id: 'morsee', group: 'エンコード', name: 'モールス信号 エンコード', fn: asText(morseEncode) },
  { id: 'morsed', group: 'デコード', name: 'モールス信号 デコード', fn: asText(morseDecode) },
  { id: 'gzip', group: '圧縮', name: 'gzip 圧縮', fn: compress('gzip') },
  { id: 'gunzip', group: '圧縮', name: 'gzip 展開', fn: decompress('gzip') },
  { id: 'inflate', group: '圧縮', name: 'zlib 展開', fn: decompress('deflate') },
  { id: 'inflateRaw', group: '圧縮', name: 'raw deflate 展開', fn: decompress('deflate-raw') },
  { id: 'rot13', group: '文字操作', name: 'ROT13', fn: mapAscii(shiftLetter(13)) },
  {
    id: 'caesar', group: '文字操作', name: 'シーザー（シフト指定）', param: { label: 'シフト量', default: '3' },
    fn: (b, arg) => {
      const n = parseInt(arg, 10);
      if (Number.isNaN(n)) throw new Error('シフト量は整数で指定してください');
      return mapAscii(shiftLetter(((n % 26) + 26) % 26))(b);
    },
  },
  { id: 'rot47', group: '文字操作', name: 'ROT47', fn: mapAscii((x) => (x >= 33 && x <= 126 ? 33 + ((x - 33 + 47) % 94) : x)) },
  {
    id: 'atbash', group: '文字操作', name: 'Atbash',
    fn: mapAscii((x) => (x >= 65 && x <= 90 ? 155 - x : x >= 97 && x <= 122 ? 219 - x : x)),
  },
  {
    id: 'xor', group: '文字操作', name: 'XOR（鍵指定）', param: { label: '鍵（0x… で16進）', default: '0x20' },
    fn: (b, arg) => {
      const key = parseKey(arg ?? '');
      if (!key.length) throw new Error('鍵を指定してください');
      return b.map((x, i) => x ^ key[i % key.length]);
    },
  },
  { id: 'rev', group: '文字操作', name: '反転', fn: (b) => (isUtf8(b) ? toBytes(reverse(bytesToText(b))) : b.slice().reverse()) },
  { id: 'upper', group: '文字操作', name: '大文字に変換', fn: mapAscii((x) => (x >= 97 && x <= 122 ? x - 32 : x)) },
  { id: 'lower', group: '文字操作', name: '小文字に変換', fn: mapAscii((x) => (x >= 65 && x <= 90 ? x + 32 : x)) },
  { id: 'trim', group: '文字操作', name: '空白・改行を除去', fn: (b) => b.filter((x) => ![9, 10, 13, 32].includes(x)) },
];

export const getOp = (id) => OPS.find((o) => o.id === id);

// items: ['b64d', { id: 'xor', arg: 'key' }, ...]
export async function runRecipe(input, items) {
  let cur = typeof input === 'string' ? toBytes(input) : input;
  const steps = [];
  for (const it of items) {
    const { id, arg } = typeof it === 'string' ? { id: it, arg: undefined } : it;
    const op = getOp(id);
    if (!op) return { output: null, steps, error: `不明な操作: ${id}` };
    try {
      cur = await op.fn(cur, arg ?? op.param?.default);
      steps.push({ op, ok: true, out: cur });
    } catch (e) {
      steps.push({ op, ok: false, error: e.message });
      return { output: null, steps, error: `「${op.name}」で失敗: ${e.message}` };
    }
  }
  return { output: cur, steps, error: null };
}
