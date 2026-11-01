/*
  others.js — 「企画一覧」ページ（others-list.html）の動き
    ・検索・階・種類の絞り込み、並び替え（場所順・安い順・高い順・名前順）
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
    var roomBar = $('obRoom'), sortSel = $('obSort'), flat = $('obFlat'), mapBox = $('mapBox'), mapDetails = $('map');
    if (!cards.length || !search) return;

    // 元の並び（場所順）を覚えておく
    cards.forEach(function (c, i) { c._home = c.parentNode; c._order = i; });

    var params = new URLSearchParams(location.search);
    var state = { q: '', floor: params.get('floor') || '', tag: params.get('tag') || '', room: params.get('room') || '', roomName: '', sort: 'place' };
    var mapFloor = state.floor || '3';
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var mobile = window.matchMedia('(max-width: 833px)').matches;

    function norm(s) {
      // ひらがな→カタカナ、全角英数→半角、小文字化（表記ゆれを吸収）
      return String(s || '').toLowerCase()
        .replace(/[ぁ-ゖ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) + 0x60); })
        .replace(/[Ａ-Ｚａ-ｚ０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
        .replace(/\s+/g, '');
    }

    /* ---------- 並び替え ---------- */
    function yen(c) { var v = c.getAttribute('data-yen'); return v === '' ? null : Number(v); }
    function arrange() {
      if (state.sort === 'place') {
        cards.slice().sort(function (a, b) { return a._order - b._order; }).forEach(function (c) { c._home.appendChild(c); });
        flat.hidden = true;
        return;
      }
      var sorted = cards.slice().sort(function (a, b) {
        if (state.sort === 'name') return a.getAttribute('data-name').localeCompare(b.getAttribute('data-name'), 'ja');
        var x = yen(a), y = yen(b);
        if (x === null && y === null) return a._order - b._order;
        if (x === null) return 1;          // 料金表示なしは最後
        if (y === null) return -1;
        return state.sort === 'cheap' ? x - y : y - x;
      });
      sorted.forEach(function (c) { flat.appendChild(c); });
      flat.hidden = false;
    }

    /* ---------- 絞り込み ---------- */
    function apply() {
      var words = state.q.split(/\s+/).map(norm).filter(Boolean);
      var shown = 0;
      cards.forEach(function (c) {
        var ok = (!state.floor || c.getAttribute('data-floor') === state.floor) &&
          (!state.tag || c.getAttribute('data-tags').split('|').indexOf(state.tag) !== -1) &&
          (!state.room || c.getAttribute('data-rooms').split('|').indexOf(state.room) !== -1);
        if (ok && words.length) {
          var hay = norm(c.getAttribute('data-search'));
          ok = words.every(function (w) { return hay.indexOf(w) !== -1; });
        }
        c.hidden = !ok;
        if (ok) shown++;
      });
      groups.forEach(function (g) { g.hidden = state.sort !== 'place' || !g.querySelector('.ob-card:not([hidden])'); });
      count.textContent = shown + ' 企画' + (shown === cards.length ? '' : '（全 ' + cards.length + ' 企画中）');
      empty.hidden = shown !== 0;
      var fabCount = $('obFabCount'); if (fabCount) fabCount.textContent = shown;
      var filtered = state.q || state.floor || state.tag || state.room;
      $('obReset').hidden = !filtered;

      roomBar.hidden = !state.room;
      if (state.room) roomBar.querySelector('span').textContent = (state.roomName || '選んだ部屋') + ' の企画を表示中';
      document.querySelectorAll('.map-room[data-room]').forEach(function (r) {
        r.classList.toggle('is-selected', r.getAttribute('data-room') === state.room);
      });
      syncChips();
      showMapFloor(state.floor || mapFloor);
    }

    function syncChips() {
      document.querySelectorAll('#obFloors .chip').forEach(function (b) {
        var on = b.getAttribute('data-floor') === state.floor;
        b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      document.querySelectorAll('#obTags .chip').forEach(function (b) {
        var on = b.getAttribute('data-tag') === state.tag;
        b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }

    /* ---------- 校内マップ ---------- */
    // スマホで地図が横にスクロールするとき、注目の部屋（選んだ部屋 → Aoristos → 最初の企画）を中央に
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
      if (label) label.textContent = (f === '1' ? '1F・屋外' : f + 'F') + ' を表示中' + (state.floor ? '' : '・階を選ぶと切り替わります');
      requestAnimationFrame(centerMap);
    }
    if (mapDetails) {
      if (mobile && !params.get('floor') && !params.get('room')) mapDetails.open = false;  // スマホは一覧を先に
      mapDetails.addEventListener('toggle', function () { if (mapDetails.open) requestAnimationFrame(centerMap); });
    }

    function scrollToFirstResult() {
      var first = list.querySelector('.ob-card:not([hidden])');
      (first || list).scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    }
    function pickRoom(el) {
      state.room = el.getAttribute('data-room');
      state.roomName = el.getAttribute('data-room-name');
      state.floor = el.closest('.map-floor').getAttribute('data-map-floor');
      state.tag = ''; state.q = ''; search.value = '';
      apply(); scrollToFirstResult();
    }
    document.querySelectorAll('.map-room[data-room]').forEach(function (r) {
      r.addEventListener('click', function () { pickRoom(r); });
      r.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickRoom(r); }
      });
    });
    $('obRoomClear').addEventListener('click', function () { state.room = ''; apply(); });

    /* ---------- 操作 ---------- */
    search.addEventListener('input', function () { state.q = search.value; state.room = ''; apply(); });
    $('obFloors').addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      state.floor = b.getAttribute('data-floor'); state.room = ''; apply();
    });
    $('obTags').addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      state.tag = b.getAttribute('data-tag'); apply();
    });
    sortSel.addEventListener('change', function () { state.sort = sortSel.value; arrange(); apply(); });
    function reset() {
      state.q = ''; state.floor = ''; state.tag = ''; state.room = ''; search.value = '';
      apply(); search.focus({ preventScroll: true });
    }
    $('obReset').addEventListener('click', reset);
    $('obReset2').addEventListener('click', reset);

    // URL の指定（概要ページの図から来たとき）
    if (state.room) {
      var el = document.querySelector('.map-room[data-room="' + state.room.replace(/[^\w-]/g, '') + '"]');
      if (el) { state.roomName = el.getAttribute('data-room-name'); state.floor = el.closest('.map-floor').getAttribute('data-map-floor'); }
      else state.room = '';
    }
    apply();
    window.addEventListener('load', centerMap);

    // スマホ：検索欄が見えなくなったら「絞り込み」ボタンを出す
    var fab = $('obFab'), controls = document.querySelector('.ob-controls');
    if (fab && controls && 'IntersectionObserver' in window) {
      var inList = false, controlsVisible = true;
      var update = function () { fab.classList.toggle('is-visible', inList && !controlsVisible); };
      new IntersectionObserver(function (es) { controlsVisible = es[0].isIntersecting; update(); }).observe(controls);
      new IntersectionObserver(function (es) { inList = es[0].isIntersecting; update(); }).observe(list);
      fab.addEventListener('click', function () {
        controls.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      });
    }
  });
})();
