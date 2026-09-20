# “BE SEIKO” 大阪星光学院 SF 2026 公式サイト

大阪星光学院スクールフェア（SF）2026 の公式ウェブサイトです。企画紹介、タイムテーブル、来場案内、ブログを提供します。

**制作・運用: Aoristos**

---

## 設計方針（エコ）

通信量・端末の消費電力・運用の手間を減らすことを優先しています。

| 項目 | 方針 |
| --- | --- |
| Webフォント | 使わない。端末内蔵の日本語フォントを使用（`assets/style.css` の `font-family`） |
| 外部CDN | 使わない。JavaScript はすべて `assets/` 内の自前ファイル |
| 画像 | WebP・複数解像度・`loading="lazy"`。存在しない画像は参照しない |
| 地図 | Google マップは利用者がボタンを押したときだけ読み込む（初期表示では外部通信ゼロ） |
| カウントダウン | 1秒ごとではなく1分ごとに更新。タブが非表示のあいだは停止 |
| 描画 | カードに `content-visibility: auto` を指定し、画面外の描画を省略 |
| アニメーション | 最小限。`prefers-reduced-motion` で停止 |

新しく何かを足すときは、**外部ドメインへのリクエストを増やさない**ことを最初に確認してください。

---

## 技術スタック

- 素の HTML / CSS / JavaScript（ビルド不要・npm 依存なし）
- ヘッダーは `assets/header.js` で全ページ共通生成
- データ
  - 企画一覧: `assets/projects.csv`
  - 企画詳細: `assets/projects-details.json`
  - ブログ: `blog/blog-data.json`

## ローカルで動かす

`fetch` を使うため、ファイルを直接開く（`file://`）のではなくローカルサーバー経由で開いてください。

```bash
npm start          # python3 -m http.server 8000
# または
python3 -m http.server 8000
```

ブラウザで <http://localhost:8000> を開きます。

---

## ファイル構成

```
/
├── index.html              トップページ
├── projects.html           企画紹介（一覧・検索・絞り込み）
├── timetable.html          タイムテーブル
├── info.html               インフォメーション（開催概要・アクセス・FAQ）
├── blog.html               ブログ一覧
├── blog-admin.html         運営用: 記事JSONの作成フォーム（noindex）
├── generate-pages.js       企画詳細ページの生成スクリプト
├── blog/
│   ├── post.html           記事表示ページ（?id=記事ID）
│   ├── blog-data.json      記事データ（これが正）
│   └── sample-post*.html   旧・静的記事ページ（現在リンクなし）
├── projects/
│   └── *.html              企画詳細ページ（generate-pages.js で生成）
├── assets/
│   ├── style.css           全体のスタイル
│   ├── script.js           共通スクリプト（ナビ・タブ・地図・企画一覧）
│   ├── header.js           共通ヘッダー生成
│   ├── blog.js             ブログ一覧と記事本文の生成
│   ├── project-detail.js   企画詳細の生成
│   ├── projects.csv        企画一覧データ
│   ├── projects-details.json  企画詳細データ
│   ├── logo.svg            Aoristos ロゴ
│   └── blackboard-art*.webp  黒板アート写真（1280px / 640px）
└── photo/
    ├── logo.svg            ロゴ原本
    └── blackboard_art.png  写真の原本（2.2MB。公開用には使わない）
```

> `photo/` は原本置き場です。**サイトから参照しているのは `assets/` 内の軽量版だけ**なので、公開時に `photo/` をアップロードする必要はありません。

---

## 更新のしかた

### 1. ページ共通のヘッダー

各ページの `<head>` で `window.pageConfig` を定義してから `header.js` を `defer` で読み込みます。

```html
<script>
  window.pageConfig = {
    title: 'ブラウザのタブに出るタイトル',
    pageTitle: 'ヘッダーの大見出し',
    pageSubtitle: 'ヘッダーの小見出し',
    currentPage: 'projects',   // index / projects / timetable / info / blog
    basePath: '',              // サブフォルダ内のページは '../'
    showMapLink: true          // ヘッダー右上の「校内マップ」を出すか
  };
</script>
<script src="assets/header.js" defer></script>
<script src="assets/script.js" defer></script>
```

- `<body>` 直下に手書きの `<header>` や `<nav>` を置かないでください（二重になります）。
- サイト名・Instagram の URL・開催日表記は `assets/header.js` 冒頭の `SITE` オブジェクトにまとまっています。ここを直せば全ページに反映されます。

### 2. 企画を追加する

1. `assets/projects.csv` に1行追加します。

   ```csv
   title,description,thumb,link,tags,tags2,tags3
   "企画名","説明文","","projects/newpage.html","Aoristos","タグ2","タグ3"
   ```

   - `thumb` は**画像があるときだけ**パスを書きます。空にしておけばカテゴリ色の帯が表示され、画像リクエストは発生しません。
   - `tags` の1つ目（`Aoristos` / `電気工学部`）がカードの色になります。色は `assets/style.css` の `.project-accent[data-category=...]` で定義しています。
   - 絞り込みボタンは CSV のタグから自動生成されます。

2. 詳細情報を `assets/projects-details.json` に追加します。`id` はファイル名（`newpage`）と一致させてください。

3. 詳細ページの器を生成します。

   ```bash
   npm run generate                # 既存ファイルは残したまま不足分だけ生成
   npm run generate -- --force     # すべて作り直す（手を入れた内容は消えます）
   ```

### 3. ブログ記事を追加する

1. `blog-admin.html` をブラウザで開き、フォームに入力して JSON を生成・コピーします。
2. `blog/blog-data.json` の配列に貼り付けます。
3. 記事は `blog/post.html?id=記事ID` で表示されます。専用の HTML ファイルを作る必要はありません。

`content` はそのまま HTML として表示されます。運営が書いた内容だけを入れてください。

### 4. 画像を追加する

そのまま置かず、必ず縮小・WebP 化してから `assets/` に入れます。

```bash
magick 元画像.png -resize 1280x720 -strip -quality 78 assets/名前.webp
magick 元画像.png -resize 640x360  -strip -quality 70 assets/名前-640.webp
```

HTML 側では `width` / `height` / `loading="lazy"` / `alt` を必ず付けます。

```html
<img src="assets/名前.webp"
     srcset="assets/名前-640.webp 640w, assets/名前.webp 1280w"
     sizes="(max-width: 720px) 100vw, 720px"
     width="1280" height="720" alt="内容の説明" loading="lazy" decoding="async">
```

---

## 未対応・TODO

- **公式 Instagram の URL**: 全ページで `https://www.instagram.com/your_account` のままです。`assets/header.js` の `SITE.instagram` と各 HTML のフッターを実 URL に置き換えてください。
- **校内マップ PDF**: `assets/map.pdf` は未配置です。用意できたら `info.html` の `#map` セクションにダウンロードリンクを追加してください。
- **タイムテーブル**: `timetable.html` の内容は暫定です。確定次第更新してください。
- **企画サムネイル**: 現在は全企画が画像なし（カテゴリ色の帯）です。写真を用意したら上記の手順で WebP 化し、CSV の `thumb` 列に入れてください。
- **`blog/sample-post*.html`**: `blog-data.json` と内容が重複する旧ページで、どこからもリンクされていません。不要なら削除して構いません。

---

## アクセシビリティで守ること

- 見出しは `h1` → `h2` → `h3` の順に飛ばさない
- 画像には必ず `alt`（装飾目的なら `alt=""`）
- フォーム項目には `label`
- 色だけで情報を伝えない
- キーボードだけで操作できること（メニューは Esc で閉じます）

## 連絡先

SF運営委員会 ／ サイトに関するご連絡は Aoristos まで。
