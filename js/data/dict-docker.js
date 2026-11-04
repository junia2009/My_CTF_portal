// 逆引き辞典：Docker（やりたいことから書き方を引く）
const e = (cat, t, code, d, kw = '', notes = null) => ({ cat, t, code, d, kw, notes });

export const DOCKER_DICT = {
  id: 'docker', name: 'Docker', desc: 'コンテナの起動・調査・片付け・Compose・Dockerfile。検証環境づくりや CTF の配布環境に',
  cats: ['動かす', '中を調べる', 'ファイルとデータ', 'イメージ', 'ネットワーク', '片付け', 'Compose', 'Dockerfile', 'CTF・検証環境'],
  entries: [
    // 動かす
    e('動かす', '使い捨ての環境に入って試す', 'docker run --rm -it ubuntu bash', '--rm で終了時に自動削除。危ないコマンドも、ホストを汚さず試せる', 'run 使い捨て 試す ubuntu'),
    e('動かす', 'Web サーバーをポートを公開して起動', 'docker run -d -p 8080:80 --name web nginx', '-d でバックグラウンド、-p ホスト:コンテナ。http://localhost:8080 で見える', 'run 公開 ポート nginx'),
    e('動かす', '環境変数を渡して起動', 'docker run -d -e TZ=Asia/Tokyo -e APP_ENV=dev --name app myapp', '-e で 1 つずつ、--env-file ファイル でまとめて', 'env 環境変数 設定'),
    e('動かす', '今のフォルダをコンテナにつないで作業', 'docker run --rm -it -v "$PWD":/work -w /work python:3.12 bash', '手元のコードを、コンテナの中のツールで動かせる（Python を入れずに使う）', 'volume マウント 作業 bind'),
    e('動かす', '特定のバージョンで動かす', 'docker run --rm node:20-alpine node --version', 'タグでバージョンを固定。手元に入れずに版を試せる', 'バージョン タグ 固定'),
    e('動かす', '動いているコンテナの中に入る', 'docker exec -it web bash', 'bash が無ければ sh。中の設定や状態を確認する', 'exec 入る シェル bash'),
    e('動かす', 'コンテナの中でコマンドを 1 つ実行', 'docker exec web nginx -t', '入らずに、設定の確認などを 1 回だけ実行', 'exec 実行 コマンド'),
    e('動かす', 'ログを追って見る', 'docker logs -f --tail 100 web', '-f で追記を見続ける。--since 10m で時間指定も', 'logs ログ 追う'),
    e('動かす', '止める・起動する・入れ直す', 'docker stop web\ndocker start web\ndocker restart web', 'stop は穏やかに停止、kill はすぐ強制終了', 'stop start restart 再起動'),
    e('動かす', '終了したら勝手に再起動させる', 'docker run -d --restart unless-stopped --name web nginx', 'クラッシュやホスト再起動の後も戻る。always / on-failure も', 'restart ポリシー 自動 再起動'),

    // 中を調べる
    e('中を調べる', '動いているコンテナの一覧', 'docker ps', '停止中も含めるなら docker ps -a。ID・名前・ポートが分かる', 'ps 一覧 状態'),
    e('中を調べる', 'コンテナの IP アドレスを調べる', "docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' web", 'inspect はすべての詳細を持つ。-f で必要な項目だけ', 'inspect ip ネットワーク'),
    e('中を調べる', 'コンテナの環境変数を確認する', "docker inspect -f '{{json .Config.Env}}' web", '-e で渡した値がここに出る。パスワードを渡していると見える点に注意', 'env 環境変数 確認 inspect'),
    e('中を調べる', 'どのポートが公開されているか', 'docker port web\ndocker ps --format "{{.Names}}: {{.Ports}}"', 'ホストのどのポートにつながっているか', 'port 公開 マッピング'),
    e('中を調べる', 'CPU・メモリの使用量を見る', 'docker stats --no-stream', '重いコンテナを探す。--no-stream で 1 回だけ', 'stats 資源 cpu メモリ'),
    e('中を調べる', 'コンテナの中で何が変更されたか', 'docker diff web', '起動後に追加（A）・変更（C）・削除（D）されたファイル。不審な書き込みの調査に', 'diff 変更 ファイル 調査'),
    e('中を調べる', 'コンテナの中のプロセスを見る', 'docker top web', 'ホストから見た、コンテナ内のプロセス一覧', 'top プロセス'),
    e('中を調べる', 'イメージがどう作られたか見る', 'docker history --no-trunc myapp:1.0', '各層のコマンドと大きさ。消したはずの秘密が前の層に残っていないか', 'history 層 レイヤー 調査'),

    // ファイルとデータ
    e('ファイルとデータ', 'コンテナからファイルを取り出す', 'docker cp web:/etc/nginx/nginx.conf ./', 'コンテナ:/パス ホスト の順。設定やログの回収に', 'cp 取り出す コピー'),
    e('ファイルとデータ', 'ホストからコンテナへファイルを入れる', 'docker cp ./patch.sh web:/tmp/', 'ホストのファイル コンテナ:/パス の順', 'cp 入れる コピー'),
    e('ファイルとデータ', 'データを残すボリュームを使う', 'docker volume create pgdata\ndocker run -v pgdata:/var/lib/postgresql/data postgres', 'コンテナを消してもデータが残る。DB などに', 'volume 永続 データ 保存'),
    e('ファイルとデータ', '手元のフォルダをそのまま見せる（bind）', 'docker run -v "$PWD/html":/usr/share/nginx/html:ro nginx', ':ro で読み取り専用。開発中のファイルをすぐ反映', 'bind マウント 共有 ro'),
    e('ファイルとデータ', 'ボリュームの中身をバックアップする', 'docker run --rm -v pgdata:/data -v "$PWD":/backup alpine tar czf /backup/pgdata.tgz -C /data .', '一時的なコンテナ経由で tar に固める', 'バックアップ volume tar'),

    // イメージ
    e('イメージ', 'イメージをダウンロードする', 'docker pull python:3.12-slim', 'タグでバージョンを指定。slim / alpine は軽い', 'pull ダウンロード 取得'),
    e('イメージ', '手元のイメージとその大きさを見る', 'docker images', '-q で ID だけ。大きさの確認に', 'images 一覧 サイズ'),
    e('イメージ', 'Dockerfile からイメージを作る', 'docker build -t myapp:1.0 .', '-t で名前、. は Dockerfile のある場所', 'build ビルド 作成'),
    e('イメージ', 'キャッシュを使わずに作り直す', 'docker build --no-cache -t myapp:1.0 .', '古い状態が残って困るときに', 'no-cache 再ビルド キャッシュ'),
    e('イメージ', 'イメージを小さくする（マルチステージ）', 'FROM golang AS build\n# …ビルド…\nFROM gcr.io/distroless/base\nCOPY --from=build /app /app', 'ビルド用と実行用を分け、成果物だけをコピーする', 'multi-stage 軽量 サイズ'),
    e('イメージ', 'イメージをファイルにして渡す', 'docker save myapp:1.0 | gzip > myapp.tgz\n# 受け取る側\ndocker load < myapp.tgz', 'ネットにつながらない環境や、CTF の配布に', 'save load 配布 オフライン'),
    e('イメージ', 'レジストリに送る', 'docker tag myapp:1.0 registry.example.com/team/myapp:1.0\ndocker push registry.example.com/team/myapp:1.0', '先に docker login。名前をレジストリ用に付け替える', 'push tag レジストリ 公開'),

    // ネットワーク
    e('ネットワーク', 'コンテナ同士を名前でつなぐ', 'docker network create appnet\ndocker run -d --network appnet --name db postgres\ndocker run --network appnet --rm -it alpine ping db', '同じネットワークなら「db」で呼べる（既定の bridge では不可）', 'network 名前解決 接続 つなぐ'),
    e('ネットワーク', '動いているコンテナを後からネットワークにつなぐ', 'docker network connect appnet web', 'あとから参加させる', 'connect 追加 接続'),
    e('ネットワーク', 'ホストのネットワークをそのまま使う', 'docker run --network host nginx', 'ポートのマッピングなしでホストのポートを直接使う（Linux のみ）', 'host ネットワーク 直接'),
    e('ネットワーク', 'どのコンテナがつながっているか', 'docker network inspect appnet', '参加しているコンテナと IP が分かる', 'inspect ネットワーク 一覧'),

    // 片付け
    e('片付け', 'コンテナを削除する', 'docker rm -f web', '-f で動いていても強制的に。$(docker ps -aq) で全部', 'rm 削除 コンテナ'),
    e('片付け', '何がディスクを使っているか見る', 'docker system df', 'イメージ・コンテナ・ボリューム・キャッシュの使用量', 'df 容量 ディスク 使用量'),
    e('片付け', '使っていないものをまとめて消す', 'docker system prune', '停止中のコンテナ・不要なネットワーク・宙ぶらりんのイメージを削除', 'prune 掃除 容量 空ける'),
    e('片付け', 'イメージまで含めて大きく空ける', 'docker system prune -a --volumes', '使っていないイメージ・ボリュームも消す。必要なデータが無いか確認してから', 'prune -a 全部 ボリューム 削除'),
    e('片付け', '特定のイメージを消す', 'docker rmi python:3.11', 'そのイメージのコンテナが残っていると消せない（先に rm）', 'rmi イメージ 削除'),
    e('片付け', '全部止めて全部消す（リセット）', 'docker rm -f $(docker ps -aq)', '検証環境をまっさらに。ボリュームは別途 docker volume prune', 'リセット 全削除 まっさら'),

    // Compose
    e('Compose', 'アプリ一式を起動・停止する', 'docker compose up -d\ndocker compose down', 'compose.yaml に書いた Web・DB などをまとめて。down -v でデータも消す', 'compose up down 一式'),
    e('Compose', 'Compose のログを追う', 'docker compose logs -f web', 'サービス名を指定。全部なら省略', 'compose logs ログ'),
    e('Compose', 'Compose のコンテナの中に入る', 'docker compose exec web bash', 'サービス名で指定（コンテナ名でなく）', 'compose exec シェル'),
    e('Compose', 'コードを変えたので作り直して再起動', 'docker compose up -d --build', '--build でイメージを作り直してから起動', 'compose build 再ビルド 反映'),
    e('Compose', '展開後の設定を確認する', 'docker compose config', '環境変数や変数が入った最終的な設定を表示。誤りの確認に', 'compose config 確認 検証'),
    e('Compose', '1 つのサービスだけ入れ直す', 'docker compose up -d --no-deps --force-recreate web', '依存はそのまま、web だけ作り直す', 'compose 再作成 個別'),

    // Dockerfile
    e('Dockerfile', 'Python アプリの基本の Dockerfile', 'FROM python:3.12-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY . .\nUSER 1000\nCMD ["python", "app.py"]', '依存を先にコピーするとキャッシュが効く。最後に USER で root 以外に', 'dockerfile python 基本'),
    e('Dockerfile', 'ビルドに含めないファイルを決める', '# .dockerignore\n.git\n.env\nnode_modules\n*.log', 'ビルドのコンテキストから除く。秘密ファイルや重いものを送らない', 'dockerignore 除外 秘密'),
    e('Dockerfile', 'root で動かさないようにする', 'RUN useradd -m appuser\nUSER appuser', 'コンテナが乗っ取られても、root の権限を渡さない', 'user root 非root 権限 セキュリティ'),
    e('Dockerfile', '秘密を履歴に残さず使う（BuildKit）', 'RUN --mount=type=secret,id=npmtoken \\\n  NPM_TOKEN=$(cat /run/secrets/npmtoken) npm ci', 'ARG や COPY で秘密を入れると history に残る。secret マウントを使う', 'secret 秘密 build 履歴'),

    // CTF・検証環境
    e('CTF・検証環境', '練習用の脆弱な Web アプリを立てる', 'docker run --rm -d -p 3000:3000 bkimminich/juice-shop', 'OWASP Juice Shop。自分の PC の中だけで Web の練習ができる', 'juice-shop 練習 脆弱 web'),
    e('CTF・検証環境', '使い終わったら跡形もなく消す', 'docker run --rm ... で起動\n# または\ndocker compose down -v', '--rm と down -v で、試した跡を残さない。マルウェア解析の使い捨て環境にも', '使い捨て リセット クリーン'),
    e('CTF・検証環境', 'ネットワークを遮断して動かす', 'docker run --rm -it --network none suspicious-image', '外と通信させずに中身を調べる（不審なイメージの確認）', 'network none 遮断 隔離 解析'),
    e('CTF・検証環境', '配布されたイメージを読み込んで調べる', 'docker load < challenge.tgz\ndocker history --no-trunc challenge:latest\ndocker run --rm -it challenge:latest sh', 'CTF で配られたイメージの中身・作られ方を確認', 'load 配布 調査 ctf'),
    e('CTF・検証環境', 'イメージの中のファイルを取り出して調べる', 'docker create --name tmp challenge:latest\ndocker cp tmp:/app ./app\ndocker rm tmp', '起動せずに中身を取り出す。隠されたフラグや設定を探す', 'create cp 取り出す ファイル'),
    e('CTF・検証環境', '資源を制限して安全に動かす', 'docker run --rm -it --memory 512m --cpus 1 --pids-limit 100 image', '暴走や資源の食いつぶしを防ぐ。不審なものを試すときに', '制限 memory cpu 安全'),
  ],
};
