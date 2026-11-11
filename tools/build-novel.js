#!/usr/bin/env node
/*
  tools/build-novel.js — 小説を章ごとの HTML に書き出す

  原稿 : tools/novel/hyoko500.txt（1 行目が題名。「　　　プロローグ　…」「　　　第一章　…」「　　　エピローグ　…」の行で章が始まる）
  出力 : sodpion/hyoko500/（prologue.html, chapter1.html … chapter5.html, epilogue.html）

  原稿の書き方
    - 空行は無視する（段落は 1 行 = 1 段落）
    - 「　＊」だけの行は場面転換
    - 全角スペース 4 つ以上で始まる行（通達・〈光語訳〉など）は、改行と字下げをそのまま残した枠で表示

  原稿を直したら `npm run build` で作り直される。
*/
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(__dirname, 'novel', 'hyoko500.txt');
const OUT_DIR = path.join(ROOT, 'sodpion', 'hyoko500');
const BASE = '../../';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const lines = fs.readFileSync(SRC, 'utf8').replace(/\r\n?/g, '\n').split('\n');
const BOOK = lines[0].trim();

// 章の切れ目
const HEAD = /^　{3}(プロローグ|エピローグ|第[一二三四五六七八九十]+章)　(.+)$/;
const chapters = [];
lines.forEach((l, i) => {
  const m = l.match(HEAD);
  if (m) chapters.push({ label: m[1], sub: m[2].trim(), start: i + 1 });
});
const KANJI = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
chapters.forEach((c, k) => {
  c.end = k + 1 < chapters.length ? chapters[k + 1].start - 1 : lines.length;
  c.file = c.label === 'プロローグ' ? 'prologue.html'
    : c.label === 'エピローグ' ? 'epilogue.html'
    : 'chapter' + KANJI[c.label.replace(/^第|章$/g, '')] + '.html';
});

const isDoc = l => /^　{4,}/.test(l);
const isBlank = l => l.trim() === '';

function body(c) {
  const src = lines.slice(c.start, c.end);
  const out = [];
  for (let i = 0; i < src.length; i++) {
    const l = src[i];
    if (isBlank(l)) continue;
    if (/^　?＊\s*$/.test(l)) { out.push('<p class="nv-break" aria-hidden="true">＊</p>'); continue; }
    if (isDoc(l)) {
      // 通達などの枠：次の字下げ行までの空行はまとめて枠に含める
      const block = [];
      while (i < src.length) {
        if (isDoc(src[i])) { block.push(src[i]); i++; continue; }
        if (isBlank(src[i])) {
          let j = i; while (j < src.length && isBlank(src[j])) j++;
          if (j < src.length && isDoc(src[j])) { block.push(''); i = j; continue; }
        }
        break;
      }
      i--;
      const text = block.map(b => b.replace(/^　{4}/, '').replace(/\s+$/, '')).join('\n');
      out.push('<div class="nv-doc">' + esc(text) + '</div>');
      continue;
    }
    out.push('<p>' + esc(l.replace(/^　/, '').replace(/\s+$/, '')) + '</p>');
  }
  return out.join('\n');
}

function toc(cur) {
  return '<ol class="nv-toc">' + chapters.map(c =>
    '<li><a href="' + c.file + '"' + (c === cur ? ' aria-current="page"' : '') + '><b>' + esc(c.label) + '</b><span>' + esc(c.sub) + '</span></a></li>'
  ).join('') + '</ol>';
}

function lead(c) {
  const t = lines.slice(c.start, c.end).filter(l => !isBlank(l) && !isDoc(l) && !/＊/.test(l)).join('').replace(/　/g, '');
  return t.slice(0, 90) + '…';
}

function page(c, k) {
  const prev = chapters[k - 1], next = chapters[k + 1];
  const title = c.label + '　' + c.sub + '｜' + BOOK + '｜sodpion｜Aoristos';
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc('sodpion の小説「' + BOOK + '」' + c.label + '「' + c.sub + '」。' + lead(c))}">
  <meta name="author" content="sodpion">
  <meta name="theme-color" content="#ffffff">
  <!-- site-meta:start -->
  <!-- site-meta:end -->
  <link rel="icon" href="${BASE}favicon.ico" sizes="any">
  <link rel="icon" href="${BASE}assets/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="${BASE}assets/apple-touch-icon.png">
  <link rel="stylesheet" href="${BASE}assets/style.css">
  <script>
    window.pageConfig = { currentPage: 'members', basePath: '${BASE}', hideRibbon: true };
  </script>
  <script src="${BASE}assets/config.js"></script>
  <script src="${BASE}assets/sheet.js" defer></script>
  <script src="${BASE}assets/header.js" defer></script>
  <script src="${BASE}assets/script.js" defer></script>
</head>
<body>
<!-- このページは tools/build-novel.js が tools/novel/hyoko500.txt から生成します。直接編集しないでください。 -->

<main id="main" class="nv">
  <header class="nv-head">
    <p class="nv-crumb"><a href="../introduce.html">sodpion</a><span aria-hidden="true">／</span>小説</p>
    <p class="nv-book">${esc(BOOK)}</p>
    <h1 class="nv-title"><span>${esc(c.label)}</span>${esc(c.sub)}</h1>
  </header>

  <details class="nv-contents">
    <summary>目次</summary>
    ${toc(c)}
  </details>

  <article class="nv-body" aria-labelledby="nvTitle">
${body(c)}
  </article>

  <nav class="nv-pager" aria-label="前後の章">
    ${prev ? `<a class="nv-prev" href="${prev.file}"><small>前へ</small>${esc(prev.label)}　${esc(prev.sub)}</a>` : '<span></span>'}
    ${next ? `<a class="nv-next" href="${next.file}"><small>次へ</small>${esc(next.label)}　${esc(next.sub)}</a>` : `<a class="nv-next" href="../introduce.html"><small>おわり</small>sodpion のページへ</a>`}
  </nav>

  <section class="nv-foot" aria-label="目次">
    <p class="nv-foot-h">${esc(BOOK)}　目次</p>
    ${toc(c)}
  </section>
</main>

</body>
</html>
`;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
let changed = 0;
chapters.forEach((c, k) => {
  const file = path.join(OUT_DIR, c.file);
  const html = page(c, k).replace('aria-labelledby="nvTitle"', 'aria-label="本文"');
  const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  // build-site.js が書き込むメタ情報・?v= を除いて比べる（毎回の書き換えを避ける）
  const norm = s => s.replace(/<!-- site-meta:start -->[\s\S]*?<!-- site-meta:end -->/, '').replace(/\?v=[0-9a-f]+/g, '');
  if (norm(old) !== norm(html)) { fs.writeFileSync(file, html); changed++; }
});
console.log(`小説「${BOOK}」: ${chapters.length} 章（${chapters.map(c => c.file).join(', ')}）、${changed} 件更新`);
