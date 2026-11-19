#!/usr/bin/env node
/*
  tools/build-search.js — サイト内検索の索引をつくる
  出力：assets/search-index.json  [{ u: URL, t: タイトル, s: 区分, d: 説明, h: 見出し, b: 本文（先頭の一部） }]
  - 公開している HTML ページの <main>（なければ <body>）から文字を取り出す
  - 検索に出したくないページ（noindex・404・エディタ・過去サイトの保存分）は入れない
  - お知らせ記事は assets/config.js の sitePosts から入れる
  検索の画面は assets/search.js。npm run build で毎回作り直される。
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'search-index.json');
const SKIP_DIRS = new Set(['.git', 'node_modules', '.wrangler', 'templates', 'photo', 'dist', 'tools']);
const SKIP_FILES = new Set(['404.html', 'latex/editor.html', 'archive/view.html', 'blog/post.html']);
const BODY_MAX = 2400; // 1 ページあたりの本文の長さの上限（索引を軽く保つ）

function listHtml(dir = ROOT, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name), rel = path.relative(ROOT, p).split(path.sep).join('/');
    if (e.isDirectory()) { if (rel === 'archive/sf25') continue; listHtml(p, out); }
    else if (e.name.endsWith('.html') && !SKIP_FILES.has(rel)) out.push(rel);
  }
  return out.sort();
}
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ', apos: "'" };
const decode = s => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, k) => {
  if (k[0] === '#') return String.fromCodePoint(k[1] === 'x' || k[1] === 'X' ? parseInt(k.slice(2), 16) : +k.slice(1));
  return ENT[k] != null ? ENT[k] : m;
});
const text = h => decode(h.replace(/<(script|style|svg|template|noscript)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\$\$?/g, '').replace(/\s+/g, ' ').trim();
const meta = (h, n) => { const m = h.match(new RegExp('<meta name="' + n + '" content="([^"]*)"', 'i')); return m ? decode(m[1]) : ''; };

// 区分（検索結果に小さく出す）
function section(u) {
  if (u === 'projects/aoristos-bushi-pre.html') return 'Aoristos';
  if (/^(sf|projects|timetable|info|others|others-list)\.html$|^projects\//.test(u)) return 'SF2026（アーカイブ）';
  if (u.startsWith('games/')) return 'ゲーム';
  if (u.startsWith('latex/')) return 'ツール';
  if (u.startsWith('teams/') || u === 'organization.html') return '組織';
  if (u.startsWith('sodpion/') || u === 'members.html') return 'メンバー';
  if (u.startsWith('blog')) return 'お知らせ';
  if (u.startsWith('archive/')) return 'アーカイブ';
  return 'Aoristos';
}

const items = [];
for (const rel of listHtml()) {
  const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  if (/<meta name="robots" content="[^"]*noindex/i.test(html)) continue;
  const title = decode((html.match(/<title>([^<]*)<\/title>/i) || [])[1] || rel)
    .replace(/｜Aoristos — 探究団体$/, '').replace(/｜(SF2026|ゲーム|ツール|メンバー|大阪支部)?｜?Aoristos$/, '').replace(/｜Aoristos$/, '').trim();
  const t2 = rel === 'index.html' ? 'ホーム（Aoristos 公式サイト）' : title.replace(/｜sodpion$/, '');
  const main = (html.match(/<main\b[\s\S]*<\/main>/i) || html.match(/<body\b[\s\S]*<\/body>/i) || [''])[0];
  const heads = [...main.matchAll(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/gi)].map(m => text(m[1])).filter(Boolean);
  // ゲーム本体のページは画面の部品（得点表示など）しかないので、本文は使わず説明文だけにする
  const isApp = /^games\/(?!index)/.test(rel);
  const body = isApp ? '' : text(main);
  items.push({ u: rel, t: t2, s: section(rel), d: meta(html, 'description'), h: [...new Set(heads)].join(' / ').slice(0, 400), b: body.slice(0, BODY_MAX) });
}

// お知らせ記事（config.js の sitePosts）
try {
  const sandbox = { window: {}, document: { documentElement: { classList: { add() {} } } } };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets', 'config.js'), 'utf8'), sandbox);
  for (const p of (sandbox.window.SF_CONFIG.sitePosts || [])) {
    if (p.unlisted) continue;
    const body = String(p.body || '').replace(/[#>*\-]|!\[[^\]]*\]\([^)]*\)|\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ');
    items.push({ u: 'blog/post.html?id=' + encodeURIComponent(p.id), t: p.title, s: 'お知らせ', d: p.text || '', h: (String(p.body || '').match(/^#+\s.*$/gm) || []).map(s => s.replace(/^#+\s/, '')).join(' / '), b: body.slice(0, BODY_MAX) });
  }
} catch (e) { console.warn('sitePosts を索引に入れられませんでした:', e.message); }

const json = JSON.stringify(items);
const old = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
if (old !== json) fs.writeFileSync(OUT, json);
console.log(`検索の索引: ${items.length} ページ（${Math.round(json.length / 1024)} KB）${old === json ? '・変更なし' : '・更新'}`);
