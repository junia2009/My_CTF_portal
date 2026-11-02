// ツールの使い方ガイド（外部ツール）
// 1つのガイド = 章（chapters）の並び。章は blocks（段落・手順・ヒント・注意・キー操作の表・図・コード・Q&A）でできている
// 新しいガイドは MANUALS に足すだけで、一覧と目次に出る

export const MANUALS = [
  {
    id: 'ghidra',
    name: 'Ghidra',
    kana: 'ギドラ',
    tagline: '無料で使える逆アセンブラ・デコンパイラ。実行ファイルを C 言語に近い形に戻して読める、REVERSING の定番ツール。',
    genres: ['REVERSING', 'FORENSIC'],
    level: '初級〜中級',
    prep: 'インストール 15 分（大会の前に済ませておく）',
    site: 'https://github.com/NationalSecurityAgency/ghidra/releases',
    siteLabel: '公式の配布ページ（GitHub）',
    icon: 'rev',
    chapters: [
      {
        id: 'about',
        title: 'Ghidra とは',
        blocks: [
          { type: 'p', text: '米国の国家安全保障局（NSA）が公開している、無料のリバースエンジニアリング用ツールです。配られた実行ファイル（Linux の ELF、Windows の .exe など）を読み込むと、機械語を命令に戻す「逆アセンブル」と、さらに C 言語に近い形に戻す「デコンパイル」を自動で行います。' },
          { type: 'list', title: 'こんなときに使う', items: [
            '「パスワードを当てろ」「正しい入力を探せ」という実行ファイル（クラックミー）が配られた',
            'プログラムの中に埋め込まれた文字列や配列から、フラグを組み立てる必要がある',
            'マルウェア風のサンプルが何をしているかを調べる（FORENSIC / DEFENSE）',
          ] },
          { type: 'tip', title: 'ポータルの「バイナリ解析」との使い分け', text: 'ポータルのバイナリ解析は、インストール不要でさっと中身を見るためのものです（関数一覧・文字列・簡易の疑似コード）。型を付けて読みやすくする、関数の中身を書き換える、大きなプログラムを本格的に読む、といった作業は Ghidra が得意です。まずポータルで当たりを付け、手ごわければ Ghidra で開く、という流れがおすすめです。', link: { label: 'バイナリ解析を開く', href: '#rev' } },
        ],
      },
      {
        id: 'install',
        title: '準備（インストール）',
        blocks: [
          { type: 'warn', text: '大会の会場ではダウンロードできないことがあります。必ず事前にインストールし、一度起動して動くことを確認しておきましょう。会社の PC にソフトを入れるときは、社内のルールに従ってください。' },
          { type: 'steps', items: [
            { title: 'Java（JDK）を入れる', text: 'Ghidra は Java で動きます。新しい Ghidra（11.2 以降）には JDK 21 が必要です。「Eclipse Temurin」などの無料の JDK 21 をインストールします。古い Ghidra を使う場合は、その版の案内に書かれた JDK を入れてください。' },
            { title: 'Ghidra をダウンロードする', text: '公式の配布ページ（GitHub の Releases）から、最新版の zip ファイル（ghidra_バージョン_PUBLIC_日付.zip）をダウンロードします。' },
            { title: 'zip を展開する', text: '好きな場所に展開します。フォルダの場所に日本語や空白を含めないのが無難です（例：C:\\tools\\ghidra、~/tools/ghidra）。インストーラーはなく、展開したら完了です。' },
            { title: '起動する', text: 'Windows は ghidraRun.bat、Mac / Linux は ghidraRun をダブルクリック（または端末で実行）します。初回は利用規約が表示されるので同意します。JDK の場所を聞かれたら、インストールした JDK のフォルダを選びます。' },
          ] },
          { type: 'code', title: 'Mac / Linux で端末から起動する例', code: 'cd ~/tools/ghidra_11.x_PUBLIC\n./ghidraRun' },
          { type: 'tip', text: '起動すると、まず小さな「Ghidra」ウィンドウ（プロジェクトの画面）が開きます。ここが入口です。' },
        ],
      },
      {
        id: 'import',
        title: 'ファイルを読み込んで解析する',
        blocks: [
          { type: 'steps', items: [
            { title: 'プロジェクトを作る', text: 'メニューの File → New Project → Non-Shared Project を選び、保存先のフォルダとプロジェクト名（例：ctf2026）を決めます。プロジェクトは「作業ノート」のようなもので、解析結果や付けた名前が保存されます。' },
            { title: 'ファイルを取り込む', text: 'File → Import File（キーボードの I）で問題のファイルを選ぶか、プロジェクトの画面にドラッグ＆ドロップします。形式（ELF / PE など）は自動で判定されるので、そのまま OK。最後に表示される結果の一覧も OK で閉じます。' },
            { title: '開く', text: 'プロジェクトの一覧に出たファイルをダブルクリックすると、解析用の画面（CodeBrowser）が開きます。' },
            { title: '自動解析を実行する', text: '「Analyze?（今すぐ解析しますか）」と聞かれたら Yes。設定画面はそのまま Analyze を押します。右下の進捗バーが消えたら解析完了です（小さなファイルなら数秒〜数十秒）。' },
          ] },
          { type: 'tip', text: '解析結果や付けた名前はプロジェクトに保存されます。閉じるときに「保存しますか」と聞かれたら Yes にしておくと、続きから再開できます。' },
        ],
      },
      {
        id: 'screen',
        title: '画面の見方',
        blocks: [
          { type: 'diagram', name: 'ghidra', caption: '解析画面（CodeBrowser）の配置。番号は下の説明に対応しています。' },
          { type: 'defs', items: [
            ['① Symbol Tree（シンボルツリー）', '関数や変数の一覧。Functions フォルダの中に main などの関数が並びます。下の Filter 欄に名前を入れると絞り込めます。'],
            ['② Listing（リスティング）', '逆アセンブルした命令が並ぶ、中央の画面。アドレス・機械語のバイト・命令が表示されます。'],
            ['③ Decompile（デコンパイル）', 'C 言語に近い形に戻した結果。初心者はまずここを読みます。Listing と連動していて、片方をクリックするともう片方の対応する場所が光ります。'],
            ['④ Program Trees / Data Type Manager', 'セクションの一覧と、型（int や構造体など）の一覧。最初はあまり使いません。'],
            ['⑤ Console（コンソール）', 'スクリプトの出力などが出る場所。'],
          ] },
          { type: 'tip', text: 'ウィンドウを閉じてしまったら、メニューの Window から開き直せます。分岐を図で見たいときは Window → Function Graph。' },
        ],
      },
      {
        id: 'flow',
        title: 'CTF の定番の流れ（クラックミーを解く）',
        blocks: [
          { type: 'p', text: '「入力したパスワードが正しいか判定するプログラム」を例に、フラグにたどり着くまでの流れです。どの問題でも、だいたいこの順で進めます。' },
          { type: 'steps', items: [
            { title: 'main 関数を開く', text: 'Symbol Tree の Functions を開き、Filter に main と入れてダブルクリック。Decompile 画面に main の中身が出ます。関数名が消されている（strip 済み）場合は、entry を開くと __libc_start_main の最初の引数に main の場所が書かれています（FUN_00101189 のような名前）。' },
            { title: '文字列から判定の場所を探す', text: 'Search → For Strings…（または Window → Defined Strings）で文字列の一覧を出し、「Correct」「Wrong」「flag」「password」などで絞り込みます。文字列をダブルクリックすると Listing のその場所へ移動し、右側に XREF（参照元）が表示されます。XREF をダブルクリックすると、その文字列を使っている関数へ飛べます。' },
            { title: '判定の処理を読む', text: 'Decompile 画面で、if 文の条件を読みます。「入力を何かと比べている」「1 文字ずつ変換して配列と比べている」などの形が見えたら、判定の場所です。' },
            { title: '名前と型を付けて読みやすくする', text: 'param_1 や local_28 のような自動の名前は、変数をクリックして L キーで「input」などに名前を変えます。型がおかしいときは Ctrl+L で「char *」などに直します。これだけで見違えるほど読みやすくなります。' },
            { title: '比べている値を取り出す', text: 'DAT_00102010 のような配列の名前をダブルクリックすると、Listing にそのバイト列が出ます。必要な範囲を選択して右クリック → Copy Special → Python List（または Byte String）でコピーできます。' },
            { title: '逆算してフラグを得る', text: '判定が「入力 XOR 0x37 == 配列」なら、配列を 0x37 で XOR し直せば正しい入力（フラグ）になります。計算はポータルの XOR ツールや Python で行います。' },
          ] },
          { type: 'code', title: '例：取り出した配列を Python で XOR して戻す', code: "enc = [0x51, 0x5b, 0x56, 0x50, 0x4c]  # Copy Special → Python List で貼り付けたもの\nprint(bytes(b ^ 0x37 for b in enc))   # b'flag{'" },
          { type: 'tip', title: 'デコンパイル結果の読み方のコツ', text: 'undefined8 は「8 バイトの何か」、iVar1 は「int 型の一時変数」という意味です。細かい型にこだわらず、「何と何を比べて、どちらに分岐するか」に注目しましょう。分からない関数（FUN_…）は、呼び出し元と中身を見て役割が分かったら名前を付けていきます。' },
        ],
      },
      {
        id: 'keys',
        title: 'よく使う操作',
        blocks: [
          { type: 'keys', items: [
            ['G', '指定したアドレス・関数名へ移動（Go To）'],
            ['L', '関数・変数・ラベルの名前を変える'],
            ['Ctrl + L', '変数の型を変える（Retype）'],
            [';', 'コメントを付ける'],
            ['Ctrl + Shift + F', 'その場所を参照している所を一覧（References to）'],
            ['Alt + ←', '直前に見ていた場所へ戻る'],
            ['S', 'バイト列や文字列でメモリを検索（Search Memory）'],
            ['ダブルクリック', '関数・変数・アドレスへ移動'],
            ['クリック', '同じ変数・命令がハイライトされる（どこで使われているか追える）'],
          ] },
          { type: 'tip', text: 'ショートカットは版によって変わることがあります。Edit → Tool Options → Key Bindings で確認・変更できます。メニューから同じ操作を選んでも構いません。' },
        ],
      },
      {
        id: 'patch',
        title: '応用：判定を書き換える（パッチ）',
        blocks: [
          { type: 'p', text: '「正解なら表示する」処理の分岐を書き換えて、どんな入力でも正解の側へ進ませる方法です。' },
          { type: 'steps', items: [
            { title: '分岐命令を見つける', text: 'Listing で、判定の直後にある JZ / JNZ（JE / JNE）などの条件分岐の命令を探します。' },
            { title: '命令を書き換える', text: '命令を右クリック → Patch Instruction（Ctrl + Shift + G）で、例えば JNZ を JZ に書き換えます。' },
            { title: '書き出して実行する', text: 'File → Export Program で Format に「Original File」を選ぶと、書き換えた実行ファイルを保存できます。' },
          ] },
          { type: 'warn', text: 'フラグそのものが入力から計算される問題では、パッチで「正解」と表示させてもフラグは出ません。その場合は判定を読んで逆算しましょう。また、書き換えたファイルを実行するのは、大会で許可された問題ファイルに限ってください。' },
        ],
      },
      {
        id: 'trouble',
        title: 'つまずきやすいところ',
        blocks: [
          { type: 'faq', items: [
            ['起動しない・すぐ終了する', 'JDK の版が合っていないことがほとんどです。使っている Ghidra に必要な JDK（11.2 以降なら JDK 21）が入っているか確認します。Ghidra のフォルダの場所に日本語や空白が含まれていないかも確認しましょう。'],
            ['main が見つからない', '関数名が消されています（strip 済み）。entry を開き、__libc_start_main に渡されている最初の引数が main です。ダブルクリックで飛び、L で main と名前を付けておきます。'],
            ['アドレスがポータルや objdump とずれる', 'Ghidra は PIE（位置独立）の ELF を 0x100000 から読み込みます。ポータルの 0x11e9 は、Ghidra では 0x1011e9 になります。下 4 桁が合っていれば同じ場所です。'],
            ['デコンパイル結果が undefined だらけで読めない', '型の情報が無いだけです。分かるところから Ctrl+L で型を付け、L で名前を付けると、ほかの場所の表示も連動して読みやすくなります。'],
            ['C# / .NET の exe だった', '.NET のプログラムは Ghidra より dnSpy や ILSpy のほうが、元のコードに近い形で読めます。ポータルのバイナリ解析でも .NET かどうか判定できます。'],
            ['UPX で圧縮されている', 'そのままでは中身が読めません。upx -d ファイル名 で展開してから読み込みます。ポータルのバイナリ解析でも UPX を検出できます。'],
            ['解析がなかなか終わらない', '大きなプログラム（静的リンク・Go 製など）は数分かかることがあります。右下の進捗を待ちましょう。急ぐときは、解析の途中でも関数一覧や文字列は見られます。'],
          ] },
        ],
      },
      {
        id: 'practice',
        title: '練習：サンプルで試してみる',
        blocks: [
          { type: 'p', text: 'このポータルの練習用クラックミー（Linux の 64 ビット実行ファイル）で、ここまでの流れを試せます。入力を 1 文字ずつ変換して、埋め込んだ配列と比べるプログラムです。' },
          { type: 'practice', download: { label: '練習用クラックミーをダウンロード', sample: 'rev', filename: 'crackme' }, portal: { label: 'ポータルのバイナリ解析で答え合わせ', page: 'rev', sample: 'rev' }, note: 'ファイル名：crackme（約 16KB、Linux x86-64）' },
          { type: 'steps', items: [
            { title: '読み込む', text: 'ダウンロードした crackme を Ghidra に取り込み、自動解析します。' },
            { title: '文字列を探す', text: 'Search → For Strings… で「Correct」を探し、XREF から main へ飛びます。' },
            { title: '判定の関数を開く', text: 'main の中の if 文で呼ばれている check 関数をダブルクリックします。' },
            { title: '配列と変換を読む', text: 'for 文の中で、入力の各文字を何と XOR して、どの配列と比べているかを読みます。' },
            { title: '逆算する', text: '配列をコピーして XOR し直すと、フラグが出てきます。' },
          ] },
          { type: 'answer', text: '判定は「入力の i 文字目 XOR 0x37 == enc[i]」で、文字数は 27 文字です。enc の 27 バイトを 0x37 で XOR すると flag{r3v3rs1ng_w1th_p4ll4s} になります。' },
        ],
      },
    ],
  },
  {
    id: 'wireshark',
    name: 'Wireshark',
    kana: 'ワイヤーシャーク',
    tagline: '通信の記録（pcap / pcapng）を開いて、パケットを 1 つずつ読める定番ツール。NW 問題の必需品。',
    genres: ['NW', 'FORENSIC', 'DEFENSE'],
    level: '初級〜中級',
    prep: 'インストール 10 分（大会の前に済ませておく）',
    site: 'https://www.wireshark.org/download.html',
    siteLabel: '公式のダウンロードページ',
    icon: 'pcap',
    chapters: [
      {
        id: 'about',
        title: 'Wireshark とは',
        blocks: [
          { type: 'p', text: 'ネットワークを流れたパケット（通信の小さなかたまり）を、1 つずつ中身まで表示できる無料のツールです。CTF では、配られた .pcap / .pcapng（通信を記録したファイル）を開いて、やり取りされたパスワードやファイル、フラグを探すのに使います。' },
          { type: 'list', title: 'こんなときに使う', items: [
            '.pcap / .pcapng / .cap のファイルが配られた（NW / FORENSIC）',
            '「誰が・どこに・何を送ったか」を調べる（不正アクセスの痕跡を追う DEFENSE 問題）',
            '通信の中でやり取りされたファイル（画像・zip など）を取り出したい',
          ] },
          { type: 'tip', title: 'ポータルの「pcap 解析」との使い分け', text: 'ポータルの pcap 解析は、インストール不要で HTTP・DNS・TCP の会話とフラグをさっと確認できます。いろいろなプロトコルを細かく見る、暗号化された通信を鍵で復号する、統計を取る、といった作業は Wireshark が得意です。', link: { label: 'pcap 解析を開く', href: '#pcap' } },
        ],
      },
      {
        id: 'install',
        title: '準備（インストール）',
        blocks: [
          { type: 'warn', text: '会場ではダウンロードできないことがあるので、事前にインストールしておきましょう。会社の PC にソフトを入れるときは、社内のルールに従ってください。' },
          { type: 'steps', items: [
            { title: 'ダウンロードする', text: '公式サイトの Download ページから、自分の OS 用のインストーラーを選びます（Windows は .exe、Mac は .dmg）。Linux は「sudo apt install wireshark」などで入ります。' },
            { title: 'インストールする', text: '基本は既定のまま進めて大丈夫です。Windows では途中で Npcap（通信を記録するための部品）を入れるか聞かれます。CTF で配られたファイルを開くだけなら無くても動きますが、入れておいても問題ありません。' },
            { title: '起動して確かめる', text: '起動すると、ネットワーク機器の一覧が出る最初の画面になります。ファイルを開くだけなら、ここで何も選ばなくて構いません。' },
          ] },
          { type: 'warn', text: '自分の PC で通信を記録（キャプチャ）するのは、自分の通信だけ・許可された環境だけにしてください。他人の通信を勝手に記録するのは違法になることがあります。CTF では配られたファイルを開くだけで十分です。' },
        ],
      },
      {
        id: 'open',
        title: 'ファイルを開く・画面の見方',
        blocks: [
          { type: 'p', text: 'File → Open で pcap を選ぶか、Wireshark の画面にファイルをドラッグ＆ドロップします。' },
          { type: 'diagram', name: 'wireshark', caption: 'Wireshark の画面の配置。番号は下の説明に対応しています。' },
          { type: 'defs', items: [
            ['① 表示フィルタ', '見たいパケットだけに絞り込む入力欄。ここを使いこなすのが上達の近道です（次の章）。'],
            ['② Packet List（パケット一覧）', '1 行が 1 パケット。番号・時刻・送信元・宛先・プロトコル・概要（Info）が並びます。クリックすると下に詳細が出ます。'],
            ['③ Packet Details（詳細）', '選んだパケットの中身を、層ごと（Ethernet → IP → TCP → HTTP …）に開いて読めます。項目を右クリック → Apply as Filter で、その値で絞り込めます。'],
            ['④ Packet Bytes（バイト列）', 'パケットの生のバイトを 16 進と文字で表示します。詳細で項目を選ぶと、対応するバイトが光ります。'],
            ['⑤ ステータスバー', '「Displayed（表示中）」と全体のパケット数。フィルタが効いているかを確認できます。'],
          ] },
        ],
      },
      {
        id: 'filter',
        title: '表示フィルタで絞り込む',
        blocks: [
          { type: 'p', text: '画面上部の入力欄にフィルタを書いて Enter。欄が緑なら正しい書き方、赤なら書き間違いです。消すと全パケットの表示に戻ります。左の式はクリックでコピーできます。' },
          { type: 'keys', copy: true, items: [
            ['http', 'HTTP の通信だけ（dns / ftp / smtp / telnet / icmp なども同じ書き方）'],
            ['ip.addr == 10.0.0.5', 'その IP アドレスが送信元か宛先のもの'],
            ['ip.src == 10.0.0.5', '送信元がその IP アドレスのもの（宛先は ip.dst）'],
            ['tcp.port == 80', 'TCP の 80 番ポートを使うもの（UDP は udp.port）'],
            ['http.request.method == "POST"', 'HTTP の POST（フォームの送信・ログインなど）'],
            ['http.response.code == 200', 'HTTP の応答が 200（成功）のもの'],
            ['frame contains "flag"', '中身に flag という文字を含むパケット'],
            ['frame matches "(?i)flag\\{"', '正規表現で探す（(?i) で大文字小文字を区別しない）'],
            ['tcp.stream eq 0', '0 番目の TCP の会話だけ'],
            ['tcp.flags.syn == 1 && tcp.flags.ack == 0', '接続を始めたパケット（ポートスキャンの痕跡探しに）'],
            ['!(arp or dns)', 'ARP と DNS 以外（not / and / or も使える）'],
          ] },
          { type: 'tip', text: '== は「完全に一致」、contains は「含む」です。文字列は " " で囲みます。迷ったら、詳細欄の項目を右クリック → Apply as Filter → Selected で、正しい書き方のフィルタを自動で入れてもらえます。' },
        ],
      },
      {
        id: 'flow',
        title: 'CTF の定番の流れ',
        blocks: [
          { type: 'steps', items: [
            { title: '全体を眺める', text: 'Statistics → Protocol Hierarchy で、どんなプロトコルが何割あるかを見ます。Statistics → Conversations で、誰と誰がどれだけ通信したかも分かります。珍しいプロトコルや、量の多い相手が怪しい場所です。' },
            { title: '平文のプロトコルから見る', text: 'http・ftp・telnet・smtp・pop・imap などは暗号化されていないので、パスワードや中身がそのまま読めます。フィルタで 1 つずつ確認しましょう。' },
            { title: '会話としてまとめて読む', text: '気になるパケットを右クリック → Follow → TCP Stream（UDP なら UDP Stream）。やり取り全体が会話の形で表示されます。赤が送信側、青が受信側です。下の「Show data as」で表示形式（ASCII / Raw など）を切り替え、「Save as」で保存できます。' },
            { title: 'やり取りされたファイルを取り出す', text: 'File → Export Objects → HTTP（SMB・TFTP なども選べます）で、通信の中で受け渡されたファイルの一覧が出ます。選んで Save すると取り出せます。取り出したファイルはポータルのファイル解析で調べましょう。' },
            { title: '文字列で探す', text: 'Edit → Find Packet（Ctrl + F）で、検索対象を「String」、場所を「Packet bytes」にして flag などを探せます。フィルタの frame contains "flag" も同じ目的に使えます。' },
          ] },
          { type: 'tip', title: 'DNS にも注目', text: '「dns」で絞り込んで問い合わせたドメイン名を見ると、サブドメインに Base64 などでデータを乗せて外へ送る手口（DNS トンネリング）が見つかることがあります。怪しい部分はポータルのエンコード / デコードで戻しましょう。' },
        ],
      },
      {
        id: 'advanced',
        title: '応用：暗号化された通信（TLS）を読む',
        blocks: [
          { type: 'p', text: 'HTTPS などの TLS 通信は、そのままでは中身が読めません。問題に「鍵のログファイル（SSLKEYLOGFILE の形式、CLIENT_RANDOM で始まる行が並ぶファイル）」が一緒に配られていれば、復号できます。' },
          { type: 'steps', items: [
            { title: '鍵のログを設定する', text: 'Edit → Preferences（Mac は Wireshark → Settings）→ Protocols → TLS を開き、「(Pre)-Master-Secret log filename」に配られた鍵のファイルを指定します。' },
            { title: '復号された中身を見る', text: 'OK を押すと、TLS の中の HTTP が読めるようになります。フィルタ「http」や Follow → TLS Stream で確認しましょう。' },
          ] },
          { type: 'tip', title: '標準と違うポートの通信', text: '8080 番など普段と違うポートの通信は、プロトコルが正しく判定されないことがあります。パケットを右クリック → Decode As… で「このポートは HTTP として読む」と指定できます。' },
        ],
      },
      {
        id: 'keys',
        title: 'よく使う操作',
        blocks: [
          { type: 'keys', items: [
            ['Ctrl + F', 'パケットを検索（文字列・16 進・表示フィルタで探せる）'],
            ['Ctrl + G', '番号を指定してパケットへ移動'],
            ['Ctrl + Alt + Shift + T', '選んだパケットの TCP の会話を表示（Follow TCP Stream）'],
            ['右クリック → Apply as Filter', '選んだ項目の値で絞り込む'],
            ['右クリック → Copy → Value', '選んだ項目の値をコピー'],
            ['View → Time Display Format', '時刻の表示（経過秒・日時など）を切り替える'],
          ] },
          { type: 'tip', text: 'コマンドで使える tshark も一緒に入ります。大量のファイルを処理するときに便利です（例はポータルのチートシートの NW を参照）。', link: { label: 'チートシートを開く', href: '#cheatsheet' } },
        ],
      },
      {
        id: 'trouble',
        title: 'つまずきやすいところ',
        blocks: [
          { type: 'faq', items: [
            ['フィルタの欄が赤くなる', '書き方の間違いです。文字列を " " で囲んでいるか、== と = を間違えていないか確認します。項目を右クリック → Apply as Filter で、正しい書き方を入れてもらうのが確実です。'],
            ['HTTP のはずなのに TCP としか表示されない', '標準と違うポートを使っている可能性があります。右クリック → Decode As… で HTTP として読ませます。'],
            ['中身がぐちゃぐちゃで読めない', 'TLS などで暗号化されているか、gzip などで圧縮されています。HTTP の圧縮は Wireshark が自動で戻して表示します（詳細欄の下に展開後のタブが出ます）。暗号化は、鍵が配られていなければ読めません。'],
            ['大きすぎて重い', 'まずフィルタで絞ってから見ます。Statistics の画面で全体像をつかんでから、怪しいところだけを開くのが効率的です。'],
            ['ファイルが開けない', 'まれに壊れた pcap が配られることがあります。ポータルのファイル解析で先頭のバイト（マジックナンバー）を確認し、pcap なら d4 c3 b2 a1、pcapng なら 0a 0d 0d 0a で始まっているかを見ましょう。'],
          ] },
        ],
      },
      {
        id: 'practice',
        title: '練習：サンプルで試してみる',
        blocks: [
          { type: 'p', text: 'このポータルの練習用 pcap で、ここまでの流れを試せます。社内サーバーにファイルを取りに行った通信が記録されています。' },
          { type: 'practice', download: { label: '練習用 pcap をダウンロード', sample: 'pcap', filename: 'sample_traffic.pcap' }, portal: { label: 'ポータルの pcap 解析で答え合わせ', page: 'pcap', sample: 'pcap' }, note: 'ファイル名：sample_traffic.pcap（7 パケット）' },
          { type: 'steps', items: [
            { title: '開いて全体を見る', text: 'Wireshark で開き、7 つのパケットのプロトコル（DNS・TCP・HTTP）を確認します。' },
            { title: '絞り込む', text: 'フィルタに http と入れて Enter。どのファイルを取りに行ったかを Info 欄で確認します。' },
            { title: '会話を読む', text: 'HTTP のパケットを右クリック → Follow → TCP Stream で、送られた中身を読みます。' },
            { title: 'ファイルを取り出す', text: 'File → Export Objects → HTTP で、受け渡されたファイルを保存してみましょう。' },
          ] },
          { type: 'answer', text: 'クライアント（10.10.0.23）が intranet.ctf.local の /admin/backup.txt を取得しています。応答の本文の最後の行が flag{p4ck3t_hunt3r} です。Export Objects → HTTP でも backup.txt として取り出せます。' },
        ],
      },
    ],
  },
  {
    id: 'cyberchef',
    name: 'CyberChef',
    kana: 'サイバーシェフ',
    tagline: 'ブラウザで動く「データ変換の万能ナイフ」。エンコード・暗号・圧縮などの処理を、料理のレシピのようにつなげて試せる。',
    genres: ['MISC', 'CRYPT', 'FORENSIC'],
    level: '初級',
    prep: 'ダウンロード 1 分（インストール不要）',
    site: 'https://github.com/gchq/CyberChef/releases',
    siteLabel: '公式の配布ページ（GitHub）',
    icon: 'codec',
    chapters: [
      {
        id: 'about',
        title: 'CyberChef とは',
        blocks: [
          { type: 'p', text: '英国の政府機関（GCHQ）が公開している、無料のデータ変換ツールです。Base64 のデコード、XOR、AES の復号、圧縮の展開など 400 種類以上の「操作（オペレーション）」があり、それを順番に並べた「レシピ」で、何重にも加工されたデータを元に戻せます。ブラウザだけで動き、データは外部に送られません。' },
          { type: 'list', title: 'こんなときに使う', items: [
            '何重にもエンコードされた文字列を、順番に戻したい（MISC）',
            'AES・DES・RC4 などの鍵や IV が分かっている暗号文を復号したい（CRYPT）',
            'ファイルの中から別のファイルや URL・IP アドレスを抜き出したい（FORENSIC）',
          ] },
          { type: 'tip', title: 'ポータルの「エンコード / デコード」との使い分け', text: 'ポータルのエンコード / デコードにも、自動解析（Magic）とレシピがあり、よく使う変換はこちらで足ります。AES などの本格的な暗号の復号、珍しい形式の変換、細かい設定が必要な処理は CyberChef が得意です。', link: { label: 'エンコード / デコードを開く', href: '#codec' } },
        ],
      },
      {
        id: 'install',
        title: '準備（ダウンロードしてオフラインで使う）',
        blocks: [
          { type: 'p', text: 'インストールは不要です。公開サイト（gchq.github.io/CyberChef）を開けばすぐ使えますが、大会では手元に保存したものを使うのがおすすめです。' },
          { type: 'steps', items: [
            { title: 'ダウンロードする', text: '公式の配布ページ（GitHub の Releases）から CyberChef_v….zip をダウンロードします。公開サイトの左上の「Download CyberChef」からも入手できます。' },
            { title: '展開して開く', text: 'zip を展開し、中の CyberChef_v….html をブラウザで開きます。インターネットにつながっていなくても動きます。' },
          ] },
          { type: 'warn', text: 'レシピを共有する URL には、入力したデータも含まれることがあります。チーム内で共有するときも、フラグや問題のデータが他の人に見られないよう注意しましょう。' },
        ],
      },
      {
        id: 'screen',
        title: '画面の見方',
        blocks: [
          { type: 'diagram', name: 'cyberchef', caption: 'CyberChef の画面の配置。番号は下の説明に対応しています。' },
          { type: 'defs', items: [
            ['① Operations（操作の一覧）', '使える操作の一覧。上の検索欄に「base64」などと入れると絞り込めます。'],
            ['② Recipe（レシピ）', '使う操作を並べる場所。操作をここへドラッグ（またはダブルクリック）すると追加され、上から順番に実行されます。'],
            ['③ Input（入力）', '変換したいデータを貼る場所。右上のボタンからファイルも読み込めます。'],
            ['④ Output（出力）', '結果が表示されます。保存ボタンでファイルとして保存したり、入力へ戻したりできます。'],
            ['BAKE!（料理する）', 'レシピを実行するボタン。横の「Auto Bake」にチェックが入っていれば、入力やレシピを変えるたびに自動で実行されます。'],
          ] },
        ],
      },
      {
        id: 'basic',
        title: '基本の使い方（レシピを作る）',
        blocks: [
          { type: 'steps', items: [
            { title: 'データを貼る', text: 'Input に、問題の文字列を貼ります。' },
            { title: '操作を探して追加する', text: 'Operations の検索欄に「From Base64」と入れ、出てきた操作を Recipe へドラッグします。Output にすぐ結果が出ます。' },
            { title: '続けて重ねる', text: '結果がまだ読めなければ、次の操作（From Hex、Gunzip など）を Recipe の下に追加していきます。上から順に処理されます。' },
            { title: '設定を変える', text: 'レシピの中の各操作には設定欄があります。XOR なら鍵（Key）と、その書き方（HEX / UTF8 など）を選びます。' },
            { title: '途中を確かめる', text: '操作の右側の一時停止ボタン（ブレークポイント）を押すと、そこで止めて途中経過を見られます。無効化ボタンで一時的に外すこともできます。' },
          ] },
          { type: 'tip', title: '魔法の杖（Magic）', text: '何の形式か分からないときは、Operations から「Magic」を追加すると、試せる組み合わせを自動で探して候補を出してくれます。出力欄の右上に杖のマークが出たときは、クリックすると「このレシピで読めそう」という提案が入ります。' },
        ],
      },
      {
        id: 'ops',
        title: 'CTF でよく使う操作',
        blocks: [
          { type: 'keys', items: [
            ['From Base64 / From Base32 / From Base58', 'それぞれの形式から元に戻す'],
            ['From Hex / From Binary / From Decimal', '16 進・2 進・10 進の数字の列から戻す'],
            ['URL Decode / From HTML Entity', 'Web でよく見る %41 や &#65; の形を戻す'],
            ['ROT13 / ROT47', 'シーザー暗号（ROT13 は Amount でずらす量を変えられる）'],
            ['XOR / XOR Brute Force', '鍵を指定して XOR、または 1 バイトの鍵を総当たり'],
            ['AES Decrypt / DES Decrypt / RC4', '鍵（Key）・IV・モード（CBC / ECB など）を指定して復号'],
            ['Gunzip / Zlib Inflate / Bzip2 Decompress', '圧縮されたデータを展開'],
            ['Reverse', '文字の並びを逆にする'],
            ['Regular expression / Extract URLs / Extract IP addresses', '決まった形の文字列を抜き出す'],
            ['Detect File Type / Extract Files', 'データの正体を推測する・中に埋め込まれたファイルを取り出す'],
            ['Render Image', '画像のデータを画像として表示する'],
            ['JWT Decode / From Morse Code', 'JWT の中身を見る・モールス信号を戻す'],
          ] },
          { type: 'tip', text: '操作の名前を全部覚える必要はありません。「From」「Decode」「Decrypt」などの言葉で検索すると、だいたい見つかります。' },
        ],
      },
      {
        id: 'tips',
        title: '便利な使い方',
        blocks: [
          { type: 'list', items: [
            'レシピの保存：Recipe の下の Save で、作ったレシピに名前を付けて保存できます（Load で呼び出し）。同じ形式の問題が続くときに便利です。',
            'ファイルを扱う：Input 右上のボタンでファイルを読み込み、Output の保存ボタンで結果をファイルにできます。画像や zip が出てきたら保存して、ポータルのファイル解析で調べましょう。',
            '1 行ずつ処理する：Fork（区切り文字で分けて、それぞれに同じ処理）と Merge（まとめ直す）を使うと、複数行のデータを 1 行ずつ変換できます。',
            '文字化けして見えるとき：出力が読めない記号だらけでも、中身は正しいバイト列のことがあります。To Hex で 16 進にして確かめましょう。',
          ] },
        ],
      },
      {
        id: 'trouble',
        title: 'つまずきやすいところ',
        blocks: [
          { type: 'faq', items: [
            ['結果が何も出ない・エラーになる', '操作の順番が逆か、形式が違います。途中にブレークポイントを置いて、どこまで正しく戻っているかを確かめましょう。'],
            ['AES の復号がうまくいかない', '鍵と IV の「書き方（HEX / UTF8 / Base64）」の指定が合っているか確認します。モード（CBC / ECB / CTR など）や、鍵の長さ（16 / 24 / 32 バイト）も見直しましょう。'],
            ['XOR の鍵の書き方が分からない', '鍵が 0x37 のような数なら HEX を選んで 37、文字なら UTF8 を選んでそのまま入れます。'],
            ['入力が大きすぎて重い', 'Auto Bake のチェックを外し、レシピができてから BAKE! を押します。'],
          ] },
        ],
      },
      {
        id: 'practice',
        title: '練習：何重にも加工された文字列を戻す',
        blocks: [
          { type: 'p', text: '次の文字列は、フラグにいくつかの加工を重ねたものです。CyberChef にコピーして、元に戻してみましょう。' },
          { type: 'practice', input: '4834734941414141414141432f30764c5355797654733477546f76504d53677a4c6f34764d6b34324c44417572675541546f6f43355267414141413d', portal: { label: 'ポータルの自動解析（Magic）で答え合わせ', page: 'codec', payload: { text: '4834734941414141414141432f30764c5355797654733477546f76504d53677a4c6f34764d6b34324c44417572675541546f6f43355267414141413d', magic: true } } },
          { type: 'steps', items: [
            { title: '見た目から推理する', text: '0〜9 と a〜f だけでできている → 16 進数（Hex）のようです。From Hex を追加します。' },
            { title: '次の形を見る', text: '英数字と + / = でできた文字列が出てきたら、Base64 です。From Base64 を追加します。' },
            { title: '読めない記号になったら', text: '「Detect File Type」を一時的に足すと、何の形式か推測してくれます。圧縮の形式が分かったら、対応する展開の操作に差し替えます。' },
          ] },
          { type: 'answer', text: 'レシピは From Hex → From Base64 → Gunzip の 3 段です。フラグは flag{ch3f_l0v3s_r3c1p3s} です。From Hex で出てくる Base64 の文字列が H4sI で始まるのは、gzip で圧縮されたデータの目印です。' },
        ],
      },
    ],
  },
];
