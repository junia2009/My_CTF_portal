// 実行: node tests/run.mjs
import assert from 'node:assert/strict';
import { createHash, generatePrimeSync } from 'node:crypto';
import { gzipSync, deflateSync } from 'node:zlib';
import * as C from '../js/lib/codecs.js';
import * as X from '../js/lib/ciphers.js';
import { runRecipe } from '../js/lib/recipe.js';
import { magic } from '../js/lib/magic.js';
import { md5, crc32, computeHashes, identifyHash } from '../js/lib/hash.js';
import { decodeJwt } from '../js/lib/jwt.js';
import { findFlags } from '../js/lib/flag.js';
import * as F from '../js/lib/file.js';
import * as R from '../js/lib/rsa.js';
import { cidrInfo, convertTimestamp } from '../js/lib/net.js';
import { identify, parseRsaParams } from '../js/lib/identify.js';

let passed = 0;
const t = async (name, fn) => {
  try {
    await fn();
    passed++;
  } catch (e) {
    console.error('FAIL:', name, '\n ', e.message);
    process.exitCode = 1;
  }
};

const S = 'flag{Hello_CTF_日本語}';
const txt = (b) => C.fromBytes(b);

// ---------- codecs ----------
await t('base64 往復', () => assert.equal(txt(C.b64Decode(C.b64Encode(C.toBytes(S)))), S));
await t('base64 既知値', () => assert.equal(C.b64Encode(C.toBytes('hello')), 'aGVsbG8='));
await t('base64url/パディング無し', () => assert.equal(txt(C.b64Decode('aGVsbG8')), 'hello'));
await t('base32 既知値', () => assert.equal(C.b32Encode(C.toBytes('foobar')), 'MZXW6YTBOI======'));
await t('base32 往復', () => assert.equal(txt(C.b32Decode(C.b32Encode(C.toBytes(S)))), S));
await t('base58 既知値', () => {
  assert.equal(C.b58Encode(C.toBytes('Hello World!')), '2NEpo7TZRRrLZSi2U');
  assert.equal(txt(C.b58Decode('2NEpo7TZRRrLZSi2U')), 'Hello World!');
  assert.deepEqual(Array.from(C.b58Decode(C.b58Encode(Uint8Array.from([0, 0, 1])))), [0, 0, 1]);
});
await t('base85 既知値', () => {
  assert.equal(C.b85Encode(C.toBytes('Man ')), '<~9jqo^~>');
  assert.equal(txt(C.b85Decode('<~9jqo^BlbD-BleB1DJ+*+F(f,q~>')), 'Man is distinguished');
  for (const s of ['', 'a', 'ab', 'abc', 'abcd', '\0\0\0\0x', S]) assert.equal(txt(C.b85Decode(C.b85Encode(C.toBytes(s)) || '<~~>')), s);
});
await t('モールス', () => {
  assert.equal(C.morseEncode('SOS hi'), '... --- ... / .... ..');
  assert.equal(C.morseDecode('... --- ... / .... ..'), 'SOS HI');
});
await t('hex', () => assert.equal(txt(C.hexToBytes('\\x68\\x69')), 'hi'));
await t('2進', () => assert.equal(txt(C.binToBytes(C.bytesToBin(C.toBytes(S)))), S));
await t('10進', () => assert.equal(txt(C.decToBytes('104,105')), 'hi'));
await t('URL', () => assert.equal(C.urlDecode(C.urlEncode(S)), S));
await t('HTML', () => assert.equal(C.htmlDecode(C.htmlEncode('<a href="x">日</a>')), '<a href="x">日</a>'));
await t('Unicode', () => assert.equal(C.unicodeUnescape(C.unicodeEscape(S + '😀')), S + '😀'));
await t('ROT13/ROT47/Atbash', () => {
  assert.equal(C.rot13('Hello'), 'Uryyb');
  assert.equal(C.rot47(C.rot47(S)), S);
  assert.equal(C.atbash('abcXYZ'), 'zyxCBA');
});
await t('基数変換', () => {
  const r = C.convertInteger('0x666c6167');
  assert.equal(r.dec, '1718378855');
  assert.equal(r.ascii, 'flag');
  assert.equal(C.textToInteger('flag'), '1718378855');
});

// ---------- recipe ----------
await t('レシピ（文字列）', async () => {
  const r = await runRecipe('flag', ['b64e', 'hexe', 'hexd', 'b64d', 'rev']);
  assert.equal(txt(r.output), 'galf');
  assert.ok((await runRecipe('!!!', ['b64d'])).error);
});
await t('レシピ（バイナリが壊れない）', async () => {
  const bin = Uint8Array.from([0, 255, 128, 10, 200]);
  const r = await runRecipe(bin, ['b64e', 'b64d', 'rev', 'rev', 'b85e', 'b85d', 'b58e', 'b58d']);
  assert.deepEqual(Array.from(r.output), Array.from(bin));
});
await t('レシピ（引数つき・圧縮）', async () => {
  const r = await runRecipe('flag{x}', [{ id: 'xor', arg: 'k' }, { id: 'xor', arg: 'k' }, { id: 'caesar', arg: '3' }, { id: 'caesar', arg: '-3' }, 'gzip', 'gunzip']);
  assert.equal(txt(r.output), 'flag{x}');
  const z = await runRecipe(deflateSync(Buffer.from('zlib!')), ['inflate']);
  assert.equal(txt(z.output), 'zlib!');
});

// ---------- magic ----------
await t('Magic: 多重エンコード', async () => {
  const enc = C.b64Encode(C.toBytes(C.bytesToHex(C.toBytes(C.b32Encode(C.toBytes('flag{m4g1c_l4y3rs}'))))));
  const r = await magic(enc);
  assert.equal(r[0].flag, 'flag{m4g1c_l4y3rs}', JSON.stringify(r.map((x) => [x.chain, x.text.slice(0, 40)])));
  assert.deepEqual(r[0].chain, ['Base64', 'Hex', 'Base32']);
});
await t('Magic: gzip + ROT13', async () => {
  const enc = C.b64Encode(gzipSync(Buffer.from(C.rot13('flag{gz_then_rot}'))));
  const r = await magic(enc);
  assert.equal(r[0].flag, 'flag{gz_then_rot}', JSON.stringify(r.map((x) => x.chain)));
});
await t('Magic: モールス', async () => {
  const r = await magic(C.morseEncode('HELLO WORLD'));
  assert.equal(r[0].text, 'HELLO WORLD');
});

// ---------- ciphers ----------
const PLAIN = 'It was the best of times it was the worst of times it was the age of wisdom it was the age of foolishness it was the epoch of belief it was the epoch of incredulity it was the season of light';
await t('シーザー総当たり', () => {
  const rows = X.caesarAll(C.caesar('the quick brown fox jumps over the lazy dog', 7));
  assert.equal(rows.reduce((a, b) => (b.score > a.score ? b : a)).shift, 19);
});
await t('Vigenere', () => {
  assert.equal(X.vigenere('ATTACKATDAWN', 'LEMON'), 'LXFOPVEFRNHR');
  assert.equal(X.vigenere('LXFOPVEFRNHR', 'LEMON', true), 'ATTACKATDAWN');
});
await t('Vigenere 自動解読', () => {
  const r = X.vigenereCrack(X.vigenere(PLAIN, 'secret'));
  assert.equal(r.candidates[0].key, 'secret');
  assert.equal(r.candidates[0].plain, PLAIN);
});
await t('Vigenere 自動解読（短めの文章）', () => {
  const short = PLAIN.slice(0, 165);
  const r = X.vigenereCrack(X.vigenere(short, 'lemon'));
  assert.equal(r.candidates[0].key, 'lemon');
});
await t('Affine 総当たり', () => {
  const enc = PLAIN.replace(/[a-z]/gi, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((5 * (c.charCodeAt(0) - base) + 8) % 26) + base);
  });
  const best = X.affineBrute(enc)[0];
  assert.deepEqual([best.a, best.b, best.text], [5, 8, PLAIN]);
});
await t('Rail Fence', () => {
  assert.equal(X.railFenceEncrypt('WEAREDISCOVEREDFLEEATONCE', 3), 'WECRLTEERDSOEEFEAOCAIVDEN');
  assert.equal(X.railFenceDecrypt('WECRLTEERDSOEEFEAOCAIVDEN', 3), 'WEAREDISCOVEREDFLEEATONCE');
  for (let r = 2; r < 8; r++) assert.equal(X.railFenceDecrypt(X.railFenceEncrypt(PLAIN, r), r), PLAIN);
});
await t('換字表', () => {
  assert.equal(X.applySubstitution('Abc!', { A: 'x', B: 'y' }), 'Xy_!');
  assert.equal(Object.values(X.frequencyGuess('zzzy'))[0], 'E');
});
await t('XOR 1バイト総当たり', () => {
  const enc = X.xorBytes(C.toBytes('this is the secret message flag{x0r}'), [0x5a]);
  assert.equal(X.xorBruteSingle(enc)[0].key, 0x5a);
  const short = X.xorBytes(C.toBytes('flag{xor_is_fun}'), [0x42]);
  assert.equal(X.xorBruteSingle(short)[0].key, 0x42);
});
await t('XOR 繰り返し鍵の自動解読', () => {
  const enc = X.xorBytes(C.toBytes(PLAIN), C.toBytes('ICE'));
  const r = X.xorRepeatingCrack(enc);
  assert.equal(C.latin1Decode(r[0].key), 'ICE');
  assert.equal(r[0].text, PLAIN);
});
await t('XOR 既知平文', () => {
  const enc = X.xorBytes(C.toBytes('flag{known_plaintext}'), C.toBytes('k3y'));
  const r = X.xorCrib(enc, C.toBytes('flag{'));
  assert.equal(C.latin1Decode(r[0].key), 'k3yk3');
});

// ---------- hash ----------
await t('MD5 (Node と一致)', () => {
  for (const s of ['', 'a', 'abc', 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64), S.repeat(20)]) {
    assert.equal(md5(C.toBytes(s)), createHash('md5').update(s).digest('hex'), `len=${s.length}`);
  }
});
await t('CRC32 / SHA 系', async () => {
  assert.equal(crc32(C.toBytes('123456789')).toString(16), 'cbf43926');
  const h = await computeHashes(C.toBytes('abc'));
  assert.equal(h['SHA-256'], createHash('sha256').update('abc').digest('hex'));
});
await t('ハッシュ推定', () => {
  assert.ok(identifyHash('900150983cd24fb0d6963f7d28e17f72').includes('MD5'));
  assert.ok(identifyHash('$2b$12$' + 'a'.repeat(53)).includes('bcrypt'));
  assert.deepEqual(identifyHash('zzz'), []);
});

// ---------- JWT / flag ----------
await t('JWT', () => {
  const tok = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  const r = decodeJwt(tok);
  assert.equal(r.header.alg, 'HS256');
  assert.equal(r.payload.name, 'John Doe');
});
await t('フラグ検索', () => {
  const m = findFlags('data: ' + C.b64Encode(C.toBytes('ctf{base64_found}')) + ' ' + C.rot13('flag{rot}')).map((h) => h.match);
  assert.ok(m.includes('ctf{base64_found}'));
  assert.ok(m.includes('flag{rot}'));
});

// ---------- file ----------
function chunk(type, data) {
  const body = Uint8Array.from([...Buffer.from(type), ...data]);
  const len = data.length;
  const crc = crc32(body);
  return [len >>> 24, (len >>> 16) & 255, (len >>> 8) & 255, len & 255, ...body, crc >>> 24, (crc >>> 16) & 255, (crc >>> 8) & 255, crc & 255];
}
const be = (n) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
function makePng(w, h, extra = []) {
  return Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunk('IHDR', [...be(w), ...be(h), 8, 2, 0, 0, 0]),
    ...chunk('IEND', []),
    ...extra,
  ]);
}
await t('ファイル種類・埋め込み・末尾データ', () => {
  const png = makePng(10, 20, [...Buffer.from('PK\x03\x04hidden zip')]);
  assert.equal(F.identifyType(png).ext, 'png');
  const sig = F.scanSignatures(png).map((h) => h.ext);
  assert.deepEqual(sig, ['png', 'zip']);
  const tr = F.findTrailingData(png);
  assert.equal(tr.size, 14);
  assert.equal(F.findTrailingData(makePng(1, 1)), null);
  assert.equal(F.identifyType(C.toBytes('MZWGCZ33NU2GOMLDL53TA4TLON6Q====')), null);
  const pe = new Uint8Array(0x90);
  pe.set(C.toBytes('MZ'));
  pe[0x3c] = 0x80;
  pe.set(C.toBytes('PE\0\0'), 0x80);
  assert.equal(F.identifyType(pe).ext, 'exe');
});
await t('PNG 解析と幅・高さの復元', () => {
  const png = makePng(321, 123);
  const p = F.parsePng(png);
  assert.deepEqual([p.info.width, p.info.height, p.chunks.every((c) => c.crcOk)], [321, 123, true]);
  const broken = png.slice();
  broken.set(be(50), 8 + 8 + 4); // 高さを 50 に書き換え（CRC はそのまま）
  assert.equal(F.parsePng(broken).chunks[0].crcOk, false);
  const fix = F.pngFixDimensions(broken);
  assert.deepEqual([fix.width, fix.height], [321, 123]);
  assert.ok(F.parsePng(fix.fixed).chunks[0].crcOk);
});
await t('文字列抽出・エントロピー・hexdump', () => {
  const b = Uint8Array.from([0, ...Buffer.from('hello world'), 0, 1, ...Buffer.from('w\0i\0d\0e\0!\0')]);
  const s = F.extractStrings(b);
  assert.deepEqual(s.map((x) => [x.enc, x.text]), [['ASCII', 'hello world'], ['UTF-16LE', 'wide!']]);
  assert.equal(F.entropy(new Uint8Array(1024)), 0);
  assert.equal(F.entropy(Uint8Array.from({ length: 256 }, (_, i) => i)), 8);
  assert.match(F.hexdump(C.toBytes('ABC')), /^00000000  41 42 43 .*\|ABC\|$/);
});

// ---------- RSA ----------
const prime = (bits) => generatePrimeSync(bits, { bigint: true });
const nextPrime = (n) => {
  let x = n % 2n ? n + 2n : n + 1n;
  while (!R.isProbablePrime(x)) x += 2n;
  return x;
};
const M = BigInt('0x' + Buffer.from('flag{rsa_ok}').toString('hex'));
await t('RSA 基本（p, q から復号）', () => {
  const p = prime(256), q = prime(256), e = 65537n, n = p * q;
  const c = R.modPow(M, e, n);
  const r = R.solveRsa({ n, e, c, p });
  assert.equal(r.m, M);
  assert.equal(Buffer.from(R.intToBytes(r.m)).toString(), 'flag{rsa_ok}');
});
await t('RSA: Fermat（p と q が近い）', () => {
  const p = prime(512), q = nextPrime(p + 1000n), n = p * q, e = 65537n;
  const r = R.solveRsa({ n, e, c: R.modPow(M, e, n) });
  assert.equal(r.m, M, r.log.join('/'));
});
await t('RSA: Wiener（d が小さい）', () => {
  const p = prime(512), q = prime(512), n = p * q, phi = (p - 1n) * (q - 1n);
  let d = (1n << 60n) + 1n;
  while (R.gcd(d, phi) !== 1n) d += 2n;
  const e = R.modInv(d, phi);
  const r = R.solveRsa({ n, e, c: R.modPow(M, e, n) });
  assert.equal(r.m, M, r.log.join('/'));
});
await t('RSA: 小さい e', () => {
  const n = prime(512) * prime(512);
  const r = R.solveRsa({ n, e: 3n, c: M ** 3n });
  assert.equal(r.m, M, r.log.join('/'));
});
await t('RSA: 小さい素因数 / n が素数', () => {
  const p = 104723n, q = prime(256), n = p * q, e = 65537n;
  assert.equal(R.solveRsa({ n, e, c: R.modPow(M, e, n) }).m, M);
  const np = prime(256);
  assert.equal(R.solveRsa({ n: np, e, c: R.modPow(M, e, np) }).m, M);
});

// ---------- net ----------
await t('CIDR', () => {
  const r = cidrInfo('192.168.10.77/26');
  assert.deepEqual([r.network, r.broadcast, r.first, r.last, r.hosts, r.mask, r.kind], ['192.168.10.64', '192.168.10.127', '192.168.10.65', '192.168.10.126', 62, '255.255.255.192', 'プライベート']);
  assert.equal(cidrInfo('10.0.0.1 255.255.0.0').prefix, 16);
  assert.equal(cidrInfo('8.8.8.8').kind, 'グローバル');
});
await t('タイムスタンプ', () => {
  assert.equal(convertTimestamp('1700000000').at(-1).utc, '2023-11-14T22:13:20.000Z');
  assert.equal(convertTimestamp('1700000000000')[0].utc, '2023-11-14T22:13:20.000Z');
  assert.equal(convertTimestamp('133444736000000000')[0].utc, '2023-11-14T22:13:20.000Z');
  assert.equal(convertTimestamp('2023-11-14T22:13:20Z')[0].unix, 1700000000);
});

// ---------- identify（迷ったら診断） ----------
await t('診断: 形式の推定', () => {
  const top = (s) => { const r = identify(s); return `${r[0].id}:${r[0].title}`; };
  const cases = [
    ['ZmxhZ3t0ZXN0X2Jhc2U2NH0=', 'enc:Base64'],
    ['MZWGCZ33NU2GOMLDL53TA4TLON6Q====', 'enc:Base32'],
    ['66 6c 61 67', 'enc:16進数（Hex）'],
    ['01100110 01101100 01100001 01100111', 'enc:2進数'],
    ['102 108 97 103 123 125', 'enc:10進数の文字コード'],
    ['..-. .-.. .- --.', 'enc:モールス信号'],
    ['hello%20world', 'enc:URL エンコード'],
    ['eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiZ3Vlc3QifQ.abc', 'jwt:'],
    ['192.168.1.10/24', 'ip:'],
    ['1700000000', 'time:'],
    ['the answer is flag{found_it}', 'flag:'],
  ];
  for (const [s, want] of cases) assert.ok(top(s).startsWith(want), `${s} → ${top(s)}`);
  assert.equal(identify('5f4dcc3b5aa765d61d8327deb882cf99')[0].id, 'hash');
  assert.equal(identify('Uryyb jbeyq guvf vf n frperg zrffntr sbe lbh')[0].id, 'caesar');
  assert.equal(identify('Wkh dqvzhu lv kdoi zdb wkurxjk wkh pdc')[0].id, 'caesar');
  assert.equal(identify('This is a secret message for you hello world')[0].id, 'plain');
  assert.equal(identify('Lxfopv ef rnhr lxfopv ef rnhr gsbxs wd zuttfmwi')[0].id, 'classic');
  assert.equal(identify('@@##!!')[0].id, 'unknown');
});
await t('診断: RSA の値を読み取る', () => {
  const r = identify('Here are the params:\nn = 0x1234abcd\ne = 3\nc = 987654321\n');
  assert.equal(r[0].id, 'rsa');
  assert.deepEqual(parseRsaParams('N: 77, E=7, ct = 5'), { n: '77', e: '7', c: '5' });
});

console.log(`${passed} 件成功${process.exitCode ? '（失敗あり）' : ''}`);
