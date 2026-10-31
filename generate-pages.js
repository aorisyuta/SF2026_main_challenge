#!/usr/bin/env node
/*
  generate-pages.js — Aoristos / Osaka Seiko Gakuin SF2026

  assets/projects.csv の link 列に書かれた企画ページ（projects/*.html）を生成する。
  本文は assets/projects-details.json から HTML に書き出す（検索エンジン向け）。
  表示時には assets/project-detail.js が同じ JSON から組み立て直すので、
  JSON だけ直してビルドを忘れても画面上は最新になる（検索エンジン向けの本文だけ古くなる）。

  エコ方針:
    - 外部 npm パッケージに依存しない（csv-parser / fs-extra を廃止）
    - ページは本文を持たない「器」なので、常にテンプレートと同じ内容に揃える

  使い方:
    npm run generate   CSV に合わせて projects/*.html を作成・更新し、CSV にないページを削除
    npm run build      上に加えて build-site.js（canonical・OGP・sitemap・_headers・dist/）も実行
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

const DETAILS_PATH = path.join(ROOT, 'assets', 'projects-details.json');
const CATEGORY_CLASS = { 'Aoristos': 'cat-a', '電気工学部': 'cat-b', '物理部': 'cat-c' };  // script.js と同じ
const EVENT_LABEL = '星光 SF2026（大阪星光学院 スクールフェア 2026「融合」）';

function loadDetails() {
  if (!fs.existsSync(DETAILS_PATH)) return {};
  const map = {};
  for (const p of (JSON.parse(fs.readFileSync(DETAILS_PATH, 'utf8')).projects || [])) map[p.id] = p;
  return map;
}

/**
 * 企画ページの本文。assets/project-detail.js の render() と同じ HTML を書き出す
 * （検索エンジンが JavaScript を実行しなくても本文を読めるように）。
 * 表示時には project-detail.js が JSON から組み立て直すので、内容は常に最新になる。
 */
function detailBody(project, d) {
  const title = escapeHtml(project.title);
  if (!d) {
    return `    <header class="page-hero page-hero-left">
      <div class="container">
        <h1 class="page-title">${title}</h1>
        <p class="page-lead">${escapeHtml(project.description)}</p>
      </div>
    </header>`;
  }
  const cat = d.category ? (CATEGORY_CLASS[d.category] || 'cat-x') : '';
  const row = (label, value) => value ? `\n          <div class="spec-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>` : '';
  const rows = row('場所', d.location) + row('時間', d.schedule) + row('所要時間', d.duration) +
    (d.details || []).map(x => row(x.label, x.content)).join('') + row('イベント', EVENT_LABEL);

  return `    <header class="page-hero page-hero-left">
      <div class="container${cat ? ' ' + cat : ''}">${d.category ? `
        <p class="eyebrow ${cat}">${escapeHtml(d.category)}</p>` : ''}
        <h1 class="page-title">${escapeHtml(d.title || project.title)}</h1>${d.description ? `
        <p class="page-lead">${escapeHtml(d.description)}</p>` : ''}
      </div>
    </header>
    <div class="container detail-body">${d.thumb ? `
      <figure class="detail-figure"><img src="../${escapeHtml(d.thumb)}" alt="" decoding="async"></figure>` : ''}${d.fullDescription ? `
      <section class="detail-about">
        <h2 class="section-title-sm">この企画について</h2>
        <p>${escapeHtml(d.fullDescription)}</p>
      </section>` : ''}
      <section class="detail-specs">
        <h2 class="section-title-sm">開催情報</h2>
        <dl class="spec-list">${rows}
        </dl>
      </section>
      <p class="detail-back"><a class="more-link more-back" href="../projects.html">企画一覧へ戻る</a></p>
    </div>`;
}

function pageTemplate(project, d) {
  const title = escapeHtml(project.title);
  const description = escapeHtml(project.description);
  // 検索結果に出る説明文。企画の説明に、サイト名と「星光 SF2026」を添える
  const metaDescription = escapeHtml(`${project.description}｜Aoristos の星光 SF2026（大阪星光学院 スクールフェア 2026）出展企画。高校棟3階 特別第3教室。`);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}｜Aoristos — 星光 SF2026</title>
  <meta name="description" content="${metaDescription}">
  <meta name="author" content="Aoristos">
  <meta name="theme-color" content="#ffffff">
  <!-- site-meta:start -->
  <!-- site-meta:end -->
  <link rel="icon" href="../favicon.ico" sizes="any">
  <link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="../assets/apple-touch-icon.png">
  <link rel="stylesheet" href="../assets/style.css">
  <script>
    window.pageConfig = { currentPage: 'projects', basePath: '../' };
  </script>
  <script src="../assets/config.js"></script>
  <script src="../assets/sheet.js" defer></script>
  <script src="../assets/header.js" defer></script>
  <script src="../assets/script.js" defer></script>
  <script src="../assets/project-detail.js" defer></script>
</head>
<body>

<main id="main">
  <article id="projectDetail">
    <!-- 本文は assets/projects-details.json から生成されます（generate-pages.js が書き出し、project-detail.js が表示時に最新化） -->
${detailBody(project, d)}
  </article>
</main>

</body>
</html>
`;
}

/** build-site.js が書き込む canonical・OGP の部分と CSS/JS の版（?v=）は比較から外す */
function stripMeta(html) {
  return html
    .replace(/<!-- site-meta:start -->[\s\S]*?<!-- site-meta:end -->/, '')
    .replace(/(assets\/[\w./-]+\.(?:css|js))\?v=[0-9a-f]+/g, '$1');
}

function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error('assets/projects.csv が見つかりません');
    process.exit(1);
  }

  const projects = parseCSV(fs.readFileSync(CSV_PATH, 'utf8')).filter(p => p.title && p.link);
  const details = loadDetails();
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let created = 0;
  let skipped = 0;

  for (const project of projects) {
    // link は "projects/electric.html" 形式
    const fileName = path.basename(project.link);
    const html = pageTemplate(project, details[fileName.replace(/\.html$/, '')]);
    const outputPath = path.join(OUTPUT_DIR, fileName);

    if (fs.existsSync(outputPath) && !FORCE && stripMeta(fs.readFileSync(outputPath, 'utf8')) === stripMeta(html)) {
      skipped++;
      continue;
    }

    fs.writeFileSync(outputPath, html, 'utf8');
    console.log(`生成・更新: projects/${fileName}`);
    created++;
  }

  // CSV から消えた企画のページを削除
  // （このスクリプトが生成した「器」だけが対象。手書きの独立ページ、例えば
  //   projects/aoristos-bushi-pre.html は CSV になくても残す）
  const GENERATED_MARK = '本文は assets/projects-details.json から生成されます';
  const keep = new Set(projects.map(p => path.basename(p.link)));
  let removed = 0;
  for (const f of fs.readdirSync(OUTPUT_DIR)) {
    if (f.endsWith('.html') && !keep.has(f) &&
        fs.readFileSync(path.join(OUTPUT_DIR, f), 'utf8').includes(GENERATED_MARK)) {
      fs.unlinkSync(path.join(OUTPUT_DIR, f));
      console.log(`削除（CSV にない）: projects/${f}`);
      removed++;
    }
  }

  console.log(`\n完了: ${created} 件生成・更新 / ${skipped} 件変更なし / ${removed} 件削除`);
}

main();
