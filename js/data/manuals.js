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
          { type: 'diagram' },
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
          { type: 'practice' },
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
];
