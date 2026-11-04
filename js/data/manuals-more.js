// ツールの使い方ガイド（追加分）：QGIS・Postman
const P = (text) => ({ type: 'p', text });
const LIST = (title, items) => ({ type: 'list', title, items });
const TIP = (text, title) => ({ type: 'tip', text, title });
const WARN = (text, title) => ({ type: 'warn', text, title });
const STEPS = (items) => ({ type: 'steps', items: items.map(([title, text]) => ({ title, text })) });
const KEYS = (items, copy = false) => ({ type: 'keys', items, copy });
const DEFS = (items) => ({ type: 'defs', items });
const CODE = (title, code) => ({ type: 'code', title, code });
const FAQ = (items) => ({ type: 'faq', items });

export const MORE_MANUALS = [
  // ============================================================
  {
    id: 'qgis',
    name: 'QGIS',
    kana: 'キュージス',
    tagline: '無料の地理情報システム（GIS）。座標の一覧・写真の位置情報・GPS の記録を地図に重ねて、場所を特定したり分析したりできる。OSINT の位置特定と、業務の地図づくりの両方に。',
    genres: ['OSINT', 'FORENSIC', 'MISC'],
    level: '初級',
    prep: 'インストール 15 分（大会の前に済ませておく）',
    site: 'https://qgis.org/download/',
    siteLabel: '公式のダウンロードページ',
    icon: 'geo',
    chapters: [
      {
        id: 'about', title: 'QGIS とは',
        blocks: [
          P('QGIS は、地図の上にさまざまなデータを重ねて表示・分析できる、無料のオープンソースの GIS（地理情報システム）です。Google マップでは難しい「座標の一覧を一度に地図に置く」「写真の撮影場所をまとめて表示する」「距離や範囲を正確に測る」といったことができます。'),
          LIST('こんなときに使う', [
            '問題で緯度経度の一覧（CSV・GPX・KML）が配られた → 地図に置くと文字や形が浮かぶことがある（OSINT・MISC）',
            '複数の写真の撮影場所（EXIF の GPS）をまとめて地図に置き、移動の経路を調べる（FORENSIC）',
            '航空写真や地形図と見比べて、写真の場所を絞り込む（OSINT）',
            '業務：拠点・顧客・事故の場所を地図にまとめる、エリアごとに集計する',
          ]),
          TIP('写真 1 枚の位置を調べるだけなら、ポータルの「位置特定アシスタント」が手軽です。たくさんの点・経路・地図の重ね合わせが必要になったら QGIS を使いましょう。', 'ポータルの位置特定との使い分け'),
          DEFS([
            ['レイヤー', '地図に重ねる 1 枚 1 枚のデータ（背景の地図・点の一覧・線・範囲など）'],
            ['ベクター / ラスター', '点・線・面のデータ / 画像のデータ（航空写真・地形図）'],
            ['座標参照系（CRS）', '地球上の位置を数字で表す決まり。GPS の緯度経度は EPSG:4326（WGS84）、Web の地図は EPSG:3857'],
          ]),
        ],
      },
      {
        id: 'install', title: '準備（インストール）',
        blocks: [
          STEPS([
            ['版を選ぶ', '公式ページから「長期サポート版（LTR）」を選ぶ。最新版より安定していて、業務でも使いやすい。'],
            ['インストールする', 'Windows はインストーラー、Mac は dmg、Linux はディストリビューションのパッケージ（または公式のリポジトリ）。'],
            ['起動して日本語を確認', '多くの環境では自動で日本語になる。英語のときは 設定 → オプション → 一般 で言語を変えて再起動。'],
            ['背景の地図を試す', '次の章の手順で OpenStreetMap を表示できれば準備完了。'],
          ]),
          WARN('背景の地図はインターネットから読み込みます。会場でネットワークが使えない可能性があるなら、必要な範囲の地図を事前に確認しておきましょう。会社の PC では、インストールと外部の地図サービスの利用について情報システム部門のルールに従ってください。'),
        ],
      },
      {
        id: 'screen', title: '画面の見方と背景の地図',
        blocks: [
          { type: 'diagram', name: 'qgis', caption: 'QGIS の画面の配置。番号は下の説明に対応しています。' },
          DEFS([
            ['① ブラウザ', 'ファイルや地図サービスを選ぶ。「XYZ Tiles」の下に OpenStreetMap がある'],
            ['② レイヤー', '重ねているデータの一覧。上にあるものほど手前に表示される。チェックで表示・非表示'],
            ['③ 地図', 'マウスのホイールで拡大・縮小、ドラッグで移動'],
            ['④ ステータスバー', 'マウスの位置の座標・縮尺・今の座標参照系（右下の EPSG:…）'],
          ]),
          STEPS([
            ['OpenStreetMap を表示', 'ブラウザの「XYZ Tiles」→「OpenStreetMap」をダブルクリック。'],
            ['地理院地図を追加（日本）', 'ブラウザの「XYZ Tiles」を右クリック →「新しい接続」で、URL に国土地理院の地図タイルを入れる。'],
            ['航空写真と見比べる', '同じ方法で地理院の写真を追加し、レイヤーのチェックで切り替えて比べる。'],
          ]),
          KEYS([
            ['https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png', '地理院地図（標準）'],
            ['https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg', '地理院の全国の航空写真'],
            ['https://tile.openstreetmap.org/{z}/{x}/{y}.png', 'OpenStreetMap（最初から入っている）'],
          ], true),
          TIP('地図を使った資料を作るときは、出典の表示（「出典：国土地理院」「© OpenStreetMap contributors」）を忘れずに。それぞれの利用規約を確認しましょう。', '出典の表示'),
        ],
      },
      {
        id: 'points', title: '座標の一覧を地図に置く（CSV・GPX・KML）',
        blocks: [
          STEPS([
            ['CSV を読み込む', 'レイヤー → レイヤーを追加 → 区切りテキストレイヤーを追加（Ctrl+Shift+T）でファイルを選ぶ。'],
            ['列を指定する', '「ジオメトリ定義」で「ポイント座標」を選び、X 列に経度（lon）、Y 列に緯度（lat）を指定する。'],
            ['座標参照系を選ぶ', '緯度経度なら EPSG:4326（WGS84）。「追加」を押す。'],
            ['全体を表示する', 'レイヤーを右クリック →「レイヤーの領域にズーム」。'],
          ]),
          WARN('X に経度、Y に緯度です。逆にすると、点が海の上やまったく別の国に出ます。日本の陸地なら「緯度が 20〜46、経度が 122〜154」くらいなので、数字の範囲で見分けられます。', 'X と Y の取り違えに注意'),
          DEFS([
            ['GPX', 'GPS の記録（経路・地点）。そのままドラッグ＆ドロップで読める'],
            ['KML / KMZ', 'Google Earth の形式。ドラッグ＆ドロップで読める（KMZ は zip で圧縮した KML）'],
            ['GeoJSON', 'Web でよく使う形式。ドラッグ＆ドロップで読める'],
            ['度分秒（35°40′52″）', 'QGIS は 10 進数の度を使う。35 + 40/60 + 52/3600 = 35.6811 のように変換してから読み込む'],
          ]),
          TIP('点の表示を変えるには、レイヤーをダブルクリック →「シンボロジ」。点に名前を表示するには「ラベル」で列を選びます。点の数が多いときは、シンボロジを「ヒートマップ」にすると、集中している場所が一目で分かります。', '見やすくする'),
        ],
      },
      {
        id: 'photos', title: '写真の撮影場所を地図に置く',
        blocks: [
          STEPS([
            ['写真を 1 つのフォルダにまとめる', '位置情報（EXIF の GPS）付きの写真を集める。'],
            ['ツールを開く', 'プロセシング → ツールボックスで「geotagged」で検索し、「ジオタグ付き写真のインポート」（Import geotagged photos）を開く。'],
            ['フォルダを指定して実行', '写真のある場所に点ができ、撮影日時・向き（記録されていれば）も属性に入る。'],
            ['写真を確かめる', '地物情報表示ツール（Ctrl+Shift+I）で点をクリックすると、属性と写真のパスが分かる。'],
          ]),
          WARN('SNS に投稿された写真の多くは、位置情報が消されています。また、位置情報は書き換えられるので、ほかの手がかり（写っている建物・看板・影の向き）と合わせて判断しましょう。他人の写真から個人の居場所を特定・公開することは、プライバシーの侵害になります。CTF・自社の調査など正当な目的の範囲で使ってください。', '位置情報の扱い'),
          { type: 'practice', portal: { label: 'ポータルの位置特定アシスタントで試す', page: 'geo', sample: 'geo' }, note: '1 枚の写真の EXIF・看板の文字からの推定は、ポータルでも練習できます。' },
        ],
      },
      {
        id: 'measure', title: '測る・調べる・書き出す',
        blocks: [
          KEYS([
            ['Ctrl + Shift + M', '距離を測る（クリックで点を足し、右クリックで終わり）'],
            ['Ctrl + Shift + I', '地物情報の表示（点をクリックして属性を見る）'],
            ['F6', '属性テーブルを開く（表で一覧・並べ替え・絞り込み）'],
            ['Ctrl + K', '検索バー（レイヤーや機能を名前で探す）'],
            ['右クリック → 座標をコピー', 'その場所の座標をコピーして、ほかの地図で開く'],
          ]),
          DEFS([
            ['式による選択', '属性テーブルの「式による選択」で、"name" LIKE \'%駅%\' のように条件で絞り込む'],
            ['バッファ', 'ベクター → 空間演算ツール → バッファ で「ある地点から 500m の範囲」を作る（範囲の中の点を数えるなど）'],
            ['地図を画像に', 'プロジェクト → インポート/エクスポート → 地図を画像にエクスポート。報告書の図に'],
            ['プラグイン', 'プラグイン → プラグインの管理とインストール。座標の入力や外部の地図を開く「Lat Lon Tools」、背景の地図を簡単に足す「QuickMapServices」が便利'],
          ]),
          TIP('距離を測るときは、ステータスバーの右下が正しい座標参照系か確かめましょう。QGIS は初期設定で楕円体（地球の丸み）を考えて測るので、広い範囲でも正しい距離になります。', '距離の正確さ'),
        ],
      },
      {
        id: 'practice', title: '練習問題',
        blocks: [
          P('東京駅の近くの座標を並べた CSV です。地図に置くと、ある言葉が浮かび上がります。'),
          { type: 'practice', download: { label: '練習用の CSV をダウンロード', sample: 'gpscsv', filename: 'points.csv' }, note: 'ファイル名：points.csv（約 110 点。id・lat・lon・name の列）' },
          STEPS([
            ['背景の地図を出す', 'OpenStreetMap を表示する。'],
            ['CSV を読み込む', '区切りテキストレイヤーで、X＝lon・Y＝lat・EPSG:4326 を指定する。'],
            ['全体を表示する', 'レイヤーの領域にズームして、点の並びを読む。'],
            ['距離を測る', '目印の「東京駅」の点から、文字の左下の端（p1）までの距離を測ってみる。'],
          ]),
          { type: 'answer', text: '点を並べると「MAP」の 3 文字が浮かび上がります。目印の東京駅から p1（文字の左下）までは、およそ 900 m です（南西の方向）。' },
          FAQ([
            ['点が出てこない', 'X と Y の取り違え、または座標参照系の指定の誤りが多いです。レイヤーを右クリック →「レイヤーの領域にズーム」も試しましょう。'],
            ['文字が左右反転・横倒しに見える', 'X に緯度、Y に経度を入れています。入れ替えてください。'],
          ]),
        ],
      },
    ],
  },

  // ============================================================
  {
    id: 'postman',
    name: 'Postman',
    kana: 'ポストマン',
    tagline: 'Web API を画面で組み立てて送り、応答を確かめる道具。リクエストの保存（コレクション）・環境ごとの変数・自動テスト・コマンドでの実行（Newman）まで。API の開発・検証と、CTF の WEB 問題に。',
    genres: ['WEB'],
    level: '初級',
    prep: 'インストール 10 分（アカウント作成を含む）',
    site: 'https://www.postman.com/downloads/',
    siteLabel: '公式のダウンロードページ',
    icon: 'api',
    chapters: [
      {
        id: 'about', title: 'Postman とは',
        blocks: [
          P('Postman は、Web API にリクエストを送って応答を確かめるための道具です。curl でもできることを、画面で分かりやすく組み立てて、保存・共有・自動テストまで行えます。'),
          LIST('こんなときに使う', [
            '開発中の API が、仕様どおりの応答を返すか確かめる',
            'ログイン → トークン取得 → 一覧取得、のような一連の呼び出しを保存して何度も実行する',
            'API の仕様書（OpenAPI）を読み込んで、すぐに試せる形にする',
            'CTF の WEB 問題で、API に値を変えてリクエストを送る',
          ]),
          DEFS([
            ['リクエスト', 'メソッド（GET・POST など）・URL・ヘッダー・本文の組'],
            ['コレクション', 'リクエストをまとめたフォルダ。ファイル（JSON）として書き出して共有できる'],
            ['環境（Environment）', '開発・検証・本番などで変わる値（URL・トークン）をまとめたもの'],
          ]),
          TIP('ブラウザとサーバーの間の通信を「見る・止める」のは Burp や mitmproxy、自分で API を「組み立てて送る」のは Postman、と使い分けます。', 'Burp・mitmproxy との違い'),
        ],
      },
      {
        id: 'install', title: '準備（インストール）',
        blocks: [
          STEPS([
            ['デスクトップ版を入れる', '公式ページから OS に合ったものをダウンロードしてインストールする。'],
            ['サインインする', '保存や共有にはアカウントが必要。サインインせずに使う軽量のモード（保存・共有はできない）もある。'],
            ['ワークスペースを作る', '「My Workspace」で始め、チームで使うならチームのワークスペースを作る。'],
          ]),
          WARN('Postman のワークスペースは「公開（Public）」にもできます。過去に、公開されたワークスペースから API キーやパスワードが大量に見つかった事例があります。会社の API を扱うときは、ワークスペースの公開範囲を必ず確認し、会社のルール（利用してよいサービスか）に従ってください。', '公開範囲に注意'),
          TIP('ブラウザ版の Postman で、手元の PC（localhost）や社内の API に送るには「Postman Desktop Agent」が必要です。迷ったらデスクトップ版を使いましょう。', 'ブラウザ版について'),
        ],
      },
      {
        id: 'screen', title: '画面の見方と最初のリクエスト',
        blocks: [
          { type: 'diagram', name: 'postman', caption: 'Postman の画面の配置。番号は下の説明に対応しています。' },
          DEFS([
            ['① サイドバー', 'コレクション・環境・履歴'],
            ['② メソッドと URL', 'GET などを選び、URL を入れて Send'],
            ['③ リクエストの設定', 'Params（クエリ）・Authorization（認証）・Headers・Body・Scripts'],
            ['④ レスポンス', 'ステータス・かかった時間・大きさ・本文・ヘッダー・Cookie・テストの結果'],
            ['⑤ 環境の切り替え', '右上で、使う環境（開発・本番など）を選ぶ'],
          ]),
          STEPS([
            ['GET を送る', 'URL に https://postman-echo.com/get?name=pallas を入れて Send。送った値がそのまま返ってくる（Postman Echo は Postman 公式の確認用 API）。'],
            ['POST で JSON を送る', 'メソッドを POST、URL を https://postman-echo.com/post にし、Body → raw → JSON で {"user": "yamada"} を入れて Send。'],
            ['ヘッダーを足す', 'Headers に X-Practice: test を足して送り、応答の headers に入っているか確かめる。'],
          ]),
          KEYS([
            ['Ctrl + Enter', '送る（Send）'],
            ['Ctrl + S', '保存（コレクションに入れる）'],
            ['Ctrl + T', '新しいタブ'],
            ['Ctrl + Alt + C', 'コンソール（実際に送った内容・スクリプトのログ）'],
          ]),
        ],
      },
      {
        id: 'vars', title: '変数と環境・認証',
        blocks: [
          P('同じリクエストを開発用と本番用で使い分けたり、ログインで得たトークンを次のリクエストで使ったりするために、変数を使います。URL やヘッダーに {{変数名}} と書くと、送るときに値に置き換わります。'),
          DEFS([
            ['変数の範囲', 'グローバル（全体）・コレクション・環境・その場限り。同じ名前なら、範囲の狭いものが優先'],
            ['環境', '「開発」「検証」「本番」などを作り、baseUrl・token などを入れておく。右上で切り替える'],
            ['秘密の値', '変数の種類を「secret」にすると画面で伏せ字になる。共有するコレクションには実際の値を入れず、Postman Vault や各自の環境に置く'],
          ]),
          CODE('変数を使ったリクエストの例', "GET {{baseUrl}}/api/orders?limit=10\nAuthorization: Bearer {{token}}"),
          DEFS([
            ['Authorization タブ', 'Bearer Token・Basic Auth・API Key・OAuth 2.0 などを選ぶと、必要なヘッダーを自動で付けてくれる'],
            ['継承', 'コレクションに認証を設定し、各リクエストは「Inherit auth from parent」にすると、まとめて変えられる'],
          ]),
          WARN('Postman の履歴・コレクション・環境には、送ったトークンやパスワードが残ります。共有する前に中身を確認し、本番の秘密の値は入れないようにしましょう。'),
        ],
      },
      {
        id: 'tests', title: 'スクリプトで自動テスト',
        blocks: [
          P('リクエストの「Scripts」タブには、送る前（Pre-request）と、応答を受け取った後（Post-response）に動く JavaScript を書けます。応答が正しいかの確認や、応答の値を変数に保存するのに使います。'),
          CODE('応答を確かめる（Post-response）', "pm.test('200 が返る', () => {\n  pm.response.to.have.status(200);\n});\n\npm.test('1 秒以内に返る', () => {\n  pm.expect(pm.response.responseTime).to.be.below(1000);\n});\n\nconst body = pm.response.json();\npm.test('id がある', () => {\n  pm.expect(body).to.have.property('id');\n});"),
          CODE('ログインで得たトークンを保存する', "const body = pm.response.json();\npm.environment.set('token', body.access_token);"),
          CODE('送る前に値を作る（Pre-request）', "pm.variables.set('requestId', pm.variables.replaceIn('{{$guid}}'));   // ランダムな ID\npm.variables.set('now', new Date().toISOString());"),
          STEPS([
            ['まとめて実行する', 'コレクションの「Run」（Collection Runner）で、中のリクエストを順に実行し、テストの結果を一覧で見る。'],
            ['くり返し・データで実行', 'CSV / JSON のデータファイルを指定すると、1 行ずつ値を変えて実行できる。'],
          ]),
        ],
      },
      {
        id: 'cli', title: '取り込み・書き出し・コマンドでの実行（Newman）',
        blocks: [
          DEFS([
            ['curl を取り込む', 'Import に curl のコマンドを貼ると、そのままリクエストになる（ブラウザの開発者ツールの「Copy as cURL」と組み合わせると便利）'],
            ['コードを書き出す', 'リクエストの右の「</>」で、curl・Python・JavaScript などのコードを出せる'],
            ['OpenAPI を取り込む', 'API の仕様書（OpenAPI / Swagger）を Import すると、全部の API がコレクションになる'],
            ['コレクションを書き出す', 'コレクションの「…」→ Export で JSON に。Git で管理したり、チームで共有したりできる'],
          ]),
          CODE('Newman：コマンドでコレクションを実行（CI でのテストに）', "npm install -g newman\nnewman run my_api.postman_collection.json -e dev.postman_environment.json\n# 結果を JUnit 形式でも出す（CI の画面に表示できる）\nnewman run my_api.postman_collection.json -e dev.postman_environment.json -r cli,junit --reporter-junit-export results.xml"),
          TIP('Postman の代わりになる道具に、Bruno（コレクションをファイルで Git 管理できる）・Insomnia・VS Code の拡張機能（Thunder Client・REST Client）があります。会社のルールでクラウドへの保存が難しいときの選択肢になります。', 'ほかの道具'),
        ],
      },
      {
        id: 'practice', title: '練習問題',
        blocks: [
          P('Postman Echo（Postman 公式の確認用 API）を呼ぶ、5 つのリクエストのコレクションです。取り込んで Collection Runner で実行すると、1 つだけテストが失敗します。原因を見つけて、全部のテストを通してください。'),
          { type: 'practice', download: { label: '練習用のコレクションをダウンロード', sample: 'postman', filename: 'ctf_portal_practice.postman_collection.json' }, note: 'Import でこの JSON を取り込みます（インターネットへの接続が必要）' },
          STEPS([
            ['取り込む', '左上の Import に、ダウンロードした JSON をドラッグ＆ドロップ。'],
            ['まとめて実行する', 'コレクションの「Run」で、5 つを順に実行する。'],
            ['失敗を調べる', '失敗したリクエストを開き、ステータスと Authorization タブを確かめる。'],
            ['変数の流れを見る', '2 番のテストで保存した値が、3 番の URL でどう使われているかを確かめる。'],
          ]),
          { type: 'answer', text: '失敗するのは「4. Basic 認証」です。ステータスは 401（認証の失敗）。Authorization タブのパスワードが wrong-password になっているので、Postman Echo の決まりのパスワード「password」（ユーザー名は postman）に直すと 200 になり、全部のテストが通ります。2 番のスクリプトは応答の user を lastUser というコレクション変数に保存し、3 番は URL の {{lastUser}} でその値を使っています。' },
          FAQ([
            ['すべて失敗する（接続できない）', 'インターネットにつながっているか、会社のプロキシが必要でないか確かめます。プロキシは 設定 → Proxy で指定できます。'],
            ['証明書のエラーが出る', '社内のプロキシが HTTPS を検査している環境では、設定 → Certificates で社内の CA を追加します。'],
          ]),
        ],
      },
    ],
  },
];
