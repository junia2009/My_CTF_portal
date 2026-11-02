# My_CTF_portal

社内CTF向けのツールポータルです。HTML + JavaScript だけで動く静的サイトなので、GitHub Pages でそのまま公開できます。
入力した内容はすべてブラウザ内で処理され、外部には送信されません。

## 機能

| 分類 | ツール | 内容 |
| --- | --- | --- |
| 変換 | エンコード / デコード | Base64 / Base32 / Hex / 2進 / 10進 / URL / HTML エンティティ / Unicode エスケープ / ROT13 / ROT47 / Atbash / 反転 など。変換を順番につなげる「レシピ」機能つき |
| 変換 | 基数変換 | 10進・16進・8進・2進・ASCII の相互変換、文字列 → 整数 |
| 暗号 | 古典暗号 | シーザー全シフト（英文らしい順に強調）、ROT47、Atbash、Vigenère、文字の出現頻度グラフ |
| 暗号 | XOR | 任意鍵での XOR、1バイト鍵の総当たり（フラグらしい候補を優先表示） |
| ハッシュ・データ | ハッシュ | MD5 / SHA-1 / SHA-256 / SHA-384 / SHA-512 の計算、ハッシュ形式の推定 |
| ハッシュ・データ | JWT デコード | ヘッダ・ペイロードの表示（署名検証はしない） |
| ハッシュ・データ | フラグ検索 | `flag{...}` 形式をそのまま・各種デコード後・シーザー全シフト後の文字列から探す |
| 競技の補助 | 問題メモ・フラグ記録 | ジャンル・配点・状態・フラグ・メモを記録（ブラウザ内保存、JSON でエクスポート / インポート） |
| 競技の補助 | チートシート | MISC / WEB / CRYPT / NW / REVERSING / OSINT / FORENSIC / DEFENSE / CONFIG 別の定番コマンド集 |

## GitHub Pages での公開

GitHub Actions（`.github/workflows/pages.yml`）で自動公開します。

1. このリポジトリの **Settings → Pages** を開き、**Build and deployment** の Source を「**GitHub Actions**」にする（最初の1回だけ）
2. `main` ブランチに push すると、テスト → 公開が自動で実行されます
   - **Actions** タブの「Deploy to GitHub Pages」から「Run workflow」で手動実行もできます
3. 公開先: `https://<ユーザー名>.github.io/My_CTF_portal/`

テストが失敗した場合は公開されません。公開されるのは `index.html` / `css` / `js` だけで、テストや README は含まれません。

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
css/style.css       スタイル（ライト / ダーク対応）
js/app.js           画面の動作
js/lib/             変換・暗号・ハッシュなどの処理（画面に依存しない関数）
js/data/genres.js   ジャンル定義とチートシートのデータ
tests/run.mjs       処理部分のテスト
```

チートシートの項目は `js/data/genres.js` を編集すれば追加できます。
