/*
  archive-viewer.js — アーカイブの閲覧ページ（archive/view.html）
  過去の SF のサイトを iframe に表示し、Wayback Machine のように上部のバーで案内する。

    archive/view.html?site=sf25            SF 2025 のトップ
    archive/view.html?site=sf25&path=/info  SF 2025 の /info

  iframe の中で移動すると、アドレスバーの ?path= も追従する（URL を共有すれば同じページが開く）。
  サイトを追加するときは SITES に1行足し、archive/index.html にカードを追加する。
*/
(function () {
  'use strict';

  var SITES = {
    sf25: { title: 'SF 2025', date: '2025年11月2日 保存', root: 'sf25/' }
  };

  var params = new URLSearchParams(location.search);
  var key = params.get('site');
  var site = Object.prototype.hasOwnProperty.call(SITES, key) ? SITES[key] : null;

  var frame = document.getElementById('viewerFrame');
  var titleEl = document.getElementById('viewerTitle');
  var dateEl = document.getElementById('viewerDate');
  var pathEl = document.getElementById('viewerPath');
  var openEl = document.getElementById('viewerOpen');
  var homeEl = document.getElementById('viewerHome');

  if (!site) {
    document.querySelector('.viewer-actions').hidden = true;
    pathEl.hidden = true;
    document.getElementById('main').innerHTML =
      '<div class="viewer-error"><h1 class="section-title-sm">アーカイブが見つかりません</h1>' +
      '<p class="info-note">URL が正しいかご確認ください。</p>' +
      '<p style="margin-top:20px"><a class="more-link" href="index.html">アーカイブ一覧へ</a></p></div>';
    return;
  }

  // サイトの公開位置（例 https://aoristos.net/archive/sf25/）
  var rootUrl = new URL(site.root, location.href);
  var rootPath = rootUrl.pathname;

  /** ?path= の値を、サイト内の安全な URL にする（外に出る指定は無視してトップへ） */
  function resolve(p) {
    if (!p || p.charAt(0) !== '/' || p.indexOf('//') === 0) return rootUrl.href;
    try {
      var u = new URL(p.replace(/^\/+/, ''), rootUrl);
      return (u.origin === rootUrl.origin && u.pathname.indexOf(rootPath) === 0) ? u.href : rootUrl.href;
    } catch (e) { return rootUrl.href; }
  }

  /** iframe 内の URL → サイト内のパス（/info など）。サイトの外なら null */
  function innerPath(loc) {
    if (loc.origin !== location.origin || loc.pathname.indexOf(rootPath) !== 0) return null;
    return '/' + loc.pathname.slice(rootPath.length) + loc.search + loc.hash;
  }

  titleEl.textContent = site.title;
  dateEl.textContent = site.date;
  document.title = site.title + '（アーカイブ） — Aoristos｜SF 2026';

  var current = null;
  function sync() {
    var loc;
    try { loc = frame.contentWindow.location; } catch (e) { return; }  // 別オリジン（外部リンク）は追えない
    if (!loc || loc.href === 'about:blank' || loc.href === current) return;
    current = loc.href;

    var p = innerPath(loc);
    if (p === null) {
      // アーカイブの外（Aoristos のページなど）へのリンクは、閲覧ページごと移動する
      location.href = loc.href;
      return;
    }
    pathEl.textContent = p;
    openEl.href = loc.href;
    var q = new URLSearchParams({ site: key });
    if (p !== '/') q.set('path', p);
    history.replaceState(null, '', '?' + q.toString());
  }

  frame.addEventListener('load', sync);
  // Next.js のページ内遷移（pushState）は load が起きないため、軽く監視する
  setInterval(function () { if (!document.hidden) sync(); }, 400);

  homeEl.addEventListener('click', function () { frame.src = rootUrl.href; });

  frame.src = resolve(params.get('path'));
  openEl.href = frame.src;
})();
