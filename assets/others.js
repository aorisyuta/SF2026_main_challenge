/*
  others.js — 「企画一覧」ページ（others-list.html）の動き
    ・校内マップの階の切り替え（一覧の階の絞り込みと連動）
    ・地図の部屋を押すと、その部屋の企画だけを表示
    ・検索・階・種類の絞り込み
    ・URL の ?floor=3 / ?tag=飲食 / ?room=sr3 で、最初から絞り込んだ状態にする（概要ページの図から来たとき）
  本文は tools/build-others.js が HTML に書き出し済み。ここでは表示・非表示を切り替えるだけ。
*/
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var cards = Array.prototype.slice.call(document.querySelectorAll('.ob-card'));
    var groups = Array.prototype.slice.call(document.querySelectorAll('.ob-floor'));
    var search = document.getElementById('obSearch');
    var count = document.getElementById('obCount');
    var empty = document.getElementById('obEmpty');
    var list = document.getElementById('list');
    var roomBar = document.getElementById('obRoom');
    if (!cards.length || !search) return;

    var params = new URLSearchParams(location.search);
    var state = { q: '', floor: params.get('floor') || '', tag: params.get('tag') || '', room: params.get('room') || '', roomName: '' };

    function norm(s) {
      // ひらがな→カタカナ、全角英数→半角、小文字化（表記ゆれを吸収）
      return String(s || '').toLowerCase()
        .replace(/[ぁ-ゖ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) + 0x60); })
        .replace(/[Ａ-Ｚａ-ｚ０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
        .replace(/\s+/g, '');
    }

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
      groups.forEach(function (g) { g.hidden = !g.querySelector('.ob-card:not([hidden])'); });
      count.textContent = shown + ' 企画';
      empty.hidden = shown !== 0;

      if (roomBar) {
        roomBar.hidden = !state.room;
        if (state.room) roomBar.querySelector('span').textContent = (state.roomName || '選んだ部屋') + ' の企画を表示中';
      }
      document.querySelectorAll('.map-room[data-room]').forEach(function (r) {
        r.classList.toggle('is-selected', r.getAttribute('data-room') === state.room);
      });
      syncChips();
    }

    function syncChips() {
      document.querySelectorAll('#obFloors .chip').forEach(function (b) {
        var on = b.getAttribute('data-floor') === state.floor;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      document.querySelectorAll('#obTags .chip').forEach(function (b) {
        var on = b.getAttribute('data-tag') === state.tag;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }

    /* ---------- 校内マップ ---------- */
    function showMapFloor(f) {
      if (!f) return;
      document.querySelectorAll('.map-floor').forEach(function (m) { m.hidden = m.getAttribute('data-map-floor') !== f; });
      document.querySelectorAll('.map-tab').forEach(function (t) {
        var on = t.getAttribute('data-floor') === f;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    }

    function jumpToList() {
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      list.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }

    var tabs = document.getElementById('mapTabs');
    if (tabs) tabs.addEventListener('click', function (e) {
      var t = e.target.closest('.map-tab'); if (!t) return;
      state.floor = t.getAttribute('data-floor'); state.room = '';
      showMapFloor(state.floor); apply();
    });

    function pickRoom(el) {
      state.room = el.getAttribute('data-room');
      state.roomName = el.getAttribute('data-room-name');
      state.floor = el.closest('.map-floor').getAttribute('data-map-floor');
      state.tag = ''; state.q = ''; search.value = '';
      apply(); jumpToList();
    }
    document.querySelectorAll('.map-room[data-room]').forEach(function (r) {
      r.addEventListener('click', function () { pickRoom(r); });
      r.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickRoom(r); }
      });
    });
    var clear = document.getElementById('obRoomClear');
    if (clear) clear.addEventListener('click', function () { state.room = ''; apply(); });

    /* ---------- 一覧の絞り込み ---------- */
    search.addEventListener('input', function () { state.q = search.value; apply(); });
    document.getElementById('obFloors').addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      state.floor = b.getAttribute('data-floor'); state.room = '';
      showMapFloor(state.floor); apply();
    });
    document.getElementById('obTags').addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      state.tag = b.getAttribute('data-tag'); apply();
    });

    // URL の指定（概要ページの図から来たとき）
    if (state.room) {
      var el = document.querySelector('.map-room[data-room="' + state.room.replace(/[^\w-]/g, '') + '"]');
      if (el) { state.roomName = el.getAttribute('data-room-name'); state.floor = el.closest('.map-floor').getAttribute('data-map-floor'); }
      else state.room = '';
    }
    showMapFloor(state.floor);
    apply();
  });
})();
