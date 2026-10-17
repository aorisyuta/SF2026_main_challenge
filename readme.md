# “融合” 大阪星光学院 SF 2026 公式サイト

大阪星光学院スクールフェア（SF）2026 の公式ウェブサイトです。
開催日：**2026年11月7日（土）・8日（日）** ／ テーマ：**融合**

**制作・運用: Aoristos**

---

## 何をどこで更新するか

| 更新したいもの | 場所 |
| --- | --- |
| ブログ記事 | Google スプレッドシート（`type` = `post`） |
| トップの「部誌発売中」「T シャツ発売中」などのお知らせとリンク | Google スプレッドシート（`type` = `news`） |
| X・Instagram などの SNS リンク | Google スプレッドシート（`type` = `link`） |
| 企画一覧 | `assets/projects.csv` |
| 企画の詳しい情報 | `assets/projects-details.json` |
| タイムテーブル | `timetable.html` |
| 開催日・テーマ・スプレッドシートの URL | `assets/config.js` |

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
| `image` | 画像の URL。Google ドライブの共有リンク（「リンクを知っている全員」が閲覧可）もそのまま使えます |
| `tags` | 記事のタグ。`お知らせ,販売` のようにカンマ区切り。最初のタグがカードの上に表示されます |
| `author` | 記事の筆者 |
| `style` | お知らせタイルの色。`light`（白）/ `dark`（黒）。空欄なら自動 |

`news` はシートの**上の行から順に**トップに並びます。`link` は X・Instagram・YouTube を自動判別してアイコンを付けます。

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
3. ページを生成します。CSV にない古いページは自動で削除されます。

   ```bash
   npm run generate
   ```

---

## 公開（Cloudflare）

リポジトリの `main` に push すると Cloudflare が自動でデプロイします（`npx wrangler deploy`）。

- 設定は `wrangler.jsonc`。このファイルがあるので、ビルド時の自動セットアップは行われません
- 公開しないファイル（`node_modules`・`readme.md`・`photo/` など）は `.assetsignore` に書きます
- 存在しない URL には `404.html` を表示します

## ローカルで動かす

`fetch` を使うため、ファイルを直接開かずローカルサーバー経由で開いてください。

```bash
npm start          # python3 -m http.server 8000
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

## 設計方針

- **デザイン**：余白と文字で見せる。影・グラデーション・絵文字は使わない。白・薄灰・黒の帯を交互に置く
- **モチーフ**：重なり合う二つの円（朱と藍）。重なった部分がテーマ「融合」
- **軽さ**：Web フォントなし（端末内蔵フォント）、外部ライブラリなし。スプレッドシートは1ページにつき1回だけ取得し、数分間ブラウザに保持
- **カウントダウン**：分が変わるときだけ更新し、タブが非表示のあいだは停止。開催中は「1日目 開催中」などに自動で切り替わる
- **アクセシビリティ**：キーボード操作、`prefers-reduced-motion` で動きを停止、見出し順の維持

---

## 未対応・TODO

- **SNS のアカウント**：スプレッドシートの `link` 行に本物の URL を入れてください
- **部誌・T シャツの購入リンク**：スプレッドシートの `news` 行の `url` を本物に差し替えてください
- **校内マップ PDF**：用意できたら `info.html` の `#map` にリンクを追加
- **タイムテーブル**：内容は暫定。確定次第 `timetable.html` を更新
- **企画の場所・時間**：`projects-details.json` の「準備中」を確定情報に更新
