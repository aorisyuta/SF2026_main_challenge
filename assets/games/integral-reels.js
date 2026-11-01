/*
  積分リール（Aoristos のゲーム）
  元のファイルから AI 解説（Claude アーティファクト専用の機能）を外し、サイト内で動くようにしたもの。
  数式の表示は assets/vendor/mathjax/tex-svg.js（サイト内に置いた MathJax 3.2.2）。
  構成：式エンジン → 厳密計算エンジン → 問題生成器 → 画面
*/
(() => {
// ===================== 式エンジン =====================
// ===================== 式エンジン =====================
const FUNCS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, exp: Math.exp, log: Math.log, ln: Math.log,
  sqrt: Math.sqrt, atan: Math.atan, arctan: Math.atan, asin: Math.asin, arcsin: Math.asin,
  acos: Math.acos, arccos: Math.acos, abs: Math.abs, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  sec: x => 1 / Math.cos(x), csc: x => 1 / Math.sin(x), cot: x => 1 / Math.tan(x)
};
const NAMES = [...Object.keys(FUNCS), 'pi', 'e', 'x'];

function lex(src) {
  const s = String(src).replace(/\*\*/g, '^').replace(/\s+/g, '');
  const t = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) {
      let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++;
      t.push({ k: 'num', v: s.slice(i, j) }); i = j; continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      let j = i; while (j < s.length && /[a-zA-Z]/.test(s[j])) j++;
      let w = s.slice(i, j); i = j;
      while (w.length) {
        let m = null;
        for (const n of NAMES) if (w.startsWith(n) && (!m || n.length > m.length)) m = n;
        if (!m) throw new Error('unknown name: ' + w);
        t.push(FUNCS[m] ? { k: 'fn', v: m } : { k: 'id', v: m });
        w = w.slice(m.length);
      }
      continue;
    }
    if (c === 'π') { t.push({ k: 'id', v: 'pi' }); i++; continue; }
    if (c === '√') { t.push({ k: 'fn', v: 'sqrt' }); i++; continue; }
    if (c === '×' || c === '·') { t.push({ k: 'op', v: '*' }); i++; continue; }
    if (c === '÷') { t.push({ k: 'op', v: '/' }); i++; continue; }
    if (c === '−') { t.push({ k: 'op', v: '-' }); i++; continue; }
    if ('+-*/^()'.includes(c)) { t.push({ k: 'op', v: c }); i++; continue; }
    if (c === '[' ) { t.push({ k: 'op', v: '(' }); i++; continue; }
    if (c === ']' ) { t.push({ k: 'op', v: ')' }); i++; continue; }
    throw new Error('bad char: ' + c);
  }
  return t;
}

function parse(src) {
  const t = typeof src === 'string' ? lex(src) : src;
  let p = 0;
  const peek = () => t[p];
  const isOp = (v) => t[p] && t[p].k === 'op' && t[p].v === v;
  const startsPrimary = () => {
    const k = t[p]; if (!k) return false;
    return k.k === 'num' || k.k === 'id' || k.k === 'fn' || (k.k === 'op' && k.v === '(');
  };
  function expr() {
    let l = term();
    while (isOp('+') || isOp('-')) { const op = t[p++].v; l = { t: 'bin', op, l, r: term() }; }
    return l;
  }
  function term() {
    let l = unary();
    for (;;) {
      if (isOp('*') || isOp('/')) { const op = t[p++].v; l = { t: 'bin', op, l, r: unary() }; }
      else if (startsPrimary()) { l = { t: 'bin', op: '*', l, r: power(), imp: true }; }
      else break;
    }
    return l;
  }
  function unary() {
    if (isOp('-')) { p++; return { t: 'neg', a: unary() }; }
    if (isOp('+')) { p++; return unary(); }
    return power();
  }
  function power() {
    const b = primary();
    if (isOp('^')) { p++; return { t: 'bin', op: '^', l: b, r: unary() }; }
    return b;
  }
  function primary() {
    const k = peek();
    if (!k) throw new Error('unexpected end');
    if (k.k === 'num') { p++; if (!/^\d*\.?\d+$|^\d+\.$/.test(k.v)) throw new Error('bad number'); return { t: 'num', v: k.v }; }
    if (k.k === 'id') { p++; return { t: 'id', v: k.v }; }
    if (k.k === 'fn') {
      p++;
      // sin^2(x) 形式
      if (isOp('^')) {
        p++; const ex = unary();
        const a = primary();
        return { t: 'bin', op: '^', l: { t: 'fn', f: k.v, a }, r: ex };
      }
      return { t: 'fn', f: k.v, a: isOp('(') ? primary() : power() };
    }
    if (k.k === 'op' && k.v === '(') {
      p++; const a = expr();
      if (!isOp(')')) throw new Error('missing )');
      p++; return { t: 'par', a };
    }
    throw new Error('unexpected ' + k.v);
  }
  const r = expr();
  if (p !== t.length) throw new Error('trailing tokens');
  return r;
}

function evalAst(n, x) {
  switch (n.t) {
    case 'num': return parseFloat(n.v);
    case 'id': return n.v === 'pi' ? Math.PI : n.v === 'e' ? Math.E : x;
    case 'par': return evalAst(n.a, x);
    case 'neg': return -evalAst(n.a, x);
    case 'fn': return FUNCS[n.f](evalAst(n.a, x));
    case 'bin': {
      const a = evalAst(n.l, x), b = evalAst(n.r, x);
      switch (n.op) { case '+': return a + b; case '-': return a - b; case '*': return a * b; case '/': return a / b; case '^': return Math.pow(a, b); }
    }
  }
  return NaN;
}
function hasX(n) {
  if (!n) return false;
  if (n.t === 'id') return n.v === 'x';
  return hasX(n.a) || hasX(n.l) || hasX(n.r);
}
function compile(src) { const ast = parse(src); return x => evalAst(ast, x); }
function evalConst(src) { return evalAst(parse(src), NaN); }

// ---- AST → LaTeX（キーパッド表示用）----
const strip = n => (n && n.t === 'par') ? n.a : n;
function leftmost(n) { while (n.t === 'bin') n = n.l; return n; }
function isAtom(n) { return n.t === 'num' || n.t === 'id' || n.t === 'par'; }
function toTex(n) {
  switch (n.t) {
    case 'num': return n.v;
    case 'id': return n.v === 'pi' ? '\\pi ' : n.v;
    case 'par': return '\\left(' + toTex(n.a) + '\\right)';
    case 'neg': return '-' + toTex(n.a);
    case 'fn': {
      const a = strip(n.a);
      if (n.f === 'sqrt') return '\\sqrt{' + toTex(a) + '}';
      const name = { log: '\\log', ln: '\\log', exp: '\\exp', abs: '' }[n.f] ?? ('\\' + n.f);
      if (n.f === 'abs') return '\\left|' + toTex(a) + '\\right|';
      return name + (isAtom(a) && a.t !== 'par' ? ' ' + toTex(a) : '\\left(' + toTex(a) + '\\right)');
    }
    case 'bin': {
      if (n.op === '+') return toTex(n.l) + '+' + toTex(n.r);
      if (n.op === '-') return toTex(n.l) + '-' + toTex(n.r);
      if (n.op === '/') return '\\frac{' + toTex(strip(n.l)) + '}{' + toTex(strip(n.r)) + '}';
      if (n.op === '^') {
        const b = n.l;
        const bt = (b.t === 'num' || b.t === 'id' || b.t === 'par') ? toTex(b) : '\\left(' + toTex(b) + '\\right)';
        return '{' + bt + '}^{' + toTex(strip(n.r)) + '}';
      }
      // '*'
      const lm = leftmost(n.r);
      const needDot = lm.t === 'num' || n.r.t === 'neg' || n.l.t === 'neg' && false;
      return toTex(n.l) + (needDot ? '\\cdot ' : ' ') + toTex(n.r);
    }
  }
  return '';
}

// ---- 数値積分（二重指数型 tanh-sinh）----
function integrate(f, a, b, pieces = 12) {
  let s = 0;
  for (let i = 0; i < pieces; i++) s += integrate1(f, a + (b - a) * i / pieces, a + (b - a) * (i + 1) / pieces);
  return s;
}
function integrate1(f, a, b) {
  const c = (a + b) / 2, d = (b - a) / 2;
  let prev = null, I = 0;
  for (let L = 0; L <= 8; L++) {
    const h = Math.pow(2, -L);
    let s = 0;
    const N = Math.ceil(3.6 / h);
    for (let k = -N; k <= N; k++) {
      const tt = k * h;
      const u = Math.PI / 2 * Math.sinh(tt);
      const ch = Math.cosh(u);
      const w = Math.PI / 2 * Math.cosh(tt) / (ch * ch);
      let x;
      if (tt >= 0) { const gap = d * 2 / (Math.exp(2 * u) + 1); x = b - gap; if (gap === 0 || x === b) continue; }
      else { const gap = d * 2 / (Math.exp(-2 * u) + 1); x = a + gap; if (gap === 0 || x === a) continue; }
      const y = f(x);
      if (Number.isFinite(y)) s += y * w;
    }
    I = s * h * d;
    if (prev !== null && L >= 4 && Math.abs(I - prev) <= 1e-12 * Math.max(1, Math.abs(I))) break;
    prev = I;
  }
  return I;
}



// ===================== 厳密計算エンジン =====================
// ===================== 厳密計算エンジン =====================
// Q: BigInt 有理数 / X: 有理数係数 × (π, e, √n, log p, その他の定数) の単項式の和 / Ex: 記号式
const bgcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
class Q {
  constructor(n, d = 1n) {
    n = BigInt(n); d = BigInt(d);
    if (d === 0n) throw new Error('Q: division by zero');
    if (d < 0n) { n = -n; d = -d; }
    const g = bgcd(n, d) || 1n; this.n = n / g; this.d = d / g;
  }
  add(o) { o = q(o); return new Q(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { o = q(o); return new Q(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { o = q(o); return new Q(this.n * o.n, this.d * o.d); }
  div(o) { o = q(o); return new Q(this.n * o.d, this.d * o.n); }
  neg() { return new Q(-this.n, this.d); }
  abs() { return this.n < 0n ? this.neg() : this; }
  isZero() { return this.n === 0n; }
  isOne() { return this.n === 1n && this.d === 1n; }
  isInt() { return this.d === 1n; }
  sign() { return this.n > 0n ? 1 : this.n < 0n ? -1 : 0; }
  num() { return Number(this.n) / Number(this.d); }
  eq(o) { o = q(o); return this.n === o.n && this.d === o.d; }
  powi(k) { let r = new Q(1); const b = k < 0 ? new Q(this.d, this.n) : this; for (let i = 0; i < Math.abs(k); i++) r = r.mul(b); return r; }
  floor() { let f = this.n / this.d; if (this.n < 0n && f * this.d !== this.n) f -= 1n; return f; }
  tex() {
    if (this.d === 1n) return String(this.n);
    const s = this.n < 0n ? '-' : '';
    return s + '\\frac{' + String(this.n < 0n ? -this.n : this.n) + '}{' + String(this.d) + '}';
  }
  str() { return this.d === 1n ? String(this.n) : '(' + this.n + '/' + this.d + ')'; }
}
function q(x, y) { if (x instanceof Q) return x; return new Q(x, y === undefined ? 1n : y); }
const Q0 = q(0), Q1 = q(1);
function factorInt(n) { // n: BigInt > 0 → Map prime -> exp
  const f = new Map(); let p = 2n;
  if (n > 10n ** 12n) throw new Error('too large to factor');
  while (p * p <= n) { while (n % p === 0n) { f.set(p, (f.get(p) || 0) + 1); n /= p; } p += p === 2n ? 1n : 2n; }
  if (n > 1n) f.set(n, (f.get(n) || 0) + 1);
  return f;
}

// ---- 原子定数 ----
const ATOM = {
  pi: { tex: '\\pi', v: Math.PI, ord: 2 },
  e: { tex: 'e', v: Math.E, ord: 3 },
};
function sqrtAtomName(n) { const k = 'r' + n; if (!ATOM[k]) ATOM[k] = { tex: '\\sqrt{' + n + '}', v: Math.sqrt(Number(n)), ord: 1, rad: BigInt(n) }; return k; }
function logAtomName(p) { const k = 'l' + p; if (!ATOM[k]) ATOM[k] = { tex: '\\log ' + p, v: Math.log(Number(p)), ord: 4, log: true }; return k; }
function genAtomName(key, tex, v) { const k = 'g:' + key; if (!ATOM[k]) ATOM[k] = { tex, v, ord: 5, gen: true }; return k; }
ATOM.L12 = { tex: '\\log\\left(1+\\sqrt{2}\\right)', v: Math.log(1 + Math.SQRT2), ord: 4, log: true };
ATOM.L23 = { tex: '\\log\\left(2+\\sqrt{3}\\right)', v: Math.log(2 + Math.sqrt(3)), ord: 4, log: true };

function monoKey(m) { return Object.keys(m).filter(k => m[k] !== 0).sort().map(k => k + '^' + m[k]).join('*'); }
function normMono(m) { // returns {c: Q, m}
  let c = Q1; let rad = 1n; const out = {};
  for (const k of Object.keys(m)) {
    const e = m[k]; if (!e) continue;
    if (ATOM[k] && ATOM[k].rad) {
      const N = ATOM[k].rad;
      const kk = Math.floor(e / 2), r = e - 2 * kk;
      c = c.mul(kk >= 0 ? q(N ** BigInt(kk)) : q(1n, N ** BigInt(-kk)));
      if (r) rad *= N;
    } else out[k] = e;
  }
  if (rad > 1n) {
    const f = factorInt(rad); let s = 1n, t = 1n;
    for (const [p, e] of f) { s *= p ** BigInt(Math.floor(e / 2)); if (e % 2) t *= p; }
    c = c.mul(q(s)); if (t > 1n) out[sqrtAtomName(t)] = 1;
  }
  return { c, m: out };
}
class X {
  constructor(t) { this.t = t || new Map(); } // key -> {c, m}
  static r(a, b) { const x = new X(); const v = q(a, b); if (!v.isZero()) x.t.set('', { c: v, m: {} }); return x; }
  static atom(k, e = 1) { const x = new X(); const nm = normMono({ [k]: e }); if (!nm.c.isZero()) x.t.set(monoKey(nm.m), nm); return x; }
  static get pi() { return X.atom('pi'); }
  static get e() { return X.atom('e'); }
  static sqrtInt(n) { return X.atom(sqrtAtomName(BigInt(n))); }
  clone() { return new X(new Map(this.t)); }
  add(o) {
    o = toX(o); const t = new Map(this.t);
    for (const [k, v] of o.t) {
      const w = t.get(k); const c = w ? w.c.add(v.c) : v.c;
      if (c.isZero()) t.delete(k); else t.set(k, { c, m: v.m });
    }
    return new X(t);
  }
  neg() { const t = new Map(); for (const [k, v] of this.t) t.set(k, { c: v.c.neg(), m: v.m }); return new X(t); }
  sub(o) { return this.add(toX(o).neg()); }
  scale(c) { c = q(c); if (c.isZero()) return new X(); const t = new Map(); for (const [k, v] of this.t) t.set(k, { c: v.c.mul(c), m: v.m }); return new X(t); }
  mul(o) {
    o = toX(o); let r = new X();
    for (const a of this.t.values()) for (const b of o.t.values()) {
      const m = { ...a.m }; for (const k in b.m) m[k] = (m[k] || 0) + b.m[k];
      const nm = normMono(m); const c = a.c.mul(b.c).mul(nm.c);
      const one = new X(); if (!c.isZero()) one.t.set(monoKey(nm.m), { c, m: nm.m });
      r = r.add(one);
    }
    return r;
  }
  inv() {
    if (this.t.size === 0) throw new Error('X: 1/0');
    if (this.t.size === 1) {
      const [v] = this.t.values(); const m = {}; for (const k in v.m) m[k] = -v.m[k];
      const nm = normMono(m); const x = new X(); x.t.set(monoKey(nm.m), { c: Q1.div(v.c).mul(nm.c), m: nm.m }); return x;
    }
    // a + b√n 型は有理化
    if (this.t.size === 2 && this.t.has('')) {
      const other = [...this.t.keys()].find(k => k !== '');
      const mo = this.t.get(other).m; const ks = Object.keys(mo);
      if (ks.length === 1 && ATOM[ks[0]].rad && mo[ks[0]] === 1) {
        const a = this.t.get('').c, b = this.t.get(other).c, n = q(ATOM[ks[0]].rad);
        const den = a.mul(a).sub(b.mul(b).mul(n));
        const conj = X.r(a.n, a.d).sub(X.atom(ks[0]).scale(b));
        return conj.scale(Q1.div(den));
      }
    }
    throw new Error('X: cannot invert ' + this.tex());
  }
  div(o) { return this.mul(toX(o).inv()); }
  powi(k) { let r = X.r(1); const b = k < 0 ? this.inv() : this; for (let i = 0; i < Math.abs(k); i++) r = r.mul(b); return r; }
  isZero() { return this.t.size === 0; }
  isRat() { return this.t.size === 0 || (this.t.size === 1 && this.t.has('')); }
  rat() { return this.t.size === 0 ? Q0 : this.t.get('').c; }
  // 有理数 × π の形なら有理係数を返す
  piCoef() { if (this.t.size === 0) return Q0; if (this.t.size === 1 && this.t.has('pi^1')) return this.t.get('pi^1').c; return null; }
  hasGen() { for (const v of this.t.values()) for (const k in v.m) if (ATOM[k] && ATOM[k].gen) return true; return false; }
  num() {
    let s = 0;
    for (const v of this.t.values()) { let p = v.c.num(); for (const k in v.m) p *= Math.pow(ATOM[k].v, v.m[k]); s += p; }
    return s;
  }
  tex() {
    if (this.t.size === 0) return '0';
    let terms = [...this.t.values()].sort((a, b) => termOrd(a) - termOrd(b));
    if (terms[0].c.sign() < 0) { const i = terms.findIndex(v => v.c.sign() > 0); if (i > 0) terms = [terms[i], ...terms.slice(0, i), ...terms.slice(i + 1)]; }
    let out = '';
    terms.forEach((v, i) => {
      const neg = v.c.sign() < 0; const c = v.c.abs();
      const numA = [], denA = [];
      Object.keys(v.m).sort((a, b) => ATOM[a].ord - ATOM[b].ord || (a < b ? -1 : 1)).forEach(k => { const e = v.m[k]; if (e > 0) numA.push(atomPow(k, e)); else if (e < 0) denA.push(atomPow(k, -e)); });
      const nt = numA.join('\\,'), dt = denA.join('\\,');
      let s;
      const cn = c.n, cd = c.d;
      if (!dt && cd === 1n) s = cn === 1n ? (nt || '1') : String(cn) + nt;
      else s = '\\frac{' + (cn === 1n ? (nt || '1') : String(cn) + nt) + '}{' + (cd === 1n ? '' : String(cd)) + dt + '}';
      if (i === 0) out += (neg ? '-' : '') + s; else out += (neg ? '-' : '+') + s;
    });
    return out;
  }
}
function termOrd(v) { const ks = Object.keys(v.m); if (!ks.length) return 100; return Math.min(...ks.map(k => ATOM[k].ord)) ; }
function atomPow(k, e) {
  const A = ATOM[k];
  if (e === 1) return A.tex;
  if (A.log || A.gen) return '\\left(' + A.tex + '\\right)^{' + e + '}';
  return A.tex + '^{' + e + '}';
}
function toX(v) { if (v instanceof X) return v; if (v instanceof Q) return X.r(v.n, v.d); return X.r(v); }

// ---- 厳密な関数値 ----
const R2 = () => X.sqrtInt(2), R3 = () => X.sqrtInt(3), R6 = () => X.sqrtInt(6);
const SIN12 = () => [X.r(0), R6().sub(R2()).scale(q(1, 4)), X.r(1, 2), R2().scale(q(1, 2)), R3().scale(q(1, 2)), R6().add(R2()).scale(q(1, 4)), X.r(1)];
const TAN12 = () => [X.r(0), X.r(2).sub(R3()), R3().scale(q(1, 3)), X.r(1), R3(), X.r(2).add(R3())];
function piMult(x) { const c = toX(x).piCoef(); if (!c) throw new Error('not a rational multiple of π'); const k = c.mul(12); if (!k.isInt()) throw new Error('angle not multiple of π/12'); return Number(((k.n % 24n) + 24n) % 24n); }
function sinX(x) { const j = piMult(x); const t = SIN12(); if (j <= 6) return t[j]; if (j <= 12) return t[12 - j]; if (j <= 18) return t[j - 12].neg(); return t[24 - j].neg(); }
function cosX(x) { return sinX(toX(x).add(X.pi.scale(q(1, 2)))); }
function tanX(x) { const j = piMult(x) % 12; if (j === 6) throw new Error('tan undefined'); const t = TAN12(); return j < 6 ? t[j] : t[12 - j].neg(); }
function atanX(x) {
  const v = toX(x).num();
  for (let j = -11; j <= 11; j++) if (Math.abs(Math.tan(j * Math.PI / 24) - v) < 1e-11 * Math.max(1, Math.abs(v))) return X.pi.scale(q(j, 24));
  throw new Error('atan not nice');
}
function sqrtX(x) {
  x = toX(x);
  if (x.isRat()) {
    const r = x.rat(); if (r.sign() < 0) throw new Error('sqrt of negative'); if (r.isZero()) return X.r(0);
    return X.atom(sqrtAtomName(r.n * r.d)).scale(q(1n, r.d));
  }
  if (x.t.size === 1) {
    const [v] = x.t.values();
    if (v.c.sign() > 0 && Object.values(v.m).every(e => e % 2 === 0) && !Object.keys(v.m).some(k => ATOM[k].rad)) {
      const m = {}; for (const k in v.m) m[k] = v.m[k] / 2;
      return sqrtX(X.r(v.c.n, v.c.d)).mul(Object.keys(m).reduce((acc, k) => acc.mul(X.atom(k, m[k])), X.r(1)));
    }
  }
  return X.atom(genAtomName('sqrt(' + x.tex() + ')', '\\sqrt{' + x.tex() + '}', Math.sqrt(x.num())));
}
function logRat(r) {
  if (r.sign() <= 0) throw new Error('log of nonpositive');
  let out = new X();
  for (const [p, e] of factorInt(r.n)) out = out.add(X.atom(logAtomName(p)).scale(e));
  for (const [p, e] of factorInt(r.d)) out = out.sub(X.atom(logAtomName(p)).scale(e));
  return out;
}
function logX(x) {
  x = toX(x);
  const v = x.num(); if (!(v > 0)) throw new Error('log of nonpositive');
  if (x.t.size === 1) {
    const [t] = x.t.values();
    let out = logRat(t.c);
    for (const k in t.m) {
      const e = t.m[k];
      if (k === 'e') out = out.add(X.r(e));
      else if (ATOM[k].rad) out = out.add(logRat(q(ATOM[k].rad)).scale(q(e, 2)));
      else if (k === 'pi') out = out.add(X.atom(genAtomName('logpi', '\\log\\pi', Math.log(Math.PI))).scale(e));
      else out = out.add(X.atom(genAtomName('log(' + ATOM[k].tex + ')', '\\log ' + ATOM[k].tex, Math.log(ATOM[k].v))).scale(e));
    }
    return out;
  }
  const ln = Math.log(v);
  for (const [k, base] of [['L12', Math.log(1 + Math.SQRT2)], ['L23', Math.log(2 + Math.sqrt(3))]])
    for (let j = -4; j <= 4; j++) if (j && Math.abs(ln - j * base) < 1e-11) return X.atom(k).scale(j);
  return X.atom(genAtomName('log(' + x.tex() + ')', '\\log\\left(' + x.tex() + '\\right)', ln));
}
function expX(x) {
  x = toX(x);
  let res = X.r(1); let rest = new X();
  for (const [key, v] of x.t) {
    const ks = Object.keys(v.m);
    if (key === '') { if (v.c.isInt()) res = res.mul(X.atom('e', Number(v.c.n))); else rest = rest.add(X.r(v.c.n, v.c.d)); continue; }
    if (ks.length === 1 && v.m[ks[0]] === 1 && ATOM[ks[0]].log) {
      const k = ks[0], c = v.c;
      const base = k === 'L12' ? X.r(1).add(R2()) : k === 'L23' ? X.r(2).add(R3()) : X.r(BigInt(k.slice(1)));
      if (c.isInt()) { res = res.mul(base.powi(Number(c.n))); continue; }
      if (c.mul(2).isInt() && base.isRat()) { res = res.mul(sqrtX(base).powi(Number(c.mul(2).n))); continue; }
    }
    rest = rest.add(new X(new Map([[key, v]])));
  }
  if (!rest.isZero()) res = res.mul(X.atom(genAtomName('exp(' + rest.tex() + ')', 'e^{' + rest.tex() + '}', Math.exp(rest.num()))));
  return res;
}

// ===================== 記号式 Ex =====================
const N = (a, b) => ({ k: 'n', q: q(a, b) });
const VX = { k: 'x' }, PI = { k: 'c', c: 'pi' }, EC = { k: 'c', c: 'e' };
const isN = (e, v) => e.k === 'n' && (v === undefined || e.q.eq(v));
function keyOf(e) {
  switch (e.k) {
    case 'n': return 'n' + e.q.n + '/' + e.q.d;
    case 'c': return e.c; case 'x': return 'x';
    case 'add': return '+(' + e.a.map(keyOf).join(',') + ')';
    case 'mul': return '*(' + e.a.map(keyOf).join(',') + ')';
    case 'pow': return '^(' + keyOf(e.b) + ',' + keyOf(e.e) + ')';
    case 'f': return e.f + '(' + keyOf(e.a) + ')';
  }
}
function splitCoef(t) {
  if (t.k === 'n') return [t.q, null];
  if (t.k === 'mul' && t.a[0].k === 'n') { const rest = t.a.slice(1); return [t.a[0].q, rest.length === 1 ? rest[0] : { k: 'mul', a: rest }]; }
  return [Q1, t];
}
function add(...ts) {
  const flat = [];
  for (const t of ts.flat()) { if (!t) continue; if (t.k === 'add') flat.push(...t.a); else flat.push(t); }
  const groups = new Map(); let cst = Q0;
  for (const t of flat) {
    const [c, r] = splitCoef(t);
    if (!r) { cst = cst.add(c); continue; }
    const k = keyOf(r); const g = groups.get(k);
    if (g) g.c = g.c.add(c); else groups.set(k, { c, r });
  }
  const out = [];
  for (const { c, r } of groups.values()) { if (c.isZero()) continue; out.push(c.isOne() ? r : mul(N(c), r)); }
  if (!cst.isZero()) out.push(N(cst));
  if (!out.length) return N(0);
  if (out.length === 1) return out[0];
  return { k: 'add', a: out };
}
const RANK = e => e.k === 'n' ? 0 : e.k === 'c' ? 1 : (e.k === 'x' || (e.k === 'pow' && e.b.k === 'x')) ? 2 : (e.k === 'pow' && e.b.k === 'add') ? 5 : e.k === 'add' ? 5 : 3;
function baseExp(e) { if (e.k === 'pow') return [e.b, e.e]; return [e, N(1)]; }
function mul(...fs) {
  const flat = [];
  for (const f of fs.flat()) { if (!f) continue; if (f.k === 'mul') flat.push(...f.a); else flat.push(f); }
  let c = Q1; const groups = new Map();
  for (const f of flat) {
    if (f.k === 'n') { c = c.mul(f.q); continue; }
    const [b, e] = baseExp(f); const k = keyOf(b); const g = groups.get(k);
    if (g) g.e = add(g.e, e); else groups.set(k, { b, e });
  }
  if (c.isZero()) return N(0);
  let out = [];
  for (const { b, e } of groups.values()) {
    const p = pow(b, e);
    if (p.k === 'n') c = c.mul(p.q); else if (p.k === 'mul') { for (const z of p.a) { if (z.k === 'n') c = c.mul(z.q); else out.push(z); } } else out.push(p);
  }
  out = out.map((f, i) => [f, i]).sort((a, b) => RANK(a[0]) - RANK(b[0]) || a[1] - b[1]).map(z => z[0]);
  if (!out.length) return N(c);
  if (c.isOne() && out.length === 1) return out[0];
  return { k: 'mul', a: c.isOne() ? out : [N(c), ...out] };
}
function pow(b, e) {
  if (typeof e === 'number') e = N(e);
  if (e.k === 'n') {
    if (e.q.isZero()) return N(1);
    if (e.q.isOne()) return b;
    if (b.k === 'n') {
      if (e.q.isInt()) return N(b.q.powi(Number(e.q.n)));
      if (b.q.isOne()) return N(1);
    }
    if (b.k === 'pow' && b.e.k === 'n') return pow(b.b, N(b.e.q.mul(e.q)));
    if (b.k === 'mul') return mul(...b.a.map(z => pow(z, e)));
    if (b.k === 'f' && b.f === 'exp') return fn('exp', mul(e, b.a));
  }
  return { k: 'pow', b, e };
}
function fn(f, a) {
  if (f === 'sqrt') return pow(a, N(1, 2));
  if (f === 'exp') { if (isN(a, 0)) return N(1); if (a.k === 'f' && a.f === 'log') return a.a; }
  if (f === 'log') { if (isN(a, 1)) return N(0); if (a.k === 'f' && a.f === 'exp') return a.a; if (a.k === 'c' && a.c === 'e') return N(1); }
  if ((f === 'sin' || f === 'tan') && isN(a, 0)) return N(0);
  if (f === 'cos' && isN(a, 0)) return N(1);
  return { k: 'f', f, a };
}
const neg = a => mul(N(-1), a);
const sub = (a, b) => add(a, neg(b));
const dv = (a, b) => mul(a, pow(b, N(-1)));
const sin = a => fn('sin', a), cos = a => fn('cos', a), tan = a => fn('tan', a), exp = a => fn('exp', a), log = a => fn('log', a), sqrt = a => fn('sqrt', a);
const xp = n => pow(VX, N(n));

function hasXv(e) { if (e.k === 'x') return true; if (e.k === 'add' || e.k === 'mul') return e.a.some(hasXv); if (e.k === 'pow') return hasXv(e.b) || hasXv(e.e); if (e.k === 'f') return hasXv(e.a); return false; }
function diff(e) {
  switch (e.k) {
    case 'n': case 'c': return N(0);
    case 'x': return N(1);
    case 'add': return add(...e.a.map(diff));
    case 'mul': return add(...e.a.map((f, i) => mul(diff(f), ...e.a.filter((_, j) => j !== i))));
    case 'pow': {
      const b = e.b, ex = e.e;
      if (!hasXv(ex)) return mul(ex, pow(b, add(ex, N(-1))), diff(b));
      if (!hasXv(b)) return mul(e, log(b), diff(ex));
      return mul(e, add(mul(diff(ex), log(b)), mul(ex, diff(b), pow(b, N(-1)))));
    }
    case 'f': {
      const a = e.a, da = diff(a);
      switch (e.f) {
        case 'sin': return mul(cos(a), da);
        case 'cos': return mul(N(-1), sin(a), da);
        case 'tan': return mul(pow(cos(a), N(-2)), da);
        case 'exp': return mul(e, da);
        case 'log': return mul(da, pow(a, N(-1)));
      }
    }
  }
  throw new Error('diff: ' + e.k);
}
function subst(e, v) {
  switch (e.k) {
    case 'x': return v;
    case 'n': case 'c': return e;
    case 'add': return add(...e.a.map(z => subst(z, v)));
    case 'mul': return mul(...e.a.map(z => subst(z, v)));
    case 'pow': return pow(subst(e.b, v), subst(e.e, v));
    case 'f': return fn(e.f, subst(e.a, v));
  }
}
const NF = { sin: Math.sin, cos: Math.cos, tan: Math.tan, exp: Math.exp, log: Math.log };
function evalN(e, x) {
  switch (e.k) {
    case 'n': return e.q.num();
    case 'c': return e.c === 'pi' ? Math.PI : Math.E;
    case 'x': return x;
    case 'add': { let s = 0; for (const z of e.a) s += evalN(z, x); return s; }
    case 'mul': { let s = 1; for (const z of e.a) s *= evalN(z, x); return s; }
    case 'pow': return Math.pow(evalN(e.b, x), evalN(e.e, x));
    case 'f': return NF[e.f](evalN(e.a, x));
  }
}
function evalX(e, x) {
  switch (e.k) {
    case 'n': return X.r(e.q.n, e.q.d);
    case 'c': return e.c === 'pi' ? X.pi : X.e;
    case 'x': return toX(x);
    case 'add': return e.a.reduce((s, z) => s.add(evalX(z, x)), X.r(0));
    case 'mul': return e.a.reduce((s, z) => s.mul(evalX(z, x)), X.r(1));
    case 'pow': {
      const P = evalX(e.e, x);
      if (e.b.k === 'c' && e.b.c === 'e') return expX(P);
      const B = evalX(e.b, x);
      if (P.isRat()) {
        const r = P.rat();
        if (r.isInt()) return B.powi(Number(r.n));
        if (r.mul(2).isInt()) return sqrtX(B).powi(Number(r.mul(2).n));
        throw new Error('fractional power');
      }
      if (B.isRat() && B.rat().isOne()) return X.r(1);
      return expX(P.mul(logX(B)));
    }
    case 'f': {
      const A = evalX(e.a, x);
      switch (e.f) { case 'sin': return sinX(A); case 'cos': return cosX(A); case 'tan': return tanX(A); case 'exp': return expX(A); case 'log': return logX(A); }
    }
  }
  throw new Error('evalX');
}

// ---- 記号式 → LaTeX ----
function isAtomic(e) { return e.k === 'x' || e.k === 'c' || (e.k === 'n' && e.q.sign() >= 0 && e.q.isInt()); }
function argTex(a) {
  if (isAtomic(a)) return ' ' + tex(a);
  if (a.k === 'mul' && a.a.every(z => z.k === 'n' || z.k === 'c' || z.k === 'x') && !(a.a[0].k === 'n' && a.a[0].q.sign() < 0)) return ' ' + tex(a);
  if (a.k === 'pow' && a.b.k === 'x' && a.e.k === 'n' && a.e.q.isInt()) return '\\left(' + tex(a) + '\\right)';
  return '\\left(' + tex(a) + '\\right)';
}
function factorTex(f, wrapAdd) { return (f.k === 'add' && wrapAdd) ? '\\left(' + tex(f) + '\\right)' : tex(f); }
function joinFactors(arr, wrap) {
  let s = '';
  arr.forEach((f, i) => { const t = factorTex(f, wrap); if (i > 0) s += /^[0-9]/.test(t) ? '\\cdot ' : ' '; s += t; });
  return s;
}
function tex(e) {
  switch (e.k) {
    case 'n': return e.q.tex();
    case 'c': return e.c === 'pi' ? '\\pi' : 'e';
    case 'x': return 'x';
    case 'add': {
      let ts = e.a.slice();
      // 「-cos x + 2」より「2 - cos x」: 先頭が負で正の定数があれば定数を前へ
      const lastC = ts[ts.length - 1];
      if (ts.length >= 2 && lastC.k === 'n' && lastC.q.sign() > 0 && tex(ts[0]).startsWith('-')) ts = [lastC, ...ts.slice(0, -1)];
      let s = '';
      ts.forEach((t, i) => { const z = tex(t); if (i > 0 && !z.startsWith('-')) s += '+'; s += z; });
      return s;
    }
    case 'mul': {
      let c = Q1; const numF = [], denF = [];
      for (const f of e.a) {
        if (f.k === 'n') { c = c.mul(f.q); continue; }
        if (f.k === 'pow' && f.e.k === 'n' && f.e.q.sign() < 0) denF.push(pow(f.b, N(f.e.q.neg()))); else numF.push(f);
      }
      const sg = c.sign() < 0 ? '-' : ''; c = c.abs();
      const cn = c.n, cd = c.d;
      const nt = joinFactors(numF, numF.length > 1 || cn !== 1n || denF.length > 0 && false);
      const dt = joinFactors(denF, denF.length > 1 || cd !== 1n);
      const lead = (s) => (cn === 1n ? (s || '1') : String(cn) + (s ? (/^[0-9]/.test(s) ? '\\cdot ' : '') + s : ''));
      if (!denF.length && cd === 1n) return sg + lead(nt.startsWith('\\left(') && numF.length === 1 && cn === 1n ? nt : nt);
      return sg + '\\frac{' + lead(nt) + '}{' + (cd === 1n ? '' : String(cd)) + (cd !== 1n && dt && /^[0-9]/.test(dt) ? '\\cdot ' : '') + dt + '}';
    }
    case 'pow': {
      const b = e.b, ex = e.e;
      if (ex.k === 'n') {
        const r = ex.q;
        if (r.eq(q(1, 2))) return '\\sqrt{' + tex(b) + '}';
        if (r.sign() < 0) return '\\frac{1}{' + tex(pow(b, N(r.neg()))) + '}';
        if (b.k === 'f' && ['sin', 'cos', 'tan'].includes(b.f) && r.isInt()) return '\\' + b.f + '^{' + r.n + '}' + argTex(b.a);
        if (b.k === 'f' && b.f === 'log' && r.isInt()) return '\\left(\\log' + argTex(b.a) + '\\right)^{' + r.n + '}';
        if (r.isInt() && (b.k === 'x' || b.k === 'c' || (b.k === 'n' && b.q.sign() > 0 && b.q.isInt()))) return tex(b) + '^{' + r.n + '}';
        if (r.d === 2n && b.k !== 'add' && false) return '';
        if (r.d === 2n) return '\\left(' + tex(b) + '\\right)^{\\frac{' + r.n + '}{2}}';
        return '\\left(' + tex(b) + '\\right)^{' + r.tex() + '}';
      }
      const bt = (b.k === 'x' || b.k === 'c' || (b.k === 'n' && b.q.isInt() && b.q.sign() > 0)) ? tex(b) : '\\left(' + tex(b) + '\\right)';
      return bt + '^{' + tex(ex) + '}';
    }
    case 'f':
      if (e.f === 'exp') return 'e^{' + tex(e.a) + '}';
      return '\\' + e.f + argTex(e.a);
  }
}

// ---- 有理数係数の多項式（低次 → 高次）----
const P = {
  trim(p) { const a = p.slice(); while (a.length > 1 && a[a.length - 1].isZero()) a.pop(); return a; },
  deriv(p) { return p.length <= 1 ? [Q0] : p.slice(1).map((c, i) => c.mul(i + 1)); },
  add(a, b) { const n = Math.max(a.length, b.length); const r = []; for (let i = 0; i < n; i++) r.push((a[i] || Q0).add(b[i] || Q0)); return P.trim(r); },
  scale(a, c) { return a.map(z => z.mul(c)); },
  isZero(p) { return p.every(z => z.isZero()); },
  evalX(p, x) { x = toX(x); let r = X.r(0); for (let i = p.length - 1; i >= 0; i--) r = r.mul(x).add(X.r(p[i].n, p[i].d)); return r; },
  evalQ(p, x) { x = q(x); let r = Q0; for (let i = p.length - 1; i >= 0; i--) r = r.mul(x).add(p[i]); return r; },
  integ01(p) { let s = Q0; p.forEach((c, i) => { s = s.add(c.div(i + 1)); }); return s; },
  integ(p, a, b) { const F = [Q0, ...p.map((c, i) => c.div(i + 1))]; return P.evalX(F, b).sub(P.evalX(F, a)); },
  expr(p, v = VX) { const ts = []; for (let i = p.length - 1; i >= 0; i--) if (!p[i].isZero()) ts.push(mul(N(p[i]), pow(v, N(i)))); return ts.length ? add(...ts) : N(0); },
  divmod(a, b) { // b は最高次係数 1
    let r = a.slice(); const qq = []; const db = b.length - 1;
    for (let i = r.length - 1 - db; i >= 0; i--) { const c = r[i + db] || Q0; qq[i] = c; for (let j = 0; j <= db; j++) r[i + j] = (r[i + j] || Q0).sub(c.mul(b[j])); }
    return { q: qq.length ? P.trim(qq.map(z => z || Q0)) : [Q0], r: P.trim(r.slice(0, db).length ? r.slice(0, db) : [Q0]) };
  },
  deg(p) { const t = P.trim(p); return t.length === 1 && t[0].isZero() ? -1 : t.length - 1; }
};



// ===================== 問題生成器 =====================
// ===================== 問題生成器（部品の組み合わせ + 厳密計算） =====================
const RI = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const PK = a => a[Math.floor(Math.random() * a.length)];
const DMath = s => '$$\\displaystyle ' + s + '$$';
const INT = (a, b, f, d = 'x') => `\\int_{${a}}^{${b}}${f}\\,d${d}`;
const fact = n => { let r = 1n; for (let i = 2n; i <= BigInt(n); i++) r *= i; return r; };
const binom = (n, k) => fact(n) / (fact(k) * fact(n - k));
function randPoly(deg, lo = -3, hi = 3) {
  for (;;) {
    const p = []; for (let i = 0; i <= deg; i++) p.push(q(RI(lo, hi)));
    if (p[deg].isZero()) continue;
    if (p.filter(c => !c.isZero()).length < 2) continue;
    return p;
  }
}
// 境界値（厳密値と LaTeX）
const B = {
  zero: { x: X.r(0), t: '0' }, one: { x: X.r(1), t: '1' }, mone: { x: X.r(-1), t: '-1' }, two: { x: X.r(2), t: '2' },
  pi: { x: X.pi, t: '\\pi' }, pi2: { x: X.pi.scale(q(1, 2)), t: '\\frac{\\pi}{2}' }, pi4: { x: X.pi.scale(q(1, 4)), t: '\\frac{\\pi}{4}' },
  pi3: { x: X.pi.scale(q(1, 3)), t: '\\frac{\\pi}{3}' }, pi6: { x: X.pi.scale(q(1, 6)), t: '\\frac{\\pi}{6}' },
  mpi2: { x: X.pi.scale(q(-1, 2)), t: '-\\frac{\\pi}{2}' }, e: { x: X.e, t: 'e' }, ln2: { x: logX(X.r(2)), t: '\\log 2' },
};

// ---- Wallis 積分 W(p,q)=∫_0^{π/2} sin^p cos^q ----
function W(p, r) {
  let c = Q1; const chain = []; let a = p, b = r;
  while (a >= 2) { chain.push([a - 1, a + b]); c = c.mul(q(a - 1, a + b)); a -= 2; }
  while (b >= 2) { chain.push([b - 1, a + b]); c = c.mul(q(b - 1, a + b)); b -= 2; }
  let base;
  if (a === 0 && b === 0) base = X.pi.scale(q(1, 2)); else if (a + b === 1) base = X.r(1); else base = X.r(1, 2);
  return { v: base.scale(c), chain, baseTex: a === 0 && b === 0 ? '\\frac{\\pi}{2}' : a + b === 1 ? '1' : '\\frac{1}{2}' };
}
const scTex = (p, r) => { const s = p ? (p === 1 ? '\\sin x' : `\\sin^{${p}} x`) : ''; const c = r ? (r === 1 ? '\\cos x' : `\\cos^{${r}} x`) : ''; return (s + (s && c ? ' ' : '') + c) || '1'; };
const scExpr = (p, r) => mul(pow(sin(VX), N(p)), pow(cos(VX), N(r)));
function wallisLine(p, r) {
  const w = W(p, r);
  const prod = w.chain.map(([a, b]) => `\\frac{${a}}{${b}}`).join('\\cdot ');
  return `\\int_0^{\\frac{\\pi}{2}}${scTex(p, r)}\\,dx=${prod ? prod + '\\cdot ' : ''}${w.baseTex}=${w.v.tex()}`;
}

// ---- 部分積分（瞬間部分積分） ----
function partsExp(Pp, k) { // ∫P e^{kx} = e^{kx} Qp
  let Qp = [Q0], d = Pp, s = 1, kk = q(k);
  for (let j = 0; !P.isZero(d); j++) { Qp = P.add(Qp, P.scale(d, q(s).div(kk.powi(j + 1)))); d = P.deriv(d); s = -s; }
  return Qp;
}
function partsTrig(Pp, k, kind) { // ∫P sin(kx) or P cos(kx) = cos(kx)A + sin(kx)B
  const kk = q(k); let A = [Q0], Bp = [Q0]; let d = Pp; const ders = [];
  while (!P.isZero(d)) { ders.push(d); d = P.deriv(d); }
  ders.forEach((dj, j) => {
    const half = Math.floor(j / 2), sgn = half % 2 ? -1 : 1;
    const c = q(sgn).div(kk.powi(j + 1));
    if (kind === 'sin') { if (j % 2 === 0) A = P.add(A, P.scale(dj, c.neg())); else Bp = P.add(Bp, P.scale(dj, c)); }
    else { if (j % 2 === 0) Bp = P.add(Bp, P.scale(dj, c)); else A = P.add(A, P.scale(dj, c)); }
  });
  return { A, B: Bp };
}
function partsTable(Pp, gTex, intTexs) {
  const ders = []; let d = Pp; while (!P.isZero(d)) { ders.push(d); d = P.deriv(d); } ders.push([Q0]);
  const rows = ders.map((dj, j) => `${j % 2 ? '-' : '+'}\\ & ${tex(P.expr(dj))} & ${intTexs(j)}`);
  return `$$\\begin{array}{c|c|c} & \\text{微分する側} & \\text{積分する側} \\\\ \\hline ${rows.join(' \\\\ ')} \\end{array}$$`;
}

// ====================== 積分の生成器 ======================
const GEN = {};

// G1 部分積分の反復 -----------------------------------------------
GEN.parts = { name: '部分積分の反復', hue: 32, make() {
  const kind = PK(['exp', 'exp', 'sin', 'cos', 'log']);
  if (kind === 'log') {
    const m = RI(0, 3), n = RI(3, 5), m1 = m + 1;
    // J_j = e^{m+1}/(m+1) - j/(m+1) J_{j-1},  J_0 = (e^{m+1}-1)/(m+1)
    const em = X.atom('e', m1);
    let J = em.sub(X.r(1)).scale(q(1, m1)); const lines = [`J_0=${J.tex()}`];
    for (let j = 1; j <= n; j++) { J = em.scale(q(1, m1)).sub(J.scale(q(j, m1))); lines.push(`J_{${j}}=${J.tex()}`); }
    const xm = m === 0 ? '' : m === 1 ? 'x' : `x^{${m}}`;
    const f = mul(pow(VX, N(m)), pow(log(VX), N(n)));
    return {
      stars: 4, tags: ['部分積分', '漸化式'],
      statement: '次の定積分を求めよ。' + DMath(INT(1, 'e', `${xm}(\\log x)^{${n}}`)),
      value: J.num(), answerX: J, check: { f, a: 1, b: Math.E },
      hint: `$J_j=\\int_1^e ${xm}(\\log x)^j\\,dx$ とおき、$${m1 === 1 ? 'x' : `\\frac{x^{${m1}}}{${m1}}`}$ を積分側にして部分積分する。`,
      steps: [
        ['漸化式を作る', `$J_j=\\displaystyle\\int_1^e ${xm}(\\log x)^j\\,dx$ とおく。$\\left(\\frac{x^{${m1}}}{${m1}}\\right)'=${xm || '1'}$ を使って部分積分すると、$x=1$ では $\\log x=0$ なので
$$J_j=\\frac{e^{${m1}}}{${m1}}-\\frac{j}{${m1}}J_{j-1},\\qquad J_0=\\frac{e^{${m1}}-1}{${m1}}$$`],
        ['順に計算', `$$\\begin{aligned}${lines.map(l => l.replace('=', '&=')).join('\\\\')}\\end{aligned}$$`],
        ['結論', `$$\\int_1^e ${xm}(\\log x)^{${n}}\\,dx=${J.tex()}$$`],
        ['発想の源', '$\\log$ のべきは、べき関数を積分側に回すと次数が1つずつ下がる。端点 $x=1$ で $\\log x=0$ となり、境界項が片側だけ残るのが効く。'],
      ]
    };
  }
  const deg = RI(2, 4); const Pp = randPoly(deg);
  const Pt = tex(P.expr(Pp));
  if (kind === 'exp') {
    const k = PK([1, 2, -1, 3, -2]);
    const bd = PK([[B.zero, B.one], [B.mone, B.one], [B.zero, B.ln2], [B.zero, B.two]]);
    const Qp = partsExp(Pp, k);
    const F = x => P.evalX(Qp, x).mul(expX(toX(x).scale(k)));
    const val = F(bd[1].x).sub(F(bd[0].x));
    const ek = k === 1 ? 'e^{x}' : k === -1 ? 'e^{-x}' : `e^{${k}x}`;
    const f = mul(P.expr(Pp), exp(mul(N(k), VX)));
    const intT = j => { const c = q(1).div(q(k).powi(j)); return (c.isOne() ? '' : c.tex()) + ek; };
    return {
      stars: deg >= 3 ? 4 : 3, tags: ['部分積分', '瞬間部分積分'],
      statement: '次の定積分を求めよ。' + DMath(INT(bd[0].t, bd[1].t, `\\left(${Pt}\\right)${ek}`)),
      value: val.num(), answerX: val, check: { f, a: bd[0].x.num(), b: bd[1].x.num() },
      hint: '多項式を微分する側、指数関数を積分する側にして部分積分を繰り返す。表にすると速い。',
      steps: [
        ['方針', `多項式 × 指数関数なので、多項式が消えるまで部分積分を ${deg} 回繰り返す。符号は $+,-,+,\\dots$ と交互。`],
        ['部分積分の表', partsTable(Pp, ek, intT)],
        ['原始関数', `表の斜めの積を符号付きで足して
$$\\int\\left(${Pt}\\right)${ek}\\,dx=${ek}\\left(${tex(P.expr(Qp))}\\right)+C$$`],
        ['代入', `$$\\Big[${ek}\\left(${tex(P.expr(Qp))}\\right)\\Big]_{${bd[0].t}}^{${bd[1].t}}=${F(bd[1].x).tex()}-\\left(${F(bd[0].x).tex()}\\right)=${val.tex()}$$`],
        ['発想の源', '$(\\text{多項式})\\times e^{kx}$ は、原始関数も $e^{kx}\\times(\\text{同じ次数の多項式})$ の形になる。表を使えば何回分の部分積分も一度に書ける。'],
      ]
    };
  }
  const k = PK([1, 2, 3]);
  const bd = PK([[B.zero, B.pi2], [B.zero, B.pi], [B.mpi2, B.pi2], [B.zero, B.pi4]]);
  const { A, B: Bq } = partsTrig(Pp, k, kind);
  const kxX = x => toX(x).scale(k);
  const F = x => P.evalX(A, x).mul(cosX(kxX(x))).add(P.evalX(Bq, x).mul(sinX(kxX(x))));
  const val = F(bd[1].x).sub(F(bd[0].x));
  const kx = k === 1 ? 'x' : `${k}x`;
  const trig = `\\${kind} ${kx}`;
  const f = mul(P.expr(Pp), fn(kind, mul(N(k), VX)));
  const cyc = kind === 'sin' ? [`\\${kind} ${kx}`, `-\\cos ${kx}`, `-\\sin ${kx}`, `\\cos ${kx}`] : [`\\cos ${kx}`, `\\sin ${kx}`, `-\\cos ${kx}`, `-\\sin ${kx}`];
  const intT = j => { const c = q(1).div(q(k).powi(j)); const t = cyc[j % 4]; const sg = t.startsWith('-') ? '-' : ''; return sg + (c.isOne() ? '' : c.tex()) + t.replace(/^-/, ''); };
  const Fe = add(mul(P.expr(A), cos(mul(N(k), VX))), mul(P.expr(Bq), sin(mul(N(k), VX))));
  return {
    stars: deg >= 3 ? 4 : 3, tags: ['部分積分', '瞬間部分積分'],
    statement: '次の定積分を求めよ。' + DMath(INT(bd[0].t, bd[1].t, `\\left(${Pt}\\right)${trig}`)),
    value: val.num(), answerX: val, check: { f, a: bd[0].x.num(), b: bd[1].x.num() },
    hint: '多項式を微分する側、三角関数を積分する側にして部分積分を繰り返す。',
    steps: [
      ['方針', `多項式 × 三角関数なので、多項式が消えるまで部分積分を繰り返す。三角関数は積分するたびに $\\sin\\to-\\cos\\to-\\sin\\to\\cos$ と回る。`],
      ['部分積分の表', partsTable(Pp, trig, intT)],
      ['原始関数', `$$\\int\\left(${Pt}\\right)${trig}\\,dx=${tex(Fe)}+C$$`],
      ['代入', `$x=${bd[1].t}$ で $${F(bd[1].x).tex()}$、$x=${bd[0].t}$ で $${F(bd[0].x).tex()}$。差をとって
$$${val.tex()}$$`],
      ['発想の源', '三角関数は4回積分すると元に戻る。多項式の次数ぶんだけ表を書けば、符号と係数の管理だけの問題になる。'],
    ]
  };
} };

// G2 King's property ----------------------------------------------
GEN.king = { name: "King's property", hue: 268, make() {
  const type = PK(['wallis', 'rat', 'rat']);
  let g, gTex, inner, steps2, posOK;
  if (type === 'wallis') {
    const nt = RI(1, 2); const terms = [];
    while (terms.length < nt) {
      const m = RI(1, 5), n2 = 2 * RI(0, 2), c = RI(1, 3);
      if (m + n2 < 2 || terms.some(t => t.m === m && t.n === n2)) continue;
      terms.push({ m, n: n2, c });
    }
    g = add(...terms.map(t => mul(N(t.c), scExpr(t.m, t.n))));
    gTex = tex(g);
    inner = terms.reduce((s, t) => s.add(W(t.m, t.n).v.scale(t.c)), X.r(0));
    steps2 = [['Wallis 積分', terms.map(t => `$$${t.c > 1 ? t.c + '\\times' : ''}${wallisLine(t.m, t.n)}$$`).join('\n') + `\n合計 $\\displaystyle\\int_0^{\\frac{\\pi}{2}}\\left(${gTex}\\right)dx=${inner.tex()}$`]];
    posOK = true;
  } else {
    const D = PK([[1, 1], [3, 1], [1, 3], [2, -1], [3, -1], [4, -1]]);
    const [pp, qq] = D;
    const al = RI(0, 2), be = RI(1, 3);
    const c2 = pow(cos(VX), N(2));
    const den = qq > 0 ? add(N(pp), mul(N(qq), c2)) : add(N(pp - 1), pow(sin(VX), N(2)));
    const numr = al ? add(mul(N(al), c2), N(be)) : N(be);
    g = mul(sin(VX), numr, pow(den, N(-1)));
    gTex = tex(g);
    // ∫_0^1 (al u^2 + be)/(pp + qq u^2) du
    const quo = q(al, qq), rem = q(be).sub(q(al * pp, qq));
    let Jv, Jsteps;
    if (qq > 0) {
      const c = q(pp, qq); const sc = sqrtX(X.r(c.n, c.d));
      const th = atanX(sc.inv());
      Jv = th.mul(sc.inv()).scale(q(1, qq));
      Jsteps = `$u=${sc.tex()}\\tan\\theta$ とおくと $\\displaystyle\\int_0^1\\frac{du}{${pp}+${qq === 1 ? '' : qq}u^2}=${qq === 1 ? '' : `\\frac{1}{${qq}}\\cdot`}\\frac{1}{${sc.tex()}}\\int_0^{${th.tex()}}d\\theta=${Jv.tex()}$（$\\tan\\theta=${sc.inv().tex()}$ より $\\theta=${th.tex()}$）`;
    } else {
      const d = pp; const sd = sqrtX(X.r(d));
      Jv = logX(sd.add(X.r(1)).div(sd.sub(X.r(1)))).mul(sd.inv()).scale(q(1, 2));
      Jsteps = `部分分数分解 $\\dfrac{1}{${d}-u^2}=\\dfrac{1}{2${sd.tex()}}\\left(\\dfrac{1}{${sd.tex()}-u}+\\dfrac{1}{${sd.tex()}+u}\\right)$ より
$$\\int_0^1\\frac{du}{${d}-u^2}=\\frac{1}{2${sd.tex()}}\\log\\frac{${sd.tex()}+1}{${sd.tex()}-1}=${Jv.tex()}$$`;
    }
    inner = X.r(quo.n, quo.d).add(Jv.scale(rem)); // = ∫_0^1 R(u) du
    const Rt = tex(dv(al ? add(mul(N(al), pow(VX, N(2))), N(be)) : N(be), qq > 0 ? add(N(pp), mul(N(qq), pow(VX, N(2)))) : add(N(pp), neg(pow(VX, N(2)))))).replace(/x/g, 'u');
    steps2 = [
      ['$u=\\cos x$ で置換', `${qq < 0 ? `$\\sin^2 x=1-\\cos^2 x$ より分母は $${pp}-\\cos^2 x$。` : ''}$du=-\\sin x\\,dx$、$x:0\\to\\pi$ で $u:1\\to-1$。被積分関数は偶関数なので
$$\\int_0^{\\pi}${gTex}\\,dx=2\\int_0^1 ${Rt}\\,du$$`],
      ['分子の次数を下げる', al ? `$$${Rt}=${quo.tex()}${rem.sign() >= 0 ? '+' : ''}${rem.tex()}\\cdot\\frac{1}{${qq > 0 ? `${pp}+${qq === 1 ? '' : qq}u^2` : `${pp}-u^2`}}$$` : '分子は定数なのでそのまま。'],
      ['基本の積分', Jsteps],
      ['まとめ', `$$\\int_0^1 ${Rt}\\,du=${inner.tex()}$$`],
    ];
    inner = inner.scale(1); // ∫_0^1 R du ; ∫_0^π g = 2*inner, ∫_0^{π/2}... 不使用
    posOK = true;
  }
  // I = ∫_0^π x g = (π/2)∫_0^π g ;  wallis: ∫_0^π g = 2∫_0^{π/2} g = 2 inner ;  rat: ∫_0^π g = 2 inner
  let I = X.pi.mul(inner);
  const vol = posOK && Math.random() < .35;
  const f = mul(VX, g);
  const kingStep = ["King's property", `$x=\\pi-t$ とおくと $\\sin(\\pi-t)=\\sin t,\\ \\cos^2(\\pi-t)=\\cos^2 t$ なので、$x$ 以外の部分は変わらない。よって
$$I=\\int_0^{\\pi}(\\pi-t)\\,(\\cdots)\\,dt=\\pi\\int_0^{\\pi}(\\cdots)\\,dt-I\\quad\\Longrightarrow\\quad I=\\frac{\\pi}{2}\\int_0^{\\pi}${gTex.length < 60 ? gTex : 'g(x)'}\\,dx$$
${type === 'wallis' ? 'さらに $[0,\\pi]$ の積分は $x=\\frac{\\pi}{2}$ について対称なので $\\displaystyle\\int_0^{\\pi}=2\\int_0^{\\frac{\\pi}{2}}$。' : ''}`];
  if (vol) {
    I = I.scale(2).mul(X.pi);
    return {
      stars: 5, tags: ['バウムクーヘン積分', "King's property", type === 'wallis' ? 'Wallis 積分' : '置換積分'],
      statement: '曲線' + DMath(`y=${gTex}\\quad(0\\le x\\le\\pi)`) + `と $x$ 軸で囲まれた部分を、$y$ 軸のまわりに1回転してできる立体の体積 $V$ を求めよ。`,
      value: I.num(), answerX: I, check: { f: mul(N(2), PI, f), a: 0, b: Math.PI },
      hint: '$y$ 軸まわりは円筒殻で：$V=2\\pi\\int_0^{\\pi}x\\,y\\,dx$。その後は $x\\to\\pi-x$。',
      steps: [['円筒殻で分割', `半径 $x$、高さ $y$、厚さ $dx$ の殻を集めて $\\displaystyle V=2\\pi\\int_0^{\\pi}x\\left(${gTex}\\right)dx=2\\pi I$。`], kingStep, ...steps2,
        ['結論', `$$V=2\\pi\\cdot\\pi\\cdot${inner.tex().includes('+') || inner.tex().includes('-') ? '\\left(' + inner.tex() + '\\right)' : inner.tex()}=${I.tex()}$$`],
        ['発想の源', '$y$ 軸まわりで $x$ を $y$ で表せないときは円筒殻。出てくる $x\\,f(x)$ は、$f$ が $x\\to\\pi-x$ で不変なら King\'s property で $x$ を $\\frac{\\pi}{2}$ に置き換えられる。']]
    };
  }
  return {
    stars: type === 'wallis' ? 4 : 5, tags: ["King's property", type === 'wallis' ? 'Wallis 積分' : '置換積分'],
    statement: '次の定積分を求めよ。' + DMath(INT(0, '\\pi', tex(f))),
    value: I.num(), answerX: I, check: { f, a: 0, b: Math.PI },
    hint: '$x\\to\\pi-x$ と置き換えると、分子の $x$ を消せる。',
    steps: [kingStep, ...steps2, ['結論', `$$I=\\pi\\cdot${/[+-]/.test(inner.tex().slice(1)) ? '\\left(' + inner.tex() + '\\right)' : inner.tex()}=${I.tex()}$$`],
      ['発想の源', '「$x\\times$（$x\\to\\pi-x$ で不変な関数）」は、$x$ を区間の中点 $\\frac{\\pi}{2}$ に置き換えてよい。残りは $\\cos x$ を新しい変数にする定番の流れ。']]
  };
} };

// G3 x→−x と 1/(1+b^{奇関数}) ----------------------------------------
GEN.odd = { name: '1+bᵍ⁽ˣ⁾ の消滅', hue: 350, make() {
  const ft = PK(['poly', 'trig', 'xtrig']);
  let f, a, ia, half, steps0;
  if (ft === 'poly') {
    const c = [RI(1, 3), RI(-2, 3), RI(1, 2)]; // c0 + c1 x^2 + c2 x^4
    const Pp = [q(c[0]), Q0, q(c[1]), Q0, q(c[2])];
    a = PK([B.one, B.two]); f = P.expr(Pp);
    half = P.integ(Pp, X.r(0), a.x);
    steps0 = `$$\\int_0^{${a.t}}\\left(${tex(f)}\\right)dx=${half.tex()}$$`;
  } else if (ft === 'trig') {
    const n = RI(2, 6); const useSin = n % 2 === 0 && Math.random() < .5;
    a = B.pi2; f = useSin ? pow(sin(VX), N(n)) : pow(cos(VX), N(n));
    half = W(useSin ? n : 0, useSin ? 0 : n).v;
    steps0 = `$$${wallisLine(useSin ? n : 0, useSin ? 0 : n)}$$`;
  } else {
    const v = PK([{ m: 1, k: 'sin' }, { m: 3, k: 'sin' }, { m: 2, k: 'cos' }]);
    a = PK([B.pi2, B.pi]);
    const Pp = Array(v.m + 1).fill(Q0); Pp[v.m] = Q1;
    f = mul(pow(VX, N(v.m)), fn(v.k, VX));
    const { A, B: Bq } = partsTrig(Pp, 1, v.k);
    const F = x => P.evalX(A, x).mul(cosX(x)).add(P.evalX(Bq, x).mul(sinX(x)));
    half = F(a.x).sub(F(X.r(0)));
    const Fe = add(mul(P.expr(A), cos(VX)), mul(P.expr(Bq), sin(VX)));
    steps0 = `部分積分を繰り返して $\\displaystyle\\int ${tex(f)}\\,dx=${tex(Fe)}+C$ より
$$\\int_0^{${a.t}}${tex(f)}\\,dx=${half.tex()}$$`;
  }
  const h = PK([VX, pow(VX, N(3)), sin(VX), mul(VX, cos(VX)), add(pow(VX, N(3)), VX), pow(VX, N(5))]);
  const base = PK(['e', 2, 3, 2026, 'pi']);
  const bh = base === 'e' ? exp(h) : pow(base === 'pi' ? PI : N(base), h);
  const integrand = mul(f, pow(add(N(1), bh), N(-1)));
  const bT = base === 'e' ? 'e' : base === 'pi' ? '\\pi' : String(base);
  const hT = tex(h);
  return {
    stars: 4, tags: ['x→−x 置換', '偶関数・奇関数'],
    statement: '次の定積分を求めよ。' + DMath(INT('-' + a.t, a.t, tex(integrand))),
    value: half.num(), answerX: half, check: { f: integrand, a: -a.x.num(), b: a.x.num() },
    hint: `$x\\to-x$ とおくと $${bT}^{${hT}}$ は逆数になる。`,
    steps: [
      ['$x=-t$ で置換', `$${tex(f)}$ は偶関数、$${hT}$ は奇関数なので $${bT}^{${hT}}$ は $${bT}^{-(${hT})}$ に変わる。分子分母に $${bT}^{${hT}}$ を掛けて
$$I=\\int_{-${a.t}}^{${a.t}}\\frac{${bT}^{${hT}}\\left(${tex(f)}\\right)}{1+${bT}^{${hT}}}\\,dx$$`],
      ['元の式と足す', `$$2I=\\int_{-${a.t}}^{${a.t}}${tex(f).length > 2 ? '\\left(' + tex(f) + '\\right)' : tex(f)}dx=2\\int_0^{${a.t}}${tex(f).length > 2 ? '\\left(' + tex(f) + '\\right)' : tex(f)}dx$$`],
      ['残りを計算', steps0],
      ['結論', `$$I=${half.tex()}$$ 底 $${bT}$ も奇関数 $${hT}$ の形も、答えには影響しない。`],
      ['発想の源', '$\\frac{1}{1+u}+\\frac{1}{1+u^{-1}}=1$。対称区間で「$1+b^{\\text{奇関数}}$」が分母にあれば、半分になって消える合図。'],
    ]
  };
} };

// G4 x→1/x -------------------------------------------------------
GEN.recip = { name: 'x→1/x 対称', hue: 172, make() {
  const k = PK([2, 3, 4, 5, 7, 10, 2026]);
  const xk = pow(VX, N(k));
  const v = PK([
    () => { const A = PK([{ a: X.r(1).add(R3().sub(X.r(1))), t: '\\sqrt{3}', lt: '\\frac{1}{\\sqrt{3}}', x: R3() }, { x: X.r(2).add(R3()), t: '2+\\sqrt{3}', lt: '2-\\sqrt{3}' }, { x: X.r(1).add(R2()), t: '1+\\sqrt{2}', lt: '\\sqrt{2}-1' }]);
      const ang = atanX(A.x), ang2 = atanX(A.x.inv()); const tot = ang.sub(ang2); const I = tot.scale(q(1, 2));
      return { phi: pow(add(N(1), pow(VX, N(2))), N(-1)), A, I, base: `$x=\\tan\\theta$ とおくと $\\tan${ang.tex()}=${A.t}$、$\\tan${ang2.tex()}=${A.lt}$ より $$\\int_{${A.lt}}^{${A.t}}\\frac{dx}{1+x^2}=${ang.tex()}-${ang2.tex()}=${tot.tex()}$$` }; },
    () => { const A = PK([{ x: X.r(2), t: '2', lt: '\\frac{1}{2}' }, { x: X.r(3), t: '3', lt: '\\frac{1}{3}' }, { x: X.e, t: 'e', lt: '\\frac{1}{e}' }]);
      const L = logX(A.x); return { phi: pow(VX, N(-1)), A, I: L, base: `$$\\int_{${A.lt}}^{${A.t}}\\frac{dx}{x}=\\Big[\\log x\\Big]_{${A.lt}}^{${A.t}}=2${/[+-]/.test(L.tex()) ? '(' + L.tex() + ')' : L.tex()}$$` }; },
    () => { const A = PK([{ x: X.r(2), t: '2', lt: '\\frac{1}{2}' }, { x: X.e, t: 'e', lt: '\\frac{1}{e}' }, { x: X.r(3), t: '3', lt: '\\frac{1}{3}' }]);
      const L = logX(A.x); const I = L.mul(L).mul(L).scale(q(1, 3));
      return { phi: mul(pow(log(VX), N(2)), pow(VX, N(-1))), A, I, base: `$\\log x=s$ とおくと $$\\int_{${A.lt}}^{${A.t}}\\frac{(\\log x)^2}{x}\\,dx=\\int_{-${L.tex()}}^{${L.tex()}}s^2\\,ds=${I.scale(2).tex()}$$` }; },
    () => { const A = PK([{ x: X.e, t: 'e', lt: '\\frac{1}{e}', s: X.r(1) }, { x: null, t: 'e^{\\sqrt{3}}', lt: 'e^{-\\sqrt{3}}', s: R3() }]);
      const ang = atanX(A.s); const I = ang;
      return { phi: pow(mul(VX, add(N(1), pow(log(VX), N(2)))), N(-1)), A: { ...A, x: A.x || expX(R3()) }, I, base: `$\\log x=s$ とおくと $$\\int\\frac{dx}{x\\{1+(\\log x)^2\\}}=\\int_{-${A.s.tex()}}^{${A.s.tex()}}\\frac{ds}{1+s^2}=2\\cdot ${ang.tex()}$$（$s=\\tan\\theta$ で置換）` }; },
  ])();
  const integrand = mul(v.phi, pow(add(N(1), xk), N(-1)));
  const lo = v.A.x.inv().num(), hi = v.A.x.num();
  return {
    stars: 5, tags: ['x→1/x 置換', '対称性'],
    statement: '次の定積分を求めよ。' + DMath(INT(v.A.lt, v.A.t, tex(integrand))),
    value: v.I.num(), answerX: v.I, check: { f: integrand, a: lo, b: hi }, tol: k > 50 ? 2e-6 : null,
    hint: '区間の両端は互いに逆数。$x=\\dfrac{1}{t}$ とおくと何が起きる？',
    steps: [
      ['方針', `$x^{${k}}$ のせいで直接は積分できない。区間 $\\left[${v.A.lt},\\,${v.A.t}\\right]$ の両端が逆数どうしなので、$x=\\frac1t$ で「相棒」を作って足す。`],
      ['$x=\\dfrac1t$ で置換', `$dx=-\\dfrac{dt}{t^2}$ で、$${tex(v.phi)}\\,dx$ の部分は形を変えずに戻ってくる（確かめてみよ）。一方 $\\dfrac{1}{1+x^{${k}}}=\\dfrac{t^{${k}}}{1+t^{${k}}}$ なので
$$I=\\int_{${v.A.lt}}^{${v.A.t}}\\frac{t^{${k}}}{1+t^{${k}}}\\,${tex(v.phi).replace(/x/g, 't')}\\,dt$$`],
      ['足し合わせる', `$\\dfrac{1}{1+t^{${k}}}+\\dfrac{t^{${k}}}{1+t^{${k}}}=1$ より $$2I=\\int_{${v.A.lt}}^{${v.A.t}}${tex(v.phi)}\\,dx$$`],
      ['基本の積分', v.base],
      ['結論', `$$I=${v.I.tex()}$$ 指数 ${k} は答えに影響しない。`],
      ['発想の源', '区間が $\\left[\\frac1a,a\\right]$ なら $x\\to\\frac1x$。$\\frac{dx}{x}$ や $\\frac{dx}{1+x^2}$ はこの置換で形が保たれる「不変な部品」。'],
    ]
  };
} };

// G5 相棒の積分 I+J ------------------------------------------------
GEN.pair = { name: 'I と J の相棒', hue: 300, make() {
  const n = PK([3, 5, 7]); const useSin = Math.random() < .5; const m = PK([0, 0, 1, 2]);
  const s = sin(VX), c = cos(VX);
  const top = useSin ? pow(s, N(n)) : pow(c, N(n));
  const integrand = mul(m ? add(top, N(m)) : top, pow(add(s, c), N(-1)));
  // (s^n+c^n)/(s+c) = Σ_{j=0}^{n-1} (-1)^j s^{n-1-j} c^j
  let sum = X.r(0); const parts = [];
  for (let j = 0; j < n; j++) { const w = W(n - 1 - j, j).v; sum = j % 2 ? sum.sub(w) : sum.add(w); parts.push(`${j ? (j % 2 ? '-' : '+') : ''}${scTex(n - 1 - j, j)}`); }
  const L = X.atom('L12').mul(R2()); // ∫_0^{π/2} dx/(s+c) = √2 log(1+√2)
  const tot = sum.add(L.scale(2 * m));
  const I = tot.scale(q(1, 2));
  const other = useSin ? '\\cos' : '\\sin';
  return {
    stars: m ? 5 : 4, tags: ['相棒の積分', '対称性', '因数分解'],
    statement: '次の定積分を求めよ。' + DMath(INT(0, '\\frac{\\pi}{2}', tex(integrand))),
    value: I.num(), answerX: I, check: { f: integrand, a: 0, b: Math.PI / 2 },
    hint: `$x\\to\\frac{\\pi}{2}-x$ で分子の $\\${useSin ? 'sin' : 'cos'}$ が $${other}$ に変わり、分母は変わらない。`,
    steps: [
      ['相棒を作る', `分子の $\\${useSin ? 'sin' : 'cos'}^{${n}}x$ を $${other}^{${n}}x$ に替えた積分を $J$ とする。$x\\to\\frac{\\pi}{2}-x$ で $I=J$。`],
      ['足して割り切る', `$s=\\sin x,\\ c=\\cos x$ とすると $s^{${n}}+c^{${n}}$ は $s+c$ で割り切れて
$$\\frac{s^{${n}}+c^{${n}}}{s+c}=${parts.join('')}$$`],
      ['Wallis 積分で各項', `各項は $\\int_0^{\\pi/2}\\sin^p x\\cos^q x\\,dx$ の形で、合計は $$\\int_0^{\\frac{\\pi}{2}}\\frac{\\sin^{${n}}x+\\cos^{${n}}x}{\\sin x+\\cos x}\\,dx=${sum.tex()}$$`],
      ...(m ? [['定数部分', `$\\sin x+\\cos x=\\sqrt2\\sin\\left(x+\\frac{\\pi}{4}\\right)$ と $\\displaystyle\\int\\frac{d\\theta}{\\sin\\theta}=\\log\\tan\\frac{\\theta}{2}$ より
$$\\int_0^{\\frac{\\pi}{2}}\\frac{dx}{\\sin x+\\cos x}=\\frac{1}{\\sqrt2}\\log\\frac{\\tan\\frac{3\\pi}{8}}{\\tan\\frac{\\pi}{8}}=\\sqrt2\\log\\left(1+\\sqrt2\\right)$$
$I$ と $J$ の両方に $${m}$ 倍で入るので、合計で $${2 * m}$ 倍。`]] : []),
      ['結論', `$$I=\\frac{1}{2}(I+J)=${I.tex()}$$`],
      ['発想の源', '単独では手が出ない積分も、対称な相棒と足すと分母が割り切れる。「$I$ を直接求めない」のが要点。'],
    ]
  };
} };

// G6 区分求積 ------------------------------------------------------
const RATQ = [
  { id: 'lin1', den: [q(1), q(1)], kt: 'k+n', integ: (R) => logRat(q(2)).scale(R[0] || Q0), why: (R) => `\\int_0^1\\frac{dx}{x+1}=\\log 2` },
  { id: 'lin2', den: [q(2), q(1)], kt: 'k+2n', integ: (R) => logRat(q(3, 2)).scale(R[0] || Q0), why: () => `\\int_0^1\\frac{dx}{x+2}=\\log\\frac{3}{2}` },
  { id: 'sq1', den: [q(1), q(2), q(1)], kt: '(k+n)^2', integ: (R) => { const al = R[1] || Q0, be = R[0] || Q0; return logRat(q(2)).scale(al).add(X.r(be.sub(al).n, be.sub(al).d).scale(q(1, 2))); }, why: () => `\\int_0^1\\frac{dx}{(x+1)^2}=\\frac{1}{2},\\ \\int_0^1\\frac{dx}{x+1}=\\log 2` },
  { id: 'q1', den: [q(1), Q0, q(1)], kt: 'k^2+n^2', integ: (R) => logRat(q(2)).scale((R[1] || Q0).mul(q(1, 2))).add(X.pi.scale((R[0] || Q0).mul(q(1, 4)))), why: () => `\\int_0^1\\frac{dx}{x^2+1}=\\frac{\\pi}{4},\\ \\int_0^1\\frac{x\\,dx}{x^2+1}=\\frac{1}{2}\\log 2` },
  { id: 'q3', den: [q(3), Q0, q(1)], kt: 'k^2+3n^2', integ: (R) => logRat(q(4, 3)).scale((R[1] || Q0).mul(q(1, 2))).add(X.pi.mul(R3()).scale((R[0] || Q0).mul(q(1, 18)))), why: () => `\\int_0^1\\frac{dx}{x^2+3}=\\frac{\\sqrt3\\,\\pi}{18},\\ \\int_0^1\\frac{x\\,dx}{x^2+3}=\\frac{1}{2}\\log\\frac{4}{3}` },
];
function bivTex(Pp, varK = 'k', varN = 'n') { // 同次化した多項式 Σ p_i k^i n^{d-i}
  const d = Pp.length - 1; const ts = [];
  for (let i = d; i >= 0; i--) {
    const c = Pp[i]; if (c.isZero()) continue;
    const kp = i === 0 ? '' : i === 1 ? varK : `${varK}^{${i}}`, np = d - i === 0 ? '' : d - i === 1 ? varN : `${varN}^{${d - i}}`;
    const mono = kp + np; const a = c.abs();
    const coef = a.isOne() && mono ? '' : a.tex();
    ts.push((c.sign() < 0 ? '-' : (ts.length ? '+' : '')) + coef + mono);
  }
  return ts.join('') || '0';
}
function randRat() {
  const Qt = PK(RATQ);
  const dq = Qt.den.length - 1;
  const dp = RI(Math.max(0, dq - 1), dq);
  let Pp; for (;;) { Pp = []; for (let i = 0; i <= dp; i++) Pp.push(q(RI(i === dp ? 1 : 0, 3))); if (!P.isZero(Pp)) break; }
  const { q: S, r: R } = P.divmod(Pp, Qt.den);
  if (P.isZero(R)) return randRat();
  const val = X.r(P.integ01(S).n, P.integ01(S).d).add(Qt.integ(R));
  const f = mul(P.expr(Pp), pow(P.expr(Qt.den), N(-1)));
  return { Qt, Pp, S, R, val, f };
}
function ratSteps(r) {
  const Rt = tex(P.expr(r.R)), St = tex(P.expr(r.S));
  const sDiv = P.isZero(r.S) ? '' : `$$${tex(r.f)}=${St}+${tex(mul(P.expr(r.R), pow(P.expr(r.Qt.den), N(-1))))}$$`;
  return [
    ['分子の次数を下げる', (sDiv || '分子の次数は分母より低いのでそのまま。') + `\n使う基本の積分：$${r.Qt.why(r.R)}$`],
    ['積分する', `$$\\int_0^1${tex(r.f)}\\,dx=${r.val.tex()}$$`],
  ];
}
GEN.riemann = { name: '区分求積法', hue: 45, make() {
  const kind = PK(['rat', 'rat', 'rat', 'exp', 'sin', 'prod']);
  const lim = '\\lim_{n\\to\\infty}';
  if (kind === 'prod') {
    const a = PK([1, 2]);
    const ans = expX(logRat(q(1 + a)).scale(q(1 + a, a)).sub(X.r(1)));
    const shown = a === 1 ? '\\sqrt[n]{\\frac{(n+1)(n+2)\\cdots(2n)}{n^n}}' : '\\sqrt[n]{\\frac{(n+2)(n+4)\\cdots(3n)}{n^n}}';
    const inner = logRat(q(1 + a)).scale(q(1 + a, a)).sub(X.r(1));
    return {
      stars: 4, tags: ['区分求積法', '対数をとる'],
      statement: '次の極限値を求めよ。' + DMath(lim + shown),
      value: ans.num(), answerX: ans, check: { f: log(add(N(1), mul(N(a), VX))), a: 0, b: 1, target: inner.num() },
      hint: '対数をとると $\\frac1n\\sum\\log(1+\\cdots)$ の形になる。',
      steps: [
        ['対数をとる', `中身を $a_n$ とおくと $$\\log a_n=\\frac1n\\sum_{k=1}^{n}\\log\\left(1+${a === 1 ? '' : a}\\frac{k}{n}\\right)$$`],
        ['区分求積', `$$\\lim_{n\\to\\infty}\\log a_n=\\int_0^1\\log(1+${a === 1 ? '' : a}x)\\,dx=${inner.tex()}$$（部分積分：$\\int\\log(1+${a === 1 ? '' : a}x)dx=\\frac{1+${a === 1 ? '' : a}x}{${a}}\\log(1+${a === 1 ? '' : a}x)-x$）`],
        ['結論', `$$\\lim a_n=e^{${inner.tex()}}=${ans.tex()}$$`],
        ['発想の源', '積の $n$ 乗根は、対数で和に変えると区分求積の形になる。'],
      ]
    };
  }
  if (kind === 'exp') {
    const m = RI(1, 3); const Pp = Array(m + 1).fill(Q0); Pp[m] = Q1;
    const Qp = partsExp(Pp, 1); const val = P.evalX(Qp, X.r(1)).mul(X.e).sub(P.evalX(Qp, X.r(0)));
    const f = mul(pow(VX, N(m)), exp(VX));
    return {
      stars: 4, tags: ['区分求積法', '部分積分'],
      statement: '次の極限値を求めよ。' + DMath(`${lim}\\sum_{k=1}^{n}\\frac{k^{${m}}}{n^{${m + 1}}}\\,e^{\\frac{k}{n}}`),
      value: val.num(), answerX: val, check: { f, a: 0, b: 1 },
      hint: '$\\frac{1}{n}\\sum f\\left(\\frac{k}{n}\\right)$ の形に直す。',
      steps: [
        ['区分求積の形に', `$$\\frac{k^{${m}}}{n^{${m + 1}}}e^{\\frac{k}{n}}=\\frac{1}{n}\\left(\\frac{k}{n}\\right)^{${m}}e^{\\frac{k}{n}}$$ より、極限は $\\displaystyle\\int_0^1 ${tex(f)}\\,dx$。`],
        ['部分積分', `$$\\int ${tex(f)}\\,dx=e^{x}\\left(${tex(P.expr(Qp))}\\right)+C$$`],
        ['結論', `$$\\int_0^1 ${tex(f)}\\,dx=${val.tex()}$$`],
        ['発想の源', '$\\frac{k}{n}$ をかたまりで見る。分母の $n$ のべきは $\\frac{1}{n}\\left(\\frac{k}{n}\\right)^m$ にそろえるための調整。'],
      ]
    };
  }
  if (kind === 'sin') {
    const m = RI(0, 2);
    // ∫_0^1 x^m sin(πx) dx = π^{-(m+1)} ∫_0^π t^m sin t dt
    const Pp = Array(m + 1).fill(Q0); Pp[m] = Q1;
    const { A, B: Bq } = partsTrig(Pp, 1, 'sin');
    const F = x => P.evalX(A, x).mul(cosX(x)).add(P.evalX(Bq, x).mul(sinX(x)));
    const val = F(X.pi).sub(F(X.r(0))).mul(X.atom('pi', -(m + 1)));
    const f = mul(pow(VX, N(m)), sin(mul(PI, VX)));
    const kk = m === 0 ? '' : m === 1 ? 'k' : `k^{${m}}`;
    return {
      stars: 4, tags: ['区分求積法', m ? '部分積分' : '三角関数'],
      statement: '次の極限値を求めよ。' + DMath(`${lim}\\sum_{k=1}^{n}\\frac{${kk || '1'}}{n^{${m + 1}}}\\sin\\frac{k\\pi}{n}`),
      value: val.num(), answerX: val, check: { f, a: 0, b: 1 },
      hint: '$\\frac{1}{n}\\sum f\\left(\\frac{k}{n}\\right)$ の形に直す。',
      steps: [
        ['区分求積の形に', `極限は $\\displaystyle\\int_0^1 ${tex(f)}\\,dx$。`],
        ['$\\pi x=t$ で置換', `$$\\int_0^1 ${tex(f)}\\,dx=\\frac{1}{\\pi^{${m + 1}}}\\int_0^{\\pi}${m ? (m === 1 ? 't' : `t^{${m}}`) : ''}\\sin t\\,dt$$ ${m ? '部分積分を繰り返して計算する。' : ''}`],
        ['結論', `$$${val.tex()}$$`],
        ['発想の源', '$\\sin\\frac{k\\pi}{n}$ は $\\sin\\left(\\pi\\cdot\\frac{k}{n}\\right)$。$\\frac{k}{n}$ を $x$ とみれば区分求積。'],
      ]
    };
  }
  const r = randRat();
  const dP = r.Pp.length - 1, dQ = r.Qt.den.length - 1;
  const s = dP - dQ + 1; // 項 = n^{-s} P̃/Q̃
  const num = bivTex(r.Pp);
  const nPow = s === 0 ? '' : s === 1 ? 'n' : s > 0 ? `n^{${s}}` : '';
  const numF = s < 0 ? (s === -1 ? 'n' : `n^{${-s}}`) + (num === '1' ? '' : `(${num})`) : num;
  const denT = r.Qt.kt.startsWith('(') ? r.Qt.kt : (nPow ? `(${r.Qt.kt})` : r.Qt.kt);
  const term = `\\frac{${numF}}{${nPow}${denT}}`;
  return {
    stars: 4, tags: ['区分求積法', '部分分数分解'],
    statement: '次の極限値を求めよ。' + DMath(`${lim}\\sum_{k=1}^{n}${term}`),
    value: r.val.num(), answerX: r.val, check: { f: r.f, a: 0, b: 1 },
    hint: '分子分母を $n$ のべきで割って $\\frac{k}{n}$ だけの式にする。',
    steps: [
      ['区分求積の形に', `分子分母を $n^{${dQ}}$ などで割ると、各項は $\\dfrac{1}{n}f\\left(\\dfrac{k}{n}\\right)$、$f(x)=${tex(r.f)}$ になる。よって極限は $\\displaystyle\\int_0^1 f(x)\\,dx$。`],
      ...ratSteps(r),
      ['結論', `$$${r.val.tex()}$$`],
      ['発想の源', '$\\sum$ の中を「$\\frac1n\\times$（$\\frac{k}{n}$ の式）」にそろえるのが第一歩。$n$ の次数をそろえる割り算がそのまま変換になる。'],
    ]
  };
} };

// G7 n∫x^{pn} f → f(1)/p --------------------------------------------
const SMOOTH = [
  () => pow(add(N(1), pow(VX, N(2))), N(-1)), () => exp(pow(VX, N(2))), () => sqrt(add(N(1), mul(N(3), VX))), () => cos(mul(PI, VX, N(1, 3))),
  () => pow(add(N(1), VX), N(-2)), () => log(add(N(1), VX)), () => mul(VX, exp(VX)), () => sqrt(add(VX, N(3))), () => sin(mul(PI, VX, N(1, 2))),
  () => log(add(N(1), pow(VX, N(2)))), () => exp(neg(VX)), () => pow(add(N(3), pow(VX, N(2))), N(-1)), () => tan(mul(PI, VX, N(1, 4))),
];
GEN.nlim = { name: '積分の極限', hue: 210, make() {
  for (let tries = 0; tries < 20; tries++) {
    const f = Math.random() < .5 ? PK(SMOOTH)() : mul(PK(SMOOTH)(), PK(SMOOTH)());
    let f1; try { f1 = evalX(f, X.r(1)); } catch { continue; }
    if (f1.hasGen() || f1.isZero()) continue;
    const p = PK([1, 2, 3]); const ans = f1.scale(q(1, p));
    const pw = p === 1 ? 'n' : `${p}n`;
    return {
      stars: 4, tags: ['部分積分', 'はさみうち', '極限'],
      statement: '次の極限値を求めよ。' + DMath(`\\lim_{n\\to\\infty}n\\int_0^1 x^{${pw}}${/^[\\a-z]/.test(tex(f)) || tex(f).startsWith('\\left') ? '' : ''}${f.k === 'add' || f.k === 'mul' ? '\\left(' + tex(f) + '\\right)' : tex(f)}\\,dx`),
      value: ans.num(), answerX: ans, check: null,
      hint: `$x^{${pw}}$ を積分する側にして部分積分。残りは $\\frac1n$ のオーダーで消える。`,
      steps: [
        ['部分積分', `$f(x)=${tex(f)}$ とおく。$$\\int_0^1 x^{${pw}}f(x)\\,dx=\\frac{f(1)}{${pw}+1}-\\frac{1}{${pw}+1}\\int_0^1 x^{${pw}+1}f'(x)\\,dx$$`],
        ['残りを評価', `$f'(x)$ は $[0,1]$ で連続なので $|f'(x)|\\le M$ となる定数 $M$ がある。よって $$\\left|\\int_0^1 x^{${pw}+1}f'(x)\\,dx\\right|\\le\\frac{M}{${pw}+2}\\to0$$`],
        ['極限', `$$n\\int_0^1 x^{${pw}}f(x)\\,dx\\to\\frac{f(1)}{${p}}$$`],
        ['結論', `$f(1)=${f1.tex()}$ より $$${ans.tex()}$$`],
        ['発想の源', `$x^{${pw}}$ の重みは $n$ が大きいと $x=1$ の近くに集中する。重みの総量 $\\int_0^1x^{${pw}}dx\\approx\\frac{1}{${pw}}$ が $\\frac{1}{${p}}$ 倍の正体。`],
      ]
    };
  }
  return null;
} };

// G8 置換で有理関数へ -------------------------------------------------
GEN.subst = { name: '置換 → 部分分数', hue: 140, make() {
  const r = randRat();
  const ph = PK([
    { phi: sin(VX), dphi: cos(VX), a: B.zero, b: B.pi2, u: 'u=\\sin x', bnd: '$x:0\\to\\frac{\\pi}{2}$ で $u:0\\to1$' },
    { phi: tan(VX), dphi: pow(cos(VX), N(-2)), a: B.zero, b: B.pi4, u: 'u=\\tan x', bnd: '$x:0\\to\\frac{\\pi}{4}$ で $u:0\\to1$' },
    { phi: add(exp(VX), N(-1)), dphi: exp(VX), a: B.zero, b: B.ln2, u: 'u=e^{x}-1', bnd: '$x:0\\to\\log 2$ で $u:0\\to1$' },
    { phi: log(add(N(1), VX)), dphi: pow(add(N(1), VX), N(-1)), a: B.zero, b: { x: X.e.sub(X.r(1)), t: 'e-1' }, u: 'u=\\log(1+x)', bnd: '$x:0\\to e-1$ で $u:0\\to1$', ratOnly: true },
  ]);
  const g = mul(subst(r.f, ph.phi), ph.dphi);
  return {
    stars: 4, tags: ['置換積分', '部分分数分解'],
    statement: '次の定積分を求めよ。' + DMath(INT(ph.a.t, ph.b.t, tex(g))),
    value: r.val.num(), answerX: r.val, check: { f: g, a: ph.a.x.num(), b: ph.b.x.num() },
    hint: `$${ph.u}$ とおいてみよ。`,
    steps: [
      [`$${ph.u}$ で置換`, `$du=${tex(ph.dphi)}\\,dx$、${ph.bnd}。よって $$I=\\int_0^1 ${tex(r.f).replace(/x/g, 'u')}\\,du$$`],
      ...ratSteps(r).map(([h, b]) => [h, b]),
      ['結論', `$$I=${r.val.tex()}$$`],
      ['発想の源', '被積分関数の中に「ある関数とその導関数」の組が見えたら、その関数を新しい変数にする。残るのは有理関数で、次数下げと部分分数で必ず積分できる。'],
    ]
  };
} };

// G9 Wallis への置換 ------------------------------------------------
GEN.wallis = { name: 'sin 置換 × Wallis', hue: 190, make() {
  const m = RI(2, 7), p = RI(1, 3);
  const n = 2 * p + 2; const w = W(m, n);
  const f = mul(pow(VX, N(m)), pow(add(N(1), neg(pow(VX, N(2)))), N(q(2 * p + 1, 2))));
  return {
    stars: 4, tags: ['置換積分', 'Wallis 積分'],
    statement: '次の定積分を求めよ。' + DMath(INT(0, 1, `x^{${m}}\\left(1-x^2\\right)^{\\frac{${2 * p + 1}}{2}}`)),
    value: w.v.num(), answerX: w.v, check: { f, a: 0, b: 1 },
    hint: '$x=\\sin\\theta$ とおくと $\\sin^m\\theta\\cos^n\\theta$ 型になる。',
    steps: [
      ['$x=\\sin\\theta$ で置換', `$dx=\\cos\\theta\\,d\\theta$、$(1-x^2)^{\\frac{${2 * p + 1}}{2}}=\\cos^{${2 * p + 1}}\\theta$ より $$\\int_0^{\\frac{\\pi}{2}}\\sin^{${m}}\\theta\\cos^{${n}}\\theta\\,d\\theta$$`],
      ['漸化式', '$I_{m,n}=\\int_0^{\\pi/2}\\sin^m\\cos^n$ は部分積分で $I_{m,n}=\\dfrac{m-1}{m+n}I_{m-2,n}$、同様に $I_{m,n}=\\dfrac{n-1}{m+n}I_{m,n-2}$。'],
      ['結論', `$$${wallisLine(m, n)}$$`],
      ['発想の源', '$\\sqrt{1-x^2}$ を含む式は $x=\\sin\\theta$。指数が半整数でも置換後は整数乗になる。'],
    ]
  };
} };

// G10 tan(x/2) 置換 --------------------------------------------------
GEN.weier = { name: 'tan(x/2) 置換', hue: 95, make() {
  const v = PK([
    { c: 1, U: B.pi2, t: X.r(1), tt: '1' }, { c: 1, U: { x: X.pi.scale(q(2, 3)), t: '\\frac{2\\pi}{3}' }, t: R3(), tt: '\\sqrt{3}' },
    { c: -1, U: B.pi3, t: R3().scale(q(1, 3)), tt: '\\frac{1}{\\sqrt{3}}' }, { c: -1, U: B.pi2, t: X.r(1), tt: '1' },
  ]);
  // ∫_0^U dx/(2+c cos x) : c=1 → (2/√3) atan(t/√3), c=-1 → (2/√3) atan(√3 t)
  const ang = atanX(v.c === 1 ? v.t.mul(R3().inv()) : v.t.mul(R3()));
  const I0 = ang.mul(R3().inv()).scale(2);
  const al = RI(0, 3), be = RI(1, 4) * (Math.random() < .3 ? -1 : 1);
  // (be + al cos x)/(2 + c cos x) = al/c + (be - 2al/c)/(2 + c cos x)
  const quo = q(al, v.c), rem = q(be).sub(q(2 * al, v.c));
  const val = v.U.x.scale(quo).add(I0.scale(rem));
  const f = mul(add(N(be), mul(N(al), cos(VX))), pow(add(N(2), mul(N(v.c), cos(VX))), N(-1)));
  return {
    stars: 3, tags: ['tan(x/2) 置換', 'tan 置換'],
    statement: '次の定積分を求めよ。' + DMath(INT(0, v.U.t, tex(f))),
    value: val.num(), answerX: val, check: { f, a: 0, b: v.U.x.num() },
    hint: '分子を分母で割ってから、$t=\\tan\\frac{x}{2}$。',
    steps: [
      ...(al ? [['分子を割る', `$$${tex(f)}=${quo.tex()}${rem.sign() >= 0 ? '+' : ''}${rem.tex()}\\cdot\\frac{1}{2${v.c > 0 ? '+' : '-'}\\cos x}$$`]] : []),
      ['$t=\\tan\\frac{x}{2}$', `$\\cos x=\\dfrac{1-t^2}{1+t^2}$、$dx=\\dfrac{2\\,dt}{1+t^2}$、上端 $t=${v.tt}$。
$$\\int_0^{${v.U.t}}\\frac{dx}{2${v.c > 0 ? '+' : '-'}\\cos x}=\\int_0^{${v.tt}}\\frac{2\\,dt}{${v.c > 0 ? '3+t^2' : '1+3t^2'}}=${I0.tex()}$$（最後は $t=${v.c > 0 ? '\\sqrt3' : '\\frac{1}{\\sqrt3}'}\\tan\\varphi$ で置換）`],
      ['結論', `$$${val.tex()}$$`],
      ['発想の源', '$\\sin,\\cos$ の有理式は $t=\\tan\\frac{x}{2}$ で必ず有理関数になる。分子に $\\cos x$ があれば先に割り算で定数にしておく。'],
    ]
  };
} };

// ====================== 微分の生成器（難しめ） ======================
const POINTS = [X.r(0), X.r(1), X.r(1, 2), X.r(2), X.pi.scale(q(1, 6)), X.pi.scale(q(1, 4)), X.pi.scale(q(1, 3)), X.pi.scale(q(1, 2)), X.e];
const INNER = [() => VX, () => pow(VX, N(2)), () => add(pow(VX, N(2)), N(1)), () => sin(VX), () => cos(VX), () => mul(N(2), VX), () => add(VX, N(1)), () => log(VX), () => exp(VX), () => tan(VX)];
const OUTER = [a => sin(a), a => cos(a), a => exp(a), a => log(a), a => sqrt(a), a => pow(a, N(3)), a => pow(a, N(-1)), a => tan(a)];
const SIMPLE = [() => VX, () => pow(VX, N(2)), () => exp(VX), () => sin(VX), () => cos(VX), () => log(VX), () => sqrt(VX), () => add(pow(VX, N(2)), N(1))];
function niceX(x) { return x && !x.hasGen() && x.tex().length < 90; }
function numDeriv(f, a, n) {
  const h = 1e-3 * Math.max(1, Math.abs(a));
  if (n === 1) return (-f(a + 2 * h) + 8 * f(a + h) - 8 * f(a - h) + f(a - 2 * h)) / (12 * h);
  return (-f(a + 2 * h) + 16 * f(a + h) - 30 * f(a) + 16 * f(a - h) - f(a - 2 * h)) / (12 * h * h);
}
const close = (a, b, tol) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
function ptTex(x) { return x.tex(); }

GEN.dcomp = { name: '合成関数の2階微分', hue: 15, deriv: true, make() {
  for (let t = 0; t < 40; t++) {
    const form = PK(['outerinner', 'prod', 'quot', 'double']);
    let f;
    if (form === 'outerinner') f = PK(OUTER)(PK(INNER)());
    else if (form === 'prod') f = mul(PK(SIMPLE)(), PK(OUTER)(PK(INNER)()));
    else if (form === 'quot') f = dv(PK(OUTER)(PK(INNER)()), PK(SIMPLE)());
    else f = PK(OUTER)(PK(OUTER)(PK(INNER)()));
    if (!hasXv(f)) continue;
    const ord = Math.random() < .75 ? 2 : 1;
    const d1 = diff(f), d2 = diff(d1); const dn = ord === 2 ? d2 : d1;
    const pts = POINTS.slice().sort(() => Math.random() - .5);
    for (const a of pts) {
      let v; try { const f0 = evalX(f, a); if (!niceX(f0)) continue; v = evalX(dn, a); } catch { continue; }
      if (!niceX(v) || (v.isZero() && Math.random() < .85)) continue;
      const an = a.num(); const fn_ = x => evalN(f, x);
      if (![-2, -1, 1, 2].every(s => Number.isFinite(fn_(an + s * 1e-3 * Math.max(1, Math.abs(an)))))) continue;
      if (!close(numDeriv(fn_, an, ord), v.num(), 2e-4)) continue;
      const ft = tex(f); if (ft.length > 70) continue;
      const pr = ord === 2 ? "f''" : "f'";
      return {
        stars: ord === 2 ? 4 : 3, tags: ['合成関数の微分', ord === 2 ? '第2次導関数' : '積・商の微分'],
        statement: '関数' + DMath(`f(x)=${ft}`) + `について、$${pr}\\left(${ptTex(a)}\\right)$ の値を求めよ。`,
        value: v.num(), answerX: v, check: null,
        hint: ord === 2 ? 'まず $f\'(x)$ を求め、もう一度微分してから代入する。代入は最後に。' : '合成関数の微分（外側の微分 × 内側の微分）を丁寧に。',
        steps: [
          ['1回微分', `$$f'(x)=${tex(d1)}$$`],
          ...(ord === 2 ? [['2回微分', `$$f''(x)=${tex(d2)}$$`]] : []),
          ['代入', `$x=${ptTex(a)}$ を代入して $$${pr}\\left(${ptTex(a)}\\right)=${v.tex()}$$`],
          ['発想の源', '合成関数は外側から順に微分して内側の導関数を掛ける。2回微分では積の微分が必ず現れるので、項を落とさないように展開してから代入する。'],
        ]
      };
    }
  }
  return null;
} };

GEN.dlogd = { name: '対数微分法', hue: 330, deriv: true, make() {
  for (let t = 0; t < 40; t++) {
    const base = PK([() => VX, () => sin(VX), () => add(pow(VX, N(2)), N(1)), () => cos(VX), () => add(VX, N(1))])();
    const ex = PK([() => sin(VX), () => VX, () => log(VX), () => pow(VX, N(2)), () => cos(VX), () => sqrt(VX), () => exp(VX)])();
    if (keyOf(base) === keyOf(ex)) continue;
    const f = pow(base, ex); const ord = Math.random() < .35 ? 2 : 1;
    const d1 = diff(f), dn = ord === 2 ? diff(d1) : d1;
    const pts = POINTS.slice().sort(() => Math.random() - .5);
    for (const a of pts) {
      const an = a.num(); if (an <= 0) continue;
      let v; try { v = evalX(dn, a); } catch { continue; }
      if (!niceX(v) || (v.isZero() && Math.random() < .85)) continue;
      const fn_ = x => evalN(f, x);
      if (!close(numDeriv(fn_, an, ord), v.num(), 2e-4)) continue;
      const pr = ord === 2 ? "f''" : "f'";
      const lt = `\\log f(x)=${tex(mul(ex, log(base)))}`;
      return {
        stars: ord === 2 ? 5 : 4, tags: ['対数微分法', ord === 2 ? '第2次導関数' : '合成関数の微分'],
        statement: `$x>0$ ${tex(base) === 'x' ? '' : `（ただし $${tex(base)}>0$ の範囲）`}で定義された関数` + DMath(`f(x)=${tex(f)}`) + `について、$${pr}\\left(${ptTex(a)}\\right)$ の値を求めよ。`,
        value: v.num(), answerX: v, check: null,
        hint: '底にも指数にも $x$ がある。両辺の対数をとってから微分する。',
        steps: [
          ['対数をとる', `$$${lt}$$`],
          ['両辺を微分', `$$\\frac{f'(x)}{f(x)}=${tex(diff(mul(ex, log(base))))}$$ よって $$f'(x)=${tex(d1)}$$`],
          ...(ord === 2 ? [['もう一度微分', `$$f''(x)=${tex(dn)}$$`]] : []),
          ['代入', `$$${pr}\\left(${ptTex(a)}\\right)=${v.tex()}$$`],
          ['発想の源', '$x^x$ 型は公式 $(a^x)\'$ も $(x^n)\'$ も使えない。対数で指数を前に降ろし、積の微分に変える。'],
        ]
      };
    }
  }
  return null;
} };

GEN.dleib = { name: 'Leibniz の公式', hue: 52, deriv: true, make() {
  const m = RI(2, 4), n = RI(m + 3, 12), k = PK([1, 2, 3, -1, -2]);
  const vk = PK(['exp', 'sin', 'cos']);
  const r = n - m;
  let vr; // v^{(r)}(0)
  if (vk === 'exp') vr = X.r(q(k).powi(r).n, q(k).powi(r).d);
  else { const kr = q(k).powi(r); const ang = X.pi.scale(q(r, 2)); vr = (vk === 'sin' ? sinX(ang) : cosX(ang)).scale(kr); }
  const coef = binom(n, m) * fact(m);
  const ans = vr.scale(q(coef));
  const vT = vk === 'exp' ? (k === 1 ? 'e^{x}' : `e^{${k}x}`) : `\\${vk} ${k === 1 ? 'x' : k === -1 ? '(-x)' : k + 'x'}`;
  if (ans.isZero() && Math.random() < .7) return GEN.dleib.make();
  return {
    stars: 4, tags: ['Leibniz の公式', '高次導関数'],
    statement: `関数 $f(x)=x^{${m}}${vT}$ について、$f^{(${n})}(0)$ の値を求めよ。`,
    value: ans.num(), answerX: ans, check: null,
    hint: '$(uv)^{(n)}=\\sum_{j}\\binom{n}{j}u^{(j)}v^{(n-j)}$。$x=0$ で生き残るのはどの項？',
    steps: [
      ['Leibniz の公式', `$u=x^{${m}},\\ v=${vT}$ とすると $$f^{(${n})}(x)=\\sum_{j=0}^{${n}}\\binom{${n}}{j}u^{(j)}(x)\\,v^{(${n}-j)}(x)$$`],
      ['$x=0$ で残る項', `$u^{(j)}(0)$ は $j=${m}$ のときだけ $${m}!$ で、それ以外は $0$。よって $$f^{(${n})}(0)=\\binom{${n}}{${m}}\\cdot${m}!\\cdot v^{(${r})}(0)$$`],
      ['$v^{(' + r + ')}(0)$', vk === 'exp' ? `$v^{(${r})}(x)=${k === 1 ? '' : `(${k})^{${r}}`}${vT}$ より $v^{(${r})}(0)=${vr.tex()}$。` : `$\\${vk}$ は微分するたびに位相が $\\frac{\\pi}{2}$ ずつ進む：$v^{(${r})}(x)=${k === 1 ? '' : `(${k})^{${r}}`}\\${vk}\\left(${k === 1 ? '' : k}x+\\frac{${r}\\pi}{2}\\right)$。よって $v^{(${r})}(0)=${vr.tex()}$。`],
      ['結論', `$$f^{(${n})}(0)=${String(binom(n, m))}\\cdot${String(fact(m))}\\cdot${/^-/.test(vr.tex()) ? '\\left(' + vr.tex() + '\\right)' : vr.tex()}=${ans.tex()}$$`],
      ['発想の源', '高次導関数を直接追うのは無理。積なら Leibniz、さらに $x=0$ では多項式側のほとんどの項が消える。'],
    ]
  };
} };

GEN.dparam = { name: '媒介変数の2階微分', hue: 240, deriv: true, make() {
  const pairs = [
    () => ({ X: sub(VX, sin(VX)), Y: sub(N(1), cos(VX)), pts: [B.pi3, B.pi2, { x: X.pi.scale(q(2, 3)), t: '\\frac{2\\pi}{3}' }], name: 'サイクロイド' }),
    () => ({ X: pow(cos(VX), N(3)), Y: pow(sin(VX), N(3)), pts: [B.pi6, B.pi4, B.pi3], name: 'アステロイド' }),
    () => ({ X: mul(exp(VX), cos(VX)), Y: mul(exp(VX), sin(VX)), pts: [B.zero, B.pi4, B.pi6], name: '対数らせん' }),
    () => { const a = RI(1, 3); return { X: add(pow(VX, N(2)), N(a)), Y: sub(pow(VX, N(3)), mul(N(3), VX)), pts: [B.one, B.two, { x: X.r(3), t: '3' }], name: '' }; },
    () => ({ X: add(VX, pow(VX, N(-1))), Y: sub(VX, pow(VX, N(-1))), pts: [B.two, { x: X.r(3), t: '3' }, B.one], name: '' }),
    () => ({ X: log(VX), Y: add(pow(VX, N(2)), pow(VX, N(-1))), pts: [B.one, B.two, B.e], name: '' }),
    () => ({ X: tan(VX), Y: pow(cos(VX), N(2)), pts: [B.pi6, B.pi4, B.pi3], name: '' }),
  ];
  for (let t = 0; t < 20; t++) {
    const pr = PK(pairs)(); const T = PK(pr.pts);
    const dX = diff(pr.X), dY = diff(pr.Y);
    const yx = dv(dY, dX); const yxx = dv(diff(yx), dX);
    let v, x1; try { x1 = evalX(dX, T.x); if (x1.isZero()) continue; v = evalX(yxx, T.x); } catch { continue; }
    if (!niceX(v)) continue;
    // 数値検証
    const tn = T.x.num(), h = 1e-4;
    const Xn = s => evalN(pr.X, s), Yn = s => evalN(pr.Y, s);
    const slope = s => (Yn(s + h) - Yn(s - h)) / (Xn(s + h) - Xn(s - h));
    const num = (slope(tn + 1e-3) - slope(tn - 1e-3)) / (Xn(tn + 1e-3) - Xn(tn - 1e-3));
    if (!close(num, v.num(), 1e-3)) continue;
    const tt = e => tex(e).replace(/x/g, 't');
    return {
      stars: 5, tags: ['媒介変数表示', '第2次導関数'],
      statement: `${pr.name ? '曲線（' + pr.name + '）' : '曲線'}` + DMath(`x=${tt(pr.X)},\\quad y=${tt(pr.Y)}`) + `について、$t=${T.t}$ における $\\dfrac{d^2y}{dx^2}$ の値を求めよ。`,
      value: v.num(), answerX: v, check: null,
      hint: '$\\frac{d^2y}{dx^2}=\\frac{d}{dt}\\left(\\frac{dy}{dx}\\right)\\Big/\\frac{dx}{dt}$。$\\frac{dy}{dx}$ をもう一度 $x$ で微分するのではなく $t$ で微分して割る。',
      steps: [
        ['1階', `$$\\frac{dx}{dt}=${tt(dX)},\\quad \\frac{dy}{dt}=${tt(dY)},\\quad \\frac{dy}{dx}=${tt(yx)}$$`],
        ['2階', `$$\\frac{d^2y}{dx^2}=\\frac{\\frac{d}{dt}\\left(\\frac{dy}{dx}\\right)}{\\frac{dx}{dt}}=${tt(yxx)}$$`],
        ['代入', `$t=${T.t}$ を代入して $$\\frac{d^2y}{dx^2}=${v.tex()}$$`],
        ['発想の源', '$\\frac{d^2y}{dx^2}$ は $\\frac{d^2y/dt^2}{d^2x/dt^2}$ ではない。$\\frac{dy}{dx}$ を $t$ の関数とみて微分し、$\\frac{dx}{dt}$ で割る（合成関数の微分）。'],
      ]
    };
  }
  return null;
} };

GEN.dinv = { name: '逆関数の微分', hue: 120, deriv: true, make() {
  const fs = [
    () => ({ f: add(pow(VX, N(3)), VX), pts: [X.r(1), X.r(2), X.r(-1)] }),
    () => ({ f: add(VX, sin(VX)), pts: [X.pi.scale(q(1, 2)), X.pi.scale(q(1, 3)), X.pi.scale(q(1, 6))] }),
    () => ({ f: add(VX, exp(VX)), pts: [X.r(0), X.r(1)] }),
    () => ({ f: mul(VX, exp(VX)), pts: [X.r(1), X.r(0)] }),
    () => ({ f: add(mul(N(2), VX), log(VX)), pts: [X.r(1), X.e] }),
    () => ({ f: add(pow(VX, N(5)), pow(VX, N(3)), VX), pts: [X.r(1), X.r(-1)] }),
    () => ({ f: add(tan(VX), VX), pts: [X.pi.scale(q(1, 4)), X.pi.scale(q(1, 6)), X.r(0)] }),
    () => ({ f: sub(mul(N(2), VX), cos(VX)), pts: [X.pi.scale(q(1, 2)), X.r(0), X.pi.scale(q(1, 3))] }),
  ];
  for (let t = 0; t < 20; t++) {
    const c = PK(fs)(); const a = PK(c.pts);
    const d1 = diff(c.f), d2 = diff(d1);
    let b, f1, f2; try { b = evalX(c.f, a); f1 = evalX(d1, a); f2 = evalX(d2, a); } catch { continue; }
    if (f1.isZero() || !niceX(b)) continue;
    const ord = Math.random() < .7 ? 2 : 1;
    let v; try { v = ord === 2 ? f2.neg().div(f1.powi(3)) : f1.inv(); } catch { continue; }
    if (!niceX(v)) continue;
    const pr = ord === 2 ? "g''" : "g'";
    return {
      stars: ord === 2 ? 5 : 3, tags: ['逆関数の微分', ord === 2 ? '第2次導関数' : '合成関数の微分'],
      statement: '関数' + DMath(`f(x)=${tex(c.f)}`) + `の逆関数を $g(x)$ とする。$${pr}\\left(${b.tex()}\\right)$ の値を求めよ。`,
      value: v.num(), answerX: v, check: null,
      hint: `$g(f(x))=x$ を微分する。$f(a)=${b.tex()}$ となる $a$ は？`,
      steps: [
        ['対応する点', `$f(${a.tex()})=${b.tex()}$ なので $g(${b.tex()})=${a.tex()}$。`],
        ['1回微分', `$g(f(x))=x$ を微分して $g'(f(x))\\,f'(x)=1$。$f'(x)=${tex(d1)}$ より $f'(${a.tex()})=${f1.tex()}$。`],
        ...(ord === 2 ? [['2回微分', `もう一度微分して $g''(f(x))\\{f'(x)\\}^2+g'(f(x))f''(x)=0$。よって $$g''(f(x))=-\\frac{f''(x)}{\\{f'(x)\\}^3}$$ $f''(x)=${tex(d2)}$、$f''(${a.tex()})=${f2.tex()}$。`]] : []),
        ['結論', `$$${pr}\\left(${b.tex()}\\right)=${v.tex()}$$`],
        ['発想の源', '逆関数は式で書けなくても、$g(f(x))=x$ を微分すれば $f$ の情報だけで導関数が出る。'],
      ]
    };
  }
  return null;
} };

// ---- 生成 + 検証 ----
function verifyProblem(p) {
  if (!p) return false;
  if (!Number.isFinite(p.value)) return false;
  if (p.answerX && !close(p.answerX.num(), p.value, 1e-12)) return false;
  if (p.check) {
    const fN = x => evalN(p.check.f, x);
    const got = integrate(fN, p.check.a, p.check.b);
    const target = p.check.target !== undefined ? p.check.target : p.value;
    if (!close(got, target, p.tol || 1e-8)) return false;
  }
  return true;
}
function generate(id) {
  const G = GEN[id];
  for (let i = 0; i < 6; i++) {
    let p; try { p = G.make(); } catch (e) { p = null; }
    if (p && verifyProblem(p)) {
      p.fid = id; p.hue = G.hue; p.gen = G.name; p.deriv = !!G.deriv;
      p.answerTex = p.answerX.tex();
      delete p.answerX; delete p.check;
      return p;
    }
  }
  return null;
}
const GEN_IDS = Object.keys(GEN);


// ===================== 画面 =====================
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const app = $('#app'), feed = $('#feed');

// ================== 保存領域（失敗しても動く） ==================
const store = {
  get(k, d) { try { const v = localStorage.getItem('intreel:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('intreel:' + k, JSON.stringify(v)); } catch {} }
};
const S = {
  xp: store.get('xp', 0), solved: store.get('solved', 0), best: store.get('best', 0), streak: 0,
  stats: store.get('stats', {}), saved: store.get('saved', []), muted: store.get('muted', false)
};
const saveAll = () => { store.set('xp', S.xp); store.set('solved', S.solved); store.set('best', S.best); store.set('stats', S.stats); store.set('saved', S.saved); store.set('muted', S.muted); };

// ================== MathJax ==================
let mjChain = Promise.resolve();
const mjWait = [];
function typeset(els) {
  els = [].concat(els).filter(Boolean);
  if (!window.__mjOK) { mjWait.push(...els); return Promise.resolve(); }
  mjChain = mjChain.then(() => MathJax.typesetPromise(els)).catch(() => {});
  return mjChain;
}
document.addEventListener('mj-ready', () => {
  const w = mjWait.splice(0);
  typeset(w).then(() => w.forEach(fitMath));
  renderDisplay();
});
function fitMath(root) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll('mjx-container[display="true"]').forEach(c => {
    c.style.fontSize = '';
    const svg = c.querySelector('svg'); if (!svg) return;
    const avail = c.clientWidth, need = svg.getBoundingClientRect().width;
    if (need > avail && avail > 0) c.style.fontSize = Math.max(70, Math.floor(150 * avail / need * 0.97)) + '%';
  });
}
function texToNode(tex) {
  if (!window.__mjOK) { const s = document.createElement('span'); s.textContent = tex; return s; }
  try { return MathJax.tex2svg(tex, { display: false }); } catch { const s = document.createElement('span'); s.textContent = tex; return s; }
}

// ================== Markdown（数式を保護） ==================
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function md(src) {
  const math = [];
  let s = String(src).replace(/\$\$([\s\S]+?)\$\$/g, (m) => { math.push(m); return '\u0000' + (math.length - 1) + '\u0000'; })
                     .replace(/\$([^$\n]+?)\$/g, (m) => { math.push(m); return '\u0000' + (math.length - 1) + '\u0000'; });
  s = esc(s);
  const lines = s.split('\n'); let out = '', list = null, para = [];
  const flushP = () => { if (para.length) { out += '<p>' + para.join('<br>') + '</p>'; para = []; } };
  const flushL = () => { if (list) { out += '</' + list + '>'; list = null; } };
  for (const raw of lines) {
    const l = raw.trimEnd();
    let m;
    if (!l.trim()) { flushP(); flushL(); continue; }
    if ((m = l.match(/^#{1,2}\s+(.*)/))) { flushP(); flushL(); out += '<h4>' + m[1] + '</h4>'; continue; }
    if ((m = l.match(/^#{3,6}\s+(.*)/))) { flushP(); flushL(); out += '<h5>' + m[1] + '</h5>'; continue; }
    if ((m = l.match(/^\s*[-*]\s+(.*)/))) { flushP(); if (list !== 'ul') { flushL(); out += '<ul>'; list = 'ul'; } out += '<li>' + m[1] + '</li>'; continue; }
    if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { flushP(); if (list !== 'ol') { flushL(); out += '<ol>'; list = 'ol'; } out += '<li>' + m[1] + '</li>'; continue; }
    flushL(); para.push(l);
  }
  flushP(); flushL();
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => esc(math[+i]));
}

// ================== 効果音 ==================
let actx = null;
function audio() {
  if (S.muted) return null;
  try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch { return null; }
  return actx;
}
function tone(ctx, freq, t0, dur, type = 'triangle', gain = .18) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + .01); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + dur + .05);
}
function sfxClick() { const c = audio(); if (!c) return; tone(c, 880, c.currentTime, .05, 'sine', .04); }
function sfxWin(streak) {
  const c = audio(); if (!c) return;
  const t = c.currentTime, base = 523.25 * Math.pow(2, Math.min(streak - 1, 7) * 2 / 12);
  // 低音のドン
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + .4);
  g.gain.setValueAtTime(.5, t); g.gain.exponentialRampToValueAtTime(.001, t + .5); o.connect(g).connect(c.destination); o.start(t); o.stop(t + .55);
  [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => { const f = base * Math.pow(2, s / 12); tone(c, f, t + .05 + i * .065, .5, 'triangle', .16); tone(c, f * 2, t + .05 + i * .065, .3, 'sine', .05); });
  [0, 4, 7, 12].forEach(s => tone(c, base * Math.pow(2, s / 12), t + .55, 1.3, 'sine', .09));
  for (let i = 0; i < 14; i++) tone(c, 2400 + Math.random() * 2600, t + .5 + Math.random() * .9, .12, 'sine', .035);
}
function sfxWrong() { const c = audio(); if (!c) return; const t = c.currentTime; tone(c, 196, t, .18, 'square', .06); tone(c, 155, t + .12, .25, 'square', .06); }
const vib = p => { try { navigator.vibrate && navigator.vibrate(p); } catch {} };

// ================== 問題の選択（おすすめ） ==================
const recentF = [];
function famStats(id) { return S.stats[id] || (S.stats[id] = { seen: 0, correct: 0, give: 0, wrong: 0, fast: 0 }); }
function pickGen() {
  const ws = GEN_IDS.map(id => {
    const st = famStats(id);
    let w = 1 + 2.2 * (st.give + Math.min(st.wrong, 3)) / (st.seen + 1) - 0.6 * st.fast / (st.seen + 1);
    if (st.seen === 0) w += .6;
    if (GEN[id].deriv) w *= .5;
    const r = recentF.indexOf(id); if (r >= 0) w *= [.02, .1, .3, .6][r] ?? 1;
    return Math.max(.03, w);
  });
  let x = Math.random() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < ws.length; i++) { x -= ws[i]; if (x <= 0) return GEN_IDS[i]; }
  return GEN_IDS[0];
}
function whyText(id) {
  const st = famStats(id);
  if (st.give > 0) return 'おすすめ理由：前にギブアップした手法の再挑戦';
  if (st.wrong > 1) return 'おすすめ理由：まだ取りこぼしがある手法';
  if (st.fast > 0) return 'おすすめ理由：瞬殺した手法の発展版';
  if (st.seen === 0) return 'おすすめ理由：まだ出会っていない手法';
  return '';
}

// ================== リール ==================
let counter = store.get('counter', 0);
const reels = []; // {el, p, solved, gave, attempts, hint, t0, elapsed, ed}
let cur = -1;

const ICON = {
  sol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/></svg>',
  hint: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg>',
  save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/></svg>',
};

function makeReel(p, opts = {}) {
  counter++; store.set('counter', counter);
  const r = { p, no: counter, solved: false, gave: false, attempts: 0, hintUsed: false, t0: 0, elapsed: 0, ed: null };
  const el = document.createElement('section');
  el.className = 'reel';
  el.style.setProperty('--h', p.hue ?? 260);
  el.innerHTML = `
    <div class="glyph" aria-hidden="true">${p.deriv ? 'd' : '∫'}</div>
    <div class="reel-body">
      <div class="meta">
        <span class="src ${p.deriv ? 'ai' : ''}">${p.deriv ? '微分' : '積分'}</span>
        <span>問 #${r.no}</span>
        <span class="stars" aria-label="難易度${p.stars}">${'★'.repeat(p.stars)}${'☆'.repeat(5 - p.stars)}</span>
        <span class="clock">0:00</span>
        ${opts.why ? `<span class="why">${esc(opts.why)}</span>` : ''}
      </div>
      <div class="statement md">${md(p.statement)}</div>
      <div class="hintbox md" hidden></div>
      <div class="status"></div>
    </div>
    <aside class="rail">
      <button class="rb sol" data-act="sol" aria-label="解答を見る"><span class="ic">${ICON.sol}</span>解答</button>
      <button class="rb" data-act="hint" aria-label="ヒント"><span class="ic">${ICON.hint}</span>ヒント</button>
      <button class="rb ${isSaved(p) ? 'on' : ''}" data-act="save" aria-label="保存"><span class="ic">${ICON.save}</span>保存</button>
    </aside>
    <div class="foot">
      <div class="tags">${p.tags.map(t => `<span class="tag veil">#${esc(t)}</span>`).join('')}<span class="veil-note">← 手法は解くと表示</span></div>
      <button class="answer-bar" data-act="answer">${ICON.pen}<span class="ans-tex">答えを入力…</span><kbd>入力</kbd></button>
    </div>`;
  r.el = el;
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act;
    if (act === 'answer') openKeypad(r);
    if (act === 'sol') openSolution(r);
    if (act === 'hint') showHint(r);
    if (act === 'save') toggleSave(r, b);
  });
  return r;
}

function revealTags(r) {
  r.el.querySelectorAll('.tags .veil').forEach(t => t.classList.remove('veil'));
  const n = r.el.querySelector('.veil-note'); if (n) n.remove();
}

function nextProblem() {
  let id = pickGen(), p = generate(id);
  if (!p) { // 組み立てに失敗したら微分問題で埋める
    for (const d of GEN_IDS.filter(k => GEN[k].deriv).sort(() => Math.random() - .5)) { p = generate(d); if (p) { id = d; break; } }
  }
  recentF.unshift(id); recentF.length = Math.min(recentF.length, 4);
  return { p, why: whyText(id) };
}
function appendReel(p, why, at) {
  const r = makeReel(p, { why });
  if (at != null && at < reels.length) { feed.insertBefore(r.el, reels[at].el); reels.splice(at, 0, r); }
  else { feed.appendChild(r.el); reels.push(r); }
  const st = r.el.querySelector('.statement');
  typeset(st).then(() => fitMath(st));
  io.observe(r.el);
  return r;
}
function ensureAhead() {
  while (reels.length - 1 - cur < 3) { const { p, why } = nextProblem(); appendReel(p, why); }
}

const io = new IntersectionObserver(ents => {
  for (const e of ents) if (e.isIntersecting && e.intersectionRatio > .6) {
    const i = reels.findIndex(r => r.el === e.target);
    if (i >= 0 && i !== cur) activate(i);
  }
}, { root: feed, threshold: [.6] });

function activate(i) {
  const prev = reels[cur];
  if (prev && !prev.solved && prev.t0) prev.elapsed += (performance.now() - prev.t0) / 1000;
  if (prev) prev.t0 = 0;
  cur = i;
  const r = reels[i];
  if (!r.seenCounted) { r.seenCounted = true; if (r.p.fid) { famStats(r.p.fid).seen++; saveAll(); } }
  if (!r.solved) r.t0 = performance.now();
  if (i > 0) { const h = $('.swipe-hint'); if (h) h.remove(); }
  ensureAhead();
}
setInterval(() => {
  const r = reels[cur]; if (!r) return;
  const sec = r.solved ? r.elapsed : r.elapsed + (r.t0 ? (performance.now() - r.t0) / 1000 : 0);
  const c = r.el.querySelector('.clock'); if (c) c.textContent = fmtTime(sec);
}, 1000);
const fmtTime = s => { s = Math.floor(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const curSec = r => r.elapsed + (r.t0 ? (performance.now() - r.t0) / 1000 : 0);

// ================== ヒント・保存 ==================
function showHint(r) {
  const hb = r.el.querySelector('.hintbox');
  if (!hb.hidden) { hb.hidden = true; return; }
  hb.innerHTML = '<strong>ヒント</strong>　' + md(r.p.hint).replace(/^<p>|<\/p>$/g, '');
  hb.hidden = false; r.hintUsed = true;
  typeset(hb);
}
const keyOf = p => p.statement;
const isSaved = p => S.saved.some(s => keyOf(s) === keyOf(p));
function toggleSave(r, btn) {
  if (isSaved(r.p)) { S.saved = S.saved.filter(s => keyOf(s) !== keyOf(r.p)); btn.classList.remove('on'); toast('保存を解除しました'); }
  else { S.saved.unshift(r.p); btn.classList.add('on'); toast('保存しました'); vib(15); }
  saveAll(); updateHud();
}

// ================== HUD ==================
function updateHud() {
  $('#streak').textContent = S.streak; $('#xp').textContent = S.xp.toLocaleString(); $('#solvedN').textContent = S.solved;
  $('#streakPill').classList.toggle('hot', S.streak >= 3);
  const sc = $('#savedCount'); sc.hidden = !S.saved.length; sc.textContent = S.saved.length;
  $('#muteBtn').innerHTML = S.muted
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12"/></svg>';
}
$('#muteBtn').onclick = () => { S.muted = !S.muted; saveAll(); updateHud(); toast(S.muted ? '効果音オフ' : '効果音オン'); };
let toastT;
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2400); }

// ================== シート ==================
let openSheet = null;
function showSheet(id) {
  closeSheet(true);
  openSheet = $(id); openSheet.classList.add('open'); $('#scrim').classList.add('show'); feed.classList.add('locked');
}
function closeSheet(silent) {
  if (!openSheet) return;
  openSheet.classList.remove('open'); $('#scrim').classList.remove('show'); feed.classList.remove('locked');
  openSheet = null;
}
$('#scrim').onclick = () => closeSheet();
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => closeSheet());
// 下スワイプで閉じる
document.querySelectorAll('.sheet').forEach(sh => {
  let y0 = null, dy = 0;
  const head = sh.querySelectorAll('.grab, .sheet-head');
  head.forEach(h => {
    h.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; dy = 0; sh.style.transition = 'none'; }, { passive: true });
    h.addEventListener('touchmove', e => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); sh.style.transform = `translateY(${dy}px)`; }, { passive: true });
    h.addEventListener('touchend', () => { sh.style.transition = ''; sh.style.transform = ''; if (dy > 90) closeSheet(); y0 = null; });
  });
});

// ================== キーパッド（枠に書き込む構造化入力） ==================
// 式は木で持つ。分数・ルート・指数・log は「枠（スロット）」を持ち、カーソルは枠の中を移動する。
const STRUCT = { frac: ['a', 'b'], sqrt: ['a'], pow: ['a'], log: ['a'] };
const newEd = () => { const root = []; return { root, list: root, i: 0 }; };
const slotsOf = n => STRUCT[n.t] ? STRUCT[n.t].map(k => n[k]) : [];
function findParent(root, target) {
  const walk = list => {
    for (let j = 0; j < list.length; j++) {
      const ss = slotsOf(list[j]);
      for (let s = 0; s < ss.length; s++) {
        if (ss[s] === target) return { node: list[j], s, plist: list, idx: j };
        const r = walk(ss[s]); if (r) return r;
      }
    }
    return null;
  };
  return walk(root);
}
const isC = (n, chars) => n && n.t === 'c' && chars.includes(n.v);
function edInsert(ed, key) {
  const L = ed.list;
  const enter = (n, slot) => { L.splice(ed.i, 0, n); ed.list = slot; ed.i = 0; };
  if (key === 'frac') {
    // 直前の項（数・文字・括弧のまとまり・構造）を分子に取り込み、カーソルは分母へ
    let j = ed.i;
    while (j > 0) {
      const prev = L[j - 1];
      if (isC(prev, '+−×(')) break;
      if (isC(prev, ')')) { // 対応する括弧のまとまりごと取り込む
        let depth = 0, k = j - 1;
        for (; k >= 0; k--) { if (isC(L[k], ')')) depth++; if (isC(L[k], '(') && --depth === 0) break; }
        if (k < 0) break; j = k; continue;
      }
      j--;
    }
    const taken = L.splice(j, ed.i - j);
    const n = { t: 'frac', a: taken, b: [] };
    L.splice(j, 0, n);
    ed.list = taken.length ? n.b : n.a; ed.i = 0; return;
  }
  if (key === 'sqrt') { const n = { t: 'sqrt', a: [] }; return enter(n, n.a); }
  if (key === 'log') { const n = { t: 'log', a: [] }; return enter(n, n.a); }
  if (key === 'pow') { const n = { t: 'pow', a: [] }; return enter(n, n.a); }
  if (key === 'sq') { L.splice(ed.i, 0, { t: 'pow', a: [{ t: 'c', v: '2' }] }); ed.i++; return; }
  L.splice(ed.i, 0, { t: 'c', v: key }); ed.i++;
}
function edRight(ed) {
  const L = ed.list;
  if (ed.i < L.length) { const ss = slotsOf(L[ed.i]); if (ss.length) { ed.list = ss[0]; ed.i = 0; } else ed.i++; return; }
  const p = findParent(ed.root, L); if (!p) return;
  const ss = slotsOf(p.node);
  if (p.s < ss.length - 1) { ed.list = ss[p.s + 1]; ed.i = 0; } else { ed.list = p.plist; ed.i = p.idx + 1; }
}
function edLeft(ed) {
  const L = ed.list;
  if (ed.i > 0) { const ss = slotsOf(L[ed.i - 1]); if (ss.length) { const last = ss[ss.length - 1]; ed.list = last; ed.i = last.length; } else ed.i--; return; }
  const p = findParent(ed.root, L); if (!p) return;
  const ss = slotsOf(p.node);
  if (p.s > 0) { ed.list = ss[p.s - 1]; ed.i = ed.list.length; } else { ed.list = p.plist; ed.i = p.idx; }
}
function edBack(ed) {
  const L = ed.list;
  if (ed.i > 0) {
    const n = L[ed.i - 1], ss = slotsOf(n);
    if (ss.length && ss.some(s => s.length)) { const last = ss[ss.length - 1]; ed.list = last; ed.i = last.length; if (last.length) edBack(ed); return; }
    L.splice(ed.i - 1, 1); ed.i--; return;
  }
  // 枠の先頭で消す → 構造をほどいて中身を外に出す
  const p = findParent(ed.root, L); if (!p) return;
  const ss = slotsOf(p.node);
  let pos = p.idx; const flat = [];
  ss.forEach((s, k) => { if (k === p.s) pos = p.idx + flat.length; flat.push(...s); });
  p.plist.splice(p.idx, 1, ...flat);
  ed.list = p.plist; ed.i = pos;
}
function edSer(list) {
  return list.map(n => {
    if (n.t === 'c') return { 'π': 'pi', '×': '*', '−': '-' }[n.v] ?? n.v;
    if (n.t === 'frac') return '((' + edSer(n.a) + ')/(' + edSer(n.b) + '))';
    if (n.t === 'sqrt') return 'sqrt(' + edSer(n.a) + ')';
    if (n.t === 'log') return 'log(' + edSer(n.a) + ')';
    if (n.t === 'pow') return '^(' + edSer(n.a) + ')';
    return '';
  }).join(' ');
}
const edEmpty = ed => ed.root.length === 0;
function edRender(ed, host) {
  host.innerHTML = '';
  const cur = () => { const c = document.createElement('span'); c.className = 'cur'; return c; };
  const build = (list, el) => {
    list.forEach((n, j) => { if (list === ed.list && j === ed.i) el.appendChild(cur()); el.appendChild(item(n, list, j)); });
    if (list === ed.list && ed.i === list.length) el.appendChild(cur());
    if (!list.length) el.classList.add('empty');
    if (list === ed.list && list !== ed.root) el.classList.add('active');
  };
  const slot = list => { const s = document.createElement('span'); s.className = 'es'; s._list = list; build(list, s); return s; };
  const item = (n, list, j) => {
    const e = document.createElement('span'); e._list = list; e._j = j;
    if (n.t === 'c') { e.className = 'ec' + ('+−×'.includes(n.v) ? ' eo' : 'πe'.includes(n.v) ? ' ev' : '()'.includes(n.v) ? ' epar' : ''); e.textContent = n.v; }
    else if (n.t === 'frac') { e.className = 'ef'; e.append(slot(n.a), slot(n.b)); }
    else if (n.t === 'sqrt') { e.className = 'esq'; const r = document.createElement('span'); r.className = 'rad'; r.textContent = '√'; const s = slot(n.a); s.classList.add('under'); e.append(r, s); }
    else if (n.t === 'pow') { e.className = 'ep'; e.append(slot(n.a)); }
    else if (n.t === 'log') {
      e.className = 'elog';
      const f = document.createElement('span'); f.className = 'fnm'; f.textContent = 'log';
      const o = document.createElement('span'); o.className = 'pr'; o.textContent = '(';
      const c = document.createElement('span'); c.className = 'pr'; c.textContent = ')';
      e.append(f, o, slot(n.a), c);
    }
    return e;
  };
  const root = document.createElement('span'); root.className = 'es root'; root._list = ed.root;
  build(ed.root, root);
  host.appendChild(root);
}

const KEYS = [
  ['7', 'num'], ['8', 'num'], ['9', 'num'], ['frac', 'tpl', '<span class="kfrac"><i></i><b></b><i></i></span>', '分数'], ['pow', 'tpl', '<span class="kx">x<sup><i></i></sup></span>', '指数'], ['sq', 'tpl', '<span class="kx">x<sup>2</sup></span>', '2乗'],
  ['4', 'num'], ['5', 'num'], ['6', 'num'], ['×', 'op'], ['sqrt', 'tpl', '<span class="ksq">√<i></i></span>', 'ルート'], ['log', 'fn', 'log', 'log'],
  ['1', 'num'], ['2', 'num'], ['3', 'num'], ['−', 'op'], ['(', 'op'], [')', 'op'],
  ['0', 'num'], ['.', 'num'], ['π', 'sym'], ['e', 'sym'], ['+', 'op'], ['⌫', 'del', '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="M8 5h12v14H8l-6-7z"/><path d="M11 9.5l5 5M16 9.5l-5 5"/></svg>', '1つ消す'],
  ['left', 'nav', '◀', '左へ'], ['right', 'nav', '▶', '右へ'], ['AC', 'del', 'AC', 'すべて消す'],
];
const keysEl = $('#keys');
KEYS.forEach(([k, cls, label, aria]) => {
  const b = document.createElement('button');
  b.className = 'k ' + cls; b.dataset.k = k; b.type = 'button';
  b.innerHTML = label || k;
  b.setAttribute('aria-label', aria || k);
  keysEl.appendChild(b);
});
keysEl.appendChild($('#judgeBtn'));

let kr = null; // 入力中のリール
function press(k) {
  if (!kr) return;
  const ed = kr.ed;
  if (k === '⌫') edBack(ed);
  else if (k === 'AC') { kr.ed = newEd(); }
  else if (k === 'left') edLeft(ed);
  else if (k === 'right') edRight(ed);
  else edInsert(ed, k);
  $('#display').classList.remove('shake', 'okglow');
  $('#msg').textContent = ''; $('#msg').className = 'msg';
  renderDisplay();
}
// 指が触れた瞬間に反応させる（click 待ちの遅延と二度押しズームを避ける）
keysEl.addEventListener('pointerdown', e => {
  const b = e.target.closest('.k'); if (!b) return;
  e.preventDefault();
  b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 110);
  sfxClick(); vib(6);
  press(b.dataset.k);
});
keysEl.addEventListener('click', e => { const b = e.target.closest('.k'); if (b && e.detail === 0) press(b.dataset.k); });

function renderDisplay() {
  if (!kr) return;
  const host = $('#dispMath');
  edRender(kr.ed, host);
  $('#ph').hidden = !edEmpty(kr.ed);
  $('#approx').textContent = '';
  if (!edEmpty(kr.ed)) {
    try { const v = evalAst(parse(edSer(kr.ed.root)), NaN); if (Number.isFinite(v)) $('#approx').textContent = '≈ ' + (+v.toPrecision(10)).toString(); } catch {}
  }
  // カーソルが見える位置まで横スクロール
  const d = $('#display'), c = host.querySelector('.cur');
  if (c) {
    const dr = d.getBoundingClientRect(), cr = c.getBoundingClientRect();
    if (cr.right > dr.right - 16) d.scrollLeft += cr.right - dr.right + 32;
    else if (cr.left < dr.left + 16) d.scrollLeft -= dr.left - cr.left + 32;
  }
}
// 式をタップしてカーソルを置く
$('#display').addEventListener('pointerdown', e => {
  if (!kr) return;
  let el = e.target;
  while (el && el._list === undefined && el.id !== 'display') el = el.parentElement;
  if (!el || el._list === undefined) { kr.ed.list = kr.ed.root; kr.ed.i = kr.ed.root.length; return renderDisplay(); }
  if (el._j !== undefined && !el.classList.contains('ef') && !el.classList.contains('esq') && !el.classList.contains('ep') && !el.classList.contains('elog')) {
    const r = el.getBoundingClientRect();
    kr.ed.list = el._list; kr.ed.i = el._j + (e.clientX > r.left + r.width / 2 ? 1 : 0);
  } else if (el._j !== undefined) {
    const r = el.getBoundingClientRect();
    kr.ed.list = el._list; kr.ed.i = el._j + (e.clientX > r.left + r.width / 2 ? 1 : 0);
  } else {
    kr.ed.list = el._list; kr.ed.i = el._list.length;
  }
  renderDisplay();
});

function openKeypad(r) {
  kr = r;
  if (!r.ed) r.ed = newEd();
  $('#keyTitle').textContent = `問 #${r.no} の答え`;
  $('#attemptsLbl').textContent = r.attempts ? `挑戦 ${r.attempts} 回目` : '';
  $('#msg').textContent = r.solved ? '正解済み。別の形で入力して試すこともできます' : ''; $('#msg').className = 'msg';
  $('#display').classList.remove('shake', 'okglow');
  showSheet('#keySheet');
  renderDisplay();
}
document.addEventListener('keydown', e => {
  if (openSheet && openSheet.id === 'keySheet') {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const map = { '*': '×', 'x': '×', '/': 'frac', '-': '−', '^': 'pow', 'Backspace': '⌫', 'Delete': 'AC', 'ArrowLeft': 'left', 'ArrowRight': 'right', 'p': 'π', 's': 'sqrt', 'r': 'sqrt', 'l': 'log' };
    if (e.key === 'Enter') { e.preventDefault(); judge(); return; }
    if (e.key === 'Escape') { closeSheet(); return; }
    const k = map[e.key] ?? e.key;
    if (KEYS.some(([x]) => x === k)) { e.preventDefault(); press(k); }
    return;
  }
  if (openSheet) { if (e.key === 'Escape') closeSheet(); return; }
  if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); scrollToReel(cur + 1); }
  if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); scrollToReel(cur - 1); }
  if (e.key === 'Enter' && reels[cur]) { e.preventDefault(); openKeypad(reels[cur]); }
});
function scrollToReel(i) { if (i >= 0 && reels[i]) reels[i].el.scrollIntoView({ behavior: 'smooth' }); }

$('#judgeBtn').addEventListener('pointerdown', e => { e.preventDefault(); judge(); });
$('#judgeBtn').addEventListener('click', e => { if (e.detail === 0) judge(); });
function judge() {
  const r = kr; if (!r) return;
  const d = $('#display'), msg = $('#msg');
  if (edEmpty(r.ed)) { msg.textContent = '式を入力してください'; msg.className = 'msg warn'; return; }
  const src = edSer(r.ed.root);
  let v;
  try { v = evalAst(parse(src), NaN); } catch { v = NaN; }
  if (!Number.isFinite(v)) {
    d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake');
    const open = (src.match(/\(/g) || []).length - (src.match(/\)/g) || []).length;
    msg.textContent = open ? '括弧が閉じていません' : '空いている枠か、書きかけの部分があります'; msg.className = 'msg warn'; vib(30); return;
  }
  const A = r.p.value;
  const rel = Math.abs(v - A) / Math.max(1e-12, Math.abs(A));
  if (rel < 1e-7 || Math.abs(v - A) < 1e-10) {
    if (r.solved) { msg.textContent = 'これも正解の形です'; msg.className = 'msg'; d.classList.add('okglow'); return; }
    return win(r);
  }
  r.attempts++;
  $('#attemptsLbl').textContent = `挑戦 ${r.attempts} 回目`;
  d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake');
  sfxWrong(); vib([40, 40, 40]);
  if (r.p.fid) famStats(r.p.fid).wrong++;
  if (rel < 1e-3) { msg.textContent = '近い！ 小数ではなく厳密値で入力してください'; msg.className = 'msg warn'; }
  else { msg.textContent = '不正解。もう一度考えてみよう'; msg.className = 'msg ng'; }
  if (!r.solved && S.streak) { S.streak = 0; updateHud(); }
  saveAll();
}

function win(r) {
  r.solved = true;
  r.elapsed = curSec(r); r.t0 = 0;
  S.streak++; S.best = Math.max(S.best, S.streak); S.solved++;
  const base = r.p.stars * 100;
  const timeBonus = Math.max(0, Math.round(300 - r.elapsed));
  const mult = (1 + .25 * (S.streak - 1)) * (r.hintUsed ? .7 : 1) * Math.pow(.85, r.attempts);
  const gain = Math.round((base + timeBonus) * mult);
  S.xp += gain;
  if (r.p.fid) { const st = famStats(r.p.fid); st.correct++; if (r.elapsed < 90) st.fast++; }
  saveAll();
  $('#display').classList.add('okglow');
  closeSheet();
  revealTags(r);
  const status = r.el.querySelector('.status');
  status.innerHTML = `<span class="okb">✓ 正解</span><span>${fmtTime(r.elapsed)}</span><span>+${gain} XP</span>`;
  const bar = r.el.querySelector('.answer-bar');
  bar.classList.add('solved');
  const at = bar.querySelector('.ans-tex'); at.innerHTML = ''; at.appendChild(texToNode(r.p.answerTex));
  bar.querySelector('kbd').textContent = '正解';
  r.el.querySelector('.clock').textContent = fmtTime(r.elapsed);
  celebrate({ streak: S.streak, gain, time: r.elapsed });
  setTimeout(updateHud, 900);
}

// ================== 正解演出 ==================
const fxCanvas = $('#fx'), fxLayer = $('#fxLayer');
let fxRaf = 0, fxEnd = null;
function celebrate({ streak, gain, time }) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  sfxWin(streak);
  vib([25, 30, 50, 30, 90]);
  const words = ['正解', '正解', '完璧', '天才', '覚醒', '神域'];
  const word = streak >= 10 ? '神域' : streak >= 7 ? '覚醒' : streak >= 5 ? '天才' : streak >= 3 ? '完璧' : '正解';
  fxLayer.className = 'on';
  fxLayer.innerHTML = `
    ${reduce ? '' : '<div class="rays"></div>'}
    <div class="flash"></div>
    <div class="stamp">
      <div class="big">${word}</div>
      ${streak >= 2 ? `<div class="combo">${streak} COMBO</div>` : ''}
      <div class="xp" id="xpCount">+0 XP</div>
      <div class="sub">${fmtTime(time)} で撃破 · タップで続ける</div>
    </div>`;
  if (!reduce) { app.classList.remove('quake'); void app.offsetWidth; app.classList.add('quake'); }
  // XP カウントアップ
  const xc = $('#xpCount'), t0 = performance.now();
  const countUp = now => { const k = Math.min(1, (now - t0 - 450) / 700); if (k > 0) xc.textContent = '+' + Math.round(gain * (1 - Math.pow(1 - k, 3))) + ' XP'; if (k < 1) requestAnimationFrame(countUp); };
  requestAnimationFrame(countUp);
  if (!reduce) particles(streak);
  const done = () => {
    fxLayer.classList.add('out');
    setTimeout(() => { fxLayer.className = ''; fxLayer.innerHTML = ''; }, 480);
    fxLayer.onclick = null; clearTimeout(fxEnd);
  };
  fxLayer.onclick = done;
  clearTimeout(fxEnd); fxEnd = setTimeout(done, reduce ? 1400 : 2900);
}
function particles(streak) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = app.clientWidth, H = app.clientHeight;
  fxCanvas.width = W * dpr; fxCanvas.height = H * dpr;
  const ctx = fxCanvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cx = W / 2, cy = H * .45;
  const glyphs = ['∫', 'π', 'e', '√', '∑', '∞', 'dx', '∂', '✦', '✦'];
  const cols = ['#ffd66b', '#fff4c2', '#ff9f1c', '#ff5d7a', '#7fe3ff', '#72e6a8', '#ffffff'];
  const P = [];
  const n = 140 + Math.min(streak, 8) * 25;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 5 + Math.random() * 15;
    P.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 4, r: Math.random() * 6.28, vr: (Math.random() - .5) * .4,
      g: glyphs[i % glyphs.length], c: cols[i % cols.length], s: 14 + Math.random() * 22, life: 1, decay: .006 + Math.random() * .008, kind: i % 3 === 0 ? 'rect' : 'glyph' });
  }
  if (streak >= 3) for (let i = 0; i < 90; i++) P.push({ x: Math.random() * W, y: -20 - Math.random() * H * .6, vx: (Math.random() - .5) * 2, vy: 2 + Math.random() * 3, r: Math.random() * 6, vr: (Math.random() - .5) * .3, c: cols[i % cols.length], s: 8 + Math.random() * 8, life: 1, decay: .004, kind: 'rect', rain: true });
  const rings = [{ t: 0 }, { t: -6 }, { t: -14 }];
  let frame = 0;
  cancelAnimationFrame(fxRaf);
  const step = () => {
    frame++;
    ctx.clearRect(0, 0, W, H);
    // 衝撃波
    for (const g of rings) {
      g.t++; if (g.t <= 0) continue;
      const k = g.t / 50; if (k > 1) continue;
      ctx.beginPath(); ctx.arc(cx, cy, 30 + k * Math.max(W, H) * .8, 0, 6.283);
      ctx.strokeStyle = `rgba(255,214,107,${(1 - k) * .8})`; ctx.lineWidth = 10 * (1 - k) + 1; ctx.stroke();
    }
    let alive = 0;
    for (const p of P) {
      if (p.life <= 0) continue; alive++;
      p.vx *= p.rain ? 1 : .975; p.vy = p.vy * (p.rain ? 1 : .975) + (p.rain ? .03 : .32);
      p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= p.decay;
      ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.4)); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      if (p.kind === 'rect') { ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 5, p.s, p.s / 2.5); }
      else { ctx.fillStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = 12; ctx.font = `800 ${p.s}px "Shippori Mincho B1", serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.g, 0, 0); }
      ctx.restore();
    }
    if (alive && frame < 400) fxRaf = requestAnimationFrame(step); else ctx.clearRect(0, 0, W, H);
  };
  fxRaf = requestAnimationFrame(step);
}

// ================== 解答シート ==================
function openSolution(r) {
  if (!r.solved && !r.gave) {
    r.gave = true;
    if (r.p.fid) { famStats(r.p.fid).give++; saveAll(); }
    if (S.streak) { S.streak = 0; updateHud(); }
    r.el.querySelector('.status').innerHTML = '<span class="ngb">解答を表示済み</span>';
  }
  revealTags(r);
  $('#solTitle').textContent = `問 #${r.no} の解答・解説`;
  $('#solSub').textContent = r.p.tags.map(t => '#' + t).join(' ');
  const body = $('#solBody');
  body.innerHTML = `
    <div class="md" style="margin-bottom:12px">${md(r.p.statement)}</div>
    <div class="ansbox"><span class="lbl">答</span><span class="md">$${esc(r.p.answerTex)}$</span></div>
    <div id="solMain"></div>
`;
  const main = $('#solMain');
  if (r.p.steps) {
    main.innerHTML = '<div class="steps">' + r.p.steps.map(([h, b]) => `<div class="step ${h === '発想の源' ? 'idea' : ''}"><h3 class="md">${md(h).replace(/^<p>|<\/p>$/g, '')}</h3><div class="md">${md(b)}</div></div>`).join('') + '</div>';
  } else {
    main.innerHTML = '<p class="note">この問題には詳しい解説がありません。</p>';
  }
  showSheet('#solSheet');
  body.scrollTop = 0;
  typeset(body);
}
// ================== 保存一覧 ==================
$('#savedBtn').onclick = () => {
  const b = $('#savedBody');
  if (!S.saved.length) b.innerHTML = '<p class="empty">まだ保存した問題はありません。<br>リール右側のハートで保存できます。</p>';
  else b.innerHTML = S.saved.map((p, i) => `<div class="saved-item"><div class="meta"><span class="src ${p.deriv ? 'ai' : ''}">${p.deriv ? '微分' : '積分'}</span><span class="stars">${'★'.repeat(p.stars)}</span><span>${p.tags.map(t => '#' + esc(t)).join(' ')}</span></div><div class="md">${md(p.statement)}</div><div class="saved-actions"><button data-redo="${i}">もう一度解く</button><button data-del="${i}">削除</button></div></div>`).join('');
  showSheet('#savedSheet');
  typeset(b);
};
$('#savedBody').addEventListener('click', e => {
  const redo = e.target.closest('[data-redo]'), del = e.target.closest('[data-del]');
  if (redo) {
    const p = JSON.parse(JSON.stringify(S.saved[+redo.dataset.redo]));
    closeSheet();
    const r = appendReel(p, '保存した問題から', cur + 1);
    setTimeout(() => r.el.scrollIntoView({ behavior: 'smooth' }), 60);
  }
  if (del) { S.saved.splice(+del.dataset.del, 1); saveAll(); updateHud(); $('#savedBtn').click(); renderSaveButtons(); }
});
function renderSaveButtons() { reels.forEach(r => { const b = r.el.querySelector('[data-act="save"]'); b.classList.toggle('on', isSaved(r.p)); }); }

// ================== 起動 ==================
updateHud();
ensureAhead();
const hint = document.createElement('div'); hint.className = 'swipe-hint'; hint.textContent = '↑ スワイプで次の問題';
reels[0].el.appendChild(hint);
activate(0);
window.addEventListener('resize', () => reels.forEach(r => fitMath(r.el.querySelector('.statement'))));
})();
})();
