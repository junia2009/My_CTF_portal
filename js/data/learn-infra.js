// 学ぶ：インフラ運用（Linux サーバー運用・コンテナ基盤・nginx）
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

export const INFRA_TEXTS = [
  // ============================================================
  {
    id: 'infra-linux',
    subject: 'インフラ運用',
    name: 'Linux サーバー運用の基礎',
    tagline: 'サーバーを動かし続けるための土台。起動の流れ・systemd でのサービス管理・プロセスとリソース・ディスクとファイルシステム・パッケージ・定期実行・ログと時刻まで。',
    genres: ['CONFIG', 'DEFENSE', 'NW'],
    level: '入門〜初級',
    prep: '約 80 分（章ごとに読める）',
    prepLabel: '読む時間',
    icon: 'server',
    chapters: [
      {
        id: 'boot', title: '起動の流れと systemd',
        blocks: [
          P('サーバーの電源を入れてからサービスが動き出すまでには、決まった流れがあります。最後に立ち上がる systemd が、以後の「どのサービスを・どの順で動かすか」をすべて管理します。運用の多くは、この systemd の操作です。'),
          FIG('boot', '電源 → UEFI → ブートローダ → カーネル → systemd → サービス群'),
          DEFS([
            ['systemd', '最初のプロセス（PID 1）。サービス・マウント・タイマーなどを「ユニット」として管理する'],
            ['ユニット', '管理の単位。拡張子で種類が分かる（.service サービス、.socket 待ち受け、.timer 定期実行、.mount マウント、.target まとまり）'],
            ['ターゲット', '複数のユニットのまとまり。multi-user.target が通常のサーバーの状態（昔のランレベル 3 に相当）'],
          ]),
          CODE('起動の調査', "systemd-analyze                 # 起動にかかった時間\nsystemd-analyze blame           # 時間のかかったサービス順\nsystemctl list-units --type=service   # 動いているサービス"),
          Q('Linux で最初に起動する（PID 1 の）プロセスは、今の主流では？', ['bash', 'systemd', 'cron', 'nginx'], 1, '現代の多くのディストリビューションでは systemd が PID 1 として起動し、以降のサービスを管理します。'),
        ],
      },
      {
        id: 'service', title: 'サービスの管理',
        blocks: [
          FIG('systemd', 'サービスの状態（inactive / active / failed）と、よく使う操作'),
          TABLE(['やりたいこと', 'コマンド'], [
            ['状態と直近のログを見る', 'systemctl status nginx'],
            ['起動・停止・再起動', 'systemctl start / stop / restart nginx'],
            ['設定だけ読み直す（無停止）', 'systemctl reload nginx'],
            ['自動起動を有効にする', 'systemctl enable nginx（--now で今も起動）'],
            ['自動起動を無効にする', 'systemctl disable nginx'],
            ['失敗したサービスを探す', 'systemctl list-units --failed'],
            ['ユニットファイルを書き換えた後', 'systemctl daemon-reload'],
          ]),
          DEFS([
            ['active と enabled は別', 'active は「今動いているか」、enabled は「次の起動時に自動で立ち上がるか」。start だけだと再起動で消える'],
            ['ユニットの置き場所', '配布元のものは /lib/systemd/system/、自分で変えるなら /etc/systemd/system/（こちらが優先）'],
            ['一部だけ上書き', 'systemctl edit nginx で、元を壊さずに設定を追加できる（ドロップイン）'],
          ]),
          WARN('設定を変えたら、まず検証（nginx なら nginx -t）してから reload します。いきなり restart して設定ミスがあると、サービスが上がらず止まります。', '変更の反映'),
          Q('nginx の設定ファイルだけを変えて、接続を切らずに反映したい。使うのは？', ['systemctl restart nginx', 'systemctl reload nginx', 'systemctl stop nginx', 'systemctl disable nginx'], 1, 'reload は設定の読み直しで、多くのサービスは接続を保ったまま反映します。restart はプロセスを入れ直すので一瞬切れます。'),
        ],
      },
      {
        id: 'process', title: 'プロセスとリソース',
        blocks: [
          CODE('今の状態を見る', "top            # または htop：CPU・メモリを使っているプロセス\nps aux --sort=-%mem | head     # メモリの多い順\nuptime         # 負荷（load average：1 / 5 / 15 分）\nfree -h        # メモリの空き\nvmstat 1 5     # CPU・メモリ・入出力を 1 秒ごとに"),
          DEFS([
            ['load average', '実行を待っているプロセスの数の平均。CPU のコア数（nproc）より大きいと混んでいる'],
            ['プロセスを止める', 'kill PID（穏やかに）／kill -9 PID（強制）。名前からは pkill 名前'],
            ['優先度', 'nice / renice で CPU の優先度、ionice でディスクの優先度を下げ、ほかの邪魔をしないようにする'],
            ['OOM Killer', 'メモリが尽きると、カーネルがプロセスを強制終了する。dmesg -T | grep -i oom で確認'],
          ]),
          TIP('「サーバーが重い」ときは、まず top と uptime で「CPU か・メモリか・ディスクの待ち（vmstat の wa）か」を切り分けます。原因の層が分かると対処が早くなります。', '重いときの切り分け'),
          Q('load average が、CPU のコア数よりずっと大きい状態が続いている。意味は？', ['CPU が余っている', '処理を待っているプロセスが多く、混み合っている', 'メモリが余っている', 'ディスクが壊れている'], 1, 'load average は実行待ちのプロセス数の目安です。コア数を大きく超えて続くなら、処理が追いついていません。'),
        ],
      },
      {
        id: 'storage', title: 'ディスクとファイルシステム',
        blocks: [
          FIG('storage', '物理ディスク → パーティション →（LVM）→ ファイルシステム → マウント'),
          CODE('確認と操作', "lsblk -f               # ディスク・パーティション・ファイルシステム・マウント先\ndf -h                  # ファイルシステムごとの空き\ndu -sh /var/* | sort -h   # /var の中で何が大きいか\nsudo mount /dev/sdb1 /mnt          # 一時的にマウント\n# 恒久的にするには /etc/fstab に書く（UUID で指定が安全）"),
          LIST('容量不足の調べ方', [
            'df -h で、どのファイルシステムが満杯か',
            'du -sh /path/* | sort -h で、大きいディレクトリをたどる',
            'ログの肥大が多い（/var/log）。logrotate で分割・圧縮・削除を設定する',
            '「消したのに空かない」→ lsof +L1（削除済みだがプロセスが開いたまま）。そのプロセスを再起動する',
            'inode 切れ（df -i）：小さいファイルが大量にあると、容量が残っていても作れない',
          ]),
          WARN('/etc/fstab を間違えると、次の起動で上がらなくなることがあります。編集したら sudo mount -a で今すぐ検証し、エラーが出ないことを確かめます。', 'fstab の注意'),
          LINK('コマンド辞典（Linux）の「システム」を開く', '#dict/linux', 'lsblk・mount・df など、ディスク周りのコマンドを引けます。'),
          Q('df -h では空きがあるのに、ファイルが作れず「No space left on device」になる。考えられる原因は？', ['CPU 不足', 'inode（ファイル数の管理領域）の枯渇', 'メモリ不足', 'ネットワーク障害'], 1, '容量が残っていても、小さいファイルが大量にあると inode を使い切ることがあります。df -i で確認します。'),
        ],
      },
      {
        id: 'package', title: 'パッケージとソフトの管理',
        blocks: [
          TABLE(['操作', 'Debian / Ubuntu（apt）', 'RHEL / Rocky（dnf）'], [
            ['更新情報の取得', 'apt update', '（自動）'],
            ['入れる', 'apt install nginx', 'dnf install nginx'],
            ['更新', 'apt upgrade', 'dnf upgrade'],
            ['消す', 'apt remove nginx', 'dnf remove nginx'],
            ['探す', 'apt search 語 / apt-cache policy nginx', 'dnf search 語 / dnf info nginx'],
            ['何に含まれるファイルか', 'dpkg -L nginx', 'rpm -ql nginx'],
            ['このファイルはどのパッケージか', 'dpkg -S /path', 'rpm -qf /path'],
          ]),
          LIST('運用のポイント', [
            'セキュリティ更新は自動にする（unattended-upgrades / dnf-automatic）',
            '更新の後に再起動が要るか確認（Ubuntu は /var/run/reboot-required、カーネル更新時など）',
            '外部のリポジトリやスクリプト実行（curl | sh）で入れるものは、提供元を確かめる',
            '言語ごとの管理（pip・npm）は、システムと混ぜず仮想環境・プロジェクト単位で',
          ]),
          LINK('「Linux サーバーの守り」の更新の章へ', '#learn/harden-linux', '自動更新とログの設定は、守りのテキストで詳しく扱っています。'),
          Q('あるファイルが、どのパッケージから入ったかを調べたい（Ubuntu）。使うのは？', ['dpkg -L', 'dpkg -S /path', 'apt update', 'ls -l'], 1, 'dpkg -S ファイルパス で、そのファイルを含むパッケージが分かります。dpkg -L は逆に、パッケージに含まれるファイルの一覧です。'),
        ],
      },
      {
        id: 'cron', title: '定期実行（cron と systemd タイマー）',
        blocks: [
          P('バックアップ・集計・掃除などを決まった時刻に動かすのが cron です。1 行に「分 時 日 月 曜日 コマンド」を書きます。'),
          W('cron'),
          CODE('cron の使い方', "crontab -e            # 自分の cron を編集\ncrontab -l            # 確認\n# 例：平日 8:30 にバックアップ、出力をログへ\n30 8 * * 1-5 /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1\n# システム全体は /etc/crontab や /etc/cron.d/、/etc/cron.daily/ など"),
          WARN('cron の実行環境は、ログイン時とは違って PATH などが最小限です。コマンドはフルパスで書き、必要な環境変数は明示します。出力はリダイレクトしないと、うまくいかなくてもメールに消えて気づけません。', 'cron のはまりどころ'),
          DEFS([
            ['systemd タイマー', 'cron の代わり。.timer と .service の組で定義する。ログが journalctl に残り、前回失敗したら次で補える（Persistent）などの利点がある'],
            ['確認', 'systemctl list-timers で、次にいつ動くかの一覧'],
            ['一度だけ', 'at コマンド（例：at 23:00）'],
          ]),
          Q('cron で「平日の朝 8 時 30 分」に実行したい。正しい式は？', ['30 8 * * 1-5', '8 30 * * 1-5', '* * 8 30 1-5', '30 8 1-5 * *'], 0, '「分 時 日 月 曜日」の順です。分=30、時=8、日と月は*（毎）、曜日=1-5（月〜金）。上の練習部品でも確かめられます。'),
        ],
      },
      {
        id: 'log', title: 'ログと時刻',
        blocks: [
          CODE('ログを見る', "journalctl -u nginx --since '1 hour ago'   # サービスのログ\njournalctl -p err -b                        # 今回の起動以降のエラー\njournalctl -f                               # 追う\ntail -f /var/log/syslog                     # ファイルのログ\ngrep -i error /var/log/app/*.log"),
          LIST('ログ運用の基本', [
            'logrotate で、ログを日ごとに分割・圧縮・一定期間で削除する（肥大とディスク満杯を防ぐ）',
            '大事なログは、別のログサーバー・SIEM にも送る（侵入者に消されても残す）',
            'すべての機器の時刻を NTP でそろえる（ずれると調査で突き合わせられない）',
            'タイムゾーンを決める。サーバーが UTC だと、ログの時刻が日本時間と 9 時間ずれる',
          ]),
          CODE('時刻の確認・設定', "timedatectl                                 # 時刻・タイムゾーン・NTP の状態\nsudo timedatectl set-timezone Asia/Tokyo\ndate -d @1775634512                         # UNIX 時間を日時に"),
          LINK('ポータルのログ解析を開く', '#logs', 'アクセスログから、アクセスの多い IP や急な増加を集計できます。'),
          LINK('「フォレンジック：ログと痕跡」の Linux の章へ', '#learn/dfir-logs', 'どこに何の記録が残るか、調査の目線でまとまっています。'),
          Q('サーバー間のログを突き合わせて調査するために、まず必要なことは？', ['ログを暗号化する', 'すべての機器の時刻を NTP でそろえる', 'ログを削除する', 'ログを 1 台に集めない'], 1, '時刻がずれていると、複数の機器の出来事の前後関係が分からなくなります。NTP で合わせ、タイムゾーンもそろえます。'),
        ],
      },
    ],
  },

  // ============================================================
  {
    id: 'infra-container',
    subject: 'インフラ運用',
    name: 'コンテナ基盤（Docker 深掘り → Kubernetes 入門）',
    tagline: 'コンテナを本番で使うための考え方。イメージの作り方・データとネットワーク・Compose での一式管理から、なぜオーケストレーションが要るか、Kubernetes の Pod・Deployment・Service の基本まで。',
    genres: ['CONFIG', 'NW', 'DEFENSE'],
    level: '初級〜中級',
    prep: '約 75 分（Docker 辞典を触った後に）',
    prepLabel: '読む時間',
    icon: 'container',
    chapters: [
      {
        id: 'review', title: 'コンテナのおさらいと、向く・向かない',
        blocks: [
          P('コンテナは、アプリとその動作に必要なもの（ライブラリ・設定）を 1 つにまとめて、どこでも同じように動かす仕組みです。仮想マシンと違って OS を丸ごと持たないので、軽くて速く起動します。'),
          DEFS([
            ['イメージ', '動かすための雛形（読み取り専用）。層（レイヤー）が積み重なってできている'],
            ['コンテナ', 'イメージを動かした実体。使い捨てが前提（壊れたら作り直す）'],
            ['仮想マシンとの違い', 'VM は OS ごと。コンテナはホストのカーネルを共有するので軽いが、分離は VM より弱い'],
          ]),
          LIST('コンテナが向くこと / 注意', [
            '向く：同じ環境をどこでも再現・すぐ作って壊す・たくさん並べる（スケール）',
            '向く：検証環境・CI・マイクロサービス',
            '注意：コンテナの中のデータは消える前提。残すものはボリュームへ',
            '注意：1 コンテナ 1 役が基本（Web と DB は分ける）',
          ]),
          LINK('コマンド辞典の Docker を開く', '#dict/docker', '全コマンドと全体マップがあります。本書はその運用の考え方編です。'),
          Q('コンテナと仮想マシン（VM）の大きな違いは？', ['コンテナの方が必ず安全', 'コンテナはホストのカーネルを共有し、OS を丸ごと持たないので軽い', 'VM の方が起動が速い', '違いはない'], 1, 'コンテナは OS を共有するぶん軽量で高速ですが、分離は VM より弱いという性質もあります。'),
        ],
      },
      {
        id: 'image', title: 'イメージを小さく・安全に作る',
        blocks: [
          CODE('Dockerfile の基本と工夫', "FROM python:3.12-slim          # 軽い土台を選ぶ\nWORKDIR /app\nCOPY requirements.txt .        # 依存だけ先にコピー（キャッシュが効く）\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY . .\nUSER 1000                      # root で動かさない\nCMD [\"python\", \"app.py\"]"),
          LIST('小さく・安全にするコツ', [
            '軽い土台（slim・alpine・distroless）を選ぶ',
            '変わりにくいもの（依存）を先に COPY して、キャッシュを活かす',
            'マルチステージビルドで、ビルド用の道具を成果物に含めない',
            '.dockerignore で .git・.env・node_modules を送らない',
            'USER で root 以外にする（乗っ取られても権限を渡さない）',
            '秘密は COPY・ARG で入れない（履歴に残る）。実行時に渡すか BuildKit の secret を使う',
            'タグを固定する（latest は中身が変わる）。信頼できる発行元のイメージを使う',
          ]),
          WARN('Dockerfile で一度イメージに入れた秘密は、後の層で削除してもイメージの履歴（docker history）に残ります。鍵やパスワードはビルドに含めないでください。', '秘密の扱い'),
          Q('Dockerfile で、依存のインストールをソースのコピーより先に書くのはなぜ？', ['見やすいから', 'ソースだけ変えたときに、依存の層のキャッシュが再利用されてビルドが速いから', '必須の順番だから', 'セキュリティのため'], 1, '変わりにくい依存を先に置くと、ソースを変えただけのときに依存のインストールがキャッシュから再利用され、ビルドが速くなります。'),
        ],
      },
      {
        id: 'data', title: 'データ・ネットワーク・設定',
        blocks: [
          DEFS([
            ['ボリューム', 'コンテナを消しても残るデータの置き場。DB などに使う（-v 名前:/path）'],
            ['bind マウント', 'ホストのフォルダをそのまま見せる（開発中のコード）。本番の設定の受け渡しにも'],
            ['ネットワーク', '自分で作ったネットワークに入れると、コンテナ同士が名前で通信できる'],
            ['設定と秘密', '環境変数で渡すのが基本。秘密は .env をリポジトリに入れず、Compose の secrets や外部の仕組みで'],
          ]),
          CODE('Compose で一式を管理する（compose.yaml）', "services:\n  web:\n    build: .\n    ports: [\"8080:80\"]\n    depends_on: [db]\n    environment:\n      DATABASE_URL: postgres://app@db/app\n  db:\n    image: postgres:16\n    environment:\n      POSTGRES_PASSWORD_FILE: /run/secrets/db_pw\n    volumes: [\"pgdata:/var/lib/postgresql/data\"]\n    secrets: [db_pw]\nvolumes:\n  pgdata:\nsecrets:\n  db_pw:\n    file: ./db_pw.txt"),
          CODE('よく使う Compose の操作', "docker compose up -d           # 一式を起動\ndocker compose logs -f web     # ログ\ndocker compose up -d --build   # 作り直して反映\ndocker compose down            # 停止・片付け（-v でデータも）\ndocker compose config          # 展開後の設定を確認"),
          Q('コンテナを消してもデータベースの中身を残したい。使うのは？', ['環境変数', 'ボリューム', 'ポート公開', 'タグ'], 1, 'ボリュームはコンテナの寿命と切り離してデータを保持します。コンテナを作り直しても、同じボリュームをつなげば中身が残ります。'),
        ],
      },
      {
        id: 'why-orchestration', title: 'なぜオーケストレーションが要るか',
        blocks: [
          P('1 台で compose を動かすだけなら簡単ですが、本番では「落ちたら自動で戻す」「混んだら台数を増やす」「止めずに新しい版へ入れ替える」「複数のサーバーに分散する」といったことが要ります。これを自動でやるのがオーケストレーション（Kubernetes など）です。'),
          FIG('declarative', 'あるべき状態を宣言すると、システムがその状態に寄せ続ける'),
          TABLE(['やりたいこと', 'オーケストレーションが自動でやること'], [
            ['落ちても動かし続ける', '壊れたコンテナを作り直す（self-healing）'],
            ['混雑に対応する', '台数を増やす・減らす（スケール）'],
            ['止めずに更新する', '少しずつ入れ替える（ローリングアップデート）・問題あれば戻す'],
            ['複数サーバーで動かす', '空いているサーバーに割り当てる（スケジューリング）'],
            ['入口をまとめる', '使い捨ての個々のコンテナではなく、安定した入口（Service）で受ける'],
          ]),
          Q('Kubernetes などのオーケストレーションの考え方「宣言的」とは？', ['手順を 1 つずつ実行する', 'あるべき状態を書き、それに寄せ続けてもらう', '手で毎回設定する', '一度きりの実行'], 1, '「どうするか（手順）」ではなく「どうあるべきか（状態）」を宣言し、システムが現状との差を埋め続けます。再現性ややり直しに強い考え方です。'),
        ],
      },
      {
        id: 'k8s-objects', title: 'Kubernetes の主な部品',
        blocks: [
          P('Kubernetes（k8s）は、コンテナを複数のサーバー（ノード）の上で動かし続ける仕組みです。すべてを「あるべき状態の宣言（YAML）」で表します。'),
          FIG('k8s', 'Deployment が Pod の台数を保ち、Service が安定した入口になる'),
          DEFS([
            ['Pod', '動かす最小の単位。1 つ以上のコンテナの組。使い捨てで、作り直されると IP も変わる'],
            ['Deployment', 'Pod を「3 つ」「この版で」と宣言し、その状態を保つ。更新・やり直しもここで'],
            ['Service', 'Pod の前に立つ安定した入口（名前・仮想 IP）。Pod が入れ替わっても変わらない'],
            ['Ingress', '外からの HTTP を、ホスト名やパスで各 Service へ振り分ける（リバースプロキシの役）'],
            ['ConfigMap / Secret', '設定 / 秘密の値を、イメージと分けて渡す'],
            ['Namespace', '用途・チームごとの区切り'],
          ]),
          CODE('kubectl の基本（読み取り中心）', "kubectl get pods -n myapp               # Pod の一覧\nkubectl get deploy,svc -n myapp         # Deployment と Service\nkubectl describe pod <名前> -n myapp     # 詳細・イベント（起動しない原因）\nkubectl logs <pod名> -n myapp -f         # ログ\nkubectl apply -f deploy.yaml            # 宣言を適用\nkubectl scale deploy/web --replicas=5   # 台数を変える\nkubectl rollout undo deploy/web         # 直前の版に戻す"),
          TIP('最初から本物のクラスタを触らなくても、手元で練習できます。Docker Desktop の Kubernetes、minikube、kind（Kubernetes in Docker）などで、自分の PC の中にクラスタを作れます。', '練習の場'),
          Q('Kubernetes で、入れ替わる Pod の代わりに安定した入口を提供するのは？', ['Pod', 'Service', 'Namespace', 'ConfigMap'], 1, 'Pod は使い捨てで IP も変わります。Service が安定した名前・仮想 IP を提供し、裏側の Pod が入れ替わっても接続先は変わりません。'),
        ],
      },
      {
        id: 'ops', title: '運用と守りのポイント',
        blocks: [
          LIST('運用', [
            'ヘルスチェック：生きているか（liveness）・受け付けられるか（readiness）を定義し、だめなら作り直す・外す',
            'リソースの指定：Pod ごとに CPU・メモリの要求と上限を決める（暴走が全体に波及しない）',
            'ログとメトリクス：中央に集める（Pod は消えるので、コンテナ内に残さない）',
            '設定と秘密は外出し：イメージに焼き込まない（ConfigMap / Secret）',
          ]),
          LIST('守り', [
            'root で動かさない・読み取り専用のファイルシステム・不要な権限を落とす',
            'イメージの脆弱性スキャン（Trivy など）と、信頼できる発行元・固定したタグ',
            'ネットワークの制限（NetworkPolicy で、必要な通信だけ）',
            'Secret は暗号化して保存・アクセスを絞る（既定では base64 なだけ）',
            '管理の権限（RBAC）を最小に',
          ]),
          WARN('Kubernetes の Secret は、既定では「暗号化」ではなく base64 で入っているだけです。保存時の暗号化（etcd の暗号化）やアクセス制御、外部の秘密管理との連携を別に設定する必要があります。', 'Secret の誤解'),
          LINK('「サーバーの守り」を開く', '#learn/harden-linux', 'コンテナの土台になるホストの守りも忘れずに。'),
          Q('Kubernetes の Secret について正しいのは？', ['既定で強力に暗号化されている', '既定では base64 で入っているだけで、別途の暗号化とアクセス制御が要る', 'Secret は使うべきでない', 'Pod に焼き込むのが安全'], 1, 'Secret は base64（誰でも戻せる）で保持されるのが既定です。保存時の暗号化・RBAC・外部の秘密管理を組み合わせて守ります。'),
        ],
      },
    ],
  },

  // ============================================================
  {
    id: 'infra-nginx',
    subject: 'インフラ運用',
    name: 'nginx（Web サーバー・リバースプロキシ）',
    tagline: 'nginx の設定の読み方から、静的配信・バーチャルホスト・TLS・リバースプロキシ・負荷分散・ログ・トラブル対応まで。アプリの前に立つ Web サーバーの定番。',
    genres: ['CONFIG', 'WEB', 'NW'],
    level: '初級〜中級',
    prep: '約 70 分',
    prepLabel: '読む時間',
    icon: 'nginx',
    chapters: [
      {
        id: 'about', title: 'nginx とは・設定の構造',
        blocks: [
          P('nginx は、速くて軽い Web サーバーです。静的ファイルの配信、アプリへの受け渡し（リバースプロキシ）、複数サーバーへの負荷分散、TLS の終端などを担い、アプリの一番前に立つことが多い定番です。'),
          FIG('nginxctx', '設定は入れ子（コンテキスト）。main → events / http → server → location'),
          DEFS([
            ['ディレクティブ', '設定の 1 項目（listen 443; など）。; で終わる'],
            ['コンテキスト', '{ } で囲まれた範囲。中のディレクティブはその範囲に効く'],
            ['http → server → location', 'http 全体の設定 → サイトごと（server）→ パスごと（location）、と絞っていく'],
            ['設定の場所', '/etc/nginx/nginx.conf が入口。サイトごとは /etc/nginx/conf.d/*.conf や sites-available/ に分けるのが慣習'],
          ]),
          CODE('最小の設定', "server {\n    listen 80;\n    server_name example.jp;\n    root /var/www/example;\n    index index.html;\n}"),
          Q('nginx の設定で、サイト（ドメイン）ごとの設定を書くコンテキストは？', ['events', 'http', 'server', 'location'], 2, 'server ブロックが 1 つのサイトに対応します。その中の location で、パスごとの扱いを分けます。'),
        ],
      },
      {
        id: 'static', title: '静的配信とバーチャルホスト',
        blocks: [
          P('1 台の nginx で、server_name（ドメイン）を見て複数のサイトを出し分けられます（バーチャルホスト）。'),
          CODE('2 つのサイトを出し分ける', "server {\n    listen 80;\n    server_name shop.example.jp;\n    root /var/www/shop;\n}\nserver {\n    listen 80;\n    server_name blog.example.jp;\n    root /var/www/blog;\n}"),
          DEFS([
            ['root と alias', 'root はパスを足して探す（/images → root/images）。alias は置き換える'],
            ['index', 'ディレクトリにアクセスされたとき返すファイル（index.html）'],
            ['try_files', '順に探して、無ければ次へ。SPA では try_files $uri $uri/ /index.html; がよく使われる'],
            ['default_server', 'どの server_name にも合わないときに使う server'],
          ]),
          CODE('検証と反映', "sudo nginx -t                  # 設定の文法を確認（必ず先に）\nsudo systemctl reload nginx     # 接続を切らずに反映"),
          WARN('設定を変えたら、必ず nginx -t で確認してから reload します。文法ミスのまま restart すると nginx が起動せず、全サイトが止まります。', '反映の前に必ず'),
          Q('nginx の設定を反映する前に必ずやることは？', ['サーバーを再起動する', 'nginx -t で設定の文法を確認する', 'ログを消す', 'キャッシュを消す'], 1, 'nginx -t で文法の誤りを事前に見つけられます。問題なければ reload で、接続を保ったまま反映します。'),
        ],
      },
      {
        id: 'location', title: 'location の仕組み',
        blocks: [
          P('location は、リクエストのパスごとに扱いを変えるための設定です。複数の location のうちどれが使われるかには、決まった優先順位があります。'),
          W('nginxloc'),
          TABLE(['書き方', '意味', '優先'], [
            ['location = /path', '完全一致', '最優先'],
            ['location ^~ /path', '前方一致（正規表現より優先）', '高'],
            ['location ~ 正規表現', '正規表現（大文字小文字を区別）／ ~* は区別しない', '定義順で先着'],
            ['location /path', '前方一致（最長のものが勝つ）', '低'],
          ]),
          TIP('優先順位は「= → ^~ → 正規表現（先着）→ 前方一致（最長）」です。思った location に当たらないときは、この順番を思い出しましょう。上の練習部品で確かめられます。', '覚え方'),
          Q('location = / と location / の違いは？', ['同じ', '= / は「/」ちょうどだけ、location / はすべてのパスの前方一致（最後の受け皿）', '= / はすべてに当たる', 'location / は使えない'], 1, '= / はトップページちょうどだけに当たります。location / は前方一致で、ほかに当たらなかったものすべてを受ける受け皿になります。'),
        ],
      },
      {
        id: 'proxy', title: 'リバースプロキシと負荷分散',
        blocks: [
          FIG('nginxflow', '静的は nginx が返し、アプリへの処理は後ろのサーバーへ渡す'),
          CODE('アプリへ渡す（リバースプロキシ）', "location /api/ {\n    proxy_pass http://127.0.0.1:3000;\n    proxy_set_header Host $host;\n    proxy_set_header X-Real-IP $remote_addr;\n    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n    proxy_set_header X-Forwarded-Proto $scheme;\n}"),
          CODE('複数サーバーへ振り分ける（負荷分散）', "upstream app {\n    server 10.0.0.11:3000;\n    server 10.0.0.12:3000;\n    # least_conn;  # 接続の少ない方へ（既定は順番＝ラウンドロビン）\n}\nserver {\n    location / {\n        proxy_pass http://app;\n    }\n}"),
          DEFS([
            ['X-Forwarded-For', 'プロキシを通すと、アプリから見た送信元は nginx になる。本当の送信元をこのヘッダーで渡す'],
            ['ヘルスチェック', '応答しないサーバーを自動で外す（無償版は受動的、商用版は能動的）'],
            ['TLS 終端', 'nginx で HTTPS を受けて、後ろへは HTTP で渡す構成が多い'],
          ]),
          WARN('アプリ側が X-Forwarded-For をそのまま信じると、送信元 IP を偽装されます。信頼できる nginx からのものだけを採用する設定にします（アプリ側の「信頼するプロキシ」の設定）。', '転送ヘッダーの注意'),
          LINK('「業務のネットワーク」のプロキシの章へ', '#learn/net-biz', 'フォワード/リバースプロキシ・ロードバランサーの役割の違いを図で確認できます。'),
          Q('リバースプロキシの後ろのアプリで、利用者の本当の IP アドレスを知るには？', ['proxy_pass の値を見る', 'X-Forwarded-For / X-Real-IP ヘッダーを見る（信頼できる経路のものだけ）', 'Cookie を見る', '分からない'], 1, 'プロキシを通すと送信元は nginx になるため、本当の IP は nginx が付ける X-Forwarded-For 等で渡します。偽装を防ぐため、信頼できる経路からの値だけを採用します。'),
        ],
      },
      {
        id: 'tls', title: 'TLS（HTTPS）の設定',
        blocks: [
          CODE('HTTPS と、HTTP からの誘導', "server {\n    listen 443 ssl;\n    http2 on;\n    server_name example.jp;\n    ssl_certificate     /etc/letsencrypt/live/example.jp/fullchain.pem;\n    ssl_certificate_key /etc/letsencrypt/live/example.jp/privkey.pem;\n    # 以下、サイトの中身…\n}\nserver {                       # http は https へ\n    listen 80;\n    server_name example.jp;\n    return 301 https://$host$request_uri;\n}"),
          LIST('ポイント', [
            '証明書は Let\'s Encrypt（certbot）で自動取得・自動更新にするのが手軽',
            'fullchain.pem（証明書＋中間証明書）を指定する。中間を忘れると一部の環境で警告',
            '古い TLS（1.0 / 1.1）は無効に。暗号スイートは新しめに',
            'HSTS（Strict-Transport-Security）で、以後は HTTPS だけにする',
            '秘密鍵（privkey.pem）の権限を厳しく（root だけ）',
            'http2 on; は新しい nginx（1.25.1 以降）の書き方。古い版では listen 443 ssl http2; と書く',
          ]),
          LINK('「業務で使う暗号」の TLS の章へ', '#learn/crypto-biz', '証明書の連鎖・期限切れ・中間証明書の入れ忘れなど、運用の注意がまとまっています。'),
          Q('HTTPS のサイトで、スマホの一部だけ証明書の警告が出る。よくある原因は？', ['期限切れ', 'fullchain でなく証明書単体を指定し、中間証明書が足りていない', 'HTTP/2 を使っている', 'HSTS の設定'], 1, '中間証明書が無いと、連鎖をたどれない環境で警告が出ます。nginx では中間を含む fullchain.pem を指定します。'),
        ],
      },
      {
        id: 'ops', title: 'ログ・性能・トラブル対応',
        blocks: [
          CODE('ログ', "# access.log（誰が何を）・error.log（なぜ失敗したか）\ntail -f /var/log/nginx/access.log\ntail -f /var/log/nginx/error.log\n# 504 などプロキシ先の問題は error.log に理由が出る"),
          TABLE(['症状', '見るところ・原因'], [
            ['502 Bad Gateway', '後ろのアプリが落ちている・ポート違い（error.log）'],
            ['504 Gateway Timeout', 'アプリの応答が遅い（proxy_read_timeout・アプリ側）'],
            ['403 Forbidden', 'ファイルの権限・root の指定・index が無い'],
            ['404 なのにファイルはある', 'root / alias / try_files の指定ミス'],
            ['413 Request Entity Too Large', 'client_max_body_size を上げる（アップロード）'],
            ['設定が効かない', 'reload し忘れ・location の優先順位・別の server に当たっている'],
          ]),
          LIST('性能の基本', [
            'gzip / brotli で圧縮する',
            '静的ファイルに長いキャッシュ（Cache-Control）を付ける',
            'worker_processes auto; でコア数に合わせる',
            '同時接続が多いなら worker_connections を上げる',
          ]),
          LINK('Wireshark / pcap で通信を確かめる', '#learn/net-sec', '502 / 504 の切り分けで、実際の通信を見たいときに。'),
          Q('nginx が「502 Bad Gateway」を返す。まず確認すべきは？', ['利用者のブラウザ', '後ろのアプリが動いているか・proxy_pass の宛先が正しいか（error.log）', 'DNS', 'TLS の証明書'], 1, '502 は「後ろのサーバーにつなげない／おかしな応答」です。アプリの起動・ポート・proxy_pass の宛先を error.log とともに確認します。'),
        ],
      },
    ],
  },
];
