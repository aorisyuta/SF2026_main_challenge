/*
  header.js — 共通のナビゲーション・お知らせリボン・フッターを生成する
  各ページで window.pageConfig を定義してから defer で読み込む。
    currentPage: index / about / members / goods / tools / sf / projects / timetable / others / info / blog / games / archive
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
    { key: 'members', href: 'members.html', label: 'メンバー' },
    { key: 'blog', href: 'blog.html', label: 'お知らせ' },
    { key: 'games', href: 'games/index.html', label: 'ゲーム' },
    { key: 'tools', href: 'latex/index.html', label: 'ツール' },
    { key: 'goods', href: 'goods.html', label: 'グッズ' },
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
            '<span class="gnav-brand-text">Aoristos</span>' +
          '</a>' +
          '<nav class="gnav-nav" id="gnavNav" aria-label="メイン">' +
            '<ul>' + links + '</ul>' +
          '</nav>' +
          '<button class="gnav-search" id="gnavSearch" type="button" aria-label="サイト内を検索" title="サイト内を検索（/）">' +
            '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>' +
          '</button>' +
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
            '<p class="footer-event">中高生による探究団体</p></div>' +
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
          '<p>Aoristos 公式サイト。中高生による探究団体 Aoristos の活動をお知らせしています（SF 全体の公式サイトではありません）。' +
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
    var goods = base + 'goods.html';
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

  /* ---------- サイト内検索（索引は assets/search-index.json。tools/build-search.js が作る） ---------- */
  var SR = null, srIndex = null, srSel = -1;
  function srNorm(t) {
    // 全角/半角・大文字/小文字・カタカナ/ひらがなの違いを無視して比べる
    return String(t || '').normalize('NFKC').toLowerCase().replace(/[\u30a1-\u30f6]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); });
  }
  function srLoad() {
    if (srIndex) return Promise.resolve(srIndex);
    return fetch(base + 'assets/search-index.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (a) {
      srIndex = a.map(function (it) { return { it: it, t: srNorm(it.t), h: srNorm(it.h), d: srNorm(it.d), b: srNorm(it.b) }; });
      return srIndex;
    });
  }
  function srMark(text, terms) {
    var t = String(text), n = srNorm(t);
    if (n.length !== t.length) return esc(t); // 文字数が変わる正規化のときは強調しない
    var marks = [];
    terms.forEach(function (q) { var i = 0; while ((i = n.indexOf(q, i)) >= 0) { marks.push([i, i + q.length]); i += q.length; } });
    if (!marks.length) return esc(t);
    marks.sort(function (a, b) { return a[0] - b[0]; });
    var out = '', pos = 0;
    marks.forEach(function (m) { if (m[0] < pos) return; out += esc(t.slice(pos, m[0])) + '<mark>' + esc(t.slice(m[0], m[1])) + '</mark>'; pos = m[1]; });
    return out + esc(t.slice(pos));
  }
  function srSnippet(x, terms) {
    // 説明文に言葉があれば説明文を、なければ本文の該当箇所を見せる
    if (x.it.d && terms.some(function (q) { return x.d.indexOf(q) >= 0; })) return srMark(x.it.d.length > 110 ? x.it.d.slice(0, 110) + '…' : x.it.d, terms);
    var src = x.it.b || x.it.d, n = x.b || x.d, i = -1;
    terms.some(function (q) { i = n.indexOf(q); return i >= 0; });
    if (i < 0) return srMark((x.it.d || src).slice(0, 90), terms);
    var a = Math.max(0, i - 30), z = Math.min(src.length, i + 70);
    return (a > 0 ? '…' : '') + srMark(src.slice(a, z), terms) + (z < src.length ? '…' : '');
  }
  function srRun() {
    var q = SR.input.value, terms = srNorm(q).split(/\s+/).filter(Boolean), res = SR.res;
    srSel = -1;
    if (!terms.length) { res.innerHTML = '<li class="srch-hint">ページ名・本文の言葉で探せます（例：積分、AorXC、部誌、LaTeX）</li>'; return; }
    srLoad().then(function (idx) {
      var hits = [];
      idx.forEach(function (x) {
        var score = 0;
        for (var k = 0; k < terms.length; k++) {
          var q = terms[k], s = 0;
          if (x.t.indexOf(q) >= 0) s += 12; if (x.h.indexOf(q) >= 0) s += 5; if (x.d.indexOf(q) >= 0) s += 3; if (x.b.indexOf(q) >= 0) s += 1 + Math.min(3, x.b.split(q).length - 2);
          if (!s) return; score += s;
        }
        hits.push([score, x]);
      });
      hits.sort(function (a, b) { return b[0] - a[0]; });
      if (!hits.length) { res.innerHTML = '<li class="srch-hint">「' + esc(q) + '」に一致するページは見つかりませんでした</li>'; return; }
      res.innerHTML = hits.slice(0, 30).map(function (h) {
        var x = h[1];
        return '<li><a class="srch-item" href="' + esc(base + x.it.u) + '"><small>' + esc(x.it.s) + '</small><b>' + srMark(x.it.t, terms) + '</b><span>' + srSnippet(x, terms) + '</span></a></li>';
      }).join('') + (hits.length > 30 ? '<li class="srch-hint">ほか ' + (hits.length - 30) + ' 件。言葉を足すと絞り込めます</li>' : '');
    }).catch(function () { res.innerHTML = '<li class="srch-hint">検索の準備に失敗しました。ページを再読み込みしてください</li>'; });
  }
  function srMove(d) {
    var items = SR.res.querySelectorAll('.srch-item'); if (!items.length) return;
    srSel = (srSel + d + items.length) % items.length;
    items.forEach(function (a, i) { a.classList.toggle('is-sel', i === srSel); });
    items[srSel].scrollIntoView({ block: 'nearest' });
  }
  function srOpen() {
    if (!SR) {
      var w = document.createElement('div');
      w.className = 'srch'; w.hidden = true;
      w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true'); w.setAttribute('aria-label', 'サイト内検索');
      w.innerHTML = '<div class="srch-panel"><div class="srch-bar">' +
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>' +
        '<input type="search" class="srch-input" placeholder="サイト内を検索" aria-label="検索する言葉" autocomplete="off" enterkeyhint="search">' +
        '<button type="button" class="srch-close" aria-label="検索を閉じる">閉じる</button></div>' +
        '<ul class="srch-res" role="listbox"></ul></div>';
      document.body.appendChild(w);
      SR = { el: w, input: w.querySelector('.srch-input'), res: w.querySelector('.srch-res') };
      var t = 0;
      SR.input.addEventListener('input', function () { clearTimeout(t); t = setTimeout(srRun, 120); });
      SR.input.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); srMove(1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); srMove(-1); }
        else if (e.key === 'Enter') { var a = SR.res.querySelectorAll('.srch-item')[Math.max(0, srSel)]; if (a) { e.preventDefault(); location.href = a.href; } }
      });
      w.addEventListener('click', function (e) { if (e.target === w || e.target.closest('.srch-close')) srClose(); });
      srRun();
    }
    SR.el.hidden = false; document.documentElement.classList.add('srch-open');
    SR.input.focus(); SR.input.select();
    srLoad().catch(function () {});
  }
  function srClose() { if (!SR) return; SR.el.hidden = true; document.documentElement.classList.remove('srch-open'); var b = document.getElementById('gnavSearch'); if (b) b.focus(); }
  document.addEventListener('keydown', function (e) {
    if (SR && !SR.el.hidden && e.key === 'Escape') { srClose(); return; }
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target, tag = (t.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable) return;
    if (document.querySelector('dialog[open]')) return;
    e.preventDefault(); srOpen();
  });

  document.addEventListener('DOMContentLoaded', function () {
    buildHeader();
    var sb = document.getElementById('gnavSearch'); if (sb) sb.addEventListener('click', srOpen);
    if (!page.noFooter) buildFooter();
    fillFromSheet();
  });
})();
