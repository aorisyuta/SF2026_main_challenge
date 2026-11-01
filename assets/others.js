/*
  others.js — 「企画一覧」ページ（others-list.html）の動き
    ・上部に固定したツールバー：検索欄と「絞り込み」ボタン（押すと階・種類・並び順のパネルが開く）
    ・選んでいる条件は「3F ×」のように表示し、× で1つずつ外せる
    ・校内マップ：選んだ階の地図を表示。部屋を押すとその部屋の企画だけを表示
    ・URL の ?floor=3 / ?tag=飲食 / ?room=sr3 で、最初から絞り込んだ状態にする（概要ページの図から来たとき）
  本文は tools/build-others.js が HTML に書き出し済み。ここでは表示・並びを切り替えるだけ。
*/
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var $ = function (id) { return document.getElementById(id); };
    var cards = Array.prototype.slice.call(document.querySelectorAll('.ob-card'));
    var groups = Array.prototype.slice.call(document.querySelectorAll('.ob-floor'));
    var search = $('obSearch'), count = $('obCount'), empty = $('obEmpty'), list = $('list');
    var panel = $('obPanel'), filterBtn = $('obFilterBtn'), badge = $('obBadge'), active = $('obActive');
    var toolbar = $('obToolbar'), flat = $('obFlat'), mapBox = $('mapBox'), mapDetails = $('map');
    if (!cards.length || !search || !panel) return;

    cards.forEach(function (c, i) { c._home = c.parentNode; c._order = i; });

    var params = new URLSearchParams(location.search);
    var state = { q: '', floor: params.get('floor') || '', tag: params.get('tag') || '', room: params.get('room') || '', roomName: '', sort: 'place' };
    var mapFloor = state.floor || '3';
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var mobile = window.matchMedia('(max-width: 833px)').matches;
    var SORT_LABEL = { cheap: '安い順', expensive: '高い順', name: '名前順' };

    function norm(s) {
      // ひらがな→カタカナ、全角英数→半角、小文字化（表記ゆれを吸収）
      return String(s || '').toLowerCase()
        .replace(/[ぁ-ゖ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) + 0x60); })
        .replace(/[Ａ-Ｚａ-ｚ０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
        .replace(/\s+/g, '');
    }
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function floorName(f) { return f === '1' ? '1F・屋外' : f + 'F'; }

    /* ---------- 並び替え ---------- */
    function yen(c) { var v = c.getAttribute('data-yen'); return v === '' ? null : Number(v); }
    function arrange() {
      if (state.sort === 'place') {
        cards.slice().sort(function (a, b) { return a._order - b._order; }).forEach(function (c) { c._home.appendChild(c); });
        flat.hidden = true;
        return;
      }
      cards.slice().sort(function (a, b) {
        if (state.sort === 'name') return a.getAttribute('data-name').localeCompare(b.getAttribute('data-name'), 'ja');
        var x = yen(a), y = yen(b);
        if (x === null && y === null) return a._order - b._order;
        if (x === null) return 1;          // 料金表示なしは最後
        if (y === null) return -1;
        return state.sort === 'cheap' ? x - y : y - x;
      }).forEach(function (c) { flat.appendChild(c); });
      flat.hidden = false;
    }

    /* ---------- 絞り込み ---------- */
    function matches(c, words) {
      var ok = (!state.floor || c.getAttribute('data-floor') === state.floor) &&
        (!state.tag || c.getAttribute('data-tags').split('|').indexOf(state.tag) !== -1) &&
        (!state.room || c.getAttribute('data-rooms').split('|').indexOf(state.room) !== -1);
      if (ok && words.length) {
        var hay = norm(c.getAttribute('data-search'));
        ok = words.every(function (w) { return hay.indexOf(w) !== -1; });
      }
      return ok;
    }

    function apply() {
      var words = state.q.split(/\s+/).map(norm).filter(Boolean);
      var shown = 0;
      cards.forEach(function (c) { var ok = matches(c, words); c.hidden = !ok; if (ok) shown++; });
      groups.forEach(function (g) { g.hidden = state.sort !== 'place' || !g.querySelector('.ob-card:not([hidden])'); });
      count.textContent = shown === cards.length ? '全 ' + cards.length + ' 企画' : shown + ' 企画（全 ' + cards.length + ' 企画中）';
      $('obApplyCount').textContent = shown;
      empty.hidden = shown !== 0;

      // 選択中の条件（× で外せる）
      var pills = [];
      if (state.room) pills.push(['room', state.roomName || '選んだ部屋']);
      if (state.floor && !state.room) pills.push(['floor', floorName(state.floor)]);
      if (state.tag) pills.push(['tag', state.tag]);
      if (state.sort !== 'place') pills.push(['sort', SORT_LABEL[state.sort]]);
      active.innerHTML = pills.map(function (p) {
        return '<li><button type="button" class="ob-pill" data-clear="' + p[0] + '" aria-label="' + esc(p[1]) + ' の条件を外す">' + esc(p[1]) + '<span aria-hidden="true">×</span></button></li>';
      }).join('');
      var n = pills.filter(function (p) { return p[0] !== 'sort'; }).length;
      badge.hidden = !n; badge.textContent = n;
      filterBtn.classList.toggle('has-filter', n > 0);

      document.querySelectorAll('.map-room[data-room]').forEach(function (r) {
        r.classList.toggle('is-selected', r.getAttribute('data-room') === state.room);
      });
      syncChips();
      showMapFloor(state.floor || mapFloor);
    }

    function syncChips() {
      [['obFloors', 'data-floor', state.floor], ['obTags', 'data-tag', state.tag], ['obSorts', 'data-sort', state.sort]].forEach(function (g) {
        document.querySelectorAll('#' + g[0] + ' .chip').forEach(function (b) {
          var on = b.getAttribute(g[1]) === g[2];
          b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      });
    }

    /* ---------- パネルの開閉 ---------- */
    function setPanel(open) {
      panel.hidden = !open;
      filterBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      filterBtn.classList.toggle('is-open', open);
    }
    function scrollToResults() {
      var top = list.getBoundingClientRect().top + window.pageYOffset - (toolbar ? 0 : 60);
      if (window.pageYOffset > top) window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
    }
    filterBtn.addEventListener('click', function () { setPanel(panel.hidden); });
    $('obApply').addEventListener('click', function () { setPanel(false); scrollToResults(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { setPanel(false); filterBtn.focus(); } });

    /* ---------- 校内マップ ---------- */
    function centerMap() {
      if (!mapBox || mapBox.scrollWidth <= mapBox.clientWidth + 4) return;
      var fig = mapBox.querySelector('.map-floor:not([hidden])'); if (!fig) return;
      var target = fig.querySelector('.map-room.is-selected') || fig.querySelector('.map-room.is-aor') || fig.querySelector('.map-room[data-room]');
      if (!target) { mapBox.scrollLeft = 0; return; }
      var box = mapBox.getBoundingClientRect(), r = target.getBoundingClientRect();
      mapBox.scrollLeft += (r.left + r.width / 2) - (box.left + box.width / 2);
    }
    function showMapFloor(f) {
      mapFloor = f;
      document.querySelectorAll('.map-floor').forEach(function (m) { m.hidden = m.getAttribute('data-map-floor') !== f; });
      var label = $('mapLabel');
      if (label) label.textContent = floorName(f) + ' を表示中' + (state.floor ? '' : '（階を選ぶと切り替わります）');
      requestAnimationFrame(centerMap);
    }
    if (mapDetails) {
      if (mobile && !params.get('floor') && !params.get('room')) mapDetails.open = false;  // スマホは一覧を先に
      mapDetails.addEventListener('toggle', function () { if (mapDetails.open) requestAnimationFrame(centerMap); });
    }
    function pickRoom(el) {
      state.room = el.getAttribute('data-room');
      state.roomName = el.getAttribute('data-room-name');
      state.floor = el.closest('.map-floor').getAttribute('data-map-floor');
      state.tag = ''; state.q = ''; search.value = '';
      apply();
      var first = list.querySelector('.ob-card:not([hidden])');
      if (first) first.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    }
    document.querySelectorAll('.map-room[data-room]').forEach(function (r) {
      r.addEventListener('click', function () { pickRoom(r); });
      r.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickRoom(r); }
      });
    });

    /* ---------- 操作 ---------- */
    search.addEventListener('input', function () { state.q = search.value; state.room = ''; apply(); });
    search.addEventListener('keydown', function (e) { if (e.key === 'Enter') { search.blur(); scrollToResults(); } });
    $('obFloors').addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      state.floor = b.getAttribute('data-floor'); state.room = ''; apply();
    });
    $('obTags').addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      state.tag = b.getAttribute('data-tag'); apply();
    });
    $('obSorts').addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      state.sort = b.getAttribute('data-sort'); arrange(); apply();
    });
    active.addEventListener('click', function (e) {
      var b = e.target.closest('.ob-pill'); if (!b) return;
      var k = b.getAttribute('data-clear');
      if (k === 'room') { state.room = ''; state.floor = ''; }
      else if (k === 'sort') { state.sort = 'place'; arrange(); }
      else state[k] = '';
      apply();
    });
    function reset() {
      state.q = ''; state.floor = ''; state.tag = ''; state.room = ''; search.value = '';
      if (state.sort !== 'place') { state.sort = 'place'; arrange(); }
      apply();
    }
    $('obReset').addEventListener('click', reset);
    $('obReset2').addEventListener('click', function () { reset(); search.focus({ preventScroll: true }); });

    // URL の指定（概要ページの図から来たとき）
    if (state.room) {
      var el = document.querySelector('.map-room[data-room="' + state.room.replace(/[^\w-]/g, '') + '"]');
      if (el) { state.roomName = el.getAttribute('data-room-name'); state.floor = el.closest('.map-floor').getAttribute('data-map-floor'); }
      else state.room = '';
    }
    apply();
    window.addEventListener('load', centerMap);

    // 固定ツールバーの高さ（階の見出しをその下に固定するため）
    if (toolbar && 'ResizeObserver' in window) {
      new ResizeObserver(function () {
        document.documentElement.style.setProperty('--tb-h', toolbar.offsetHeight + 'px');
      }).observe(toolbar);
    }
  });
})();
