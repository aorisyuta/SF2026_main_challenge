/*
  hero-globe.js — トップの地球儀と、そのまわりを回る「AORISTOS」の文字（canvas）
  - 地球儀：緯線・経線の網を、地軸を少し傾けて自転させる
  - 文字：地球儀を囲む傾いた輪の上に並べ、輪ごと回す。手前の文字は地球儀の前、奥の文字は後ろ（裏返し・暗め）
  - ドラッグで回せる。動きを減らす設定のときは、正面で止めておく
*/
(function () {
  'use strict';
  var cv = document.getElementById('heroGlobe');
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');
  var WORD = 'AORISTOS✦AORISTOS✦'.split('');   // 輪を一周するように 2 回くり返す
  var TILT = 23.4 * Math.PI / 180;      // 地軸の傾き
  var RING = -11 * Math.PI / 180;       // 文字の輪の傾き
  var STEP = 2 * Math.PI / WORD.length;  // 文字の間隔（一周を等分）
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W = 0, H = 0, DPR = 1, spin = 0, ring = 0, dragging = false, lastX = 0, last = 0;
  var FONT = '800 {s}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, "Hiragino Sans", sans-serif';

  function resize() {
    var r = cv.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    draw();
  }

  // 球面上の点（緯度 la・経度 lo）を、自転と地軸の傾きを入れて画面へ
  function sph(la, lo, r) {
    var x = r * Math.cos(la) * Math.sin(lo + spin);
    var y = -r * Math.sin(la);
    var z = r * Math.cos(la) * Math.cos(lo + spin);
    // 地軸を手前に倒す（x 軸まわり）→ 画面上で少し回す（z 軸まわり）
    var y1 = y * Math.cos(-.4) - z * Math.sin(-.4), z1 = y * Math.sin(-.4) + z * Math.cos(-.4);
    var c = Math.cos(TILT), s = Math.sin(TILT);
    return [x * c - y1 * s, x * s + y1 * c, z1];
  }

  function drawGlobe(cx, cy, r) {
    var g = ctx.createRadialGradient(cx - r * .35, cy - r * .4, r * .1, cx, cy, r);
    g.addColorStop(0, '#2f6fa3'); g.addColorStop(.55, '#124a75'); g.addColorStop(1, '#06243b');
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(1, r * .006);
    function line(pts) {
      ctx.beginPath(); var on = false;
      pts.forEach(function (p) {
        if (p[2] < 0) { on = false; return; }
        if (on) ctx.lineTo(cx + p[0], cy + p[1]); else ctx.moveTo(cx + p[0], cy + p[1]);
        on = true;
      });
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,.28)';
    for (var lo = 0; lo < 180; lo += 15) {             // 経線
      var a = [], b = [];
      for (var la = -90; la <= 90; la += 4) { a.push(sph(la * Math.PI / 180, lo * Math.PI / 180, r)); b.push(sph(la * Math.PI / 180, (lo + 180) * Math.PI / 180, r)); }
      line(a); line(b);
    }
    for (var lat = -75; lat <= 75; lat += 15) {         // 緯線
      var c = [];
      for (var l2 = 0; l2 <= 360; l2 += 4) c.push(sph(lat * Math.PI / 180, l2 * Math.PI / 180, r));
      ctx.strokeStyle = lat === 0 ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.28)';
      line(c);
    }
    // ふちの光
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(160,205,240,.55)'; ctx.lineWidth = Math.max(1.5, r * .012); ctx.stroke();
  }

  function letters(cx, cy, r) {
    var R = r * 1.32, f = R * 4.2, size = r * .46, out = [];
    var start = ring;
    WORD.forEach(function (ch, i) {
      var a = start + i * STEP;                 // a = 0 が正面
      var x = R * Math.sin(a), z = R * Math.cos(a), y = 0;
      var y1 = y * Math.cos(RING) - z * Math.sin(RING), z1 = y * Math.sin(RING) + z * Math.cos(RING);
      var k = f / (f - z1);
      out.push({ ch: ch, u: cx + x * k, v: cy + y1 * k, z: z1, k: k, face: Math.cos(a), size: size });
    });
    return out;
  }
  function drawLetter(L) {
    ctx.save();
    ctx.translate(L.u, L.v);
    ctx.scale(L.face * L.k, L.k);              // 輪に沿って横に縮む。裏側では裏返しになる
    ctx.font = FONT.replace('{s}', Math.round(L.size));
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var front = L.face > 0, depth = Math.max(2, L.size * .07);
    // 厚み（立体の文字に見せる）
    ctx.fillStyle = front ? '#0a2a44' : 'rgba(10,42,68,.25)';
    for (var d = depth; d > 0; d -= 1) ctx.fillText(L.ch, 0, d);
    ctx.fillStyle = front ? '#ffffff' : 'rgba(200,220,235,.2)';
    ctx.fillText(L.ch, 0, 0);
    ctx.restore();
  }

  function draw() {
    if (!W) return;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var r = Math.min(W * .26, H * .34), cx = W / 2, cy = H / 2;
    var L = letters(cx, cy, r);
    L.filter(function (l) { return l.z < 0; }).sort(function (a, b) { return a.z - b.z; }).forEach(drawLetter);
    drawGlobe(cx, cy, r);
    L.filter(function (l) { return l.z >= 0; }).sort(function (a, b) { return a.z - b.z; }).forEach(drawLetter);
  }

  function loop(now) {
    var dt = last ? Math.min(now - last, 50) : 16; last = now;
    if (!dragging) { ring -= dt * 0.00042; spin += dt * 0.00018; }
    draw();
    requestAnimationFrame(loop);
  }

  cv.addEventListener('pointerdown', function (e) { dragging = true; lastX = e.clientX; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var d = (e.clientX - lastX) * 0.008; lastX = e.clientX;
    ring += d; spin += d * .45;
    if (reduce) draw();
  });
  function end() { dragging = false; }
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);

  window.addEventListener('resize', resize);
  resize();
  if (!reduce) requestAnimationFrame(loop);
})();
