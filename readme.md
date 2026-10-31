# Aoristos — 大阪星光学院 SF 2026「融合」出展企画ページ

Aoristos が大阪星光学院スクールフェア（SF）2026 に出展する企画の案内ページです（学校・SF の公式サイトではありません）。
開催日：**2026年11月7日（土）午後のみ・8日（日）**（両日 15:30 頃まで） ／ SF のテーマ：**融合**

**制作・運用: Aoristos**

---

## 何をどこで更新するか

| 更新したいもの | 場所 |
| --- | --- |
| ブログ記事 | Google スプレッドシート（`type` = `post`） |
| トップの「部誌発売中」「Tシャツ発売中」などのお知らせとリンク | Google スプレッドシート（`type` = `news`） |
| X・Instagram などの SNS リンク | Google スプレッドシート（`type` = `link`） |
| 企画一覧 | `assets/projects.csv` |
| 企画の詳しい情報 | `assets/projects-details.json` |
| タイムテーブル | `timetable.html` |
| 開催日・時間・スプレッドシートの URL | `assets/config.js` |

スプレッドシートを書き換えると、**サイトを再アップロードしなくても数分で反映**されます
（Google 側の公開キャッシュとブラウザのキャッシュで最大5分ほどかかります）。

---

## スプレッドシートの使い方

### 初回の準備

1. `templates/site-data-template.xlsx`（または `.csv`）を Google スプレッドシートに読み込みます。
   既存のシートに入れる場合は「ファイル → インポート → アップロード」で「現在のシートを置換」を選びます。
2. 「ファイル → 共有 → ウェブに公開」で、対象のシートを **カンマ区切り形式（.csv）** で公開します。
3. 表示された URL を `assets/config.js` の `sheetCsvUrl` に貼ります（設定済み）。

> テンプレートの `news` / `link` / `post` の行はサンプルです。URL やアカウント名を本物に書き換えるか、行を削除してください。

### 列の意味

1行目の見出しは変えないでください（日本語の見出し「種類」「タイトル」なども読み取れます）。

| 列 | 内容 |
| --- | --- |
| `type` | `post`＝ブログ記事 / `news`＝トップのお知らせ / `link`＝SNS などのリンク。`#` で始まる行はメモとして無視されます |
| `visible` | `FALSE` で非表示（下書き）。空欄なら表示 |
| `pin` | `news`：`TRUE` で全ページ上部の帯にも表示 ／ `post`：`TRUE` で一覧の先頭に固定 |
| `date` | `2026/10/20` や `2026/10/20 18:00`。`post` は**未来の日時にするとその時刻まで公開されません（予約投稿）** |
| `id` | 記事の URL になる半角英数字。`open-2026` なら `blog/post.html?id=open-2026`。公開後は変えない |
| `title` | 記事タイトル／お知らせの見出し（例「Aoristos 部誌、発売中。」）／サービス名（`X`、`Instagram`） |
| `text` | 記事の概要／お知らせの説明文／SNS のアカウント名（`@...`） |
| `body` | 記事本文（下の記法） |
| `url` | お知らせ・SNS のリンク先。サイト内のページは `projects/aorxc.html` のようにトップからの位置で書けます |
| `link_label` | お知らせのボタンの文字（例「購入する」「予約する」） |
| `image` | 画像の URL。Google ドライブの共有リンク（「リンクを知っている全員」が閲覧可）もそのまま使えます。`news` では `pdf` / `tshirt` と書くと内蔵のイラストを表示 |
| `tags` | 記事のタグ。`お知らせ,販売` のようにカンマ区切り。最初のタグがカードの上に表示されます |
| `author` | 記事の筆者 |
| `style` | お知らせタイルの色。`light`（白）/ `dark`（黒）。空欄なら自動 |

`news` はシートの**上の行から順に**トップに並びます。`news` の行が1つもないとき（シートが読めないときも）は、`assets/config.js` の `defaultNews`（部誌 PDF 版・Tシャツ）が表示されるので、トップの販売タイルが空になることはありません。`link` は X・Instagram・YouTube を自動判別してアイコンを付けます。

### 記事本文（`body`）の書き方

セル内の改行は **Alt + Enter**（Mac は **⌘ + Enter**）。HTML は書けません（安全のため）。

```
空行をはさむと段落が分かれます。

## 見出し
### 小見出し

- 箇条書き
1. 番号付きリスト
> 強調したい一文（引用）

**太字** や [リンクの文字](https://example.com) も使えます。
![写真の説明](画像のURL)

---（区切り線）
```

### 表示の確認

URL の末尾に `?data=local` を付けると、スプレッドシートの代わりに `templates/site-data-template.csv` を読み込みます（デザイン確認用）。
例：`index.html?data=local`

---

## 企画を追加する

1. `assets/projects.csv` に1行追加します。

   ```csv
   title,description,thumb,link,tags,tags2,tags3
   "企画名","説明文","","projects/newpage.html","Aoristos","体験","全年齢"
   ```

   - `tags` の1つ目（`Aoristos` / `電気工学部` / `物理部`）がカード上の分類名と色になります。色は `assets/style.css` の `--cat-a` などで定義しています。
   - 絞り込みボタンは CSV のタグから自動生成されます。
   - 企画一覧の説明は**最初から開いた状態**で表示されます。

2. 詳細を `assets/projects-details.json` に追加します。`id` はファイル名（`newpage`）と一致させてください。
   本文は `npm run build` で企画ページの HTML に書き出されます（検索エンジンが本文を読めるように）。
   表示時にも JSON から組み立て直すので、JSON だけ直しても画面には反映されますが、検索向けの本文を更新するため **JSON を直したら `npm run build`** してください。
3. ページを生成します。CSV にない古いページは自動で削除されます
   （このスクリプトが生成したページだけが対象。`projects/aoristos-bushi-pre.html` のような手書きの独立ページは消えません）。

   ```bash
   npm run generate
   ```

---

## 公開（Cloudflare Pages）

本番の URL は **<https://aoristos.net>**（`assets/config.js` の `siteUrl`）。
リポジトリの `main` に push すると Cloudflare Pages が自動でデプロイします。

### push する前に

HTML・企画・`siteUrl` を変えたら、必ず次を実行してから commit してください。

```bash
npm run build
```

`generate-pages.js`（企画ページの生成）に続いて `build-site.js` が次を行います。

| 出力 | 内容 |
| --- | --- |
| 各 HTML の `<!-- site-meta:start -->` 〜 `end` | canonical・OGP（`assets/og-image.jpg`、1200×630）・Twitter カード。**この間は手で書かない** |
| `robots.txt` / `sitemap.xml` | 検索エンジン向け。`noindex` のページ・404・`blog/post.html` は sitemap に入れない |
| `_headers` | セキュリティヘッダー（CSP・HSTS など）とキャッシュ設定。CSP で許可するインラインスクリプトは HTML から自動計算 |
| `dist/` | 公開するファイルだけのコピー（`.assetsignore` に書いたものを除外）。git には入れない |

> インラインの `<script>` を書き換えたのに `npm run build` を忘れると、CSP によってそのスクリプトが動かなくなります。

### Cloudflare Pages の設定（推奨）

ダッシュボードの「設定 → ビルド」で次のようにすると、`readme.md`・`templates/`・スクリプトなどの内部ファイルが公開されなくなります。

| 項目 | 値 |
| --- | --- |
| ビルドコマンド | `npm run build` |
| ビルド出力ディレクトリ | `dist` |

（出力ディレクトリがリポジトリ直下のままでも `_headers` などは効きますが、内部ファイルも公開されます。）

- 存在しない URL には `404.html` を表示します
- `projects.html` のような URL は Cloudflare が `/projects` に転送するため、canonical・sitemap は拡張子なしで書いています
- `wrangler.jsonc` / `.assetsignore` は Cloudflare Workers で公開する場合の設定です（`.assetsignore` は `dist/` の除外リストとしても使います）
- `?data=local`（サンプル CSV の表示）は localhost でだけ有効です

## ローカルで動かす

`fetch` を使うため、ファイルを直接開かずローカルサーバー経由で開いてください。

```bash
npm start          # python3 -m http.server 8000
npm run preview    # npm run build のあと dist/ を配信（本番と同じファイル構成で確認）
```

<http://localhost:8000> を開きます。

---

## ファイル構成

```
/
├── index.html              トップ
├── projects.html           企画一覧（検索・絞り込み）
├── timetable.html          タイムテーブル（AorXC・制作体験の実施時間）
├── info.html               来場案内（概要・アクセス・注意事項・FAQ）
├── blog.html               ブログ一覧
├── blog/post.html          ブログ記事（?id=記事ID）
├── projects/*.html         企画詳細（generate-pages.js で生成）
├── generate-pages.js       企画詳細ページの生成
├── build-site.js           canonical・OGP・sitemap・_headers・dist/ の生成
├── archive/                アーカイブ一覧・閲覧ページ（view.html）・過去のサイト（sf25/ = SF 2025）
├── tools/rebase_sf25.py    アーカイブ取り込み時のパス書き換え
├── _headers / robots.txt / sitemap.xml   build-site.js が生成
├── templates/
│   ├── site-data-template.csv   スプレッドシートのひな形
│   └── site-data-template.xlsx  同（書式つき）
└── assets/
    ├── config.js           サイト設定（開催日・テーマ・シート URL）
    ├── sheet.js            スプレッドシートの読み込み・本文の整形
    ├── header.js           ナビ・お知らせ帯・フッター
    ├── script.js           カウントダウン・タブ・企画一覧
    ├── home.js             トップのお知らせ・最新記事・SNS
    ├── blog.js             ブログ一覧と記事
    ├── project-detail.js   企画詳細
    ├── style.css           全体のスタイル
    ├── projects.csv / projects-details.json
    ├── favicon.svg / logo.svg
    └── blackboard-art*.webp
```

各ページの `<head>` では `config.js` を最初に（`defer` なしで）読み、その後 `sheet.js` → `header.js` → `script.js` の順に `defer` で読み込みます。

---

## アーカイブ（過去のサイト）

ナビの「アーカイブ」から、過去の SF のサイトを当時のまま見られます（<https://aoristos.net/archive/>）。
Wayback Machine のように、Aoristos のヘッダーと「ARCHIVE」バーの下に当時のサイトを埋め込んで表示します。

| パス | 内容 |
| --- | --- |
| `archive/index.html` | アーカイブ一覧（サイトごとのカードとボタン） |
| `archive/view.html?site=sf25` | 閲覧ページ。`&path=/info` で特定のページを開く。中で移動するとアドレスバーも追従するので、URL をそのまま共有できる |
| `archive/sf25/` | SF 2025 のサイト本体。[sonneko/sf25-site](https://github.com/sonneko/sf25-site) の `gh-pages` ブランチ（Next.js の静的書き出し、2025-11-02 ビルド）を取り込んだもの |
| `assets/archive-viewer.js` | 閲覧ページの動作。サイトを増やすときは `SITES` に1行追加 |
| `assets/archive-frame.js` | `archive/sf25/` を直接開いたとき、閲覧ページの中で開き直す（各 HTML の `<head>` に差し込み済み） |

`archive/sf25/` はビルド済みの別サイトなので、`build-site.js` は中身に手を加えません（canonical・CSP の自動計算・sitemap の対象外）。
Next.js のインラインスクリプトが動くよう、`_headers` で `/archive/sf25/*` だけ別の CSP を当てています。

ルート `/` 前提で書き出されたファイルを `/archive/sf25/` で動かすため、取り込み時に `tools/rebase_sf25.py` でパスを書き換えています
（あわせて `archive-frame.js` の差し込み、エラー報告の Google Apps Script への送信の無効化、旧ドメインの `sitemap.xml` の削除）。取り込み直す場合:

```bash
git clone --depth 1 -b gh-pages https://github.com/sonneko/sf25-site /tmp/sf25-out && rm -rf /tmp/sf25-out/.git
```

```bash
rm -rf archive/sf25 && cp -r /tmp/sf25-out archive/sf25 && python3 tools/rebase_sf25.py archive/sf25 /archive/sf25
```

---

## 設計方針

- **デザイン**：余白と文字で見せる。影・グラデーション・絵文字は使わない。白・薄灰・黒の帯を交互に置く
- **軽さ**：Web フォントなし（端末内蔵フォント）、外部ライブラリなし。スプレッドシートは1ページにつき1回だけ取得し、数分間ブラウザに保持
- **カウントダウン**：分が変わるときだけ更新し、タブが非表示のあいだは停止。開催中は「1日目 開催中」などに自動で切り替わる
- **アクセシビリティ**：キーボード操作、`prefers-reduced-motion` で動きを停止、見出し順の維持

---

## 未対応・TODO

- **SNS のアカウント**：スプレッドシートの `link` 行に本物の URL を入れてください
- **部誌・Tシャツの購入リンク**：スプレッドシートの `news` 行の `url` を本物に差し替えてください
- **校内マップ PDF**：用意できたら `info.html` の `#map` にリンクを追加
- **タイムテーブル**：内容は暫定。確定次第 `timetable.html` を更新
- **企画の場所・時間**：`projects-details.json` の「準備中」を確定情報に更新
