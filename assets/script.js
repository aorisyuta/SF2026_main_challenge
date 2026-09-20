/*
  script.js — Aoristos / Osaka Seiko Gakuin SF 2026
  共通の軽量スクリプト。

  エコ方針:
    - 外部ライブラリ・CDN を使わない（js-yaml 依存と content.yml の取得を廃止）
    - カウントダウンは毎秒ではなく「次の分」まで待って更新し、
      タブが非表示のあいだは完全に停止する
    - 企画一覧は assets/projects.csv 1 本だけを取得（画像リクエストは出さない）
    - Google マップは利用者がクリックしたときだけ読み込む
*/

(function () {
  'use strict';

  /* ---------------------------------------------------------
     カウントダウン（省電力版）
  --------------------------------------------------------- */
  var countdownTarget = null;
  var countdownTimer = null;

  function renderCountdown() {
    var el = document.getElementById('countdown');
    if (!el || !countdownTarget) return false;

    var diff = countdownTarget - new Date();
    if (diff <= 0) {
      el.textContent = 'SF 開催中';
      return false;
    }

    var d = Math.floor(diff / 86400000);
    var h = Math.floor(diff / 3600000) % 24;
    var m = Math.floor(diff / 60000) % 60;
    el.textContent = 'あと ' + d + '日 ' + h + '時間 ' + m + '分';
    return true;
  }

  function stopCountdown() {
    if (countdownTimer) {
      clearTimeout(countdownTimer);
      countdownTimer = null;
    }
  }

  /** 分が変わる瞬間だけ再描画する。毎秒タイマーに比べて更新回数は 1/60。 */
  function scheduleCountdown() {
    stopCountdown();
    if (document.hidden) return;
    if (!renderCountdown()) return;

    var msToNextMinute = 60000 - (Date.now() % 60000) + 50;
    countdownTimer = setTimeout(scheduleCountdown, msToNextMinute);
  }

  function initCountdown() {
    var el = document.getElementById('countdown');
    if (!el || !window.__heroDate) return;

    var parsed = new Date(window.__heroDate);
    if (isNaN(parsed)) parsed = new Date(window.__heroDate + 'Z');
    if (isNaN(parsed)) return;

    countdownTarget = parsed;
    scheduleCountdown();

    // 非表示タブでは止め、戻ってきたら追いつかせる
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopCountdown();
      else scheduleCountdown();
    });
  }

  /* ---------------------------------------------------------
     ナビゲーション
  --------------------------------------------------------- */
  function initNav() {
    var menuBtn = document.getElementById('menuToggle');
    var nav = document.getElementById('mainNav');
    if (!menuBtn || !nav) return;

    menuBtn.addEventListener('click', function () {
      var isOpen = nav.classList.toggle('show');
      menuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      menuBtn.setAttribute('aria-label', isOpen ? 'メニューを閉じる' : 'メニューを開く');
    });

    document.addEventListener('click', function (e) {
      if (!nav.classList.contains('show')) return;
      if (nav.contains(e.target) || menuBtn.contains(e.target)) return;
      nav.classList.remove('show');
      menuBtn.setAttribute('aria-expanded', 'false');
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('show')) {
        nav.classList.remove('show');
        menuBtn.setAttribute('aria-expanded', 'false');
        menuBtn.focus();
      }
    });
  }

  /* ---------------------------------------------------------
     タブ（タイムテーブル）
  --------------------------------------------------------- */
  function initTabs() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
    if (!tabs.length) return;

    tabs.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var panel = document.querySelector(btn.getAttribute('data-target'));
        if (!panel) return;

        tabs.forEach(function (t) {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        document.querySelectorAll('.tab-panel').forEach(function (p) {
          p.classList.remove('active');
          p.hidden = true;
        });

        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        panel.classList.add('active');
        panel.hidden = false;
      });
    });

    var printBtn = document.getElementById('printTimetable');
    if (printBtn) printBtn.addEventListener('click', function () { window.print(); });
  }

  /* ---------------------------------------------------------
     Google マップ（クリックで読み込むファサード）
     初期表示では外部への通信が発生しない。
  --------------------------------------------------------- */
  function initMapFacade() {
    var facade = document.querySelector('.map-facade');
    if (!facade) return;

    facade.addEventListener('click', function () {
      var src = facade.getAttribute('data-src');
      if (!src) return;

      var wrap = document.createElement('div');
      wrap.className = 'map-embed';
      var iframe = document.createElement('iframe');
      iframe.src = src;
      iframe.title = '大阪星光学院の地図';
      iframe.loading = 'lazy';
      iframe.referrerPolicy = 'no-referrer-when-downgrade';
      iframe.setAttribute('allowfullscreen', '');
      wrap.appendChild(iframe);

      facade.replaceWith(wrap);
    });
  }

  /* ---------------------------------------------------------
     企画一覧（assets/projects.csv）
  --------------------------------------------------------- */
  function parseCSV(text) {
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim() !== ''; });
    if (!lines.length) return [];

    function parseLine(line) {
      var re = /(\s*"([^"]*(?:""[^"]*)*)"\s*|[^,]*)(?:,|$)/g;
      var out = [];
      var m;
      while ((m = re.exec(line)) !== null) {
        var val = '';
        if (m[2] !== undefined) val = m[2].replace(/""/g, '"');
        else if (m[1] !== undefined) val = m[1].trim();
        out.push(val);
        if (re.lastIndex >= line.length) break;
      }
      return out;
    }

    var header = parseLine(lines.shift()).map(function (h) { return h.trim(); });
    return lines.map(function (ln) {
      var cols = parseLine(ln);
      var o = {};
      header.forEach(function (h, i) { o[h] = cols[i] !== undefined ? cols[i] : ''; });
      return o;
    });
  }

  function collectTags(p) {
    return ['tags', 'tags2', 'tags3']
      .map(function (k) { return (p[k] || '').trim(); })
      .filter(Boolean);
  }

  function buildProjectCard(p, basePath) {
    var tags = collectTags(p);

    var card = document.createElement('article');
    card.className = 'project-card';
    card.setAttribute('data-tags', tags.join(','));
    if (tags.length) card.setAttribute('data-category', tags[0]);

    // 画像の代わりにカテゴリ色の帯を使う（画像リクエスト 0 件）
    var accent = document.createElement('div');
    accent.className = 'project-accent';
    if (tags.length) accent.setAttribute('data-category', tags[0]);
    card.appendChild(accent);

    // サムネイルが指定されている場合だけ遅延読み込みする
    if (p.thumb && p.thumb.trim()) {
      var img = document.createElement('img');
      img.className = 'project-thumb';
      img.src = basePath + p.thumb.trim();
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.addEventListener('error', function () { img.remove(); });
      card.appendChild(img);
    }

    var body = document.createElement('div');
    body.className = 'project-body';

    var titleWrap = document.createElement('div');
    titleWrap.className = 'project-title-wrap';

    var h3 = document.createElement('h3');
    if (p.link) {
      var titleLink = document.createElement('a');
      titleLink.href = basePath + p.link;
      titleLink.textContent = p.title || '';
      h3.appendChild(titleLink);
    } else {
      h3.textContent = p.title || '';
    }
    titleWrap.appendChild(h3);

    var descWrap = document.createElement('div');
    descWrap.className = 'project-description';
    descWrap.hidden = true;
    var descP = document.createElement('p');
    descP.textContent = p.description || '';
    descWrap.appendChild(descP);

    if (p.description) {
      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'project-toggle-btn';
      toggle.textContent = '＋';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', (p.title || '企画') + 'の説明を開く');
      toggle.addEventListener('click', function () {
        var expanded = toggle.getAttribute('aria-expanded') === 'true';
        setCardExpanded(card, !expanded);
      });
      titleWrap.appendChild(toggle);
    }

    body.appendChild(titleWrap);
    body.appendChild(descWrap);

    if (tags.length) {
      var badgeWrap = document.createElement('div');
      badgeWrap.className = 'badges';
      tags.forEach(function (t) {
        var b = document.createElement('span');
        b.className = 'badge';
        b.textContent = t;
        badgeWrap.appendChild(b);
      });
      body.appendChild(badgeWrap);
    }

    card.appendChild(body);
    return card;
  }

  function setCardExpanded(card, expanded) {
    var toggle = card.querySelector('.project-toggle-btn');
    var descWrap = card.querySelector('.project-description');
    if (!toggle || !descWrap) return;
    descWrap.hidden = !expanded;
    toggle.textContent = expanded ? '－' : '＋';
    toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }

  function renderFilterButtons(tags) {
    var filterList = document.querySelector('.filter-list');
    if (!filterList) return;

    filterList.textContent = '';

    var allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'filter-btn active';
    allBtn.setAttribute('data-filter', '*');
    allBtn.textContent = 'すべて';
    filterList.appendChild(allBtn);

    tags.forEach(function (tag) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'filter-btn';
      btn.setAttribute('data-filter', tag);
      btn.textContent = tag;
      filterList.appendChild(btn);
    });
  }

  function initProjectControls(grid) {
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.project-card'));
    var search = document.getElementById('projectsSearch');
    var noResults = document.getElementById('projectsNoResults');

    function applyFilter() {
      var q = search && search.value ? search.value.trim().toLowerCase() : '';
      var activeBtn = document.querySelector('.filter-btn.active');
      var cat = activeBtn ? activeBtn.getAttribute('data-filter') : '*';
      var visible = 0;

      cards.forEach(function (card) {
        var title = (card.querySelector('h3') || {}).textContent || '';
        var desc = (card.querySelector('.project-description p') || {}).textContent || '';
        var tagsAttr = (card.getAttribute('data-tags') || '').toLowerCase();
        var tagsList = tagsAttr ? tagsAttr.split(',') : [];

        var haystack = (title + ' ' + desc).toLowerCase() + ' ' + tagsAttr;
        var matchesQuery = q === '' || haystack.indexOf(q) !== -1;
        var matchesCat = cat === '*' || tagsList.indexOf(cat.toLowerCase()) !== -1;
        var show = matchesQuery && matchesCat;

        card.hidden = !show;
        if (show) visible++;
      });

      if (noResults) noResults.hidden = visible !== 0;
    }

    if (search) search.addEventListener('input', applyFilter);

    // フィルタボタンは再生成されるので委譲で受ける
    var filterList = document.querySelector('.filter-list');
    if (filterList) {
      filterList.addEventListener('click', function (e) {
        var btn = e.target.closest('.filter-btn');
        if (!btn) return;
        filterList.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        applyFilter();
      });
    }

    var expandAll = document.getElementById('expandAllBtn');
    var collapseAll = document.getElementById('collapseAllBtn');
    if (expandAll) expandAll.addEventListener('click', function () {
      cards.forEach(function (c) { setCardExpanded(c, true); });
    });
    if (collapseAll) collapseAll.addEventListener('click', function () {
      cards.forEach(function (c) { setCardExpanded(c, false); });
    });

    applyFilter();
  }

  function loadProjects() {
    var grid = document.getElementById('projectsGrid');
    if (!grid) return;

    var basePath = (window.pageConfig && window.pageConfig.basePath) || '';

    fetch(basePath + 'assets/projects.csv')
      .then(function (res) {
        if (!res.ok) throw new Error('projects.csv の取得に失敗しました (' + res.status + ')');
        return res.text();
      })
      .then(function (text) {
        var rows = parseCSV(text).filter(function (r) { return r.title; });
        if (!rows.length) throw new Error('企画データが空です');

        var fragment = document.createDocumentFragment();
        var tagSet = [];

        rows.forEach(function (p) {
          collectTags(p).forEach(function (t) {
            if (tagSet.indexOf(t) === -1) tagSet.push(t);
          });
          fragment.appendChild(buildProjectCard(p, basePath));
        });

        grid.textContent = '';
        grid.appendChild(fragment);

        renderFilterButtons(tagSet);
        initProjectControls(grid);
      })
      .catch(function (err) {
        console.error(err);
        grid.innerHTML =
          '<p class="no-results">企画データを読み込めませんでした。' +
          'ローカルで確認する場合は <code>python -m http.server 8000</code> でサーバーを起動してください。</p>';
      });
  }

  /* ---------------------------------------------------------
     起動
  --------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    initNav();
    initTabs();
    initMapFacade();
    initCountdown();
    loadProjects();
  });
})();
