// 学ぶ：プロキシの構築（mitmproxy・Squid）
const P = (text) => ({ type: 'p', text });
const LIST = (title, items) => ({ type: 'list', title, items });
const TIP = (text, title) => ({ type: 'tip', text, title });
const WARN = (text, title) => ({ type: 'warn', text, title });
const DEFS = (items) => ({ type: 'defs', items });
const TABLE = (head, rows) => ({ type: 'table', head, rows });
const FIG = (name, caption) => ({ type: 'figure', name, caption });
const W = (name) => ({ type: 'widget', name });
const CODE = (title, code) => ({ type: 'code', title, code });
const Q = (q, choices, answer, explain) => ({ type: 'quiz', q, choices, answer, explain });
const LINK = (label, href, text, title) => ({ type: 'tip', title, text, link: { label, href } });
const STEPS = (items) => ({ type: 'steps', items: items.map(([title, text]) => ({ title, text })) });
const KEYS = (items) => ({ type: 'keys', items });

export const PROXY_TEXTS = [
  // ============================================================
  {
    id: 'proxy-mitm',
    subject: 'プロキシの構築',
    name: 'mitmproxy で通信を見る',
    tagline: '自分の端末・アプリの HTTP / HTTPS を見て、止めて、書き換えて、記録する検証用プロキシ。インストールから証明書の設定、画面の使い方、フィルター、Python のアドオン、トラブル対応まで。',
    genres: ['WEB', 'NW', 'FORENSIC'],
    level: '初級〜中級',
    prep: '準備 15 分＋読む時間 約 60 分',
    prepLabel: '目安',
    icon: 'proxy',
    chapters: [
      {
        id: 'about', title: 'mitmproxy とは・使ってよい場面',
        blocks: [
          P('mitmproxy は、端末とサーバーの間に入って HTTP / HTTPS の通信を見たり、止めて書き換えたり、記録したりできる無料のプロキシです。Python で作られていて、Python のスクリプトで動きを自由に足せます。'),
          FIG('mitm', 'TLS を 2 本に分けることで、暗号化された通信の中身を見られる'),
          TABLE(['道具', '画面', '向いている用途'], [
            ['mitmproxy', '端末の中で動く画面（キーボードで操作）', 'サーバー上や SSH 越しでの観察'],
            ['mitmweb', 'ブラウザの画面（http://127.0.0.1:8081）', '初めての人・見ながら操作したいとき'],
            ['mitmdump', '画面なし（ログを流す）', '記録・スクリプトでの自動処理'],
          ]),
          LIST('使う場面の例', [
            '自分たちが作った Web アプリ・スマホアプリが、どんな API をどんな値で呼んでいるか確かめる（開発・テスト）',
            '不具合の調査：ヘッダー・Cookie・リダイレクトの流れを記録する',
            'CTF の WEB 問題で、リクエストを書き換えて送り直す',
            '自社のアプリが、不要な情報を外部に送っていないか点検する',
          ]),
          WARN('mitmproxy は、自分の端末・自分の管理する機器と通信・大会で許可された問題・検証用の環境だけで使いましょう。他人の通信を本人の同意なく傍受することは、法律（電気通信事業法の通信の秘密・不正アクセス禁止法など）に触れます。会社の端末・ネットワークで使うときは、情報システム部門の許可を取ります。', '大切な約束'),
          Q('mitmproxy で HTTPS の中身を見られる理由は？', ['TLS の暗号を破っているから', '端末と mitmproxy、mitmproxy とサーバーの 2 本の TLS に分け、端末に mitmproxy の CA を信頼させているから', 'HTTPS を HTTP に変えているから', 'サーバーの秘密鍵を盗んでいるから'], 1, '暗号を破るのではなく、端末側が mitmproxy の作った証明書を信頼するように設定しているから見られます。だから、CA を入れていない他人の端末では警告が出て、気づかれずに見ることはできません。'),
        ],
      },
      {
        id: 'install', title: 'インストールと起動',
        blocks: [
          TABLE(['環境', 'インストール'], [
            ['Windows / Mac / Linux（共通）', '公式サイトの配布物（インストーラー・展開するだけの版）'],
            ['Mac（Homebrew）', 'brew install mitmproxy'],
            ['Python がある環境', 'pipx install mitmproxy（または python -m pip install mitmproxy）'],
            ['Docker', 'docker run --rm -it -p 8080:8080 -p 127.0.0.1:8081:8081 mitmproxy/mitmproxy mitmweb --web-host 0.0.0.0'],
          ]),
          CODE('起動', "mitmweb                       # ブラウザの画面つき（プロキシは :8080、画面は :8081）\nmitmproxy                     # 端末の中の画面\nmitmdump                      # 画面なし\nmitmweb --listen-port 8888    # 待ち受けのポートを変える\nmitmweb --listen-host 127.0.0.1   # 自分の PC からだけ受け付ける"),
          WARN('--listen-host を指定しないと、同じネットワークのほかの機器からもプロキシとして使えてしまいます。検証用の PC で動かすときは 127.0.0.1 に限るか、ファイアウォールで守りましょう。'),
          TIP('会社のネットワークでは、外へ出るのに会社のプロキシが必要なことがあります。そのときは upstream モードで、mitmproxy の先に会社のプロキシを指定します（次の章の図）。', '会社のネットワークで'),
          FIG('modes', 'mitmproxy の動作モード。まずは regular（標準）から'),
          Q('mitmweb を起動したとき、ブラウザで開く画面の初期のアドレスは？', ['http://127.0.0.1:8080', 'http://127.0.0.1:8081', 'http://127.0.0.1:3128', 'http://mitm.it:443'], 1, 'プロキシとしての待ち受けは 8080 番、操作用の画面は 8081 番です。'),
        ],
      },
      {
        id: 'cert', title: '端末の設定と証明書（CA）のインストール',
        blocks: [
          STEPS([
            ['プロキシを設定する', 'ブラウザ・OS のプロキシ設定に、mitmproxy を動かしている PC の IP とポート（8080）を入れる。Firefox はブラウザ単体でプロキシと証明書を設定できるので、検証用のプロファイルを作ると便利。'],
            ['証明書を取りに行く', 'プロキシを通した状態で http://mitm.it を開き、OS に合った証明書をダウンロードする（ファイルは ~/.mitmproxy/ にもある）。'],
            ['証明書を信頼させる', 'OS・ブラウザの「信頼されたルート証明機関」に入れる（下の表）。'],
            ['確かめる', 'https のサイトを開き、mitmweb の画面に通信が出てきて、ブラウザに警告が出なければ完了。'],
          ]),
          TABLE(['端末', '証明書の入れ方'], [
            ['Windows', 'mitmproxy-ca-cert.p12 を開き「ローカルコンピューター」→「信頼されたルート証明機関」に'],
            ['Mac', 'キーチェーンアクセスで「システム」に追加し、「常に信頼」に'],
            ['Linux（Ubuntu）', 'mitmproxy-ca-cert.pem を /usr/local/share/ca-certificates/mitmproxy.crt にコピーして sudo update-ca-certificates'],
            ['Firefox', '設定 → 証明書 → 認証局証明書 → インポート'],
            ['iPhone', 'プロファイルを入れた後、設定 → 一般 → 情報 → 証明書信頼設定 で有効に'],
            ['Android', '設定から CA 証明書を入れる。ただし Android 7 以降のアプリは利用者が入れた証明書を信頼しないので、自分たちのアプリは network_security_config で検証用ビルドだけ信頼させる'],
          ]),
          CODE('curl・Python から使う', "curl -x http://127.0.0.1:8080 --cacert ~/.mitmproxy/mitmproxy-ca-cert.pem https://example.com/\n\nexport HTTPS_PROXY=http://127.0.0.1:8080\nexport REQUESTS_CA_BUNDLE=~/.mitmproxy/mitmproxy-ca-cert.pem   # Python の requests\nexport NODE_EXTRA_CA_CERTS=~/.mitmproxy/mitmproxy-ca-cert.pem   # Node.js"),
          WARN('mitmproxy の CA の秘密鍵（~/.mitmproxy/mitmproxy-ca.pem）が漏れると、その CA を信頼した端末の通信を他人が見られるようになります。検証が終わったら端末から証明書を削除し、秘密鍵は人に渡さないでください。CA は PC ごとに自動で作られるので、ほかの人のものを使い回さないこと。', '証明書の後片付け'),
          Q('検証が終わった後にやるべきことは？', ['特にない', '端末に入れた mitmproxy の CA 証明書を削除し、プロキシ設定を戻す', 'mitmproxy の CA の秘密鍵をチームで共有する', 'ブラウザを再インストールする'], 1, '信頼させた CA を残すと、その CA の秘密鍵を持つ人が通信を見られる状態が続きます。使い終わったら削除して元に戻します。'),
        ],
      },
      {
        id: 'ui', title: '画面の使い方（見る・止める・書き換える）',
        blocks: [
          P('mitmweb では、上の一覧に通信（フロー）が並び、選ぶと下にリクエスト・レスポンスの中身が表示されます。端末の中の画面（mitmproxy）でも、できることは同じです。'),
          KEYS([
            ['?', 'ヘルプ（mitmproxy）'],
            ['↑ ↓ / Enter', '一覧を移動 / 中身を開く'],
            ['f', '一覧に表示するフィルターを設定'],
            ['i', 'インターセプト（止める条件）を設定'],
            ['e', '止めた通信を編集（ヘッダー・本文など）'],
            ['a', '止めた通信を進める（A ですべて）'],
            ['r', '選んだ通信を送り直す（リプレイ）'],
            ['z', '一覧を消す'],
            ['w', '一覧を保存'],
            ['q', '戻る・終了'],
          ]),
          STEPS([
            ['止める', 'インターセプトに ~u /api/login のような条件を入れると、合う通信がそこで止まる。'],
            ['書き換える', '止まった通信を開いて、パラメーター・ヘッダー・本文を編集する。'],
            ['進める', '再開すると、書き換えた内容でサーバーへ送られる。'],
            ['送り直す', '一覧から選んでリプレイすれば、同じ通信をもう一度送れる（値を変えて試す）。'],
          ]),
          TIP('書き換えや送り直しは、自分たちが開発しているアプリの動作確認（入力のチェックがサーバー側でも働いているか）や、CTF の問題で使います。', '使いどころ'),
        ],
      },
      {
        id: 'filter', title: 'フィルター式と記録',
        blocks: [
          KEYS([
            ['~d example.com', 'ドメイン'],
            ['~u /api/', 'URL に含む'],
            ['~m POST', 'メソッド'],
            ['~c 500', 'ステータスコード'],
            ['~h "Authorization"', 'ヘッダーに含む'],
            ['~b "token"', '本文（リクエスト・レスポンス）に含む'],
            ['~t json', 'Content-Type'],
            ['~q / ~s', 'リクエストだけ / レスポンスがあるもの'],
            ['!(~d cdn.example.com)', '否定（除く）'],
            ['~d api.example.com & ~m POST', 'かつ（| でまたは）'],
          ]),
          CODE('記録して後で見る', "mitmdump -w flows.mitm                         # すべて保存\nmitmdump -w flows.mitm '~d api.example.com'    # 条件に合うものだけ保存\nmitmweb -r flows.mitm                          # 保存したものを画面で開く\nmitmdump -nr flows.mitm '~c 500'               # 読み込んで条件で表示\nmitmdump --set hardump=./out.har               # HAR 形式で保存（ブラウザの開発者ツールでも開ける）"),
          CODE('見ない通信を決める', "# 中身を見ずにそのまま通す（証明書を固定しているサービス・関係ない通信）\nmitmweb --ignore-hosts '^(.+\\.)?apple\\.com:443$'\n# 決めたホストだけを見る\nmitmweb --allow-hosts '^api\\.example\\.com:443$'"),
          TIP('記録した .mitm・HAR には、Cookie・トークン・パスワードがそのまま入っています。共有するときは必要な部分だけにし、秘密の値は消してから渡しましょう。', '記録の扱い'),
          Q('「api.example.com への POST だけ」を表示したい。フィルター式は？', ['~d api.example.com | ~m POST', '~d api.example.com & ~m POST', '~u POST ~d', '!~m GET'], 1, '& は「かつ」、| は「または」です。ドメインが api.example.com で、かつメソッドが POST のものを表示します。'),
        ],
      },
      {
        id: 'addon', title: 'Python のアドオンで自動化',
        blocks: [
          P('mitmproxy は、Python のファイルを読み込ませて動きを足せます。通信のたびに呼ばれる関数（request・response など）を書くだけです。'),
          CODE('ヘッダーを足し、エラーを記録するアドオン（addon.py）', "import logging\nfrom mitmproxy import http\n\nclass Audit:\n    def request(self, flow: http.HTTPFlow) -> None:\n        # 検証環境あての通信に、目印のヘッダーを付ける\n        if flow.request.pretty_host.endswith('.staging.example.jp'):\n            flow.request.headers['X-Debug-Run'] = 'qa-2026'\n\n    def response(self, flow: http.HTTPFlow) -> None:\n        if flow.response and flow.response.status_code >= 500:\n            logging.warning(f'{flow.response.status_code} {flow.request.method} {flow.request.pretty_url}')\n\naddons = [Audit()]"),
          CODE('読み込ませる', "mitmweb -s addon.py\nmitmdump -s addon.py           # 画面なし（記録した警告だけを見たいとき）"),
          CODE('テスト用に、レスポンスを差し替える（モック）', "from mitmproxy import http\n\ndef request(flow: http.HTTPFlow) -> None:\n    if flow.request.path.startswith('/api/feature-flags'):\n        flow.response = http.Response.make(200, b'{\"newCheckout\": true}', {'Content-Type': 'application/json'})"),
          LIST('アドオンのよくある使い道', [
            '検証環境あての通信に、ヘッダーや Cookie を自動で付ける',
            'API のエラー・遅い応答だけを記録する',
            'まだできていない API の応答を差し替えて、画面の開発を進める（モック）',
            '自社のアプリが外部に送っている項目の一覧を作る（プライバシーの点検）',
          ]),
          Q('アドオンで、サーバーから返ってきた内容を調べたいときに書く関数は？', ['request', 'response', 'load', 'done'], 1, 'response はサーバーからの応答を受け取ったときに呼ばれます。request はサーバーへ送る前に呼ばれます。'),
        ],
      },
      {
        id: 'trouble', title: 'うまくいかないとき',
        blocks: [
          TABLE(['症状', '原因と対処'], [
            ['画面に何も出てこない', '端末のプロキシ設定・ポートの間違い。ファイアウォール。--listen-host で外からの接続を止めていないか'],
            ['証明書の警告が出る', 'CA を入れていない・「信頼」になっていない（iPhone の証明書信頼設定・Mac の「常に信頼」）'],
            ['特定のアプリだけ通信できない', '証明書の固定（ピンニング）。--ignore-hosts でそのまま通す'],
            ['Android のアプリの通信が見えない', '利用者が入れた CA をアプリが信頼しない。自分たちのアプリは検証用ビルドで network_security_config を設定'],
            ['社内で外につながらない', '会社のプロキシが必要。--mode upstream:http://会社のプロキシ:ポート'],
            ['HTTP/2・WebSocket が気になる', 'どちらも対応している。一覧の種類の表示で確認'],
            ['通信を見ずに Wireshark で読みたい', '環境変数 MITMPROXY_SSLKEYLOGFILE に鍵のログの保存先を指定すると、Wireshark で TLS を復号できる'],
          ]),
          LINK('Burp Suite の使い方ガイドを開く', '#manuals/burp', '同じ「間に入るプロキシ」の Burp と、操作の考え方を比べられます。'),
          LINK('Wireshark の使い方ガイドを開く', '#manuals/wireshark', '鍵のログを使った TLS の復号の方法があります。'),
        ],
      },
    ],
  },

  // ============================================================
  {
    id: 'proxy-squid',
    subject: 'プロキシの構築',
    name: 'Squid で社内プロキシを作る',
    tagline: '社内の Web アクセスをまとめるフォワードプロキシを、Linux と Squid で作る手順書。インストール、アクセス制御、サイトの遮断、認証、ログの見方、キャッシュ、HTTPS の扱い（SSL Bump）、端末への配布と運用まで。',
    genres: ['NW', 'CONFIG', 'DEFENSE'],
    level: '初級〜中級',
    prep: '構築 30 分＋読む時間 約 70 分',
    prepLabel: '目安',
    icon: 'server',
    chapters: [
      {
        id: 'about', title: 'Squid とは・全体の構成',
        blocks: [
          P('Squid は、古くから使われている無料のプロキシサーバーです。社内の PC からインターネットへの Web アクセスを Squid に集めることで、アクセスの記録・禁止サイトの遮断・利用者の認証・キャッシュによる高速化ができます。'),
          FIG('squid', '社員の PC は Squid を経由して外へ出る。ファイアウォールで直接の外向き通信を止めると、すり抜けを防げる'),
          DEFS([
            ['フォワードプロキシ', '社内から外へのアクセスを代わりに行う（この本の内容）'],
            ['リバースプロキシ', 'サーバーの前に立って外からのアクセスを受ける（Squid でもできるが、今は nginx などが主流）'],
            ['CONNECT', 'HTTPS のときにブラウザがプロキシへ送る「この相手につないで」というお願い。プロキシは中身を見ずに中継する（行き先の名前とポートは分かる）'],
          ]),
          WARN('社内プロキシは社員のアクセスを記録する仕組みです。導入の目的・記録する内容・保存期間・閲覧できる人を規程で決め、社員に周知してから運用しましょう。', '導入の前に'),
          Q('HTTPS のサイトへのアクセスを、SSL Bump を使わない Squid が記録できるのは？', ['URL のパスと検索語まで全部', '行き先のホスト名とポート（CONNECT の宛先）と通信量', 'パスワード', 'ページの本文'], 1, 'HTTPS は CONNECT で中継するので、プロキシに見えるのは行き先の名前・ポート・時刻・量までです。中身は暗号化されています。'),
        ],
      },
      {
        id: 'install', title: 'インストールと最初の起動',
        blocks: [
          CODE('Ubuntu / Debian', "sudo apt update\nsudo apt install -y squid            # HTTPS の検査（SSL Bump）も使うなら squid-openssl\nsudo cp /etc/squid/squid.conf /etc/squid/squid.conf.orig   # 元の設定を残す\nsudo systemctl enable --now squid\nsystemctl status squid"),
          CODE('RHEL / Rocky Linux', "sudo dnf install -y squid\nsudo systemctl enable --now squid\nsudo firewall-cmd --add-port=3128/tcp --permanent && sudo firewall-cmd --reload"),
          CODE('動作の確認（Squid の上で）', "curl -x http://127.0.0.1:3128 -I http://example.com/\ncurl -x http://127.0.0.1:3128 -I https://example.com/\nsudo tail -f /var/log/squid/access.log"),
          TABLE(['場所', '中身'], [
            ['/etc/squid/squid.conf', '設定ファイル（コメントが非常に多い。元の設定は残しておく）'],
            ['/var/log/squid/access.log', 'アクセスの記録'],
            ['/var/log/squid/cache.log', 'Squid 自身の動作・エラー'],
            ['/var/spool/squid', 'キャッシュの保存先'],
          ]),
          CODE('設定を変えたら', "sudo squid -k parse              # 設定の文法を確認（エラーがあれば表示）\nsudo systemctl reload squid      # 接続を切らずに読み直す（squid -k reconfigure でも可）"),
          Q('squid.conf を書き換えた後、反映する前にやるべきことは？', ['サーバーを再起動する', 'squid -k parse で設定の誤りがないか確かめる', 'キャッシュを消す', 'ログを消す'], 1, '設定に誤りがあると Squid が起動しなくなり、全社の Web アクセスが止まります。必ず文法を確認してから読み直します。'),
        ],
      },
      {
        id: 'acl', title: 'アクセス制御（acl と http_access）',
        blocks: [
          P('Squid の設定の中心は、条件に名前を付ける acl と、その条件で許可・拒否を決める http_access です。'),
          FIG('acl', 'http_access は上から順に調べ、最初に合った行で決まる'),
          CODE('最小限の設定の例（squid.conf）', "http_port 3128\n\n# 条件に名前を付ける\nacl localnet src 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16\nacl SSL_ports port 443\nacl Safe_ports port 80 443\nacl CONNECT method CONNECT\n\n# 上から順に評価される\nhttp_access deny !Safe_ports\nhttp_access deny CONNECT !SSL_ports\nhttp_access allow localhost\nhttp_access allow localnet\nhttp_access deny all\n\n# ログとキャッシュ（後の章で説明）\naccess_log daemon:/var/log/squid/access.log squid\ncache_mem 256 MB"),
          TABLE(['acl の種類', '例', '意味'], [
            ['src', 'acl sales src 10.0.20.0/24', '利用者の IP'],
            ['dstdomain', 'acl news dstdomain .example-news.jp', '行き先のドメイン（先頭の . で下の名前も含む）'],
            ['dstdom_regex', 'acl ads dstdom_regex -i (^|\\.)ads\\.', '行き先のドメインを正規表現で'],
            ['url_regex', 'acl exe url_regex -i \\.exe$', 'URL 全体（HTTPS では中身が見えないので効かない）'],
            ['port', 'acl SSL_ports port 443', '行き先のポート'],
            ['time', 'acl worktime time MTWHF 08:00-19:00', '曜日（M 月・T 火・W 水・H 木・F 金・A 土・S 日）と時刻'],
            ['proxy_auth', 'acl authed proxy_auth REQUIRED', '認証済みの利用者'],
          ]),
          W('squidacl'),
          Q('1 行の http_access に複数の acl を書いた（http_access allow localnet worktime）。意味は？', ['localnet または worktime', 'localnet かつ worktime', 'localnet だけ見る', '文法の誤り'], 1, '1 行の中の条件は「かつ」です。「または」にしたいときは、行を分けて書きます。'),
        ],
      },
      {
        id: 'block', title: 'サイトの遮断と例外',
        blocks: [
          CODE('一覧のファイルで遮断する', "# /etc/squid/blocked_sites.txt（1 行に 1 つ）\n.example-game.com\n.example-video.net\n\n# squid.conf（http_access allow localnet より前に書く）\nacl blocked_sites dstdomain \"/etc/squid/blocked_sites.txt\"\nacl allow_exception dstdomain \"/etc/squid/allow_sites.txt\"\nhttp_access allow localnet allow_exception\nhttp_access deny blocked_sites"),
          CODE('部署・時間で分ける', "acl dev src 10.0.30.0/24\nacl worktime time MTWHF 08:00-19:00\nacl social dstdomain .example-sns.com\n\nhttp_access allow dev social          # 開発部は許可（広報の運用などで必要）\nhttp_access deny social worktime      # それ以外は業務時間だけ禁止\nhttp_access allow localnet\nhttp_access deny all"),
          CODE('遮断したときに出す画面の言語', "error_default_language ja"),
          TIP('遮断の一覧を自分で作り続けるのは大変です。大規模に運用するなら、URL の分類データベースを持つ製品や、DNS で危険なドメインを止める仕組みと組み合わせます。', '一覧の管理'),
          Q('遮断の行（http_access deny blocked_sites）を、http_access allow localnet より後ろに書いた。何が起きる？', ['正しく遮断される', '社内の利用者は allow localnet で先に許可されるので、遮断されない', '全員が遮断される', 'Squid が起動しない'], 1, '最初に合った行で決まるので、社内の利用者は allow localnet の時点で許可されてしまいます。遮断は許可の行より前に書きます。'),
        ],
      },
      {
        id: 'auth', title: '利用者の認証',
        blocks: [
          P('IP アドレスだけでなく、「誰が」アクセスしたかを記録・制御したいときは、プロキシで認証します。小さな環境ではファイルで、会社では Active Directory（Kerberos・LDAP）と連携するのが一般的です。'),
          CODE('ファイル（htpasswd）で Basic 認証', "sudo apt install -y apache2-utils\nsudo htpasswd -c /etc/squid/passwd yamada     # 2 人目からは -c を付けない\n\n# squid.conf（http_access の前に）\nauth_param basic program /usr/lib/squid/basic_ncsa_auth /etc/squid/passwd\nauth_param basic realm Company Proxy\nauth_param basic credentialsttl 2 hours\nacl authed proxy_auth REQUIRED\n\nhttp_access deny !authed\nhttp_access allow localnet authed\nhttp_access deny all"),
          WARN('Basic 認証は、ブラウザとプロキシの間でパスワードを Base64（実質平文）で送ります。社内 LAN でも盗み見られる前提で、Active Directory と連携した Kerberos（Negotiate）認証を使うのがおすすめです。', 'Basic 認証の注意'),
          DEFS([
            ['Kerberos（Negotiate）', 'Windows にログインしている情報で、パスワードを送らずに認証する。利用者は何も入力しなくてよい'],
            ['LDAP', 'Active Directory などの利用者の一覧に問い合わせてパスワードを確かめる（basic_ldap_auth）'],
            ['ログへの記録', '認証すると、access.log に利用者の名前が残る'],
          ]),
          Q('Squid の Basic 認証について正しいのは？', ['パスワードは強力に暗号化されて送られる', 'パスワードは Base64 で送られ、実質的に平文と同じ', 'パスワードは送られない', 'HTTPS のサイトでは使えない'], 1, 'Base64 は誰でも戻せる符号です。盗み見の心配がある環境では Kerberos などを使います。'),
        ],
      },
      {
        id: 'logs', title: 'ログの見方と集計',
        blocks: [
          CODE('access.log の 1 行（squid 形式）', "1775634512.345    120 10.0.20.15 TCP_MISS/200 5321 GET http://example.com/ yamada HIER_DIRECT/93.184.215.14 text/html\n1775634520.002  15040 10.0.20.15 TCP_TUNNEL/200 48211 CONNECT www.example.jp:443 yamada HIER_DIRECT/203.0.113.10 -\n1775634530.871      0 10.0.20.33 TCP_DENIED/403 3954 CONNECT game.example-game.com:443 - HIER_NONE/- text/html"),
          TABLE(['列', '意味'], [
            ['1', '時刻（UNIX 時間。ポータルのネットワーク・時刻計算で日本時間に変換できる）'],
            ['2', '処理にかかった時間（ミリ秒）'],
            ['3', '利用者の IP'],
            ['4', '結果/ステータス（TCP_MISS：外から取得、TCP_HIT：キャッシュ、TCP_TUNNEL：HTTPS の中継、TCP_DENIED：拒否）'],
            ['5 / 6 / 7', '量（バイト）/ メソッド / URL（HTTPS は 名前:443）'],
            ['8', '利用者の名前（認証していなければ -）'],
            ['9 / 10', '取得先 / 種類'],
          ]),
          CODE('よく使う集計', "# アクセスの多い行き先（ドメイン）\nawk '{print $7}' /var/log/squid/access.log | sed -E 's#^[a-z]+://##; s#[:/].*##' | sort | uniq -c | sort -nr | head -20\n# 拒否された通信\ngrep TCP_DENIED /var/log/squid/access.log | awk '{print $3, $7}' | sort | uniq -c | sort -nr | head\n# 利用者ごとの通信量（MB）\nawk '{s[$8]+=$5} END {for (u in s) printf \"%s %.1f\\n\", u, s[u]/1048576}' /var/log/squid/access.log | sort -k2 -nr | head\n# 時刻を読みやすく\nsudo tail -f /var/log/squid/access.log | perl -pe 's/^(\\d+)\\.\\d+/localtime($1)/e'"),
          CODE('時刻の書き方を変える（squid.conf）', "logformat jst %{%Y-%m-%d %H:%M:%S}tl %6tr %>a %Ss/%03>Hs %<st %rm %ru %un %Sh/%<a %mt\naccess_log daemon:/var/log/squid/access.log jst"),
          TIP('ログは logrotate で日ごとに分けて圧縮し、規程で決めた期間保存します。インシデントの調査では「いつ・どの端末が・どこへ」の記録として非常に重要です。SIEM に送っておくと、ほかのログと突き合わせられます。', 'ログの保存'),
          LINK('ポータルのログ解析を開く', '#logs', 'ログを貼り付けて、アクセスの多い IP・急な増加などを集計できます。'),
          Q('access.log の結果が TCP_DENIED/403 だった。意味は？', ['キャッシュから返した', 'Squid のアクセス制御で拒否した', '相手のサーバーが落ちていた', 'HTTPS を中継した'], 1, 'TCP_DENIED は http_access の設定で拒否されたことを表します。遮断の一覧が意図どおり働いているかの確認や、設定ミスの調査に使います。'),
        ],
      },
      {
        id: 'cache', title: 'キャッシュの設定',
        blocks: [
          CODE('キャッシュの設定の例', "cache_mem 512 MB                                   # メモリに置くキャッシュ\nmaximum_object_size_in_memory 1 MB\ncache_dir ufs /var/spool/squid 20000 16 256        # ディスクに 20GB\nmaximum_object_size 200 MB\n# 更新プログラムなど、長く使い回せるものを長めに\nrefresh_pattern -i \\.(deb|rpm|cab|msu)$ 1440 80% 10080\nrefresh_pattern . 0 20% 4320"),
          CODE('キャッシュ用のフォルダを作る（cache_dir を足したとき）', "sudo systemctl stop squid\nsudo squid -z\nsudo systemctl start squid"),
          TIP('今の Web はほとんどが HTTPS で、SSL Bump をしなければ中身をキャッシュできません。キャッシュの効果は、HTTP で配られる OS の更新プログラムなどに限られることが多いです。主な目的は「記録と制御」と考えましょう。', '期待しすぎない'),
        ],
      },
      {
        id: 'sslbump', title: 'HTTPS の検査（SSL Bump）',
        blocks: [
          P('SSL Bump は、mitmproxy と同じ仕組み（社内の CA で証明書を作って TLS を 2 本に分ける）で、HTTPS の中身を検査する機能です。マルウェアの検査や情報漏えい対策（DLP）の製品と組み合わせるときに使います。'),
          FIG('sslbump', '最初の挨拶（SNI）を見て、中を見ない・検査する・遮断するを分ける'),
          CODE('社内 CA を作る（Squid の上で）', "sudo mkdir -p /etc/squid/ssl && cd /etc/squid/ssl\nsudo openssl req -new -newkey rsa:2048 -sha256 -days 825 -nodes -x509 \\\n  -subj '/CN=Example Corp Proxy CA' -keyout proxy-ca.key -out proxy-ca.crt\nsudo cat proxy-ca.crt proxy-ca.key | sudo tee proxy-ca.pem > /dev/null\nsudo chown -R proxy:proxy /etc/squid/ssl && sudo chmod 600 /etc/squid/ssl/proxy-ca.pem\n# 証明書を作るためのデータベース\nsudo /usr/lib/squid/security_file_certgen -c -s /var/lib/squid/ssl_db -M 16MB\nsudo chown -R proxy:proxy /var/lib/squid/ssl_db"),
          CODE('squid.conf（squid-openssl が必要）', "http_port 3128 ssl-bump tls-cert=/etc/squid/ssl/proxy-ca.pem generate-host-certificates=on dynamic_cert_mem_cache_size=16MB\nsslcrtd_program /usr/lib/squid/security_file_certgen -s /var/lib/squid/ssl_db -M 16MB\n\nacl step1 at_step SslBump1\nacl nobump_sites ssl::server_name \"/etc/squid/nobump_sites.txt\"   # 銀行・医療・人事・更新サービスなど\n\nacl block_tls ssl::server_name \"/etc/squid/blocked_sites.txt\"   # 禁止したサイト\n\nssl_bump peek step1\nssl_bump splice nobump_sites\nssl_bump terminate block_tls\nssl_bump bump all"),
          STEPS([
            ['社員の PC に CA を配る', 'proxy-ca.crt（.key ではない）を、グループポリシー・MDM で「信頼されたルート証明機関」に配布する。'],
            ['中を見ないサイトを決める', '銀行・医療・人事などのプライバシーに関わるサイトと、証明書を固定しているサービスを nobump_sites に入れる。'],
            ['少人数で試す', '検証用の端末で、主要な業務サイト・更新プログラム・Teams などが動くか確かめてから広げる。'],
          ]),
          WARN('SSL Bump は社員の HTTPS の中身（パスワードや個人的な内容を含む）をプロキシで見られる状態にします。目的・対象・保存しない内容を規程で決めて周知し、CA の秘密鍵（proxy-ca.key / .pem）は厳重に守ってください。秘密鍵が漏れると、社内の全 PC の HTTPS を他人がのぞけるようになります。', '必ず読む'),
          Q('nobump_sites（splice の一覧）に入れるべきものとして、最も適切なのは？', ['検索サイト', 'ニュースサイト', '銀行・医療・人事などプライバシーに関わるサイトと、証明書を固定しているサービス', 'すべてのサイト'], 2, 'プライバシーへの配慮と、復号すると動かなくなるサービスへの対応のために、中を見ないサイトを決めておきます。'),
        ],
      },
      {
        id: 'deploy', title: '端末への配布と運用',
        blocks: [
          TABLE(['配り方', '内容'], [
            ['手で設定', 'OS・ブラウザのプロキシ設定に squid.example.local:3128。少数なら'],
            ['PAC ファイル', 'どの通信をプロキシに通すかを JavaScript で書いたファイルを Web で配り、その URL を端末に設定する'],
            ['グループポリシー・MDM', 'Windows のグループポリシーや Intune・Jamf で、プロキシ設定や PAC の URL を一括で配る'],
            ['WPAD', 'DHCP・DNS で PAC の場所を自動で見つけさせる。なりすましの危険があるので、使うなら DNS の設定を厳重に'],
          ]),
          CODE('PAC ファイルの例（proxy.pac）', "function FindProxyForURL(url, host) {\n  // 社内のサイトはプロキシを通さない\n  if (isPlainHostName(host) || dnsDomainIs(host, '.example.local') || isInNet(dnsResolve(host), '10.0.0.0', '255.0.0.0')) {\n    return 'DIRECT';\n  }\n  return 'PROXY squid.example.local:3128; DIRECT';\n}"),
          LIST('運用のチェックリスト', [
            'ファイアウォールで、Squid 以外からの 80 / 443 番の外向き通信を拒否する（すり抜け防止）',
            'Squid 自体はインターネットから使えないようにする（オープンプロキシにしない）',
            'Squid を冗長化する（2 台・PAC で振り分け）。止まると全社の Web が止まる',
            'squid -k parse で確認してから reload・設定ファイルは Git などで変更の履歴を残す',
            'OS と Squid のセキュリティ更新',
            'ログの保存期間・閲覧できる人・確認の手順を決める',
          ]),
          WARN('PAC ファイルの「; DIRECT」は、プロキシが止まったときに直接つなぐための指定です。ファイアウォールで直接の通信を止めている場合は意味がないので、プロキシを 2 台にして「PROXY 1 台目; PROXY 2 台目」と書きます。'),
          Q('社内プロキシを入れても、社員の PC がプロキシを通さずに外へ出られてしまう。対策は？', ['PAC ファイルを長くする', 'ファイアウォールで、Squid 以外からの外向きの Web 通信を拒否する', 'Squid のキャッシュを増やす', 'Basic 認証にする'], 1, 'プロキシの設定は端末側で外せるので、ネットワーク側で「Squid 以外は外に出さない」ようにして初めて、記録と制御が確実になります。'),
          LINK('「業務のネットワーク」のプロキシの章を開く', '#learn/net-biz', 'フォワードプロキシ・リバースプロキシ・ロードバランサーの役割の違いを、図で確認できます。'),
        ],
      },
    ],
  },
];
