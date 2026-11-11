# Aoristos 公式サイト — 大阪星光学院の探究団体

Aoristos の公式サイトです。Aoristos は大阪星光学院の生徒による探究団体で、メンバーそれぞれが自分の探究課題を見つけて活動しています。大阪星光学院スクールフェア（SF）2026 への出展はその活動のひとつで、関連ページは「SF2026」の下にまとめています（学校・SF 全体の公式サイトではありません）。

### サイトの構成

- **全体ナビ**（`assets/header.js` の `NAV`）：Aoristos とは（`about.html`）／ ブログ ／ ゲーム ／ アーカイブ（SF2026 のページはアーカイブの中として扱う）
- **SF2026 のサブナビ**（同 `SF_NAV`）：SF2026 トップ（`sf.html`）／ Aoristos の企画（`projects.html`）／ タイムテーブル ／ 他の企画 ／ 来場案内。サブナビの左端は「アーカイブ / SF2026「融合」」。`pageConfig.currentPage` が `SF_NAV` のどれかのページ（企画の詳細ページ＝`projects` を含む）では、ヘッダーの下にサブナビが出て、全体ナビの「アーカイブ」が選択状態になる
- URL は以前のまま（SEO のため変更しない）
- SF2026 は 2026年11月8日に終了。SF のページ（サブナビのあるページ）には、`assets/config.js` の `days` の最終日の終了時刻を過ぎると「SF2026「融合」は終了しました」の帯が自動で出る（`assets/header.js` の `endedNote()`）。トップの SF の帯は「これまでの活動」、アーカイブ（`archive/index.html`）に SF 2026 のカードを追加済み

SF2026 開催日：**2026年11月7日（土）午後のみ・8日（日）**（両日 15:30 頃まで） ／ SF のテーマ：**融合**

**制作・運用: Aoristos**

---

## 何をどこで更新するか

| 更新したいもの | 場所 |
| --- | --- |
| ブログ記事 | Google スプレッドシート（`type` = `post`） |
| グッズのページ（`goods.html`）の「部誌発売中」「Tシャツ発売中」などと、各ページの右側・下部に出るグッズの枠 | Google スプレッドシート（`type` = `news`） |
| X・Instagram などの SNS リンク | `assets/config.js` の `fallbackLinks`（スプレッドシートに `type` = `link` の行があればそちらが優先） |
| 企画一覧 | `assets/projects.csv` |
| 他の企画（SF 全体の企画・ステージ・校内マップ） | `assets/others-data.json`（`npm run build` で `others.html`・`others-list.html` を生成） |
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
| `type` | `post`＝ブログ記事 / `news`＝グッズ（`goods.html` と、各ページの右側・下部のグッズの枠） / `link`＝SNS などのリンク。`#` で始まる行はメモとして無視されます |
| `visible` | `FALSE` で非表示（下書き）。空欄なら表示 |
| `pin` | `post`：`TRUE` で一覧の先頭に固定（`news` では使わない） |
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
| `style` | グッズのタイルの色。`light`（白）/ `dark`（黒）。空欄なら自動 |

`news` はシートの**上の行から順に**グッズのページに並びます。`name`（短い名前）・`note`（一言）の列を足すと、グッズの枠での表示に使われます。`news` の行が1つもないとき（シートが読めないときも）は、`assets/config.js` の `defaultNews`（部誌 PDF 版・Tシャツ）が表示されるので、グッズのページが空になることはありません。`link` は X・Instagram・YouTube を自動判別してアイコンを付けます。

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

## 公開（Cloudflare Workers）

本番の URL は **<https://aoristos.net>**（`assets/config.js` の `siteUrl`）。
Cloudflare Workers の静的アセット機能で公開しています（プロジェクト名 `sf2026-main-challenge`、設定は `wrangler.jsonc`）。
リポジトリの `main` に push すると Workers Builds が自動でデプロイします（`npx wrangler deploy`）。

### push する前に

HTML・企画・`siteUrl` を変えたら、必ず次を実行してから commit してください。

```bash
npm run build
```

`generate-pages.js`（企画ページの生成）に続いて `build-site.js` が次を行います。

| 出力 | 内容 |
| --- | --- |
| 各 HTML の `<!-- site-meta:start -->` 〜 `end` | canonical・OGP・Twitter カード・構造化データ（トップのみ）。**この間は手で書かない** |
| CSS・JS の `?v=...` | 中身のハッシュ。更新したら URL が変わり、古いキャッシュが使われない |
| `robots.txt` / `sitemap.xml` | 検索エンジン向け。`noindex` のページ・404・`blog/post.html` は sitemap に入れない |
| `_headers` | セキュリティヘッダー（CSP・HSTS など）とキャッシュ設定。CSP で許可するインラインスクリプトは HTML から自動計算 |
| `dist/` | 公開されるファイルだけのコピー（`npm run preview` での確認用）。git には入れない |

> インラインの `<script>` を書き換えたのに `npm run build` を忘れると、CSP によってそのスクリプトが動かなくなります。

### 公開されるファイル

リポジトリ直下（`wrangler.jsonc` の `assets.directory`）がそのまま公開されます。
`readme.md`・`templates/`・`tools/`・ビルド用スクリプトなど、公開しないものは `.assetsignore` に書きます。

- 存在しない URL には `404.html` を表示します（`not_found_handling: "404-page"`）
- `projects.html` のような URL は Cloudflare が `/projects` に転送するため、canonical・sitemap は拡張子なしで書いています
- `_headers` は Workers の静的アセットでもそのまま使われます
- `?data=local`（サンプル CSV の表示）は localhost でだけ有効です

### Cloudflare のダッシュボードで設定するもの

| 内容 | 場所 |
| --- | --- |
| 旧 URL `sf.aoristos.net` → `aoristos.net` の転送（301） | aoristos.net のドメイン → ルール → リダイレクトルール |
| アクセス解析（訪問者数・ページ別・流入元） | Analytics & Logs → Web Analytics → サイトを追加（CSP は許可済み） |
| 検索エンジン | Google Search Console・Bing Webmaster Tools（サイトマップ `https://aoristos.net/sitemap.xml`） |

転送を Worker のコードで書くこともできますが、全リクエストで Worker が動いて無料枠（1日10万回）を使い、
超えるとサイトが止まるため、制限のないリダイレクトルールを使います。

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
├── index.html              トップ（Aoristos の紹介・活動・いまの活動として SF2026）
├── about.html              Aoristos とは（団体の説明・活動のしかた・主な活動）
├── members.html            メンバー一覧（カードを足すとメンバーが増える）
├── goods.html              グッズ（部誌・Tシャツなど。シートの type = news）
├── sodpion/                メンバー sodpion のページ（introduce.html＝プロフィール。自作の小説・問題などもこの中に置く）
├── sf.html                 SF2026 トップ（出展案内・企画カード・開催概要）
├── projects.html           Aoristos の企画（SF2026）
├── timetable.html          タイムテーブル（AorXC・制作体験の実施時間）
├── info.html               来場案内（概要・アクセス・注意事項・FAQ）
├── others.html             他の企画の概要（基本情報・図・ステージの時間割。tools/build-others.js が生成）
├── others-list.html        他の企画の一覧（校内マップ・検索・絞り込み。同上）
├── games/                  ゲーム（index.html＝一覧、integral-reels.html＝積分リール、make-it.html＝数字をつくれ）
├── blog.html               ブログ一覧
├── blog/post.html          ブログ記事（?id=記事ID）
├── projects/*.html         企画詳細（generate-pages.js で生成）
├── generate-pages.js       企画詳細ページの生成
├── build-site.js           canonical・OGP・sitemap・_headers・dist/ の生成
├── archive/                アーカイブ一覧・閲覧ページ（view.html）・過去のサイト（sf25/ = SF 2025）
├── tools/rebase_sf25.py    アーカイブ取り込み時のパス書き換え
├── tools/build-others.js   others.html の生成
├── _headers / robots.txt / sitemap.xml   build-site.js が生成
├── apple-touch-icon*.png   iPhone などがルートに取りに来るアイコン（assets/ のコピー）
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

## 他の企画（others.html / others-list.html）


SF 公式サイト（<https://seikosf.jp>）の企画・ステージ・校内マップの情報を、Aoristos のサイト向けにまとめ直したページです。
`others.html` が概要（基本情報・図・ステージ）、`others-list.html` が企画一覧（校内マップ・検索・絞り込み）。
データは `assets/others-data.json`（企画の説明は短く言い換え、個人的なコメントは除いています）。

- `booths`：企画（`floor` 階 / `place` 場所 / `desc` 説明 / `price` 値段 / `tags` 種類 / `kana` 検索用の読み・別名）
- `booths[].rooms`：部屋の ID（校内マップで色を付け、押すと絞り込む）
- `stage.slots`：ステージの時間割（日・会場・開始・終了・出演）、`stage.acts`：出演者の紹介
- `map.floors`：校内マップ（図面 `assets/sfmap/maps-0N.svg` と、部屋の形・名前。SF 公式サイトの校内マップより）
- 一覧ページは `?floor=3`・`?tag=飲食`・`?room=sr3` で絞り込んだ状態で開けます
- 概要ページの「いまのステージ」は `assets/others-top.js` が時間割と現在時刻（日本時間）から自動で表示します
- このデータのページは、見た目より見やすさ・使いやすさを優先しています（検索を先頭に、詰めた一覧、並び替え、開閉式の地図）
- 書き換えたら `npm run build`。図（階ごとの企画数・種類別・1日の流れ・ステージ時間割）も自動で作り直されます
- 時間や内容が変わったら公式サイトに合わせて直し、`retrieved`（取得日）も更新してください

---

## SF2026 トップの動画

`sf.html` のヒーロー（タイトル・リンクの下）に YouTube 動画を載せる枠があります。設定は `assets/config.js` の `sfVideo`。

- `show: false` のあいだは表示されません。`true` にして `npm run build` → push で公開
- 公開前の確認は `sf.html?video=preview`
- 最初はサムネイルだけを表示し、押したときに YouTube（プライバシー強化モード `youtube-nocookie.com`）を読み込みます
- 動画を差し替えるときは `id`（URL の `watch?v=` の後ろ）を変更

## ゲーム（games/）

ナビの「ゲーム」から。`games/index.html` が一覧、`games/integral-reels.html` が「積分リール」、`games/make-it.html` が「数字をつくれ」（`assets/games/make-it.js` / `make-it.css`）。

| ファイル | 内容 |
| --- | --- |
| `assets/games/integral-reels.js` | ゲーム本体（式エンジン・厳密計算・問題生成・画面）。元のファイルから AI 解説（Claude アーティファクト専用）を外したもの |
| `assets/games/integral-reels.css` | サイトに合わせた見た目。サイトの CSS とぶつからないよう `#app` の中に閉じている |
| `assets/games/mathjax-config.js` | MathJax の設定（`tex-svg.js` より前に読む） |
| `assets/vendor/mathjax/tex-svg.js` | MathJax 3.2.2（CSP で外部スクリプトを止めているのでサイト内に置いている。ライセンスは同じフォルダの LICENSE） |

ゲームを追加するときは `games/` にページを作り、`games/index.html` にカードを足します。

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

- **部誌・Tシャツの購入リンク**：スプレッドシートの `news` 行の `url` を本物に差し替えてください
- **校内マップ PDF**：用意できたら `info.html` の `#map` にリンクを追加
- **タイムテーブル**：内容は暫定。確定次第 `timetable.html` を更新
- **企画の場所・時間**：`projects-details.json` の「準備中」を確定情報に更新
