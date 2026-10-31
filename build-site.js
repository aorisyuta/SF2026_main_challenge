#!/usr/bin/env node
/*
  build-site.js — Aoristos / Osaka Seiko Gakuin SF2026

  公開前の仕上げを行う（外部パッケージ不要）。
    1. 各 HTML の <head> に canonical・OGP・Twitter カードを書き込み、
       CSS・JS の URL に中身のハッシュ（?v=...）を付ける
       （<!-- site-meta:start --> 〜 <!-- site-meta:end --> の間を毎回作り直す）
    2. robots.txt・sitemap.xml を作る
    3. Cloudflare 用の _headers（セキュリティヘッダー・CSP・キャッシュ）を作る
       CSP のインラインスクリプト許可は、HTML 内の <script> の SHA-256 から自動で計算する
    4. 公開するファイルだけを dist/ にコピーする（.assetsignore に書いたものは除外）
       Cloudflare Pages のビルド出力ディレクトリを dist にすると、readme や
       テンプレートなどの内部ファイルが公開されなくなる

  公開 URL は assets/config.js の siteUrl。空欄なら canonical・og:url・og:image・
  sitemap.xml は出力しない（相対 URL の OGP 画像は SNS で表示されないため）。

  使い方:
    npm run build    （generate-pages.js → build-site.js の順に実行）
*/

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const START = '<!-- site-meta:start -->';
const END = '<!-- site-meta:end -->';
const OG_IMAGE = 'assets/og-image.jpg';
const OG_IMAGE_SIZE = { width: 1200, height: 630 };
const SKIP_DIRS = new Set(['.git', 'node_modules', '.wrangler', 'templates', 'photo', 'dist']);
// 過去のサイト（archive/sf25/ など）はビルド済みの別サイトなので手を加えない。archive/ 直下の案内ページだけ対象
const ARCHIVE_DIR = 'archive';

/* ---------- 設定（assets/config.js）を読む ---------- */
function loadConfig() {
  const code = fs.readFileSync(path.join(ROOT, 'assets', 'config.js'), 'utf8');
  const sandbox = { window: {}, document: { documentElement: { classList: { add() {} } } } };
  vm.runInNewContext(code, sandbox, { filename: 'config.js' });
  return sandbox.window.SF_CONFIG || {};
}

/* ---------- ユーティリティ ---------- */
function listHtml(dir = ROOT, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory() && path.relative(ROOT, dir).split(path.sep)[0] === ARCHIVE_DIR) continue;
    if (e.isDirectory()) listHtml(p, out);
    else if (e.name.endsWith('.html')) out.push(path.relative(ROOT, p).split(path.sep).join('/'));
  }
  return out.sort();
}

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unesc = s => String(s).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Cloudflare の html_handling = auto-trailing-slash に合わせた公開パス */
function publicPath(rel) {
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return '/' + rel.slice(0, -'index.html'.length);
  return '/' + rel.replace(/\.html$/, '');
}

function lastModified(rel) {
  try {
    const d = execFileSync('git', ['log', '-1', '--format=%cs', '--', rel], { cwd: ROOT, encoding: 'utf8' }).trim();
    if (d) return d;
  } catch (e) { /* git が無い環境 */ }
  return new Date().toISOString().slice(0, 10);
}

/* ---------- 1. <head> のメタ情報・CSS/JS の版 ---------- */
const versionCache = new Map();
function assetVersion(asset) {
  if (!versionCache.has(asset)) {
    const file = path.join(ROOT, asset);
    versionCache.set(asset, fs.existsSync(file)
      ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 10)
      : '0');
  }
  return versionCache.get(asset);
}

function metaBlock(rel, html, cfg) {
  const title = unesc((html.match(/<title>([\s\S]*?)<\/title>/) || [, ''])[1].trim());
  const desc = unesc((html.match(/<meta name="description" content="([^"]*)"/) || [, ''])[1]);
  const noindex = /<meta name="robots" content="[^"]*noindex/.test(html);
  const site = (cfg.siteUrl || '').replace(/\/+$/, '');
  const lines = [];

  if (site && !noindex && rel !== '404.html') lines.push(`<link rel="canonical" href="${esc(site + publicPath(rel))}">`);
  lines.push(`<meta property="og:site_name" content="${esc(cfg.siteName || 'Aoristos')}">`);
  lines.push('<meta property="og:locale" content="ja_JP">');
  lines.push(`<meta property="og:type" content="${rel === 'index.html' ? 'website' : 'article'}">`);
  lines.push(`<meta property="og:title" content="${esc(title)}">`);
  if (desc) lines.push(`<meta property="og:description" content="${esc(desc)}">`);
  if (site) {
    if (rel !== '404.html') lines.push(`<meta property="og:url" content="${esc(site + publicPath(rel))}">`);
    lines.push(`<meta property="og:image" content="${esc(site + '/' + OG_IMAGE)}">`);
    lines.push(`<meta property="og:image:secure_url" content="${esc(site + '/' + OG_IMAGE)}">`);
    lines.push('<meta property="og:image:type" content="image/jpeg">');
    lines.push(`<meta property="og:image:width" content="${OG_IMAGE_SIZE.width}">`);
    lines.push(`<meta property="og:image:height" content="${OG_IMAGE_SIZE.height}">`);
    lines.push('<meta property="og:image:alt" content="数式や化学式に囲まれて Aoristos と書かれた黒板アート">');
  }
  // X（旧 Twitter）向け。og: だけでも読めるが、明示しておくとカードが安定して出る
  lines.push(`<meta name="twitter:card" content="${site ? 'summary_large_image' : 'summary'}">`);
  lines.push(`<meta name="twitter:title" content="${esc(title)}">`);
  if (desc) lines.push(`<meta name="twitter:description" content="${esc(desc)}">`);
  if (site) {
    lines.push(`<meta name="twitter:image" content="${esc(site + '/' + OG_IMAGE)}">`);
    lines.push('<meta name="twitter:image:alt" content="数式や化学式に囲まれて Aoristos と書かれた黒板アート">');
  }

  if (site && rel === 'index.html') lines.push(structuredData(cfg, site));

  return `${START}\n  ${lines.join('\n  ')}\n  ${END}`;
}

/**
 * 検索エンジン向けの構造化データ（JSON-LD、トップページのみ）。
 * サイト名「Aoristos」と、星光 SF2026 での出展（イベント）を Google に伝える。
 * type="application/ld+json" は実行されないので CSP の対象外。
 */
function structuredData(cfg, site) {
  const days = cfg.days || [];
  const first = days[0], last = days[days.length - 1];
  const org = {
    '@type': 'Organization',
    '@id': site + '/#organization',
    name: cfg.siteName || 'Aoristos',
    url: site + '/',
    logo: site + '/assets/apple-touch-icon.png',
    image: site + '/' + OG_IMAGE
  };
  const graph = [
    {
      '@type': 'WebSite',
      '@id': site + '/#website',
      name: cfg.siteName || 'Aoristos',
      alternateName: ['Aoristos 公式サイト', 'Aoristos 星光 SF2026', 'Aoristos SF2026'],
      url: site + '/',
      inLanguage: 'ja',
      publisher: { '@id': org['@id'] }
    },
    org
  ];
  if (first && last) {
    graph.push({
      '@type': 'Event',
      name: `Aoristos 出展企画（星光 ${cfg.shortName || 'SF2026'}「${cfg.theme || ''}」）`,
      description: 'AorXC、部誌の販売、「科学の甲子園」展示、実績展示、制作体験など。',
      url: site + '/',
      image: site + '/' + OG_IMAGE,
      startDate: `${first.date}T${first.open}:00+09:00`,
      endDate: `${last.date}T${last.close}:00+09:00`,
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: {
        '@type': 'Place',
        name: `${cfg.venue || ''} ${cfg.room || ''}`.trim(),
        address: {
          '@type': 'PostalAddress',
          addressCountry: 'JP',
          addressRegion: '大阪府',
          addressLocality: cfg.venueArea ? '大阪市' + cfg.venueArea.replace(/^大阪市/, '') : '大阪市',
          streetAddress: cfg.venueStreet || '',
          postalCode: cfg.venuePostalCode || ''
        }
      },
      organizer: { '@id': org['@id'] },
      superEvent: {
        '@type': 'Event',
        name: cfg.eventName || '',
        alternateName: '星光 ' + (cfg.shortName || 'SF2026'),
        url: cfg.officialUrl || undefined,
        startDate: `${first.date}T${first.open}:00+09:00`,
        endDate: `${last.date}T${last.close}:00+09:00`,
        location: { '@type': 'Place', name: cfg.venue || '' }
      }
    });
  }
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">${json}</script>`;
}

function applyMeta(rel, cfg) {
  const file = path.join(ROOT, rel);
  let html = fs.readFileSync(file, 'utf8');

  // 手書きの古い OGP / Twitter タグはブロックに置き換える
  html = html.replace(/^[ \t]*<meta (?:property="og:|name="twitter:)[^>]*>\r?\n/gm, '');

  // CSS・JS に中身のハッシュを付ける（更新したら URL が変わり、古いキャッシュが使われない）
  html = html.replace(/((?:src|href)=")((?:\.\.\/)*|\/)?(assets\/[\w./-]+\.(?:css|js))(?:\?v=[0-9a-f]+)?"/g,
    (all, attr, prefix, asset) => `${attr}${prefix || ''}${asset}?v=${assetVersion(asset)}"`);

  const block = metaBlock(rel, html, cfg);
  const re = new RegExp(`${START}[\\s\\S]*?${END}`);
  if (re.test(html)) {
    html = html.replace(re, block);
  } else if (/<meta name="theme-color"[^>]*>\n/.test(html)) {
    html = html.replace(/(<meta name="theme-color"[^>]*>\n)/, `$1  ${block}\n`);
  } else {
    html = html.replace(/<\/title>\n/, `</title>\n  ${block}\n`);
  }

  if (html !== fs.readFileSync(file, 'utf8')) {
    fs.writeFileSync(file, html, 'utf8');
    return true;
  }
  return false;
}

/* ---------- 2. robots.txt / sitemap.xml ---------- */
function writeIfChanged(rel, content) {
  const file = path.join(ROOT, rel);
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content) return false;
  fs.writeFileSync(file, content, 'utf8');
  return true;
}

function buildRobotsAndSitemap(pages, cfg) {
  const site = (cfg.siteUrl || '').replace(/\/+$/, '');
  const changed = [];

  let robots = 'User-agent: *\nAllow: /\n';
  if (site) robots += `\nSitemap: ${site}/sitemap.xml\n`;
  if (writeIfChanged('robots.txt', robots)) changed.push('robots.txt');

  const sitemapFile = path.join(ROOT, 'sitemap.xml');
  if (!site) {
    if (fs.existsSync(sitemapFile)) { fs.unlinkSync(sitemapFile); changed.push('sitemap.xml（削除）'); }
    return changed;
  }

  const urls = pages.filter(rel => {
    if (rel === '404.html' || rel === 'blog/post.html') return false;   // 404 と記事の器（?id= で中身が決まる）は除外
    return !/<meta name="robots" content="[^"]*noindex/.test(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  }).map(rel => `  <url>\n    <loc>${esc(site + publicPath(rel))}</loc>\n    <lastmod>${lastModified(rel)}</lastmod>\n  </url>`);

  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>\n';
  if (writeIfChanged('sitemap.xml', xml)) changed.push('sitemap.xml');
  return changed;
}

/* ---------- 3. _headers ---------- */
function inlineScriptHashes(pages) {
  const hashes = new Set();
  for (const rel of pages) {
    const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
      hashes.add(`'sha256-${crypto.createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
    }
  }
  return [...hashes].sort();
}

function buildHeaders(pages) {
  const csp = [
    "default-src 'self'",
    `script-src 'self' ${inlineScriptHashes(pages).join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    // スプレッドシートの画像（Google ドライブ等）は任意の https URL を許可
    "img-src 'self' data: https:",
    // 公開 CSV は docs.google.com から *.googleusercontent.com へリダイレクトされる
    "connect-src 'self' https://docs.google.com https://*.googleusercontent.com",
    // 来場案内の Google マップと、部誌 PDF の埋め込み
    "frame-src 'self' https://www.google.com",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    'upgrade-insecure-requests'
  ].join('; ');

  const archiveCsp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "frame-src https://www.google.com",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    'upgrade-insecure-requests'
  ].join('; ');

  return `# このファイルは build-site.js が生成します。直接編集せず \`npm run build\` を実行してください。
# Cloudflare（Pages / Workers 静的アセット）が各レスポンスにヘッダーを付けます。

/*
  Content-Security-Policy: ${csp}
  Strict-Transport-Security: max-age=31536000
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=(), browsing-topics=()
  Cross-Origin-Opener-Policy: same-origin

# CSS・JS・画像・企画データなど。毎回サーバーに更新を確認する（変更がなければ 304 で軽い）
# HTML から読む CSS・JS には ?v=<ハッシュ> が付くので、更新は確実に反映される
/assets/*
  Cache-Control: public, max-age=0, must-revalidate

/favicon.ico
  Cache-Control: public, max-age=86400

# 過去のサイト（SF25, Next.js の静的書き出し）。インラインスクリプトを多用するため専用の CSP に差し替える
# 「SF25 official web site」という題のまま検索に出て公式と紛らわしくならないよう noindex（案内は /archive/ から）
/archive/sf25/*
  ! Content-Security-Policy
  Content-Security-Policy: ${archiveCsp}
  X-Robots-Tag: noindex

# Next.js のビルド成果物はファイル名にハッシュが付いているので長期キャッシュ
/archive/sf25/_next/static/*
  Cache-Control: public, max-age=31536000, immutable
`;
}

/* ---------- 4. dist/ ---------- */
function readIgnore() {
  const file = path.join(ROOT, '.assetsignore');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split(/\r?\n/)
    .map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    .map(l => l.replace(/^\/+|\/+$/g, ''));
}

function buildDist() {
  const DIST = path.join(ROOT, 'dist');
  const ignore = readIgnore();
  const isIgnored = rel => ignore.some(p => {
    if (!p.includes('*')) return rel === p || rel.startsWith(p + '/') || path.basename(rel) === p;
    const re = new RegExp('^' + p.split('*').map(x => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*') + '$');
    return re.test(rel) || re.test(path.basename(rel));
  });

  fs.rmSync(DIST, { recursive: true, force: true });
  let count = 0;
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const src = path.join(dir, e.name);
      const rel = path.relative(ROOT, src).split(path.sep).join('/');
      if (rel === 'dist' || isIgnored(rel)) continue;
      if (e.isDirectory()) walk(src);
      else if (e.isFile()) {
        const dest = path.join(DIST, rel);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
        count++;
      }
    }
  })(ROOT);
  return count;
}

/* ---------- 実行 ---------- */
function main() {
  const cfg = loadConfig();
  const pages = listHtml();

  const metaChanged = pages.filter(rel => applyMeta(rel, cfg));
  metaChanged.forEach(rel => console.log(`メタ情報を更新: ${rel}`));

  // メタ情報の書き込み後に計算する（インラインスクリプトのハッシュを最新にするため）
  const changed = buildRobotsAndSitemap(pages, cfg);
  if (writeIfChanged('_headers', buildHeaders(pages))) changed.push('_headers');
  changed.forEach(f => console.log(`生成・更新: ${f}`));

  if (!cfg.siteUrl) {
    console.log('\n注意: assets/config.js の siteUrl が空欄のため、canonical・og:url・og:image・sitemap.xml は出力していません。');
  }
  const distCount = buildDist();
  console.log(`\n完了: HTML ${metaChanged.length} 件更新 / その他 ${changed.length} 件更新 / dist に ${distCount} ファイル`);
}

main();
