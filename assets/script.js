/*
  script.js — カウントダウン / タブ / 企画一覧
  省電力：カウントダウンは分が変わるときだけ更新し、タブ非表示中は止める。
*/
(function () {
  'use strict';

  var CFG = window.SF_CONFIG || {};

  /* ---------- 開催状況 ---------- */
  function jst(dateStr, time) { return new Date(dateStr + 'T' + (time || '00:00') + ':00+09:00'); }

  function eventStatus(now) {
    var days = CFG.days || [];
    if (!days.length) return null;
    var first = jst(days[0].date, days[0].open);
    var lastDay = days[days.length - 1];
    var end = jst(lastDay.date, lastDay.close);
    if (now < first) return { phase: 'before', diff: first - now };
    if (now > end) return { phase: 'after' };
    for (var i = 0; i < days.length; i++) {
      var o = jst(days[i].date, days[i].open), c = jst(days[i].date, days[i].close);
      if (now >= o && now <= c) return { phase: 'open', day: i };
    }
    return { phase: 'between', day: 0 };
  }

  function calendarDaysUntil(dateStr) {
    var todayJst = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    return Math.round((Date.parse(dateStr) - Date.parse(todayJst)) / 86400000);
  }

  var timer = null;
  function renderCountdown() {
    var els = document.querySelectorAll('[data-countdown]');
    if (!els.length) return false;
    var st = eventStatus(new Date());
    if (!st) return false;
    var text, more = false;
    if (st.phase === 'before') {
      // 1日目は開始時刻が「午後」なので、日数（日本時間の暦日）で数える
      var days = calendarDaysUntil(CFG.days[0].date);
      text = days > 1 ? '開幕まで あと ' + days + '日' : days === 1 ? 'いよいよ明日、開幕' : '本日 午後から開催';
      more = true;
    } else if (st.phase === 'open') {
      text = (st.day + 1) + '日目 開催中';
      more = true;
    } else if (st.phase === 'between') {
      text = '2日目は ' + ((CFG.days[1] && CFG.days[1].open) || '') + ' から';
      more = true;
    } else {
      text = 'ご来場ありがとうございました';
    }
    els.forEach(function (el) { el.textContent = text; });
    return more;
  }
  function schedule() {
    clearTimeout(timer);
    if (document.hidden) return;
    if (!renderCountdown()) return;
    timer = setTimeout(schedule, 60000 - (Date.now() % 60000) + 50);
  }
  function initCountdown() {
    if (!document.querySelector('[data-countdown]')) return;
    schedule();
    document.addEventListener('visibilitychange', function () { document.hidden ? clearTimeout(timer) : schedule(); });
  }

  /* ---------- セグメント切替（タイムテーブルの日付など） ---------- */
  function initTabs() {
    document.querySelectorAll('[role="tablist"]').forEach(function (list) {
      var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
      function select(tab, focus) {
        tabs.forEach(function (t) {
          var on = t === tab;
          t.setAttribute('aria-selected', on ? 'true' : 'false');
          t.tabIndex = on ? 0 : -1;
          var panel = document.getElementById(t.getAttribute('aria-controls'));
          if (panel) panel.hidden = !on;
        });
        if (focus) tab.focus();
      }
      tabs.forEach(function (t, i) {
        t.addEventListener('click', function () { select(t); });
        t.addEventListener('keydown', function (e) {
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            var n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
            select(n, true);
          }
        });
      });
      // 初期表示（JS なしでは全パネルが見える）。開催当日はその日のタブを開く
      var initial = tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0] || tabs[0];
      var st = eventStatus(new Date());
      if (list.hasAttribute('data-day-tabs') && st && (st.phase === 'open' || st.phase === 'between') && tabs[st.day]) initial = tabs[st.day];
      if (initial) select(initial);
    });

    var printBtn = document.getElementById('printTimetable');
    if (printBtn) printBtn.addEventListener('click', function () { window.print(); });
  }

  /* ---------- 企画データ（assets/projects.csv） ---------- */
  function loadProjects() {
    var base = (window.pageConfig && window.pageConfig.basePath) || '';
    return fetch(base + 'assets/projects.csv').then(function (res) {
      if (!res.ok) throw new Error('projects.csv の取得に失敗しました (' + res.status + ')');
      return res.text();
    }).then(function (text) {
      return window.SFSheet.parseCSV(text).filter(function (r) { return r.title; }).map(function (p) {
        p.tagList = ['tags', 'tags2', 'tags3'].map(function (k) { return (p[k] || '').trim(); }).filter(Boolean);
        return p;
      });
    });
  }

  var CATEGORY_CLASS = { 'Aoristos': 'cat-a', '電気工学部': 'cat-b', '物理部': 'cat-c' };
  function categoryClass(name) { return CATEGORY_CLASS[name] || 'cat-x'; }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function buildProjectCard(p, base) {
    var card = el('article', 'project-card');
    card.setAttribute('data-tags', p.tagList.join(','));

    if (p.thumb && p.thumb.trim()) {
      var img = el('img', 'project-thumb');
      img.src = base + p.thumb.trim();
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.addEventListener('error', function () { img.remove(); });
      card.appendChild(img);
    }

    var body = el('div', 'project-body');
    var org = p.tagList[0];
    if (org) body.appendChild(el('p', 'eyebrow ' + categoryClass(org), org));

    var head = el('div', 'project-head');
    var h3 = el('h3', 'project-title');
    if (p.link) {
      var a = el('a', null, p.title);
      a.href = base + p.link;
      h3.appendChild(a);
    } else {
      h3.textContent = p.title;
    }
    head.appendChild(h3);

    var desc = el('div', 'project-description');
    desc.id = 'desc-' + Math.random().toString(36).slice(2, 9);
    desc.appendChild(el('p', null, p.description || ''));

    if (p.description) {
      var toggle = el('button', 'project-toggle');
      toggle.type = 'button';
      toggle.setAttribute('aria-controls', desc.id);
      toggle.setAttribute('aria-expanded', 'true'); // 最初から開いた状態
      toggle.setAttribute('aria-label', p.title + 'の説明を閉じる');
      toggle.addEventListener('click', function () {
        setExpanded(card, toggle.getAttribute('aria-expanded') !== 'true');
      });
      head.appendChild(toggle);
    }
    body.appendChild(head);
    body.appendChild(desc);

    var rest = p.tagList.slice(1);
    if (rest.length) {
      var tags = el('ul', 'project-tags');
      rest.forEach(function (t) { tags.appendChild(el('li', null, t)); });
      body.appendChild(tags);
    }

    if (p.link) {
      var more = el('a', 'more-link', '詳しく見る');
      more.href = base + p.link;
      more.setAttribute('aria-label', p.title + ' の詳細');
      body.appendChild(more);
    }

    card.appendChild(body);
    return card;
  }

  function setExpanded(card, open) {
    var t = card.querySelector('.project-toggle');
    var d = card.querySelector('.project-description');
    if (!t || !d) return;
    d.hidden = !open;
    t.setAttribute('aria-expanded', open ? 'true' : 'false');
    t.setAttribute('aria-label', (card.querySelector('.project-title').textContent) + (open ? 'の説明を閉じる' : 'の説明を開く'));
  }

  function initProjectsPage() {
    var grid = document.getElementById('projectsGrid');
    if (!grid) return;
    var base = (window.pageConfig && window.pageConfig.basePath) || '';

    loadProjects().then(function (rows) {
      var frag = document.createDocumentFragment();
      var tagSet = [];
      rows.forEach(function (p) {
        p.tagList.forEach(function (t) { if (tagSet.indexOf(t) === -1) tagSet.push(t); });
        frag.appendChild(buildProjectCard(p, base));
      });
      grid.textContent = '';
      grid.appendChild(frag);

      var count = document.getElementById('projectsCount');
      var filterList = document.getElementById('filterList');
      if (filterList) {
        filterList.innerHTML = '';
        ['すべて'].concat(tagSet).forEach(function (t, i) {
          var b = el('button', 'chip', t);
          b.type = 'button';
          b.setAttribute('data-filter', i === 0 ? '*' : t);
          b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
          filterList.appendChild(b);
        });
      }

      var cards = Array.prototype.slice.call(grid.querySelectorAll('.project-card'));
      var search = document.getElementById('projectsSearch');
      var none = document.getElementById('projectsNoResults');

      function apply() {
        var q = search && search.value ? search.value.trim().toLowerCase() : '';
        var active = filterList ? filterList.querySelector('[aria-pressed="true"]') : null;
        var cat = active ? active.getAttribute('data-filter') : '*';
        var visible = 0;
        cards.forEach(function (c) {
          var tags = (c.getAttribute('data-tags') || '').split(',');
          var hay = c.textContent.toLowerCase();
          var show = (!q || hay.indexOf(q) !== -1) && (cat === '*' || tags.indexOf(cat) !== -1);
          c.hidden = !show;
          if (show) visible++;
        });
        if (none) none.hidden = visible !== 0;
        if (count) count.textContent = visible + '件の企画';
      }

      if (search) search.addEventListener('input', apply);
      if (filterList) filterList.addEventListener('click', function (e) {
        var b = e.target.closest('.chip');
        if (!b) return;
        filterList.querySelectorAll('.chip').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        apply();
      });

      var toggleAll = document.getElementById('toggleAll');
      if (toggleAll) toggleAll.addEventListener('click', function () {
        var open = toggleAll.getAttribute('aria-pressed') === 'true'; // true = 現在すべて開
        cards.forEach(function (c) { setExpanded(c, !open); });
        toggleAll.setAttribute('aria-pressed', open ? 'false' : 'true');
        toggleAll.textContent = open ? '説明をすべて開く' : '説明をすべて閉じる';
      });

      apply();
    }).catch(function (err) {
      console.error(err);
      grid.innerHTML = '<p class="empty">企画データを読み込めませんでした。時間をおいて再度お試しください。</p>';
    });
  }

  /* ---------- トップの注目企画（横スクロール） ---------- */
  function initFeatured() {
    var rail = document.getElementById('featuredRail');
    if (!rail) return;
    loadProjects().then(function (rows) {
      var frag = document.createDocumentFragment();
      rows.forEach(function (p, i) {
        var a = el('a', 'rail-card');
        a.href = p.link || 'projects.html';
        var org = p.tagList[0];
        if (org) a.appendChild(el('p', 'eyebrow ' + categoryClass(org), org));
        a.appendChild(el('h3', null, p.title));
        a.appendChild(el('p', 'rail-desc', p.description));
        a.appendChild(el('span', 'rail-index', String(i + 1).padStart(2, '0')));
        frag.appendChild(a);
      });
      rail.textContent = '';
      rail.appendChild(frag);
      initRailButtons(rail);
    }).catch(function (e) { console.warn(e); });
  }

  function initRailButtons(rail) {
    var prev = document.getElementById('railPrev');
    var next = document.getElementById('railNext');
    if (!prev || !next) return;
    function step() { var c = rail.querySelector('.rail-card'); return c ? c.getBoundingClientRect().width + 20 : 300; }
    function update() {
      prev.disabled = rail.scrollLeft <= 4;
      next.disabled = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4;
    }
    prev.addEventListener('click', function () { rail.scrollBy({ left: -step(), behavior: 'smooth' }); });
    next.addEventListener('click', function () { rail.scrollBy({ left: step(), behavior: 'smooth' }); });
    rail.addEventListener('scroll', update, { passive: true });
    update();
  }

  /* ---------- スクロールで静かに現れる（低負荷：IntersectionObserver で一度だけ） ---------- */
  function initReveal() {
    var targets = document.querySelectorAll('.reveal');
    if (!targets.length) return;
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      targets.forEach(function (t) { t.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    targets.forEach(function (t) { io.observe(t); });
  }

  window.SFProjects = { load: loadProjects, categoryClass: categoryClass };

  document.addEventListener('DOMContentLoaded', function () {
    document.documentElement.classList.add('js');
    initCountdown();
    initTabs();
    initProjectsPage();
    initFeatured();
    initReveal();
  });
})();
