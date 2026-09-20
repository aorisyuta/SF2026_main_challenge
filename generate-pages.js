#!/usr/bin/env node
/*
  generate-pages.js — Aoristos / Osaka Seiko Gakuin SF 2026

  assets/projects.csv の link 列に書かれた企画ページ（projects/*.html）を生成する。
  本文は projects/<id>.html を開いたときに assets/project-detail.js が
  assets/projects-details.json から組み立てるため、ここでは共通の器だけを出力する。

  エコ方針:
    - 外部 npm パッケージに依存しない（csv-parser / fs-extra を廃止）
    - 既存ファイルは上書きしない（--force で明示的に上書き）

  使い方:
    npm run generate          既存ファイルを残したまま不足分だけ生成
    npm run generate -- --force   すべて再生成
*/

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const CSV_PATH = path.join(ROOT, 'assets', 'projects.csv');
const OUTPUT_DIR = path.join(ROOT, 'projects');
const FORCE = process.argv.includes('--force');

/** RFC4180 相当の最小 CSV パーサ（引用符とエスケープ済み引用符に対応） */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') { inQuotes = true; }
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') { field += c; }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  const nonEmpty = rows.filter(r => r.some(v => v.trim() !== ''));
  if (!nonEmpty.length) return [];

  const header = nonEmpty.shift().map(h => h.trim());
  return nonEmpty.map(cols => {
    const o = {};
    header.forEach((h, i) => { o[h] = (cols[i] || '').trim(); });
    return o;
  });
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pageTemplate(project) {
  const title = escapeHtml(project.title);
  const description = escapeHtml(project.description);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — “BE SEIKO” 大阪星光学院 SF 2026</title>
  <meta name="description" content="${description}">
  <meta name="author" content="Aoristos">
  <meta name="theme-color" content="#3a5129">
  <link rel="icon" href="../assets/logo.svg" type="image/svg+xml">
  <link rel="stylesheet" href="../assets/style.css">
  <script>
    window.pageConfig = {
      title: '${title.replace(/'/g, "\\'")} — “BE SEIKO” 大阪星光学院 SF 2026',
      pageTitle: '企画紹介',
      pageSubtitle: '企画の詳しい情報',
      currentPage: 'projects',
      basePath: '../'
    };
  </script>
  <script src="../assets/header.js" defer></script>
  <script src="../assets/script.js" defer></script>
  <script src="../assets/project-detail.js" defer></script>
</head>
<body>

<main id="main">
  <a href="../projects.html" class="back-link">← 企画一覧に戻る</a>

  <article id="projectDetail" class="card">
    <!-- 本文は assets/projects-details.json から生成されます -->
    <h1>${title}</h1>
    <p class="muted">${description}</p>
  </article>
</main>

<footer>
  <div class="footer-inner">
    <p>© <span id="currentYear">2026</span> Aoristos</p>
    <nav class="footer-nav" aria-label="フッターナビゲーション">
      <a href="../projects.html">企画紹介</a>
      <a href="../timetable.html">タイムテーブル</a>
      <a href="../info.html">インフォ</a>
      <a href="../blog.html">ブログ</a>
    </nav>
    <p class="site-credit">Produced by <a href="https://www.instagram.com/your_account" target="_blank" rel="noopener noreferrer">Aoristos</a></p>
    <div class="footer-social">
      <a href="https://www.instagram.com/your_account" target="_blank" rel="noopener noreferrer" class="social-link" title="Instagram">
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="5" fill="currentColor"/>
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" fill="#fff"/>
          <circle cx="17.5" cy="6.5" r="1" fill="#fff"/>
        </svg>
        <span class="skip-link">Instagram</span>
      </a>
    </div>
  </div>
</footer>

</body>
</html>
`;
}

function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error('assets/projects.csv が見つかりません');
    process.exit(1);
  }

  const projects = parseCSV(fs.readFileSync(CSV_PATH, 'utf8')).filter(p => p.title && p.link);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let created = 0;
  let skipped = 0;

  for (const project of projects) {
    // link は "projects/electric.html" 形式
    const fileName = path.basename(project.link);
    const outputPath = path.join(OUTPUT_DIR, fileName);

    if (fs.existsSync(outputPath) && !FORCE) {
      console.log(`スキップ（既存）: projects/${fileName}`);
      skipped++;
      continue;
    }

    fs.writeFileSync(outputPath, pageTemplate(project), 'utf8');
    console.log(`生成: projects/${fileName}`);
    created++;
  }

  console.log(`\n完了: ${created} 件生成 / ${skipped} 件スキップ`);
  if (skipped && !FORCE) console.log('すべて作り直すには: npm run generate -- --force');
}

main();
