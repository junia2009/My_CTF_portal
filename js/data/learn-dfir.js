// 学ぶ：フォレンジック（基礎とインシデント対応・ログと痕跡）と、サーバーの守り（Linux・Windows）
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

export const DFIR_TEXTS = [
  // ============================================================
  {
    id: 'dfir-basic',
    subject: 'フォレンジック',
    name: 'フォレンジックの基礎とインシデント対応',
    tagline: '証拠を壊さずに集め、時系列で「何が起きたか」を組み立てる。保全の原則、ディスクイメージ、ファイルの調べ方、メモリの解析、インシデント対応の流れまで。',
    genres: ['FORENSIC', 'DEFENSE'],
    level: '入門〜初級',
    prep: '約 80 分（章ごとに読める）',
    prepLabel: '読む時間',
    icon: 'file',
    chapters: [
      {
        id: 'about', title: 'フォレンジックとは・大原則',
        blocks: [
          P('デジタル・フォレンジックは、コンピューターやネットワークに残った記録（証拠）を集めて調べ、「いつ・誰が・何を・どうやって」を明らかにする技術です。不正アクセスやマルウェア感染の調査、情報の持ち出しの確認、そして CTF の FORENSIC 問題の土台になります。'),
          LIST('大原則', [
            '元の証拠を変えない：調べるのは複製。元は書き込みできないようにする',
            '記録を残す：いつ・誰が・何をしたかをすべて書く（第三者が同じ結果を確かめられるように）',
            '消えやすいものから集める：メモリ → ネットワーク → ディスクの順',
            '時刻をそろえる：タイムゾーン・機器の時計のずれを確認してから比べる',
            '思い込まない：1 つの記録で決めず、複数の記録を突き合わせる',
          ]),
          FIG('volatile', '電源を切るとメモリの中身（実行中のプログラム・通信・鍵）は消える'),
          WARN('会社で本格的な事件が疑われるときは、自分で調べ始める前に、決められた窓口（情報システム部門・CSIRT）へ連絡しましょう。慌てて電源を切る・ウイルス対策で削除する・再インストールすると、原因を調べる手がかりが消えてしまいます。法的な対応が必要になる場合は、専門の業者に保全を頼むこともあります。', '社内で起きたら'),
          Q('感染が疑われる PC で、最初にやってはいけないことは？', ['ネットワークから切り離す（ケーブルを抜く・Wi-Fi を切る）', '状況を写真とメモで記録する', 'すぐに OS を再インストールする', '窓口に連絡する'], 2, '再インストールすると、何が起きたかを調べる証拠がすべて消えます。まずは記録し、ネットワークから切り離して広がりを止め、窓口に連絡します（電源を切るかどうかは、メモリを取るかの判断と合わせて決めます）。'),
        ],
      },
      {
        id: 'preserve', title: '証拠の保全とディスクイメージ',
        blocks: [
          FIG('preserve', '元の証拠には触らず、複製とハッシュで「変わっていないこと」を示す'),
          DEFS([
            ['ディスクイメージ', 'ディスクを 1 バイト残らず丸ごとコピーしたファイル。削除したファイルの跡や空き領域も含まれる。形式は raw（dd）や E01（圧縮・メタデータ付き）'],
            ['書き込み防止装置（ライトブロッカー）', 'つないだディスクに一切書き込ませない装置。OS が自動で書き込むのを防ぐ'],
            ['ハッシュ値', '取得した直後に SHA-256 などを記録しておけば、後で「変わっていない」ことを示せる'],
          ]),
          CODE('Linux でのイメージの取得と確認', "lsblk                                  # 対象のディスクを確かめる（取り違えに注意）\nsudo dd if=/dev/sdb of=evidence.dd bs=4M conv=noerror,sync status=progress\nsha256sum /dev/sdb evidence.dd          # 元と複製のハッシュが一致するか\n# 調べるときは読み取り専用で\nsudo mount -o ro,loop,noexec evidence.dd /mnt/evidence"),
          TIP('Windows では、無料の FTK Imager でディスクのイメージ（E01）やメモリの取得ができます。取得の画面でハッシュの確認まで自動で行ってくれます。', 'Windows では'),
          CODE('パーティションの位置を調べてマウントする（The Sleuth Kit）', "mmls evidence.dd                       # パーティションの開始位置（セクター）\nsudo mount -o ro,loop,noexec,offset=$((2048*512)) evidence.dd /mnt/evidence\nfls -r -o 2048 evidence.dd | head      # 削除されたファイル（* 付き）も一覧に出る"),
          WARN('dd の if= と of= を逆にすると、証拠のディスクを上書きして壊します。実行前に必ず確認しましょう。', 'dd の注意'),
          Q('ディスクのイメージを取った直後にハッシュ値を記録する理由は？', ['イメージを小さくするため', '後で証拠が変わっていないことを示すため', '暗号化するため', 'パスワードを調べるため'], 1, '取得直後のハッシュ値と、後で計算したハッシュ値が一致すれば、誰も中身を変えていないことを示せます。'),
        ],
      },
      {
        id: 'timeline', title: '時系列を組み立てる',
        blocks: [
          P('調査の中心は「時系列（タイムライン）」です。ファイルの時刻・ログ・通信の記録を 1 本の時間軸に並べると、侵入から持ち出しまでの流れが見えてきます。'),
          FIG('timeline', 'ファイルには作成・更新・アクセス・メタデータ変更の時刻がある'),
          LIST('時系列づくりのコツ', [
            'すべての時刻を UTC か日本時間のどちらかにそろえる（混ぜると 9 時間ずれて見える）',
            '機器の時計が正しかったか（NTP で合っていたか）を確認する',
            '「最初の不審な出来事」を見つけたら、その前後を細かく見る',
            '複数の記録（ファイルの時刻・イベントログ・プロキシのログ・メール）で同じ出来事を裏付ける',
          ]),
          CODE('時刻の確認・変換', "stat file.txt                          # Linux：アクセス・更新・変更・作成（Birth）\ndate -d @1775634512                    # UNIX 時間を日時に\nTZ=Asia/Tokyo date -d '2026-04-08 06:28:32 UTC'"),
          LINK('ポータルのネットワーク・時刻計算を開く', '#net', 'UNIX 時間と日時（UTC・日本時間）を相互に変換できます。'),
          TIP('Plaso（log2timeline）などの道具を使うと、イメージの中の多数の記録を自動で 1 本の時系列にまとめられます。量が多い調査では欠かせません。', '自動でまとめる'),
          Q('ログ A は UTC、ログ B は日本時間で記録されていた。そのまま並べると何が起きる？', ['問題ない', '同じ出来事が 9 時間ずれて見え、順番を取り違える', 'ログが消える', '日付が 1 日ずれるだけ'], 1, '日本時間は UTC より 9 時間進んでいます。どちらかにそろえてから並べないと、因果関係を誤って判断してしまいます。'),
        ],
      },
      {
        id: 'files', title: 'ファイルを調べる',
        blocks: [
          TABLE(['調べること', '方法', '分かること'], [
            ['本当の種類', 'file コマンド・先頭のバイト（マジックナンバー）', '拡張子を偽ったファイル（.jpg の実行ファイルなど）'],
            ['メタデータ', 'exiftool・Office のプロパティ', '作成者・作成日時・ソフト・位置情報'],
            ['埋め込み・連結', 'binwalk・末尾のデータの確認', 'ファイルの後ろに付いた別のファイル'],
            ['削除されたファイル', 'fls / icat（The Sleuth Kit）・ごみ箱', 'ファイルの名前と中身の残り'],
            ['断片からの復元（カービング）', 'foremost・PhotoRec', 'ファイルシステムの情報が無くても、ヘッダーとフッターから取り出す'],
            ['文字列', 'strings', 'URL・パス・パスワードの手がかり'],
            ['代替データストリーム（NTFS）', 'dir /r・Get-Item -Stream *', 'ファイルに隠したデータ。Zone.Identifier にはダウンロード元の URL が残る'],
          ]),
          CODE('よく使うコマンド', "file suspicious.jpg\nxxd suspicious.jpg | head -3\nexiftool report.docx\nbinwalk image.png\nstrings -n 8 sample.bin | less\nsha256sum sample.bin                    # 既知のマルウェアの情報と照合するときに"),
          CODE('Windows：ダウンロード元を調べる（PowerShell）', "Get-Item .\\setup.exe -Stream *\nGet-Content .\\setup.exe -Stream Zone.Identifier     # ReferrerUrl / HostUrl"),
          LINK('ポータルのファイル解析を開く', '#file', '種類の判定・末尾のデータ・埋め込まれたファイル・メタデータを、ブラウザの中だけで調べられます。'),
          Q('拡張子が .pdf なのに、先頭のバイトが「4D 5A」（MZ）だった。正体は？', ['PDF', 'Windows の実行ファイル', 'ZIP', 'PNG 画像'], 1, '「MZ」は Windows の実行ファイル（EXE・DLL）の先頭です。拡張子を偽ってメールで送り付ける手口の典型です。'),
        ],
      },
      {
        id: 'memory', title: 'メモリを調べる',
        blocks: [
          P('メモリには、ディスクには残らない情報があります。実行中のプロセス、通信中の相手、入力されたコマンド、ディスクに書かれずにメモリだけで動くマルウェアなどです。メモリは電源を切ると消えるので、必要なら最初に取得します。'),
          TABLE(['取得の道具', '対象'], [
            ['FTK Imager・Magnet RAM Capture・WinPmem', 'Windows'],
            ['AVML・LiME', 'Linux'],
            ['仮想マシンのスナップショット', 'VMware の .vmem・Hyper-V など（止めずに取れる）'],
          ]),
          P('取得したメモリのイメージは、Volatility（無料）で解析します。今は Volatility 3 が主流で、「プラグイン」を指定して知りたい情報を取り出します。'),
          CODE('Volatility 3 の主なプラグイン（Windows のメモリ）', "vol -f memory.raw windows.info          # OS の情報\nvol -f memory.raw windows.pslist        # プロセスの一覧\nvol -f memory.raw windows.pstree        # 親子関係（不審な親に注意）\nvol -f memory.raw windows.cmdline       # 起動したときのコマンドライン\nvol -f memory.raw windows.netscan       # 通信の相手\nvol -f memory.raw windows.malfind       # 怪しいコードが入ったメモリ領域\nvol -f memory.raw windows.filescan      # メモリ上のファイルの一覧"),
          LIST('見るべき不審な点', [
            '名前が正規のものに似ている（svch0st.exe・lsass が 2 つある など）',
            '親子関係がおかしい（Word から PowerShell が起動している など）',
            '一時フォルダ・ダウンロードフォルダから動いているプロセス',
            'Base64 で長い引数を渡した PowerShell（-enc / -EncodedCommand）',
            '見慣れない外部の IP への通信',
          ]),
          Q('メモリを取得する場合、電源を切る前と後のどちらに行うべき？', ['電源を切った後', '電源を切る前', 'どちらでもよい', '再起動してから'], 1, 'メモリの中身は電源を切ると消えます。取得するなら電源を入れたまま、ほかの操作より先に行います。'),
        ],
      },
      {
        id: 'ir', title: 'インシデント対応の流れ',
        blocks: [
          FIG('ir', '準備から教訓まで、くり返し改善していく'),
          TABLE(['段階', 'やること'], [
            ['準備', '連絡先・役割・手順書、ログの取得と保存、調査の道具、訓練'],
            ['検知・分析', '本当にインシデントか、範囲（台数・アカウント・データ）、深刻さの判断'],
            ['封じ込め', '感染した機器の隔離、不正なアカウントの停止、通信先の遮断（証拠は保全しながら）'],
            ['根絶', 'マルウェア・持続化の仕掛けの除去、侵入の原因（脆弱性・パスワード）の解消'],
            ['復旧', 'バックアップからの戻し・監視を強めて再開'],
            ['教訓', '振り返り、手順と対策の見直し、報告（必要なら個人情報保護委員会などへ）'],
          ]),
          LIST('初動で記録しておくこと', [
            '気づいた日時・きっかけ（誰が・何を見たか）',
            '画面の表示（写真）・不審なメール・ファイルの名前',
            '誰が・いつ・何の操作をしたか（調査のための操作も含めて）',
          ]),
          LINK('「フォレンジック：ログと痕跡の調べ方」を開く', '#learn/dfir-logs', 'Windows・Linux のどこに何の記録が残るかを、具体的に学べます。'),
          Q('ランサムウェアの感染が分かった直後の「封じ込め」として適切なのは？', ['すぐに身代金を払う', '感染した機器をネットワークから切り離し、広がりを止める', 'すべての PC の電源を切って放置する', 'ウイルス対策ソフトをアンインストールする'], 1, 'まずネットワークから隔離して、ほかの機器やファイルサーバーへの広がりを止めます。証拠の保全と、窓口・関係者への連絡を並行して行います。'),
        ],
      },
    ],
  },

  // ============================================================
  {
    id: 'dfir-logs',
    subject: 'フォレンジック',
    name: 'ログと痕跡の調べ方（Windows・Linux）',
    tagline: 'どこに何の記録が残るか。Windows のイベントログと主な痕跡、Linux のログと履歴、持続化の点検、そして CTF の FORENSIC 問題の進め方まで。',
    genres: ['FORENSIC', 'DEFENSE'],
    level: '初級〜中級',
    prep: '約 70 分（「基礎」を読んだ後に）',
    prepLabel: '読む時間',
    icon: 'logs',
    chapters: [
      {
        id: 'winlog', title: 'Windows のイベントログ',
        blocks: [
          P('Windows は、ログオン・プロセスの起動・設定の変更などを「イベントログ」に記録します。イベントの種類は番号（イベント ID）で表され、調査では決まった番号を探すのが基本です。'),
          FIG('logon', 'ログオンから、その後の操作・痕跡を消す動きまで'),
          W('eventid'),
          TABLE(['ログの種類', '場所（C:\\Windows\\System32\\winevt\\Logs\\）', '主な内容'], [
            ['セキュリティ', 'Security.evtx', 'ログオン・権限・アカウントの変更・監査'],
            ['システム', 'System.evtx', 'サービス・ドライバー・起動と停止'],
            ['PowerShell', 'Microsoft-Windows-PowerShell%4Operational.evtx', '実行されたスクリプト（4104）'],
            ['Sysmon（入れていれば）', 'Microsoft-Windows-Sysmon%4Operational.evtx', 'プロセス・通信・ファイル・レジストリの詳細'],
          ]),
          CODE('PowerShell で調べる', "# ログオンの失敗を新しい順に 50 件\nGet-WinEvent -FilterHashtable @{LogName='Security'; Id=4625} -MaxEvents 50 |\n  Select-Object TimeCreated, @{n='User';e={$_.Properties[5].Value}}, @{n='IP';e={$_.Properties[19].Value}}\n# 期間を指定して、ユーザーの作成とグループへの追加\nGet-WinEvent -FilterHashtable @{LogName='Security'; Id=4720,4732; StartTime='2026-04-01'; EndTime='2026-04-08'}\n# 取り出した .evtx ファイルを読む\nGet-WinEvent -Path .\\Security.evtx -FilterXPath '*[System[EventID=1102]]'"),
          WARN('多くのイベント（4688 のコマンドライン・PowerShell の 4104 など）は、初期設定では記録されません。事件が起きる前に、監査ポリシーと記録の容量を設定しておくことが「準備」です（「サーバーの守り：Windows」で扱います）。', '記録されていないことも'),
          Q('Windows のセキュリティ ログで「ログオンの失敗」を表すイベント ID は？', ['4624', '4625', '4688', '1102'], 1, '4625 がログオンの失敗です。短時間に大量にあれば総当たりやパスワードの使い回し攻撃を疑います。4624 は成功、4688 はプロセスの作成、1102 はログの消去です。'),
        ],
      },
      {
        id: 'winart', title: 'Windows のそのほかの痕跡',
        blocks: [
          TABLE(['痕跡', '場所・道具', '分かること'], [
            ['Prefetch', 'C:\\Windows\\Prefetch\\*.pf', 'プログラムを実行した回数・最後の実行日時'],
            ['Amcache', 'C:\\Windows\\AppCompat\\Programs\\Amcache.hve', '実行・インストールされたプログラムとハッシュ'],
            ['Run キー', 'HKCU / HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', 'ログオン時に自動で動くプログラム（持続化）'],
            ['タスク スケジューラ', 'C:\\Windows\\System32\\Tasks\\', '定期的に動くプログラム（持続化）'],
            ['LNK・ジャンプリスト', '%APPDATA%\\Microsoft\\Windows\\Recent\\', '開いたファイル（消されたファイル・USB の中のファイルも）'],
            ['ブラウザの履歴', '各ブラウザのプロファイル（SQLite）', '見たサイト・ダウンロード'],
            ['ごみ箱', 'C:\\$Recycle.Bin\\', '削除したファイルと削除の日時'],
            ['USB の接続', 'レジストリの USBSTOR・setupapi.dev.log', 'いつ・どの USB 機器がつながれたか'],
            ['$MFT・$UsnJrnl', 'NTFS のメタデータ', 'ファイルの作成・変更・削除の記録'],
          ]),
          TIP('こうした痕跡をまとめて取り出して読むには、Eric Zimmerman 氏の無料ツール群（PECmd・AmcacheParser・MFTECmd・Registry Explorer など）や、KAPE がよく使われます。', '道具'),
          Q('「どの USB メモリが、いつ PC につながれたか」を調べたい。見る場所として適切なのは？', ['Prefetch', 'レジストリの USBSTOR と setupapi.dev.log', 'ごみ箱', 'ブラウザの履歴'], 1, 'USB 機器の接続はレジストリ（USBSTOR など）とドライバーの導入記録（setupapi.dev.log）に残ります。情報の持ち出しの調査でよく見る場所です。'),
        ],
      },
      {
        id: 'linux', title: 'Linux のログと履歴',
        blocks: [
          TABLE(['記録', '場所・コマンド', '分かること'], [
            ['認証', '/var/log/auth.log（Debian・Ubuntu）・/var/log/secure（RHEL）', 'SSH のログイン・sudo の利用・失敗'],
            ['systemd のログ', 'journalctl', 'サービス・カーネル・認証（auth.log が無い環境でも）'],
            ['ログイン履歴', 'last（wtmp）・lastb（btmp、失敗）・lastlog', 'いつ・どこからログインしたか'],
            ['コマンド履歴', '~/.bash_history・/root/.bash_history', '実行したコマンド（消されたり、記録を止められたりしやすい）'],
            ['定期実行', 'crontab -l・/etc/cron*・systemctl list-timers', '持続化の仕掛け'],
            ['SSH の鍵', '~/.ssh/authorized_keys', '侵入者が自分の鍵を足していないか'],
            ['監査ログ（auditd）', '/var/log/audit/audit.log・ausearch', 'ファイルの変更・コマンドの実行（設定していれば）'],
            ['Web サーバー', '/var/log/nginx/・/var/log/apache2/', '攻撃のリクエスト・Web シェルへのアクセス'],
          ]),
          CODE('よく使う調べ方', "sudo grep -E 'Failed password|Accepted' /var/log/auth.log | tail -50\nsudo journalctl -u ssh --since '2026-04-07' --until '2026-04-08'\nlast -F -i | head -30\nsudo lastb -F -i | head -30\nsudo find / -xdev -newermt '2026-04-07 00:00' ! -newermt '2026-04-08 00:00' -type f 2>/dev/null | grep -vE '^/(proc|sys)'\nsudo ausearch -k identity --start today"),
          LINK('コマンド辞典（Linux）を開く', '#dict/linux', '「やりたいことで探す」のログ調査のセクションに、集計の書き方がまとまっています。'),
          LINK('ポータルのログ解析を開く', '#logs', 'auth.log やアクセスログを貼り付けて、失敗の多い IP などを集計できます。'),
          Q('Linux で「SSH のログインに失敗した記録」を一覧で見るコマンドは？', ['last', 'lastb', 'who', 'uptime'], 1, 'lastb は btmp（ログインの失敗）を表示します（root の権限が必要）。last は成功したログインの履歴です。'),
        ],
      },
      {
        id: 'persist', title: '持続化の点検',
        blocks: [
          P('侵入者は、再起動しても戻ってこられるように仕掛け（持続化）を残します。調査ではこれらの場所を必ず確認し、普段の状態（ほかの同じ構成の機器・バックアップ）と比べます。'),
          FIG('persist', 'Windows と Linux の、持続化によく使われる場所'),
          CODE('Windows（PowerShell）', "Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'\nGet-ScheduledTask | Where-Object State -ne 'Disabled' | Select-Object TaskPath, TaskName\nGet-CimInstance Win32_Service | Where-Object { $_.PathName -match 'Temp|AppData|ProgramData' } | Select-Object Name, PathName\nGet-LocalUser | Select-Object Name, Enabled, LastLogon\nGet-LocalGroupMember Administrators"),
          CODE('Linux', "sudo ls -la /etc/cron.* /var/spool/cron/crontabs 2>/dev/null\nsystemctl list-timers --all\nsystemctl list-unit-files --type=service --state=enabled\nsudo find /etc/systemd /lib/systemd -name '*.service' -newermt '2026-04-01'\nawk -F: '$3 >= 1000 || $3 == 0 {print $1, $3, $7}' /etc/passwd\nsudo cat /root/.ssh/authorized_keys; ls -la /home/*/.ssh/\nsudo cat /etc/sudoers /etc/sudoers.d/* 2>/dev/null"),
          TIP('Windows では Sysinternals の Autoruns を使うと、自動で動くもののほぼすべてを 1 つの画面で確認でき、署名のないものだけを表示することもできます。', 'Autoruns'),
          Q('Linux サーバーで、root の authorized_keys に見覚えのない公開鍵があった。意味は？', ['問題ない', 'その鍵を持つ人が root としてパスワードなしでログインできる状態（持続化の可能性）', 'ディスクが壊れている', 'SSH が止まっている'], 1, '侵入者がよく使う持続化の手口です。鍵を削除するだけでなく、いつ追加されたか・その鍵でのログインの記録・侵入の経路を調べます。'),
        ],
      },
      {
        id: 'ctf', title: 'CTF の FORENSIC 問題の進め方',
        blocks: [
          TABLE(['配られるもの', '最初にやること', 'ポータル・道具'], [
            ['正体の分からないファイル', 'file・先頭のバイト・strings・binwalk', 'ファイル解析・迷ったら診断'],
            ['画像', 'メタデータ・末尾のデータ・ビットプレーン（LSB）', '画像解析・位置特定'],
            ['音声', 'スペクトログラム・モールス・SSTV', '音声解析'],
            ['pcap', 'プロトコルの一覧・HTTP のファイル・DNS', 'パケット解析・Wireshark'],
            ['ディスクイメージ', 'mmls → マウント（読み取り専用）→ 削除ファイル（fls）', 'The Sleuth Kit・Autopsy'],
            ['メモリダンプ', 'windows.info → pslist / pstree → cmdline → filescan', 'Volatility 3'],
            ['ログ', '時刻をそろえて、失敗・成功・不審なコマンドを並べる', 'ログ解析・コマンド辞典'],
            ['Office・PDF', 'マクロ・埋め込みファイル・メタデータ', 'oletools（olevba）・pdfid'],
          ]),
          STEPS([
            ['問題文を読む', '「誰が」「いつ」「何を持ち出した」など、問われている形（フラグの形式）を確認する。'],
            ['全体を見る', 'いきなり細部に入らず、ファイルの種類・大きさ・中身の一覧を確認する。'],
            ['時系列を作る', '気になる出来事を時刻つきでメモし、前後を詳しく見る。'],
            ['取り出して調べる', '見つけたファイルやデータは取り出して、別の道具で正体を調べる（多重のエンコード・圧縮が多い）。'],
          ]),
          LINK('ポータルの問題メモを開く', '#notes', '見つけた手がかりと時刻をメモしながら進めましょう。'),
        ],
      },
    ],
  },

  // ============================================================
  {
    id: 'harden-linux',
    subject: 'サーバーの守り',
    name: 'Linux サーバーの守り',
    tagline: 'Linux サーバーの設定を点検して強くする。アカウントと sudo、SSH、ファイルの権限、サービスとポート、ファイアウォール、更新、ログと監査まで。CONFIG・DEFENSE の問題と日々の運用に。',
    genres: ['CONFIG', 'DEFENSE'],
    level: '初級〜中級',
    prep: '約 70 分',
    prepLabel: '読む時間',
    icon: 'server',
    chapters: [
      {
        id: 'about', title: '守りの考え方と点検の進め方',
        blocks: [
          FIG('harden', '入口を減らし、入りにくくし、入っても広がらず、気づけるようにする'),
          STEPS([
            ['今の状態を知る', '動いているサービス・開いているポート・ユーザー・権限を一覧にする。'],
            ['基準と比べる', 'CIS Benchmarks などの基準や、社内の設定基準と比べて、違う所を洗い出す。'],
            ['影響を確かめて直す', '検証環境で試してから本番へ。変更は記録し、元に戻す手順も用意する。'],
            ['続ける', '更新・ログの確認・定期的な点検を仕組みにする。'],
          ]),
          WARN('SSH やファイアウォールの設定を変えるときは、今のセッションを切らずに、別の端末から新しく接続できることを確かめてから閉じましょう。設定を誤ると自分が締め出されます（クラウドならコンソール接続を用意しておく）。', '締め出しに注意'),
          TIP('CTF の CONFIG・DEFENSE の問題は、「わざと危ない設定にしたサーバー」を点検して直す形式が多いです。この本の各章の点検コマンドが、そのまま問題の手がかりになります。', 'CTF では'),
        ],
      },
      {
        id: 'accounts', title: 'アカウントと sudo',
        blocks: [
          CODE('点検', "awk -F: '$3 == 0 {print \"UID 0:\", $1}' /etc/passwd          # root と同じ権限のアカウント（root だけのはず）\nawk -F: '$7 !~ /(nologin|false)$/ {print $1, $7}' /etc/passwd   # ログインできるアカウント\nsudo awk -F: '$2 == \"\" {print \"空のパスワード:\", $1}' /etc/shadow\ngetent group sudo wheel                                        # 管理者のグループ\nsudo cat /etc/sudoers.d/* 2>/dev/null; sudo grep -v '^#' /etc/sudoers | grep -v '^$'\nlastlog | grep -v 'Never'                                      # 最後にログインした日時"),
          TABLE(['点検の観点', '直し方'], [
            ['UID 0 のアカウントが root 以外にある', '不正な追加を疑う。削除し、経緯を調べる'],
            ['使っていない・退職者のアカウント', 'sudo usermod -L 名前（ロック）→ 確認の後 userdel'],
            ['共有のアカウント（みんなで同じ ID）', '個人ごとのアカウントにして、誰が操作したか分かるようにする'],
            ['sudo の NOPASSWD・ALL の付けすぎ', '必要なコマンドだけに絞る（sudo -l で確認）'],
            ['sudo で vi・less・find などを許可', 'これらはシェルを起動できるので、実質 root を渡すのと同じ'],
          ]),
          CODE('sudo を必要なものだけ許可する（visudo で編集）', "# /etc/sudoers.d/webops\n%webops ALL=(root) /usr/bin/systemctl restart nginx, /usr/bin/systemctl reload nginx"),
          Q('sudoers に「deploy ALL=(ALL) NOPASSWD: /usr/bin/vi」とあった。問題は？', ['問題ない', 'vi の中からシェルを起動でき、実質的に root の権限をパスワードなしで渡している', 'vi が使えなくなる', 'deploy がログインできなくなる'], 1, 'vi・less・find・awk など、ほかのコマンドを実行できるプログラムを sudo で許可すると、そこから root のシェルを起動できます。許可するのは必要な操作だけにします。'),
        ],
      },
      {
        id: 'ssh', title: 'SSH の守り',
        blocks: [
          W('sshdcheck'),
          CODE('おすすめの設定（/etc/ssh/sshd_config.d/10-hardening.conf）', "PermitRootLogin no\nPasswordAuthentication no\nKbdInteractiveAuthentication no\nPubkeyAuthentication yes\nPermitEmptyPasswords no\nMaxAuthTries 3\nX11Forwarding no\nAllowGroups sshusers\nClientAliveInterval 300\nClientAliveCountMax 2"),
          CODE('反映と確認', "sudo sshd -t                  # 設定の文法を確認（何も出なければ OK）\nsudo sshd -T | grep -Ei 'permitrootlogin|passwordauthentication|allowgroups'   # 実際に効いている値\nsudo systemctl reload ssh     # RHEL 系は sshd"),
          WARN('sshd_config は、多くの項目で「最初に書かれた値」が使われます。sshd_config.d/ のファイルは本体の先頭（Include の位置）で読み込まれるので、本体の後ろに書いても上書きされないことがあります。必ず sshd -T で実際の値を確かめましょう。', '書く場所に注意'),
          DEFS([
            ['鍵認証', 'ssh-keygen -t ed25519 で鍵を作り、公開鍵をサーバーの ~/.ssh/authorized_keys に登録する。秘密鍵にはパスフレーズを'],
            ['fail2ban', 'ログを見て、失敗が続いた IP を一定時間ファイアウォールで遮断する'],
            ['接続元の制限', 'ファイアウォールで、社内・VPN・踏み台からだけ 22 番を許可する（いちばん効く）'],
          ]),
          Q('PasswordAuthentication を no にする前に、必ず確かめることは？', ['ポートを変える', '自分の鍵でログインできることを、別の端末から確かめる', 'root のパスワードを変える', 'サーバーを再起動する'], 1, '鍵での接続を確かめないままパスワード認証を止めると、誰もログインできなくなります。今の接続を残したまま、別の接続で確認します。'),
        ],
      },
      {
        id: 'files', title: 'ファイルの権限',
        blocks: [
          CODE('危ない権限を探す', "sudo find / -xdev -perm -4000 -type f 2>/dev/null          # SUID（実行すると持ち主の権限で動く）\nsudo find / -xdev -perm -0002 -type f 2>/dev/null          # 誰でも書き込める\nsudo find / -xdev \\( -nouser -o -nogroup \\) 2>/dev/null       # 持ち主のいないファイル\nls -l /etc/passwd /etc/shadow /etc/sudoers                    # 644 / 640 か 600 / 440 が目安"),
          TABLE(['ファイル', '目安の権限'], [
            ['/etc/shadow', '640（root:shadow）または 600'],
            ['/etc/sudoers', '440'],
            ['~/.ssh/', '700'],
            ['~/.ssh/authorized_keys・秘密鍵', '600'],
            ['Web の公開フォルダ', '所有者以外は書き込み不可。アップロード先では実行させない'],
          ]),
          TIP('SUID のファイルは、OS に最初から入っている一覧（passwd・sudo・mount など）と比べ、見覚えのないもの（コピーされた bash・find など）がないか確認します。', 'SUID の点検'),
          Q('/tmp/.x/bash に SUID が付いていて、持ち主が root だった。意味は？', ['普通のこと', 'だれが実行しても root の権限のシェルが手に入る裏口の可能性が高い', 'ディスクの故障', '一時ファイルなので問題ない'], 1, 'root 所有の bash に SUID を付けるのは、侵入者が権限を取り戻すための典型的な裏口です。削除し、侵入の経緯を調べます。'),
        ],
      },
      {
        id: 'services', title: 'サービス・ポート・ファイアウォール',
        blocks: [
          CODE('今の状態を知る', "sudo ss -tulpn                                          # 待ち受けているポートとプログラム\nsystemctl list-unit-files --type=service --state=enabled\nsystemctl --failed"),
          CODE('使わないサービスを止める', "sudo systemctl disable --now cups avahi-daemon         # 例：印刷・機器の自動検出\nsudo apt purge telnetd rsh-server                       # 古い平文のサービスは削除"),
          CODE('ファイアウォール（ufw の例）', "sudo ufw default deny incoming\nsudo ufw default allow outgoing\nsudo ufw allow from 10.0.30.0/24 to any port 22 proto tcp   # 管理用のネットワークからだけ\nsudo ufw allow 443/tcp\nsudo ufw enable && sudo ufw status numbered"),
          LIST('見直しの観点', [
            '外から使う必要のないもの（DB・管理画面・Redis など）が 0.0.0.0 で待ち受けていないか → 127.0.0.1 に限る',
            '初期のパスワードのままのサービスがないか',
            '外向きの通信も、必要な先だけに絞れないか（侵入後の外部との連絡を防ぐ）',
          ]),
          LINK('「業務のネットワーク」のファイアウォールの章を開く', '#learn/net-biz', 'ルールの書き方（上から順・最後は拒否）と DMZ の考え方を確認できます。'),
          Q('ss -tulpn で、MySQL（3306）が 0.0.0.0:3306 で待ち受けていた。同じサーバーの Web アプリからしか使わない場合の対処は？', ['そのままでよい', 'bind-address を 127.0.0.1 にして、外から接続できないようにする', 'ポート番号を変える', 'MySQL を再起動する'], 1, '0.0.0.0 はすべてのネットワークから受け付けます。同じサーバーからしか使わないなら 127.0.0.1 に限り、ファイアウォールでも閉じます。'),
        ],
      },
      {
        id: 'update-log', title: '更新とログ・監査',
        blocks: [
          CODE('セキュリティ更新を自動にする', "# Ubuntu / Debian\nsudo apt install unattended-upgrades && sudo dpkg-reconfigure -plow unattended-upgrades\n# RHEL / Rocky\nsudo dnf install dnf-automatic && sudo systemctl enable --now dnf-automatic-install.timer\n# 再起動が必要か\n[ -f /var/run/reboot-required ] && cat /var/run/reboot-required"),
          CODE('ログを残す・外へ送る', "# journald を再起動後も残す\nsudo mkdir -p /var/log/journal && sudo systemctl restart systemd-journald\n# rsyslog でログサーバーへ送る（/etc/rsyslog.d/90-remote.conf）\n*.* @@logserver.example.local:514"),
          CODE('auditd で大事なファイルとコマンドを記録する（/etc/audit/rules.d/hardening.rules）', "-w /etc/passwd -p wa -k identity\n-w /etc/shadow -p wa -k identity\n-w /etc/sudoers -p wa -k sudoers\n-w /etc/ssh/sshd_config -p wa -k sshd\n-a always,exit -F arch=b64 -S execve -F euid=0 -k root_exec"),
          CODE('記録を確かめる', "sudo augenrules --load\nsudo ausearch -k identity -i | tail\nsudo aureport --summary"),
          TIP('ログは、侵入者に消されないよう、別のサーバー（ログサーバー・SIEM）にも送っておくのが基本です。すべての機器の時刻を NTP でそろえることも忘れずに。', 'ログの基本'),
          Q('ログをサーバーの中だけでなく、別のログサーバーにも送る理由は？', ['ディスクの節約', '侵入者がサーバーの中のログを消しても、記録を残すため', '速くするため', '暗号化するため'], 1, '侵入者は痕跡を消すためにログを削除・改ざんします。別の場所にも送っておけば、調査に必要な記録が残ります。'),
        ],
      },
    ],
  },

  // ============================================================
  {
    id: 'harden-windows',
    subject: 'サーバーの守り',
    name: 'Windows の守り',
    tagline: 'Windows の PC・サーバーの設定を点検して強くする。アカウントと管理者の権限、更新、Defender とファイアウォール、古い機能の停止、ログ（監査・PowerShell・Sysmon）、点検のコマンドまで。',
    genres: ['CONFIG', 'DEFENSE'],
    level: '初級〜中級',
    prep: '約 60 分',
    prepLabel: '読む時間',
    icon: 'shield',
    chapters: [
      {
        id: 'accounts', title: 'アカウントと管理者の権限',
        blocks: [
          CODE('点検（PowerShell を管理者で）', "Get-LocalUser | Select-Object Name, Enabled, LastLogon, PasswordRequired, PasswordNeverExpires\nGet-LocalGroupMember Administrators\nnet accounts                       # パスワードとロックアウトの方針"),
          TABLE(['観点', '直し方'], [
            ['普段から管理者の権限で作業している', '普段は一般のアカウント、管理作業のときだけ管理者に（UAC を無効にしない）'],
            ['全 PC のローカル管理者のパスワードが同じ', 'Windows LAPS で PC ごとに別のパスワードを自動で設定・定期変更'],
            ['Guest・使っていないアカウントが有効', '無効にする'],
            ['ロックアウトの設定がない', '失敗が続いたら一定時間ロック（総当たり対策）'],
            ['ドメインの管理者で普通の PC にログオン', '管理用の端末を分ける（資格情報を盗まれる範囲を広げない）'],
          ]),
          WARN('全 PC で同じローカル管理者のパスワードを使っていると、1 台から取り出された資格情報で、ほかのすべての PC に入れてしまいます（横展開）。LAPS は、この対策として最も効果の大きい設定の 1 つです。'),
          Q('全社の PC のローカル管理者のパスワードが同じ。いちばんの問題は？', ['覚えやすい', '1 台が侵害されると、同じパスワードでほかの PC にも次々と入られる', 'PC が遅くなる', '更新できなくなる'], 1, '1 台から取られた資格情報が全台で使えるため、被害が一気に広がります。Windows LAPS で PC ごとにパスワードを変えます。'),
        ],
      },
      {
        id: 'protect', title: '更新・Defender・ファイアウォール',
        blocks: [
          CODE('状態を確かめる', "Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 5   # 最近の更新\nGet-MpComputerStatus | Select-Object AMServiceEnabled, RealTimeProtectionEnabled, AntivirusSignatureLastUpdated, IsTamperProtected\nGet-MpPreference | Select-Object ExclusionPath, ExclusionProcess              # 除外の設定（不審な除外に注意）\nGet-NetFirewallProfile | Select-Object Name, Enabled, DefaultInboundAction"),
          LIST('点検の観点', [
            '更新が止まっていないか（最後の更新が何か月も前でないか）',
            'リアルタイム保護が有効か・改ざん防止（Tamper Protection）が有効か',
            'Defender の除外に、不自然なフォルダ（C:\\ や一時フォルダ）が入っていないか──攻撃者がよく追加する',
            'ファイアウォールがすべてのプロファイル（ドメイン・プライベート・パブリック）で有効か',
          ]),
          CODE('更新と定義ファイルの更新', "Update-MpSignature\nStart-MpScan -ScanType QuickScan"),
          Q('Defender の除外の設定に「C:\\Users\\Public\\」が入っていた。考えられることは？', ['正常な設定', '攻撃者がマルウェアを置く場所を検査から外した可能性', 'ディスクの故障', '更新のための設定'], 1, '攻撃者は検知を逃れるために除外を追加することがあります。誰がいつ設定したかを調べ、不要なら削除します。'),
        ],
      },
      {
        id: 'legacy', title: '古い機能・危ない設定を止める',
        blocks: [
          TABLE(['対象', '理由', '確認・停止'], [
            ['SMBv1', 'WannaCry などに悪用された古い共有の仕組み', 'Get-SmbServerConfiguration | Select EnableSMB1Protocol／Disable-WindowsOptionalFeature -Online -FeatureName SMB1Protocol'],
            ['RDP の公開', 'インターネットに直接出すと総当たり・脆弱性の的', 'VPN の内側だけ・ネットワークレベル認証（NLA）を有効に'],
            ['LLMNR・NetBIOS 名前解決', '偽の応答で資格情報を盗まれる', 'グループポリシーで LLMNR を無効に'],
            ['マクロ', 'メールの添付ファイルからの感染の入口', 'インターネットから来たファイルのマクロをブロック（初期設定の確認）'],
            ['PowerShell 2.0', 'ログを残さずに実行される', 'Disable-WindowsOptionalFeature -Online -FeatureName MicrosoftWindowsPowerShellV2Root'],
          ]),
          TIP('多数の PC には、1 台ずつではなくグループポリシー（Active Directory）や Intune で一括して設定します。設定の基準として、Microsoft のセキュリティ ベースラインや CIS Benchmarks が使えます。', 'まとめて設定する'),
          Q('Windows で無効にすべき古いファイル共有の仕組みは？', ['SMBv3', 'SMBv1', 'HTTPS', 'Kerberos'], 1, 'SMBv1 は古く、ワーム型のマルウェアに悪用された脆弱性があります。今の Windows では使う必要はほとんどありません。'),
        ],
      },
      {
        id: 'logging', title: 'ログを取れるようにする',
        blocks: [
          P('「フォレンジック：ログと痕跡の調べ方」で見たイベントの多くは、初期設定では記録されません。事件が起きる前に記録を有効にし、容量を増やし、外へ集めておくことが大切です。'),
          CODE('監査ポリシーを確認・設定する（管理者の PowerShell / コマンドプロンプト）', "auditpol /get /category:*\nauditpol /set /subcategory:\"Process Creation\" /success:enable\nauditpol /set /subcategory:\"Logon\" /success:enable /failure:enable\nauditpol /set /subcategory:\"User Account Management\" /success:enable /failure:enable\n# セキュリティ ログの最大サイズを 1GB に\nwevtutil sl Security /ms:1073741824"),
          TABLE(['設定（グループポリシー）', '効果'], [
            ['プロセス作成イベントにコマンドラインを含める', '4688 にコマンドラインが残る'],
            ['PowerShell スクリプト ブロックのログ記録を有効にする', '4104 に実行された PowerShell の中身が残る'],
            ['Sysmon を導入する', 'プロセス・通信・ファイル・レジストリの詳しい記録（設定ファイルで記録する内容を決める）'],
            ['ログの転送（WEF）・SIEM への送信', '侵入者に消されても記録が残る'],
          ]),
          LINK('「ログと痕跡の調べ方」の Windows の章を開く', '#learn/dfir-logs', 'イベント ID の早見表で、記録される内容を確認できます。'),
          Q('実行された PowerShell の中身を記録するために有効にする設定は？', ['ファイアウォール', 'PowerShell スクリプト ブロックのログ記録（イベント 4104）', 'BitLocker', 'リモートデスクトップ'], 1, 'スクリプト ブロックのログ記録を有効にすると、難読化されたコマンドも実行時の形で記録され、攻撃の調査に役立ちます。'),
        ],
      },
      {
        id: 'checklist', title: '点検のチェックリスト',
        blocks: [
          TABLE(['分類', '確認すること'], [
            ['アカウント', '不要なアカウント・管理者グループのメンバー・LAPS・ロックアウト'],
            ['更新', 'Windows Update・Office・ブラウザ・よく使うソフトの更新'],
            ['守りの仕組み', 'Defender のリアルタイム保護・改ざん防止・除外・ファイアウォール'],
            ['古い機能', 'SMBv1・PowerShell 2.0・LLMNR・RDP の公開'],
            ['ディスク', 'BitLocker（ノート PC は必須）・回復キーの保管'],
            ['ログ', '監査ポリシー・PowerShell のログ・Sysmon・ログの容量と転送'],
            ['持続化', 'Run キー・タスク・サービス・スタートアップ（Autoruns で一覧）'],
          ]),
          CODE('まとめて状態を出力する（点検の記録として）', "$out = \"$env:COMPUTERNAME-check-$(Get-Date -Format yyyyMMdd).txt\"\n& {\n  '== Users';  Get-LocalUser | Format-Table Name, Enabled, LastLogon\n  '== Admins'; Get-LocalGroupMember Administrators | Format-Table Name, PrincipalSource\n  '== Defender'; Get-MpComputerStatus | Format-List RealTimeProtectionEnabled, AntivirusSignatureLastUpdated\n  '== Firewall'; Get-NetFirewallProfile | Format-Table Name, Enabled\n  '== SMB1'; Get-SmbServerConfiguration | Format-List EnableSMB1Protocol\n  '== Audit'; auditpol /get /category:*\n} *> $out\nWrite-Output \"保存しました: $out\""),
          LINK('「フォレンジックの基礎」を開く', '#learn/dfir-basic', '守りを固めた後は、何か起きたときの初動と保全の手順も確認しておきましょう。'),
        ],
      },
    ],
  },
];
