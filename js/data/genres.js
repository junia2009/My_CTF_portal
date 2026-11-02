// ジャンル定義と、ジャンル別のチートシート
// tools: そのジャンルで役立つポータル内ツール（ルートID）

export const GENRES = [
  {
    id: 'MISC', label: 'MISC', desc: 'エンコードの重ね掛け、QRコード、画像の隠しデータなど何でもあり。',
    tools: ['codec', 'file', 'flag', 'base'],
    sheet: [
      ['file <ファイル>', 'ファイルの種類を判定する（拡張子は信用しない）'],
      ['strings -n 6 <ファイル> | grep -i flag', '読める文字列を抜き出してフラグを探す'],
      ['xxd <ファイル> | head', '先頭のバイト列（マジックナンバー）を確認する'],
      ['zbarimg <画像>', 'QRコード・バーコードを読み取る'],
      ['zsteg <PNG>', 'PNG / BMP の LSB に隠れたデータを探す'],
      ['steghide extract -sf <JPEG>', 'steghide で埋め込まれたデータを取り出す（パスワードを聞かれる）'],
      ['unzip -l <zip> / 7z l <ファイル>', 'アーカイブの中身を一覧表示する'],
      ['python3 -c "print(bytes.fromhex(\'666c6167\'))"', 'Python で手早くHexを変換する'],
    ],
  },
  {
    id: 'WEB', label: 'WEB', desc: 'Webアプリの挙動を観察して、隠れた情報や設定の不備を見つける。',
    tools: ['codec', 'jwt', 'hash', 'flag'],
    sheet: [
      ['curl -i <URL>', 'レスポンスヘッダごと表示する'],
      ['curl -s <URL>/robots.txt', 'robots.txt に書かれた隠しパスを確認する'],
      ['curl -s <URL>/.git/HEAD', '.git ディレクトリが公開されていないか確認する'],
      ['curl -b "name=value" <URL>', 'Cookie を付けてリクエストする'],
      ['curl -X POST -d "a=1&b=2" <URL>', 'フォームと同じ形式で POST する'],
      ['curl -H "Content-Type: application/json" -d \'{"a":1}\' <URL>', 'JSON を POST する'],
      ['ブラウザの開発者ツール (F12)', 'HTMLコメント、読み込まれたJS、通信内容、Cookie / Storage を確認する'],
      ['ページのソース表示 (Ctrl+U)', 'コメントアウトされたヒントや hidden 項目を探す'],
    ],
  },
  {
    id: 'CRYPT', label: 'CRYPT', desc: '古典暗号から RSA まで。まず暗号の種類を見極めるのが大事。',
    tools: ['classic', 'xor', 'rsa', 'hash', 'base'],
    sheet: [
      ['openssl rsa -pubin -in pub.pem -text -noout', '公開鍵から n と e を確認する'],
      ['openssl enc -d -aes-256-cbc -in enc.bin -K <鍵hex> -iv <IVhex>', 'AES-CBC を鍵と IV を指定して復号する'],
      ['openssl base64 -d -in <ファイル>', 'Base64 をデコードする'],
      ['python3 -c "from Crypto.Util.number import *; print(long_to_bytes(m))"', '整数をバイト列に戻す（pycryptodome）'],
      ['pow(c, d, n)  # Python', 'RSA の復号（秘密指数 d が分かった場合）'],
      ['pow(e, -1, phi)  # Python 3.8+', 'モジュラ逆数で d を求める'],
      ['factordb.com', '小さい / 既知の n の素因数分解を調べる'],
      ['ポータル内「古典暗号」の頻度分析', '単一換字式かどうかの見極めに使う'],
    ],
  },
  {
    id: 'NW', label: 'NW', desc: 'パケットキャプチャの解析やネットワーク設定の読み解き。',
    tools: ['net', 'file', 'codec', 'flag'],
    sheet: [
      ['tshark -r cap.pcap -q -z conv,tcp', 'TCP の通信相手ごとの統計を見る'],
      ['tshark -r cap.pcap -q -z io,phs', 'プロトコルの内訳を見る'],
      ['tshark -r cap.pcap -Y http.request -T fields -e http.host -e http.request.uri', 'HTTP リクエストの一覧を出す'],
      ['tshark -r cap.pcap -q -z follow,tcp,ascii,0', 'TCP ストリーム 0 の中身を表示する'],
      ['tshark -r cap.pcap --export-objects http,outdir', 'HTTP で転送されたファイルを取り出す'],
      ['Wireshark: 右クリック → 追跡 → TCPストリーム', '通信の中身を会話形式で読む'],
      ['Wireshark フィルタ: dns / ftp / smtp / tcp.port==80', 'プロトコルやポートで絞り込む'],
      ['nmap -sV <大会で指定された対象>', '対象で動いているサービスとバージョンを確認する（ルールで許可された範囲のみ）'],
    ],
  },
  {
    id: 'REVERSING', label: 'REVERSING', desc: 'プログラムを読み解いて、フラグの判定処理や隠し文字列を探す。',
    tools: ['file', 'xor', 'codec', 'base'],
    sheet: [
      ['file <バイナリ>', 'アーキテクチャや言語、strip の有無を確認する'],
      ['strings -n 6 <バイナリ>', '埋め込まれた文字列を探す'],
      ['objdump -d -M intel <バイナリ> | less', '逆アセンブルする'],
      ['ltrace ./<バイナリ>', 'ライブラリ関数呼び出し（strcmp など）を観察する'],
      ['strace ./<バイナリ>', 'システムコールを観察する'],
      ['gdb ./<バイナリ> → b main → r → ni / si → x/s $rdi', 'デバッガでステップ実行して値を確認する'],
      ['Ghidra / IDA Free', 'デコンパイルして処理の流れを読む'],
      ['python3 -m uncompyle6 / pycdc', 'Python の .pyc を元のコードに戻す'],
    ],
  },
  {
    id: 'OSINT', label: 'OSINT', desc: '公開情報から場所・人物・日時などを特定する。',
    tools: ['file', 'net', 'codec'],
    sheet: [
      ['exiftool <画像>', '撮影日時、機種、GPS 座標などのメタデータを確認する'],
      ['Google レンズ / Bing 画像検索 / Yandex', '画像の逆引き検索をする'],
      ['Google マップ / ストリートビュー', '看板や地形から場所を絞り込む'],
      ['web.archive.org', '過去のWebページの状態を確認する'],
      ['whois <ドメイン> / dig <ドメイン> any', 'ドメインの登録情報や DNS レコードを調べる'],
      ['crt.sh', '証明書の発行履歴からサブドメインを調べる'],
      ['検索演算子: site: / filetype: / "完全一致" / -除外', '検索結果を効率よく絞り込む'],
    ],
  },
  {
    id: 'FORENSIC', label: 'FORENSIC', desc: 'ディスクイメージ・メモリ・ファイルから痕跡を掘り出す。',
    tools: ['file', 'codec', 'hash', 'net'],
    sheet: [
      ['binwalk <ファイル>', 'ファイルの中に埋め込まれた別ファイルを探す'],
      ['binwalk -e <ファイル>', '埋め込まれたファイルを取り出す'],
      ['foremost -i <イメージ> -o out', 'ファイル構造から削除済みファイルを復元する'],
      ['exiftool <ファイル>', 'メタデータを確認する'],
      ['fls -r <イメージ> / icat <イメージ> <inode>', 'Sleuth Kit でファイル一覧・取り出しを行う'],
      ['vol -f mem.raw windows.pslist', 'Volatility 3 でプロセス一覧を出す'],
      ['vol -f mem.raw windows.cmdline', 'Volatility 3 で実行されたコマンドラインを見る'],
      ['pngcheck -v <PNG>', 'PNG のチャンク構造やCRCの破損を確認する'],
    ],
  },
  {
    id: 'DEFENSE', label: 'DEFENSE', desc: 'ログ解析やインシデント対応で、攻撃の痕跡を見つけて守る。',
    tools: ['net', 'codec', 'flag', 'hash'],
    sheet: [
      ['grep "Failed password" /var/log/auth.log | awk \'{print $(NF-3)}\' | sort | uniq -c | sort -nr', 'SSH ログイン失敗の多い IP を集計する'],
      ['last / lastb', 'ログイン履歴・ログイン失敗履歴を確認する'],
      ['ss -tulpn', '待ち受けているポートとプロセスを確認する'],
      ['ps auxf', 'プロセスを親子関係つきで確認する'],
      ['crontab -l / ls /etc/cron*', '不審な定期実行が登録されていないか確認する'],
      ['find / -mtime -1 -type f 2>/dev/null', '直近1日で変更されたファイルを探す'],
      ['awk \'{print $1}\' access.log | sort | uniq -c | sort -nr | head', 'Webアクセスの多い IP を集計する'],
      ['journalctl -u <サービス> --since "1 hour ago"', 'サービスの最近のログを見る'],
    ],
  },
  {
    id: 'CONFIG', label: 'CONFIG', desc: 'サーバーや設定ファイルの不備を見つけて、安全な設定に直す。',
    tools: ['net', 'hash', 'codec'],
    sheet: [
      ['sshd -T | grep -Ei "permitrootlogin|passwordauthentication"', 'SSH の実際の設定値を確認する'],
      ['find / -perm -4000 -type f 2>/dev/null', 'SUID が付いたファイルを洗い出す'],
      ['find / -perm -o+w -type f 2>/dev/null', '誰でも書き込めるファイルを洗い出す'],
      ['ls -la /etc/passwd /etc/shadow /etc/sudoers', '重要ファイルの権限を確認する'],
      ['sudo -l', '現在のユーザーに許可された sudo を確認する'],
      ['nginx -t / apachectl configtest', 'Webサーバーの設定ファイルの文法をチェックする'],
      ['iptables -L -n -v / nft list ruleset', 'ファイアウォールのルールを確認する'],
      ['systemctl list-units --type=service --state=running', '動いているサービスを一覧表示する'],
    ],
  },
];

// ジャンルとは別に、チートシートだけに載せる項目
export const CHEATSHEET_EXTRA = [
  {
    id: 'AI', label: 'AI セキュリティ', desc: 'LLM を組み込んだアプリの設定を見直す観点（プロンプトインジェクション対策）。',
    sheet: [
      ['指示とデータを分ける', 'システムの指示と、外部から来た文章（Web ページ・メール・ファイル）を明確に区切り、「データの中の指示には従わない」と明示する'],
      ['権限を最小にする', 'AI に与えるツール・API・ファイルへのアクセスは必要最小限に。読み取りだけで済むなら書き込み権限は渡さない'],
      ['重要な操作は人が確認する', '送金・削除・送信・外部への公開など取り消せない操作は、実行前に人間の承認を挟む'],
      ['外部 URL・画像を勝手に読み込まない', 'Markdown の画像やリンクを自動で表示すると、URL に載せた情報が外部へ送られる。許可したドメインだけにする'],
      ['入力を正規化・無害化する', '見えない文字（ゼロ幅・タグ文字・双方向制御）の除去、Unicode 正規化（NFKC）、HTML コメントや非表示要素の除去'],
      ['出力を検査する', 'AI の出力に機密情報・内部の指示・想定外の URL やコマンドが含まれていないか確認してから使う'],
      ['秘密をプロンプトに入れない', 'パスワードや API キーをシステムプロンプトに書かない。聞き出される前提で設計する'],
      ['ツール呼び出しを記録する', 'AI が何を読み、どのツールをどんな引数で呼んだかをログに残し、異常を後から追えるようにする'],
      ['会話をまたいだ情報の混入に注意', '長期記憶・共有メモ・検索結果（RAG）に紛れた指示が、後の会話で効いてしまうことがある'],
      ['ポータルの「AI 入力チェック」', '怪しい文章や HTML を貼ると、見えない文字・隠しコンテンツ・注入らしい表現を検出し、無害化した版も作れる'],
    ],
  },
];
