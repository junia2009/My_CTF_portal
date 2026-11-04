// 学ぶ：Web のテキストの図（すべて SVG のオリジナル）と、練習用の部品（URL の分解・HTML の無害化・SQL の組み立て）
import { h } from './common.js';
import { s, T, R, L, A, frame, pc, server, cloud } from './netfig.js';

const doc = (x, y, w, hh, label, cls = 'nf-box', tcls = 'nf-t mono') => [R(x, y, w, hh, cls, 4), T(x + w / 2, y + hh / 2 + 4, label, tcls)];
const lines = (x, y, arr, cls = 'nf-t mono small', dy = 16) => arr.map((t, i) => T(x, y + i * dy, t, cls, 'start'));

export const WEB_FIGURES = {
  // 脆弱性診断の考え方：安全な目印を入れて、応答の変化を見る
  diagnose() {
    const kids = [
      ...doc(20, 40, 150, 46, '① 目印の入力', 'nf-box l-app', 'nf-t small strong'),
      T(95, 104, '普段と違う形の、害の', 'nf-t small'), T(95, 120, 'ない値を 1 つ入れる', 'nf-t small'),
      A('M174 63 H250'),
      ...doc(250, 40, 180, 46, '② 応答の変化を見る', 'nf-box l-net', 'nf-t small strong'),
      T(340, 104, 'エラー・表示・時間・', 'nf-t small'), T(340, 120, 'ヘッダーの違い', 'nf-t small'),
      A('M434 63 H510'),
      ...doc(510, 30, 190, 30, '③ 変化あり → 疑い', 'nf-box', 'nf-t small strong'),
      ...doc(510, 68, 190, 30, '③ 変化なし → 低い', 'nf-box', 'nf-t small'),
      R(20, 150, 680, 86, 'nf-box shield', 8),
      T(360, 174, '確認するのは「弱点があるか（Yes / No）」まで。それ以上は踏み込まない', 'nf-t small strong acc'),
      T(360, 196, '見つけたら、攻撃を広げず、直し方（各章の「対策」）に進む', 'nf-t small'),
      T(360, 216, '許可された対象だけ・1 回の目印で判断・サービスを止めない', 'nf-t small'),
    ];
    return frame(720, 248, '脆弱性診断の基本の考え方', ...kids);
  },
  // URL を入れてから表示されるまで
  flow() {
    const steps = [
      ['1', 'URL を入力', ['https://', 'shop.example.jp'], 'l-data'],
      ['2', 'DNS', ['名前 →', 'IP アドレス'], 'l-link'],
      ['3', 'TCP ＋ TLS', ['つないで', '暗号化'], 'l-net'],
      ['4', 'リクエスト', ['GET / ＋', 'Cookie'], 'l-app'],
      ['5', 'サーバー処理', ['アプリ・DB'], 'l-tr'],
      ['6', 'レスポンス', ['HTML・', 'ステータス'], 'l-app'],
      ['7', '描画', ['CSS・JS・画像', 'を追加で取得'], 'l-data'],
    ];
    const kids = [];
    const w = 96;
    steps.forEach(([n, a, b, cls], i) => {
      const x = 12 + i * (w + 4);
      kids.push(R(x, 26, w, 110, `nf-box ${cls}`, 6), s('circle', { cx: x + w / 2, cy: 48, r: 12, class: 'nf-step' }), T(x + w / 2, 53, n, 'nf-t step'),
        T(x + w / 2, 84, a, 'nf-t strong'), ...b.map((t, j) => T(x + w / 2, 104 + j * 14, t, 'nf-t small')));
      if (i < steps.length - 1) kids.push(A(`M${x + w - 2} 150 h8`, 'dim'));
    });
    kids.push(T(360, 172, 'Web の攻撃と守りは、この流れのどこで起きるかを考えると整理しやすい', 'nf-t small'));
    return frame(720, 184, 'URL を入れてからページが表示されるまで', ...kids);
  },

  // URL の部品
  url() {
    const parts = [
      ['https', 'スキーム', 'l-net'], ['://', '', ''], ['user:pass@', 'ユーザー情報', 'l-data'], ['shop.example.jp', 'ホスト', 'l-app'], [':8443', 'ポート', 'l-link'],
      ['/items/view', 'パス', 'l-tr'], ['?id=42&sort=new', 'クエリ', 'l-net'], ['#review', 'フラグメント', 'l-data'],
    ];
    const kids = [];
    let x = 14;
    parts.forEach(([t, label, cls]) => {
      const w = t.length * 7.6 + 12;
      if (cls) kids.push(R(x, 30, w, 34, `nf-box ${cls}`, 4));
      kids.push(T(x + w / 2, 52, t, 'nf-t mono'));
      if (label) kids.push(L(x + w / 2, 66, x + w / 2, 82, 'nf-line'), T(x + w / 2, 98, label, 'nf-t small strong'));
      x += w + 2;
    });
    kids.push(T(360, 130, 'フラグメント（# 以降）はサーバーに送られない。ユーザー情報（user:pass@）は今は使わない（偽装に悪用される）', 'nf-t small'),
      T(360, 150, 'クエリの値は %xx でエンコードされる（空白 → %20 / +、日本語 → %E6%97%A5…）', 'nf-t small'));
    return frame(720, 162, 'URL の部品', ...kids);
  },

  // HTTP リクエストとレスポンスの中身
  reqres() {
    const kids = [T(180, 22, 'リクエスト（ブラウザ → サーバー）', 'nf-t head'), T(540, 22, 'レスポンス（サーバー → ブラウザ）', 'nf-t head'),
      R(14, 34, 336, 220, 'nf-box', 6), R(370, 34, 336, 220, 'nf-box', 6),
      R(14, 34, 336, 26, 'nf-box l-app', 6), R(370, 34, 336, 26, 'nf-box l-app', 6),
      ...lines(26, 52, ['POST /login HTTP/1.1'], 'nf-t mono strong'), ...lines(382, 52, ['HTTP/1.1 302 Found'], 'nf-t mono strong'),
      ...lines(26, 80, ['Host: shop.example.jp', 'Cookie: session=8f2c…', 'Content-Type: application/', '  x-www-form-urlencoded', 'User-Agent: Mozilla/5.0 …']),
      ...lines(382, 80, ['Location: /mypage', 'Set-Cookie: session=9a1d…;', '  HttpOnly; Secure; SameSite=Lax', 'Content-Security-Policy: …', 'Content-Type: text/html']),
      L(14, 170, 350, 170, 'nf-line dim'), L(370, 170, 706, 170, 'nf-line dim'),
      ...lines(26, 192, ['id=yamada&password=********']), ...lines(382, 192, ['（本文：HTML・JSON・画像など）'], 'nf-t small'),
      T(182, 236, '1 行目：メソッド・パス／ヘッダー／空行／本文', 'nf-t small'), T(538, 236, '1 行目：ステータス／ヘッダー／空行／本文', 'nf-t small'),
      T(360, 276, 'ブラウザが付けるヘッダーや本文は、利用者（攻撃者）がいくらでも書き換えられる──サーバーは全部を疑って扱う', 'nf-t small warn')];
    return frame(720, 288, 'HTTP のリクエストとレスポンス', ...kids);
  },

  // Cookie とセッション
  session() {
    const xc = 120, xs = 560;
    const kids = [...pc(xc, 34, ''), T(xc, 72, 'ブラウザ', 'nf-t strong'), ...server(xs, 36, ''), T(xs, 86, 'サーバー', 'nf-t strong'),
      L(xc, 92, xc, 330, 'nf-life'), L(xs, 100, xs, 330, 'nf-life'),
      R(600, 120, 110, 70, 'nf-box l-net', 5), T(655, 140, 'セッションの表', 'nf-t small strong'), T(655, 160, '9a1d… → yamada', 'nf-t mono tiny'), T(655, 176, '（サーバーだけが持つ）', 'nf-t small')];
    const msgs = [
      [118, 'POST /login（ID とパスワード）', 1, 'acc'],
      [162, 'Set-Cookie: session=9a1d…（ランダムな番号）', -1, 'acc'],
      [222, 'GET /mypage ＋ Cookie: session=9a1d…', 1, ''],
      [266, '「9a1d… は yamada さん」→ 本人のページ', -1, ''],
    ];
    for (const [y, label, dir, cls] of msgs) {
      kids.push(A(dir > 0 ? `M${xc + 4} ${y} L${xs - 6} ${y + 16}` : `M${xs - 4} ${y} L${xc + 6} ${y + 16}`, cls), T((xc + xs) / 2, y + 2, label, `nf-t small strong${cls ? ' acc' : ''}`));
    }
    kids.push(T(360, 318, 'セッションの番号が盗まれると、パスワードなしで本人になりすませる（セッションハイジャック）', 'nf-t small warn'));
    return frame(720, 340, 'Cookie によるセッション管理', ...kids);
  },

  // 同一オリジンポリシーと CORS
  origin() {
    const kids = [T(360, 22, 'オリジン＝スキーム＋ホスト＋ポート。違うオリジンのデータは、JavaScript から勝手に読めない', 'nf-t small strong'),
      R(20, 40, 220, 120, 'nf-box l-app', 8), T(130, 64, 'https://shop.example.jp', 'nf-t mono small'), T(130, 84, '（今開いているページ）', 'nf-t small'),
      ...doc(50, 104, 160, 36, 'fetch(…) の JS'),
      R(480, 40, 220, 56, 'nf-box l-net', 8), T(590, 62, 'https://shop.example.jp/api', 'nf-t mono small'), T(590, 82, '同じオリジン → 読める', 'nf-t small acc'),
      R(480, 112, 220, 56, 'nf-box fw', 8), T(590, 134, 'https://bank.example.com', 'nf-t mono small'), T(590, 154, '違うオリジン → 読めない', 'nf-t small warn'),
      A('M214 116 L476 70', 'acc'), A('M214 126 L476 140', 'warn'),
      R(120, 190, 480, 60, 'nf-box shield', 6), T(360, 212, 'CORS：相手のサーバーが「このオリジンなら読んでよい」と許可したときだけ読める', 'nf-t small strong'),
      T(360, 234, 'Access-Control-Allow-Origin: https://shop.example.jp（* や何でも許可は危険）', 'nf-t mono tiny')];
    return frame(720, 262, '同一オリジンポリシーと CORS', ...kids);
  },

  // Web アプリの構成
  arch() {
    const kids = [...pc(50, 110, '利用者'), ...cloud(165, 112, 'CDN'),
      R(240, 80, 70, 60, 'nf-box fw', 5), T(275, 115, 'WAF', 'nf-t strong'),
      R(330, 70, 110, 80, 'nf-box l-net', 6), T(385, 100, 'Web サーバー', 'nf-t strong'), T(385, 120, 'nginx など', 'nf-t small'), T(385, 136, '静的ファイル・TLS', 'nf-t small'),
      R(460, 70, 110, 80, 'nf-box l-app', 6), T(515, 100, 'アプリ', 'nf-t strong'), T(515, 120, 'PHP・Java・', 'nf-t small'), T(515, 136, 'Python・Node.js', 'nf-t small'),
      ...server(640, 70, 'DB'), ...server(640, 165, 'ファイル・キャッシュ'), R(450, 190, 130, 40, 'nf-box', 5), T(515, 215, '外部 API・メール', 'nf-t small strong'),
      A('M76 110 H110'), A('M220 110 H236'), A('M314 110 H326'), A('M444 110 H456'), A('M574 100 L618 76'), A('M574 120 L618 160'), A('M515 154 V186')];
    kids.push(T(360, 260, '攻撃は利用者の入力から入り、アプリを通って DB・ファイル・外部 API・ほかの利用者のブラウザへ届く', 'nf-t small'),
      T(360, 280, '→ 入力を受け取る所・出力する所（DB・HTML・OS コマンド・URL）ごとに、正しい無害化が必要', 'nf-t small acc'));
    return frame(720, 292, 'Web アプリの構成', ...kids);
  },

  // SQL インジェクション
  sqli() {
    const kids = [T(180, 22, '✗ 文字列をつなげて SQL を作る', 'nf-t head warn'), T(540, 22, '✓ プレースホルダーで値を渡す', 'nf-t head'),
      R(14, 36, 340, 196, 'nf-box fw', 8), R(366, 36, 340, 196, 'nf-box l-net', 8),
      T(28, 60, '"SELECT * FROM users WHERE id = \'" + 入力 + "\'"', 'nf-t mono tiny', 'start'),
      T(28, 90, '入力：yamada', 'nf-t small strong', 'start'),
      T(28, 110, "→ … WHERE id = 'yamada'", 'nf-t mono tiny', 'start'),
      T(28, 142, "入力：' OR '1'='1", 'nf-t small strong', 'start'),
      T(28, 162, "→ … WHERE id = '' OR '1'='1'", 'nf-t mono tiny', 'start'),
      T(28, 186, '入力の \' で文字列が閉じ、残りが SQL の命令に', 'nf-t small warn', 'start'),
      T(28, 204, 'なってしまう → 全員のデータが返る', 'nf-t small warn', 'start'),
      T(380, 60, 'SELECT * FROM users WHERE id = ?', 'nf-t mono tiny', 'start'),
      T(380, 84, 'execute(sql, [入力])', 'nf-t mono tiny', 'start'),
      T(380, 120, "入力：' OR '1'='1", 'nf-t small strong', 'start'),
      T(380, 140, "→ id が「' OR '1'='1」という文字の人を探す", 'nf-t small', 'start'),
      T(380, 170, 'SQL の形（命令）と値（データ）が最後まで', 'nf-t small acc', 'start'),
      T(380, 188, '別々に扱われるので、値が命令にならない', 'nf-t small acc', 'start'),
      T(360, 258, '「危ない文字を消す」より「混ぜない仕組み」で守る──XSS・コマンドインジェクションも同じ考え方', 'nf-t small')];
    return frame(720, 270, 'SQL インジェクションの仕組みと対策', ...kids);
  },

  // XSS
  xss() {
    const kids = [...pc(70, 60, '攻撃者'), ...server(360, 60, 'Web サイト'), ...pc(650, 60, 'ほかの利用者'),
      A('M95 60 L332 60', 'warn'), T(214, 48, '① 掲示板に <script>…</script>', 'nf-t mono tiny warn'),
      A('M388 60 L622 60'), T(505, 48, '② そのまま HTML に出力', 'nf-t small'),
      R(520, 110, 190, 70, 'nf-box fw', 6), T(615, 134, '③ 利用者のブラウザで', 'nf-t small strong'), T(615, 152, 'スクリプトが動く', 'nf-t small strong'), T(615, 170, 'Cookie・画面・操作を奪われる', 'nf-t small'),
      R(20, 120, 460, 110, 'nf-box shield', 6), T(250, 144, '対策：出力するときに、その場所に合わせて無害化（エスケープ）する', 'nf-t small strong acc'),
      T(40, 168, '< → &lt;   > → &gt;   " → &quot;   \' → &#39;   & → &amp;', 'nf-t mono tiny', 'start'),
      T(40, 190, 'テンプレートの自動エスケープ・innerHTML を使わず textContent', 'nf-t small', 'start'),
      T(40, 210, 'CSP で外部のスクリプトを禁止・Cookie に HttpOnly', 'nf-t small', 'start'),
      T(360, 256, '保存して後で出す（格納型）・URL の値をすぐ出す（反射型）・JS の中で起きる（DOM 型）がある', 'nf-t small')];
    return frame(720, 268, 'XSS（クロスサイトスクリプティング）', ...kids);
  },

  // CSRF
  csrf() {
    const kids = [...pc(70, 70, '利用者（ログイン中）'), ...server(620, 70, '銀行・社内システム'), R(250, 150, 220, 56, 'nf-box fw', 6), T(360, 172, '罠のページ', 'nf-t strong'), T(360, 192, '自動で送金フォームを送信', 'nf-t small'),
      A('M80 116 L246 168', 'dim'), T(150, 158, '① 開いてしまう', 'nf-t small'),
      A('M474 170 L596 120', 'warn'), T(560, 172, '② ブラウザが Cookie 付きで送る', 'nf-t small warn'),
      T(360, 60, '③ サーバーは本人の操作と区別できない', 'nf-t small strong'),
      R(20, 226, 680, 56, 'nf-box shield', 6), T(360, 248, '対策：CSRF トークン（フォームに推測できない値）・Cookie の SameSite=Lax / Strict', 'nf-t small strong acc'),
      T(360, 268, '大事な操作は再認証・Origin ヘッダーの確認', 'nf-t small')];
    return frame(720, 292, 'CSRF の仕組みと対策', ...kids);
  },

  // SSRF
  ssrf() {
    const kids = [...pc(60, 90, '攻撃者'), R(200, 50, 170, 90, 'nf-box l-app', 8), T(285, 76, 'Web アプリ', 'nf-t strong'), T(285, 96, '「この URL の画像を', 'nf-t small'), T(285, 112, '取ってくる」機能', 'nf-t small'),
      A('M86 90 H196', 'warn'), T(140, 76, 'url=http://169.254…', 'nf-t mono tiny warn'),
      R(440, 20, 270, 190, 'nf-zone', 8), T(575, 42, '社内・クラウドの内側', 'nf-t strong'),
      ...server(500, 100, '管理画面'), ...server(640, 100, 'メタデータ'), T(640, 156, '169.254.169.254', 'nf-t mono tiny'), T(640, 172, '（クラウドの認証情報）', 'nf-t small'),
      A('M374 90 L476 96', 'warn'), A('M374 100 L616 112', 'warn'),
      T(360, 236, 'サーバー自身に内側へアクセスさせてしまう。外からは届かないはずの場所が狙われる', 'nf-t small warn'),
      T(360, 256, '対策：取りに行く先を許可した一覧に限る・内部のアドレスを拒否・IMDSv2・外向き通信の制限', 'nf-t small acc')];
    return frame(720, 268, 'SSRF の仕組み', ...kids);
  },

  // ログインの守り（認証・認可）
  auth() {
    const kids = [T(180, 22, '認証：あなたは誰？', 'nf-t head'), T(540, 22, '認可：何をしてよい？', 'nf-t head'),
      ...[['知識', 'パスワード'], ['所持', 'スマホのアプリ・鍵'], ['生体', '指紋・顔']].flatMap(([a, b], i) => [R(20 + i * 110, 40, 100, 60, 'nf-box l-app', 6), T(70 + i * 110, 64, a, 'nf-t strong'), T(70 + i * 110, 84, b, 'nf-t small')]),
      T(180, 124, '2 種類以上を組み合わせる＝多要素認証', 'nf-t small strong acc'),
      T(180, 146, 'パスキー：パスワードの代わりに端末の鍵で', 'nf-t small'),
      L(360, 30, 360, 230, 'nf-line dim'),
      R(380, 40, 320, 34, 'nf-box', 4), T(540, 62, 'GET /api/orders/1001（自分の注文）', 'nf-t mono tiny'),
      R(380, 84, 320, 34, 'nf-box fw', 4), T(540, 106, 'GET /api/orders/1002（他人の注文）', 'nf-t mono tiny'),
      T(540, 140, '番号を変えるだけで他人のデータが見える＝IDOR', 'nf-t small warn'),
      T(540, 162, '毎回サーバー側で「この人の物か」を確かめる', 'nf-t small acc'),
      T(360, 214, 'ログインできた（認証）ことと、その操作をしてよい（認可）ことは別。両方をサーバーで確かめる', 'nf-t small')];
    return frame(720, 228, '認証と認可', ...kids);
  },

  // 守りの層（Web）
  webdefense() {
    const layers = [
      ['設計', '最小権限・認可を全部の API で・秘密を持たない'],
      ['実装', 'プレースホルダー・出力のエスケープ・フレームワークの守りを使う'],
      ['設定', 'HTTPS・セキュリティヘッダー・Cookie 属性・不要な機能を止める'],
      ['確認', 'コードレビュー・脆弱性診断・依存ライブラリの更新'],
      ['運用', 'WAF・ログの監視・異常の検知・すぐ直せる体制'],
    ];
    const kids = [];
    layers.forEach(([a, b], i) => {
      const y = 14 + i * 42, w = 690 - i * 40;
      kids.push(R(15 + i * 20, y, w, 36, i % 2 ? 'nf-box l-app' : 'nf-box l-net', 6), T(30 + i * 20, y + 23, a, 'nf-t strong', 'start'), T(100 + i * 20, y + 23, b, 'nf-t small', 'start'));
    });
    kids.push(T(360, 236, '1 つの対策に頼らず、作る段階から運用まで守りを重ねる', 'nf-t small'));
    return frame(720, 248, 'Web の守りの層', ...kids);
  },
};

// ---------- 練習用の部品 ----------
export const WEB_WIDGETS = {
  urlparts() {
    const input = h('input', { value: 'https://shop.example.jp:8443/items/view?id=42&q=%E6%97%A5%E6%9C%AC&sort=new#review', 'aria-label': 'URL', spellcheck: 'false' });
    const out = h('div', { class: 'nf-calc-out' });
    const run = () => {
      let u;
      try { u = new URL(input.value); } catch { return out.replaceChildren(h('p', { class: 'hint' }, 'https:// から始まる URL を入れてください')); }
      const rows = [['スキーム', u.protocol.replace(':', '')], ['ホスト', u.hostname], ['ポート', u.port || '（省略：' + (u.protocol === 'https:' ? '443' : u.protocol === 'http:' ? '80' : '既定') + '）'], ['パス', decodeURIComponent(u.pathname)],
        ...[...u.searchParams].map(([k, v]) => [`クエリ：${k}`, v]), ['フラグメント', u.hash ? `${u.hash}（サーバーには送られない）` : '（なし）'], ['オリジン', u.origin]];
      out.replaceChildren(h('table', { class: 'mn-table' }, h('tbody', {}, ...rows.map(([a, v]) => h('tr', {}, h('th', {}, a), h('td', {}, h('code', {}, v)))))));
    };
    input.addEventListener('input', run);
    run();
    return h('div', { class: 'nf-calc' }, h('div', { class: 'nf-calc-title' }, 'TRY：URL の分解'), h('p', { class: 'hint' }, 'URL を書き換えてみましょう。%xx はデコードして表示します。'), input, out);
  },
  escape() {
    const input = h('input', { value: 'こんにちは <b>太字</b> <img src=x onerror=alert(1)>', 'aria-label': '入力', spellcheck: 'false' });
    const out = h('div', { class: 'nf-calc-out' });
    const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const run = () => {
      // 解釈だけを見る（実行はしない）：DOMParser で作った文書はスクリプトを動かさない
      const parsed = new DOMParser().parseFromString(`<body>${input.value}</body>`, 'text/html').body;
      const tags = [...parsed.querySelectorAll('*')].map((e) => `<${e.tagName.toLowerCase()}${[...e.attributes].map((a) => ` ${a.name}`).join('')}>`);
      const danger = [...parsed.querySelectorAll('*')].some((e) => e.tagName === 'SCRIPT' || [...e.attributes].some((a) => /^on/i.test(a.name) || /^\s*javascript:/i.test(a.value)));
      out.replaceChildren(h('table', { class: 'mn-table' }, h('tbody', {},
        h('tr', {}, h('th', {}, 'そのまま HTML に入れると'), h('td', {}, tags.length ? h('code', {}, tags.join('  ')) : '（タグなし）', danger ? h('b', { class: 'nf-danger' }, ' ⚠ スクリプトが動く形が含まれる') : '')),
        h('tr', {}, h('th', {}, 'エスケープした出力'), h('td', {}, h('code', {}, esc(input.value)))),
        h('tr', {}, h('th', {}, '画面での見え方'), h('td', {}, input.value)))));
    };
    input.addEventListener('input', run);
    run();
    return h('div', { class: 'nf-calc' }, h('div', { class: 'nf-calc-title' }, 'TRY：HTML の無害化'), h('p', { class: 'hint' }, '入力がそのまま HTML になると、どんなタグとして解釈されるかを見てみましょう（ここでは実行しません）。エスケープすると、ただの文字として表示されます。'), input, out);
  },
  sqlbuild() {
    const input = h('input', { value: "yamada' OR '1'='1", 'aria-label': '入力', spellcheck: 'false' });
    const out = h('div', { class: 'nf-calc-out' });
    const run = () => {
      const v = input.value;
      const concat = `SELECT * FROM users WHERE id = '${v}'`;
      // 引用符の中にいるかを数えて、入力が文字列の外にはみ出したかを判定する
      let inStr = false, escaped = false;
      const start = concat.indexOf("'") + 1;
      for (let i = 0; i < concat.length; i++) {
        if (concat[i] === "'") inStr = !inStr;
        if (i >= start && i < start + v.length && !inStr && concat[i] !== "'") escaped = true;
      }
      out.replaceChildren(h('table', { class: 'mn-table' }, h('tbody', {},
        h('tr', {}, h('th', {}, '✗ つなげた SQL'), h('td', {}, h('code', {}, concat), escaped ? h('b', { class: 'nf-danger' }, ' ⚠ 入力が文字列の外に出て、SQL の一部になっている') : h('span', { class: 'hint' }, ' 入力は文字列の中に収まっている'))),
        h('tr', {}, h('th', {}, '✓ プレースホルダー'), h('td', {}, h('code', {}, 'SELECT * FROM users WHERE id = ?'), h('br'), h('span', { class: 'hint' }, '値：'), h('code', {}, JSON.stringify(v)), h('span', { class: 'hint' }, '（どんな文字でも「値」として扱われる）'))))));
    };
    input.addEventListener('input', run);
    run();
    return h('div', { class: 'nf-calc' }, h('div', { class: 'nf-calc-title' }, 'TRY：SQL の組み立て'), h('p', { class: 'hint' }, '入力を変えて、文字列をつなげる方法だと何が起きるかを見てみましょう（データベースには送りません）。'), input, out);
  },
};
