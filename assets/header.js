/*
  header.js — 共通のナビゲーション・お知らせリボン・フッターを生成する
  各ページで window.pageConfig を定義してから defer で読み込む。
    currentPage: index / about / sf / projects / timetable / others / info / blog / games / archive
                 （sf・projects・timetable・others・info は SF2026 のページ。アーカイブの中として扱い、上部にサブメニューが出る）
    basePath:    サブフォルダのページは '../'
    title:       タブに出るタイトル（省略時は既存の <title>）
    hideRibbon:  true でお知らせ（販売中など）を出さない
    noFooter:    true でフッターを出さない（アーカイブの閲覧ページなど）
*/
(function () {
  'use strict';

  var CFG = window.SF_CONFIG || {};
  var page = window.pageConfig || {};
  var base = page.basePath || '';

  // サイト全体（Aoristos 公式サイト）のメニュー
  var NAV = [
    { key: 'about', href: 'about.html', label: 'Aoristos とは' },
    { key: 'blog', href: 'blog.html', label: 'ブログ' },
    { key: 'games', href: 'games/index.html', label: 'ゲーム' },
    { key: 'archive', href: 'archive/index.html', label: 'アーカイブ' }
  ];
  // SF2026 のページ（開催後は「アーカイブ」の中のページとして扱う）
  var SF_NAV = [
    { key: 'sf', href: 'sf.html', label: 'SF2026 トップ', short: 'SF トップ' },
    { key: 'projects', href: 'projects.html', label: 'Aoristos の企画', short: '企画' },
    { key: 'timetable', href: 'timetable.html', label: 'タイムテーブル', short: '時間割' },
    { key: 'others', href: 'others.html', label: '他の企画' },
    { key: 'info', href: 'info.html', label: '来場案内' }
  ];
  var inSF = SF_NAV.some(function (n) { return n.key === page.currentPage; });

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* SF2026 の中のページに出すサブメニュー */
  function subNav() {
    return '<nav class="subnav" aria-label="SF2026">' +
      '<div class="subnav-inner">' +
        '<p class="subnav-title"><a class="subnav-arch" href="' + base + 'archive/index.html">アーカイブ</a><span class="subnav-sep" aria-hidden="true">/</span><a href="' + base + 'sf.html">SF2026<small>「' + esc(CFG.theme || '') + '」</small></a></p>' +
        '<ul>' + SF_NAV.map(function (n) {
          var cur = page.currentPage === n.key;
          return '<li><a href="' + base + n.href + '"' + (cur ? ' aria-current="page"' : '') + '><span class="sn-l">' + n.label + '</span><span class="sn-s">' + (n.short || n.label) + '</span></a></li>';
        }).join('') + '</ul>' +
      '</div>' +
    '</nav>' + endedNote();
  }

  /* SF2026 の最終日の終了時刻を過ぎたら、SF のページの上部に「終了しました」を出す */
  function sfEnded() {
    var d = CFG.days || [];
    if (!d.length) return false;
    var last = d[d.length - 1];
    return Date.now() > Date.parse(last.date + 'T' + (last.close || '23:59') + ':00+09:00');
  }
  function endedNote() {
    if (!sfEnded()) return '';
    return '<p class="sf-ended"><span>SF2026「' + esc(CFG.theme || '') + '」（' + esc(dateLine()) + '）のアーカイブです。ご来場いただいた皆さま、ありがとうございました。</span></p>';
  }

  function buildHeader() {
    if (page.title) document.title = page.title;

    var links = NAV.map(function (n) {
      var cur = page.currentPage === n.key || (n.key === 'archive' && inSF);
      return '<li><a href="' + base + n.href + '"' + (cur ? ' aria-current="page"' : '') + '>' + n.label + '</a></li>';
    }).join('');

    var html =
      '<a class="skip-link" href="#main">本文へスキップ</a>' +
      '<header class="gnav" id="gnav">' +
        '<div class="gnav-inner">' +
          '<a class="gnav-brand" href="' + base + 'index.html" aria-label="Aoristos ホーム">' +
            '<img class="gnav-logo" src="' + base + 'assets/aoristos-mark.svg" alt="" width="39" height="20">' +
            '<span class="gnav-brand-text">Aoristos<span class="gnav-year">大阪星光学院</span></span>' +
          '</a>' +
          '<nav class="gnav-nav" id="gnavNav" aria-label="メイン">' +
            '<ul>' + links + '</ul>' +
          '</nav>' +
          '<button class="gnav-toggle" id="gnavToggle" type="button" aria-expanded="false" aria-controls="gnavNav" aria-label="メニューを開く">' +
            '<span></span><span></span>' +
          '</button>' +
        '</div>' +
      '</header>' +
      (inSF && !page.noFooter ? subNav() : '');

    document.body.insertAdjacentHTML('afterbegin', html);

    var toggle = document.getElementById('gnavToggle');
    var header = document.getElementById('gnav');
    function setOpen(open) {
      header.classList.toggle('is-open', open);
      document.documentElement.classList.toggle('nav-locked', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
    }
    toggle.addEventListener('click', function () { setOpen(!header.classList.contains('is-open')); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && header.classList.contains('is-open')) { setOpen(false); toggle.focus(); }
    });
    window.matchMedia('(min-width: 834px)').addEventListener('change', function (mq) { if (mq.matches) setOpen(false); });
  }

  function dateLine() {
    var d = CFG.days || [];
    if (d.length === 2) return '2026年' + d[0].label + '（' + d[0].weekday + '）・' + d[1].label.replace(/^\d+月/, '') + '（' + d[1].weekday + '）';
    return d.map(function (x) { return x.label + '（' + x.weekday + '）'; }).join('・');
  }

  /* フッターの SNS（シートの読み込み前は config.js の初期値を表示） */
  function socialItems(list) {
    if (!list.length) return '<li class="footer-muted">準備中</li>';
    return list.map(function (l) {
      var ic = window.SFSheet ? window.SFSheet.iconFor(l) : { key: 'link', svg: '' };
      return '<li><a href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer" class="social-' + ic.key + '">' +
        ic.svg + '<span>' + esc(l.title) + (l.text ? ' <small>' + esc(l.text) + '</small>' : '') + '</span></a></li>';
    }).join('');
  }

  function buildFooter() {
    var footer = document.createElement('footer');
    footer.className = 'site-footer';
    footer.innerHTML =
      '<div class="footer-inner">' +
        '<div class="footer-top">' +
          '<div class="footer-brand">' +
            '<img class="footer-logo" src="' + base + 'assets/aoristos-mark.svg" alt="" width="54" height="28">' +
            '<div><p class="footer-theme">Aoristos</p>' +
            '<p class="footer-event">大阪星光学院の生徒による探究団体<br>' + esc(CFG.eventName) + '「' + esc(CFG.theme) + '」出展：' + esc(dateLine()) + '</p></div>' +
          '</div>' +
          '<div class="footer-cols">' +
            '<div><h2>サイト</h2><ul>' +
              '<li><a href="' + base + 'index.html">ホーム</a></li>' +
              NAV.map(function (n) { return '<li><a href="' + base + n.href + '">' + n.label + '</a></li>'; }).join('') +
            '</ul></div>' +
            '<div><h2>SF2026（アーカイブ）</h2><ul>' +
              SF_NAV.map(function (n) { return '<li><a href="' + base + n.href + '">' + n.label + '</a></li>'; }).join('') +
              (CFG.officialUrl ? '<li><a href="' + esc(CFG.officialUrl) + '" target="_blank" rel="noopener noreferrer">SF 公式サイト</a></li>' : '') +
            '</ul></div>' +
            '<div><h2>フォロー</h2><ul class="footer-social" id="footerSocial">' + socialItems(CFG.fallbackLinks || []) + '</ul></div>' +
          '</div>' +
        '</div>' +
        '<div class="footer-bottom">' +
          '<p>Copyright © 2026 ' + esc(CFG.producer) + '.</p>' +
          '<p>Aoristos 公式サイト。大阪星光学院の生徒による探究団体 Aoristos の活動をお知らせしています（大阪星光学院および SF 全体の公式サイトではありません）。' +
            (CFG.officialUrl ? 'SF 全体の情報は <a href="' + esc(CFG.officialUrl) + '" target="_blank" rel="noopener noreferrer">SF 公式サイト</a> をご覧ください。' : '') + '</p>' +
        '</div>' +
      '</div>';
    document.body.appendChild(footer);
  }

  /* シート連動：グッズの枠（type = news）とフッターの SNS */
  function fillFromSheet() {
    if (!window.SFSheet) return;
    window.SFSheet.load().then(function (data) {
      var E = window.SFSheet.esc;

      if (data.news.length && !page.hideRibbon) showPromo(data.news, E);

      var social = document.getElementById('footerSocial');
      if (social && data.links.length) social.innerHTML = socialItems(data.links);
    }).catch(function (err) { console.warn(err); });
  }

  /* グッズ（部誌・Tシャツなど。シートの type = news をまとめて「グッズ」として出す）
     広い画面（1480px 以上）：本文の右の余白に、広告のような縦長のカードで固定
     それより狭い画面：少しスクロールしたら画面の下に細いバーで固定（本文に重ならない）
     × で閉じると、同じ内容は次から出さない（グッズが変われば再び出る） */
  var ART_NAME = { pdf: '部誌', tshirt: 'Tシャツ' };
  function showPromo(list, E) {
    var KEY = 'aoristos-promo-closed';
    var id = list.map(function (n) { return n.title; }).join('|');
    try { if (localStorage.getItem(KEY) === id) return; } catch (e) {}
    var goods = base + 'index.html#goods';
    function href(u) { return u || goods; }   // n.url は sheet.js の safeUrl で basePath 付きになっている
    var items = list.map(function (n) {
      var url = href(n.url);
      var ext = /^https?:/.test(url) ? ' target="_blank" rel="noopener noreferrer"' : '';
      var art = /^(pdf|tshirt)$/.test(n.art || '') ? '<img class="promo-art promo-art-' + n.art + '" src="' + base + 'assets/art/' + n.art + '.svg" alt="" width="48" height="36">' : '';
      return '<li><a href="' + E(url) + '"' + ext + '>' + art +
        '<span class="promo-name">' + E(n.name || ART_NAME[n.art] || n.title) + '</span>' +
        (n.note ? '<span class="promo-note">' + E(n.note) + '</span>' : '') + '</a></li>';
    }).join('');
    var box = document.createElement('aside');
    box.className = 'promo';
    box.setAttribute('aria-label', 'グッズ');
    box.innerHTML =
      '<div class="promo-body">' +
        '<a class="promo-head" href="' + E(goods) + '"><span class="promo-eyebrow">グッズ</span><strong>Aoristos グッズ</strong></a>' +
        '<ul class="promo-items">' + items + '</ul>' +
        '<a class="promo-more" href="' + E(goods) + '">グッズを見る</a>' +
      '</div>' +
      '<button class="promo-close" type="button" aria-label="グッズの案内を閉じる">×</button>';
    document.body.appendChild(box);
    document.documentElement.classList.add('has-promo');

    var mobile = window.matchMedia('(max-width: 1479px)');
    function update() {
      var on = !mobile.matches || window.scrollY > 160;
      box.classList.toggle('is-shown', on);
    }
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; update(); });
    }, { passive: true });
    mobile.addEventListener('change', update);
    update();

    box.querySelector('.promo-close').addEventListener('click', function () {
      box.remove();
      document.documentElement.classList.remove('has-promo');
      try { localStorage.setItem(KEY, id); } catch (e) {}
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    buildHeader();
    if (!page.noFooter) buildFooter();
    fillFromSheet();
  });
})();
