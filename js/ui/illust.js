// 使い方パネルの図解：「入力 → 処理 → 結果」を1枚の絵で見せる（すべて SVG で描くオリジナルの図）
const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs = {}, text) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
}
const g = (attrs, ...kids) => {
  const e = el('g', attrs);
  e.append(...kids.flat().filter(Boolean));
  return e;
};
const txt = (x, y, s, cls = '', anchor = 'start', size = null) => el('text', { x, y, class: cls, 'text-anchor': anchor, 'font-size': size }, s);
const rect = (x, y, w, h, cls = '', rx = 3) => el('rect', { x, y, width: w, height: h, rx, class: cls });
const line = (x1, y1, x2, y2, cls = '') => el('line', { x1, y1, x2, y2, class: cls });
const path = (d, cls = '') => el('path', { d, class: cls });
const circle = (cx, cy, r, cls = '') => el('circle', { cx, cy, r, class: cls });

// 全角を2文字分として、指定の幅で折り返す
function wrap(s, max) {
  const out = [];
  for (const para of String(s).split('\n')) {
    let cur = '', w = 0;
    for (const ch of para) {
      const cw = /[\u0000-ÿ]/.test(ch) ? 1 : 2;
      if (w + cw > max && cur) {
        out.push(cur);
        cur = '';
        w = 0;
      }
      cur += ch;
      w += cw;
    }
    out.push(cur);
  }
  return out;
}

// 中央の「処理」の絵。領域は x:230〜490、y:44〜176
const X0 = 230, Y0 = 44, W = 260, H = 132, CX = X0 + W / 2, CY = Y0 + H / 2;
const DRAW = {
  // シーザー暗号：外側の文字の輪と、ずらした内側の輪
  wheel() {
    const r1 = 58, r2 = 40, abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const out = [circle(CX, CY, r1 + 10, 'il-ring'), circle(CX, CY, r2 + 9, 'il-ring dim'), circle(CX, CY, r2 - 9, 'il-ring dim')];
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 - Math.PI / 2;
      const hi = i < 4;
      out.push(txt(CX + Math.cos(a) * r1, CY + Math.sin(a) * r1 + 4, abc[i], hi ? 'il-mono acc' : 'il-mono dim', 'middle', 10));
      out.push(txt(CX + Math.cos(a) * r2, CY + Math.sin(a) * r2 + 3.5, abc[(i + 23) % 26], hi ? 'il-mono hi' : 'il-mono faint', 'middle', 8.5));
    }
    out.push(path(`M ${CX + 76} ${CY - 34} A 80 80 0 0 1 ${CX + 82} ${CY + 10}`, 'il-arrow'), txt(CX + 92, CY - 6, '−3', 'il-label hi', 'start', 11));
    return out;
  },
  // XOR：ビットを重ねる
  xor() {
    const rows = [['入力', '01010001'], ['鍵', '00110111'], ['結果', '01100110']];
    const out = [];
    const x = X0 + 30;
    rows.forEach(([lb, bits], r) => {
      const y = Y0 + 20 + r * 40;
      out.push(txt(x - 6, y + 16, lb, 'il-label', 'end', 10));
      [...bits].forEach((b, i) => {
        out.push(rect(x + i * 26, y, 22, 24, r === 2 ? 'il-cell acc' : r === 1 ? 'il-cell hi' : 'il-cell'));
        out.push(txt(x + i * 26 + 11, y + 17, b, r === 2 ? 'il-mono acc' : 'il-mono', 'middle', 13));
      });
    });
    out.push(txt(x + 220, Y0 + 76, '⊕', 'il-op', 'middle', 15), line(x, Y0 + 98, x + 206, Y0 + 98, 'il-rule'), txt(x + 213, Y0 + 117, '= f', 'il-mono acc', 'start', 12));
    return out;
  },
  // 多重エンコード：玉ねぎの皮をむく
  layers() {
    const names = ['Base64', 'Hex', 'テキスト'];
    const out = [];
    names.forEach((n, i) => {
      const w = 236 - i * 68, h = 120 - i * 40;
      out.push(rect(CX - w / 2, CY - 6 - h / 2, w, h, i === 2 ? 'il-box acc' : 'il-box', 8));
      if (i < 2) out.push(txt(CX, CY - 6 - h / 2 + 14, n, 'il-label', 'middle', 10.5));
    });
    out.push(txt(CX, CY - 1, 'flag{…}', 'il-mono acc', 'middle', 13));
    out.push(txt(CX, Y0 + H + 2, '外側から順に剥がす', 'il-label hi', 'middle', 10));
    return out;
  },
  // 基数変換：同じ値の4つの書き方
  bases() {
    const rows = [['10進', '102'], ['16進', '0x66'], ['2進', '0110 0110'], ['ASCII', "'f'"]];
    return rows.flatMap(([a, b], i) => {
      const y = Y0 + 8 + i * 31;
      return [rect(X0 + 30, y, 200, 25, i === 3 ? 'il-box acc' : 'il-box'), txt(X0 + 42, y + 17, a, 'il-label', 'start', 10.5), txt(X0 + 220, y + 17, b, i === 3 ? 'il-mono acc' : 'il-mono', 'end', 12.5)];
    });
  },
  // RSA：n を p×q に分けると鍵が分かる
  rsa() {
    return [
      rect(CX - 46, Y0 + 6, 92, 30, 'il-box hi'), txt(CX, Y0 + 26, 'n', 'il-mono hi', 'middle', 15),
      line(CX - 20, Y0 + 36, CX - 62, Y0 + 70, 'il-rule'), line(CX + 20, Y0 + 36, CX + 62, Y0 + 70, 'il-rule'),
      rect(CX - 102, Y0 + 70, 80, 28, 'il-box acc'), txt(CX - 62, Y0 + 89, 'p', 'il-mono acc', 'middle', 14),
      rect(CX + 22, Y0 + 70, 80, 28, 'il-box acc'), txt(CX + 62, Y0 + 89, 'q', 'il-mono acc', 'middle', 14),
      txt(CX, Y0 + 90, '×', 'il-op', 'middle', 16),
      txt(CX, Y0 + 124, 'p と q が分かれば 秘密鍵 d が作れる', 'il-label', 'middle', 10.5),
    ];
  },
  // 素因数分解の木
  factor() {
    return [
      rect(CX - 60, Y0 + 4, 120, 26, 'il-box hi'), txt(CX, Y0 + 22, '360', 'il-mono hi', 'middle', 14),
      line(CX - 20, Y0 + 30, CX - 70, Y0 + 58, 'il-rule'), line(CX + 20, Y0 + 30, CX + 70, Y0 + 58, 'il-rule'),
      rect(CX - 100, Y0 + 58, 60, 24, 'il-box'), txt(CX - 70, Y0 + 75, '8', 'il-mono', 'middle', 13),
      rect(CX + 40, Y0 + 58, 60, 24, 'il-box'), txt(CX + 70, Y0 + 75, '45', 'il-mono', 'middle', 13),
      txt(CX, Y0 + 112, '2³ × 3² × 5', 'il-mono acc', 'middle', 15),
    ];
  },
  // ファイル：見た目は画像、後ろに別のファイル
  file() {
    const x = X0 + 40;
    return [
      rect(x, Y0 + 8, 180, 34, 'il-box'), txt(x + 10, Y0 + 30, 'PNG 89 50 4E 47', 'il-mono', 'start', 11),
      rect(x, Y0 + 42, 180, 42, 'il-box dim'), txt(x + 10, Y0 + 67, '画像のデータ', 'il-label', 'start', 10.5),
      rect(x, Y0 + 84, 180, 34, 'il-box hi'), txt(x + 10, Y0 + 106, 'PK 03 04（zip）', 'il-mono hi', 'start', 11),
      path(`M ${x + 186} ${Y0 + 101} l 18 0`, 'il-arrow'), txt(x + 208, Y0 + 98, '隠れた', 'il-label hi', 'start', 9.5), txt(x + 208, Y0 + 110, 'ファイル', 'il-label hi', 'start', 9.5),
    ];
  },
  // ハッシュ：一方通行
  hash() {
    return [
      rect(X0 + 20, CY - 18, 70, 36, 'il-box'), txt(X0 + 55, CY + 5, 'password', 'il-mono', 'middle', 10),
      path(`M ${X0 + 96} ${CY - 6} L ${X0 + 160} ${CY - 6}`, 'il-arrow'), txt(X0 + 128, CY - 14, '計算', 'il-label acc', 'middle', 10),
      path(`M ${X0 + 160} ${CY + 10} L ${X0 + 96} ${CY + 10}`, 'il-arrow dim'), txt(X0 + 128, CY + 28, '戻せない', 'il-label hi', 'middle', 10),
      line(X0 + 120, CY + 2, X0 + 136, CY + 18, 'il-cross'), line(X0 + 136, CY + 2, X0 + 120, CY + 18, 'il-cross'),
      rect(X0 + 166, CY - 18, 84, 36, 'il-box acc'), txt(X0 + 208, CY + 5, '5f4dcc3b…', 'il-mono acc', 'middle', 10),
    ];
  },
  // JWT：3つの部分
  jwt() {
    const parts = [['ヘッダ', 'eyJhbGci', 'acc'], ['中身', 'eyJ1c2Vy', 'hi'], ['署名', 'c2lnbmF0', 'dim']];
    return parts.flatMap(([n, v, c], i) => {
      const x = X0 + 8 + i * 86;
      return [rect(x, Y0 + 30, 80, 38, `il-box ${c}`), txt(x + 40, Y0 + 54, v, `il-mono ${c}`, 'middle', 10), txt(x + 40, Y0 + 88, n, 'il-label', 'middle', 10.5), i < 2 ? txt(x + 83, Y0 + 54, '.', 'il-op', 'middle', 18) : null];
    }).concat([txt(CX, Y0 + 120, '中身は Base64 で読める（暗号ではない）', 'il-label hi', 'middle', 10)]);
  },
  // 長い文章から探す
  scan() {
    const out = [];
    for (let i = 0; i < 6; i++) {
      const y = Y0 + 8 + i * 20;
      const hit = i === 3;
      out.push(rect(X0 + 20, y, hit ? 200 : 140 + ((i * 37) % 60), 10, hit ? 'il-bar acc' : 'il-bar'));
    }
    out.push(circle(X0 + 200, Y0 + 72, 24, 'il-lens'), line(X0 + 217, Y0 + 89, X0 + 236, Y0 + 108, 'il-lens-h'));
    return out;
  },
  // 時刻と IP の範囲
  net() {
    return [
      rect(X0 + 10, Y0 + 10, 240, 30, 'il-box'), txt(X0 + 22, Y0 + 30, '1700000000', 'il-mono', 'start', 12), txt(X0 + 240, Y0 + 30, '→ 2023/11/15', 'il-mono acc', 'end', 11.5),
      txt(X0 + 10, Y0 + 66, '192.168.10.77/26', 'il-mono', 'start', 12),
      rect(X0 + 10, Y0 + 76, 240, 16, 'il-bar'), rect(X0 + 70, Y0 + 76, 60, 16, 'il-bar acc'),
      txt(X0 + 70, Y0 + 108, '.64', 'il-mono acc', 'start', 10), txt(X0 + 130, Y0 + 108, '.127', 'il-mono acc', 'end', 10), txt(X0 + 250, Y0 + 124, '同じネットワークの範囲', 'il-label', 'end', 10),
    ];
  },
  // 画像のビットプレーン
  planes() {
    const out = [];
    for (let i = 0; i < 4; i++) {
      const x = X0 + 14 + i * 62, hit = i === 3;
      out.push(rect(x, Y0 + 20, 54, 54, hit ? 'il-box acc' : 'il-box dim'));
      for (let k = 0; k < 9; k++) out.push(rect(x + 6 + (k % 3) * 15, Y0 + 26 + Math.floor(k / 3) * 15, 12, 12, hit ? ((k * 5) % 3 ? 'il-pix' : 'il-pix on') : (k + i) % 2 ? 'il-pix' : 'il-pix on'));
      out.push(txt(x + 27, Y0 + 92, `bit ${7 - i * 2 > 0 ? 7 - i * 2 : 0}`, hit ? 'il-mono acc' : 'il-mono dim', 'middle', 10));
    }
    out.push(txt(X0 + 14 + 3 * 62 + 27, Y0 + 116, '文字が浮かぶ', 'il-label acc', 'middle', 10));
    return out;
  },
  // 位置特定：写真 → 看板 → 地図
  geo() {
    return [
      rect(X0 + 6, Y0 + 20, 74, 60, 'il-box'), rect(X0 + 16, Y0 + 32, 46, 20, 'il-box acc'), txt(X0 + 39, Y0 + 46, '〒…', 'il-mono acc', 'middle', 9),
      path(`M ${X0 + 86} ${Y0 + 50} l 30 0`, 'il-arrow'),
      rect(X0 + 122, Y0 + 30, 64, 40, 'il-box'), txt(X0 + 154, Y0 + 54, 'TEL 045', 'il-mono', 'middle', 9.5),
      path(`M ${X0 + 192} ${Y0 + 50} l 24 0`, 'il-arrow'),
      path(`M ${X0 + 236} ${Y0 + 78} c -16 -18 -16 -40 0 -40 c 16 0 16 22 0 40 z`, 'il-pin'), circle(X0 + 236, Y0 + 50, 5, 'il-pin-dot'),
      txt(X0 + 43, Y0 + 98, '写真', 'il-label', 'middle', 10), txt(X0 + 154, Y0 + 98, '手がかり', 'il-label', 'middle', 10), txt(X0 + 236, Y0 + 98, '地図', 'il-label acc', 'middle', 10),
    ];
  },
  // 音声：波形 → スペクトログラム
  audio() {
    let d = `M ${X0 + 6} ${Y0 + 40}`;
    for (let i = 0; i <= 90; i++) d += ` L ${X0 + 6 + i} ${Y0 + 40 + Math.sin(i * 0.7) * (8 + (i % 13))}`;
    return [
      path(d, 'il-wave'),
      path(`M ${X0 + 104} ${Y0 + 40} l 26 0`, 'il-arrow'),
      rect(X0 + 136, Y0 + 6, 118, 90, 'il-box dark'),
      txt(X0 + 195, Y0 + 58, 'FLAG', 'il-glow', 'middle', 24),
      txt(X0 + 48, Y0 + 110, '耳で聞く音', 'il-label', 'middle', 10), txt(X0 + 195, Y0 + 116, '周波数を「絵」にする', 'il-label acc', 'middle', 10),
    ];
  },
  // 通信：パケット → 会話
  packets() {
    const out = [];
    for (let i = 0; i < 5; i++) out.push(rect(X0 + 6, Y0 + 6 + i * 22, 70, 16, i === 3 ? 'il-box acc' : 'il-box'), txt(X0 + 14, Y0 + 18 + i * 22, ['DNS', 'TCP', 'TCP', 'HTTP', 'TCP'][i], i === 3 ? 'il-mono acc' : 'il-mono dim', 'start', 9.5));
    out.push(path(`M ${X0 + 84} ${Y0 + 60} l 34 0`, 'il-arrow'));
    out.push(rect(X0 + 126, Y0 + 14, 128, 34, 'il-box'), txt(X0 + 134, Y0 + 35, 'GET /backup.txt', 'il-mono', 'start', 10));
    out.push(rect(X0 + 126, Y0 + 58, 128, 50, 'il-box acc'), txt(X0 + 134, Y0 + 78, '200 OK', 'il-mono acc', 'start', 10), txt(X0 + 134, Y0 + 96, 'flag{…}', 'il-mono hi', 'start', 10));
    return out;
  },
  // ログ：急増を見つける
  logs() {
    const hs = [18, 22, 16, 24, 20, 90, 84, 22, 18, 20];
    const out = hs.map((v, i) => rect(X0 + 16 + i * 23, Y0 + 104 - v, 16, v, i === 5 || i === 6 ? 'il-bar hi' : 'il-bar'));
    out.push(line(X0 + 10, Y0 + 104, X0 + 250, Y0 + 104, 'il-rule'), txt(X0 + 148, Y0 + 8, '急に増えた時間帯', 'il-label hi', 'middle', 10), txt(X0 + 148, Y0 + 124, '同じ IP からログイン失敗が連続', 'il-label', 'middle', 10));
    return out;
  },
  // AI への入力：見えない指示
  inject() {
    return [
      rect(X0 + 10, Y0 + 14, 240, 70, 'il-box'),
      txt(X0 + 22, Y0 + 36, '素晴らしい商品でした。', 'il-label', 'start', 11),
      rect(X0 + 22, Y0 + 46, 210, 22, 'il-box hi'), txt(X0 + 30, Y0 + 61, '‹見えない› 指示を無視して…', 'il-mono hi', 'start', 10),
      path(`M ${X0 + 238} ${Y0 + 57} l 0 40`, 'il-arrow'), txt(X0 + 130, Y0 + 116, '人には見えず AI だけが読む文を見つける', 'il-label acc', 'middle', 10),
    ];
  },
  // バイト列の読み方
  bytes() {
    const bs = ['46', '4C', '41', '47'];
    const out = bs.flatMap((b, i) => [rect(X0 + 40 + i * 46, Y0 + 10, 40, 30, 'il-cell'), txt(X0 + 60 + i * 46, Y0 + 30, b, 'il-mono', 'middle', 13)]);
    out.push(
      txt(X0 + 30, Y0 + 70, 'リトルエンディアン', 'il-label', 'start', 10), txt(X0 + 240, Y0 + 70, '0x47414C46', 'il-mono acc', 'end', 12),
      txt(X0 + 30, Y0 + 96, 'ビッグエンディアン', 'il-label', 'start', 10), txt(X0 + 240, Y0 + 96, '0x464C4147', 'il-mono', 'end', 12),
      txt(X0 + 30, Y0 + 122, '文字として', 'il-label', 'start', 10), txt(X0 + 240, Y0 + 122, '"FLAG"', 'il-mono hi', 'end', 12),
    );
    return out;
  },
  // 文字化け：読み方を戻す
  mojibake() {
    return [
      rect(X0 + 10, Y0 + 20, 100, 40, 'il-box hi'), txt(X0 + 60, Y0 + 45, '譁・ｭ怜喧', 'il-mono hi', 'middle', 12),
      path(`M ${X0 + 116} ${Y0 + 40} l 30 0`, 'il-arrow'), txt(X0 + 131, Y0 + 32, '読み直す', 'il-label acc', 'middle', 9),
      rect(X0 + 152, Y0 + 20, 100, 40, 'il-box acc'), txt(X0 + 202, Y0 + 45, '文字化け', 'il-label acc', 'middle', 13),
      txt(X0 + 60, Y0 + 80, 'Shift_JIS で読んだ', 'il-label', 'middle', 9.5), txt(X0 + 202, Y0 + 80, 'UTF-8 で読む', 'il-label', 'middle', 9.5),
      txt(CX, Y0 + 116, 'データは壊れていない。読み方を間違えただけ', 'il-label', 'middle', 10),
    ];
  },
  // 差分
  diff() {
    const rows = [['the key is in', 0], ['the blue cabinet', 1], ['meeting at noon', 0]];
    return rows.flatMap(([t, d], i) => {
      const y = Y0 + 14 + i * 30;
      return [
        rect(X0 + 6, y, 120, 22, d ? 'il-box del' : 'il-box'), txt(X0 + 12, y + 15, d ? 'the blue cabinet' : t, 'il-mono', 'start', 9.5),
        rect(X0 + 134, y, 120, 22, d ? 'il-box acc' : 'il-box'), txt(X0 + 140, y + 15, d ? 'the {blue} cab1net' : t, d ? 'il-mono acc' : 'il-mono', 'start', 9.5),
      ];
    }).concat([txt(X0 + 66, Y0 + 122, 'A', 'il-label', 'middle', 11), txt(X0 + 194, Y0 + 122, 'B（違うところが光る）', 'il-label acc', 'middle', 10)]);
  },
  // 正規表現
  regex() {
    return [
      rect(X0 + 10, Y0 + 8, 240, 26, 'il-box acc'), txt(X0 + 20, Y0 + 26, '/flag\\{[^}]+\\}/', 'il-mono acc', 'start', 12),
      rect(X0 + 10, Y0 + 46, 240, 70, 'il-box'),
      txt(X0 + 20, Y0 + 66, 'noise ', 'il-mono dim', 'start', 10.5), rect(X0 + 62, Y0 + 54, 92, 16, 'il-mark'), txt(X0 + 64, Y0 + 66, 'flag{one}', 'il-mono', 'start', 10.5),
      txt(X0 + 20, Y0 + 88, 'abc ', 'il-mono dim', 'start', 10.5), rect(X0 + 48, Y0 + 76, 92, 16, 'il-mark'), txt(X0 + 50, Y0 + 88, 'flag{two}', 'il-mono', 'start', 10.5),
      txt(X0 + 20, Y0 + 108, 'flag{ 閉じていない', 'il-mono dim', 'start', 10.5),
    ];
  },
  // バイナリ解析
  rev() {
    return [
      rect(X0 + 4, Y0 + 14, 72, 84, 'il-box'), txt(X0 + 40, Y0 + 32, '7F 45 4C', 'il-mono dim', 'middle', 9), txt(X0 + 40, Y0 + 48, '48 89 E5', 'il-mono dim', 'middle', 9), txt(X0 + 40, Y0 + 64, '83 F0 37', 'il-mono dim', 'middle', 9), txt(X0 + 40, Y0 + 80, '…', 'il-mono dim', 'middle', 9),
      path(`M ${X0 + 80} ${Y0 + 56} l 14 0`, 'il-arrow'),
      rect(X0 + 98, Y0 + 14, 70, 84, 'il-box'), txt(X0 + 104, Y0 + 34, 'mov', 'il-mono', 'start', 9.5), txt(X0 + 104, Y0 + 52, 'xor 0x37', 'il-mono hi', 'start', 9.5), txt(X0 + 104, Y0 + 70, 'cmp', 'il-mono', 'start', 9.5), txt(X0 + 104, Y0 + 88, 'jne', 'il-mono', 'start', 9.5),
      path(`M ${X0 + 172} ${Y0 + 56} l 14 0`, 'il-arrow'),
      rect(X0 + 190, Y0 + 14, 66, 84, 'il-box acc'), txt(X0 + 196, Y0 + 36, 'if (', 'il-mono acc', 'start', 9.5), txt(X0 + 196, Y0 + 54, ' c^0x37', 'il-mono acc', 'start', 9.5), txt(X0 + 196, Y0 + 72, ' != enc)', 'il-mono acc', 'start', 9.5),
      txt(X0 + 40, Y0 + 116, '機械語', 'il-label', 'middle', 10), txt(X0 + 133, Y0 + 116, '命令', 'il-label', 'middle', 10), txt(X0 + 223, Y0 + 116, '疑似コード', 'il-label acc', 'middle', 10),
    ];
  },
  // メモ
  notes() {
    const cards = [['XOR の問題', '解決', 'acc'], ['Web ログイン', '着手中', 'hi'], ['pcap 解析', '未着手', 'dim']];
    return cards.flatMap(([t, s, c], i) => {
      const y = Y0 + 6 + i * 40;
      return [rect(X0 + 20, y, 220, 32, `il-box ${c}`), txt(X0 + 32, y + 21, t, 'il-label', 'start', 11), txt(X0 + 228, y + 21, s, `il-label ${c}`, 'end', 10)];
    });
  },
  // チートシート：端末
  terminal() {
    return [
      rect(X0 + 10, Y0 + 8, 240, 112, 'il-box dark'),
      circle(X0 + 22, Y0 + 20, 3.5, 'il-dot'), circle(X0 + 34, Y0 + 20, 3.5, 'il-dot'), circle(X0 + 46, Y0 + 20, 3.5, 'il-dot'),
      txt(X0 + 22, Y0 + 48, '$ strings file | grep flag', 'il-term', 'start', 10.5),
      txt(X0 + 22, Y0 + 70, 'flag{...}', 'il-term acc', 'start', 10.5),
      txt(X0 + 22, Y0 + 96, '$ ▍', 'il-term', 'start', 10.5),
      txt(X0 + 240, Y0 + 112, 'クリックでコピー', 'il-label acc', 'end', 9.5),
    ];
  },
};

// 各ツールの図の内容（入力・処理・結果・ポイント）
export const ILLUST = {
  codec: { draw: 'layers', in: 'NjY2YzYx…', op: '何重もの変換を外側から戻す', out: 'flag{w3lc0m3}', point: '何の形式か分からなければ、まず「解析する（Magic）」' },
  base: { draw: 'bases', in: '0x666c6167', op: '数の書き方を変える', out: 'flag', point: '0x は16進数。ASCII の行に文字が出たら当たり' },
  classic: { draw: 'wheel', in: 'iodj{khoor}', op: 'アルファベットを3つ戻す', out: 'flag{hello}', point: '全部のずらし方を並べて、英語として読める行を探す' },
  xor: { draw: 'xor', in: '51 5b 56 50 …', op: '同じ鍵でもう一度 XOR', out: 'flag{…}', point: 'flag{ で始まると分かっていれば、鍵を逆算できる' },
  rsa: { draw: 'rsa', in: 'n, e, c', op: 'n を素因数分解する', out: '平文 m', point: '分かる値だけ入れて「解く」。弱い設定を自動で試す' },
  math: { draw: 'factor', in: '360', op: '素数の積に分ける', out: '2³×3²×5', point: 'RSA の n や、逆元・中国剰余定理の計算に使う' },
  file: { draw: 'file', in: 'image.png', op: '中身の形式と隠れたデータを調べる', out: '埋め込まれた zip', point: '拡張子は嘘をつく。先頭と末尾のバイトを確認' },
  hash: { draw: 'hash', in: 'password', op: '一方向の計算', out: '5f4dcc3b…', point: '元に戻せない。候補を計算して一致を探す' },
  jwt: { draw: 'jwt', in: 'eyJhbGci…', op: '3つに分けて読む', out: '{"user":"guest"}', point: 'alg や権限の値に不自然な点がないか確認' },
  flag: { draw: 'scan', in: '長いログ', op: 'flag{…} の形を探す', out: 'flag{l0g}', point: 'Base64 やシーザーで隠れたものも探せる' },
  net: { draw: 'net', in: '1700000000', op: '数字の意味を読み解く', out: '2023/11/15', point: 'ログの数字は時刻のことが多い。IP は範囲で考える' },
  image: { draw: 'planes', in: 'image.png', op: '色の各ビットを白黒で見る', out: '隠れた文字', point: '下位ビット（bit 0〜1）に文字や模様が浮かぶか見る' },
  geo: { draw: 'geo', in: '街角の写真', op: '看板・電話番号を読む', out: '撮影場所', point: 'EXIF の GPS → 看板の文字 → 景色の順で絞る' },
  audio: { draw: 'audio', in: 'sound.wav', op: 'スペクトログラムにする', out: '絵に浮かぶ文字', point: '耳で分からない音は、目で見る' },
  pcap: { draw: 'packets', in: 'capture.pcap', op: '会話として組み立てる', out: '送られたファイル', point: 'HTTP・DNS など暗号化されていない通信から見る' },
  logs: { draw: 'logs', in: 'access.log', op: '時間帯と IP で集計', out: '攻撃した IP', point: '急に増えた時間帯と、失敗の多い IP に注目' },
  pinject: { draw: 'inject', in: 'Web ページの文章', op: '見えない文字・隠れた指示を検出', out: '危険度と無害化した文', point: 'AI に渡す前に、人に見えない部分を確認する' },
  binview: { draw: 'bytes', in: '46 4C 41 47', op: '数・文字として読む', out: '0x47414C46', point: 'エンディアン（並び順）を変えると値が変わる' },
  mojibake: { draw: 'mojibake', in: '譁・ｭ怜喧', op: '文字コードを読み直す', out: '文字化け', point: '「縺」「ã」のような字は、読み方の取り違えのサイン' },
  diff: { draw: 'diff', in: 'A と B', op: '違いだけを取り出す', out: '書き換えられた所', point: '違う文字だけを並べると、メッセージになっていることも' },
  regex: { draw: 'regex', in: 'パターン', op: 'マッチする所を光らせる', out: '一致した文字列', point: '「よく使う」からフラグ形式のパターンを選べる' },
  rev: { draw: 'rev', in: 'crackme', op: '機械語 → 命令 → 疑似コード', out: '判定の条件', point: '文字列から判定の場所へ飛び、比べている値を読む' },
  notes: { draw: 'notes', in: '問題名・メモ', op: '状態とフラグを記録', out: 'チームで共有', point: '試したことを残すと、同じことを二度しなくて済む' },
  cheatsheet: { draw: 'terminal', in: 'やりたいこと', op: 'ジャンルとキーワードで探す', out: 'コマンド', point: '< > の部分は自分の値に置き換える' },
};

let seq = 0;
// 1枚の図を作る
export function illustration(id) {
  const spec = ILLUST[id];
  if (!spec) return null;
  const svg = el('svg', { viewBox: '0 0 720 230', class: 'illust', role: 'img', 'aria-label': `図解：${spec.in} → ${spec.op} → ${spec.out}` });
  const card = (x, label, value, cls) => {
    const lines = wrap(value, 16).slice(0, 3);
    return g({ class: `il-card ${cls}` },
      rect(x, 44, 196, 132, 'il-panel', 6),
      path(`M ${x} 58 L ${x} 44 L ${x + 14} 44`, 'il-corner'),
      txt(x + 16, 68, label, 'il-tag', 'start', 10),
      ...lines.map((l, i) => txt(x + 98, 116 + (i - (lines.length - 1) / 2) * 20, l, 'il-value', 'middle', 15)),
    );
  };
  svg.append(
    rect(0.5, 0.5, 719, 229, 'il-frame', 8),
    txt(360, 28, spec.op, 'il-title', 'middle', 15),
    card(14, 'INPUT', spec.in, 'in'),
    card(510, 'OUTPUT', spec.out, 'out'),
    path('M 214 110 L 226 110', 'il-arrow'),
    path('M 494 110 L 506 110', 'il-arrow'),
    g({ class: 'il-draw' }, DRAW[spec.draw]?.() ?? []),
    line(14, 192, 706, 192, 'il-sep'),
    txt(14, 214, 'POINT', 'il-tag', 'start', 10),
    txt(68, 214, spec.point, 'il-point', 'start', 12.5),
  );
  const mid = `il-arrow-${++seq}`;
  const marker = el('marker', { id: mid, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' });
  marker.append(path('M0 0L10 5L0 10z', 'il-head'));
  const defs = el('defs');
  defs.append(marker);
  svg.prepend(defs);
  svg.querySelectorAll('.il-arrow').forEach((a) => a.setAttribute('marker-end', `url(#${mid})`));
  return svg;
}
