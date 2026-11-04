// 逆引き辞典：Git（やりたいことから書き方を引く）
const e = (cat, t, code, d, kw = '', notes = null) => ({ cat, t, code, d, kw, notes });

export const GIT_DICT = {
  id: 'git', name: 'Git', desc: 'バージョン管理の定番操作と、困ったときの戻し方。CTF で .git を調べる方法も',
  cats: ['始める・設定', '記録する', '履歴を見る', 'ブランチ', 'リモートと共同作業', '取り消す・やり直す', 'トラブル', '調べる（CTF・調査）'],
  entries: [
    // 始める・設定
    e('始める・設定', '最初にやる設定（名前とメール）', 'git config --global user.name "Yamada Taro"\ngit config --global user.email yamada@example.com\ngit config --global init.defaultBranch main', 'コミットに残る名前とメール。PC ごとに最初に一度だけ', '初期設定 config 名前 メール'),
    e('始める・設定', '今のフォルダを Git で管理し始める', 'git init -b main\ngit add .\ngit commit -m "最初のコミット"', '.gitignore を先に作っておくと、余計なファイルが入らない', 'init 新規 始める'),
    e('始める・設定', 'サーバーのリポジトリを手元にコピー', 'git clone https://github.com/example/app.git\ncd app', 'SSH の鍵を登録しているなら git@github.com:example/app.git の形でも', 'clone コピー ダウンロード'),
    e('始める・設定', '最新だけを軽くコピー', 'git clone --depth 1 https://github.com/example/app.git', '履歴が要らないとき。大きなリポジトリでも速い。後で git fetch --unshallow で全部取れる', 'shallow depth 軽い 速い'),
    e('始める・設定', '管理しないファイルを決める（.gitignore）', "cat > .gitignore <<'EOF'\n.env\n*.log\nnode_modules/\n/dist/\nEOF", 'パスワードの入ったファイル・ログ・ビルド結果は管理しない', 'gitignore 無視 除外'),
    e('始める・設定', 'なぜ無視されているか調べる', 'git check-ignore -v path/to/file', 'どの .gitignore の何行目で無視されているか表示する', 'check-ignore 無視 理由'),
    e('始める・設定', '設定の一覧と、どこで設定されたか', 'git config --list --show-origin', '会社と個人のメールが混ざっていないか確かめるときにも', 'config 一覧 確認'),
    e('始める・設定', 'よく使うコマンドに短い名前を付ける', 'git config --global alias.st "status -sb"\ngit config --global alias.lg "log --oneline --graph --all"', '以後 git st、git lg で使える', 'alias 別名 短縮'),
    e('始める・設定', '改行コードの自動変換を設定する', 'git config --global core.autocrlf true   # Windows\ngit config --global core.autocrlf input  # Mac / Linux', 'Windows と Mac / Linux で同じリポジトリを触るときの差分の嵐を防ぐ', '改行 crlf autocrlf windows'),

    // 記録する
    e('記録する', '変更を確認して記録する（基本の流れ）', 'git status\ngit diff\ngit add 変更したファイル\ngit commit -m "何をなぜ変えたか"', 'status → diff → add → commit が基本。メッセージは「何をなぜ」', 'commit 基本 流れ'),
    e('記録する', '変更の一部だけをコミットする', 'git add -p', 'かたまりごとに y（入れる）・n（入れない）・s（さらに分割）を選ぶ', 'add -p 一部 部分'),
    e('記録する', '次のコミットに入る変更を確かめる', 'git diff --staged', 'add した後の最終確認。秘密の情報が入っていないかも見る', 'diff staged cached 確認'),
    e('記録する', '間違えて add したのを外す', 'git restore --staged ファイル', '変更そのものは残る（ステージから外すだけ）', 'unstage 取り消し add'),
    e('記録する', '途中の作業を一時的にしまう', 'git stash push -u -m "ログイン画面の途中"\ngit stash list\ngit stash pop', '-u で新しいファイルもしまう。pop で取り出す', 'stash 退避 一時保存'),
    e('記録する', 'ファイル名を変える', 'git mv old.txt new.txt\ngit commit -m "名前を変更"', '大文字小文字だけの変更も git mv で', 'rename mv 名前変更'),
    e('記録する', '空のフォルダを管理する', 'touch logs/.gitkeep\ngit add logs/.gitkeep', 'Git はフォルダだけでは管理できないので、空のファイルを置くのが慣習', '空フォルダ gitkeep'),
    e('記録する', 'メッセージの書き方（例）', 'git commit -m "ログイン失敗時のエラー表示を修正" -m "パスワードの誤りとロックを区別して表示する。"', '1 行目は短い要約、-m をもう 1 つ付けると本文（詳しい理由）になる', 'メッセージ 書き方 本文'),

    // 履歴を見る
    e('履歴を見る', '履歴を 1 行ずつ・分岐を図で', 'git log --oneline --graph --all', 'ブランチの分かれ方と合流が一目で分かる', 'log graph 履歴 図'),
    e('履歴を見る', '特定のファイルの履歴', 'git log --follow -p -- src/app.js', '--follow で名前を変える前もたどる。-p で中身の変更も', 'ファイル 履歴 follow'),
    e('履歴を見る', '誰がいつこの行を変えたか', 'git blame -L 40,60 src/auth.js', '分かったコミットを git show で見ると、変更の理由が分かる', 'blame 誰 行'),
    e('履歴を見る', 'ある文字が追加・削除されたコミットを探す', 'git log -S "API_KEY" --oneline\ngit log -G "pass(word)?\\s*=" --oneline', '-S は文字の数が変わったコミット、-G は正規表現に合う行が変わったコミット', 'pickaxe 検索 追加 削除 -S'),
    e('履歴を見る', '期間・作者・メッセージで絞る', 'git log --since="2026-04-01" --until="2026-04-30" --author="yamada" --grep="修正"', '月報や作業記録の確認に', '期間 作者 絞り込み'),
    e('履歴を見る', '昔の版のファイルの中身を見る', 'git show HEAD~3:config.yml\ngit show v1.0.0:README.md > old_README.md', 'コミット:パス の形で、その時点の中身を表示する', '過去 版 中身 show'),
    e('履歴を見る', '2 つのブランチの差を見る', 'git log --oneline main..feature   # feature にだけあるコミット\ngit diff main...feature --stat     # 分かれてからの変更', '.. と ... で意味が違う', 'ブランチ 差分 比較'),
    e('履歴を見る', '作者ごとのコミット数', 'git shortlog -sne', '多い順に、名前とメールつきで', 'shortlog 作者 集計'),
    e('履歴を見る', '日時と作者つきの 1 行表示', "git log --pretty=format:'%h %ad %an %s' --date=iso", '%h（短いハッシュ）・%ad（日時）・%an（作者）・%s（件名）', 'format 書式 日時'),

    // ブランチ
    e('ブランチ', '新しいブランチを作って切り替える', 'git switch -c feature/login', '古い書き方では git checkout -b feature/login', 'branch 作成 switch'),
    e('ブランチ', 'ブランチの一覧と状態', 'git branch -vv\ngit branch -a', '-vv で追跡しているリモートと、進み・遅れ（ahead / behind）が分かる', 'branch 一覧'),
    e('ブランチ', '作業を main に取り込む', 'git switch main\ngit pull\ngit merge --no-ff feature/login', '--no-ff で「ここで取り込んだ」というマージのコミットが残る', 'merge 取り込む 統合'),
    e('ブランチ', '自分のブランチを main の最新に追いつかせる', 'git fetch\ngit rebase origin/main', 'まだ push していない、自分だけのブランチで使う', 'rebase 追いつく 最新'),
    e('ブランチ', '競合（コンフリクト）を解決する', 'git status                  # 競合したファイルを確認\n# ファイルの <<<<<<< ======= >>>>>>> を直す\ngit add 直したファイル\ngit commit                  # rebase 中なら git rebase --continue', '<<<<<<< と ======= の間が自分、======= と >>>>>>> の間が相手の変更', 'conflict コンフリクト 競合 解決'),
    e('ブランチ', '競合したマージ・rebase をやめる', 'git merge --abort\ngit rebase --abort', '始める前の状態に戻る', 'abort 中止 やめる'),
    e('ブランチ', '特定のコミットだけ別のブランチに入れる', 'git switch release/1.2\ngit cherry-pick -x a1b2c3d', '修正だけを旧版にも入れたいときに', 'cherry-pick 一部 取り込む'),
    e('ブランチ', 'コミットをまとめる・並べ替える', 'git rebase -i HEAD~3\n# 開いた一覧で pick を squash（まとめる）/ reword（メッセージ）/ drop（消す）に変える', 'push 前に「作業途中」のコミットを整理する', 'squash まとめる 整理 rebase -i'),
    e('ブランチ', 'マージ済みのブランチを片付ける', 'git branch --merged main | grep -vE "^\\*|main" | xargs -r git branch -d', '-d はマージ済みのものしか消さないので安全', '削除 掃除 merged'),
    e('ブランチ', 'ブランチの名前を変える', 'git branch -m old-name new-name\ngit push origin -u new-name\ngit push origin --delete old-name', 'サーバー側は「新しい名前で送る＋古い名前を消す」', 'rename 名前変更 ブランチ'),
    e('ブランチ', 'リリースにタグを付ける', 'git tag -a v1.2.0 -m "4 月リリース"\ngit push origin v1.2.0', 'タグは明示的に push しないと送られない', 'tag リリース 版'),

    // リモートと共同作業
    e('リモートと共同作業', '新しいブランチを初めて送る', 'git push -u origin feature/login', '-u で追跡の設定がされ、次からは git push だけで送れる', 'push 初回 upstream'),
    e('リモートと共同作業', 'サーバーの変更を確認してから取り込む', 'git fetch\ngit log --oneline HEAD..origin/main\ngit pull --rebase', 'いきなり pull せず、先に何が来るか見る', 'fetch pull 確認'),
    e('リモートと共同作業', '接続先の URL を確かめる・変える', 'git remote -v\ngit remote set-url origin git@github.com:example/app.git', 'HTTPS から SSH に変えるときなど', 'remote url 変更'),
    e('リモートと共同作業', 'フォーク元の最新を取り込む', 'git remote add upstream https://github.com/original/app.git\ngit fetch upstream\ngit rebase upstream/main', 'upstream という名前でフォーク元を登録する', 'fork upstream フォーク 同期'),
    e('リモートと共同作業', 'rebase した自分のブランチを送り直す', 'git push --force-with-lease', '-f と違い、ほかの人の更新があれば止まる。共有の main には使わない', 'force push 強制 lease'),
    e('リモートと共同作業', 'サーバーのブランチを消す', 'git push origin --delete feature/old\ngit fetch --prune', '--prune で手元の一覧からも消える', 'delete リモート 削除 prune'),
    e('リモートと共同作業', 'プルリクエストのブランチを手元で試す', 'git fetch origin pull/123/head:pr-123\ngit switch pr-123', 'GitHub のプルリクエスト 123 をブランチとして取ってくる', 'pull request pr レビュー'),
    e('リモートと共同作業', '別のフォルダで同時に別のブランチを開く', 'git worktree add ../hotfix main\ncd ../hotfix', '今の作業をしまわずに急ぎの修正ができる', 'worktree 同時 並行'),
    e('リモートと共同作業', 'ネットに出せない環境へコミットを渡す', 'git format-patch main..feature -o patches/\n# 受け取る側\ngit am patches/*.patch', 'パッチのファイルで渡す。作者やメッセージも引き継がれる', 'patch パッチ オフライン 受け渡し'),

    // 取り消す・やり直す
    e('取り消す・やり直す', 'ファイルの変更を捨てて元に戻す', 'git restore ファイル', 'ステージしていない変更は戻せなくなるので注意', '取り消し 戻す 変更 捨てる'),
    e('取り消す・やり直す', '直前のコミットのメッセージを直す', 'git commit --amend -m "正しいメッセージ"', 'push 前に。push 済みならほかの人と履歴がずれる', 'amend メッセージ 修正'),
    e('取り消す・やり直す', '直前のコミットに入れ忘れを足す', 'git add forgot.js\ngit commit --amend --no-edit', 'メッセージはそのままで中身だけ足す', 'amend 入れ忘れ 追加'),
    e('取り消す・やり直す', '直前のコミットを取り消す（変更は残す）', 'git reset --soft HEAD~1', 'コミットだけ取り消して、変更はステージに残る。やり直しに', 'reset soft 取り消し コミット'),
    e('取り消す・やり直す', 'push 済みのコミットを打ち消す', 'git revert a1b2c3d\ngit push', '逆の変更のコミットを足すので、履歴を壊さない。本番の切り戻しに', 'revert 打ち消し 切り戻し'),
    e('取り消す・やり直す', '手元を捨ててサーバーと同じにする', 'git fetch origin\ngit reset --hard origin/main\ngit clean -fd', '手元の変更と追加したファイルはすべて消える。必要なら先に stash', 'reset hard 同期 リセット'),
    e('取り消す・やり直す', '消してしまったコミットを救出する', 'git reflog\ngit branch rescue HEAD@{3}', 'reset --hard や rebase の前の位置が reflog に残っている', 'reflog 救出 復元 消えた'),
    e('取り消す・やり直す', '消したファイルを取り戻す', 'git log --oneline -- path/to/file      # 消したコミットを探す\ngit restore --source=a1b2c3d~1 path/to/file', '消したコミットの 1 つ前（~1）の版から取り出す', '削除 復元 ファイル'),
    e('取り消す・やり直す', '管理していないファイルを片付ける', 'git clean -nd   # 確認\ngit clean -fd   # 実行', '必ず -n で何が消えるかを見てから', 'clean 掃除 不要'),

    // トラブル
    e('トラブル', 'パスワード・鍵をコミットしてしまった', '# 1. まず鍵・パスワードを無効にして作り直す（最優先）\n# 2. 履歴から消す（git filter-repo を入れて）\ngit filter-repo --invert-paths --path .env\ngit push --force-with-lease --all', '公開済みなら、履歴を消しても誰かがコピーしている前提で、必ず無効化を先に', '秘密 漏洩 パスワード 鍵 filter-repo'),
    e('トラブル', 'detached HEAD と言われた', 'git switch -c keep-work   # 作業を残すならブランチを作る\ngit switch main           # 要らなければ戻る', 'ブランチではなくコミットを直接開いている状態。そのままコミットすると迷子になりやすい', 'detached head 迷子'),
    e('トラブル', 'pull が「divergent branches」で失敗する', 'git config --global pull.rebase false   # マージで取り込む\n# または\ngit pull --rebase', '手元とサーバーの両方に新しいコミットがある状態。取り込み方を決める', 'divergent pull 失敗'),
    e('トラブル', 'push が拒否された（rejected）', 'git pull --rebase\ngit push', 'サーバーに自分の知らないコミットがある。先に取り込んでから送る', 'rejected non-fast-forward push 失敗'),
    e('トラブル', '大きなファイルで push できない', 'git rm --cached big.zip\necho "big.zip" >> .gitignore\ngit commit --amend --no-edit', '直前のコミットなら amend で外す。過去のコミットにあるなら filter-repo が必要', '大きい ファイル サイズ 制限 lfs'),
    e('トラブル', 'ファイルの権限の変更だけが差分に出る', 'git config core.fileMode false', 'Windows や共有フォルダで、実行権限の違いだけが変更として出るとき', '権限 filemode 差分'),
    e('トラブル', 'clone したのにサブモジュールが空', 'git submodule update --init --recursive', 'clone のときに --recurse-submodules を付け忘れたとき', 'submodule 空 サブモジュール'),
    e('トラブル', '日本語のファイル名が \\346\\227… と表示される', 'git config --global core.quotepath false', 'ファイル名の日本語を、そのまま表示させる', '日本語 文字化け quotepath'),
    e('トラブル', 'いつから壊れたか分からない', 'git bisect start\ngit bisect bad\ngit bisect good v1.0.0\n# 表示された版で確かめて good / bad をくり返す\ngit bisect reset', '二分探索で原因のコミットを見つける。git bisect run テスト で自動化も', 'bisect 原因 調査 二分探索'),

    // 調べる（CTF・調査）
    e('調べる（CTF・調査）', '配布された .git フォルダの中を調べる', 'git log --all --oneline\ngit status\ngit stash list\ngit branch -a', 'まず全部のブランチ・stash・作業中の変更を確かめる。flag は「消したつもり」の場所にあることが多い', 'ctf .git 調査 フォレンジック'),
    e('調べる（CTF・調査）', '消されたファイルを履歴から探す', 'git log --all --diff-filter=D --name-only --oneline', '--diff-filter=D で「削除されたファイル」があるコミットだけ。見つけたら git show コミット~1:パス', '削除 履歴 ファイル ctf'),
    e('調べる（CTF・調査）', '全コミットから文字を探す', 'git grep -n "flag{" $(git rev-list --all)\ngit log --all -p | grep -n "flag{"', 'ブランチに残っていない過去の版も含めて探す', 'grep 全履歴 flag 検索'),
    e('調べる（CTF・調査）', 'どこからもたどれないデータを探す', 'git fsck --lost-found\ngit cat-file --batch-all-objects --batch-check', 'reset や amend で消えたコミット・stash で消したデータが見つかることがある', 'fsck dangling unreachable 迷子'),
    e('調べる（CTF・調査）', 'オブジェクトの中身を直接読む', 'git cat-file -t a1b2c3d\ngit cat-file -p a1b2c3d', '-t で種類（commit / tree / blob）、-p で中身', 'cat-file オブジェクト blob'),
    e('調べる（CTF・調査）', 'Git コマンドを使わずにオブジェクトを読む', "python3 -c \"import zlib,sys; print(zlib.decompress(open(sys.argv[1],'rb').read()))\" .git/objects/a1/b2c3d4…", '.git/objects の中身は zlib で圧縮されているだけ。展開すると「blob 大きさ\\0中身」の形', 'zlib objects 手動 展開'),
    e('調べる（CTF・調査）', 'stash・reflog に残った作業を見る', 'git stash list\ngit stash show -p stash@{0}\ngit reflog --all', '「一時的にしまった」「取り消した」変更が残っていることがある', 'stash reflog 残骸'),
    e('調べる（CTF・調査）', 'コミットの作者・日時を詳しく見る', 'git log --all --format="%H %an <%ae> %ad / %cn %cd" --date=iso', '作者（author）と記録者（committer）は別。日時は自由に書き換えられるので、うのみにしない', '作者 日時 author committer 偽装'),
    e('調べる（CTF・調査）', '公開サーバーに .git が出ていないか点検する', 'curl -s -o /dev/null -w "%{http_code}\\n" https://自社のサイト/.git/HEAD', '200 が返るなら、ソースコードと履歴が丸見え。Web サーバーで /.git へのアクセスを拒否する（自社の管理するサイトで）', '.git 公開 漏洩 点検 防御'),
    e('調べる（CTF・調査）', '履歴に秘密の情報が無いか点検する', 'git log --all -p | grep -nE "(password|secret|api[_-]?key|BEGIN [A-Z ]*PRIVATE KEY)"', '公開する前の確認に。専用の道具（gitleaks など）もある', '秘密 漏洩 点検 シークレット 防御'),
  ],
};
