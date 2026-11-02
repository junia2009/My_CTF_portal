// 実行: node tests/run.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as C from '../js/lib/codecs.js';
import * as X from '../js/lib/ciphers.js';
import { md5, computeHashes, identifyHash } from '../js/lib/hash.js';
import { decodeJwt } from '../js/lib/jwt.js';
import { findFlags } from '../js/lib/flag.js';

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

await t('base64 往復', () => assert.equal(C.fromBytes(C.b64Decode(C.b64Encode(C.toBytes(S)))), S));
await t('base64 既知値', () => assert.equal(C.b64Encode(C.toBytes('hello')), 'aGVsbG8='));
await t('base64url/パディング無し', () => assert.equal(C.fromBytes(C.b64Decode('aGVsbG8')), 'hello'));
await t('base32 既知値', () => assert.equal(C.b32Encode(C.toBytes('foobar')), 'MZXW6YTBOI======'));
await t('base32 往復', () => assert.equal(C.fromBytes(C.b32Decode(C.b32Encode(C.toBytes(S)))), S));
await t('hex', () => assert.equal(C.fromBytes(C.hexToBytes('\\x68\\x69')), 'hi'));
await t('2進', () => assert.equal(C.fromBytes(C.binToBytes(C.bytesToBin(C.toBytes(S)))), S));
await t('10進', () => assert.equal(C.fromBytes(C.decToBytes('104,105')), 'hi'));
await t('URL', () => assert.equal(C.urlDecode(C.urlEncode(S)), S));
await t('HTML', () => assert.equal(C.htmlDecode(C.htmlEncode('<a href="x">日</a>')), '<a href="x">日</a>'));
await t('Unicode', () => assert.equal(C.unicodeUnescape(C.unicodeEscape(S + '😀')), S + '😀'));
await t('ROT13', () => assert.equal(C.rot13('Hello'), 'Uryyb'));
await t('ROT47', () => assert.equal(C.rot47(C.rot47(S)), S));
await t('Atbash', () => assert.equal(C.atbash('abcXYZ'), 'zyxCBA'));
await t('基数変換', () => {
  const r = C.convertInteger('0x666c6167');
  assert.equal(r.dec, '1718378855');
  assert.equal(r.ascii, 'flag');
  assert.equal(C.textToInteger('flag'), '1718378855');
});
await t('レシピ', () => {
  const r = C.runRecipe('flag', ['b64e', 'hexe', 'hexd', 'b64d', 'rev']);
  assert.equal(r.output, 'galf');
  assert.ok(C.runRecipe('!!!', ['b64d']).error);
});
await t('シーザー総当たり', () => {
  const rows = X.caesarAll(C.caesar('the quick brown fox jumps over the lazy dog', 7));
  const best = rows.reduce((a, b) => (b.score > a.score ? b : a));
  assert.equal(best.shift, 19);
});
await t('Vigenere', () => {
  assert.equal(X.vigenere('ATTACKATDAWN', 'LEMON'), 'LXFOPVEFRNHR');
  assert.equal(X.vigenere('LXFOPVEFRNHR', 'LEMON', true), 'ATTACKATDAWN');
});
await t('XOR 1バイト総当たり', () => {
  const enc = X.xorBytes(C.toBytes('this is the secret message flag{x0r}'), [0x5a]);
  assert.equal(X.xorBruteSingle(enc)[0].key, 0x5a);
  const short = X.xorBytes(C.toBytes('flag{xor_is_fun}'), [0x42]);
  assert.equal(X.xorBruteSingle(short)[0].key, 0x42);
});
await t('MD5 (Node と一致)', () => {
  for (const s of ['', 'a', 'abc', 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64), S.repeat(20)]) {
    assert.equal(md5(C.toBytes(s)), createHash('md5').update(s).digest('hex'), `len=${s.length}`);
  }
});
await t('SHA 系', async () => {
  const h = await computeHashes(C.toBytes('abc'));
  assert.equal(h['SHA-256'], createHash('sha256').update('abc').digest('hex'));
});
await t('ハッシュ推定', () => {
  assert.ok(identifyHash('900150983cd24fb0d6963f7d28e17f72').includes('MD5'));
  assert.ok(identifyHash('$2b$12$' + 'a'.repeat(53)).includes('bcrypt'));
  assert.deepEqual(identifyHash('zzz'), []);
});
await t('JWT', () => {
  const tok = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  const r = decodeJwt(tok);
  assert.equal(r.header.alg, 'HS256');
  assert.equal(r.payload.name, 'John Doe');
});
await t('フラグ検索', () => {
  const hits = findFlags('data: ' + C.b64Encode(C.toBytes('ctf{base64_found}')) + ' ' + C.rot13('flag{rot}'));
  const m = hits.map((h) => h.match);
  assert.ok(m.includes('ctf{base64_found}'), JSON.stringify(hits));
  assert.ok(m.includes('flag{rot}'), JSON.stringify(hits));
});

console.log(`${passed} 件成功${process.exitCode ? '（失敗あり）' : ''}`);
