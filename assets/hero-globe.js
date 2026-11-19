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
  var TILT = 23.4 * Math.PI / 180;      // 地軸の傾き（北極が右へ）。AX と合わせて「右向こう側」に倒れる
  var AX = .3;                          // 地軸の北極を向こう側へ倒す角（文字の輪も同じ角で傾く＝赤道と平行）
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
    var y1 = y * Math.cos(AX) - z * Math.sin(AX), z1 = y * Math.sin(AX) + z * Math.cos(AX);
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

  // ---- 文字：輪の接平面に置いた厚みのある板として 3D で描く ----
  // 文字ごとに、白い面・側面の色の画像をあらかじめ作っておき、投影した向きに合わせて変形して重ねる
  var GLYPH = {}, GS = 220;
  function glyph(ch) {
    if (GLYPH[ch]) return GLYPH[ch];
    var font = FONT.replace('{s}', GS);
    var m = document.createElement('canvas').getContext('2d'); m.font = font;
    var w = Math.ceil(m.measureText(ch).width) + 8, h = Math.ceil(GS * 1.05);
    function make(color) {
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var g = c.getContext('2d'); g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = color; g.fillText(ch, w / 2, h / 2 + GS * .04);
      return c;
    }
    return (GLYPH[ch] = { w: w, h: h, face: make('#ffffff'), side: make('#7d93a8'), dark: make('#2c4a64') });
  }
  function rotX(v, t) { var c = Math.cos(t), s = Math.sin(t); return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c]; }
  // 地球儀と同じ傾け方（地軸を手前に倒す → 画面上で回す）。文字の輪を赤道と平行にするために使う
  function axis(v) { var w = rotX(v, AX), c = Math.cos(TILT), s = Math.sin(TILT); return [w[0] * c - w[1] * s, w[0] * s + w[1] * c, w[2]]; }

  function letters(cx, cy, r) {
    var R = r * 1.34, F = R * 4.5, size = r * .5, depth = size * .2, out = [];
    function proj(p) { var k = F / (F - p[2]); return [cx + p[0] * k, cy + p[1] * k, p[2]]; }
    WORD.forEach(function (ch, i) {
      var a = ring + i * STEP;                                   // a = 0 が正面
      var P = axis([R * Math.sin(a), 0, R * Math.cos(a)]); // 文字の中心
      var T = axis([Math.cos(a), 0, -Math.sin(a)]);        // 横向き（輪の接線）
      var U = axis([0, 1, 0]);                             // 縦向き（画面の下が +）
      var N = axis([Math.sin(a), 0, Math.cos(a)]);         // 外向きの法線
      out.push({ ch: ch, P: P, T: T, U: U, N: N, z: P[2], size: size, depth: depth, proj: proj });
    });
    return out;
  }
  function drawLetter(L) {
    var g = glyph(L.ch), sc = L.size / GS;
    // 1 層ぶんを描く：中心を法線方向に d だけずらした板を、アフィン変換で画面に貼る
    function layer(d, img, alpha) {
      var C = [L.P[0] - L.N[0] * d, L.P[1] - L.N[1] * d, L.P[2] - L.N[2] * d];
      var p0 = L.proj(C);
      var px = L.proj([C[0] + L.T[0], C[1] + L.T[1], C[2] + L.T[2]]);
      var py = L.proj([C[0] + L.U[0], C[1] + L.U[1], C[2] + L.U[2]]);
      ctx.setTransform(DPR * (px[0] - p0[0]) * sc, DPR * (px[1] - p0[1]) * sc, DPR * (py[0] - p0[0]) * sc, DPR * (py[1] - p0[1]) * sc, DPR * p0[0], DPR * p0[1]);
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, -g.w / 2, -g.h / 2);
    }
    var facing = L.N[2];                       // 正：外側の面がこちらを向いている
    // 厚みを画面上で何 px 動くかに合わせて層を重ねる（真横を向いた文字でも側面がつながって見えるように）
    var q0 = L.proj(L.P), q1 = L.proj([L.P[0] - L.N[0] * L.depth, L.P[1] - L.N[1] * L.depth, L.P[2] - L.N[2] * L.depth]);
    var K = Math.min(40, Math.max(6, Math.ceil(Math.hypot(q1[0] - q0[0], q1[1] - q0[1]))));
    var a0 = 1;
    // 奥の層から順に（外側の面が手前なら内側から、そうでなければ外側から）
    for (var k = 0; k <= K; k++) {
      var t = facing >= 0 ? 1 - k / K : k / K;  // 0 = 外側の面、1 = 内側の面
      var d = t * L.depth;
      var isFace = k === K;
      if (isFace) {
        layer(d, facing >= 0 ? g.face : g.side, a0);
      } else {
        layer(d, t > .5 ? g.dark : g.side, a0);
      }
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
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
