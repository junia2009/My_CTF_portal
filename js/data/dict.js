// 逆引き辞典：「やりたいこと」から書き方を引く（SQL / Python / Linux）
// 項目：[分類, やりたいこと, コード, 説明, 検索用の別名（任意）, 方言・補足の表（任意）]
// 例で使う名前：テーブル users（id, name, email, dept, age, created_at）・orders（id, user_id, amount, ordered_at）

import { MORE } from './dict-more.js';
import { GIT_DICT } from './dict-git.js';
import { DOCKER_DICT } from './dict-docker.js';

const e = (cat, t, code, d, kw = '', notes = null) => ({ cat, t, code, d, kw, notes });

export const DICTS = [
  {
    id: 'sql', name: 'SQL', desc: 'データベースの検索・集計・更新。例は users（社員）と orders（注文）のテーブル',
    cats: ['取り出す', '絞り込む', '並べる', '集計', '結合', '更新', 'テーブル', '文字と日付', '便利'],
    entries: [
      // 取り出す
      e('取り出す', '全部の列・行を見る', 'SELECT * FROM users;', '* はすべての列。大きなテーブルでは件数を絞ってから（下の「最初の 10 件だけ」）', 'select all 全件'),
      e('取り出す', '必要な列だけ取り出す', 'SELECT id, name, email FROM users;', '列名をカンマで並べる。* より速く、結果も見やすい', '列 カラム column'),
      e('取り出す', '列に別名を付ける', 'SELECT name AS 氏名, age AS 年齢 FROM users;', 'AS で結果の列名を変える。AS は省略できる', 'alias エイリアス 別名'),
      e('取り出す', '最初の 10 件だけ', 'SELECT * FROM users LIMIT 10;', '件数を制限する。データベースによって書き方が違う', 'limit top 上位 件数', [['MySQL / PostgreSQL / SQLite', 'LIMIT 10'], ['SQL Server', 'SELECT TOP 10 * FROM users;'], ['Oracle（12c 以降）', 'FETCH FIRST 10 ROWS ONLY']]),
      e('取り出す', '11 件目から 10 件（ページ送り）', 'SELECT * FROM users ORDER BY id LIMIT 10 OFFSET 10;', 'OFFSET で読み飛ばす件数を指定。順番を固定するため ORDER BY と一緒に使う', 'offset ページング paging', [['SQL Server', 'ORDER BY id OFFSET 10 ROWS FETCH NEXT 10 ROWS ONLY']]),
      e('取り出す', '重複を除いて一覧にする', 'SELECT DISTINCT dept FROM users;', '同じ値の行を 1 つにまとめる', 'distinct 重複 ユニーク 一意'),
      e('取り出す', '計算した列を作る', "SELECT id, amount, amount * 1.1 AS 税込 FROM orders;", '列どうしや数で計算できる', '計算 四則'),
      e('取り出す', '条件で値を出し分ける（IF の代わり）', "SELECT name,\n  CASE\n    WHEN age >= 60 THEN 'シニア'\n    WHEN age >= 30 THEN 'ミドル'\n    ELSE 'ジュニア'\n  END AS 区分\nFROM users;", 'CASE は上から順に条件を調べ、最初に合ったものを返す', 'case when if 条件分岐'),
      // 絞り込む
      e('絞り込む', '条件に合う行だけ', "SELECT * FROM users WHERE dept = '営業';", '文字は \' \' で囲む。数ならそのまま（age = 30）', 'where 条件 フィルタ'),
      e('絞り込む', '複数の条件（かつ・または）', "SELECT * FROM users WHERE dept = '営業' AND (age >= 30 OR name LIKE '山%');", 'AND と OR を混ぜるときは ( ) で囲んで意図をはっきりさせる', 'and or かつ または'),
      e('絞り込む', '〜を含む・〜で始まる（あいまい検索）', "SELECT * FROM users WHERE email LIKE '%@example.com';", '% は 0 文字以上の任意の文字、_ は 1 文字', 'like 部分一致 前方一致 後方一致 含む'),
      e('絞り込む', 'いくつかの値のどれか', "SELECT * FROM users WHERE dept IN ('営業', '開発', '総務');", 'OR を並べるより短く書ける。NOT IN で「どれでもない」', 'in 複数 リスト'),
      e('絞り込む', '範囲で絞る', "SELECT * FROM orders WHERE ordered_at BETWEEN '2026-04-01' AND '2026-04-30';", 'BETWEEN は両端を含む。日時の列なら終わりは < \'2026-05-01\' の方が安全', 'between 範囲 期間'),
      e('絞り込む', '空（NULL）の行を探す', 'SELECT * FROM users WHERE email IS NULL;', 'NULL は = では比べられない。IS NULL / IS NOT NULL を使う', 'null 空 未入力'),
      e('絞り込む', '空文字と NULL をまとめて探す', "SELECT * FROM users WHERE COALESCE(email, '') = '';", 'COALESCE は最初の NULL でない値を返す', 'coalesce 空文字 null'),
      e('絞り込む', '別のテーブルにある（ない）ものだけ', 'SELECT * FROM users u\nWHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id);', '注文が 1 件もない社員。EXISTS にすれば「ある」側', 'exists not exists 存在 突合 サブクエリ'),
      // 並べる
      e('並べる', '並べ替える', 'SELECT * FROM users ORDER BY age DESC, name ASC;', 'DESC は大きい順、ASC は小さい順（省略時）。複数の列で順に並べられる', 'order by sort ソート 昇順 降順'),
      e('並べる', 'NULL を最後にして並べる', 'SELECT * FROM users ORDER BY email IS NULL, email;', 'NULL の位置はデータベースで違う。PostgreSQL / Oracle は NULLS LAST と書ける', 'nulls last'),
      e('並べる', '順位を付ける', 'SELECT name, age, RANK() OVER (ORDER BY age DESC) AS 順位 FROM users;', '同じ値は同順位。連番なら ROW_NUMBER()、詰めた順位なら DENSE_RANK()', 'rank row_number 順位 ウィンドウ関数'),
      e('並べる', 'グループごとに上位 3 件', 'SELECT * FROM (\n  SELECT *, ROW_NUMBER() OVER (PARTITION BY dept ORDER BY age DESC) AS rn\n  FROM users\n) t WHERE rn <= 3;', 'PARTITION BY でグループに分けて番号を振り、外側で絞る', 'top n グループ別 partition'),
      // 集計
      e('集計', '件数を数える', 'SELECT COUNT(*) FROM users;', 'COUNT(列名) にすると NULL を除いて数える', 'count 件数 数'),
      e('集計', '合計・平均・最大・最小', 'SELECT SUM(amount), AVG(amount), MAX(amount), MIN(amount) FROM orders;', 'NULL は計算から除かれる', 'sum avg max min 合計 平均'),
      e('集計', 'グループごとに集計', 'SELECT dept, COUNT(*) AS 人数, AVG(age) AS 平均年齢\nFROM users\nGROUP BY dept;', 'SELECT に書く集計以外の列は、GROUP BY にも書く', 'group by 部署別 グループ'),
      e('集計', '集計結果で絞り込む', 'SELECT dept, COUNT(*) FROM users\nGROUP BY dept\nHAVING COUNT(*) >= 5;', '集計の前は WHERE、集計の後は HAVING', 'having'),
      e('集計', '重複している値を探す', 'SELECT email, COUNT(*) FROM users\nGROUP BY email\nHAVING COUNT(*) > 1;', '同じメールアドレスが 2 件以上ある行', '重複 チェック duplicate'),
      e('集計', '種類の数を数える', 'SELECT COUNT(DISTINCT dept) FROM users;', '重複を除いた数', 'count distinct 種類'),
      e('集計', '月ごとに集計する', "SELECT strftime('%Y-%m', ordered_at) AS 月, SUM(amount)\nFROM orders GROUP BY 月 ORDER BY 月;", '日付から年月を取り出す関数はデータベースで違う', '月別 年月 date_trunc', [['MySQL', "DATE_FORMAT(ordered_at, '%Y-%m')"], ['PostgreSQL', "to_char(ordered_at, 'YYYY-MM')"], ['SQL Server', "FORMAT(ordered_at, 'yyyy-MM')"], ['SQLite', "strftime('%Y-%m', ordered_at)"]]),
      e('集計', '累計（積み上げ）を出す', 'SELECT ordered_at, amount,\n  SUM(amount) OVER (ORDER BY ordered_at) AS 累計\nFROM orders;', 'ウィンドウ関数。グループごとの累計なら PARTITION BY を足す', '累計 running total ウィンドウ'),
      // 結合
      e('結合', '2 つのテーブルをつなぐ（両方にあるものだけ）', 'SELECT u.name, o.amount\nFROM users u\nJOIN orders o ON o.user_id = u.id;', 'INNER JOIN。ON に「どの列で対応するか」を書く', 'join inner 結合'),
      e('結合', '左のテーブルは全部残してつなぐ', 'SELECT u.name, o.amount\nFROM users u\nLEFT JOIN orders o ON o.user_id = u.id;', '注文の無い社員も残る（その行の amount は NULL）', 'left join outer 外部結合'),
      e('結合', '縦に積み重ねる', 'SELECT name, email FROM users\nUNION ALL\nSELECT name, email FROM ex_users;', '列の数と型をそろえる。UNION（ALL なし）は重複を除く', 'union 縦 結合 マージ'),
      e('結合', '結果を一時的な表として使う（WITH）', 'WITH big AS (\n  SELECT user_id, SUM(amount) AS total FROM orders GROUP BY user_id\n)\nSELECT u.name, big.total FROM users u JOIN big ON big.user_id = u.id\nWHERE big.total > 100000;', '長い SQL を段階に分けて読みやすくする（共通テーブル式）', 'with cte サブクエリ'),
      // 更新
      e('更新', '行を追加する', "INSERT INTO users (name, email, dept) VALUES ('山田太郎', 'yamada@example.com', '営業');", '列名を明示しておくと、列の並びが変わっても壊れない', 'insert 追加 登録'),
      e('更新', '複数行をまとめて追加', "INSERT INTO users (name, dept) VALUES\n  ('佐藤', '開発'),\n  ('鈴木', '総務');", '1 回で複数行。1 行ずつより速い', 'insert bulk 一括'),
      e('更新', '値を書き換える', "UPDATE users SET dept = '開発' WHERE id = 42;", 'WHERE を忘れると全行が書き換わる。先に同じ WHERE で SELECT して確かめる', 'update 更新 変更'),
      e('更新', '行を消す', 'DELETE FROM users WHERE id = 42;', 'WHERE を忘れると全部消える。トランザクションの中で試すと安全（下の「やり直せるように」）', 'delete 削除'),
      e('更新', 'やり直せるように実行する', "BEGIN;\nUPDATE users SET dept = '開発' WHERE dept = '開発部';\n-- 結果を確認して\nCOMMIT;   -- 間違えたら ROLLBACK;", 'トランザクション。COMMIT するまで確定しない', 'transaction commit rollback トランザクション'),
      e('更新', 'あれば更新・なければ追加', "INSERT INTO users (id, name) VALUES (42, '山田')\nON CONFLICT (id) DO UPDATE SET name = excluded.name;", 'いわゆる UPSERT。書き方がデータベースで違う', 'upsert merge on conflict', [['PostgreSQL / SQLite', 'ON CONFLICT (id) DO UPDATE SET …'], ['MySQL', 'ON DUPLICATE KEY UPDATE name = VALUES(name)'], ['SQL Server / Oracle', 'MERGE INTO users USING …']]),
      // テーブル
      e('テーブル', 'テーブルを作る', 'CREATE TABLE users (\n  id INTEGER PRIMARY KEY,\n  name VARCHAR(100) NOT NULL,\n  email VARCHAR(255) UNIQUE,\n  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n);', 'PRIMARY KEY は行を区別する列、NOT NULL は空を禁止、UNIQUE は重複を禁止', 'create table 作成'),
      e('テーブル', '列を追加する', 'ALTER TABLE users ADD COLUMN phone VARCHAR(20);', '既存の行の新しい列は NULL（または DEFAULT の値）になる', 'alter add column 列追加'),
      e('テーブル', '検索を速くする（インデックス）', 'CREATE INDEX idx_users_email ON users (email);', 'WHERE や JOIN でよく使う列に作る。更新は少し遅くなる', 'index インデックス 高速化'),
      e('テーブル', 'テーブルの列の一覧を見る', "SELECT column_name, data_type FROM information_schema.columns\nWHERE table_name = 'users';", 'データベースによって手軽な書き方がある', 'describe desc 列一覧 スキーマ', [['MySQL', 'DESCRIBE users;'], ['PostgreSQL（psql）', '\\d users'], ['SQLite', 'PRAGMA table_info(users);'], ['SQL Server', "EXEC sp_columns 'users';"]]),
      e('テーブル', 'テーブルの一覧を見る', "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';", 'information_schema は多くのデータベースにある', 'show tables テーブル一覧', [['MySQL', 'SHOW TABLES;'], ['PostgreSQL（psql）', '\\dt'], ['SQLite', "SELECT name FROM sqlite_master WHERE type = 'table';"]]),
      e('テーブル', '中身だけを全部消す', 'TRUNCATE TABLE logs;', 'DELETE より速いが、多くのデータベースで元に戻せない', 'truncate 全削除'),
      // 文字と日付
      e('文字と日付', '文字をつなげる', "SELECT name || '（' || dept || '）' FROM users;", '|| は標準の書き方。MySQL は CONCAT を使う', 'concat 連結 結合', [['MySQL / SQL Server', "CONCAT(name, '（', dept, '）')"], ['PostgreSQL / SQLite / Oracle', "name || '（' || dept || '）'"]]),
      e('文字と日付', '文字の一部を取り出す', "SELECT SUBSTR(email, 1, INSTR(email, '@') - 1) AS アカウント FROM users;", '@ より前を取り出す例。関数名はデータベースで少し違う（SUBSTRING・POSITION など）', 'substr substring 部分 切り出し'),
      e('文字と日付', '置き換える・前後の空白を消す', "SELECT TRIM(REPLACE(name, '　', ' ')) FROM users;", 'REPLACE で全角空白を半角に、TRIM で前後の空白を除く', 'replace trim 置換 空白'),
      e('文字と日付', '大文字・小文字をそろえて比べる', "SELECT * FROM users WHERE LOWER(email) = LOWER('Taro@Example.com');", '大文字と小文字を区別するかはデータベースや設定で違う', 'lower upper 大文字 小文字'),
      e('文字と日付', '今日・今の日時', 'SELECT CURRENT_DATE, CURRENT_TIMESTAMP;', '標準の書き方。NOW() なども使える（MySQL / PostgreSQL）', 'now today 現在 日時'),
      e('文字と日付', '30 日前より新しい行', "SELECT * FROM orders WHERE ordered_at >= CURRENT_DATE - INTERVAL '30' DAY;", '日付の計算はデータベースで書き方が違う', '日付 計算 期間 interval', [['PostgreSQL', "CURRENT_DATE - INTERVAL '30 days'"], ['MySQL', 'CURDATE() - INTERVAL 30 DAY'], ['SQL Server', 'DATEADD(day, -30, GETDATE())'], ['SQLite', "date('now', '-30 days')"]]),
      e('文字と日付', '型を変える', "SELECT CAST(age AS VARCHAR(10)) AS 年齢の文字, CAST('2026-04-01' AS DATE) AS 日付 FROM users;", '文字 ⇄ 数、文字 → 日付など', 'cast 変換 型'),
      e('文字と日付', 'NULL を別の値で表示する', "SELECT name, COALESCE(email, '（未登録）') FROM users;", 'IFNULL（MySQL / SQLite）・ISNULL（SQL Server）・NVL（Oracle）も同じ働き', 'coalesce ifnull nvl null 置換'),
      // 便利
      e('便利', '実行計画を見る（遅い SQL の調査）', 'EXPLAIN SELECT * FROM users WHERE email = \'a@example.com\';', 'インデックスが使われているかを確認する。PostgreSQL は EXPLAIN ANALYZE で実際の時間も', 'explain 遅い チューニング 実行計画'),
      e('便利', 'テーブルを丸ごとコピーする（バックアップ）', 'CREATE TABLE users_backup AS SELECT * FROM users;', '更新の前に取っておくと安心。インデックスや制約はコピーされない', 'backup コピー 複製'),
      e('便利', '値を安全に埋め込む（SQL インジェクション対策）', "# Python の例：値は ? で渡し、文字列をつなげて SQL を作らない\ncur.execute('SELECT * FROM users WHERE email = ?', (email,))", '入力をそのまま SQL に連結すると、SQL インジェクションの穴になる。必ずプレースホルダで渡す', 'sql injection インジェクション プレースホルダ セキュリティ'),
      e('便利', 'コメントを書く', '-- 1 行のコメント\n/* 複数行の\n   コメント */\nSELECT 1;', '-- の後ろは無視される', 'comment コメント'),
    ],
  },
  {
    id: 'python', name: 'Python', desc: 'Python 3 の定番の書き方。ファイル・文字列・データ処理・CTF でよく使う変換',
    cats: ['基本', '文字列', 'リストと辞書', 'ファイル', 'データ', '日付', 'ネット', 'CTF で便利'],
    entries: [
      // 基本
      e('基本', 'f 文字列で値を埋め込む', "name, n = '山田', 3\nprint(f'{name}さんは {n} 件 / 割合 {0.1234:.1%} / 桁区切り {1234567:,}')", ':.1% や :, で書式を指定できる', 'f-string format 書式'),
      e('基本', '条件分岐', "if age >= 60:\n    kind = 'シニア'\nelif age >= 30:\n    kind = 'ミドル'\nelse:\n    kind = 'ジュニア'", 'elif は「そうでなくて、もし」', 'if elif else 条件'),
      e('基本', '1 行で書く条件分岐', "kind = 'OK' if score >= 60 else 'NG'", '三項演算子', '三項 conditional'),
      e('基本', '番号付きで繰り返す', "for i, name in enumerate(names, start=1):\n    print(i, name)", 'enumerate で番号と値を同時に取り出す', 'for enumerate ループ 番号'),
      e('基本', '2 つのリストを同時に回す', 'for name, age in zip(names, ages):\n    print(name, age)', '短い方に合わせて終わる', 'zip 並列'),
      e('基本', '例外（エラー）を受け止める', "try:\n    n = int(text)\nexcept ValueError:\n    n = 0\nfinally:\n    print('おわり')", 'except で特定のエラーだけ受け止める。finally は必ず実行される', 'try except エラー処理 例外'),
      e('基本', '関数を作る（初期値つきの引数）', "def greet(name, greeting='こんにちは'):\n    return f'{greeting}、{name}さん'\n\nprint(greet('山田'))", '引数に初期値を付けると省略できる', 'def function 関数'),
      e('基本', 'コマンドライン引数を受け取る', "import argparse\np = argparse.ArgumentParser()\np.add_argument('path')\np.add_argument('-n', type=int, default=10)\nargs = p.parse_args()\nprint(args.path, args.n)", 'python script.py data.csv -n 5 のように使う。-h で説明が出る', 'argparse 引数 sys.argv'),
      e('基本', 'スクリプトとして実行されたときだけ動かす', "def main():\n    print('main')\n\nif __name__ == '__main__':\n    main()", 'import されたときは動かない', '__main__ main'),
      // 文字列
      e('文字列', '分割・結合', "parts = 'a,b,c'.split(',')\njoined = ' / '.join(parts)", 'split() を引数なしで呼ぶと、空白（連続も）で分割', 'split join 分割 結合'),
      e('文字列', '前後の空白や改行を消す', "s = '  hello\\n'.strip()", 'lstrip / rstrip で片側だけ。strip(\'/\') のように消す文字も指定できる', 'strip trim 空白'),
      e('文字列', '置き換える', "s = 'a-b-c'.replace('-', '_')", 'パターンで置き換えるなら re.sub（下の正規表現）', 'replace 置換'),
      e('文字列', '含む・始まる・終わる', "if 'flag' in s and s.startswith('flag{') and s.endswith('}'):\n    print('フラグ')", 'in で含むか判定', 'in startswith endswith 含む'),
      e('文字列', '正規表現で探す・置き換える', "import re\nemails = re.findall(r'[\\w.+-]+@[\\w-]+\\.[\\w.]+', text)\nmasked = re.sub(r'\\d{4}', '****', text)", "r'' で書くと \\ をそのまま書ける", 're regex 正規表現 findall sub'),
      e('文字列', '大文字・小文字・ゼロ埋め', "print('abc'.upper(), 'ABC'.lower(), '7'.zfill(3), f'{7:03d}')", 'zfill や :03d で 007 のように', 'upper lower zfill ゼロ埋め'),
      e('文字列', '全角と半角をそろえる', "import unicodedata\ns = unicodedata.normalize('NFKC', 'ＡＢＣ１２３　ｶﾀｶﾅ')", 'NFKC で全角英数は半角に、半角カナは全角に', 'unicodedata nfkc 全角 半角 正規化'),
      e('文字列', '文字列とバイト列を変換する', "b = '日本語'.encode('utf-8')\ns = b.decode('utf-8')\ns2 = b.decode('cp932', errors='replace')", 'Windows の日本語（Shift_JIS）は cp932。読めない文字は errors で扱いを指定', 'encode decode utf-8 shift_jis cp932 文字コード'),
      // リストと辞書
      e('リストと辞書', '条件に合うものだけで新しいリスト', 'adults = [u for u in users if u["age"] >= 20]\nnames = [u["name"] for u in users]', 'リスト内包表記', 'list comprehension 内包表記 filter map'),
      e('リストと辞書', '並べ替える（キーを指定）', "users.sort(key=lambda u: (u['dept'], -u['age']))\nsorted_names = sorted(names, reverse=True)", 'sort は元のリストを並べ替え、sorted は新しいリストを返す', 'sort sorted 並べ替え lambda'),
      e('リストと辞書', '重複を除く（順番は保つ）', 'unique = list(dict.fromkeys(items))', 'set(items) でも除けるが、順番がばらばらになる', '重複 unique set'),
      e('リストと辞書', '数を数える（多い順）', "from collections import Counter\nc = Counter(words)\nprint(c.most_common(5))", '出現回数の集計', 'counter 集計 頻度 カウント'),
      e('リストと辞書', 'グループごとにまとめる', "from collections import defaultdict\nby_dept = defaultdict(list)\nfor u in users:\n    by_dept[u['dept']].append(u['name'])", '無いキーを自動で作ってくれる辞書', 'defaultdict グループ化 group by'),
      e('リストと辞書', '辞書を安全に読む・回す', "age = user.get('age', 0)\nfor key, value in user.items():\n    print(key, value)", 'get は無いキーでもエラーにならない', 'dict get items 辞書'),
      e('リストと辞書', '2 つの辞書を合わせる', 'merged = {**defaults, **options}\nmerged2 = defaults | options  # Python 3.9 以降', '後ろの方が優先される', 'merge 辞書 結合'),
      e('リストと辞書', '一部を取り出す（スライス）', 'first3 = items[:3]\nlast3 = items[-3:]\nreversed_items = items[::-1]', '[開始:終わり:刻み]。マイナスは後ろから', 'slice スライス 逆順'),
      // ファイル
      e('ファイル', 'テキストファイルを読む', "with open('data.txt', encoding='utf-8') as f:\n    for line in f:\n        print(line.rstrip('\\n'))", 'with を使うと自動で閉じる。全部まとめて読むなら f.read()', 'open read 読み込み'),
      e('ファイル', 'テキストファイルに書く', "with open('out.txt', 'w', encoding='utf-8') as f:\n    f.write('1 行目\\n')", "'w' は上書き、'a' は追記", 'write 書き込み 保存'),
      e('ファイル', 'バイナリファイルを読み書きする', "with open('image.png', 'rb') as f:\n    data = f.read()\nwith open('copy.png', 'wb') as f:\n    f.write(data)", "'rb' / 'wb' でバイト列として扱う", 'binary rb wb バイナリ'),
      e('ファイル', 'フォルダの中のファイルを探す', "from pathlib import Path\nfor p in Path('logs').rglob('*.log'):\n    print(p, p.stat().st_size)", 'rglob は下のフォルダまで探す。glob はその階層だけ', 'pathlib glob ファイル一覧 再帰'),
      e('ファイル', 'パスを組み立てる・存在を確かめる', "from pathlib import Path\np = Path('out') / 'result.csv'\np.parent.mkdir(parents=True, exist_ok=True)\nprint(p.exists(), p.suffix, p.stem)", 'Windows と Linux の区切りの違いを気にしなくてよい', 'pathlib path mkdir 存在'),
      // データ
      e('データ', 'CSV を読む（見出しつき）', "import csv\nwith open('users.csv', encoding='utf-8-sig', newline='') as f:\n    for row in csv.DictReader(f):\n        print(row['name'])", "Excel で保存した CSV は 'utf-8-sig'（BOM つき）か 'cp932' のことが多い", 'csv 読み込み dictreader excel'),
      e('データ', 'CSV を書く（Excel で文字化けしない）', "import csv\nwith open('out.csv', 'w', encoding='utf-8-sig', newline='') as f:\n    w = csv.writer(f)\n    w.writerow(['氏名', '部署'])\n    w.writerows(rows)", "utf-8-sig にすると Excel で開いても化けない。newline='' を忘れると空行が入る", 'csv 書き込み excel 文字化け bom'),
      e('データ', 'JSON を読む・書く', "import json\nwith open('data.json', encoding='utf-8') as f:\n    data = json.load(f)\ntext = json.dumps(data, ensure_ascii=False, indent=2)", 'ensure_ascii=False で日本語をそのまま出力', 'json 読み込み 書き込み'),
      e('データ', 'pandas で表を集計する', "import pandas as pd\ndf = pd.read_csv('orders.csv')\nprint(df.groupby('dept')['amount'].agg(['count', 'sum', 'mean']))", 'pip install pandas が必要。Excel は pd.read_excel（openpyxl も必要）', 'pandas dataframe 集計 groupby excel'),
      e('データ', 'pandas で絞り込み・並べ替え・保存', "import pandas as pd\ndf = pd.read_csv('users.csv')\nout = df[df['age'] >= 30].sort_values('age', ascending=False)\nout.to_csv('out.csv', index=False, encoding='utf-8-sig')", '条件は df[条件]。複数なら (A) & (B)', 'pandas filter sort to_csv'),
      // 日付
      e('日付', '今の日時と書式', "from datetime import datetime\nnow = datetime.now()\nprint(now.strftime('%Y/%m/%d %H:%M:%S'))", '%Y 年、%m 月、%d 日、%H 時、%M 分、%S 秒', 'datetime now strftime 日時 書式'),
      e('日付', '文字列を日時に変える', "from datetime import datetime\ndt = datetime.strptime('2026/04/01 09:30', '%Y/%m/%d %H:%M')\ndt2 = datetime.fromisoformat('2026-04-01T09:30:00+09:00')", 'strptime は書式を指定して読む', 'strptime 変換 parse'),
      e('日付', '日数の足し引き・差', "from datetime import date, timedelta\nd = date.today() + timedelta(days=30)\ndays = (date(2026, 12, 31) - date.today()).days", 'timedelta で日・時間・分を足し引き', 'timedelta 日付 計算 差'),
      e('日付', 'UNIX 時間 ⇄ 日時（日本時間）', "from datetime import datetime, timezone, timedelta\nJST = timezone(timedelta(hours=9))\ndt = datetime.fromtimestamp(1700000000, JST)\nts = int(dt.timestamp())", 'タイムゾーンを付けておくと時差の取り違えが無い', 'unix time timestamp epoch jst タイムゾーン'),
      // ネット
      e('ネット', 'Web API を呼ぶ（requests）', "import requests\nr = requests.get('https://api.example.com/users', params={'q': 'yamada'}, timeout=10)\nr.raise_for_status()\nprint(r.json())", 'pip install requests が必要。timeout は必ず付ける', 'requests http get api'),
      e('ネット', 'POST で送る・Cookie を保つ', "import requests\ns = requests.Session()\ns.post('https://example.com/login', data={'user': 'u', 'pass': 'p'}, timeout=10)\nr = s.get('https://example.com/mypage', timeout=10)", 'Session を使うとログイン後の Cookie が引き継がれる。json= で JSON を送れる', 'post session cookie login'),
      e('ネット', '標準ライブラリだけで HTTP', "from urllib.request import urlopen\nwith urlopen('https://example.com', timeout=10) as r:\n    html = r.read().decode()", 'requests を入れられない環境で', 'urllib urlopen'),
      e('ネット', 'TCP で接続して送受信する', "import socket\nwith socket.create_connection(('example.com', 80), timeout=5) as s:\n    s.sendall(b'HEAD / HTTP/1.0\\r\\nHost: example.com\\r\\n\\r\\n')\n    print(s.recv(4096).decode(errors='replace'))", 'CTF の nc で接続する問題の自動化にも', 'socket tcp nc netcat'),
      // CTF で便利
      e('CTF で便利', 'Base64 / Hex の変換', "import base64\nb = base64.b64decode('ZmxhZw==')\ns = base64.b64encode(b'flag').decode()\nh = b'flag'.hex()\nb2 = bytes.fromhex('666c6167')", 'URL 用は base64.urlsafe_b64decode', 'base64 hex 変換'),
      e('CTF で便利', 'XOR する', "data = bytes.fromhex('515b5650')\nkey = b'\\x37'\nout = bytes(c ^ key[i % len(key)] for i, c in enumerate(data))\nprint(out)", '繰り返しの鍵にも対応', 'xor'),
      e('CTF で便利', '整数 ⇄ バイト列（RSA の後など）', "m = 0x666c6167\nb = m.to_bytes((m.bit_length() + 7) // 8, 'big')\nn = int.from_bytes(b'flag', 'big')", 'pycryptodome の long_to_bytes / bytes_to_long と同じ', 'long_to_bytes bytes_to_long int bytes rsa'),
      e('CTF で便利', 'べき乗剰余・逆元', 'c = pow(m, e, n)\nd = pow(e, -1, phi)  # Python 3.8 以降', 'pow の第 3 引数で剰余つきのべき乗が速く計算できる', 'pow modinv 逆元 rsa'),
      e('CTF で便利', 'ハッシュを計算する', "import hashlib\nprint(hashlib.md5(b'password').hexdigest())\nprint(hashlib.sha256(open('file.bin', 'rb').read()).hexdigest())", 'sha1・sha512 なども同じ使い方', 'hashlib md5 sha256 hash'),
      e('CTF で便利', 'バイト列を構造で読む（struct）', "import struct\nmagic, width, height = struct.unpack('>4sII', data[:12])", '< はリトルエンディアン、> はビッグ。I は 4 バイト、H は 2 バイト、B は 1 バイト', 'struct pack unpack バイナリ'),
      e('CTF で便利', '総当たりする（組み合わせ）', "import itertools, string\nfor p in itertools.product(string.digits, repeat=4):\n    pin = ''.join(p)", 'product・permutations・combinations で組み合わせを作る', 'itertools brute force 総当たり'),
    ],
  },
  {
    id: 'linux', name: 'Linux コマンド', desc: 'サーバー作業・ログ調査・ファイル操作の定番コマンド',
    cats: ['ファイル操作', '探す', 'テキスト処理', 'ログ調査', 'プロセス', 'ネットワーク', 'ユーザーと権限', 'システム', '圧縮', '便利'],
    entries: [
      // ファイル操作
      e('ファイル操作', '詳しい一覧（隠しファイル込み）', 'ls -la', '-l で詳しく、-a で . から始まる隠しファイルも。-h で大きさを読みやすく、-t で新しい順', 'ls 一覧 隠しファイル'),
      e('ファイル操作', 'コピー（フォルダごと）', 'cp -a src/ backup/', '-a は属性（日時・権限）も保ってフォルダごとコピー', 'cp copy コピー'),
      e('ファイル操作', '移動・名前の変更', 'mv old.txt new.txt', '同じ場所なら名前の変更になる。-i で上書き前に確認', 'mv move rename 名前変更'),
      e('ファイル操作', '消す（フォルダごと）', 'rm -ri old_dir/', '-r でフォルダごと、-i で 1 つずつ確認。-rf は確認なしで消えるので注意', 'rm 削除'),
      e('ファイル操作', 'フォルダを作る（途中も）', 'mkdir -p logs/2026/04', '-p で途中のフォルダもまとめて作る', 'mkdir ディレクトリ作成'),
      e('ファイル操作', 'ファイルの中身を見る', 'less /var/log/syslog', 'less は / で検索、q で終了。短いファイルなら cat', 'less cat 表示 中身'),
      e('ファイル操作', '先頭・末尾だけ見る', 'head -n 20 app.log\ntail -n 50 app.log', '行数を指定', 'head tail 先頭 末尾'),
      e('ファイル操作', '追記されるログを見続ける', 'tail -F /var/log/nginx/access.log', '-F はログの切り替え（ローテーション）にもついていく。Ctrl+C で終了', 'tail -f リアルタイム 監視'),
      e('ファイル操作', 'ファイルの種類を調べる', 'file unknown.bin', '拡張子ではなく中身から判定する', 'file 種類 形式'),
      e('ファイル操作', 'リンクを作る', 'ln -s /opt/app/current /opt/app/live', '-s でシンボリックリンク（ショートカット）', 'ln symlink シンボリックリンク'),
      // 探す
      e('探す', '名前でファイルを探す', "find /var/www -name '*.php'", "-iname で大文字小文字を区別しない。-type f でファイルだけ", 'find 検索 ファイル名'),
      e('探す', '最近変更されたファイル', 'find /etc -type f -mtime -1', '-mtime -1 は 1 日以内。-mmin -30 で 30 分以内', 'find mtime 最近 更新'),
      e('探す', '大きいファイルを探す', 'find / -type f -size +100M 2>/dev/null', '2>/dev/null で権限エラーの表示を捨てる', 'find size 大きい 容量'),
      e('探す', 'ファイルの中の文字を探す', "grep -rn 'password' /etc/", '-r でフォルダの中まで、-n で行番号、-i で大文字小文字を区別しない', 'grep 検索 文字列'),
      e('探す', '含まない行・前後の行も表示', "grep -v '^#' nginx.conf\ngrep -C 3 'ERROR' app.log", '-v は含まない行、-C 3 は前後 3 行も', 'grep -v -C 除外 前後'),
      e('探す', '正規表現で探す', "grep -E '[0-9]{1,3}(\\.[0-9]{1,3}){3}' access.log", '-E で拡張正規表現。-o で一致した部分だけ出す', 'grep -E regex 正規表現 ip'),
      e('探す', 'コマンドの場所を調べる', 'which python3\ntype ll', 'type は別名（alias）や組み込みも分かる', 'which type コマンド 場所'),
      // テキスト処理
      e('テキスト処理', '行数・単語数を数える', 'wc -l access.log', '-l は行数、-w は単語数、-c はバイト数', 'wc 行数 カウント'),
      e('テキスト処理', '並べ替えて重複を数える', 'sort access.log | uniq -c | sort -nr | head', '定番の集計。uniq は隣り合う重複しかまとめないので、先に sort', 'sort uniq 集計 ランキング'),
      e('テキスト処理', '区切りで列を取り出す', "cut -d ',' -f 1,3 users.csv", '-d で区切り文字、-f で何番目の列か', 'cut 列 csv'),
      e('テキスト処理', '空白区切りの列を取り出す（awk）', "awk '{print $1, $7}' access.log", '$1 が 1 列目。空白が連続しても 1 つの区切りとして扱う', 'awk 列 フィールド'),
      e('テキスト処理', '条件で絞って合計する（awk）', "awk -F, '$3 >= 30 {sum += $4} END {print sum}' data.csv", '-F で区切り文字。END は最後に 1 回だけ実行', 'awk 合計 条件'),
      e('テキスト処理', '置き換える（sed）', "sed 's/http:/https:/g' in.txt > out.txt", 's/探す/置換後/g。ファイルを直接書き換えるなら -i（-i.bak でバックアップを残す）', 'sed 置換 replace'),
      e('テキスト処理', '特定の行だけ表示・削除（sed）', "sed -n '100,120p' big.log\nsed '/^$/d' in.txt", '-n と p で指定行だけ表示、d で削除（例は空行の削除）', 'sed 行 抽出 削除'),
      e('テキスト処理', '文字を置き換える・消す（tr）', "tr 'a-z' 'A-Z' < in.txt\ntr -d '\\r' < win.txt > unix.txt", '2 つ目は Windows の改行（CRLF）を Linux の改行（LF）にする定番', 'tr 改行 crlf 大文字'),
      e('テキスト処理', '2 つのファイルの違い', 'diff -u old.conf new.conf', '-u は見やすい形式。ポータルの「差分比較」も使える', 'diff 差分 比較'),
      e('テキスト処理', 'JSON を整形・抽出（jq）', "cat res.json | jq '.users[] | {name, email}'", 'jq を入れる必要がある。jq . で整形だけ', 'jq json 整形'),
      // ログ調査
      e('ログ調査', 'アクセスの多い IP を集計', "awk '{print $1}' access.log | sort | uniq -c | sort -nr | head", 'Web サーバーのアクセスログの 1 列目が IP', 'ip 集計 アクセスログ ランキング'),
      e('ログ調査', 'SSH のログイン失敗が多い IP', "grep 'Failed password' /var/log/auth.log | grep -oE 'from [0-9.]+' | sort | uniq -c | sort -nr | head", 'RHEL 系は /var/log/secure', 'ssh ログイン失敗 ブルートフォース auth.log'),
      e('ログ調査', 'エラーの時間帯を調べる', "grep ' 500 ' access.log | awk '{print substr($4, 2, 14)}' | uniq -c", '[02/Nov/2026:09 の形で 1 時間ごとに数える', '時間帯 エラー 500'),
      e('ログ調査', 'サービスのログを見る（systemd）', 'journalctl -u nginx --since "1 hour ago" -f', '-u でサービス名、--since で期間、-f で見続ける', 'journalctl systemd ログ'),
      e('ログ調査', 'ログイン履歴を見る', 'last -n 20\nlastb | head', 'last は成功、lastb は失敗（root 権限が必要）', 'last lastb ログイン履歴'),
      e('ログ調査', '圧縮されたログもまとめて探す', "zgrep 'ERROR' /var/log/app.log*", '.gz のまま検索できる', 'zgrep gz 圧縮 ログ'),
      // プロセス
      e('プロセス', '動いているプロセスを見る', 'ps auxf', 'f で親子関係を木の形で。特定のものは ps aux | grep nginx', 'ps プロセス一覧'),
      e('プロセス', 'CPU・メモリを使っているものを見る', 'top', 'q で終了。M でメモリ順、P で CPU 順。htop が入っていればより見やすい', 'top htop cpu メモリ 負荷'),
      e('プロセス', 'プロセスを止める', 'kill 1234\nkill -9 1234\npkill -f "python app.py"', 'まず普通の kill。止まらないときだけ -9（強制）', 'kill pkill 停止 終了'),
      e('プロセス', 'サービスの起動・停止・状態', 'sudo systemctl status nginx\nsudo systemctl restart nginx\nsudo systemctl enable --now nginx', 'enable で起動時に自動で開始。--now で今すぐ開始も', 'systemctl service 再起動 起動'),
      e('プロセス', 'ログアウトしても動かし続ける', 'nohup ./job.sh > job.log 2>&1 &', 'tmux や screen を使うと後から画面に戻れる', 'nohup バックグラウンド tmux'),
      e('プロセス', '定期的に実行する（cron）', 'crontab -e\n# 毎日 3:00 に実行\n0 3 * * * /home/user/backup.sh >> /home/user/backup.log 2>&1', '分 時 日 月 曜日 の順。crontab -l で一覧', 'cron crontab 定期実行 スケジュール'),
      // ネットワーク
      e('ネットワーク', '待ち受けているポートを見る', 'sudo ss -tulpn', 't は TCP、u は UDP、l は待ち受け、p はプロセス、n は数字のまま', 'ss netstat ポート 待ち受け'),
      e('ネットワーク', 'IP アドレスを見る', 'ip a', 'ip r で経路（ゲートウェイ）', 'ip addr ifconfig アドレス'),
      e('ネットワーク', '相手に届くか確かめる', 'ping -c 4 example.com\ntraceroute example.com', '-c で回数。traceroute で途中の経路', 'ping 疎通 traceroute'),
      e('ネットワーク', 'ポートが開いているか確かめる', 'nc -zv example.com 443', '-z で接続だけ確認。curl -v telnet://example.com:443 でも', 'nc netcat ポート 疎通'),
      e('ネットワーク', 'Web の応答を確かめる', 'curl -I https://example.com\ncurl -sS -o /dev/null -w "%{http_code} %{time_total}\\n" https://example.com', '-I はヘッダだけ。-w でステータスと時間を表示', 'curl http ヘッダ 応答'),
      e('ネットワーク', 'API に POST する', "curl -X POST -H 'Content-Type: application/json' -d '{\"name\":\"yamada\"}' https://api.example.com/users", '-d で送るデータ、-H でヘッダ', 'curl post api json'),
      e('ネットワーク', '名前解決を調べる', 'dig example.com A +short\ndig -x 8.8.8.8 +short', '-x で逆引き。nslookup でも可', 'dig nslookup dns 名前解決'),
      e('ネットワーク', 'ファイルを転送する', 'scp report.pdf user@server:/tmp/\nrsync -avz --progress src/ user@server:/backup/src/', 'rsync は差分だけ送るので、2 回目以降が速い', 'scp rsync 転送 コピー'),
      e('ネットワーク', 'SSH の鍵を作って登録する', 'ssh-keygen -t ed25519\nssh-copy-id user@server', '以後はパスワードなしでログインできる', 'ssh ssh-keygen 鍵'),
      // ユーザーと権限
      e('ユーザーと権限', '権限を変える（数字）', 'chmod 644 index.html\nchmod 755 script.sh\nchmod 600 ~/.ssh/id_ed25519', 'r=4 w=2 x=1 を足して 所有者・グループ・その他 の順。秘密鍵は 600', 'chmod 権限 パーミッション'),
      e('ユーザーと権限', '持ち主を変える', 'sudo chown -R www-data:www-data /var/www/html', '-R でフォルダの中まで', 'chown 所有者'),
      e('ユーザーと権限', '自分のユーザーと所属グループ', 'id\nwhoami', 'sudo -l で使える sudo の範囲', 'id whoami ユーザー グループ'),
      e('ユーザーと権限', 'ユーザーを追加する', 'sudo useradd -m -s /bin/bash yamada\nsudo passwd yamada\nsudo usermod -aG sudo yamada', '-aG でグループに追加（-a を忘れると他のグループが外れる）', 'useradd usermod ユーザー追加'),
      e('ユーザーと権限', '危ない権限のファイルを探す（点検）', 'find / -perm -4000 -type f 2>/dev/null\nfind / -perm -o+w -type f 2>/dev/null', 'SUID が付いたもの、誰でも書き込めるもの', 'suid 点検 セキュリティ 権限'),
      // システム
      e('システム', 'ディスクの空き容量', 'df -h', '-h で読みやすい単位に', 'df ディスク 容量 空き'),
      e('システム', 'フォルダの大きさ', 'du -sh /var/log/* | sort -h', 'どこが容量を使っているかを調べる定番', 'du 容量 大きさ'),
      e('システム', 'メモリの使用量', 'free -h', 'available が実際に使える量', 'free メモリ'),
      e('システム', 'OS の種類と版', 'cat /etc/os-release\nuname -a', 'uname -r でカーネルの版', 'os バージョン uname'),
      e('システム', '起動からの時間と負荷', 'uptime', 'load average は直近 1・5・15 分の負荷', 'uptime 負荷 load average'),
      e('システム', 'パッケージを入れる', 'sudo apt update && sudo apt install -y nginx\nsudo dnf install -y nginx', 'Ubuntu / Debian は apt、RHEL / Rocky / Fedora は dnf', 'apt dnf yum インストール パッケージ'),
      e('システム', '環境変数を見る・設定する', 'echo "$PATH"\nexport APP_ENV=production', 'ずっと使うなら ~/.bashrc に書く', 'env 環境変数 export path'),
      // 圧縮
      e('圧縮', 'tar.gz にまとめる', 'tar czf backup.tar.gz dir/', 'c 作成、z gzip、f ファイル名', 'tar 圧縮 gz'),
      e('圧縮', 'tar.gz を展開する', 'tar xzf backup.tar.gz -C /tmp/restore', 'x 展開。-C で展開先。中身の一覧だけなら tzf', 'tar 展開 解凍'),
      e('圧縮', 'zip にまとめる・展開する', 'zip -r docs.zip docs/\nunzip docs.zip -d out/', 'unzip -l で中身の一覧', 'zip unzip 圧縮 解凍'),
      // 便利
      e('便利', '結果を画面とファイルの両方に出す', './check.sh | tee result.log', 'tee -a で追記', 'tee 出力 保存'),
      e('便利', 'エラーも含めてファイルに保存', 'make > build.log 2>&1', '2>&1 でエラー出力も同じ所へ', 'リダイレクト 2>&1 エラー 標準出力'),
      e('便利', '前のコマンドを探して使う', 'history | grep ssh\n# Ctrl+R で検索しながら呼び出し', '!123 で 123 番を再実行、!! で直前を再実行', 'history 履歴 ctrl+r'),
      e('便利', '一覧の 1 行ずつにコマンドを実行', "cat hosts.txt | xargs -I{} ping -c 1 {}\nfind . -name '*.log' -print0 | xargs -0 gzip", 'xargs で行を引数に変える。空白を含む名前は -print0 と -0', 'xargs 一括 繰り返し'),
      e('便利', '繰り返し実行して変化を見る', 'watch -n 2 "ss -tn | wc -l"', '2 秒ごとに実行して画面を更新', 'watch 監視 繰り返し'),
      e('便利', 'ファイルのハッシュを確かめる', 'sha256sum ubuntu.iso\nsha256sum -c SHA256SUMS', 'ダウンロードしたファイルが本物か確かめる', 'sha256sum md5sum ハッシュ 改ざん'),
    ],
  },
];

for (const d of DICTS) {
  const have = new Set(d.entries.map((x) => x.t));
  for (const x of MORE[d.id] || []) if (!have.has(x.t)) d.entries.push(x);
  for (const x of d.entries) if (!d.cats.includes(x.cat)) d.cats.push(x.cat);
}

DICTS.push(GIT_DICT);
DICTS.push(DOCKER_DICT);
