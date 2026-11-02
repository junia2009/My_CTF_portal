// 「例を試す」で読み込むサンプル問題（すべてこのポータル用のオリジナル）
import { crc32 } from '../lib/hash.js';
import { streamTransform } from '../lib/recipe.js';

const b64url = (o) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// 高さを書き換えた PNG の末尾に、フラグ入りのデータを付け足したサンプル
async function samplePng() {
  const be = (n) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const chunk = (type, data) => {
    const body = new Uint8Array([...new TextEncoder().encode(type), ...data]);
    return [...be(data.length), ...body, ...be(crc32(body))];
  };
  const W = 96, H = 48;
  const raw = new Uint8Array((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = y * (W * 3 + 1) + 1 + x * 3;
      raw[o] = 10 + x;
      raw[o + 1] = 40 + y * 3;
      raw[o + 2] = 120 + ((x + y) % 2) * 60;
    }
  }
  const idat = await streamTransform(raw, new CompressionStream('deflate'));
  const ihdr = chunk('IHDR', [...be(W), ...be(H), 8, 2, 0, 0, 0]);
  const png = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...ihdr,
    ...chunk('tEXt', [...new TextEncoder().encode('Comment\0Nothing to see here')]),
    ...chunk('IDAT', idat),
    ...chunk('IEND', []),
    ...new TextEncoder().encode('\n-- appended --\nsecret note: flag{l00k_b3h1nd_th3_3nd}\n'),
  ]);
  png.set(be(24), 8 + 8 + 4); // 高さを 48 → 24 に書き換え（CRC はそのまま）
  return new File([png], 'sample_challenge.png', { type: 'image/png' });
}

export const SAMPLES = {
  codec: () => ({ text: 'NjY2YzYxNjc3Yjc3MzM2YzYzMzA2ZDMzNWY3NDMwNWY2Mzc0NjY3ZA==', magic: true }),
  base: () => ({ text: '0x666c61677b6e756d6233727d' }),
  classic: () => ({ text: 'Gur synt vf: synt{pnrfne_vf_gur_byqrfg_pvcure}. Pbatenghyngvbaf ba lbhe svefg pelcgb!', tab: 'caesar' }),
  xor: () => ({ text: '3c363b3d21226a28052d6b2e32056a34690538232e6927', fmt: 'hex', tab: 'single' }),
  rsa: () => ({
    n: '174703981915972887263014042850135508627379250082407923212530954463694504560746802452181156010706225722620853794220533181107626714797017654078553660909858308092710620348907594979410076539380344068254341103795072970551350714157059396661548611425163819185904091145449592120444236257737081801597743779190319758483',
    e: '3',
    c: '944136490036842870932030890292594214367268171017870206511529719486038619294365665488469534539532319422722305501049047675147443035484136299594991497549238524379007333',
    run: true,
  }),
  file: samplePng,
  hash: () => ({ text: 'password', id: '5f4dcc3b5aa765d61d8327deb882cf99' }),
  jwt: () => ({ text: `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ user: 'guest', role: 'user', iat: 1700000000, exp: 1700003600 })}.c2FtcGxlLXNpZ25hdHVyZQ` }),
  flag: () => ({
    text: [
      '2026-11-02 10:00:01 INFO  user=alice action=login result=ok',
      '2026-11-02 10:00:07 WARN  user=bob action=login result=fail',
      '2026-11-02 10:01:13 INFO  user=carol action=upload file=report.pdf',
      '2026-11-02 10:02:45 DEBUG token=ZmxhZ3tsMGdfZDFnX3N1Y2Mzc3N9 session=7f3a',
      '2026-11-02 10:03:02 INFO  user=alice action=logout',
    ].join('\n'),
  }),
  net: () => ({ cidr: '192.168.10.77/26', ts: '1700000000' }),
};
