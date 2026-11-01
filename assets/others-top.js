/*
  others-top.js — 「他の企画」概要ページ（others.html）の「いまのステージ」
  ステージの時間割（#stageNow の data-slots）と現在時刻（日本時間）から、
  会場ごとに「いま」と「次」を表示する。開催前・開催後はそれに合わせた案内にする。
*/
(function () {
  'use strict';

  var DAYS = { 1: '2026-11-07', 2: '2026-11-08' };
  var LABEL = { 1: '11/7（土）', 2: '11/8（日）' };
  var VENUES = ['講堂', '音楽室'];

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function toMin(hm) { var p = hm.split(':'); return Number(p[0]) * 60 + Number(p[1]); }

  function render() {
    var box = document.getElementById('stageNow');
    var body = document.getElementById('stageNowBody');
    if (!box || !body) return;
    var slots;
    try { slots = JSON.parse(box.getAttribute('data-slots')); } catch (e) { return; }

    // 日本時間の「日付」と「分」
    var jst = new Date(Date.now() + 9 * 3600 * 1000);
    var today = jst.toISOString().slice(0, 10);
    var nowMin = jst.getUTCHours() * 60 + jst.getUTCMinutes();
    var day = Object.keys(DAYS).filter(function (d) { return DAYS[d] === today; })[0];

    var html = '';
    if (day) {
      var rows = VENUES.map(function (v) {
        var list = slots.filter(function (s) { return String(s.d) === day && s.v === v; })
          .sort(function (a, b) { return toMin(a.s) - toMin(b.s); });
        var now = list.filter(function (s) { return toMin(s.s) <= nowMin && nowMin < toMin(s.e); })[0];
        var next = list.filter(function (s) { return toMin(s.s) > nowMin; })[0];
        if (!now && !next) return '<li><span class="ob-now-venue">' + esc(v) + '</span><span class="ob-now-done">本日のステージは終了しました</span></li>';
        return '<li><span class="ob-now-venue">' + esc(v) + '</span>' +
          (now ? '<span class="ob-now-cur"><b>いま</b>' + esc(now.t) + '<small>〜' + esc(now.e) + '</small></span>'
               : '<span class="ob-now-cur is-idle"><b>いま</b>演目の合間です</span>') +
          (next ? '<span class="ob-now-next"><b>次</b>' + esc(next.s) + ' ' + esc(next.t) + '</span>' : '<span class="ob-now-next"><b>次</b>なし</span>') +
          '</li>';
      }).join('');
      html = '<ul class="ob-now-list">' + rows + '</ul>';
    } else {
      // 開催前・開催の間・開催後
      var upcoming = Object.keys(DAYS).filter(function (d) { return DAYS[d] > today; })[0];
      if (upcoming) {
        var firsts = slots.filter(function (s) { return String(s.d) === upcoming; })
          .sort(function (a, b) { return toMin(a.s) - toMin(b.s); });
        var t0 = firsts.length ? firsts[0].s : '';
        var starts = firsts.filter(function (s) { return s.s === t0; });
        html = '<p class="ob-now-msg">最初のステージ：<b>' + LABEL[upcoming] + ' ' + esc(t0) + '</b> ' +
          starts.map(function (s) { return esc(s.v) + '「' + esc(s.t) + '」'; }).join('・') + '</p>';
      } else {
        html = '<p class="ob-now-msg">ステージはすべて終了しました。ご来場ありがとうございました。</p>';
      }
    }
    body.innerHTML = html;
  }

  document.addEventListener('DOMContentLoaded', function () {
    render();
    setInterval(function () { if (!document.hidden) render(); }, 60000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) render(); });
  });
})();
