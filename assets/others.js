/*
  others.js — 「他の企画」ページの絞り込み（検索・階・種類）
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
    if (!cards.length || !search) return;

    var state = { q: '', floor: '', tag: '' };

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
          (!state.tag || c.getAttribute('data-tags').split('|').indexOf(state.tag) !== -1);
        if (ok && words.length) {
          var hay = norm(c.getAttribute('data-search'));
          ok = words.every(function (w) { return hay.indexOf(w) !== -1; });
        }
        c.hidden = !ok;
        if (ok) shown++;
      });
      groups.forEach(function (g) {
        g.hidden = !g.querySelector('.ob-card:not([hidden])');
      });
      count.textContent = shown + ' 企画';
      empty.hidden = shown !== 0;
      syncChips();
    }

    function syncChips() {
      document.querySelectorAll('#obFloors .chip').forEach(function (b) {
        b.classList.toggle('is-active', b.getAttribute('data-floor') === state.floor);
        b.setAttribute('aria-pressed', b.getAttribute('data-floor') === state.floor ? 'true' : 'false');
      });
      document.querySelectorAll('#obTags .chip').forEach(function (b) {
        b.classList.toggle('is-active', b.getAttribute('data-tag') === state.tag);
        b.setAttribute('aria-pressed', b.getAttribute('data-tag') === state.tag ? 'true' : 'false');
      });
    }

    function jumpToList() {
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      list.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }

    search.addEventListener('input', function () { state.q = search.value; apply(); });

    document.getElementById('obFloors').addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      state.floor = b.getAttribute('data-floor'); apply();
    });
    document.getElementById('obTags').addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      state.tag = b.getAttribute('data-tag'); apply();
    });

    // 図（建物図・種類別グラフ）から絞り込み
    document.querySelectorAll('.bldg-floor').forEach(function (b) {
      b.addEventListener('click', function () {
        state.floor = b.getAttribute('data-floor'); state.tag = ''; apply(); jumpToList();
      });
    });
    document.querySelectorAll('.tagchart-row').forEach(function (b) {
      b.addEventListener('click', function () {
        state.tag = b.getAttribute('data-tag'); state.floor = ''; apply(); jumpToList();
      });
    });

    syncChips();
  });
})();
