// ツールの使い方ガイドの挿絵（章ごとの 1 枚絵）。キーは「ガイドの id/章の id」
// panels：[絵の種類, 絵の中の文字, 説明]。絵の種類は js/ui/illust.js の ICONS を参照
export const MANUAL_ILLUST = {
  // ---------- QGIS ----------
  'qgis/about': { title: 'QGIS がしてくれること', panels: [['file', 'points.csv', '座標の一覧・GPS の記録'], ['window', 'QGIS', '地図に重ねる'], ['search', 'MAP', '形・経路・場所が見える']], point: '1 点ならポータルの位置特定、たくさんの点・重ね合わせなら QGIS' },
  'qgis/install': { title: 'インストールの流れ', panels: [['download', 'QGIS LTR', '長期サポート版を選ぶ'], ['window', 'QGIS', '起動して日本語を確認'], ['browser', 'OpenStreetMap', '背景の地図が出れば完了']], point: '地図はネットから読む。会場で使えるか事前に確認' },
  'qgis/screen': { title: '背景の地図を重ねる', panels: [['browser', 'XYZ Tiles', 'ブラウザから選ぶ'], ['bars', 'レイヤー', '上にあるほど手前'], ['search', '地理院の写真', '地図と航空写真を見比べる']], point: '資料に使うときは出典の表示を忘れずに' },
  'qgis/points': { title: '座標の一覧を地図に置く', panels: [['file', 'lat,lon', 'CSV を用意'], ['window', 'Ctrl+Shift+T', '区切りテキストで読み込む'], ['chip', 'X=lon Y=lat', '経度が X、緯度が Y'], ['search', 'EPSG:4326', '座標参照系を指定']], point: 'X と Y を逆にすると点が海の上に出る' },
  'qgis/photos': { title: '写真の撮影場所をまとめて置く', panels: [['file', 'IMG_*.jpg', '写真を 1 つのフォルダに'], ['recipe', 'geotagged', 'ジオタグ付き写真のインポート'], ['search', '撮影地点', '点として地図に並ぶ']], point: '位置情報は消されていたり書き換えられたりする。ほかの手がかりと合わせて' },
  'qgis/measure': { title: '測る・調べる・書き出す', panels: [['kbd', 'Ctrl+Shift+M', '距離を測る'], ['kbd', 'Ctrl+Shift+I', '点の属性を見る'], ['kbd', 'F6', '属性テーブル'], ['export', 'PNG', '地図を画像に']], point: '広い範囲の距離も、楕円体を考えて正しく測ってくれる' },
  'qgis/practice': { title: '練習の流れ', panels: [['download', 'points.csv', 'ダウンロード'], ['window', 'X=lon Y=lat', '地図に読み込む'], ['search', '???', '浮かぶ文字を読む'], ['flag', '900 m?', '東京駅からの距離を測る']], point: '文字が反転して見えたら X と Y を入れ替える' },
  // ---------- Postman ----------
  'postman/about': { title: 'Postman がしてくれること', panels: [['window', 'GET /api/…', 'リクエストを組み立てる'], ['server', 'API', '送って応答を見る'], ['check', 'Tests', '保存・自動で確かめる']], point: '通信を「見る」のは Burp・mitmproxy、自分で「送る」のは Postman' },
  'postman/install': { title: 'インストールの流れ', panels: [['download', 'Postman', 'デスクトップ版を入れる'], ['lock', 'Sign in', 'サインイン（保存・共有に必要）'], ['warn', 'Public?', 'ワークスペースの公開範囲を確認']], point: '会社の API キーを公開ワークスペースに置かない' },
  'postman/screen': { title: '最初のリクエスト', panels: [['chip', 'GET', 'メソッドを選ぶ'], ['browser', 'postman-echo.com/get', 'URL を入れる'], ['kbd', 'Ctrl+Enter', '送る'], ['code', '{ "args": … }', '応答を読む']], point: 'Postman Echo は送った値をそのまま返す確認用の API' },
  'postman/vars': { title: '変数と環境', panels: [['chip', '{{baseUrl}}', 'URL に変数を書く'], ['bars', '開発 / 本番', '環境で値を切り替える'], ['lock', 'secret', '秘密の値は伏せ字・共有しない']], point: '範囲の狭い変数ほど優先される' },
  'postman/tests': { title: 'スクリプトで自動テスト', panels: [['code', 'pm.test(…)', '応答を確かめる'], ['code', 'environment.set|(\'token\')', '値を次へ渡す'], ['loop', 'Runner', 'まとめて実行'], ['check', 'Pass', '結果を一覧で']], point: 'ログイン → トークン → 呼び出し、の流れを自動化できる' },
  'postman/cli': { title: '取り込み・書き出し・Newman', panels: [['terminal', 'curl …', 'curl を取り込む'], ['export', 'JSON', 'コレクションを書き出す'], ['terminal', 'newman run', 'コマンドで実行（CI）']], point: '開発者ツールの「Copy as cURL」と組み合わせると速い' },
  'postman/practice': { title: '練習の流れ', panels: [['download', 'collection.json', 'ダウンロード'], ['window', 'Import', '取り込む'], ['loop', 'Run', 'まとめて実行'], ['warn', '401', '失敗の原因を直す']], point: 'ステータスと Authorization タブを見比べよう' },
  // ---------- Ghidra ----------
  'ghidra/about': { title: 'Ghidra がしてくれること', panels: [['file', 'crackme', '配られた実行ファイル'], ['code', 'mov eax, [rbp-4]|xor eax, 0x37|cmp cl, al', '機械語を命令に戻す（逆アセンブル）'], ['code', 'if ((c ^ 0x37)|   != enc[i])|  return 0;', 'C 言語に近い形に戻す（デコンパイル）']], point: '読めない機械語を、人が読める形にしてくれる' },
  'ghidra/install': { title: 'インストールの流れ', panels: [['chip', 'JDK 21', 'Java を入れる'], ['download', 'ghidra_11.x.zip', 'zip をダウンロード'], ['zip', '', '展開するだけ（インストーラー無し）'], ['window', 'Ghidra', 'ghidraRun で起動']], point: '会場では落とせないことがある。大会の前に一度起動して確認' },
  'ghidra/import': { title: 'ファイルを読み込んで解析する', panels: [['window', 'New Project', 'プロジェクトを作る'], ['file', 'crackme', 'I キーで取り込む'], ['window', 'CodeBrowser', 'ダブルクリックで開く'], ['loop', 'Analyze', '自動解析は Yes']], point: '右下の進捗バーが消えたら解析完了' },
  'ghidra/flow': { title: '文字列から判定の場所へたどる', panels: [['search', '"Correct!"', '文字列を探す'], ['graph', 'XREF', '使っている関数へ飛ぶ'], ['code', 'if ((input[i] ^ 0x37)|   != DAT_00102010[i])', '判定の条件を読む'], ['flag', 'flag{…}', '配列を戻して逆算']], point: 'main から順に読むより、文字列から逆にたどるほうが早いことが多い' },
  'ghidra/keys': { title: 'よく使う 4 つのキー', panels: [['kbd', 'G', '指定の場所へ移動'], ['kbd', 'L', '名前を変える'], ['kbd', 'Ctrl+L', '型を変える'], ['kbd', ';', 'コメントを付ける']], point: '名前と型を付けるほど、デコンパイル結果は読みやすくなる' },
  'ghidra/patch': { title: '分岐を書き換える（パッチ）', panels: [['code', 'cmp eax, 0|JNZ wrong', '判定の分岐を見つける'], ['code', 'cmp eax, 0|JZ  wrong', '逆の分岐に書き換える'], ['export', 'Original File', 'Export Program で書き出す']], point: 'フラグが入力から計算される問題は、パッチでは解けない（逆算する）' },
  'ghidra/trouble': { title: 'よくあるつまずき', panels: [['warn', '起動しない', 'JDK の版を確認'], ['question', 'main が無い', 'entry の __libc_start_main から探す'], ['chip', '0x1011e9 ＝ 0x11e9', 'アドレスは下 4 桁で照合']], point: '.NET は dnSpy、UPX は upx -d で展開してから' },
  'ghidra/practice': { title: '練習の流れ', panels: [['download', 'crackme', 'ダウンロード'], ['search', '"Correct"', '文字列から main へ'], ['code', 'c ^ 0x37|  != enc[i]', 'check を読む'], ['flag', 'flag{…}', 'enc を XOR で戻す']], point: '解けたら、ポータルのバイナリ解析で答え合わせ' },

  // ---------- Wireshark ----------
  'wireshark/about': { title: 'Wireshark で見るもの', panels: [['server', '', 'ネットワークを流れた通信'], ['file', 'capture.pcap', '記録したファイル'], ['window', 'Wireshark', '1 パケットずつ中身を読む']], point: '誰が・どこに・何を送ったかが分かる' },
  'wireshark/install': { title: '準備', panels: [['download', 'Wireshark', 'インストーラーを入手'], ['chip', 'Npcap（任意）', 'Windows は途中で聞かれる'], ['window', 'Wireshark', '起動して確認']], point: '他人の通信を勝手に記録しない。CTF は配られたファイルを開くだけ' },
  'wireshark/filter': { title: '表示フィルタで絞り込む', panels: [['bars', '2,341 パケット', 'すべてのパケット'], ['filter', 'http', 'フィルタを書いて Enter'], ['chip', '表示 12 件', '見たいものだけが残る']], point: '欄が緑なら正しい書き方、赤なら書き間違い' },
  'wireshark/flow': { title: 'CTF の定番の流れ', panels: [['bars', 'Protocol Hierarchy', '統計で全体を見る'], ['filter', 'http', '平文の通信に絞る'], ['chat', 'Follow TCP Stream', '会話として読む'], ['export', 'backup.txt', 'Export Objects で取り出す']], point: '取り出したファイルは、ポータルのファイル解析へ' },
  'wireshark/advanced': { title: 'TLS を鍵で復号する', panels: [['lock', 'TLS', '暗号化されていて読めない'], ['file', 'keylog.txt', '配られた鍵のログを設定'], ['unlock', 'HTTP', '中身が読めるようになる']], point: '鍵が配られていなければ、暗号化された通信は読めない' },
  'wireshark/keys': { title: 'よく使う操作', panels: [['kbd', 'Ctrl+F', 'パケットを検索'], ['kbd', 'Ctrl+G', '番号へ移動'], ['chip', 'Apply as Filter', '右クリックで絞り込み']], point: '詳細欄の右クリックから、正しいフィルタを自動で作れる' },
  'wireshark/trouble': { title: 'よくあるつまずき', panels: [['warn', 'フィルタが赤い', '書き方を確認'], ['chip', 'Decode As…', '別のポートの HTTP を読ませる'], ['lock', '中身が読めない', '暗号化か圧縮を疑う']], point: '重いときは、まずフィルタで絞ってから' },
  'wireshark/practice': { title: '練習の流れ', panels: [['download', 'sample_traffic.pcap', 'ダウンロード'], ['filter', 'http', '絞り込む'], ['chat', 'TCP Stream', '会話を読む'], ['flag', 'flag{…}', 'フラグを見つける']], point: '解けたら、ポータルの pcap 解析で答え合わせ' },

  // ---------- CyberChef ----------
  'cyberchef/about': { title: '料理のようにデータを戻す', panels: [['chip', 'NjY2YzYx…', '材料（入力）'], ['recipe', 'From Hex|From Base64|Gunzip', 'レシピ（操作を上から順に）'], ['flag', 'flag{…}', 'できあがり（出力）']], point: '400 種類以上の操作を、組み合わせて使える' },
  'cyberchef/install': { title: 'オフラインで使う準備', panels: [['download', 'CyberChef.zip', 'ダウンロード'], ['zip', '', '展開する'], ['browser', 'CyberChef.html', 'ブラウザで開く']], point: 'インターネットにつながっていなくても動く' },
  'cyberchef/basic': { title: 'レシピの作り方', panels: [['chip', 'Input に貼る', 'データを入れる'], ['search', 'From Base64', '操作を検索'], ['recipe', 'From Base64|From Hex', 'Recipe へドラッグ'], ['check', 'Output', '結果をその場で確認']], point: '形式が分からなければ Magic を足す' },
  'cyberchef/ops': { title: 'よく使う操作の 3 つの仲間', panels: [['recipe', 'From Base64|From Hex|URL Decode', '形式を戻す'], ['recipe', 'ROT13|XOR|AES Decrypt', '暗号を戻す'], ['recipe', 'Gunzip|Extract Files|Render Image', '展開・取り出し']], point: '「From」「Decode」「Decrypt」で検索すると見つかる' },
  'cyberchef/tips': { title: '便利な使い方', panels: [['chip', 'Save / Load', 'レシピを保存'], ['file', 'output.bin', '結果をファイルに保存'], ['recipe', 'Fork|To Hex|Merge', '1 行ずつ同じ処理']], point: '出力が記号だらけでも、To Hex で中身を確かめる' },
  'cyberchef/trouble': { title: 'うまくいかないとき', panels: [['warn', '結果が出ない', '順番か形式が違う'], ['breakpoint', 'ブレークポイント', '途中で止めて確かめる'], ['chip', 'HEX / UTF8', '鍵の書き方を合わせる']], point: 'AES はモード・鍵の長さ・IV も見直す' },
  'cyberchef/practice': { title: '加工を 1 枚ずつ剥がす', panels: [['hex', '48 34 73 49', 'Hex'], ['chip', 'H4sIAAAA…', 'Base64'], ['zip', 'gzip', '圧縮'], ['flag', 'flag{…}', '元の文字']], point: 'Base64 が H4sI で始まったら gzip の目印' },

  // ---------- gdb ----------
  'gdb/about': { title: '読む解析と、動かす解析', panels: [['code', 'cmp rax, 0x1b|jne fail', '読んで考える（静的解析）'], ['breakpoint', '', '好きな所で止める'], ['regs', 'rax 0x1b|rdi "AAAA"', '中の値を見る（動的解析）']], point: '読むより動かして見たほうが早い問題で使う' },
  'gdb/install': { title: '準備', panels: [['window', 'Linux / WSL', 'Linux を用意'], ['terminal', 'sudo apt install gdb', 'gdb を入れる'], ['chip', 'pwndbg / GEF', '拡張で見やすく']], point: 'set disassembly-flavor intel で Ghidra と同じ書き方に' },
  'gdb/basic': { title: '基本の 4 つ', panels: [['kbd', 'break', '止める場所を置く'], ['kbd', 'run', '実行する'], ['kbd', 'ni', '1 命令ずつ進む'], ['kbd', 'x/s', 'メモリの中身を見る']], point: '何も打たずに Enter で、直前のコマンドをくり返す' },
  'gdb/flow': { title: '比較の直前で正解をのぞく', panels: [['breakpoint', 'break strcmp', '比較の関数で止める'], ['regs', 'rdi "AAAA"|rsi "flag{…}"', '2 番目の引数が正解'], ['regs', 'rax 0 → 1', '戻り値を書き換えて先へ']], point: 'x86-64 の Linux では、引数は rdi・rsi・rdx… の順' },
  'gdb/trouble': { title: 'よくあるつまずき', panels: [['question', 'No symbol', '名前が無くてもアドレスで使える'], ['chip', '0x5555555551e9', 'PIE はこのアドレスで止める'], ['terminal', 'chmod +x crackme', '実行の権限を付ける']], point: '入力は run < input.txt でファイルから渡せる' },
  'gdb/practice': { title: '練習の流れ', panels: [['terminal', 'gdb ./crackme', '起動'], ['breakpoint', 'break check', '判定の関数で止める'], ['regs', 'rax 0 → 1', 'finish して set $rax=1'], ['check', 'Correct!', '正解の表示が出る']], point: 'フラグそのものは x/27xb &enc を XOR して得る' },

  // ---------- 開発者ツール ----------
  'devtools/about': { title: 'Web ページの裏側を見る', panels: [['kbd', 'F12', '開発者ツールを開く'], ['browser', 'ctf.example', 'いつものページ'], ['chip', 'Elements / Network …', 'タブで見る場所を変える']], point: 'ソースだけ見たいなら Ctrl+U' },
  'devtools/elements': { title: '画面に見えないものを探す', panels: [['browser', '', '見えている画面'], ['code', '<!-- hint -->|<button disabled>', 'HTML には隠れたものがある'], ['check', '', 'disabled を消すと押せる']], point: 'コメント・hidden・押せないボタンを確認する' },
  'devtools/console': { title: 'その場で JavaScript を動かす', panels: [['terminal', 'document.cookie', 'Cookie を表示'], ['terminal', "atob('ZmxhZw==')", 'Base64 を戻す'], ['warn', '', '知らないコードは貼らない']], point: '「ここに貼って」は乗っ取りの手口' },
  'devtools/sources': { title: 'JavaScript を読む', panels: [['code', 'function(a){var b=…', '圧縮された 1 行のコード'], ['chip', '{ }', 'Pretty print で整形'], ['search', '"flag"', '全ファイルを検索']], point: 'ブラウザ側に判定やフラグが書かれていることがある' },
  'devtools/network': { title: '裏の通信を見る', panels: [['browser', '', 'ページを再読み込み'], ['chat', '', '裏で行われた通信'], ['code', 'HTTP/1.1 200 OK|X-Flag: …', 'ヘッダと中身を読む']], point: 'Copy as cURL で、同じリクエストを送り直せる' },
  'devtools/application': { title: 'Cookie を書き換える', panels: [['cookie', 'role=user', 'Cookie を確認'], ['cookie', 'role=admin', '値を書き換える'], ['loop', '再読み込み', 'ページを読み直す']], point: 'サーバーが Cookie を信用しすぎていると、権限が変わってしまう' },
  'devtools/practice': { title: '3 つのフラグを探す', panels: [['code', '<!-- flag{…} -->', '① HTML のコメント'], ['code', '<button disabled>', '② 押せないボタン'], ['cookie', 'role=admin', '③ Cookie の書き換え']], point: 'このページの中だけで完結。外部には何も送らない' },

  // ---------- Burp Suite ----------
  'burp/about': { title: 'ブラウザとサーバーの間に入る', panels: [['browser', '', 'ブラウザ'], ['proxy', 'Burp', '止めて書き換える'], ['server', '', 'サーバー']], point: '書き換えてよいのは、大会で指定されたサイトだけ' },
  'burp/install': { title: '準備と起動', panels: [['download', 'Community Edition', '無料版を入れる'], ['window', 'Temporary project', '既定のまま起動'], ['browser', 'Open browser', '専用ブラウザを開く']], point: '専用ブラウザなら、証明書やプロキシの設定が要らない' },
  'burp/proxy': { title: 'リクエストを止めて書き換える', panels: [['code', 'POST /buy|price=1000', '止まったリクエスト'], ['code', 'POST /buy|price=1', '値を書き換える'], ['chip', 'Forward', 'サーバーへ送る']], point: '使わないときは Intercept を off にする' },
  'burp/repeater': { title: '何度も送り直す', panels: [['kbd', 'Ctrl+R', 'Repeater へ送る'], ['code', 'GET /item?id=1|GET /item?id=2', '値を変えて Send'], ['loop', '比べる', '応答の違いを見る']], point: 'CTF でいちばん使う機能' },
  'burp/trouble': { title: 'ページが止まったら', panels: [['loop', '読み込み中…', 'くるくる回ったまま'], ['proxy', 'Intercept on', 'Burp で止まっている'], ['chip', 'Forward / off', '送るか、止めるのをやめる']], point: '大量の自動送信（Intruder）は、大会ルールで禁止されがち' },
};
