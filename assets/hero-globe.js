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
  var AX = 5 * Math.PI / 180;           // 地軸の北極を向こう側へ倒す角（5°）（文字の輪も同じ角で傾く＝赤道と平行）
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

  // ---- 地球儀に貼り付ける数式（数学・物理・化学） ----
  // 書き方：^{…} は上付き、_{…} は下付き。地球儀の経度・緯度の位置に、その場所の表面の向きで貼る
  var EQS = [
    'e^{iπ} + 1 = 0', 'a^{2} + b^{2} = c^{2}', '∫_{0}^{∞} e^{−x²} dx = √π ⁄ 2', '∑ 1⁄n^{2} = π^{2}⁄6',
    'x = (−b ± √(b² − 4ac)) ⁄ 2a', 'lim (1 + 1⁄n)^{n} = e', '∮ f(z) dz = 2πi ∑ Res', 'det(A − λI) = 0',
    'd⁄dx sin x = cos x', 'sin^{2}θ + cos^{2}θ = 1', '∇^{2}φ = 0', 'f(x) = ∑ f^{(n)}(a)(x−a)^{n}⁄n!',
    'F = ma', 'E = mc^{2}', '∇·E = ρ⁄ε_{0}', '∇×B = μ_{0}J + μ_{0}ε_{0} ∂E⁄∂t', 'iħ ∂ψ⁄∂t = Ĥψ',
    'F = G Mm⁄r^{2}', 'λ = h⁄p', 'E = hν', 'v = fλ', 'ΔS ≥ 0', 'U = ½kx^{2}', 'W = Fs cos θ',
    'PV = nRT', 'p = mv', 'T = 2π√(l⁄g)', 'Δx Δp ≥ ħ⁄2', 'F = qvB', 'V = IR',
    '2H_{2} + O_{2} → 2H_{2}O', 'CH_{4} + 2O_{2} → CO_{2} + 2H_{2}O', 'pH = −log[H^{+}]',
    'N_{2} + 3H_{2} ⇌ 2NH_{3}', 'ΔG = ΔH − TΔS', 'k = Ae^{−E_{a}⁄RT}', 'NaCl → Na^{+} + Cl^{−}',
    'Cu^{2+} + 4NH_{3} → [Cu(NH_{3})_{4}]^{2+}', '6CO_{2} + 6H_{2}O → C_{6}H_{12}O_{6} + 6O_{2}',
    'Ag^{+} + Cl^{−} → AgCl↓', 'K_{w} = [H^{+}][OH^{−}]', 'C_{6}H_{6}', 'Fe^{3+} + SCN^{−}',
    'ζ(s) = ∑ n^{−s}', '∂u⁄∂t = κ∇^{2}u', 'e^{x} = ∑ x^{n}⁄n!', 'ℏω', 'Γ(n) = (n−1)!'
  ];
  var EQH = 46, EQIMG = null, EQPOS = null;
  function parseEq(src) {                      // [{t: 文字列, k: 0 普通 / 1 上付き / −1 下付き}]
    var out = [], i = 0;
    while (i < src.length) {
      var c = src[i];
      if ((c === '^' || c === '_') && src[i + 1] === '{') {
        var j = src.indexOf('}', i), d = 1, k = i + 2;
        for (j = i + 2; j < src.length; j++) { if (src[j] === '{') d++; if (src[j] === '}' && --d === 0) break; }
        out.push({ t: src.slice(i + 2, j).replace(/[{}]/g, '').replace(/_|\^/g, ''), k: c === '^' ? 1 : -1 }); i = j + 1;
      } else { out.push({ t: c, k: 0 }); i++; }
    }
    return out;
  }
  function eqImage(src) {
    var parts = parseEq(src), big = '400 ' + EQH * .62 + 'px "Times New Roman", "STIX Two Math", serif', sm = '400 ' + EQH * .42 + 'px "Times New Roman", serif';
    var m = document.createElement('canvas').getContext('2d'), w = 8;
    parts.forEach(function (p) { m.font = p.k ? sm : big; p.w = m.measureText(p.t).width; w += p.w; });
    var c = document.createElement('canvas'); c.width = Math.ceil(w + 8); c.height = EQH;
    var g = c.getContext('2d'), x = 8;
    g.fillStyle = '#ffffff'; g.textBaseline = 'alphabetic';
    parts.forEach(function (p) {
      g.font = p.k ? sm : big;
      g.fillText(p.t, x, EQH * .7 + (p.k === 1 ? -EQH * .26 : p.k === -1 ? EQH * .12 : 0));
      x += p.w;
    });
    return c;
  }
  function eqInit() {
    EQIMG = EQS.map(eqImage);
    // 隙間なく敷き詰める：緯度の帯に分け（帯の高さ＝文字の大きさは帯ごとにばらつかせる）、
    // 各帯を一周ぶん、式を端から端まで並べて埋める
    EQPOS = [];
    var seed = 11, rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    var la = -1.48, j = 0;
    while (la < 1.48) {
      var h = .05 + rnd() * .1;                  // 帯の高さ（ラジアン）。0.05〜0.15
      var mid = la + h / 2, cl = Math.cos(mid);
      if (cl > .06) {
        var sRad = h * .98 / EQH, lo = rnd() * Math.PI * 2, end = lo + Math.PI * 2;
        while (true) {
          var img = EQIMG[(j * 7 + 3) % EQIMG.length]; j++;
          var wAng = img.width * sRad / cl;      // この緯度での、式の幅（経度の角度）
          if (lo + wAng > end + wAng * .35) break;
          EQPOS.push({ img: img, la: mid, lo: lo + wAng / 2, s: sRad });
          lo += wAng * .97;                      // ほんの少し重ねて、すき間を残さない
        }
      }
      la += h;
    }
  }
  function drawEqs(cx, cy, r) {
    if (!EQPOS) eqInit();
    var dd = .01;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    EQPOS.forEach(function (q) {
      var p = sph(q.la, q.lo, r);
      if (p[2] <= 0) return;                         // 裏側は描かない
      var pe = sph(q.la, q.lo + dd, r), pn = sph(q.la + dd, q.lo, r);
      var cl = Math.cos(q.la) || 1e-3;
      var ex = (pe[0] - p[0]) / (dd * r * cl), ey = (pe[1] - p[1]) / (dd * r * cl);   // 東向き（画面上）
      var nx = (pn[0] - p[0]) / (dd * r), ny = (pn[1] - p[1]) / (dd * r);             // 北向き（画面上）
      var ax = ex, ay = ey, bx = -nx, by = -ny;   // 文字の横＝東向き、下＝南向き
      var k = r * q.s;
      ctx.globalAlpha = Math.min(1, p[2] / r * 1.6) * .6;
      ctx.setTransform(DPR * ax * k, DPR * ay * k, DPR * bx * k, DPR * by * k, DPR * (cx + p[0]), DPR * (cy + p[1]));
      ctx.drawImage(q.img, -q.img.width / 2, -EQH / 2);
    });
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
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
    ctx.strokeStyle = 'rgba(255,255,255,.16)';
    for (var lo = 0; lo < 180; lo += 15) {             // 経線
      var a = [], b = [];
      for (var la = -90; la <= 90; la += 4) { a.push(sph(la * Math.PI / 180, lo * Math.PI / 180, r)); b.push(sph(la * Math.PI / 180, (lo + 180) * Math.PI / 180, r)); }
      line(a); line(b);
    }
    for (var lat = -75; lat <= 75; lat += 15) {         // 緯線
      var c = [];
      for (var l2 = 0; l2 <= 360; l2 += 4) c.push(sph(lat * Math.PI / 180, l2 * Math.PI / 180, r));
      ctx.strokeStyle = lat === 0 ? 'rgba(255,255,255,.4)' : 'rgba(255,255,255,.16)';
      line(c);
    }
    drawEqs(cx, cy, r);
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
      out.push({ ch: ch, P: P, T: T, U: U, N: N, z: P[2], size: size, depth: depth, proj: proj, F: F });
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
    // 正：外側の面がこちらを向いている。遠近があるので、視点（0, 0, F）から文字への向きで判定する
    // （法線の z 成分だけで判定すると、画面の端で表と裏の切り替わりがずれ、文字が逆回転して見える）
    var facing = -L.N[0] * L.P[0] - L.N[1] * L.P[1] + L.N[2] * (L.F - L.P[2]);
    // 厚みを画面上で何 px 動くかに合わせて層を重ねる（真横を向いた文字でも側面がつながって見えるように）
    var q0 = L.proj(L.P), q1 = L.proj([L.P[0] - L.N[0] * L.depth, L.P[1] - L.N[1] * L.depth, L.P[2] - L.N[2] * L.depth]);
    var K = Math.min(64, Math.max(6, Math.ceil(Math.hypot(q1[0] - q0[0], q1[1] - q0[1]) * 1.4)));
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
