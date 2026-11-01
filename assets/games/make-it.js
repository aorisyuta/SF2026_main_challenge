/*
  数字をつくれ（Aoristos のゲーム）
  数字カードを ＋ − × ÷ で組み合わせて、目標の数をつくる。90 秒で何問解けるか。
  ・出す問題はすべて、先に解けることを確かめてから出題する（solve）
  ・分数も扱う（途中で 7/2 などができてもよい）。0 で割ることはできない
  ・記録（モードごとの最高得点）はこの端末のブラウザに保存
*/
(() => {
  'use strict';

  /* ---------- 有理数（分数） ---------- */
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
  const R = (n, d = 1) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return { n: n / g, d: d / g }; };
  const eq = (a, b) => a.n === b.n && a.d === b.d;
  const OPS = {
    '+': (a, b) => R(a.n * b.d + b.n * a.d, a.d * b.d),
    '−': (a, b) => R(a.n * b.d - b.n * a.d, a.d * b.d),
    '×': (a, b) => R(a.n * b.n, a.d * b.d),
    '÷': (a, b) => (b.n === 0 ? null : R(a.n * b.d, a.d * b.n))
  };
  const fmt = v => (v.d === 1 ? String(v.n) : `${v.n}/${v.d}`).replace('-', '−');

  /* ---------- 解く（深さ優先で全探索） ---------- */
  // items: [{ v: 有理数, e: 式の文字列, p: 結合の強さ, id? }]
  // 目標に届けば { expr: 式, first: 最初に結ぶ 2 つと記号 } を返す（なければ null）
  // level: 2 = 途中の数がすべて 0 以上の整数 / 1 = すべて整数 / 0 = 分数・負の数も可
  function solve(items, target, first, level = 0) {
    if (items.length === 1) return eq(items[0].v, target) ? { expr: items[0].e, first } : null;
    for (let i = 0; i < items.length; i++) {
      for (let j = 0; j < items.length; j++) {
        if (i === j) continue;
        const a = items[i], b = items[j];
        for (const op of ['+', '−', '×', '÷']) {
          if ((op === '+' || op === '×') && i > j) continue;     // 入れ替えて同じになる組は片方だけ
          const v = OPS[op](a.v, b.v); if (!v) continue;
          if (Math.abs(v.n) > 1e6 || v.d > 1e6 || (level >= 1 && v.d !== 1) || (level >= 2 && v.n < 0)) continue;
          const prec = op === '+' || op === '−' ? 1 : 2;
          const wrap = (x, right) => (x.p < prec || (right && x.p === prec && (op === '−' || op === '÷')) ? `(${x.e})` : x.e);
          const node = { v, e: `${wrap(a, false)} ${op} ${wrap(b, true)}`, p: prec };
          const rest = items.filter((_, k) => k !== i && k !== j);
          const r = solve([...rest, node], target, first || { a, b, op, v }, level);
          if (r) return r;
        }
      }
    }
    return null;
  }
  const leaf = v => ({ v, e: fmt(v), p: 3 });
  // わかりやすい解（0 以上の整数だけ → 整数だけ → 分数も）を優先。minLevel より難しい解しかなければ null
  const solution = (vals, target, minLevel = 0) => {
    for (let lv = 2; lv >= minLevel; lv--) { const r = solve(vals.map(leaf), target, null, lv); if (r) return r.expr; }
    return null;
  };
  // 次の一手（最初に結ぶ 2 枚のカードと記号）
  function nextStep(cards, target) {
    const items = cards.map(c => ({ v: c.v, e: fmt(c.v), p: 3, id: c.id }));
    for (let lv = 2; lv >= 0; lv--) { const r = solve(items, target, null, lv); if (r) return r.first; }
    return null;
  }

  /* ---------- モード ---------- */
  const MODES = {
    ten: { name: '10 をつくれ', short: '10', n: 4, max: 9, target: () => R(10), for: '小学生から', minLevel: 2 },
    t24: { name: '24 をつくれ', short: '24', n: 4, max: 13, target: () => R(24), for: '中高生から' },
    chal: { name: 'チャレンジ', short: 'CH', n: 5, max: 9, target: () => R(11 + Math.floor(Math.random() * 89)), for: '腕に自信のある人' }
  };
  const TIME = 90;
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

  function makePuzzle(mode) {
    const M = MODES[mode];
    for (let tries = 0; tries < 500; tries++) {
      const target = M.target();
      const nums = Array.from({ length: M.n }, () => rnd(1, M.max));
      // 簡単すぎる組（全部同じ数など）は避ける
      if (new Set(nums).size < Math.min(3, M.n - 1)) continue;
      const vals = nums.map(x => R(x));
      const sol = solution(vals, target, M.minLevel);
      if (sol) return { target, nums, sol };
    }
    return { target: R(10), nums: [1, 2, 3, 4], sol: '1 + 2 + 3 + 4' };
  }

  /* ---------- 保存（失敗しても動く） ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('makeit:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('makeit:' + k, JSON.stringify(v)); } catch (e) { /* 保存できなくても動く */ } }
  };

  /* ---------- 画面 ---------- */
  const $ = s => document.querySelector(s);
  const root = $('#mk'); if (!root) return;
  const scr = { start: $('#mkStart'), play: $('#mkPlay'), result: $('#mkResult') };
  const el = {
    target: $('#mkTarget'), cards: $('#mkCards'), ops: $('#mkOps'), msg: $('#mkMsg'),
    time: $('#mkTime'), bar: $('#mkBar'), score: $('#mkScore'), streak: $('#mkStreak'), solved: $('#mkSolved'),
    mode: $('#mkModeName'), practice: $('#mkPractice'), stamp: $('#mkStamp')
  };

  let S = null;         // ゲーム全体の状態
  let P = null;         // いまの問題の状態
  let timerId = 0;

  function show(name) {
    Object.entries(scr).forEach(([k, s]) => { s.hidden = k !== name; });
    root.dataset.screen = name;
  }

  function renderBests() {
    document.querySelectorAll('[data-best]').forEach(b => {
      const v = store.get('best:' + b.dataset.best, 0);
      b.textContent = v ? `ベスト ${v} 点` : 'まだ記録なし';
    });
  }

  function start(mode) {
    const practice = el.practice.checked;
    S = { mode, practice, score: 0, solved: 0, streak: 0, best: store.get('best:' + mode, 0), left: TIME, last: null, hinted: false };
    el.mode.textContent = MODES[mode].name + (practice ? '（練習）' : '');
    root.classList.toggle('is-practice', practice);
    show('play');
    newPuzzle();
    clearInterval(timerId);
    if (!practice) {
      const t0 = performance.now();
      timerId = setInterval(() => {
        S.left = Math.max(0, TIME - (performance.now() - t0) / 1000);
        renderHud();
        if (S.left <= 0) finish();
      }, 100);
    }
    renderHud();
  }

  let uid = 0;
  function newPuzzle() {
    const pz = makePuzzle(S.mode);
    P = { pz, cards: pz.nums.map(n => ({ id: ++uid, v: R(n), e: String(n) })), hist: [], sel: null, op: null, hinted: false, done: false };
    S.last = pz;
    el.target.textContent = fmt(pz.target);
    setMsg('');
    render();
  }

  function renderHud() {
    el.score.textContent = S.score;
    el.streak.textContent = S.streak;
    el.solved.textContent = S.solved;
    if (!S.practice) {
      el.time.textContent = Math.ceil(S.left);
      el.bar.style.transform = `scaleX(${S.left / TIME})`;
      root.classList.toggle('is-hurry', S.left <= 10);
    }
  }

  function cardHtml(c) {
    const v = c.v;
    const num = v.d === 1
      ? `<span class="mk-n">${fmt(v)}</span>`
      : `<span class="mk-frac"><span>${(v.n < 0 ? '−' : '') + Math.abs(v.n)}</span><span>${v.d}</span></span>`;
    const sub = c.e !== fmt(v) ? `<span class="mk-e">${c.e}</span>` : '';
    return num + sub;
  }

  function render() {
    el.cards.innerHTML = '';
    P.cards.forEach(c => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mk-card' + (P.sel === c.id ? ' is-sel' : '') + (c.fresh ? ' is-new' : '');
      b.dataset.id = c.id;
      b.innerHTML = cardHtml(c);
      b.setAttribute('aria-label', fmt(c.v) + (P.sel === c.id ? '（選択中）' : ''));
      el.cards.appendChild(b);
      c.fresh = false;
    });
    el.cards.dataset.count = P.cards.length;
    el.ops.querySelectorAll('.mk-op').forEach(o => o.classList.toggle('is-sel', o.dataset.op === P.op));
    el.ops.classList.toggle('is-ready', P.sel != null);
    $('#mkUndo').disabled = !P.hist.length;
  }

  function setMsg(t, kind) {
    el.msg.textContent = t;
    el.msg.className = 'mk-msg' + (kind ? ' is-' + kind : '');
  }

  function pickCard(id) {
    if (P.done) return;
    if (P.sel == null) { P.sel = id; P.op = null; setMsg(''); return render(); }
    if (P.sel === id) { P.sel = null; P.op = null; return render(); }
    if (!P.op) { P.sel = id; return render(); }        // 記号を選ぶ前なら、選び直し
    const a = P.cards.find(c => c.id === P.sel), b = P.cards.find(c => c.id === id);
    const v = OPS[P.op](a.v, b.v);
    if (!v) { setMsg('0 で割ることはできません', 'warn'); P.op = null; return render(); }
    P.hist.push(P.cards.map(c => ({ ...c })));
    const prec = P.op === '+' || P.op === '−' ? 1 : 2;
    const wrapE = (x, right) => {
      const p = /[+−]/.test(x.e.replace(/^−/, '')) ? 1 : /[×÷]/.test(x.e) ? 2 : 3;
      return p < prec || (right && p === prec && (P.op === '−' || P.op === '÷')) ? `(${x.e})` : x.e;
    };
    const nc = { id: ++uid, v, e: `${wrapE(a, false)} ${P.op} ${wrapE(b, true)}`, fresh: true };
    const at = P.cards.indexOf(b);
    P.cards = P.cards.filter(c => c !== a && c !== b);
    P.cards.splice(Math.min(at, P.cards.length), 0, nc);
    P.sel = P.cards.length > 1 ? nc.id : null; P.op = null;
    render();
    if (P.cards.length === 1) check();
  }

  function check() {
    const c = P.cards[0];
    if (eq(c.v, P.pz.target)) return win(c.e);
    setMsg(`${fmt(c.v)} になりました。目標は ${fmt(P.pz.target)}。「戻す」でやり直せます`, 'ng');
    S.streak = 0; renderHud();
    root.classList.remove('shake'); void root.offsetWidth; root.classList.add('shake');
  }

  function win(expr) {
    P.done = true;
    S.solved++; S.streak++;
    const gain = Math.round(100 * (1 + 0.2 * (S.streak - 1)) * (P.hinted ? 0.5 : 1));
    S.score += gain;
    renderHud();
    setMsg(`${expr} = ${fmt(P.pz.target)}`, 'ok');
    el.stamp.innerHTML = `<b>${S.streak >= 3 ? S.streak + ' 連続！' : 'クリア'}</b><span>+${gain}</span>`;
    el.stamp.classList.remove('is-on'); void el.stamp.offsetWidth; el.stamp.classList.add('is-on');
    setTimeout(() => { if (scr.play.hidden) return; newPuzzle(); }, 900);
  }

  function undo() {
    if (!P.hist.length || P.done) return;
    P.cards = P.hist.pop(); P.sel = null; P.op = null; setMsg(''); render();
  }
  function reset() {
    if (P.done || !P.hist.length) return;
    P.cards = P.hist[0]; P.hist = []; P.sel = null; P.op = null; setMsg(''); render();
  }
  function hint() {
    if (P.done) return;
    const step = nextStep(P.cards, P.pz.target);
    if (!step) { setMsg('この形からは目標をつくれません。「戻す」か「最初から」を押してみよう', 'warn'); return; }
    P.hinted = true;
    P.sel = null; P.op = null; render();
    // 結ぶ 2 枚を光らせる
    [step.a.id, step.b.id].forEach(id => { const b = el.cards.querySelector(`[data-id="${id}"]`); if (b) b.classList.add('is-hint'); });
    setMsg(`ヒント：${fmt(step.a.v)} ${step.op} ${fmt(step.b.v)} = ${fmt(step.v)} から始めてみよう（得点は半分）`, 'hint');
  }
  function skip() {
    if (P.done) return;
    P.done = true;
    S.streak = 0; renderHud();
    setMsg(`答えの例：${P.pz.sol} = ${fmt(P.pz.target)}`, 'warn');
    setTimeout(() => { if (scr.play.hidden) return; newPuzzle(); }, 2200);
  }

  function finish() {
    clearInterval(timerId);
    const isBest = !S.practice && S.score > S.best;
    if (isBest) store.set('best:' + S.mode, S.score);
    $('#mkResScore').textContent = S.score;
    $('#mkResSolved').textContent = S.solved;
    $('#mkResBest').textContent = Math.max(S.best, S.practice ? S.best : S.score);
    $('#mkResNew').hidden = !isBest;
    $('#mkResMode').textContent = MODES[S.mode].name;
    const last = S.last && !P.done ? `最後の問題の答えの例：${S.last.sol} = ${fmt(S.last.target)}` : '';
    $('#mkResLast').textContent = last;
    show('result');
    renderBests();
  }

  /* ---------- 操作 ---------- */
  root.addEventListener('click', e => {
    const m = e.target.closest('[data-mode]'); if (m) return start(m.dataset.mode);
    const c = e.target.closest('.mk-card'); if (c) return pickCard(Number(c.dataset.id));
    const o = e.target.closest('.mk-op');
    if (o) {
      if (P && P.sel == null) { setMsg('先にカードを選んでください', 'warn'); return; }
      P.op = P.op === o.dataset.op ? null : o.dataset.op; return render();
    }
    const a = e.target.closest('[data-act]'); if (!a) return;
    ({ undo, reset, hint, skip, quit: finish, again: () => start(S.mode), menu: () => { clearInterval(timerId); show('start'); renderBests(); } })[a.dataset.act]();
  });
  // キーボード：数字キーでカード、+ - * / で記号、Backspace で戻す
  document.addEventListener('keydown', e => {
    if (scr.play.hidden || e.metaKey || e.ctrlKey || e.altKey) return;
    const map = { '+': '+', '-': '−', '*': '×', 'x': '×', '/': '÷' };
    if (map[e.key]) { e.preventDefault(); el.ops.querySelector(`[data-op="${map[e.key]}"]`).click(); return; }
    if (/^[1-9]$/.test(e.key)) { const b = el.cards.querySelectorAll('.mk-card')[Number(e.key) - 1]; if (b) { e.preventDefault(); b.click(); } return; }
    if (e.key === 'Backspace') { e.preventDefault(); undo(); }
  });

  renderBests();
  show('start');
})();
