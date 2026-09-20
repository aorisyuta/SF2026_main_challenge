/**
 * 共通ヘッダ生成スクリプト
 * 各ページで window.pageConfig を定義してから defer 読み込みする。
 *
 * エコ方針:
 *   - 外部リソースを一切呼ばない（フォント/CDN なし）
 *   - 不要な DOM（背景オーバーレイ）は生成しない
 *   - 校内マップは info.html 内のアンカーに集約し、無駄なリクエストを出さない
 */

var SITE = {
  eventName: '“BE SEIKO” Osaka Seiko Gakuin SF 2026',
  eventDateLabel: 'SF 2026',
  producer: 'Aoristos',
  instagram: 'https://www.instagram.com/your_account'
};

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function createCommonHeader(config) {
  var cfg = config || {};
  var title = cfg.title || SITE.eventName;
  var pageTitle = cfg.pageTitle || SITE.eventName;
  var pageSubtitle = cfg.pageSubtitle || 'Produced by ' + SITE.producer;
  var currentPage = cfg.currentPage || '';
  var bodyClass = cfg.bodyClass || '';
  var extraStyles = cfg.extraStyles || '';
  var basePath = cfg.basePath || '';
  var showMapLink = cfg.showMapLink !== false;

  document.title = title;
  if (bodyClass) document.body.classList.add(bodyClass);

  function navLink(href, label, key) {
    return '<a href="' + basePath + href + '"' +
      (currentPage === key ? ' class="nav-cta" aria-current="page"' : '') +
      '>' + label + '</a>';
  }

  var headerHTML =
    '<a class="skip-link" href="#main">本文へスキップ</a>' +

    '<noscript class="no-js-warning">JavaScript が無効のため、企画一覧など一部のコンテンツが表示されません。' +
    'タイムテーブルとインフォメーションは JavaScript なしでもご覧いただけます。</noscript>' +

    '<header class="site-header">' +
      '<div class="topbar">' +
        '<div class="topbar-inner">' +
          '<div class="top-left">' + escapeHtml(SITE.eventDateLabel) + '</div>' +
          '<div class="top-right">' +
            '<a href="' + SITE.instagram + '" target="_blank" rel="noopener noreferrer" class="top-social">Instagram</a>' +
            (showMapLink ? '<a href="' + basePath + 'info.html#map" class="top-cta">校内マップ</a>' : '') +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="header-inner">' +
        '<div class="brand">' +
          '<img src="' + basePath + 'assets/logo.svg" alt="' + escapeHtml(SITE.producer) + ' ロゴ" class="logo" width="48" height="48" decoding="async">' +
          '<div class="brand-text">' +
            '<h1 class="brand-title">' + escapeHtml(pageTitle) + '</h1>' +
            '<p class="brand-sub">' + escapeHtml(pageSubtitle) + '</p>' +
          '</div>' +
        '</div>' +

        '<button id="menuToggle" class="menu-toggle" aria-expanded="false" aria-controls="mainNav" aria-label="メニューを開く">☰</button>' +

        '<nav id="mainNav" class="nav" aria-label="メインナビゲーション">' +
          navLink('index.html', 'ホーム', 'index') +
          navLink('projects.html', '企画紹介', 'projects') +
          navLink('timetable.html', 'タイムテーブル', 'timetable') +
          navLink('info.html', 'インフォ', 'info') +
          navLink('blog.html', 'ブログ', 'blog') +
        '</nav>' +
      '</div>' +
    '</header>';

  document.body.insertAdjacentHTML('afterbegin', headerHTML);

  if (extraStyles) {
    var style = document.createElement('style');
    style.textContent = extraStyles;
    document.head.appendChild(style);
  }
}

/** フッターの年号と制作クレジットを埋める */
function initCommonFooter() {
  var yearEl = document.getElementById('currentYear');
  if (yearEl && !yearEl.textContent) yearEl.textContent = new Date().getFullYear();
}

document.addEventListener('DOMContentLoaded', function () {
  if (window.pageConfig) createCommonHeader(window.pageConfig);
  initCommonFooter();
});
