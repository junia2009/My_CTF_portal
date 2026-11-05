// 学ぶ：暗号のテキストの図（すべて SVG のオリジナル）と、練習用の部品（シーザー・XOR・小さな RSA・ハッシュ）
import { h } from './common.js';
import { s, T, R, L, A, frame, pc } from './netfig.js';

// 鍵と錠前の小さな絵
const key = (cx, cy, cls = '') => [s('circle', { cx: cx - 12, cy, r: 7, class: `nf-key ${cls}` }), s('path', { d: `M${cx - 5} ${cy} h20 M${cx + 9} ${cy} v6 M${cx + 15} ${cy} v5`, class: `nf-key-l ${cls}` })];
const lock = (cx, cy, cls = '') => [s('path', { d: `M${cx - 8} ${cy - 4} v-6 a8 8 0 0 1 16 0 v6`, class: `nf-key-l ${cls}` }), R(cx - 12, cy - 4, 24, 18, `nf-lock ${cls}`, 3)];
const doc = (x, y, w, hh, label, cls = 'nf-box') => [R(x, y, w, hh, cls, 4), T(x + w / 2, y + hh / 2 + 4, label, 'nf-t mono')];
const wrapT = (cx, y, str, n, cls = 'nf-t small') => {
  const out = [];
  for (let i = 0; i < str.length; i += n) out.push(T(cx, y + (i / n) * 15, str.slice(i, i + n), cls));
  return out;
};

export const CRYPTO_FIGURES = {
  // エンコード・暗号化・ハッシュの違い
  three() {
    const cols = [
      ['エンコード', 'Base64・Hex・URL', 'flag', 'ZmxhZw==', '誰でも戻せる（鍵なし）', '形を変えるだけ。秘密は守れない', 'l-data'],
      ['暗号化', 'AES・RSA', 'flag', '9f3a…c1', '鍵を持つ人だけ戻せる', '秘密を守る', 'l-app'],
      ['ハッシュ', 'SHA-256・bcrypt', 'flag', '807d0fbc…', '戻せない（一方向）', '同じかどうかの確認・改ざん検知', 'l-net'],
    ];
    const kids = [];
    cols.forEach(([name, ex, inp, out, rev, use, cls], i) => {
      const x = 14 + i * 236;
      kids.push(R(x, 14, 220, 270, `nf-box ${cls}`, 8), T(x + 110, 42, name, 'nf-t head'), T(x + 110, 62, ex, 'nf-t small'),
        ...doc(x + 60, 80, 100, 32, inp), A(`M${x + 110} 116 V146`), ...doc(x + 30, 150, 160, 32, out),
        i === 1 ? key(x + 175, 131, 'acc') : null,
        T(x + 110, 214, rev, `nf-t strong${i === 2 ? ' warn' : ''}`), T(x + 110, 240, use, 'nf-t small'));
      if (i === 2) kids.push(L(x + 92, 122, x + 128, 140, 'nf-line warn'));
    });
    kids.push(T(360, 302, '「Base64 で暗号化」は誤り。Base64 は誰でも戻せる「書き方の変換」で、秘密は守れない', 'nf-t small acc'));
    return frame(720, 312, 'エンコード・暗号化・ハッシュの違い', ...kids);
  },

  // シーザー暗号：アルファベットをずらす
  caesar() {
    const ab = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const k = 3, cw = 25.5, x0 = 28;
    const kids = [T(20, 26, '平文', 'nf-t strong', 'start'), T(20, 108, '暗号文', 'nf-t strong', 'start')];
    [...ab].forEach((c, i) => {
      const x = x0 + i * cw;
      kids.push(R(x, 36, cw - 3, 26, 'nf-box', 3), T(x + (cw - 3) / 2, 54, c, 'nf-t mono'),
        R(x, 118, cw - 3, 26, 'nf-box l-app', 3), T(x + (cw - 3) / 2, 136, ab[(i + k) % 26], 'nf-t mono acc'));
      if (i < 6 || i > 22) kids.push(A(`M${x + (cw - 3) / 2} 66 V112`, 'dim'));
    });
    kids.push(T(360, 92, '3 文字ずらす（鍵 = 3）', 'nf-t small strong'));
    kids.push(T(360, 176, 'HELLO → KHOOR。鍵は 25 通りしかないので、全部試せばすぐ解ける（総当たり）', 'nf-t small'),
      T(360, 196, 'ROT13（13 ずらし）は 2 回かけると元に戻る。CTF の最初の一歩でよく出る', 'nf-t small'));
    return frame(720, 208, 'シーザー暗号の図', ...kids);
  },

  // XOR
  xor() {
    const rows = [['平文 f', '0 1 1 0 0 1 1 0'], ['鍵 K', '0 1 0 0 1 0 1 1'], ['暗号 f⊕K', '0 0 1 0 1 1 0 1'], ['もう一度 ⊕K', '0 1 1 0 0 1 1 0']];
    const kids = [T(130, 24, 'XOR の決まり', 'nf-t head')];
    [['0 ⊕ 0', '0'], ['0 ⊕ 1', '1'], ['1 ⊕ 0', '1'], ['1 ⊕ 1', '0']].forEach(([a, b], i) => {
      kids.push(R(40, 38 + i * 34, 180, 28, 'nf-box', 3), T(90, 57 + i * 34, a, 'nf-t mono'), T(150, 57 + i * 34, '=', 'nf-t'), T(185, 57 + i * 34, b, 'nf-t mono acc'));
    });
    kids.push(T(130, 196, '同じなら 0、違えば 1', 'nf-t small strong'));
    kids.push(T(490, 24, '暗号化と復号は同じ操作', 'nf-t head'));
    rows.forEach(([a, b], i) => {
      const y = 38 + i * 40;
      kids.push(T(330, y + 20, a, 'nf-t strong', 'start'), R(430, y, 240, 30, i === 2 ? 'nf-box l-app' : i === 3 ? 'nf-box l-net' : 'nf-box', 3), T(550, y + 20, b, `nf-t mono${i === 2 ? ' acc' : ''}`));
    });
    kids.push(L(430, 116, 670, 116, 'nf-line'));
    kids.push(T(500, 216, 'A ⊕ K ⊕ K = A。さらに 平文 ⊕ 暗号文 = 鍵（既知平文で鍵が分かる）', 'nf-t small'));
    return frame(720, 228, 'XOR の図', ...kids);
  },

  // 共通鍵暗号
  symmetric() {
    const kids = [...pc(80, 70, '送る人'), ...pc(640, 70, '受け取る人'),
      ...doc(130, 110, 90, 30, '平文'), A('M224 125 H286'), R(290, 100, 140, 50, 'nf-box l-app', 6), T(360, 122, '暗号化 / 復号', 'nf-t strong'), T(360, 140, 'AES など', 'nf-t small'),
      A('M434 125 H496'), ...doc(500, 110, 90, 30, '平文'),
      ...key(150, 180, 'acc'), ...key(570, 180, 'acc'), T(150, 204, '同じ鍵', 'nf-t small strong acc'), T(570, 204, '同じ鍵', 'nf-t small strong acc'),
      A('M300 160 Q 360 196 420 160', 'dim'), T(360, 214, '途中は暗号文（読めない）', 'nf-t small'),
      T(360, 250, '速くて大きなデータ向き。ただし「同じ鍵をどうやって安全に渡すか」が問題（鍵配送問題）', 'nf-t small warn')];
    return frame(720, 262, '共通鍵暗号の図', ...kids);
  },

  // ブロック暗号のモード：ECB と CBC
  modes() {
    const kids = [T(180, 22, 'ECB（そのまま 1 つずつ）', 'nf-t head'), T(540, 22, 'CBC（前の結果を混ぜる）', 'nf-t head')];
    const blocks = ['AAAA', 'BBBB', 'AAAA'];
    blocks.forEach((b, i) => {
      const x = 30 + i * 105;
      kids.push(...doc(x, 40, 80, 28, b), A(`M${x + 40} 72 V92`), R(x, 96, 80, 30, 'nf-box l-app', 4), T(x + 40, 116, 'AES', 'nf-t strong'),
        A(`M${x + 40} 130 V150`), ...doc(x, 154, 80, 28, ['7c1e', '33a0', '7c1e'][i], i === 1 ? 'nf-box' : 'nf-box fw'));
    });
    kids.push(T(180, 208, '同じ平文 → 同じ暗号文（模様が残る）', 'nf-t small warn'));
    kids.push(L(360, 30, 360, 216, 'nf-line dim'));
    blocks.forEach((b, i) => {
      const x = 390 + i * 110;
      kids.push(...doc(x, 40, 80, 28, b), A(`M${x + 40} 72 V84`), s('circle', { cx: x + 40, cy: 92, r: 8, class: 'nf-box' }), T(x + 40, 96, '⊕', 'nf-t strong'),
        A(`M${x + 40} 100 V112`), R(x, 114, 80, 26, 'nf-box l-app', 4), T(x + 40, 131, 'AES', 'nf-t strong'), A(`M${x + 40} 140 V152`), ...doc(x, 154, 80, 28, ['91d2', 'e04b', '5a7f'][i]));
      if (i < 2) kids.push(A(`M${x + 80} 168 C ${x + 100} 168, ${x + 95} 92, ${x + 140} 92`, 'dim'));
    });
    kids.push(R(330, 80, 44, 24, 'nf-box l-net', 3), T(352, 96, 'IV', 'nf-t mono'), A('M374 92 H420', 'dim'));
    kids.push(T(540, 208, '同じ平文でも暗号文が変わる（IV は毎回ランダムに）', 'nf-t small acc'));
    kids.push(T(360, 240, '今のおすすめは GCM（暗号化と改ざん検知を同時に行う）。ECB は使わない', 'nf-t small'));
    return frame(720, 252, 'ECB と CBC の違い', ...kids);
  },

  // 公開鍵暗号と電子署名
  publickey() {
    const kids = [T(180, 22, '暗号化：相手の公開鍵で閉じる', 'nf-t head'), T(540, 22, '署名：自分の秘密鍵で作る', 'nf-t head'),
      ...doc(20, 50, 70, 28, '平文'), A('M94 64 H132'), R(136, 46, 90, 36, 'nf-box l-app', 5), T(181, 69, '暗号化', 'nf-t strong'), ...key(181, 100, 'pub'), T(181, 122, 'B の公開鍵', 'nf-t small'),
      A('M230 64 H262'), ...doc(266, 50, 76, 28, '暗号文'),
      A('M304 82 V150', 'dim'), R(220, 154, 90, 36, 'nf-box l-app', 5), T(265, 177, '復号', 'nf-t strong'), ...key(265, 208, 'priv'), T(265, 230, 'B の秘密鍵（B だけ）', 'nf-t small'),
      A('M216 172 H160'), ...doc(84, 158, 70, 28, '平文'),
      L(360, 30, 360, 250, 'nf-line dim'),
      ...doc(380, 50, 70, 28, '文書'), A('M454 64 H486'), R(490, 46, 80, 36, 'nf-box l-net', 5), T(530, 69, 'ハッシュ', 'nf-t strong'), A('M574 64 H596'),
      R(600, 46, 100, 36, 'nf-box l-app', 5), T(650, 69, '署名を作る', 'nf-t strong'), ...key(650, 100, 'priv'), T(650, 122, 'A の秘密鍵', 'nf-t small'),
      R(420, 158, 270, 36, 'nf-box l-net', 5), T(555, 181, '検証：A の公開鍵で確かめる', 'nf-t strong'), ...key(555, 214, 'pub'),
      T(555, 236, '本人が作った・改ざんされていない、が分かる', 'nf-t small acc'), A('M650 126 V154', 'dim'),
      T(360, 268, '公開鍵は誰に配ってもよい。秘密鍵は絶対に渡さない', 'nf-t small warn')];
    return frame(720, 280, '公開鍵暗号と電子署名', ...kids);
  },

  // RSA のしくみ（小さな数で）
  rsa() {
    const steps = [
      ['① 素数を 2 つ選ぶ', 'p = 61, q = 53'],
      ['② n = p × q', 'n = 3233（公開）'],
      ['③ φ(n) = (p−1)(q−1)', 'φ = 3120（秘密）'],
      ['④ e を決める', 'e = 17（公開。普通は 65537）'],
      ['⑤ d = e の逆元 mod φ', 'd = 2753（秘密鍵）'],
    ];
    const kids = [];
    steps.forEach(([a, b], i) => {
      const y = 16 + i * 44;
      kids.push(R(20, y, 330, 38, i === 4 ? 'nf-box l-app' : i === 1 || i === 3 ? 'nf-box l-net' : 'nf-box', 5), T(34, y + 16, a, 'nf-t strong', 'start'), T(34, y + 32, b, 'nf-t mono small', 'start'));
    });
    kids.push(R(390, 30, 310, 76, 'nf-box l-net', 6), T(545, 54, '暗号化：c = m^e mod n', 'nf-t strong'), T(545, 78, 'm = 65 → c = 65^17 mod 3233 = 2790', 'nf-t mono small'), T(545, 96, '（公開鍵 n, e だけでできる）', 'nf-t small'),
      R(390, 126, 310, 76, 'nf-box l-app', 6), T(545, 150, '復号：m = c^d mod n', 'nf-t strong'), T(545, 174, '2790^2753 mod 3233 = 65', 'nf-t mono small'), T(545, 192, '（秘密鍵 d が必要）', 'nf-t small'),
      T(545, 228, 'n を p と q に分解できれば d が計算できてしまう', 'nf-t small warn'), T(545, 246, '→ 本物の RSA は n が 2048 ビット以上（約 617 桁）', 'nf-t small'));
    return frame(720, 260, 'RSA の鍵の作り方と暗号化・復号', ...kids);
  },

  // Diffie-Hellman（色を混ぜるたとえ）
  dh() {
    const kids = [T(130, 22, 'A さん', 'nf-t head'), T(590, 22, 'B さん', 'nf-t head'), T(360, 22, '公開の場（盗み見られる）', 'nf-t head')];
    const blob = (cx, cy, cls, label) => [s('circle', { cx, cy, r: 18, class: `nf-paint ${cls}` }), label ? T(cx, cy + 34, label, 'nf-t small') : null];
    kids.push(...blob(360, 70, 'yellow', '共通の色（公開）'),
      ...blob(80, 70, 'red', 'A の秘密の色'), ...blob(640, 70, 'blue', 'B の秘密の色'),
      ...blob(160, 150, 'orange', '混ぜた色を送る'), ...blob(560, 150, 'green', '混ぜた色を送る'),
      A('M180 150 L540 170', 'dim'), A('M540 150 L180 170', 'dim'),
      ...blob(130, 226, 'brown', '相手の色＋自分の秘密'), ...blob(590, 226, 'brown', '相手の色＋自分の秘密'),
      T(360, 232, '同じ色（共通の鍵）ができる', 'nf-t strong acc'),
      T(360, 284, '混ぜた色から元の秘密の色は取り出せない（離散対数問題）。盗み見た人は同じ色を作れない', 'nf-t small'),
      T(360, 302, '実際の TLS では、この方法（ECDHE）で毎回その場限りの共通鍵を作る', 'nf-t small'));
    return frame(720, 314, 'Diffie-Hellman 鍵共有のたとえ', ...kids);
  },

  // ハッシュの性質
  hash() {
    const rows = [['flag', '807d0fbcae7c4b20518d4d85664f6820…'], ['flah', 'a994452930e1b7243744aa0ab3f159d3…'], ['Flag', '552127973f8424e17198e6078a0a52f1…']];
    const kids = [T(360, 22, 'SHA-256：1 文字違うだけで、まったく別の値になる', 'nf-t head')];
    rows.forEach(([a, b], i) => {
      const y = 40 + i * 44;
      kids.push(...doc(30, y, 90, 30, a), A(`M124 ${y + 15} H176`), R(180, y - 2, 90, 34, 'nf-box l-net', 5), T(225, y + 19, 'SHA-256', 'nf-t strong'), A(`M274 ${y + 15} H306`),
        R(310, y, 380, 30, 'nf-box', 3), T(500, y + 20, b, 'nf-t mono small'));
    });
    const props = [['一方向', 'ハッシュから元は計算できない'], ['固定長', '何を入れても 256 ビット'], ['衝突しにくい', '同じ値の別の入力を作れない'], ['雪崩効果', '少しの違いで全体が変わる']];
    props.forEach(([a, b], i) => {
      const x = 20 + i * 172;
      kids.push(R(x, 180, 160, 54, 'nf-box l-app', 5), T(x + 80, 202, a, 'nf-t strong'), T(x + 80, 222, b, 'nf-t small'));
    });
    kids.push(T(360, 260, 'MD5・SHA-1 は衝突が見つかっていて、署名や改ざん検知には使わない', 'nf-t small warn'));
    return frame(720, 272, 'ハッシュ関数の性質', ...kids);
  },

  // ハイブリッド暗号（TLS の考え方）
  hybrid() {
    const kids = [...pc(70, 60, 'ブラウザ'), ...pc(650, 60, 'サーバー'),
      R(140, 30, 440, 56, 'nf-box l-net', 6), T(360, 52, '① 公開鍵の仕組み（遅いが鍵を渡せる）', 'nf-t strong'), T(360, 72, '証明書で相手を確かめ、ECDHE で「その場限りの共通鍵」を作る', 'nf-t small'),
      ...key(360, 112, 'acc'), T(360, 136, 'セッション鍵', 'nf-t small strong acc'),
      R(140, 150, 440, 56, 'nf-box l-app', 6), T(360, 172, '② 共通鍵暗号（速い）', 'nf-t strong'), T(360, 192, 'AES-GCM・ChaCha20 で、データ本体を暗号化', 'nf-t small'),
      A('M100 70 L136 58'), A('M584 58 L620 70', ''), A('M100 80 L136 178'), A('M584 178 L620 80'),
      T(360, 232, 'お互いの弱点を補い合う組み合わせ（ハイブリッド暗号）。TLS・PGP・ファイル暗号化の基本形', 'nf-t small')];
    return frame(720, 244, 'ハイブリッド暗号', ...kids);
  },

  // PKI：証明書の連鎖
  pki() {
    const certs = [['ルート証明書', '認証局（CA）', 'OS・ブラウザに最初から入っている', 'l-net'], ['中間証明書', '中間 CA', 'ルートが署名', 'l-tr'], ['サーバー証明書', 'shop.example.jp', '中間 CA が署名', 'l-app']];
    const kids = [];
    certs.forEach(([a, b, c, cls], i) => {
      const x = 30 + i * 236;
      kids.push(R(x, 40, 196, 130, `nf-box ${cls}`, 8), T(x + 98, 66, a, 'nf-t strong'), T(x + 98, 88, b, 'nf-t mono small'), T(x + 98, 112, c, 'nf-t small'),
        ...lock(x + 98, 140));
      if (i < 2) kids.push(A(`M${x + 200} 95 H${x + 232}`, 'acc'), T(x + 216, 86, '署名', 'nf-t small acc'));
    });
    kids.push(T(360, 24, 'ブラウザは、サーバー証明書から信頼できるルートまで、署名を順にたどって確かめる', 'nf-t small'));
    const checks = ['名前（ドメイン）が合っている', '有効期限内', '署名の連鎖が正しい', '失効していない'];
    checks.forEach((c, i) => kids.push(R(20 + i * 172, 186, 160, 34, 'nf-box shield', 4), T(100 + i * 172, 208, `✓ ${c}`, 'nf-t small strong')));
    kids.push(T(360, 244, 'どれかが失敗すると、ブラウザは警告を出す。警告を無視すると偽のサーバーにつながる危険がある', 'nf-t small warn'));
    return frame(720, 256, '証明書の連鎖（PKI）', ...kids);
  },

  // パスワードの保存
  password() {
    const kids = [T(180, 22, '✗ 悪い保存', 'nf-t head warn'), T(540, 22, '✓ よい保存', 'nf-t head'),
      R(20, 40, 320, 150, 'nf-box fw', 8),
      T(40, 66, '平文：password123', 'nf-t mono', 'start'), T(40, 88, '→ 漏れたらそのまま使われる', 'nf-t small', 'start'),
      T(40, 118, 'MD5 だけ：482c811d…', 'nf-t mono', 'start'), T(40, 140, '→ 同じパスワードは同じ値。速いので', 'nf-t small', 'start'), T(40, 156, '　総当たり・照合表（レインボーテーブル）', 'nf-t small', 'start'), T(40, 172, '　で元が分かる', 'nf-t small', 'start'),
      R(380, 40, 320, 150, 'nf-box l-net', 8),
      ...doc(396, 56, 120, 26, 'password123'), T(530, 74, '＋', 'nf-t strong'), ...doc(546, 56, 140, 26, 'ソルト（ランダム）'),
      A('M540 86 V100'), R(430, 102, 220, 30, 'nf-box l-app', 5), T(540, 122, 'bcrypt / Argon2（わざと遅い）', 'nf-t strong'),
      A('M540 134 V146'), T(540, 164, '$2b$12$Gk3x…（ユーザーごとに違う値）', 'nf-t mono small'), T(540, 182, '総当たりに時間がかかり、照合表も使えない', 'nf-t small acc'),
      T(360, 216, 'パスワードは「暗号化」ではなく「遅いハッシュ＋ソルト」で保存する。元に戻せる形では持たない', 'nf-t small')];
    return frame(720, 228, 'パスワードの保存方法', ...kids);
  },

  // CTF：暗号文の見分け方
  identify() {
    const rows = [
      ['英数字と + /・末尾に ＝ が付くことも', 'Base64', 'ZmxhZ3t…'],
      ['0-9 a-f だけ・偶数文字', 'Hex（16 進）', '666c6167…'],
      ['大文字と 2〜7 だけ・末尾に ＝ も', 'Base32', 'MZWGCZ33…'],
      ['英文の形のまま文字だけ違う', 'シーザー・換字・Vigenère', 'synt{…}'],
      ['32 / 40 / 64 桁の 16 進', 'MD5 / SHA-1 / SHA-256', '5f4dcc3b…'],
      ['eyJ で始まり . で 3 つ', 'JWT', 'eyJhbGci…'],
      ['n・e・c が与えられる', 'RSA', 'n = 0xa3f…'],
      ['読めないバイト列・同じ長さの鍵', 'XOR・共通鍵暗号', '\\x1f\\x0a…'],
    ];
    const kids = [T(130, 22, '見た目の特徴', 'nf-t head'), T(390, 22, '正体の候補', 'nf-t head'), T(600, 22, '例', 'nf-t head')];
    rows.forEach(([a, b, c], i) => {
      const y = 34 + i * 30;
      kids.push(R(14, y, 692, 26, i % 2 ? 'nf-box' : 'nf-box l-data', 3), T(24, y + 18, a, 'nf-t small strong', 'start'), T(300, y + 18, b, 'nf-t small acc', 'start'), T(540, y + 18, c, 'nf-t mono small', 'start'));
    });
    kids.push(T(360, 290, '迷ったらポータルの「迷ったら診断」「エンコード・デコード」の自動判定に貼る', 'nf-t small'));
    return frame(720, 300, '暗号文・符号化の見分け方', ...kids);
  },
};

// ---------- 練習用の部品 ----------
const shiftText = (t, k) => t.replace(/[a-z]/gi, (c) => {
  const b = c <= 'Z' ? 65 : 97;
  return String.fromCharCode(((c.charCodeAt(0) - b + k) % 26 + 26) % 26 + b);
});
const egcd = (a, b) => (b === 0n ? [a, 1n, 0n] : (([g, x, y]) => [g, y, x - (a / b) * y])(egcd(b, a % b)));
const modpow = (b, e, m) => {
  let r = 1n;
  b %= m;
  while (e > 0n) {
    if (e & 1n) r = (r * b) % m;
    b = (b * b) % m;
    e >>= 1n;
  }
  return r;
};
const isPrime = (n) => {
  if (n < 2n) return false;
  for (let i = 2n; i * i <= n; i++) if (n % i === 0n) return false;
  return true;
};

export const CRYPTO_WIDGETS = {
  caesar() {
    const input = h('input', { value: 'Hello, CTF World', 'aria-label': '文字' });
    const range = h('input', { type: 'range', min: 0, max: 25, value: 3, 'aria-label': 'ずらす数' });
    const lab = h('b', {}, '3');
    const out = h('code', { class: 'nf-calc-big' });
    const run = () => {
      lab.textContent = range.value;
      out.textContent = shiftText(input.value, +range.value);
    };
    input.addEventListener('input', run);
    range.addEventListener('input', run);
    run();
    return h('div', { class: 'nf-calc' }, h('div', { class: 'nf-calc-title' }, 'TRY：シーザー暗号'), h('p', { class: 'hint' }, 'スライダーでずらす数を変えてみましょう。13 にすると ROT13、元の数と足して 26 になると元に戻ります。'),
      input, h('div', { class: 'nf-calc-row' }, h('span', {}, 'ずらす数：'), range, lab), h('div', {}, out));
  },
  xor() {
    const a = h('input', { value: 'flag', 'aria-label': '文字' });
    const k = h('input', { value: 'K', 'aria-label': '鍵' });
    const out = h('div', { class: 'nf-calc-out' });
    const run = () => {
      const enc = new TextEncoder();
      const pa = enc.encode(a.value), pk = enc.encode(k.value || '\0');
      const x = pa.map((v, i) => v ^ pk[i % pk.length]);
      const hex = (u) => [...u].map((v) => v.toString(16).padStart(2, '0')).join(' ');
      const bin = (u) => [...u].slice(0, 4).map((v) => v.toString(2).padStart(8, '0')).join(' ');
      out.replaceChildren(h('table', { class: 'mn-table' }, h('tbody', {},
        h('tr', {}, h('th', {}, '文字（16 進）'), h('td', {}, h('code', {}, hex(pa)))),
        h('tr', {}, h('th', {}, '鍵（くり返し）'), h('td', {}, h('code', {}, hex(pa.map((_, i) => pk[i % pk.length]))))),
        h('tr', {}, h('th', {}, 'XOR の結果'), h('td', {}, h('code', {}, hex(x)))),
        h('tr', {}, h('th', {}, '2 進数（先頭 4 バイト）'), h('td', {}, h('code', {}, `${bin(pa)}\n${bin(x)}`))),
        h('tr', {}, h('th', {}, 'もう一度 XOR'), h('td', {}, h('code', {}, new TextDecoder().decode(x.map((v, i) => v ^ pk[i % pk.length]))))))));
    };
    a.addEventListener('input', run);
    k.addEventListener('input', run);
    run();
    return h('div', { class: 'nf-calc' }, h('div', { class: 'nf-calc-title' }, 'TRY：XOR'), h('p', { class: 'hint' }, '文字と鍵を変えてみましょう。もう一度 XOR すると元に戻ります。'),
      h('div', { class: 'nf-calc-row' }, h('span', {}, '文字'), a, h('span', {}, '鍵'), k), out);
  },
  rsatoy() {
    const f = (v, l) => h('label', { class: 'nf-calc-f' }, h('span', {}, l), h('input', { value: v, inputmode: 'numeric', 'aria-label': l }));
    const fp = f('61', 'p（素数）'), fq = f('53', 'q（素数）'), fe = f('17', 'e'), fm = f('65', '平文 m');
    const out = h('div', { class: 'nf-calc-out' });
    const run = () => {
      try {
        const [p, q, e, m] = [fp, fq, fe, fm].map((x) => BigInt(x.querySelector('input').value.trim()));
        if (p > 100000n || q > 100000n) throw new Error('p と q は 100000 以下で試してください');
        if (!isPrime(p) || !isPrime(q)) throw new Error('p と q は素数にしてください');
        if (p === q) throw new Error('p と q は別の素数にしてください');
        const n = p * q, phi = (p - 1n) * (q - 1n);
        const [g, x] = egcd(e, phi);
        if (g !== 1n) throw new Error(`e と φ(n) = ${phi} が互いに素ではありません（別の e を）`);
        if (m >= n) throw new Error(`m は n = ${n} より小さくしてください`);
        const d = ((x % phi) + phi) % phi, c = modpow(m, e, n);
        const rows = [['n = p × q', n], ['φ(n) = (p−1)(q−1)', phi], ['d = e の逆元 mod φ(n)', d], ['暗号文 c = m^e mod n', c], ['復号 c^d mod n', modpow(c, d, n)]];
        out.replaceChildren(h('table', { class: 'mn-table' }, h('tbody', {}, ...rows.map(([a, v]) => h('tr', {}, h('th', {}, a), h('td', {}, h('code', {}, String(v))))))));
      } catch (err) {
        out.replaceChildren(h('p', { class: 'hint' }, err.message.includes('BigInt') || err.name === 'SyntaxError' ? '整数を入れてください' : err.message));
      }
    };
    [fp, fq, fe, fm].forEach((x) => x.querySelector('input').addEventListener('input', run));
    run();
    return h('div', { class: 'nf-calc' }, h('div', { class: 'nf-calc-title' }, 'TRY：小さな RSA'), h('p', { class: 'hint' }, '小さな素数で鍵を作り、暗号化して戻してみましょう（本物は数百桁の素数を使います）。'),
      h('div', { class: 'nf-calc-row' }, fp, fq, fe, fm), out);
  },
  hashdemo() {
    const input = h('input', { value: 'flag', 'aria-label': 'ハッシュにする文字' });
    const out = h('div', { class: 'nf-calc-out' });
    const hex = (b) => [...new Uint8Array(b)].map((v) => v.toString(16).padStart(2, '0')).join('');
    let seq = 0;
    const run = async () => {
      const my = ++seq;
      const data = new TextEncoder().encode(input.value);
      const [s1, s256] = await Promise.all([crypto.subtle.digest('SHA-1', data), crypto.subtle.digest('SHA-256', data)]);
      if (my !== seq) return;
      out.replaceChildren(h('table', { class: 'mn-table' }, h('tbody', {},
        h('tr', {}, h('th', {}, 'SHA-1（40 桁）'), h('td', {}, h('code', {}, hex(s1)))),
        h('tr', {}, h('th', {}, 'SHA-256（64 桁）'), h('td', {}, h('code', {}, hex(s256)))))));
    };
    input.addEventListener('input', run);
    run();
    return h('div', { class: 'nf-calc' }, h('div', { class: 'nf-calc-title' }, 'TRY：ハッシュ'), h('p', { class: 'hint' }, '1 文字だけ変えて、値がどれだけ変わるか見てみましょう（計算はブラウザの中だけで行います）。'), input, out);
  },
};
