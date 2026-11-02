# My_CTF_portal

社内CTF向けのツールポータルです。HTML + JavaScript だけで動く静的サイトなので、GitHub Pages でそのまま公開できます。
入力した内容はすべてブラウザ内で処理され、外部には送信されません。

## 機能

| 分類 | ツール | 内容 |
| --- | --- | --- |
| 変換 | エンコード / デコード | **Magic（自動解析）** で多重エンコードを自動で剥がす。Base64 / 32 / 58 / 85・Hex・2進・10進・URL・HTML・Unicode・モールス・gzip / zlib・XOR・シーザーなどをレシピでつなげて実行（バイナリも壊れない）。ファイル読み込み・出力の保存に対応 |
| 変換 | 基数変換 | 10進・16進・8進・2進・ASCII の相互変換、文字列 → 整数 |
| 暗号 | 古典暗号 | シーザー全シフト、ROT47 / Atbash、**Vigenère 自動解読**（IoC で鍵長推定）、Affine 総当たり、Rail Fence 総当たり、**換字式の手動解読表**、頻度分析と IoC による暗号の種類の推定 |
| 暗号 | XOR | 鍵指定、1バイト総当たり、**繰り返し鍵の自動解読**（ハミング距離で鍵長推定）、**既知平文（flag{ など）から鍵を推定** |
| 暗号 | RSA | p / q / d からの復号に加え、n が素数・小さい素因数・Wiener 攻撃・Fermat 法・小さい e を自動で試す |
| 解析 | ファイル解析 | 形式判定（拡張子偽装の検出）、ハッシュ、エントロピー分布、**埋め込みファイルの検出と切り出し**、**末尾の余分なデータの検出**、PNG チャンク解析と **CRC からの幅・高さ復元**、文字列抽出（UTF-16 対応）、16進ダンプ |
| 解析 | ハッシュ | CRC32 / MD5 / SHA-1 / SHA-256 / SHA-384 / SHA-512 の計算、ハッシュ形式の推定 |
| 解析 | JWT デコード | ヘッダ・ペイロードの表示と注意点の指摘（署名検証はしない） |
| 解析 | フラグ検索 | `flag{...}` 形式をそのまま・各種デコード後・シーザー全シフト後の文字列から探す |
| 解析 | ネットワーク・時刻 | IPv4 / CIDR 計算、UNIX 時間・Windows FILETIME・日時文字列の相互変換 |
| 競技の補助 | 問題メモ・フラグ記録 | ジャンル・配点・状態・フラグ・メモを記録（ブラウザ内保存、JSON でエクスポート / インポート） |
| 競技の補助 | チートシート | MISC / WEB / CRYPT / NW / REVERSING / OSINT / FORENSIC / DEFENSE / CONFIG 別の定番コマンド集 |

## アプリとしてインストール（PWA）

ホーム画面やデスクトップにインストールでき、**一度開けばオフラインでも全ツールが動きます**（会場のネットワークが不安定でも使えます）。

- **PC（Chrome / Edge）**：右上の「INSTALL」ボタン、またはアドレスバーのインストールアイコン
- **Android（Chrome）**：メニュー →「ホーム画面に追加」/「アプリをインストール」
- **iPhone / iPad（Safari）**：共有ボタン →「ホーム画面に追加」

新しいバージョンを公開すると、画面下に「新しいバージョンがあります」と表示されます。「更新する」を押すと切り替わります。

仕組み：デプロイ時に `scripts/build-sw.mjs` が公開ファイルの一覧とビルドID（コミットSHA）を `sw.js` に埋め込みます。ローカル開発時（ビルドID が `dev`）はネットワーク優先で動くので、キャッシュに邪魔されずに編集を確認できます。

## GitHub Pages での公開

GitHub Actions（`.github/workflows/pages.yml`）で自動公開します。

1. このリポジトリの **Settings → Pages** を開き、**Build and deployment** の Source を「**GitHub Actions**」にする（最初の1回だけ）
2. `main` ブランチに push すると、テスト → 公開が自動で実行されます
   - **Actions** タブの「Deploy to GitHub Pages」から「Run workflow」で手動実行もできます
3. 公開先: `https://<ユーザー名>.github.io/My_CTF_portal/`

テストが失敗した場合は公開されません。公開されるのは `index.html` / `manifest.webmanifest` / `sw.js` / `css` / `js` / `icons` だけで、テストや README は含まれません。

## ローカルで動かす

ES Modules を使っているため、`index.html` を直接開くのではなく簡易サーバー経由で開いてください。

```sh
python3 -m http.server 8000
# http://localhost:8000 を開く
```

## テスト

```sh
node tests/run.mjs
```

## 構成

```
index.html          画面
manifest.webmanifest / sw.js / icons/   PWA（インストール・オフライン対応）
scripts/build-sw.mjs  デプロイ時に Service Worker へキャッシュ対象を埋め込む
css/style.css       スタイル（ライト / ダーク対応）
js/app.js           起動とページ切り替え
js/ui/              各画面の動作
js/lib/             変換・暗号・ファイル解析などの処理（画面に依存しない関数）
js/data/genres.js   ジャンル定義とチートシートのデータ
tests/run.mjs       処理部分のテスト
```

チートシートの項目は `js/data/genres.js` を編集すれば追加できます。
