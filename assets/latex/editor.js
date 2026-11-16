/* LaTeXライター — エディタ本体（元：TeXノート）。保存は assets/latex/projects.js 経由でプロジェクトごと */
'use strict';
/* =====================================================================
 *  MathCore : 構造エディタの中核（DOM非依存）
 *  - 木構造モデル（Seq / Node）
 *  - GeoGebra 由来の入力規則（/ は直前の塊を分子へ、^ _ は枠、( は関数名判定 …）
 *  - LaTeX ⇄ 木構造、GeoGebra 線形構文 → 木構造
 * ===================================================================== */
const MathCore = (() => {

  /* ---------------- 記号表 ---------------- */
  // k: L=変数(斜体) N=数字 B=二項演算 R=関係 P=句読点 G=ギリシャ小文字(斜体)
  //    U=直立記号 BIG=大型演算子 F=関数名 O=括弧類 SP=空白命令 A=整列& T=テキスト X=その他
  const SYM = {};
  const SYM_BY_V = {};
  function defSym(k, list) {
    for (const [name, v] of list) {
      SYM[name] = { v, k, tex: '\\' + name };
      if (!(v in SYM_BY_V)) SYM_BY_V[v] = name;
    }
  }
  defSym('G', [['alpha', 'α'], ['beta', 'β'], ['gamma', 'γ'], ['delta', 'δ'], ['varepsilon', 'ε'], ['epsilon', 'ϵ'],
    ['zeta', 'ζ'], ['eta', 'η'], ['theta', 'θ'], ['vartheta', 'ϑ'], ['iota', 'ι'], ['kappa', 'κ'], ['lambda', 'λ'],
    ['mu', 'μ'], ['nu', 'ν'], ['xi', 'ξ'], ['pi', 'π'], ['varpi', 'ϖ'], ['rho', 'ρ'], ['varrho', 'ϱ'], ['sigma', 'σ'],
    ['varsigma', 'ς'], ['tau', 'τ'], ['upsilon', 'υ'], ['phi', 'ϕ'], ['varphi', 'φ'], ['chi', 'χ'], ['psi', 'ψ'], ['omega', 'ω']]);
  defSym('U', [['Gamma', 'Γ'], ['Delta', 'Δ'], ['Theta', 'Θ'], ['Lambda', 'Λ'], ['Xi', 'Ξ'], ['Pi', 'Π'], ['Sigma', 'Σ'],
    ['Upsilon', 'Υ'], ['Phi', 'Φ'], ['Psi', 'Ψ'], ['Omega', 'Ω']]);
  defSym('B', [['pm', '±'], ['mp', '∓'], ['times', '×'], ['div', '÷'], ['cdot', '⋅'], ['ast', '∗'], ['star', '⋆'],
    ['circ', '∘'], ['bullet', '∙'], ['oplus', '⊕'], ['otimes', '⊗'], ['cup', '∪'], ['cap', '∩'], ['setminus', '∖'],
    ['wedge', '∧'], ['land', '∧'], ['vee', '∨'], ['lor', '∨']]);
  defSym('R', [['leq', '≤'], ['le', '≤'], ['geq', '≥'], ['ge', '≥'], ['neq', '≠'], ['ne', '≠'], ['approx', '≈'],
    ['equiv', '≡'], ['sim', '∼'], ['simeq', '≃'], ['cong', '≅'], ['propto', '∝'], ['ll', '≪'], ['gg', '≫'],
    ['in', '∈'], ['notin', '∉'], ['ni', '∋'], ['subset', '⊂'], ['subseteq', '⊆'], ['supset', '⊃'], ['supseteq', '⊇'],
    ['to', '→'], ['rightarrow', '→'], ['leftarrow', '←'], ['gets', '←'], ['Rightarrow', '⇒'], ['Leftarrow', '⇐'],
    ['Leftrightarrow', '⇔'], ['leftrightarrow', '↔'], ['implies', '⟹'], ['impliedby', '⟸'], ['iff', '⟺'],
    ['mapsto', '↦'], ['longrightarrow', '⟶'], ['perp', '⊥'], ['parallel', '∥'], ['mid', '∣'], ['models', '⊨'],
    ['vdash', '⊢'], ['prec', '≺'], ['succ', '≻'], ['coloneqq', '≔'], ['uparrow', '↑'], ['downarrow', '↓']]);
  defSym('U', [['infty', '∞'], ['partial', '∂'], ['nabla', '∇'], ['forall', '∀'], ['exists', '∃'], ['nexists', '∄'],
    ['neg', '¬'], ['lnot', '¬'], ['emptyset', '∅'], ['varnothing', '∅'], ['hbar', 'ℏ'], ['ell', 'ℓ'], ['Re', 'ℜ'],
    ['Im', 'ℑ'], ['aleph', 'ℵ'], ['angle', '∠'], ['triangle', '△'], ['ldots', '…'], ['cdots', '⋯'], ['vdots', '⋮'],
    ['ddots', '⋱'], ['prime', '′'], ['top', '⊤'], ['bot', '⊥'], ['square', '□'], ['therefore', '∴'], ['because', '∵'],
    ['dagger', '†'], ['circledast', '⊛'], ['degree', '°']]);
  defSym('O', [['langle', '⟨'], ['rangle', '⟩'], ['lfloor', '⌊'], ['rfloor', '⌋'], ['lceil', '⌈'], ['rceil', '⌉'],
    ['lvert', '|'], ['rvert', '|'], ['vert', '|'], ['lVert', '‖'], ['rVert', '‖'], ['Vert', '‖']]);
  defSym('BIG', [['sum', '∑'], ['prod', '∏'], ['coprod', '∐'], ['int', '∫'], ['iint', '∬'], ['iiint', '∭'], ['oint', '∮'],
    ['bigcup', '⋃'], ['bigcap', '⋂'], ['bigoplus', '⨁'], ['bigotimes', '⨂']]);
  // 好ましい逆引き
  Object.assign(SYM_BY_V, { '≤': 'leq', '≥': 'geq', '≠': 'neq', '→': 'to', '∅': 'emptyset', '¬': 'neg', '∧': 'wedge', '∨': 'vee', '⊥': 'perp' });
  delete SYM_BY_V['|'];

  const SPACES = { ',': ' ', ';': ' ', ':': ' ', '!': '', ' ': ' ', quad: '  ', qquad: '    ', '>': ' ' };

  // 自動で直立になる関数名（LaTeX 標準）
  const FN_STD = ['arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'coth', 'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
    'ln', 'log', 'lg', 'exp', 'liminf', 'limsup', 'lim', 'max', 'min', 'sup', 'inf', 'det', 'dim', 'gcd', 'arg', 'ker',
    'hom', 'Pr', 'deg'];
  const FN_OP = ['sgn', 'sign', 'tr', 'rank', 'lcm', 'diag', 'erf', 'Var', 'Cov', 'asin', 'acos', 'atan', 'arsinh',
    'arcosh', 'artanh', 'cosec', 'cotan'];
  const FN_ALL = [...FN_STD, ...FN_OP].sort((a, b) => b.length - a.length);
  const FN_SET = new Set(FN_ALL);
  const FN_STD_SET = new Set(FN_STD);
  function fnTex(name) { return FN_STD_SET.has(name) ? '\\' + name : '\\operatorname{' + name + '}'; }

  // 入力中の単語 → 記号（GeoGebra の alpha / pi / inf 置換を拡張）
  const WORDS = {};
  for (const n of ['alpha', 'beta', 'gamma', 'delta', 'zeta', 'eta', 'theta', 'vartheta', 'iota', 'kappa', 'lambda', 'mu',
    'nu', 'xi', 'pi', 'varpi', 'rho', 'varrho', 'sigma', 'varsigma', 'tau', 'upsilon', 'phi', 'varphi', 'chi', 'psi',
    'omega', 'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Upsilon', 'Phi', 'Psi', 'Omega', 'varepsilon',
    'infty', 'partial', 'nabla', 'hbar', 'ell', 'forall', 'exists', 'emptyset', 'varnothing', 'sum', 'prod', 'int', 'iint',
    'oint', 'cdot', 'times', 'approx', 'equiv', 'propto', 'cdots', 'ldots', 'mapsto', 'implies', 'iff', 'neq', 'leq',
    'geq', 'subset', 'subseteq', 'cup', 'cap', 'notin', 'perp', 'parallel', 'angle', 'therefore']) WORDS[n] = n;
  WORDS.epsilon = 'varepsilon';
  WORDS.inf = 'infty';
  WORDS.deg = '#deg';
  const WORDLIST = Object.keys(WORDS).sort((a, b) => b.length - a.length);

  // ( を打ったとき構造に化ける名前
  const ACCENTS = ['vec', 'hat', 'widehat', 'bar', 'overline', 'underline', 'dot', 'ddot', 'tilde', 'widetilde',
    'overrightarrow', 'overleftarrow', 'overbrace', 'underbrace'];
  const STYLES = ['mathbf', 'mathbb', 'mathcal', 'mathfrak', 'mathscr', 'mathsf', 'mathtt', 'mathit', 'mathrm',
    'boldsymbol', 'bm', 'operatorname'];
  const MATRIX_ENVS = ['matrix', 'pmatrix', 'bmatrix', 'Bmatrix', 'vmatrix', 'Vmatrix', 'smallmatrix', 'cases',
    'aligned', 'gathered', 'split', 'array', 'subarray', 'alignedat'];
  const TEXTCMDS = ['text', 'textrm', 'textnormal', 'mbox', 'textbf', 'textit', 'textsf', 'texttt', 'textup'];
  const STRUCT = new Set(['sqrt', 'cbrt', 'nroot', 'root', 'abs', 'norm', 'floor', 'ceil', 'frac', 'dfrac', 'binom',
    'text', ...ACCENTS, ...STYLES, 'matrix', 'pmatrix', 'bmatrix', 'vmatrix', 'Bmatrix', 'cases']);
  const STRUCTLIST = [...STRUCT].sort((a, b) => b.length - a.length);
  const RAWARG = new Set(['label', 'tag', 'ref', 'eqref', 'cite', 'hspace', 'vspace', 'mathring', 'unit', 'si', 'SI']);

  const MERGE = {
    '<=': 'leq', '>=': 'geq', '!=': 'neq', '->': 'to', '<-': 'leftarrow', '=>': 'Rightarrow', '<=>': 'Leftrightarrow',
    '<->': 'leftrightarrow', '==>': 'implies', '+-': 'pm', '-+': 'mp', '==': 'equiv', '~=': 'approx', '<<': 'll',
    '>>': 'gg', '|->': 'mapsto', '...': 'ldots'
  };

  /* ---------------- モデル ---------------- */
  function mkSeq(items) {
    const s = { items: [], parent: null };
    if (items) for (const n of items) { n.parent = s; s.items.push(n); }
    return s;
  }
  function mkNode(t, nf, props) {
    const n = Object.assign({ t, f: [], parent: null }, props || {});
    for (let k = 0; k < nf; k++) { const s = mkSeq(); s.parent = n; n.f.push(s); }
    return n;
  }
  function setField(n, k, s) { s.parent = n; n.f[k] = s; }
  function ins(seq, i, ...nodes) { for (const n of nodes) n.parent = seq; seq.items.splice(i, 0, ...nodes); }
  function del(seq, i, c = 1) { return seq.items.splice(i, c); }
  function idx(n) { return n.parent.items.indexOf(n); }
  function ch(v, tex, k, extra) { return Object.assign({ t: 'ch', v, tex: tex == null ? v : tex, k, parent: null }, extra || {}); }
  function sym(name) {
    if (name === '#deg') return ch('°', '^{\\circ}', 'U');
    const s = SYM[name]; return ch(s.v, s.tex, s.k);
  }
  function mkParen(open, close, lr) { return mkNode('paren', 1, { open, close, lr: !!lr }); }
  const isScript = n => n && (n.t === 'sup' || n.t === 'sub');
  const hasFields = n => n && n.f && n.f.length > 0;

  function cloneSeq(s) { const c = mkSeq(s.items.map(cloneNode)); if (s.gb) c.gb = true; return c; }
  function cloneNode(n) {
    const c = Object.assign({}, n, { parent: null });
    if (n.f) { c.f = n.f.map(x => { const y = cloneSeq(x); y.parent = c; return y; }); }
    return c;
  }

  // 打鍵1文字 → 文字ノード
  function charNode(c) {
    if (/^[a-zA-Z]$/.test(c)) return ch(c, c, 'L');
    if (/^[0-9.]$/.test(c)) return ch(c, c, 'N');
    switch (c) {
      case '+': return ch('+', '+', 'B', { c });
      case '-': return ch('−', '-', 'B', { c });
      case '*': return ch('⋅', '\\cdot', 'B', { c });
      case '=': return ch('=', '=', 'R', { c });
      case '<': return ch('<', '<', 'R', { c });
      case '>': return ch('>', '>', 'R', { c });
      case '~': return ch('∼', '\\sim', 'R', { c });
      case ',': return ch(',', ',', 'P');
      case ';': return ch(';', ';', 'P');
      case ':': return ch(':', ':', 'R');
      case '!': return ch('!', '!', 'X', { c });
      case '?': return ch('?', '?', 'X');
      case "'": return ch('′', "'", 'X');
      case '&': return ch('&', '&', 'A');
      case '%': return ch('%', '\\%', 'X');
      case '#': return ch('#', '\\#', 'X');
      case '$': return ch('$', '\\$', 'X');
      case '@': return ch('@', '@', 'X');
      case '/': return ch('/', '/', 'X');
      case '÷': return sym('div');
      case '°': return sym('#deg');
      case '×': return sym('times');
      case '·': return sym('cdot');
      case '−': return ch('−', '-', 'B', { c: '-' });
    }
    if (c in SYM_BY_V) return sym(SYM_BY_V[c]);
    if (/^[\u0080-￿]/.test(c) && !/^[　-鿿＀-￯]/.test(c)) return ch(c, c, 'X');
    return ch(c, c, 'T'); // 日本語など → \text{}
  }
  const SUPDIG = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };

  /* ---------------- LaTeX 出力 ---------------- */
  const DELIM_TEX = {
    '(': '(', ')': ')', '[': '[', ']': ']', '{': '\\{', '}': '\\}', '|': '|', '‖': '\\|', '⟨': '\\langle', '⟩': '\\rangle',
    '⌊': '\\lfloor', '⌋': '\\rfloor', '⌈': '\\lceil', '⌉': '\\rceil', '.': '.', '': '.'
  };
  function splitFn(run) {
    const out = []; let buf = '';
    for (let p = 0; p < run.length;) {
      let hit = null;
      for (const name of FN_ALL) if (run.startsWith(name, p)) { hit = name; break; }
      if (hit) { if (buf) { out.push({ s: buf }); buf = ''; } out.push({ s: hit, fn: true }); p += hit.length; }
      else { buf += run[p]; p++; }
    }
    if (buf) out.push({ s: buf });
    return out;
  }
  function escText(nodes) {
    return nodes.map(n => {
      if (n.rawtex) return n.rawtex;
      const c = n.v;
      return ({ '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '$': '\\$', '&': '\\&', '%': '\\%', '#': '\\#', '_': '\\_', '^': '\\^{}', '~': '\\~{}' })[c] || c;
    }).join('');
  }
  function isTall(seq) {
    for (let i = 0; i < seq.items.length; i++) {
      const n = seq.items[i];
      if (n.t === 'frac' || n.t === 'mat') return true;
      if (n.t === 'ch' && n.k === 'BIG' && isScript(seq.items[i + 1])) return true;
      if (['sqrt', 'root', 'paren', 'acc', 'style', 'grp'].includes(n.t) && n.f.some(isTall)) return true;
    }
    return false;
  }
  function serArg(seq) {
    const s = serSeq(seq);
    return /^[a-zA-Z0-9]$/.test(s) ? s : '{' + s + '}';
  }
  function serSeq(seq) {
    let out = '';
    const push = s => {
      if (!s) return;
      if ((/\\[a-zA-Z]+$/.test(out) && /^[a-zA-Z0-9]/.test(s)) || (/(^|[^\\])[\^_][a-zA-Z0-9]$/.test(out) && /^[a-zA-Z0-9\\]/.test(s))) out += ' ';
      out += s;
    };
    const it = seq.items;
    for (let i = 0; i < it.length;) {
      const n = it[i];
      if (n.t === 'ch' && n.k === 'L' && !n.src) {
        let j = i; while (j < it.length && it[j].t === 'ch' && it[j].k === 'L' && !it[j].src) j++;
        const run = it.slice(i, j).map(x => x.v).join('');
        for (const tk of splitFn(run)) push(tk.fn ? fnTex(tk.s) : tk.s);
        i = j; continue;
      }
      if (n.t === 'ch' && n.k === 'T') {
        let j = i; while (j < it.length && it[j].t === 'ch' && it[j].k === 'T') j++;
        push('\\text{' + escText(it.slice(i, j)) + '}'); i = j; continue;
      }
      if (n.t === 'sp') { if (out && !/\s$/.test(out)) out += ' '; i++; continue; }
      push(serNode(n)); i++;
    }
    return out.trim();
  }
  function serNode(n) {
    switch (n.t) {
      case 'ch': return n.tex;
      case 'nl': return ' \\\\\n';
      case 'frac': return (n.binom ? '\\binom' : '\\' + (n.cmd || 'frac')) + '{' + serSeq(n.f[0]) + '}{' + serSeq(n.f[1]) + '}';
      case 'sup': return '^' + serArg(n.f[0]);
      case 'sub': return '_' + serArg(n.f[0]);
      case 'sqrt': return '\\sqrt{' + serSeq(n.f[0]) + '}';
      case 'root': return '\\sqrt[' + serSeq(n.f[0]) + ']{' + serSeq(n.f[1]) + '}';
      case 'paren': {
        const inner = serSeq(n.f[0]);
        const o = DELIM_TEX[n.open] ?? n.open, c = DELIM_TEX[n.close] ?? n.close;
        if (n.lr || isTall(n.f[0])) return '\\left' + o + (/[a-z]$/.test(o) ? ' ' : '') + inner + ' \\right' + c;
        const sp = s => /[a-z]$/.test(s) ? s + ' ' : s;
        return sp(o) + inner + c;
      }
      case 'acc': return '\\' + n.cmd + '{' + serSeq(n.f[0]) + '}';
      case 'style': return '\\' + n.cmd + '{' + serSeq(n.f[0]) + '}';
      case 'text': return '\\' + (n.cmd || 'text') + '{' + escText(n.f[0].items) + '}';
      case 'grp': return '{' + serSeq(n.f[0]) + '}';
      case 'mat': {
        const rows = [];
        for (let r = 0; r < n.rows; r++) {
          const cells = [];
          for (let c = 0; c < n.cols; c++) cells.push(serSeq(n.f[r * n.cols + c]));
          rows.push(cells.join(' & '));
        }
        return '\\begin{' + n.env + '}' + (n.spec != null ? '{' + n.spec + '}' : '') + ' ' + rows.join(' \\\\ ') + ' \\end{' + n.env + '}';
      }
      case 'cmd': return '\\' + n.name + n.f.map(s => '{' + serSeq(s) + '}').join('');
      case 'raw': return n.tex;
      case 'esc': return '\\' + n.buf;
    }
    return '';
  }

  /* ---------------- LaTeX 入力（パーサ） ---------------- */
  function tokenize(str) {
    const s = Array.from(str), toks = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === '\\') {
        let j = i + 1;
        if (j < s.length && /[a-zA-Z]/.test(s[j])) {
          while (j < s.length && /[a-zA-Z]/.test(s[j])) j++;
          toks.push({ t: 'cmd', v: s.slice(i + 1, j).join('') });
          while (j < s.length && /[ \t]/.test(s[j])) j++;
          i = j; continue;
        }
        toks.push({ t: 'cmd', v: s[j] || '' }); i = j + 1; continue;
      }
      if (/\s/.test(c)) { let j = i; while (j < s.length && /\s/.test(s[j])) j++; toks.push({ t: 'ws' }); i = j; continue; }
      if (c === '%') { while (i < s.length && s[i] !== '\n') i++; continue; }
      toks.push({ t: 'c', v: c }); i++;
    }
    return toks;
  }
  function toksToStr(toks) {
    let o = '';
    for (const t of toks) {
      if (t.t === 'ws') o += ' ';
      else if (t.t === 'c') o += t.v;
      else o += '\\' + t.v + (/^[a-zA-Z]+$/.test(t.v) ? ' ' : '');
    }
    return o.replace(/\\([a-zA-Z]+) ([^a-zA-Z])/g, '\\$1$2');
  }
  function texChar(c) {
    if (/^[a-zA-Z]$/.test(c)) return ch(c, c, 'L');
    if (/^[0-9.]$/.test(c)) return ch(c, c, 'N');
    if ('()[]|'.includes(c)) return ch(c, c, 'O');
    if (c === '*') return ch('∗', '*', 'B');
    const n = charNode(c);
    if (n.k === 'T') { n.k = 'X'; } // 数式中の生 Unicode はそのまま
    delete n.c;
    return n;
  }

  class Parser {
    constructor(str) { this.toks = tokenize(str); this.p = 0; }
    peek() { return this.toks[this.p]; }
    skipWs() { while (this.peek() && this.peek().t === 'ws') this.p++; }
    isC(t, v) { return t && t.t === 'c' && t.v === v; }
    isCmd(t, v) { return t && t.t === 'cmd' && t.v === v; }
    rawGroup() { // { ... } を生文字列で
      this.skipWs();
      if (!this.isC(this.peek(), '{')) return '';
      this.p++;
      let depth = 1; const start = this.p;
      while (this.p < this.toks.length) {
        const t = this.toks[this.p];
        if (this.isC(t, '{')) depth++;
        else if (this.isC(t, '}')) { depth--; if (depth === 0) break; }
        this.p++;
      }
      const s = toksToStr(this.toks.slice(start, this.p));
      this.p++;
      return s;
    }
    parseSeq(stop) {
      const seq = mkSeq();
      while (this.p < this.toks.length) {
        const tk = this.peek();
        if (stop && stop(tk)) break;
        if (tk.t === 'ws') {
          this.p++;
          const prev = seq.items[seq.items.length - 1], nx = this.peek();
          if (prev && prev.t === 'ch' && (prev.k === 'L' || prev.k === 'N') && nx && nx.t === 'c' && /[a-zA-Z0-9]/.test(nx.v)) ins(seq, seq.items.length, { t: 'sp' });
          continue;
        }
        if (tk.t === 'c') {
          if (tk.v === '{') {
            this.p++;
            const g = this.parseSeq(t => this.isC(t, '}'));
            this.p++;
            const nx = this.peek();
            if (nx && nx.t === 'c' && (nx.v === '^' || nx.v === '_') && g.items.length > 1) {
              const n = mkNode('grp', 0); setField(n, 0, g); ins(seq, seq.items.length, n);
            } else ins(seq, seq.items.length, ...g.items.slice());
            continue;
          }
          if (tk.v === '}') { this.p++; continue; }
          if (tk.v === '^' || tk.v === '_') {
            this.p++;
            const a = this.parseArg();
            const n = mkNode(tk.v === '^' ? 'sup' : 'sub', 0); setField(n, 0, a);
            ins(seq, seq.items.length, n); continue;
          }
          if (tk.v === '&') { ins(seq, seq.items.length, ch('&', '&', 'A')); this.p++; continue; }
          if (tk.v === '~') { ins(seq, seq.items.length, ch(' ', '~', 'SP')); this.p++; continue; }
          ins(seq, seq.items.length, texChar(tk.v)); this.p++; continue;
        }
        this.parseCmd(seq);
      }
      pairParens(seq);
      return seq;
    }
    parseArg() {
      this.skipWs();
      const tk = this.peek();
      if (!tk) return mkSeq();
      if (this.isC(tk, '{')) {
        this.p++;
        const s = this.parseSeq(t => this.isC(t, '}'));
        this.p++;
        return s;
      }
      if (tk.t === 'c') { this.p++; return mkSeq([texChar(tk.v)]); }
      const s = mkSeq(); this.parseCmd(s); return s;
    }
    readDelim() {
      this.skipWs();
      const t = this.peek(); if (!t) return '.';
      this.p++;
      if (t.t === 'c') return t.v === '<' ? '⟨' : t.v === '>' ? '⟩' : t.v;
      const m = { '{': '{', '}': '}', '|': '‖', langle: '⟨', rangle: '⟩', lvert: '|', rvert: '|', vert: '|', lVert: '‖', rVert: '‖', Vert: '‖', lfloor: '⌊', rfloor: '⌋', lceil: '⌈', rceil: '⌉' };
      return m[t.v] || '.';
    }
    parseCmd(seq) {
      const name = this.peek().v; this.p++;
      const push = n => ins(seq, seq.items.length, n);
      if (name === 'frac' || name === 'dfrac' || name === 'tfrac' || name === 'cfrac') {
        const n = mkNode('frac', 0, name === 'frac' ? {} : { cmd: name });
        setField(n, 0, this.parseArg()); setField(n, 1, this.parseArg()); push(n); return;
      }
      if (name === 'binom' || name === 'dbinom' || name === 'tbinom') {
        const n = mkNode('frac', 0, { binom: true }); setField(n, 0, this.parseArg()); setField(n, 1, this.parseArg()); push(n); return;
      }
      if (name === 'sqrt') {
        this.skipWs();
        if (this.isC(this.peek(), '[')) {
          this.p++;
          const idxs = this.parseSeq(t => this.isC(t, ']')); this.p++;
          const n = mkNode('root', 0); setField(n, 0, idxs); setField(n, 1, this.parseArg()); push(n); return;
        }
        const n = mkNode('sqrt', 0); setField(n, 0, this.parseArg()); push(n); return;
      }
      if (name === 'left') {
        const o = this.readDelim();
        const inner = this.parseSeq(t => this.isCmd(t, 'right'));
        let c = '.';
        if (this.isCmd(this.peek(), 'right')) { this.p++; c = this.readDelim(); }
        const n = mkNode('paren', 0, { open: o, close: c, lr: true }); setField(n, 0, inner); push(n); return;
      }
      if (/^(big|Big|bigg|Bigg)[lrm]?$/.test(name)) return;
      if (TEXTCMDS.includes(name)) {
        this.skipWs();
        const n = mkNode('text', 1, name === 'text' ? {} : { cmd: name });
        if (this.isC(this.peek(), '{')) {
          this.p++;
          let depth = 1;
          while (this.p < this.toks.length) {
            const t = this.toks[this.p];
            if (this.isC(t, '{')) depth++;
            if (this.isC(t, '}')) { depth--; if (depth === 0) break; }
            if (t.t === 'ws') ins(n.f[0], n.f[0].items.length, ch(' ', ' ', 'T'));
            else if (t.t === 'c') { for (const c of Array.from(t.v)) ins(n.f[0], n.f[0].items.length, ch(c, c, 'T')); }
            else if ('%&#$_{}'.includes(t.v) && t.v.length === 1) ins(n.f[0], n.f[0].items.length, ch(t.v, t.v, 'T'));
            else ins(n.f[0], n.f[0].items.length, ch('\\' + t.v, null, 'T', { rawtex: '\\' + t.v + (/^[a-zA-Z]+$/.test(t.v) ? ' ' : '') }));
            this.p++;
          }
          this.p++;
        }
        push(n); return;
      }
      if (STYLES.includes(name)) { const n = mkNode('style', 0, { cmd: name }); setField(n, 0, this.parseArg()); push(n); return; }
      if (ACCENTS.includes(name)) { const n = mkNode('acc', 0, { cmd: name }); setField(n, 0, this.parseArg()); push(n); return; }
      if (name === 'begin') {
        const env = this.rawGroup().trim();
        if (MATRIX_ENVS.includes(env)) {
          let spec = null;
          if (env === 'array' || env === 'subarray' || env === 'alignedat') spec = this.rawGroup();
          const rows = [[]];
          for (; ;) {
            const cell = this.parseSeq(t => this.isC(t, '&') || this.isCmd(t, '\\') || this.isCmd(t, 'end'));
            rows[rows.length - 1].push(cell);
            const t = this.peek();
            if (!t) break;
            this.p++;
            if (this.isC(t, '&')) continue;
            if (this.isCmd(t, '\\')) { this.skipWs(); if (this.isC(this.peek(), '[')) { while (this.peek() && !this.isC(this.peek(), ']')) this.p++; this.p++; } rows.push([]); continue; }
            this.rawGroup(); break;
          }
          const last = rows[rows.length - 1];
          if (rows.length > 1 && last.length === 1 && last[0].items.length === 0) rows.pop();
          const cols = Math.max(...rows.map(r => r.length));
          const n = mkNode('mat', 0, { env, rows: rows.length, cols, spec });
          for (const r of rows) for (let c = 0; c < cols; c++) { const s = r[c] || mkSeq(); s.parent = n; n.f.push(s); }
          push(n); return;
        }
        // 未知の環境 → 生のまま保持
        const start = this.p; let depth = 1;
        while (this.p < this.toks.length) {
          const t = this.toks[this.p];
          if (this.isCmd(t, 'begin')) depth++;
          if (this.isCmd(t, 'end')) { depth--; if (depth === 0) break; }
          this.p++;
        }
        const body = toksToStr(this.toks.slice(start, this.p));
        this.p++; this.rawGroup();
        push({ t: 'raw', tex: '\\begin{' + env + '}' + body + '\\end{' + env + '}' }); return;
      }
      if (name === 'end') { this.rawGroup(); return; }
      if (name === '\\') { push({ t: 'nl' }); return; }
      if (name === '{' || name === '}') { push(ch(name, '\\' + name, 'O')); return; }
      if (name === '|') { push(ch('‖', '\\|', 'O')); return; }
      if (name in SPACES) { push(ch(SPACES[name], '\\' + name + (/^[a-z]+$/.test(name) ? ' ' : ''), 'SP')); return; }
      if ('%&#$_'.includes(name) && name.length === 1) { push(ch(name, '\\' + name, 'X')); return; }
      if (name in SYM) { push(sym(name)); return; }
      if (FN_SET.has(name)) { push(ch(name, '\\' + name, 'F')); return; }
      if (RAWARG.has(name)) { const a = this.rawGroup(); push({ t: 'raw', tex: '\\' + name + '{' + a + '}' }); return; }
      // 未知の命令: 続く {…} を引数として保持
      const save = this.p; this.skipWs();
      if (this.isC(this.peek(), '{')) {
        const n = mkNode('cmd', 0, { name });
        while (this.isC(this.peek(), '{')) {
          this.p++;
          const s = this.parseSeq(t => this.isC(t, '}')); this.p++;
          s.parent = n; n.f.push(s);
          const sv = this.p; this.skipWs(); if (!this.isC(this.peek(), '{')) { this.p = sv; break; }
        }
        push(n); return;
      }
      this.p = save;
      push({ t: 'raw', tex: '\\' + name });
    }
  }
  function pairParens(seq) {
    const out = [[]], opens = [];
    const isO = n => n.t === 'ch' && n.k === 'O';
    for (const n of seq.items) {
      if (isO(n) && '([{'.includes(n.v) && n.v.length === 1) { opens.push(n); out.push([]); continue; }
      if (isO(n) && ')]}'.includes(n.v) && n.v.length === 1 && opens.length) {
        const o = opens.pop(), inner = out.pop();
        const p = mkParen(o.v, n.v); ins(p.f[0], 0, ...inner);
        out[out.length - 1].push(p); continue;
      }
      out[out.length - 1].push(n);
    }
    while (opens.length) { const o = opens.pop(), inner = out.pop(); out[out.length - 1].push(o, ...inner); }
    seq.items = []; ins(seq, 0, ...out[0]);
  }
  function parseLatex(str) {
    try { return new Parser(str).parseSeq(null); }
    catch (e) { return mkSeq([{ t: 'raw', tex: str }]); }
  }

  /* ---------------- GeoGebra 線形構文（貼り付け用） ---------------- */
  function lexLinear(str) {
    const toks = []; const s = Array.from(str); let i = 0;
    const ops3 = ['<=>', '<->', '==>', '|->', '...'];
    const ops2 = ['<=', '>=', '!=', '->', '<-', '=>', '==', '&&', '||', '+-', '-+', '~=', '<<', '>>'];
    while (i < s.length) {
      const c = s[i];
      const rest3 = s.slice(i, i + 3).join(''), rest2 = s.slice(i, i + 2).join('');
      if (/\s/.test(c)) { while (i < s.length && /\s/.test(s[i])) i++; toks.push({ k: 'sp' }); continue; }
      if (/[a-zA-Z]/.test(c)) { let j = i; while (j < s.length && /[a-zA-Z]/.test(s[j])) j++; toks.push({ k: 'id', v: s.slice(i, j).join('') }); i = j; continue; }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1] || ''))) { let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++; toks.push({ k: 'num', v: s.slice(i, j).join('') }); i = j; continue; }
      if (ops3.includes(rest3)) { toks.push({ k: 'op', v: rest3 }); i += 3; continue; }
      if (ops2.includes(rest2)) { toks.push({ k: 'op', v: rest2 }); i += 2; continue; }
      if ('([{'.includes(c)) { toks.push({ k: 'open', v: c }); i++; continue; }
      if (')]}'.includes(c)) { toks.push({ k: 'close', v: c }); i++; continue; }
      if ('^_/'.includes(c)) { toks.push({ k: 'mark', v: c }); i++; continue; }
      if (c === '"') { let j = i + 1; while (j < s.length && s[j] !== '"') j++; toks.push({ k: 'str', v: s.slice(i + 1, j).join('') }); i = j + 1; continue; }
      if (c in SUPDIG) { toks.push({ k: 'mark', v: '^' }, { k: 'num', v: SUPDIG[c] }); i++; continue; }
      toks.push({ k: 'op', v: c }); i++;
    }
    return toks;
  }
  function parseLinear(str) {
    const toks = lexLinear(str); let p = 0;
    function list(depth) {
      const items = [];
      while (p < toks.length) {
        const t = toks[p];
        if (t.k === 'close') { if (depth > 0) break; p++; items.push({ k: 'op', v: t.v }); continue; }
        if (t.k === 'open') {
          p++;
          const inner = list(depth + 1);
          let close = { '(': ')', '[': ']', '{': '}' }[t.v];
          if (p < toks.length && toks[p].k === 'close') { close = toks[p].v; p++; }
          items.push({ k: 'paren', open: t.v, close, inner }); continue;
        }
        items.push(t); p++;
      }
      return items;
    }
    return mkSeq(buildLinear(list(0)));
  }
  function splitComma(items) {
    const parts = [[]];
    for (const it of items) { if (it.k === 'op' && it.v === ',') parts.push([]); else parts[parts.length - 1].push(it); }
    return parts;
  }
  function buildLinear(items) {
    // 1) 関数呼出し型の構造
    const e = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i], nx = items[i + 1];
      if (it.k === 'id' && nx && nx.k === 'paren' && nx.open === '(' && ['sqrt', 'cbrt', 'nroot', 'abs', 'frac', 'binom', 'vec', 'hat', 'bar', 'floor', 'ceil'].includes(it.v)) {
        const parts = splitComma(nx.inner).map(buildLinear);
        let n;
        switch (it.v) {
          case 'sqrt': n = mkNode('sqrt', 1); ins(n.f[0], 0, ...parts.flat()); break;
          case 'cbrt': n = mkNode('root', 1); setField(n, 0, mkSeq([ch('3', '3', 'N')])); setField(n, 1, mkSeq(parts.flat())); break;
          case 'nroot': n = mkNode('root', 0); setField(n, 0, mkSeq(parts[1] || [])); setField(n, 1, mkSeq(parts[0] || [])); break;
          case 'abs': n = mkParen('|', '|'); ins(n.f[0], 0, ...parts.flat()); break;
          case 'floor': n = mkParen('⌊', '⌋'); ins(n.f[0], 0, ...parts.flat()); break;
          case 'ceil': n = mkParen('⌈', '⌉'); ins(n.f[0], 0, ...parts.flat()); break;
          case 'frac': case 'binom': n = mkNode('frac', 0, it.v === 'binom' ? { binom: true } : {}); setField(n, 0, mkSeq(parts[0] || [])); setField(n, 1, mkSeq(parts[1] || [])); break;
          default: n = mkNode('acc', 1, { cmd: it.v }); ins(n.f[0], 0, ...parts.flat());
        }
        e.push({ node: n }); i++; continue;
      }
      if (it.k === 'paren') { const n = mkParen(it.open, it.close); ins(n.f[0], 0, ...buildLinear(it.inner)); e.push({ node: n }); continue; }
      if (it.k === 'id') {
        if (WORDS[it.v]) { e.push({ node: sym(WORDS[it.v]) }); continue; }
        for (const c of it.v) e.push({ node: ch(c, c, 'L') });
        continue;
      }
      if (it.k === 'num') { for (const c of it.v) e.push({ node: ch(c, c, 'N') }); continue; }
      if (it.k === 'op') {
        if (MERGE[it.v]) e.push({ node: sym(MERGE[it.v]) });
        else if (it.v === '&&') e.push({ node: sym('wedge') });
        else if (it.v === '||') e.push({ node: sym('vee') });
        else if (it.v === '|') e.push({ node: ch('|', '|', 'O') });
        else e.push({ node: charNode(it.v) });
        continue;
      }
      if (it.k === 'str') { const n = mkNode('text', 1); ins(n.f[0], 0, ...Array.from(it.v).map(c => ch(c, c, 'T'))); e.push({ node: n }); continue; }
      e.push({ mark: it.k === 'sp' ? ' ' : it.v });
    }
    // 2) ^ _ ：直後の1単位
    const e2 = [];
    for (let i = 0; i < e.length; i++) {
      const x = e[i];
      if (x.mark === '^' || x.mark === '_') {
        const arg = [];
        let j = i + 1;
        if (e[j] && e[j].node && e[j].node.t === 'ch' && e[j].node.v === '−') { arg.push(e[j].node); j++; }
        const y = e[j];
        if (y && y.node) {
          if (y.node.t === 'paren' && y.node.open === '(' && !arg.length) { arg.push(...y.node.f[0].items.slice()); j++; }
          else if (y.node.t === 'ch' && y.node.k === 'N') { while (e[j] && e[j].node && e[j].node.t === 'ch' && e[j].node.k === 'N') { arg.push(e[j].node); j++; } }
          else { arg.push(y.node); j++; }
        }
        const n = mkNode(x.mark === '^' ? 'sup' : 'sub', 1); ins(n.f[0], 0, ...arg);
        e2.push({ node: n }); i = j - 1; continue;
      }
      e2.push(x);
    }
    // 3) / ：左右の「塊」（空白・演算子で区切られる）
    const isUnit = x => x && x.node && !(x.node.t === 'ch' && ['B', 'R', 'P', 'A'].includes(x.node.k));
    const res = [];
    for (let i = 0; i < e2.length; i++) {
      const x = e2[i];
      if (x.mark === '/') {
        let j = res.length; while (j > 0 && isUnit(res[j - 1])) j--;
        let num = res.splice(j).map(y => y.node);
        let k = i + 1; const den0 = [];
        while (k < e2.length && isUnit(e2[k])) { den0.push(e2[k].node); k++; }
        let den = den0;
        const strip = a => (a.length === 1 && a[0].t === 'paren' && a[0].open === '(') ? a[0].f[0].items.slice() : a;
        num = strip(num); den = strip(den);
        const n = mkNode('frac', 2); ins(n.f[0], 0, ...num); ins(n.f[1], 0, ...den);
        res.push({ node: n }); i = k - 1; continue;
      }
      res.push(x);
    }
    // 4) 空白
    const out = [];
    for (let i = 0; i < res.length; i++) {
      const x = res[i];
      if (x.mark) {
        if (x.mark === ' ') {
          const a = out[out.length - 1], b = res[i + 1];
          const wordy = n => n && n.t === 'ch' && (n.k === 'L' || n.k === 'N');
          if (wordy(a) && b && b.node && wordy(b.node)) out.push({ t: 'sp' });
        }
        continue;
      }
      out.push(x.node);
    }
    return out;
  }

  /* ---------------- エディタ（状態と操作） ---------------- */
  class Editor {
    constructor(opts) {
      this.opts = Object.assign({ autoWords: true, autoOps: true }, opts || {});
      this.root = mkSeq();
      this.cur = { seq: this.root, i: 0 };
      this.sel = null;
      this.lastAuto = null;
      this.hist = []; this.future = [];
      this.onChange = null;
    }
    /* ---- 状態 ---- */
    pathOf(cur) {
      const path = []; let s = cur.seq;
      while (s.parent) { const n = s.parent; path.unshift([idx(n), n.f.indexOf(s)]); s = n.parent; }
      return { path, i: cur.i };
    }
    resolve(root, pp) {
      let s = root;
      for (const [a, b] of pp.path) { const n = s.items[a]; if (!n || !n.f || !n.f[b]) return { seq: root, i: root.items.length }; s = n.f[b]; }
      return { seq: s, i: Math.min(pp.i, s.items.length) };
    }
    snapshot() { return { tree: cloneSeq(this.root), pp: this.pathOf(this.cur) }; }
    save() {
      this.hist.push(this.snapshot());
      if (this.hist.length > 300) this.hist.shift();
      this.future = [];
    }
    restore(st) { this.root = st.tree; this.cur = this.resolve(this.root, st.pp); this.sel = null; this.lastAuto = null; }
    undo() { if (!this.hist.length) return false; this.future.push(this.snapshot()); this.restore(this.hist.pop()); return true; }
    redo() { if (!this.future.length) return false; this.hist.push(this.snapshot()); this.restore(this.future.pop()); return true; }
    setLatex(s) { this.root = parseLatex(s || ''); this.cur = { seq: this.root, i: this.root.items.length }; this.sel = null; this.lastAuto = null; }
    getLatex() { return serSeq(this.root); }
    isEmpty() { return this.root.items.length === 0; }

    /* ---- 選択 ---- */
    selRange() { if (!this.sel) return null; const a = Math.min(this.sel.anchor, this.sel.focus), b = Math.max(this.sel.anchor, this.sel.focus); return a === b ? null : { seq: this.sel.seq, a, b }; }
    takeSel() {
      const r = this.selRange(); this.sel = null;
      if (!r) return null;
      const nodes = del(r.seq, r.a, r.b - r.a);
      this.cur = { seq: r.seq, i: r.a };
      return nodes;
    }
    deleteSel() { return !!this.takeSel(); }
    selectAll() { this.commitEsc(); this.sel = { seq: this.root, anchor: 0, focus: this.root.items.length }; this.cur = { seq: this.root, i: this.root.items.length }; }
    extendSel(dir) {
      this.commitEsc();
      if (!this.sel) this.sel = { seq: this.cur.seq, anchor: this.cur.i, focus: this.cur.i };
      const s = this.sel.seq; let f = this.sel.focus + dir;
      if (f < 0 || f > s.items.length) {
        if (!s.parent) f = Math.max(0, Math.min(s.items.length, f));
        else {
          const node = s.parent, ps = node.parent, p = idx(node);
          this.sel = { seq: ps, anchor: dir > 0 ? p : p + 1, focus: dir > 0 ? p + 1 : p };
          this.cur = { seq: ps, i: this.sel.focus }; return;
        }
      }
      this.sel.focus = f; this.cur = { seq: s, i: f };
      if (this.sel.focus === this.sel.anchor) this.sel = null;
    }
    selectionLatex() { const r = this.selRange(); if (!r) return ''; return serSeq(mkSeq(r.seq.items.slice(r.a, r.b).map(cloneNode))); }

    /* ---- カーソル移動 ---- */
    firstField(n) { return 0; }
    exitAfter(node) { this.cur = { seq: node.parent, i: idx(node) + 1 }; }
    exitBefore(node) { this.cur = { seq: node.parent, i: idx(node) }; }
    right() {
      this.commitEsc();
      const r = this.selRange(); if (r) { this.sel = null; this.cur = { seq: r.seq, i: r.b }; return; }
      this.sel = null;
      const { seq, i } = this.cur;
      if (i < seq.items.length) {
        const n = seq.items[i];
        if (hasFields(n)) { this.cur = { seq: n.f[0], i: 0 }; } else this.cur.i++;
        return;
      }
      if (seq.parent) {
        const node = seq.parent, k = node.f.indexOf(seq);
        if (k < node.f.length - 1) this.cur = { seq: node.f[k + 1], i: 0 };
        else this.exitAfter(node);
      }
    }
    left() {
      this.commitEsc();
      const r = this.selRange(); if (r) { this.sel = null; this.cur = { seq: r.seq, i: r.a }; return; }
      this.sel = null;
      const { seq, i } = this.cur;
      if (i > 0) {
        const n = seq.items[i - 1];
        if (hasFields(n)) { const s = n.f[n.f.length - 1]; this.cur = { seq: s, i: s.items.length }; } else this.cur.i--;
        return;
      }
      if (seq.parent) {
        const node = seq.parent, k = node.f.indexOf(seq);
        if (k > 0) { const s = node.f[k - 1]; this.cur = { seq: s, i: s.items.length }; }
        else this.exitBefore(node);
      }
    }
    home() { this.commitEsc(); this.sel = null; this.cur = { seq: this.root, i: 0 }; }
    end() { this.commitEsc(); this.sel = null; this.cur = { seq: this.root, i: this.root.items.length }; }
    vert(dir) {
      this.commitEsc(); this.sel = null;
      let s = this.cur.seq;
      while (s.parent) {
        const node = s.parent, k = node.f.indexOf(s);
        let tk = null;
        if ((node.t === 'frac' || node.t === 'root') && ((dir < 0 && k === 1) || (dir > 0 && k === 0))) tk = 1 - k;
        if (node.t === 'mat') { const r = Math.floor(k / node.cols), c = k % node.cols, nr = r + dir; if (nr >= 0 && nr < node.rows) tk = nr * node.cols + c; }
        if (tk != null) { const t = node.f[tk]; this.cur = { seq: t, i: t.items.length }; return true; }
        if ((node.t === 'sup' && dir > 0) || (node.t === 'sub' && dir < 0)) { this.exitAfter(node); return true; }
        s = node.parent;
      }
      const { seq, i } = this.cur, it = seq.items, want = dir < 0 ? 'sup' : 'sub';
      for (const n of [it[i - 1], it[i], it[i - 2], it[i + 1]]) if (n && n.t === want && Math.abs(idx(n) - i) <= 2) { this.cur = { seq: n.f[0], i: n.f[0].items.length }; return true; }
      return false;
    }
    tab(back) {
      this.commitEsc(); this.sel = null;
      const s = this.cur.seq; if (!s.parent) return false;
      const node = s.parent, k = node.f.indexOf(s);
      if (!back) { if (k < node.f.length - 1) this.cur = { seq: node.f[k + 1], i: 0 }; else this.exitAfter(node); }
      else { if (k > 0) { const p = node.f[k - 1]; this.cur = { seq: p, i: p.items.length }; } else this.exitBefore(node); }
      return true;
    }
    setCursor(seq, i) { this.commitEsc(); this.sel = null; this.cur = { seq, i }; }

    /* ---- 文字入力（GeoGebra 規則の中心） ---- */
    type(str) {
      for (const c of Array.from(str)) this.handleChar(c);
      this.changed();
    }
    changed() { if (this.onChange) this.onChange(); }
    handleChar(c) {
      this.save();
      const esc = this.escBefore();
      if (esc) {
        if (/[a-zA-Z]/.test(c)) { esc.buf += c; return; }
        if (esc.buf === '') { // \{ \, \\ などの1文字命令
          const i = idx(esc); del(esc.parent, i); this.cur = { seq: esc.parent, i };
          this.insertSingleCmd(c); return;
        }
        const res = this.commitEsc(c);
        if (c === ' ') return;
        if (c === '{' && res === 'entered') { this.cur.seq.gb = true; return; }
      }
      const inText = this.cur.seq.parent && this.cur.seq.parent.t === 'text';
      if (inText) {
        if (c === '"') { this.exitAfter(this.cur.seq.parent); return; }
        this.deleteSel();
        ins(this.cur.seq, this.cur.i, ch(c, c, 'T')); this.cur.i++; return;
      }
      this.scriptExit(c);
      if (this.cur.seq.parent && this.cur.seq.parent.t === 'mat' && (c === '&' || c === '\n')) { this.matStep(c === '&' ? 'col' : 'row'); return; }
      if (c === '⁻') { this.script('sup'); this.insertNode(charNode('-')); return; }
      this.scriptExit(c);
      if (this.cur.seq.parent && this.cur.seq.parent.t === 'mat' && (c === '&' || c === '\n')) { this.matStep(c === '&' ? 'col' : 'row'); return; }
      if (c === '⁻') { this.script('sup'); this.insertNode(charNode('-')); return; }
      if (c in SUPDIG) { this.script('sup'); this.insertNode(ch(SUPDIG[c], SUPDIG[c], 'N')); this.exitAfter(this.cur.seq.parent); return; }
      switch (c) {
        case '/': case '÷': if (c === '/') { this.slash(); return; } break;
        case '^': this.script('sup'); return;
        case '_': this.script('sub'); return;
        case '(': case '[': case '{': this.open(c); return;
        case ')': case ']': case '}': case '|': this.close(c); return;
        case '\\': this.deleteSel(); this.insertNode({ t: 'esc', buf: '' }); return;
        case '"': this.insertStructure('text'); return;
        case ' ': this.space(); return;
        case '√': this.insertStructure('sqrt'); return;
        case '\n': this.deleteSel(); this.toRoot(); this.insertNode({ t: 'nl' }); return;
      }
      this.deleteSel();
      if (c === '&' && !this.matInfo()) this.toRoot();
      const n = charNode(c);
      if (c.length === 1 && /[a-zA-Z]/.test(c)) n.typed = true;
      this.insertNode(n);
      if (n.k === 'L' && this.opts.autoWords) this.autoWord();
      else if (this.opts.autoOps) this.autoMerge(n);
    }
    // GeoGebra の simple scripts：添字は + - ( ) = * , で、指数は = で自動的に抜ける
    scriptExit(c) {
      const s = this.cur.seq, node = s.parent;
      if (!node || !isScript(node) || s.gb || this.selRange() || !s.items.length || this.cur.i !== s.items.length) return;
      const base = node.parent.items[idx(node) - 1];
      if (base && base.t === 'ch' && (base.k === 'BIG' || base.k === 'F')) return;
      if (base && isScript(base)) { const b2 = node.parent.items[idx(node) - 2]; if (b2 && b2.t === 'ch' && (b2.k === 'BIG' || b2.k === 'F')) return; }
      const exits = node.t === 'sub' ? '+-()=*,<>' : '=';
      if (exits.includes(c)) this.exitAfter(node);
    }
    // 改行・& はいちばん外側で（指数の中などから抜ける）
    toRoot() {
      if (this.cur.seq === this.root) return;
      let n = this.cur.seq.parent;
      while (n.parent !== this.root) n = n.parent.parent;
      this.cur = { seq: this.root, i: idx(n) + 1 };
    }
    insertNode(n) { ins(this.cur.seq, this.cur.i, n); this.cur.i++; }
    insertSingleCmd(c) {
      if (c === '{' || c === '}') { const p = mkParen('{', '}'); ins(this.cur.seq, this.cur.i, p); this.cur = { seq: p.f[0], i: 0 }; return; }
      if (c === '\\') { this.insertNode({ t: 'nl' }); return; }
      if (c === '|') { this.insertNode(ch('‖', '\\|', 'O')); return; }
      if (c in SPACES) { this.insertNode(ch(SPACES[c], '\\' + c, 'SP')); return; }
      if ('%&#$_^~'.includes(c)) { this.insertNode(ch(c, '\\' + c + (c === '^' || c === '~' ? '{}' : ''), 'X')); return; }
      this.insertNode(charNode(c));
    }
    escBefore() {
      const { seq, i } = this.cur; const n = seq.items[i - 1];
      return n && n.t === 'esc' ? n : null;
    }
    // \命令 の確定。戻り値: 'entered' = 構造の枠に入った
    commitEsc(term) {
      let esc = this.escBefore();
      if (!esc) {
        // カーソルが離れた esc ノードも確定させる
        const found = []; const walk = s => { for (const n of s.items) { if (n.t === 'esc') found.push(n); if (n.f) n.f.forEach(walk); } };
        walk(this.root);
        if (!found.length) return null;
        const keep = this.pathOf(this.cur);
        for (const e of found) {
          const s = e.parent, i = idx(e); del(s, i);
          const node = this.resolveCmd(e.buf); if (node) ins(s, i, node);
        }
        this.cur = this.resolve(this.root, keep);
        return null;
      }
      const s = esc.parent, i = idx(esc);
      del(s, i); this.cur = { seq: s, i };
      const name = esc.buf;
      if (STRUCT.has(name) || name === 'dfrac') { this.insertStructure(name === 'dfrac' ? 'frac' : name); return 'entered'; }
      if (name === 'left' || name === 'right') return null;
      if (!(name in SYM) && !FN_SET.has(name) && !(name in SPACES) && term === '{') {
        const n = mkNode('cmd', 1, { name }); ins(s, i, n); this.cur = { seq: n.f[0], i: 0 }; return 'entered';
      }
      const node = this.resolveCmd(name);
      if (node) this.insertNode(node);
      return null;
    }
    resolveCmd(name) {
      if (!name) return null;
      if (name in SYM) return sym(name);
      if (FN_SET.has(name)) return ch(name, '\\' + name, 'F');
      if (name in SPACES) return ch(SPACES[name], '\\' + name + ' ', 'SP');
      return { t: 'raw', tex: '\\' + name };
    }
    // 直前の文字列（置換済み記号は元の綴りで）
    wordParts(seq, i) {
      const parts = []; let j = i;
      while (j > 0) {
        const n = seq.items[j - 1];
        if (n.t !== 'ch' || n.lit) break;
        const s = n.src != null ? n.src : (n.k === 'L' ? n.v : null);
        if (s == null) break;
        parts.unshift({ n, s }); j--;
      }
      return parts;
    }
    matchSuffix(parts, list) {
      const src = parts.map(p => p.s).join('');
      for (const w of list) {
        if (w.length > src.length || !src.endsWith(w)) continue;
        let acc = 0, cnt = 0;
        for (let p = parts.length - 1; p >= 0 && acc < w.length; p--) { acc += parts[p].s.length; cnt++; }
        if (acc === w.length) return { w, cnt };
      }
      return null;
    }
    autoWord() {
      const { seq, i } = this.cur;
      const parts = this.wordParts(seq, i);
      const m = this.matchSuffix(parts, WORDLIST);
      if (!m) return;
      // 構造名の途中（例: pmatrix）なら置換しない…は src で吸収されるので不要
      const removed = del(seq, i - m.cnt, m.cnt);
      const node = sym(WORDS[m.w]); node.src = m.w;
      ins(seq, i - m.cnt, node);
      this.cur = { seq, i: i - m.cnt + 1 };
      this.lastAuto = { node, orig: removed };
    }
    autoMerge(n) {
      const { seq, i } = this.cur;
      const c = n.c; if (!c && n.v !== '.') return;
      if (n.v === '.') {
        const a = seq.items[i - 2], b = seq.items[i - 3];
        if (a && b && a.t === 'ch' && b.t === 'ch' && a.v === '.' && b.v === '.' && !a.lit && !b.lit) {
          const removed = del(seq, i - 3, 3); const s = sym('ldots'); s.src = '...'; ins(seq, i - 3, s);
          this.cur = { seq, i: i - 2 }; this.lastAuto = { node: s, orig: removed };
        }
        return;
      }
      const prev = seq.items[i - 2];
      if (!prev || prev.t !== 'ch' || prev.lit) return;
      const pk = prev.src != null ? prev.src : prev.c;
      if (!pk) return;
      const key = pk + c;
      const name = MERGE[key];
      if (!name) return;
      const removed = del(seq, i - 2, 2);
      const s = sym(name); s.src = key; s.c = null;
      ins(seq, i - 2, s);
      this.cur = { seq, i: i - 1 };
      // 元の文字列に戻せるよう、合成前の生文字を保存
      const orig = [];
      for (const r of removed) { if (r.src && r.src.length > 1 && MERGE[r.src]) for (const cc of r.src) orig.push(charNode(cc)); else orig.push(r); }
      this.lastAuto = { node: s, orig };
    }
    // 「/」：直前の塊を分子へ（GeoGebra の passArgument 相当）
    grabStart(seq, i) {
      const it = seq.items; let j = i;
      while (j > 0 && isScript(it[j - 1])) j--;
      if (j > 0) {
        const p = it[j - 1];
        if (p.t === 'paren') {
          j--;
          let k = j; while (k > 0 && isScript(it[k - 1])) k--;
          if (k > 0 && it[k - 1].t === 'ch' && it[k - 1].k === 'F') return k - 1;
          let m = k; while (m > 0 && it[m - 1].t === 'ch' && it[m - 1].k === 'L' && !it[m - 1].src) m--;
          if (m < k) {
            const run = it.slice(m, k).map(x => x.v).join('');
            for (const f of FN_ALL) if (run.endsWith(f)) return k - f.length;
          }
          return j;
        }
        if (p.t !== 'ch' && p.t !== 'sp' && p.t !== 'nl' && p.t !== 'esc') return j - 1;
      }
      while (j > 0 && it[j - 1].t === 'ch' && ['L', 'N', 'G', 'U', 'F', 'X'].includes(it[j - 1].k) && it[j - 1].v !== '!' && it[j - 1].v !== '/') j--;
      return j;
    }
    slash() {
      const nodes = this.takeSel();
      const fr = mkNode('frac', 2);
      if (nodes) {
        ins(fr.f[0], 0, ...nodes); ins(this.cur.seq, this.cur.i, fr);
        this.cur = { seq: fr.f[1], i: 0 }; return;
      }
      const { seq, i } = this.cur;
      const j = this.grabStart(seq, i);
      let num = del(seq, j, i - j);
      if (num.length === 1 && num[0].t === 'paren' && num[0].open === '(') num = num[0].f[0].items.slice();
      ins(fr.f[0], 0, ...num); ins(seq, j, fr);
      this.cur = num.length ? { seq: fr.f[1], i: 0 } : { seq: fr.f[0], i: 0 };
    }
    script(t) {
      const nodes = this.takeSel();
      if (nodes) {
        const n = mkNode(t, 1); ins(n.f[0], 0, ...nodes); ins(this.cur.seq, this.cur.i, n);
        this.cur = { seq: n.f[0], i: nodes.length }; return;
      }
      let { seq, i } = this.cur; const it = seq.items;
      if (seq.items.length === 0 && seq.parent && seq.parent.t === t) return;
      // 直前が関数名（lim, log, sin …）なら1つの関数ノードにまとめる（\lim_{…} の下付き配置用）
      {
        let m = i; while (m > 0 && it[m - 1].t === 'ch' && it[m - 1].k === 'L' && !it[m - 1].src) m--;
        if (m < i) {
          const run = it.slice(m, i).map(x => x.v).join('');
          const f = FN_ALL.find(f => run.endsWith(f));
          if (f) { del(seq, i - f.length, f.length); ins(seq, i - f.length, ch(f, fnTex(f), 'F')); i = i - f.length + 1; this.cur = { seq, i }; }
        }
      }
      let k = i;
      while (k > 0 && isScript(it[k - 1])) { if (it[k - 1].t === t) { const f = it[k - 1].f[0]; this.cur = { seq: f, i: f.items.length }; return; } k--; }
      k = i;
      while (k < it.length && isScript(it[k])) { if (it[k].t === t) { this.cur = { seq: it[k].f[0], i: 0 }; return; } k++; }
      if (t === 'sub' && i > 0 && it[i - 1].t === 'sup') i--;
      if (t === 'sup' && i < it.length && it[i].t === 'sub') i++;
      if (t === 'sup' && i > 0 && ['frac', 'sqrt', 'root'].includes(it[i - 1].t) && !it[i - 1].binom) {
        const b = del(seq, i - 1, 1)[0]; const p = mkParen('(', ')'); ins(p.f[0], 0, b); ins(seq, i - 1, p);
      }
      const n = mkNode(t, 1); ins(seq, i, n); this.cur = { seq: n.f[0], i: 0 };
    }
    wordBefore(seq, i) {
      const parts = this.wordParts(seq, i);
      const m = this.matchSuffix(parts, STRUCTLIST);
      if (!m) return null;
      return { start: i - m.cnt, word: m.w };
    }
    open(c) {
      const { seq, i } = this.cur;
      if (c === '{' && !this.selRange() && seq.items.length === 0 && seq.parent && seq.parent.t !== 'paren' && seq.parent.t !== 'mat') { seq.gb = true; return; }
      if (c === '{' && !this.selRange() && i > 0 && seq.items[i - 1].t === 'cmd') {
        const n = seq.items[i - 1]; const s = mkSeq(); s.parent = n; s.gb = true; n.f.push(s); this.cur = { seq: s, i: 0 }; return;
      }
      if (c === '(' && !this.selRange()) {
        const w = this.wordBefore(seq, i);
        if (w) { del(seq, w.start, i - w.start); this.cur = { seq, i: w.start }; this.insertStructure(w.word); return; }
      }
      const p = mkParen(c, { '(': ')', '[': ']', '{': '}' }[c]);
      const nodes = this.takeSel();
      if (nodes) { ins(p.f[0], 0, ...nodes); ins(this.cur.seq, this.cur.i, p); this.cur.i++; return; }
      ins(seq, i, p); this.cur = { seq: p.f[0], i: 0 };
    }
    close(c) {
      this.sel = null;
      if (c === '}') {
        let s = this.cur.seq;
        while (s && s.parent) {
          if (s.gb) {
            s.gb = false; const node = s.parent, k = node.f.indexOf(s);
            if (k < node.f.length - 1 && node.t !== 'mat') this.cur = { seq: node.f[k + 1], i: 0 };
            else this.exitAfter(node);
            return;
          }
          s = s.parent.parent;
        }
      }
      let s = this.cur.seq;
      while (s && s.parent) {
        const node = s.parent;
        if (node.t === 'paren') {
          if (node.open === '|' && c === '|') { this.exitAfter(node); return; }
          if (node.open !== '|' && c !== '|' && node.open !== '‖') {
            if (node.close !== c) node.close = c;
            this.exitAfter(node); return;
          }
        }
        s = node.parent;
      }
      if (c === '|') { this.insertStructure('abs'); return; }
      // LaTeX の癖で打った } は「いまの枠を閉じる」
      if (c === '}' && this.cur.seq.parent) { const node = this.cur.seq.parent, k = node.f.indexOf(this.cur.seq); if (k < node.f.length - 1 && node.t !== 'mat') this.cur = { seq: node.f[k + 1], i: 0 }; else this.exitAfter(node); return; }
      const open = { ')': '(', ']': '[', '}': '{' }[c];
      const { seq, i } = this.cur;
      const nodes = del(seq, 0, i);
      const p = mkParen(open, c); ins(p.f[0], 0, ...nodes); ins(seq, 0, p);
      this.cur = { seq, i: 1 };
    }
    space() {
      this.deleteSel();
      const { seq, i } = this.cur;
      const par = seq.parent;
      if (par && i === seq.items.length && !['paren', 'mat', 'text'].includes(par.t)) { this.exitAfter(par); return; }
      if (i > 0 && seq.items[i - 1].t === 'sp') return;
      this.insertNode({ t: 'sp' });
    }
    // 構造の挿入（キーボード・単語・\命令 共通）
    insertStructure(name, opt) {
      const nodes = this.takeSel();
      let n, main = 0;
      const lat = s => { const q = parseLatex(s); return q.items.slice(); };
      switch (name) {
        case 'sqrt': n = mkNode('sqrt', 1); break;
        case 'cbrt': n = mkNode('root', 2); ins(n.f[0], 0, ch('3', '3', 'N')); main = 1; break;
        case 'nroot': case 'root': n = mkNode('root', 2); main = nodes ? 0 : 1; break;
        case 'abs': n = mkParen('|', '|'); break;
        case 'norm': n = mkParen('‖', '‖'); break;
        case 'floor': n = mkParen('⌊', '⌋'); break;
        case 'ceil': n = mkParen('⌈', '⌉'); break;
        case 'paren': n = mkParen('(', ')'); break;
        case 'bracket': n = mkParen('[', ']'); break;
        case 'brace': n = mkParen('{', '}'); break;
        case 'angle': n = mkParen('⟨', '⟩'); break;
        case 'frac': case 'dfrac': n = mkNode('frac', 2); break;
        case 'binom': n = mkNode('frac', 2, { binom: true }); break;
        case 'text': n = mkNode('text', 1); break;
        case 'sup': case 'sub': if (nodes) ins(this.cur.seq, this.cur.i, ...nodes), this.cur.i += nodes.length; this.script(name); return;
        case 'matrix': case 'pmatrix': case 'bmatrix': case 'vmatrix': case 'Bmatrix': case 'cases': {
          const r = (opt && opt.rows) || 2, c = (opt && opt.cols) || 2;
          n = mkNode('mat', r * c, { env: name, rows: r, cols: c }); break;
        }
        case 'sum': case 'prod': case 'int': case 'oint': case 'lim': {
          // ∑_{□}^{□} の形でまとめて挿入
          if (nodes) ins(this.cur.seq, this.cur.i, ...nodes), this.cur.i += nodes.length;
          const s = this.cur.seq; let i = this.cur.i;
          if (name === 'lim') ins(s, i++, ch('lim', '\\lim', 'F'));
          else ins(s, i++, sym(name));
          const lo = mkNode('sub', 1); ins(s, i++, lo);
          if (name !== 'lim') { const hi = mkNode('sup', 1); ins(s, i++, hi); }
          this.cur = { seq: lo.f[0], i: 0 };
          if (name === 'lim') { ins(lo.f[0], 0, ch('x', 'x', 'L'), sym('to')); this.cur = { seq: lo.f[0], i: 2 }; }
          return;
        }
        case 'deriv': { // d/dx
          n = mkNode('frac', 2); ins(n.f[0], 0, ch('d', 'd', 'L')); ins(n.f[1], 0, ch('d', 'd', 'L'), ch('x', 'x', 'L'));
          ins(this.cur.seq, this.cur.i, n); this.cur.i++; if (nodes) { ins(this.cur.seq, this.cur.i, ...nodes); this.cur.i += nodes.length; } return;
        }
        case 'pderiv': {
          n = mkNode('frac', 2); ins(n.f[0], 0, sym('partial')); ins(n.f[1], 0, sym('partial'), ch('x', 'x', 'L'));
          ins(this.cur.seq, this.cur.i, n); this.cur.i++; return;
        }
        default:
          if (ACCENTS.includes(name)) { n = mkNode('acc', 1, { cmd: name }); break; }
          if (STYLES.includes(name)) { n = mkNode('style', 1, { cmd: name }); break; }
          if (name.startsWith('latex:')) { // 任意の LaTeX 断片
            const items = lat(name.slice(6)); ins(this.cur.seq, this.cur.i, ...items); this.cur.i += items.length; return;
          }
          n = mkNode('cmd', 1, { name });
      }
      ins(this.cur.seq, this.cur.i, n);
      if (nodes) { ins(n.f[main], 0, ...nodes); this.cur = { seq: this.cur.seq, i: this.cur.i + 1 }; return; }
      this.cur = { seq: n.f[main], i: n.f[main].items.length };
    }
    insertSymbol(name) {
      this.save(); this.deleteSel();
      if (name in SYM || name === '#deg') this.insertNode(sym(name));
      this.changed();
    }
    insertFn(name) { // sin( などをまとめて
      this.save(); this.deleteSel();
      for (const c of name) this.insertNode(ch(c, c, 'L'));
      const p = mkParen('(', ')'); ins(this.cur.seq, this.cur.i, p); this.cur = { seq: p.f[0], i: 0 };
      this.changed();
    }
    struct(name, opt) { this.save(); this.commitEsc(); this.insertStructure(name, opt); this.changed(); }

    /* ---- 削除 ---- */
    backspace() {
      this.save();
      if (this.deleteSel()) return this.changed();
      const { seq, i } = this.cur;
      const prev = seq.items[i - 1];
      if (this.lastAuto && prev && this.lastAuto.node === prev) {
        const orig = this.lastAuto.orig.map(o => { const c = cloneNode(o); c.lit = true; delete c.src; return c; });
        del(seq, i - 1); ins(seq, i - 1, ...orig); this.cur = { seq, i: i - 1 + orig.length };
        this.lastAuto = null; return this.changed();
      }
      this.lastAuto = null;
      if (i > 0) {
        const n = prev;
        if (n.t === 'esc') { if (n.buf) n.buf = n.buf.slice(0, -1); else { del(seq, i - 1); this.cur.i--; } return this.changed(); }
        if (n.t === 'ch' && n.k === 'F' && n.v.length > 1) {
          del(seq, i - 1); const rest = Array.from(n.v.slice(0, -1)).map(c => ch(c, c, 'L', { lit: true }));
          ins(seq, i - 1, ...rest); this.cur.i = i - 1 + rest.length; return this.changed();
        }
        if (hasFields(n) && n.f.some(f => f.items.length)) {
          let k = n.f.length - 1; while (k > 0 && n.f[k].items.length === 0 && n.t === 'mat') k--;
          const s = n.f[k]; this.cur = { seq: s, i: s.items.length }; return this.changed();
        }
        del(seq, i - 1); this.cur.i--; return this.changed();
      }
      if (seq.parent) {
        const node = seq.parent, k = node.f.indexOf(seq);
        if (k > 0 && (seq.items.length === 0 || node.t === 'mat')) {
          if (node.t === 'mat' && node.f.every(f => f.items.length === 0)) { this.removeNode(node); return this.changed(); }
          const p = node.f[k - 1]; this.cur = { seq: p, i: p.items.length }; return this.changed();
        }
        if (node.t === 'mat') { if (node.f.every(f => f.items.length === 0)) this.removeNode(node); else this.exitBefore(node); return this.changed(); }
        this.unwrap(node, k);
      }
      this.changed();
    }
    removeNode(node) { const s = node.parent, i = idx(node); del(s, i); this.cur = { seq: s, i }; }
    unwrap(node, k) {
      const s = node.parent, p = idx(node);
      let items = [], cursorAt = 0;
      const fields = node.f.map(f => f.items.slice());
      if (node.t === 'frac' && !node.binom) {
        const [a, b] = fields;
        items = a.length && b.length ? [...a, ch('/', '/', 'X'), ...b] : [...a, ...b];
        cursorAt = k === 0 ? 0 : (a.length && b.length ? a.length + 1 : a.length);
      } else if (node.t === 'text') {
        items = fields[0].map(n => n.v === ' ' ? { t: 'sp' } : (n.rawtex ? { t: 'raw', tex: n.rawtex } : charNode(n.v)));
      } else {
        for (let q = 0; q < fields.length; q++) { if (q === k) cursorAt = items.length; items.push(...fields[q]); }
      }
      del(s, p); ins(s, p, ...items);
      this.cur = { seq: s, i: p + cursorAt };
    }
    del() {
      this.save();
      if (this.deleteSel()) return this.changed();
      const { seq, i } = this.cur;
      if (i < seq.items.length) {
        const n = seq.items[i];
        if (hasFields(n) && n.f.some(f => f.items.length)) { this.cur = { seq: n.f[0], i: 0 }; return this.changed(); }
        del(seq, i); return this.changed();
      }
      if (seq.parent) { const node = seq.parent, k = node.f.indexOf(seq); if (k < node.f.length - 1) this.cur = { seq: node.f[k + 1], i: 0 }; else this.exitAfter(node); }
      this.changed();
    }

    /* ---- 貼り付け ---- */
    paste(text) {
      this.save(); this.deleteSel();
      text = text.replace(/^\s*(\$\$?|\\\[|\\\()\s*/, '').replace(/\s*(\$\$?|\\\]|\\\))\s*$/, '');
      const looksTex = /\\[a-zA-Z]|[{}]/.test(text);
      const seq = looksTex ? parseLatex(text) : parseLinear(text);
      const items = seq.items.slice();
      ins(this.cur.seq, this.cur.i, ...items); this.cur.i += items.length;
      this.changed();
    }
    /* ---- 行列 ---- */
    matInfo() {
      let s = this.cur.seq;
      while (s.parent && s.parent.t !== 'mat') s = s.parent.parent;
      if (!s || !s.parent) return null;
      const n = s.parent, k = n.f.indexOf(s);
      return { n, k, r: Math.floor(k / n.cols), c: k % n.cols };
    }
    matStep(dir) {
      const m = this.matInfo(); if (!m) return;
      const { n, r, c } = m;
      if (dir === 'col') { if (c + 1 >= n.cols) this.matOp('addCol', true); else { const t = n.f[r * n.cols + c + 1]; this.cur = { seq: t, i: t.items.length }; } }
      else { if (r + 1 >= n.rows) this.matOp('addRow', true); else { const t = n.f[(r + 1) * n.cols + 0]; this.cur = { seq: t, i: t.items.length }; } }
    }
    matOp(op, nosave) {
      const m = this.matInfo(); if (!m) return false;
      if (!nosave) this.save();
      const { n, r, c } = m;
      const rows = [];
      for (let i = 0; i < n.rows; i++) rows.push(n.f.slice(i * n.cols, (i + 1) * n.cols));
      if (op === 'addRow') rows.splice(r + 1, 0, Array.from({ length: n.cols }, () => mkSeq()));
      if (op === 'addCol') rows.forEach(row => row.splice(c + 1, 0, mkSeq()));
      if (op === 'delRow' && n.rows > 1) rows.splice(r, 1);
      if (op === 'delCol' && n.cols > 1) rows.forEach(row => row.splice(c, 1));
      n.rows = rows.length; n.cols = rows[0].length; n.f = rows.flat(); n.f.forEach(x => x.parent = n);
      const nr = Math.min(op === 'addRow' ? r + 1 : r, n.rows - 1);
      const nc = op === 'addRow' ? 0 : Math.min(op === 'addCol' ? c + 1 : c, n.cols - 1);
      const t = n.f[nr * n.cols + nc]; this.cur = { seq: t, i: t.items.length };
      if (!nosave) this.changed();
      return true;
    }
    /* ---- 補完 ---- */
    suggestions() {
      const esc = this.escBefore();
      if (esc) {
        if (!esc.buf) return [];
        const out = [];
        for (const w of [...STRUCTLIST, ...Object.keys(SYM), ...FN_ALL]) if (w.startsWith(esc.buf) && !out.some(o => o.w === w)) out.push({ w, kind: 'esc', show: '\\' + w + (w in SYM ? ' ' + SYM[w].v : '') });
        return out.sort((a, b) => a.w.length - b.w.length).slice(0, 8);
      }
      if (!this.opts.autoWords) return [];
      const parts = this.wordParts(this.cur.seq, this.cur.i).filter(p => !p.n.lit);
      let word = parts.map(p => p.s).join('');
      // 最後の単語部分（記号に置換済みの部分は前置きとして除外）
      const m = word.match(/[a-zA-Z]+$/); word = m ? m[0] : '';
      const n = this.cur.seq.items[this.cur.i - 1];
      if (!n || n.t !== 'ch' || n.k !== 'L') return [];
      return suggest(word).map(s => Object.assign({ prefix: word }, s));
    }
    applySuggestion(sg) {
      this.save();
      const esc = this.escBefore();
      if (sg.kind === 'esc' && esc) { esc.buf = sg.w; const r = this.commitEsc(); this.changed(); return; }
      const { seq, i } = this.cur;
      // 接頭辞の文字を削除
      let cnt = 0, len = 0;
      while (len < sg.prefix.length && i - cnt - 1 >= 0) { const nd = seq.items[i - cnt - 1]; len += (nd.src || nd.v).length; cnt++; }
      del(seq, i - cnt, cnt); this.cur = { seq, i: i - cnt };
      if (sg.kind === 'sym') { const nd = sym(WORDS[sg.w]); nd.src = sg.w; this.insertNode(nd); }
      else if (sg.kind === 'struct') this.insertStructure(sg.w);
      else { for (const c of sg.w) this.insertNode(ch(c, c, 'L')); }
      this.changed();
    }
    /* ---- 文脈ヒント ---- */
    context() {
      const s = this.cur.seq, node = s.parent;
      const parts = this.wordParts(s, this.cur.i);
      const word = parts.map(p => p.s).join('');
      let where = 'root';
      if (node) {
        const k = node.f.indexOf(s);
        where = node.t === 'frac' ? (node.binom ? 'binom' : (k === 0 ? 'num' : 'den')) : node.t === 'root' ? (k === 0 ? 'index' : 'radicand') : node.t;
      }
      return { where, word, atEnd: this.cur.i === s.items.length, esc: this.escBefore() };
    }
  }

  // 単語補完の候補
  const SUGGEST = [];
  for (const w of Object.keys(WORDS)) SUGGEST.push({ w, kind: 'sym', show: w === 'deg' ? '°' : SYM[WORDS[w]].v });
  for (const w of ['sqrt', 'nroot', 'cbrt', 'abs', 'norm', 'floor', 'ceil', 'frac', 'binom', 'vec', 'hat', 'bar', 'overline', 'dot', 'ddot', 'tilde', 'text', 'mathbf', 'mathbb', 'mathcal', 'boldsymbol', 'pmatrix', 'bmatrix', 'cases', 'operatorname'])
    SUGGEST.push({ w, kind: 'struct', show: w + '(' });
  for (const w of FN_STD) if (!WORDS[w]) SUGGEST.push({ w, kind: 'fn', show: w });
  function suggest(prefix) {
    if (!prefix || prefix.length < 2) return [];
    return SUGGEST.filter(s => s.w.startsWith(prefix) && s.w !== prefix).sort((a, b) => a.w.length - b.w.length).slice(0, 6);
  }

  return {
    Editor, parseLatex, parseLinear, serSeq, serNode, mkSeq, mkNode, ch, sym, isTall, isScript, splitFn, FN_SET, FN_STD_SET,
    SYM, WORDS, suggest, cloneSeq, STRUCTLIST, FN_ALL, idx, tokenize, toksToStr, charNode
  };
})();
if (typeof module !== 'undefined') module.exports = MathCore;

'use strict';
/* =====================================================================
 *  MathRender : 木構造 → HTML（編集中フィールドとプレビューで共通）
 * ===================================================================== */
const MathRender = (() => {
  const M = MathCore;
  const LIMOPS = new Set(['lim', 'liminf', 'limsup', 'max', 'min', 'sup', 'inf', 'det', 'gcd', 'Pr']);
  const NOLIM_BIG = new Set(['∫', '∬', '∭', '∮']);

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const SVGNS = 'http://www.w3.org/2000/svg';
  function svg(vb, d, cls, extra) {
    const s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', vb); s.setAttribute('preserveAspectRatio', 'none');
    s.setAttribute('class', cls); s.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(SVGNS, 'path');
    p.setAttribute('d', d); p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', (extra && extra.w) || '1.15'); p.setAttribute('vector-effect', 'non-scaling-stroke');
    p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
    s.appendChild(p);
    return s;
  }
  const DPATH = {
    '(': 'M8,1 C1.5,25 1.5,75 8,99', ')': 'M2,1 C8.5,25 8.5,75 2,99',
    '[': 'M8,1 H3.5 V99 H8', ']': 'M2,1 H6.5 V99 H2',
    '{': 'M8.5,1 C5,1 5,4 5,12 V40 C5,47 3.5,50 1.5,50 C3.5,50 5,53 5,60 V88 C5,96 5,99 8.5,99',
    '}': 'M1.5,1 C5,1 5,4 5,12 V40 C5,47 6.5,50 8.5,50 C6.5,50 5,53 5,60 V88 C5,96 5,99 1.5,99',
    '|': 'M5,1 V99', '‖': 'M3.2,1 V99 M6.8,1 V99', '⟨': 'M8,1 L2.5,50 L8,99', '⟩': 'M2,1 L7.5,50 L2,99',
    '⌊': 'M3.5,1 V99 H8', '⌋': 'M6.5,1 V99 H2', '⌈': 'M3.5,99 V1 H8', '⌉': 'M6.5,99 V1 H2'
  };
  function delim(c, tall) {
    if (!c || c === '.') return el('span', 'mq-d mq-dnone');
    if (tall && DPATH[c]) {
      const w = el('span', 'mq-d mq-dstretch');
      w.appendChild(svg('0 0 10 100', DPATH[c], 'mq-dsvg'));
      return w;
    }
    return el('span', 'mq-d', c);
  }

  /* 文字スタイル（\mathbb 等）: Unicode 数学英数字へ */
  const EXC = {
    mathbb: { C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' },
    mathcal: { B: 'ℬ', E: 'ℰ', F: 'ℱ', H: 'ℋ', I: 'ℐ', L: 'ℒ', M: 'ℳ', R: 'ℛ', e: 'ℯ', g: 'ℊ', o: 'ℴ' },
    mathfrak: { C: 'ℭ', H: 'ℌ', I: 'ℑ', R: 'ℜ', Z: 'ℨ' }
  };
  EXC.mathscr = EXC.mathcal;
  const BASE = { mathbb: 0x1D538, mathcal: 0x1D49C, mathscr: 0x1D49C, mathfrak: 0x1D504 };
  function styleChar(cmd, v) {
    if (!(cmd in BASE) || v.length !== 1) return v;
    if (EXC[cmd][v]) return EXC[cmd][v];
    const c = v.charCodeAt(0);
    if (c >= 65 && c <= 90) return String.fromCodePoint(BASE[cmd] + (c - 65));
    if (c >= 97 && c <= 122 && cmd !== 'mathbb') return String.fromCodePoint(BASE[cmd] + 26 + (c - 97));
    if (cmd === 'mathbb' && c >= 48 && c <= 57) return String.fromCodePoint(0x1D7D8 + (c - 48));
    return v;
  }
  const UPRIGHT_STYLES = new Set(['mathrm', 'mathbf', 'mathsf', 'mathtt', 'operatorname', 'mathbb', 'mathcal', 'mathfrak', 'mathscr']);

  function cursorEl() { return el('span', 'mq-cursor'); }
  const isL = n => n && n.t === 'ch' && n.k === 'L' && !n.src;

  function renderSeq(seq, ctx, style) {
    const box = el('span', 'mq-seq');
    if (ctx.map) ctx.map.set(box, { seq });
    const it = seq.items;
    const isCur = ctx.cur && ctx.cur.seq === seq;
    const selR = ctx.selR && ctx.selR.seq === seq ? ctx.selR : null;
    if (!it.length) {
      if (ctx.edit) {
        const ph = el('span', 'mq-ph');
        if (isCur) { ph.classList.add('mq-ph-on'); ph.appendChild(cursorEl()); }
        if (ctx.map) ctx.map.set(ph, { seq, i: 0, empty: true });
        box.appendChild(ph);
      } else if (isCur) box.appendChild(cursorEl());
      return box;
    }
    // 関数名（sin, log …）の検出
    const fnMark = new Array(it.length).fill(0);
    for (let i = 0; i < it.length;) {
      if (isL(it[i])) {
        let j = i; while (j < it.length && isL(it[j])) j++;
        const run = it.slice(i, j).map(n => n.v).join('');
        let p = i;
        for (const tk of M.splitFn(run)) {
          if (tk.fn) for (let q = 0; q < tk.s.length; q++) fnMark[p + q] = q === tk.s.length - 1 ? (q === 0 ? 4 : 2) : (q === 0 ? 3 : 1);
          p += tk.s.length;
        }
        i = j;
      } else i++;
    }
    const mapItem = (e, i) => {
      if (selR && i >= selR.a && i < selR.b) e.classList.add('mq-sel');
      if (ctx.map) ctx.map.set(e, { seq, i });
    };
    for (let i = 0; i <= it.length; i++) {
      if (isCur && ctx.cur.i === i) box.appendChild(cursorEl());
      if (i === it.length) break;
      const n = it[i];
      // 上下に添字を置く演算子（∑ ∏ lim …）
      const limBase = (n.t === 'ch' && ((n.k === 'BIG' && !NOLIM_BIG.has(n.v)) || (n.k === 'F' && LIMOPS.has(n.v)))) && M.isScript(it[i + 1]) && (ctx.display || ctx.edit);
      if (limBase) {
        const col = el('span', 'mq-limits');
        const top = el('span', 'mq-lim-top'), mid = el('span', 'mq-lim-mid'), bot = el('span', 'mq-lim-bot');
        const b = renderNode(n, ctx, 0, prevOf(it, i), style); mapItem(b, i); mid.appendChild(b);
        let j = i + 1;
        while (M.isScript(it[j])) {
          if (isCur && ctx.cur.i === j) mid.appendChild(cursorEl());
          const s = it[j];
          const e = renderSeq(s.f[0], ctx, style); e.classList.add('mq-limarg');
          const wrap = el('span', 'mq-limwrap'); wrap.appendChild(e); mapItem(wrap, j);
          (s.t === 'sup' ? top : bot).appendChild(wrap);
          j++;
        }
        col.append(top, mid, bot);
        box.appendChild(col);
        i = j - 1; continue;
      }
      // x_1^2 のような上下添字は縦に重ねる
      if (M.isScript(n) && M.isScript(it[i + 1]) && n.t !== it[i + 1].t) {
        const stack = el('span', 'mq-supsub');
        const a = renderNode(n, ctx, 0, null, style), b = renderNode(it[i + 1], ctx, 0, null, style);
        a.classList.remove('mq-sup', 'mq-sub'); b.classList.remove('mq-sup', 'mq-sub');
        mapItem(a, i); mapItem(b, i + 1);
        const supE = n.t === 'sup' ? a : b, subE = n.t === 'sup' ? b : a;
        stack.append(supE, subE);
        if (isCur && ctx.cur.i === i + 1) stack.appendChild(cursorEl());
        box.appendChild(stack);
        i++; continue;
      }
      const e = renderNode(n, ctx, fnMark[i], prevOf(it, i), style);
      mapItem(e, i);
      box.appendChild(e);
    }
    return box;
  }
  function prevOf(it, i) { return i > 0 ? it[i - 1] : null; }

  function renderNode(n, ctx, fnm, prev, style) {
    switch (n.t) {
      case 'ch': {
        let cls = 'mq-c';
        const k = n.k;
        if (k === 'L' || k === 'G') cls += (fnm || (style && UPRIGHT_STYLES.has(style))) ? ' mq-fn' : ' mq-v';
        else if (k === 'N') cls += ' mq-n';
        else if (k === 'B') {
          const unary = !prev || (prev.t === 'ch' && ['B', 'R', 'P', 'A'].includes(prev.k)) || prev.t === 'nl';
          cls += unary ? ' mq-unary' : ' mq-bin';
        }
        else if (k === 'R') cls += ' mq-rel';
        else if (k === 'P') cls += ' mq-punc';
        else if (k === 'BIG') cls += NOLIM_BIG.has(n.v) ? ' mq-big mq-int' : ' mq-big';
        else if (k === 'F') cls += ' mq-fn mq-fnend';
        else if (k === 'SP') cls += ' mq-spc';
        else if (k === 'A') cls += ' mq-amp';
        else if (k === 'T') cls += ' mq-tch';
        else cls += ' mq-u';
        if (fnm === 2 || fnm === 4) cls += ' mq-fnend';
        if ((fnm === 3 || fnm === 4 || k === 'F') && prev && !(prev.t === 'ch' && ['B', 'R', 'P', 'O'].includes(prev.k)) && prev.t !== 'sp') cls += ' mq-fnstart';
        if (style === 'mathbf' || style === 'boldsymbol' || style === 'bm') cls += ' mq-bold';
        let v = n.v;
        if (style) v = styleChar(style, v);
        if (k === 'SP') v = ' '.repeat(n.tex.includes('qquad') ? 6 : n.tex.includes('quad') ? 3 : n.tex.includes('!') ? 0 : 1) || ' ';
        if (k === 'A') v = ctx.edit ? '&' : '';
        if (k === 'T' && v === ' ') v = ' ';
        return el('span', cls, v);
      }
      case 'sp': return el('span', 'mq-space', ctx.edit ? ' ' : ' ');
      case 'nl': { const e = el('span', 'mq-nl'); if (ctx.edit) e.appendChild(el('span', 'mq-nlmark', '↵')); return e; }
      case 'frac': {
        const f = el('span', n.binom ? 'mq-frac mq-binom' : 'mq-frac');
        const num = el('span', 'mq-num'), den = el('span', 'mq-den');
        num.appendChild(renderSeq(n.f[0], ctx, style)); den.appendChild(renderSeq(n.f[1], ctx, style));
        f.append(num, den);
        if (n.binom) { const w = el('span', 'mq-paren'); w.append(delim('(', true), f, delim(')', true)); return w; }
        return f;
      }
      case 'sup': case 'sub': {
        const e = el('span', n.t === 'sup' ? 'mq-sup' : 'mq-sub');
        e.appendChild(renderSeq(n.f[0], ctx, style));
        return e;
      }
      case 'sqrt': case 'root': {
        const w = el('span', 'mq-sqrtw');
        if (n.t === 'root') { const ix = el('span', 'mq-idx'); ix.appendChild(renderSeq(n.f[0], ctx, style)); w.appendChild(ix); }
        const s = el('span', 'mq-sqrt');
        s.appendChild(svg('0 0 10 100', 'M0.5,60 L2.6,54 L5.2,98 L9.8,1.5 L10,1.5', 'mq-rad'));
        const body = el('span', 'mq-radicand'); body.appendChild(renderSeq(n.f[n.t === 'root' ? 1 : 0], ctx, style));
        s.appendChild(body); w.appendChild(s);
        return w;
      }
      case 'paren': {
        const tall = M.isTall(n.f[0]) || n.f[0].items.some(x => x.t === 'mat');
        const w = el('span', 'mq-paren' + (tall ? ' mq-tall' : ''));
        const body = el('span', 'mq-pbody'); body.appendChild(renderSeq(n.f[0], ctx, style));
        w.append(delim(n.open, tall), body, delim(n.close, tall));
        return w;
      }
      case 'acc': {
        const w = el('span', 'mq-acc mq-acc-' + n.cmd);
        const body = el('span', 'mq-accbody'); body.appendChild(renderSeq(n.f[0], ctx, style));
        const mark = el('span', 'mq-accmark');
        const arrows = { vec: 'M0.5,50 H99 M86,20 L99,50 L86,80', overrightarrow: 'M0.5,50 H99 M86,20 L99,50 L86,80', overleftarrow: 'M99.5,50 H1 M14,20 L1,50 L14,80' };
        if (arrows[n.cmd]) mark.appendChild(svg('0 0 100 100', arrows[n.cmd], 'mq-accsvg'));
        else if (n.cmd === 'hat' || n.cmd === 'widehat') mark.appendChild(svg('0 0 100 100', 'M5,90 L50,15 L95,90', 'mq-accsvg'));
        else if (n.cmd === 'tilde' || n.cmd === 'widetilde') mark.appendChild(svg('0 0 100 100', 'M3,70 C25,10 45,10 50,50 C55,90 75,90 97,30', 'mq-accsvg'));
        else if (n.cmd === 'dot') mark.textContent = '˙';
        else if (n.cmd === 'ddot') mark.textContent = '¨';
        else if (n.cmd === 'overbrace' || n.cmd === 'underbrace') mark.appendChild(svg('0 0 100 100', 'M1,90 C1,50 10,50 25,50 H42 C48,50 50,30 50,10 C50,30 52,50 58,50 H75 C90,50 99,50 99,90', 'mq-accsvg'));
        if (n.cmd === 'underline' || n.cmd === 'underbrace') w.append(body, mark); else w.append(mark, body);
        return w;
      }
      case 'style': {
        const w = el('span', 'mq-style mq-st-' + n.cmd);
        w.appendChild(renderSeq(n.f[0], ctx, n.cmd));
        return w;
      }
      case 'text': {
        const w = el('span', 'mq-text' + (n.cmd && n.cmd.includes('bf') ? ' mq-bold' : '') + (n.cmd && n.cmd.includes('it') ? ' mq-ital' : ''));
        w.appendChild(renderSeq(n.f[0], ctx, null));
        return w;
      }
      case 'grp': return renderSeq(n.f[0], ctx, style);
      case 'mat': {
        const D = { pmatrix: ['(', ')'], bmatrix: ['[', ']'], Bmatrix: ['{', '}'], vmatrix: ['|', '|'], Vmatrix: ['‖', '‖'], cases: ['{', '.'] };
        const [o, c] = D[n.env] || ['.', '.'];
        const w = el('span', 'mq-paren mq-tall mq-matw');
        const g = el('span', 'mq-mat mq-env-' + n.env);
        g.style.gridTemplateColumns = `repeat(${n.cols}, auto)`;
        for (let k = 0; k < n.f.length; k++) {
          const cell = el('span', 'mq-cell');
          if (['aligned', 'split', 'alignedat'].includes(n.env)) cell.classList.add(k % n.cols % 2 === 0 ? 'mq-cr' : 'mq-cl');
          cell.appendChild(renderSeq(n.f[k], ctx, style));
          g.appendChild(cell);
        }
        w.append(delim(o, true), g, delim(c, true));
        return w;
      }
      case 'cmd': {
        const w = el('span', 'mq-cmd');
        w.appendChild(el('span', 'mq-cmdname', '\\' + n.name));
        for (const f of n.f) { const a = el('span', 'mq-cmdarg'); a.appendChild(renderSeq(f, ctx, style)); w.appendChild(a); }
        return w;
      }
      case 'raw': {
        const m = n.tex.match(/^\\(label|tag)\{(.*)\}$/);
        if (m && !ctx.edit) return el('span', 'mq-hidden');
        if (/^\\(displaystyle|textstyle|limits|nolimits|nonumber|notag)$/.test(n.tex) && !ctx.edit) return el('span', 'mq-hidden');
        return el('span', 'mq-raw', m ? (m[1] === 'label' ? '🏷' + m[2] : '(' + m[2] + ')') : n.tex);
      }
      case 'esc': return el('span', 'mq-esc', '\\' + n.buf);
    }
    return el('span', 'mq-raw', '?');
  }

  function render(seq, opts) {
    opts = opts || {};
    const root = el('span', 'mq' + (opts.display ? ' mq-display' : '') + (opts.edit ? ' mq-edit' : ''));
    root.appendChild(renderSeq(seq, opts, null));
    return root;
  }
  function renderLatex(tex, opts) {
    return render(M.parseLatex(tex), opts || {});
  }
  return { render, renderLatex, el };
})();

'use strict';
/* =====================================================================
 *  MathField : 編集可能な数式フィールド（キーボード・マウス・IME）
 * ===================================================================== */
class MathField {
  constructor(host, opts) {
    this.opts = Object.assign({ onChange() { }, onEnter() { return false; }, onEscape() { }, onSuggest() { }, onContext() { } }, opts || {});
    this.ed = new MathCore.Editor({ autoWords: this.opts.autoWords !== false });
    this.ed.onChange = () => this.update();
    this.host = host;
    host.classList.add('mf');
    this.view = MathRender.el('div', 'mf-view');
    this.input = document.createElement('textarea');
    this.input.className = 'mf-input';
    this.input.setAttribute('autocapitalize', 'off'); this.input.setAttribute('autocomplete', 'off');
    this.input.setAttribute('autocorrect', 'off'); this.input.setAttribute('spellcheck', 'false');
    this.input.setAttribute('aria-label', '数式入力');
    host.append(this.view, this.input);
    this.map = new WeakMap();
    this.composing = false;
    this.bind();
    this.ready = false;
    this.update();
    this.ready = true;
  }
  /* ---------- 公開API ---------- */
  getLatex() { return this.ed.getLatex(); }
  setLatex(s) { this.ed.save(); this.ed.setLatex(s); this.update(); }
  clear() { this.ed = Object.assign(this.ed, {}); this.ed.setLatex(''); this.ed.hist = []; this.ed.future = []; this.update(); }
  focus() { this.input.focus({ preventScroll: true }); this.host.classList.add('mf-focus'); this.update(true); }
  setAutoWords(v) { this.ed.opts.autoWords = v; }
  // キーボード（画面）からの操作
  act(a) {
    const ed = this.ed;
    const [kind, arg, opt] = a;
    switch (kind) {
      case 'type': ed.type(arg); break;
      case 'struct': ed.struct(arg, opt); break;
      case 'sym': ed.insertSymbol(arg); break;
      case 'fn': ed.insertFn(arg); break;
      case 'latex': ed.struct('latex:' + arg); break;
      case 'key': this.key(arg); break;
    }
    this.update();
  }
  key(name, shift) {
    const ed = this.ed;
    switch (name) {
      case 'left': shift ? ed.extendSel(-1) : ed.left(); break;
      case 'right': shift ? ed.extendSel(1) : ed.right(); break;
      case 'up': ed.vert(-1); break;
      case 'down': ed.vert(1); break;
      case 'home': ed.home(); break;
      case 'end': ed.end(); break;
      case 'backspace': ed.backspace(); break;
      case 'delete': ed.del(); break;
      case 'tab': ed.tab(false); break;
      case 'undo': ed.undo(); break;
      case 'redo': ed.redo(); break;
      case 'clear': ed.save(); ed.setLatex(''); break;
      case 'newline': ed.type('\n'); break;
    }
    this.update();
  }
  /* ---------- 描画 ---------- */
  update(keepScroll) {
    this.map = new WeakMap();
    const sr = this.ed.selRange();
    const tree = MathRender.render(this.ed.root, { edit: true, display: true, cur: sr ? null : this.ed.cur, selR: sr, map: this.map });
    this.view.replaceChildren(tree);
    // 空のとき
    this.host.classList.toggle('mf-empty', this.ed.isEmpty());
    const c = this.view.querySelector('.mq-cursor');
    if (c) {
      // IME 候補窓の位置合わせ
      const hr = this.host.getBoundingClientRect(), cr = c.getBoundingClientRect();
      this.input.style.left = Math.max(0, cr.left - hr.left) + 'px';
      this.input.style.top = Math.max(0, cr.top - hr.top) + 'px';
      // 横スクロール
      const vr = this.view.getBoundingClientRect();
      if (cr.right > vr.right - 12) this.view.scrollLeft += cr.right - vr.right + 40;
      if (cr.left < vr.left + 12) this.view.scrollLeft -= vr.left - cr.left + 40;
    }
    if (!this.ready) return;
    this.opts.onChange(this.getLatex());
    this.opts.onSuggest(this.ed.suggestions());
    this.opts.onContext(this.ed.context());
  }
  /* ---------- 入力イベント ---------- */
  bind() {
    const inp = this.input, ed = this.ed;
    inp.addEventListener('focus', () => { this.host.classList.add('mf-focus'); });
    inp.addEventListener('blur', () => { this.host.classList.remove('mf-focus'); });
    inp.addEventListener('compositionstart', () => { this.composing = true; });
    inp.addEventListener('compositionend', () => {
      this.composing = false;
      const v = inp.value; inp.value = '';
      if (v) { this.ed.type(v.replace(/　/g, ' ')); }
    });
    inp.addEventListener('input', e => {
      if (this.composing || e.isComposing) return;
      const v = inp.value; inp.value = '';
      if (v) this.ed.type(v);
    });
    inp.addEventListener('keydown', e => this.onKey(e));
    inp.addEventListener('copy', e => { const s = this.ed.selectionLatex() || this.getLatex(); e.clipboardData.setData('text/plain', s); e.preventDefault(); });
    inp.addEventListener('cut', e => { const s = this.ed.selectionLatex(); if (!s) return; e.clipboardData.setData('text/plain', s); e.preventDefault(); this.ed.backspace(); });
    inp.addEventListener('paste', e => {
      const t = (e.clipboardData || window.clipboardData).getData('text/plain');
      e.preventDefault();
      if (t) this.ed.paste(t);
    });
    // マウス
    let dragAnchor = null;
    this.host.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      const pos = this.posFromEvent(e);
      if (pos) { this.ed.setCursor(pos.seq, pos.i); dragAnchor = pos; }
      else { this.ed.end(); dragAnchor = null; }
      this.focus();
      this.update();
    });
    window.addEventListener('mousemove', e => {
      if (!dragAnchor || !(e.buttons & 1)) { dragAnchor = null; return; }
      const pos = this.posFromEvent(e); if (!pos) return;
      const r = this.liftSelection(dragAnchor, pos);
      if (r) { this.ed.sel = { seq: r.seq, anchor: r.a, focus: r.f }; this.ed.cur = { seq: r.seq, i: r.f }; if (r.a === r.f) this.ed.sel = null; this.update(); }
    });
    window.addEventListener('mouseup', () => { dragAnchor = null; });
    this.host.addEventListener('dblclick', e => { e.preventDefault(); this.ed.selectAll(); this.update(); });
    // タッチ（スマホでカーソル移動）
    this.host.addEventListener('touchstart', e => {
      const t = e.touches[0]; if (!t) return;
      const pos = this.posFromPoint(t.clientX, t.clientY, document.elementFromPoint(t.clientX, t.clientY));
      if (pos) { this.ed.setCursor(pos.seq, pos.i); this.update(); }
    }, { passive: true });
  }
  posFromEvent(e) { return this.posFromPoint(e.clientX, e.clientY, e.target); }
  posFromPoint(x, y, target) {
    let t = target;
    while (t && t !== this.host && !this.map.has(t)) t = t.parentElement;
    if (!t || t === this.host) {
      // フィールド余白：末尾へ
      return { seq: this.ed.root, i: this.ed.root.items.length };
    }
    const info = this.map.get(t);
    if (info.empty) return { seq: info.seq, i: 0 };
    if (info.i === undefined) {
      // 列（Seq）の余白 → 一番近い要素
      const kids = [...t.children].filter(k => this.map.has(k) && this.map.get(k).i !== undefined);
      if (!kids.length) return { seq: info.seq, i: 0 };
      let best = info.seq.items.length;
      for (const k of kids) { const r = k.getBoundingClientRect(); if (x < r.left + r.width / 2) { best = this.map.get(k).i; break; } }
      return { seq: info.seq, i: best };
    }
    const r = t.getBoundingClientRect();
    return { seq: info.seq, i: x < r.left + r.width / 2 ? info.i : info.i + 1 };
  }
  liftSelection(a, b) {
    const up = (pos, seq) => {
      if (pos.seq === seq) return { i: pos.i, inside: false };
      let s = pos.seq;
      while (s.parent) { const node = s.parent; if (node.parent === seq) return { i: MathCore.idx(node), inside: true }; s = node.parent; }
      return null;
    };
    // a の列に b を持ち上げる
    let fb = up(b, a.seq);
    if (fb) { let f = fb.i; if (fb.inside && f >= a.i) f++; return { seq: a.seq, a: a.i, f }; }
    let fa = up(a, b.seq);
    if (fa) { let an = fa.i; if (fa.inside && b.i <= an) an++; return { seq: b.seq, a: an, f: b.i }; }
    const ra = up(a, this.ed.root), rb = up(b, this.ed.root);
    if (ra && rb) {
      let an = ra.i, f = rb.i;
      if (f >= an) { if (rb.inside) f++; } else { if (ra.inside) an++; }
      return { seq: this.ed.root, a: an, f };
    }
    return null;
  }
  onKey(e) {
    if (e.isComposing || this.composing || e.keyCode === 229) return;
    const ed = this.ed;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key;
    const handled = () => { e.preventDefault(); this.update(); };
    if (mod && !e.altKey) {
      const kl = k.toLowerCase();
      if (kl === 'z' && !e.shiftKey) { ed.undo(); return handled(); }
      if ((kl === 'z' && e.shiftKey) || kl === 'y') { ed.redo(); return handled(); }
      if (kl === 'a') { ed.selectAll(); return handled(); }
      if (k === 'Enter') { if (this.opts.onEnter(e, true)) e.preventDefault(); return; }
      return; // copy/paste/cut はブラウザに任せる
    }
    if (e.altKey && !mod) {
      const c = MathField.altChar(e.code, e.shiftKey);
      if (c) { ed.type(c); return handled(); }
    }
    switch (k) {
      case 'ArrowLeft': e.shiftKey ? ed.extendSel(-1) : ed.left(); return handled();
      case 'ArrowRight': e.shiftKey ? ed.extendSel(1) : ed.right(); return handled();
      case 'ArrowUp': ed.vert(-1); return handled();
      case 'ArrowDown': ed.vert(1); return handled();
      case 'Home': e.shiftKey ? (ed.sel = { seq: ed.cur.seq, anchor: ed.cur.i, focus: 0 }, ed.cur.i = 0) : ed.home(); return handled();
      case 'End': e.shiftKey ? (ed.sel = { seq: ed.cur.seq, anchor: ed.cur.i, focus: ed.cur.seq.items.length }, ed.cur.i = ed.cur.seq.items.length) : ed.end(); return handled();
      case 'Backspace': ed.backspace(); return handled();
      case 'Delete': ed.del(); return handled();
      case 'Tab': {
        const sg = ed.suggestions();
        if (!e.shiftKey && sg.length) { ed.applySuggestion(sg[0]); return handled(); }
        ed.tab(e.shiftKey); return handled();
      }
      case 'Enter': if (this.opts.onEnter(e, false)) { e.preventDefault(); this.update(); } else e.preventDefault(); return;
      case 'Escape': e.preventDefault(); this.opts.onEscape(); return;
    }
  }
  static altChar(code, shift) {
    const L = { KeyA: ['α', 'A'], KeyB: ['β', 'B'], KeyD: ['δ', 'Δ'], KeyE: ['e', 'e'], KeyF: ['φ', 'Φ'], KeyG: ['γ', 'Γ'], KeyI: ['i', 'i'],
      KeyL: ['λ', 'Λ'], KeyM: ['μ', 'M'], KeyN: ['ν', 'N'], KeyO: ['°', '°'], KeyP: ['π', 'Π'], KeyR: ['√', '√'], KeyS: ['σ', 'Σ'],
      KeyT: ['θ', 'Θ'], KeyU: ['∞', '∞'], KeyW: ['ω', 'Ω'], KeyX: ['ξ', 'Ξ'], KeyH: ['η', 'η'], KeyK: ['κ', 'κ'], KeyC: ['χ', 'χ'],
      KeyY: ['ψ', 'Ψ'], KeyZ: ['ζ', 'ζ'], KeyQ: ['ρ', 'ρ'], KeyV: ['ε', 'ε'], KeyJ: ['τ', 'τ'],
      Comma: ['≤', '≤'], Period: ['≥', '≥'], Minus: ['⁻', '⁻'], Equal: ['≠', '±'], Slash: ['÷', '÷'], Digit8: ['×', '⊗'] };
    if (L[code]) {
      const v = L[code][shift ? 1 : 0];
      return v;
    }
    const m = /^Digit(\d)$/.exec(code);
    if (m && !shift) return '⁰¹²³⁴⁵⁶⁷⁸⁹'[+m[1]];
    return null;
  }
}

'use strict';
/* =====================================================================
 *  TeX ソースの走査（数式領域）とプレビュー描画
 * ===================================================================== */
const TexDoc = (() => {
  const MATH_ENVS = new Set(['equation', 'equation*', 'align', 'align*', 'gather', 'gather*', 'multline', 'multline*',
    'eqnarray', 'eqnarray*', 'displaymath', 'math', 'flalign', 'flalign*', 'alignat', 'alignat*']);
  const NUMBERED = new Set(['equation', 'align', 'gather', 'multline', 'eqnarray', 'flalign', 'alignat']);
  const ROWED = new Set(['align', 'align*', 'gather', 'gather*', 'eqnarray', 'eqnarray*', 'flalign', 'flalign*', 'multline', 'multline*', 'alignat', 'alignat*']);

  /* ---------- 数式領域の走査（ハイライト・編集・プレビュー共通） ---------- */
  function scanMath(src) {
    const R = []; const n = src.length; let i = 0;
    while (i < n) {
      const c = src[i];
      if (c === '\\') {
        const nx = src[i + 1];
        if (nx === '[') { const e = src.indexOf('\\]', i + 2); const end = e < 0 ? n : e + 2; R.push({ start: i, end, cs: i + 2, ce: e < 0 ? n : e, kind: 'display', delim: '\\[' }); i = end; continue; }
        if (nx === '(') { const e = src.indexOf('\\)', i + 2); const end = e < 0 ? n : e + 2; R.push({ start: i, end, cs: i + 2, ce: e < 0 ? n : e, kind: 'inline', delim: '\\(' }); i = end; continue; }
        if (src.startsWith('begin{', i + 1)) {
          const vb = /^\\begin\{(verbatim|lstlisting|Verbatim|minted|comment)\}/.exec(src.slice(i, i + 30));
          if (vb) { const e = src.indexOf('\\end{' + vb[1] + '}', i + vb[0].length); i = e < 0 ? n : e + vb[1].length + 6; continue; }
          const m = /^\\begin\{([a-zA-Z]+\*?)\}/.exec(src.slice(i, i + 40));
          if (m && MATH_ENVS.has(m[1])) {
            const endTag = '\\end{' + m[1] + '}';
            let cs = i + m[0].length;
            if (m[1].startsWith('alignat')) { const g = /^\{[^}]*\}/.exec(src.slice(cs)); if (g) cs += g[0].length; }
            const e = src.indexOf(endTag, cs);
            const end = e < 0 ? n : e + endTag.length;
            R.push({ start: i, end, cs, ce: e < 0 ? n : e, kind: 'env', env: m[1] }); i = end; continue;
          }
        }
        i += 2; continue;
      }
      if (c === '%') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '$') {
        if (src[i + 1] === '$') { const e = src.indexOf('$$', i + 2); const end = e < 0 ? n : e + 2; R.push({ start: i, end, cs: i + 2, ce: e < 0 ? n : e, kind: 'display', delim: '$$' }); i = end; continue; }
        let j = i + 1;
        while (j < n && !(src[j] === '$' && src[j - 1] !== '\\')) { if (src[j] === '\n' && /^\n[ \t]*\n/.test(src.slice(j, j + 40))) break; j++; }
        const closed = j < n && src[j] === '$';
        R.push({ start: i, end: closed ? j + 1 : j, cs: i + 1, ce: j, kind: 'inline', delim: '$', open: !closed });
        i = closed ? j + 1 : j; continue;
      }
      i++;
    }
    return R;
  }
  function regionAt(regions, pos) {
    // カーソルが領域の内側（区切り記号の内側）にあるか
    for (const r of regions) if (pos > r.start && pos < r.end) return r;
    return null;
  }

  /* ---------- ハイライト ---------- */
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function hlText(s) {
    let o = '';
    const re = /(%[^\n]*)|(\\(?:section|subsection|subsubsection|paragraph|chapter|title|maketitle)\*?)|(\\(?:begin|end)\{[^}\n]*\})|(\\[a-zA-Z@]+\*?|\\.)|([{}])/g;
    let last = 0, m;
    while ((m = re.exec(s))) {
      o += esc(s.slice(last, m.index));
      const t = esc(m[0]);
      if (m[1]) o += '<span class="hl-com">' + t + '</span>';
      else if (m[2]) o += '<span class="hl-sec">' + t + '</span>';
      else if (m[3]) o += '<span class="hl-env">' + t + '</span>';
      else if (m[4]) o += '<span class="hl-cmd">' + t + '</span>';
      else o += '<span class="hl-brace">' + t + '</span>';
      last = re.lastIndex;
    }
    return o + esc(s.slice(last));
  }
  function hlMath(s) { return esc(s).replace(/\\[a-zA-Z]+|\\./g, x => '<span class="hl-cmd">' + x + '</span>'); }
  function highlight(src, regions, curRegion) {
    let out = '', pos = 0;
    for (const r of regions) {
      out += hlText(src.slice(pos, r.start));
      out += '<span class="hl-math' + (r === curRegion ? ' cur' : '') + '">' + hlMath(src.slice(r.start, r.end)) + '</span>';
      pos = r.end;
    }
    return out + hlText(src.slice(pos)) + '\n';
  }

  /* ---------- 文字列ユーティリティ ---------- */
  function matchBrace(src, i, open, close) { // src[i] === open
    let d = 0;
    for (let j = i; j < src.length; j++) {
      const c = src[j];
      if (c === '\\') { j++; continue; }
      if (c === '%') { while (j < src.length && src[j] !== '\n') j++; continue; }
      if (c === open) d++;
      else if (c === close) { d--; if (d === 0) return j; }
    }
    return src.length;
  }
  function skipWs(src, i) { while (i < src.length && /[ \t]/.test(src[i])) i++; return i; }
  function readArg(src, i) {
    let j = skipWs(src, i);
    if (src[j] === '\n') j = skipWs(src, j + 1);
    if (src[j] === '{') { const e = matchBrace(src, j, '{', '}'); return { a: j + 1, b: e, end: e + 1, ok: true }; }
    if (src[j] === '\\') { const m = /^\\([a-zA-Z]+|.)/.exec(src.slice(j)); const L = m ? m[0].length : 1; return { a: j, b: j + L, end: j + L, ok: true }; }
    if (j < src.length) return { a: j, b: j + 1, end: j + 1, ok: true };
    return { a: j, b: j, end: j, ok: false };
  }
  function readOpt(src, i) {
    const j = skipWs(src, i);
    if (src[j] === '[') { const e = matchBrace(src, j, '[', ']'); return { a: j + 1, b: e, end: e + 1, ok: true }; }
    return { a: i, b: i, end: i, ok: false };
  }
  function findEnd(src, i, env) { // i: \begin{env} の直後
    const re = /\\(begin|end)\{([^}]*)\}/g; re.lastIndex = i; let d = 1, m;
    while ((m = re.exec(src))) {
      if (m[2] === env) { if (m[1] === 'begin') d++; else { d--; if (d === 0) return { a: m.index, end: re.lastIndex }; } }
    }
    return { a: src.length, end: src.length };
  }
  function splitTop(s, sepRe) { // 波括弧・環境の外側で分割
    const parts = []; let depth = 0, envd = 0, last = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '\\') {
        if (s.startsWith('\\begin{', i)) envd++;
        else if (s.startsWith('\\end{', i)) envd--;
        if (depth === 0 && envd === 0) {
          const m = sepRe.exec(s.slice(i)); if (m && m.index === 0) { parts.push(s.slice(last, i)); i += m[0].length - 1; last = i + 1; continue; }
        }
        i++; continue;
      }
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (depth === 0 && envd === 0) { const m = sepRe.exec(s.slice(i)); if (m && m.index === 0) { parts.push(s.slice(last, i)); i += m[0].length - 1; last = i + 1; } }
    }
    parts.push(s.slice(last));
    return parts;
  }

  /* ---------- プレビュー描画 ---------- */
  const THM = { theorem: '定理', lemma: '補題', proposition: '命題', corollary: '系', definition: '定義', example: '例', remark: '注意', note: '注', problem: '問題', exercise: '演習', claim: '主張', assumption: '仮定', conjecture: '予想' };
  const NOOP_CMDS = new Set(['centering', 'noindent', 'indent', 'small', 'large', 'Large', 'LARGE', 'huge', 'Huge', 'normalsize', 'footnotesize', 'scriptsize', 'tiny', 'bfseries', 'itshape', 'rmfamily', 'sffamily', 'ttfamily', 'mdseries', 'upshape', 'normalfont', 'hfill', 'vfill', 'protect', 'relax', 'smallskip', 'medskip', 'bigskip', 'raggedright', 'raggedleft', 'nonumber', 'notag', 'appendix', 'frontmatter', 'mainmatter', 'backmatter', 'selectfont', 'null', 'onecolumn', 'twocolumn', 'hline', 'toprule', 'midrule', 'bottomrule', 'and', 'quad', 'qquad']);
  const SKIPARG = { vspace: 1, hspace: 1, 'vspace*': 1, 'hspace*': 1, setlength: 2, addtolength: 2, setcounter: 2, addtocounter: 2, newcommand: 2, renewcommand: 2, usepackage: 1, documentclass: 1, pagestyle: 1, thispagestyle: 1, bibliographystyle: 1, bibliography: 1, input: 1, include: 1, graphicspath: 1, newtheorem: 2, title: 1, author: 1, date: 1, fontsize: 2, linespread: 1, color: 1, definecolor: 3, geometry: 1, hypersetup: 1, numberwithin: 2, DeclareMathOperator: 2, label: 1 };

  function render(src, host) {
    const st = {
      src, eq: 0, sec: [0, 0, 0, 0], labels: {}, fig: 0, tab: 0, foot: [], heads: [], tocEls: [], float: null, refs: [],
      curLabelTarget: null, title: null, author: null, date: null
    };
    // プリアンブル
    const bd = src.indexOf('\\begin{document}');
    let a = 0, b = src.length;
    const preamble = bd >= 0 ? src.slice(0, bd) : '';
    if (bd >= 0) { a = bd + '\\begin{document}'.length; const e = src.indexOf('\\end{document}', a); if (e >= 0) b = e; }
    else {
      // document 環境がない断片: \title 等も本文から拾う
    }
    for (const k of ['title', 'author', 'date']) {
      const scope = bd >= 0 ? preamble : src;
      const idx = scope.search(new RegExp('\\\\' + k + '\\s*\\{'));
      if (idx >= 0) {
        const lineStart = scope.lastIndexOf('\n', idx) + 1;
        if (!/%/.test(scope.slice(lineStart, idx))) {
          const g = readArg(scope, idx + k.length + 1);
          st[k] = { a: g.a, b: g.b, base: 0, s: scope };
        }
      }
    }
    const frag = document.createDocumentFragment();
    const ctx = { st, src };
    flow(ctx, a, b, frag, false);
    // 脚注
    if (st.foot.length) {
      const fd = el('div', 'pv-footnotes');
      st.foot.forEach((f, k) => { const p = el('div'); p.appendChild(el('span', 'pv-fn', String(k + 1))); p.appendChild(document.createTextNode(' ')); p.appendChild(f); fd.appendChild(p); });
      frag.appendChild(fd);
    }
    // 参照の解決
    for (const r of st.refs) {
      const v = st.labels[r.key];
      r.el.textContent = v ? (r.paren ? '(' + v + ')' : v) : (r.paren ? '(??)' : '??');
      if (!v) { r.el.classList.add('bad'); r.el.title = 'ラベル「' + r.key + '」が見つかりません'; }
    }
    // 目次
    for (const t of st.tocEls) {
      t.appendChild(el('div', 'toc-h', '目次'));
      for (const h of st.heads) { const d = el('div'); d.style.paddingLeft = (h.level - 1) * 1.4 + 'em'; d.textContent = (h.num ? h.num + '  ' : '') + h.text; t.appendChild(d); }
    }
    host.replaceChildren(frag);
    if (!host.textContent.trim() && !host.querySelector('.pv-math')) host.appendChild(el('div', 'empty-hint', '左にLaTeXを書くか、ツールバーの「＋ 数式」から始めましょう'));
    return st;
  }
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function mathEl(ctx, r, display) {
    const content = ctx.src.slice(r.cs, r.ce);
    const wrap = el(display ? 'div' : 'span', display ? 'pv-display pv-blk' : 'pv-math');
    wrap.dataset.ms = r.start; wrap.dataset.me = r.end; wrap.dataset.s = r.start;
    try {
      if (!display) { wrap.appendChild(MathRender.renderLatex(content, { display: false })); return wrap; }
      const st = ctx.st;
      const env = r.env || '';
      const numbered = NUMBERED.has(env);
      const body = el('div', 'eqbody pv-math'); body.dataset.ms = r.start; body.dataset.me = r.end;
      const noTag = el('div', 'eqpad');
      if (ROWED.has(env)) {
        const rows = splitTop(content, /^\\\\(\[[^\]]*\])?/).filter((x, k, arr) => !(k === arr.length - 1 && !x.trim()));
        const grid = el('div', 'pv-align');
        const isGather = env.startsWith('gather') || env.startsWith('multline');
        let maxCols = 1;
        const cellsPerRow = rows.map(row => isGather ? [row] : splitTop(row, /^&/));
        cellsPerRow.forEach(c => maxCols = Math.max(maxCols, c.length));
        grid.style.gridTemplateColumns = `repeat(${maxCols}, auto) auto`;
        grid.style.justifyContent = 'stretch';
        grid.style.gridTemplateColumns = `1fr repeat(${maxCols}, auto) 1fr`;
        cellsPerRow.forEach((cells, ri) => {
          const rowSrc = rows[ri];
          grid.appendChild(el('span'));
          for (let ci = 0; ci < maxCols; ci++) {
            const c = el('span', isGather ? 'ac' : (ci % 2 === 0 ? 'ar' : 'al'));
            if (cells[ci] != null) c.appendChild(MathRender.renderLatex(cells[ci], { display: true }));
            grid.appendChild(c);
          }
          const no = el('span', 'eqno');
          const tag = /\\tag\*?\{([^}]*)\}/.exec(rowSrc);
          const suppressed = /\\(nonumber|notag)\b/.test(rowSrc) || (env.startsWith('multline') && ri !== rows.length - 1);
          let label = null;
          if (tag) label = tag[1];
          else if (numbered && !suppressed) { st.eq++; label = String(st.eq); }
          if (label) no.textContent = '(' + label + ')';
          const lb = /\\label\{([^}]*)\}/.exec(rowSrc);
          if (lb && label) st.labels[lb[1]] = label;
          grid.appendChild(no);
        });
        body.appendChild(grid);
        wrap.append(body);
        return wrap;
      }
      let inner = content;
      const tag = /\\tag\*?\{([^}]*)\}/.exec(inner);
      let label = null;
      if (tag) label = tag[1];
      else if (numbered) { st.eq++; label = String(st.eq); }
      const lb = /\\label\{([^}]*)\}/.exec(inner);
      if (lb && label) st.labels[lb[1]] = label;
      inner = inner.replace(/\\label\{[^}]*\}/g, '').replace(/\\tag\*?\{[^}]*\}/g, '');
      body.appendChild(MathRender.renderLatex(inner, { display: true }));
      const no = el('div', 'eqno', label ? '(' + label + ')' : '');
      wrap.append(noTag, body, no);
    } catch (e) {
      wrap.appendChild(el('span', 'pv-err', content));
    }
    return wrap;
  }

  // 本文の流し込み。inlineOnly=true なら段落を作らない
  function flow(ctx, a, b, host, inlineOnly) {
    const src = ctx.src, st = ctx.st;
    const regions = ctx.regions || (ctx.regions = scanMath(src));
    const regAt = new Map(); for (const r of regions) regAt.set(r.start, r);
    let para = null;
    const target = () => {
      if (inlineOnly) return host;
      if (!para) { para = el('p', 'pv-blk'); para.dataset.s = pendingStart; host.appendChild(para); }
      return para;
    };
    let pendingStart = a;
    const closePara = () => {
      if (para && !para.textContent.trim() && !para.querySelector('.pv-math,img,br')) para.remove();
      para = null;
    };
    const block = e => { if (inlineOnly) { host.appendChild(e); return; } closePara(); host.appendChild(e); };
    const text = s => { if (!s) return; const t = target(); const last = t.lastChild; if (last && last.nodeType === 3) last.data += s; else t.appendChild(document.createTextNode(s)); };
    const inlineGroup = (cls, ga, gb, tag) => { const sp = el(tag || 'span', cls); flow(ctx, ga, gb, sp, true); target().appendChild(sp); return sp; };
    let i = a;
    while (i < b) {
      const c = src[i];
      const r = regAt.get(i);
      if (r && r.end <= b + 0) {
        if (r.kind === 'inline') target().appendChild(mathEl(ctx, r, false));
        else block(mathEl(ctx, r, true));
        i = r.end; pendingStart = i; continue;
      }
      if (c === '%') { while (i < b && src[i] !== '\n') i++; i++; while (i < b && /[ \t]/.test(src[i])) i++; continue; }
      if (c === '\n') {
        const m = /^\n[ \t]*\n\s*/.exec(src.slice(i, Math.min(b, i + 200)));
        if (m && !inlineOnly) { closePara(); i += m[0].length; pendingStart = i; continue; }
        text(' '); i++; while (i < b && /[ \t]/.test(src[i])) i++; continue;
      }
      if (c === '{' || c === '}') { i++; continue; }
      if (c === '~') { text('\u00a0'); i++; continue; }
      if (c === '-' && src[i + 1] === '-') { if (src[i + 2] === '-') { text('—'); i += 3; } else { text('–'); i += 2; } continue; }
      if (c === '`' && src[i + 1] === '`') { text('“'); i += 2; continue; }
      if (c === "'" && src[i + 1] === "'") { text('”'); i += 2; continue; }
      if (c === '&') { text(' '); i++; continue; }
      if (c === '\\') {
        const m = /^\\([a-zA-Z@]+\*?|.)/.exec(src.slice(i, i + 60));
        if (!m) { i++; continue; }
        const name = m[1]; const start = i;
        i += m[0].length;
        // 1文字エスケープ
        if (name.length === 1 && !/[a-zA-Z]/.test(name)) {
          if (name === '\\') { const o = readOpt(src, i); i = o.end; target().appendChild(el('br')); continue; }
          if ('%&#$_{}'.includes(name)) { text(name); continue; }
          if (name === ' ' || name === ',' || name === ';') { text(name === ' ' ? ' ' : '\u2009'); continue; }
          if (name === '-' || name === '/') continue;
          text(name); continue;
        }
        if (/^[a-zA-Z]+$/.test(name)) while (i < b && /[ \t]/.test(src[i])) i++;
        const base = name.replace(/\*$/, '');
        switch (base) {
          case 'part': case 'chapter': case 'section': case 'subsection': case 'subsubsection': case 'paragraph': {
            const opt = readOpt(src, i); const g = readArg(src, opt.end); i = g.end;
            const level = { part: 0, chapter: 0, section: 1, subsection: 2, subsubsection: 3, paragraph: 4 }[base];
            const starred = name.endsWith('*');
            let num = '';
            if (!starred && level >= 1 && level <= 3) {
              st.sec[level - 1]++; for (let q = level; q < 4; q++) st.sec[q] = 0;
              num = st.sec.slice(0, level).join('.');
              st.curLabelTarget = num;
            }
            const h = el(level <= 1 ? 'h2' : level === 2 ? 'h3' : 'h4', 'pv-blk'); h.dataset.s = start;
            if (num) h.appendChild(el('span', 'secnum', num));
            const t = el('span'); flow(ctx, g.a, g.b, t, true); h.appendChild(t);
            block(h); st.heads.push({ level: Math.max(1, level), num, text: t.textContent });
            pendingStart = i; continue;
          }
          case 'maketitle': {
            const tb = el('div', 'pv-titleblock pv-blk'); tb.dataset.s = start;
            for (const k of ['title', 'author', 'date']) {
              const v = st[k];
              if (!v) { if (k === 'date') { const d = el('div', 'pv-date', today()); tb.appendChild(d); } continue; }
              const e = el(k === 'title' ? 'h1' : 'div', 'pv-' + k);
              const sub = { src: v.s, st, regions: null };
              flow(sub, v.a, v.b, e, true);
              tb.appendChild(e);
            }
            block(tb); continue;
          }
          case 'tableofcontents': { const t = el('div', 'pv-toc pv-blk'); t.dataset.s = start; st.tocEls.push(t); block(t); continue; }
          case 'begin': {
            const g = readArg(src, i); const env = src.slice(g.a, g.b).trim(); i = g.end;
            const E = findEnd(src, i, env);
            const innerA = i, innerB = E.a; i = E.end;
            renderEnv(ctx, env, innerA, innerB, start, block, target);
            pendingStart = i; continue;
          }
          case 'end': { const g = readArg(src, i); i = g.end; continue; }
          case 'item': { const o = readOpt(src, i); i = o.end; text('• '); continue; }
          case 'textbf': case 'bf': { const g = readArg(src, i); i = g.end; inlineGroup('', g.a, g.b, 'b'); continue; }
          case 'textit': case 'emph': case 'textsl': case 'it': { const g = readArg(src, i); i = g.end; inlineGroup('', g.a, g.b, base === 'emph' ? 'em' : 'i'); continue; }
          case 'underline': case 'uline': { const g = readArg(src, i); i = g.end; inlineGroup('', g.a, g.b, 'u'); continue; }
          case 'texttt': case 'verb': { const g = readArg(src, i); i = g.end; inlineGroup('tt', g.a, g.b); continue; }
          case 'textsc': { const g = readArg(src, i); i = g.end; inlineGroup('sc', g.a, g.b); continue; }
          case 'textsf': case 'textrm': case 'textup': case 'textmd': case 'textnormal': case 'mbox': case 'text': case 'makebox': case 'fbox': case 'hbox': { const g = readArg(src, i); i = g.end; inlineGroup('', g.a, g.b); continue; }
          case 'footnote': {
            const g = readArg(src, i); i = g.end;
            const f = el('span'); flow(ctx, g.a, g.b, f, true); st.foot.push(f);
            target().appendChild(el('span', 'pv-fn', String(st.foot.length))); continue;
          }
          case 'url': { const g = readArg(src, i); i = g.end; const u = src.slice(g.a, g.b); const aEl = el('a', '', u); aEl.href = u; aEl.target = '_blank'; aEl.rel = 'noopener'; target().appendChild(aEl); continue; }
          case 'href': { const g = readArg(src, i); const g2 = readArg(src, g.end); i = g2.end; const aEl = el('a'); aEl.href = src.slice(g.a, g.b); aEl.target = '_blank'; aEl.rel = 'noopener'; flow(ctx, g2.a, g2.b, aEl, true); target().appendChild(aEl); continue; }
          case 'ref': case 'eqref': case 'pageref': case 'autoref': case 'cref': case 'Cref': {
            const g = readArg(src, i); i = g.end; const key = src.slice(g.a, g.b).trim();
            const sp = el('span', 'pv-ref'); target().appendChild(sp); st.refs.push({ key, el: sp, paren: base === 'eqref' }); continue;
          }
          case 'label': {
            const g = readArg(src, i); i = g.end; const key = src.slice(g.a, g.b).trim();
            if (st.curLabelTarget != null && !(key in st.labels)) st.labels[key] = st.curLabelTarget; continue;
          }
          case 'cite': { const o = readOpt(src, i); const g = readArg(src, o.end); i = g.end; text('[' + src.slice(g.a, g.b) + (o.ok ? ', ' + src.slice(o.a, o.b) : '') + ']'); continue; }
          case 'caption': {
            const o = readOpt(src, i); const g = readArg(src, o.end); i = g.end;
            const kind = st.float || 'figure';
            const n = kind === 'table' ? ++st.tab : ++st.fig;
            st.curLabelTarget = String(n);
            const cap = el('div', 'pv-caption'); cap.appendChild(document.createTextNode((kind === 'table' ? '表' : '図') + n + ': '));
            flow(ctx, g.a, g.b, cap, true);
            block(cap); continue;
          }
          case 'includegraphics': { const o = readOpt(src, i); const g = readArg(src, o.end); i = g.end; const box = el('span', 'pv-img', '🖼 ' + src.slice(g.a, g.b)); target().appendChild(box); continue; }
          case 'par': closePara(); pendingStart = i; continue;
          case 'newline': case 'linebreak': case 'break': target().appendChild(el('br')); continue;
          case 'newpage': case 'clearpage': case 'pagebreak': case 'cleardoublepage': { const hr = el('hr', 'pv-pagebreak'); hr.title = '改ページ'; block(hr); continue; }
          case 'LaTeX': text('LaTeX'); continue;
          case 'TeX': text('TeX'); continue;
          case 'LaTeXe': text('LaTeX2ε'); continue;
          case 'today': text(today()); continue;
          case 'ldots': case 'dots': text('…'); continue;
          case 'textbackslash': text('\\'); continue;
          case 'S': text('§'); continue;
          case 'P': text('¶'); continue;
          case 'copyright': text('©'); continue;
          case 'yen': text('¥'); continue;
          case 'textasciitilde': text('~'); continue;
          case 'textdegree': case 'degree': text('°'); continue;
          case 'bibitem': { const o = readOpt(src, i); const g = readArg(src, o.end); i = g.end; closePara(); text('[' + (o.ok ? src.slice(o.a, o.b) : src.slice(g.a, g.b)) + '] '); continue; }
        }
        if (NOOP_CMDS.has(base)) continue;
        if (SKIPARG[base]) { let k = SKIPARG[base]; if (base === 'newcommand' || base === 'renewcommand') { const g0 = readArg(src, i); i = g0.end; const o = readOpt(src, i); i = o.end; k = 1; } for (let q = 0; q < k; q++) { const o = readOpt(src, i); i = o.end; const g = readArg(src, i); i = g.end; } continue; }
        // 未知の命令: 引数をそのまま流す
        let j = skipWs(src, i);
        if (src[j] === '{') { const g = readArg(src, j); i = g.end; inlineGroup('', g.a, g.b); continue; }
        const u = el('span', 'pv-unknown', '\\' + name); u.title = 'プレビュー非対応の命令（LaTeXでは処理されます）'; target().appendChild(u);
        continue;
      }
      // ふつうの文字
      let j = i + 1;
      while (j < b && !'\\%\n{}~-`\'$&'.includes(src[j]) && !regAt.has(j)) j++;
      text(src.slice(i, j)); i = j;
    }
    closePara();
  }

  function renderEnv(ctx, env, a, b, start, block, target) {
    const src = ctx.src, st = ctx.st;
    const base = env.replace(/\*$/, '');
    const box = (cls) => { const d = el('div', cls + ' pv-blk'); d.dataset.s = start; return d; };
    if (base === 'itemize' || base === 'enumerate' || base === 'description') {
      const list = el(base === 'enumerate' ? 'ol' : base === 'description' ? 'dl' : 'ul', 'pv-blk'); list.dataset.s = start;
      // \item で分割
      const items = []; const re = /\\(begin|end)\{[^}]*\}|\\item\b/g; let d = 0, m; re.lastIndex = a;
      while ((m = re.exec(src)) && m.index < b) {
        if (m[1] === 'begin') d++; else if (m[1] === 'end') d--;
        else if (d === 0) items.push(m.index);
      }
      items.forEach((p, k) => {
        let s = p + 5; const e = k + 1 < items.length ? items[k + 1] : b;
        const o = readOpt(src, s);
        let labelEl = null;
        if (o.ok) { labelEl = el(base === 'description' ? 'dt' : 'b'); flow(ctx, o.a, o.b, labelEl, true); s = o.end; }
        if (base === 'description') { if (labelEl) list.appendChild(labelEl); const dd = el('dd'); flow(ctx, s, e, dd, false); list.appendChild(dd); }
        else {
          const li = el('li');
          if (labelEl) { li.style.listStyle = 'none'; li.appendChild(labelEl); li.appendChild(document.createTextNode(' ')); }
          const inner = el('div'); flow(ctx, s, e, inner, false);
          // 1段落だけなら p を外す
          if (inner.children.length === 1 && inner.firstChild.tagName === 'P') { while (inner.firstChild.firstChild) li.appendChild(inner.firstChild.firstChild); }
          else li.appendChild(inner);
          list.appendChild(li);
        }
      });
      block(list); return;
    }
    if (THM[base] || base === 'proof') {
      const d = box(base === 'proof' ? 'pv-proof' : 'pv-thm');
      const o = readOpt(src, a);
      let head = base === 'proof' ? '証明' : THM[base];
      if (base !== 'proof') { st.thm = (st.thm || 0) + 1; if (!env.endsWith('*')) head += ' ' + st.thm; st.curLabelTarget = String(st.thm); }
      const hs = el('span', 'thmhead', head + (o.ok ? '' : '.'));
      if (o.ok) { hs.appendChild(document.createTextNode(' (')); const t = el('span'); flow(ctx, o.a, o.b, t, true); hs.appendChild(t); hs.appendChild(document.createTextNode(').')); }
      const inner = el('div'); flow(ctx, o.end, b, inner, false);
      if (inner.firstChild && inner.firstChild.tagName === 'P') { inner.firstChild.classList.add('noindent'); inner.firstChild.prepend(hs); } else d.appendChild(hs);
      d.appendChild(inner);
      if (base === 'proof') d.appendChild(el('div', 'qed', '□'));
      block(d); return;
    }
    if (base === 'abstract') { const d = box('pv-abstract'); d.appendChild(el('div', 'abs-h', '概要')); flow(ctx, a, b, d, false); block(d); return; }
    if (base === 'quote' || base === 'quotation' || base === 'verse') { const d = box('pv-quote'); flow(ctx, a, b, d, false); block(d); return; }
    if (base === 'center' || base === 'flushleft' || base === 'flushright') { const d = box('pv-center'); if (base !== 'center') d.style.textAlign = base === 'flushleft' ? 'left' : 'right'; flow(ctx, a, b, d, false); block(d); return; }
    if (base === 'figure' || base === 'table' || base === 'wrapfigure') {
      const d = box('pv-float'); const save = st.float; st.float = base === 'table' ? 'table' : 'figure';
      const o = readOpt(src, a); flow(ctx, o.end, b, d, false); st.float = save; block(d); return;
    }
    if (base === 'tabular' || base === 'tabularx' || base === 'array' || base === 'longtable') {
      let p = a; if (base === 'tabularx') { p = readArg(src, p).end; }
      const o = readOpt(src, p); const spec = readArg(src, o.end); p = spec.end;
      const specS = src.slice(spec.a, spec.b);
      const cols = []; let vl = false;
      for (let k = 0; k < specS.length; k++) {
        const ch = specS[k];
        if (ch === '|') { if (cols.length) cols[cols.length - 1].vr = true; else vl = true; continue; }
        if ('lcrXpmb'.includes(ch)) { cols.push({ al: ch === 'r' ? 'right' : ch === 'c' ? 'center' : 'left', vl: cols.length === 0 ? vl : false }); if ('pmb'.includes(ch)) { const g = readArg(specS, k + 1); k = g.end - 1; } continue; }
        if (ch === '@' || ch === '>' || ch === '<' || ch === '*') { const g = readArg(specS, k + 1); k = g.end - 1; }
      }
      const t = el('table', 'pv-tab pv-blk'); t.dataset.s = start;
      const body = src.slice(p, b);
      const rows = splitTop(body, /^\\\\(\[[^\]]*\])?/);
      let pendingTop = false, rpos = p;
      rows.forEach((rowS, ri) => {
        const rowStart = src.indexOf(rowS, rpos); rpos = rowStart >= 0 ? rowStart + rowS.length : rpos;
        let s = rowS;
        let top = pendingTop; pendingTop = false;
        s = s.replace(/^\s*(\\(hline|toprule|midrule|bottomrule|cline\{[^}]*\})\s*)+/, () => { top = true; return ''; });
        if (/\\(hline|bottomrule|midrule)\s*$/.test(s)) { pendingTop = true; s = s.replace(/(\\(hline|bottomrule|midrule)\s*)+$/, ''); }
        if (!s.trim() && ri === rows.length - 1) { if (top && t.lastChild) t.lastChild.classList.add('hl-bot'); return; }
        const tr = el('tr'); if (top) tr.classList.add('hl-top');
        const cells = splitTop(s, /^&/);
        let cpos = rowStart >= 0 ? rowStart + (rowS.length - s.length - (rowS.length - rowS.indexOf(s) - s.length)) : p;
        if (rowStart >= 0) cpos = rowStart + rowS.indexOf(s);
        cells.forEach((cs, ci) => {
          const td = el('td'); const col = cols[ci] || { al: 'left' };
          td.style.textAlign = col.al; if (col.vl) td.classList.add('vl'); if (col.vr) td.classList.add('vr');
          const mc = /^\s*\\multicolumn\{(\d+)\}\{([^}]*)\}\{/.exec(cs);
          const cellStart = src.indexOf(cs, cpos);
          if (cellStart >= 0) cpos = cellStart + cs.length;
          if (mc && cellStart >= 0) { td.colSpan = +mc[1]; td.style.textAlign = mc[2].includes('c') ? 'center' : mc[2].includes('r') ? 'right' : 'left'; const g = readArg(src, cellStart + mc[0].length - 1); flow(ctx, g.a, g.b, td, true); }
          else if (cellStart >= 0) flow(ctx, cellStart, cellStart + cs.length, td, true);
          else td.textContent = cs;
          tr.appendChild(td);
        });
        t.appendChild(tr);
      });
      if (pendingTop && t.lastChild) t.lastChild.classList.add('hl-bot');
      block(t); return;
    }
    if (base === 'verbatim' || base === 'lstlisting' || base === 'minted' || base === 'Verbatim') {
      const pre = el('pre', 'pv-verb pv-blk', src.slice(a, b).replace(/^\n/, '')); pre.dataset.s = start; block(pre); return;
    }
    if (base === 'thebibliography') { const d = box('pv-env'); d.appendChild(el('h3', '', '参考文献')); const g = readArg(src, a); flow(ctx, g.end, b, d, false); block(d); return; }
    if (base === 'minipage') { const o = readOpt(src, a); const g = readArg(src, o.end); const d = box('pv-env'); d.style.display = 'inline-block'; d.style.verticalAlign = 'top'; flow(ctx, g.end, b, d, false); block(d); return; }
    const d = box('pv-env'); flow(ctx, a, b, d, false); block(d);
  }
  function today() { const d = new Date(); return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日'; }

  return { scanMath, regionAt, highlight, render, MATH_ENVS, NUMBERED, readArg, readOpt, matchBrace, findEnd, splitTop };
})();

if (typeof module !== 'undefined') module.exports = TexDoc;

'use strict';
/* =====================================================================
 *  DocModel : LaTeX ⇄ ブロック構造（Word風編集のための文書モデル）
 *   doc = { preamble, title[], author[], date[], maketitle, blocks[], tail, fragment }
 *   block: p / h / list / eq / table / raw     inline run: text / math / ref / raw / br
 * ===================================================================== */
const DocModel = (() => {
  const T = (typeof TexDoc !== 'undefined') ? TexDoc : require('./preview.js');
  const DEFAULT_PRE = '\\documentclass[a4paper,11pt]{ltjsarticle}\n\\usepackage{amsmath,amssymb}\n\\usepackage{bm}\n';
  const CJK = /[\u3000-\u30ff\u3400-\u9fff\uff00-\uffef]/;
  const HEAD = { part: 1, chapter: 1, section: 1, subsection: 2, subsubsection: 3, paragraph: 3 };
  const MARKS = ['b', 'i', 'u', 'tt', 'sc', 'sup', 'sub', 'color'];
  const THM = { theorem: '定理', lemma: '補題', proposition: '命題', corollary: '系', definition: '定義', example: '例', remark: '注意' };
  const THM_DEF_STYLE = new Set(['definition', 'example', 'remark']);
  const BOX_ENVS = new Set(['abstract', 'quote', 'quotation', 'verse', 'center', 'flushleft', 'flushright', 'proof', ...Object.keys(THM)]);
  const CODE_ENVS = new Set(['verbatim', 'lstlisting', 'Verbatim']);
  const sameMarks = (a, b) => MARKS.every(k => (a[k] || false) === (b[k] || false));
  const INLINE_CMDS = new Set(['textbf', 'textit', 'emph', 'underline', 'textsl', 'ref', 'eqref', 'autoref', 'cref', 'Cref', 'pageref',
    'cite', 'footnote', 'texttt', 'textsf', 'textrm', 'textsc', 'url', 'href', 'LaTeX', 'TeX', 'today', 'ldots', 'dots', 'mbox', 'text', 'textcolor', 'ruby', 'kenten', 'textsuperscript', 'textsubscript', 'noindent']);

  /* ---------------- 出力 ---------------- */
  function escText(s) {
    return s.replace(/\u200b/g, '').replace(/[\\{}$&%#_^~\u00a0]/g, c => ({
      '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '$': '\\$', '&': '\\&', '%': '\\%', '#': '\\#', '_': '\\_',
      '^': '\\^{}', '~': '\\textasciitilde{}', '\u00a0': '~'
    })[c]);
  }
  function inlineToTex(runs) {
    let out = '';
    const push = s => {
      if (!s) return;
      if (/\\[a-zA-Z]+$/.test(out) && /^[a-zA-Z]/.test(s)) out += '{}';
      out += s;
    };
    for (const r of runs || []) {
      if (r.t === 'text') {
        let s = escText(r.s);
        if (!s) continue;
        push(wrapMarks(s, r));
      } else if (r.t === 'math') push('$' + r.tex + '$');
      else if (r.t === 'link') {
        const txt = inlineToTex(r.inl);
        const u = r.url.replace(/([%#])/g, '\\$1');
        push(wrapMarks(r.plain || txt === escText(r.url) || !txt ? '\\url{' + r.url + '}' : '\\href{' + u + '}{' + txt + '}', r));
      }
      else if (r.t === 'cite') push('\\cite' + (r.opt ? '[' + r.opt + ']' : '') + '{' + r.key + '}');
      else if (r.t === 'fn') push('\\footnote{' + (r.tex || '') + '}');
      else if (r.t === 'ref') push('\\' + (r.cmd || 'ref') + '{' + r.key + '}');
      else if (r.t === 'raw') push(r.tex);
      else if (r.t === 'br') out += '\\\\\n';
    }
    return out;
  }
  function wrapMarks(s, r) {
    if (r.tt) s = '\\texttt{' + s + '}';
    if (r.sc) s = '\\textsc{' + s + '}';
    if (r.sup) s = '\\textsuperscript{' + s + '}';
    if (r.sub) s = '\\textsubscript{' + s + '}';
    if (r.u) s = '\\underline{' + s + '}';
    if (r.i) s = '\\' + (typeof r.i === 'string' ? r.i : 'emph') + '{' + s + '}';
    if (r.b) s = '\\textbf{' + s + '}';
    if (r.color) s = '\\textcolor{' + r.color + '}{' + s + '}';
    return s;
  }
  function indentLines(s, ind) { return s.split('\n').map(l => ind + l.trim()).join('\n'); }
  function eqToTex(e) {
    const tex = (e.tex || '').trim();
    switch (e.mode) {
      case 'display':
        if (e.delim === '$$') return '$$' + tex + '$$';
        if (e.env) return '\\begin{' + e.env + '}' + (e.label ? '\\label{' + e.label + '}' : '') + '\n' + indentLines(tex, '  ') + '\n\\end{' + e.env + '}';
        return '\\[\n' + indentLines(tex, '  ') + '\n\\]';
      case 'equation':
        return '\\begin{equation}' + (e.label ? '\\label{' + e.label + '}' : '') + '\n' + indentLines(tex, '  ') + '\n\\end{equation}';
      case 'align': {
        let env = e.env && !/^align/.test(e.env) ? e.env.replace(/\*$/, '') : 'align';
        if (e.numbered === false) env += '*';
        return '\\begin{' + env + '}\n' + indentLines(tex, '  ') + '\n\\end{' + env + '}';
      }
      default:
        return '\\begin{' + e.env + '}' + e.tex + '\\end{' + e.env + '}';
    }
  }
  function listToTex(l, ind) {
    const env = l.desc ? 'description' : l.ordered ? 'enumerate' : 'itemize';
    const lines = [ind + '\\begin{' + env + '}'];
    for (const it of l.items) {
      const opt = l.desc ? (it.optInl && it.optInl.length ? '[' + inlineToTex(it.optInl) + ']' : '') : (it.opt != null ? '[' + it.opt + ']' : '');
      lines.push(ind + '  \\item' + opt + ' ' + inlineToTex(it.inl));
      if (it.sub) lines.push(listToTex(it.sub, ind + '  '));
    }
    lines.push(ind + '\\end{' + env + '}');
    return lines.join('\n');
  }
  function tableSpec(t) {
    const n = Math.max(1, ...t.rows.map(r => r.length));
    if (t.spec && /^[lcr|\s]*$/.test(t.spec)) {
      const cols = t.spec.replace(/[|\s]/g, '');
      if (cols.length === n) return t.spec;
      const bars = t.spec.includes('|');
      const al = Array.from({ length: n }, (_, k) => cols[k] || 'c');
      return bars ? (t.spec.trim().startsWith('|') ? '|' : '') + al.join('|') + (t.spec.trim().endsWith('|') ? '|' : '') : al.join('');
    }
    return t.spec || 'c'.repeat(n);
  }
  function tableToTex(t) {
    const L = [];
    const ind = t.float ? '  ' : (t.center ? '  ' : '');
    if (t.float) { L.push('\\begin{table}' + (t.placement != null ? '[' + t.placement + ']' : '[h]')); L.push('  \\centering'); }
    else if (t.center) L.push('\\begin{center}');
    const cap = t.caption && t.caption.length ? ind + '\\caption{' + inlineToTex(t.caption) + '}' : null;
    if (cap && !t.capBelow) { L.push(cap); if (t.label) L.push(ind + '\\label{' + t.label + '}'); }
    L.push(ind + '\\begin{tabular}{' + tableSpec(t) + '}');
    const hl = new Set(t.hlines || []);
    t.rows.forEach((row, k) => {
      if (hl.has(k)) L.push(ind + '  \\hline');
      L.push(ind + '  ' + row.map(c => inlineToTex(c)).join(' & ') + ' \\\\');
    });
    if (hl.has(t.rows.length)) L.push(ind + '  \\hline');
    L.push(ind + '\\end{tabular}');
    if (cap && t.capBelow) { L.push(cap); if (t.label) L.push(ind + '\\label{' + t.label + '}'); }
    if (!cap && t.label && t.float) L.push(ind + '\\label{' + t.label + '}');
    if (t.float) L.push('\\end{table}'); else if (t.center) L.push('\\end{center}');
    return L.join('\n');
  }
  function blockToTex(b) {
    switch (b.t) {
      case 'p': return inlineToTex(b.inl);
      case 'h': return '\\' + (b.cmd || ['', 'section', 'subsection', 'subsubsection'][b.level]) + (b.star ? '*' : '') + (b.short != null ? '[' + b.short + ']' : '') + '{' + inlineToTex(b.inl) + '}' + (b.label ? '\\label{' + b.label + '}' : '');
      case 'list': return listToTex(b, '');
      case 'eq': return eqToTex(b);
      case 'table': return tableToTex(b);
      case 'raw': return b.tex;
      case 'box': {
        const head = '\\begin{' + b.env + '}' + (b.opt && b.opt.length ? '[' + inlineToTex(b.opt) + ']' : '') + (b.label ? '\\label{' + b.label + '}' : '');
        return head + '\n' + blocksToTex(b.blocks || []) + '\n\\end{' + b.env + '}';
      }
      case 'figure': {
        const L = ['\\begin{figure}[' + (b.placement || 'htbp') + ']', '  \\centering'];
        const cap = b.caption && b.caption.length ? '  \\caption{' + inlineToTex(b.caption) + '}' : null;
        if (cap && b.capAbove) { L.push(cap); if (b.label) L.push('  \\label{' + b.label + '}'); }
        L.push('  \\includegraphics' + (b.gopt ? '[' + b.gopt + ']' : '') + '{' + (b.file || 'figure.png') + '}');
        if (cap && !b.capAbove) { L.push(cap); if (b.label) L.push('  \\label{' + b.label + '}'); }
        L.push('\\end{figure}');
        return L.join('\n');
      }
      case 'code': return '\\begin{' + (b.env || 'verbatim') + '}' + (b.opt ? '[' + b.opt + ']' : '') + '\n' + (b.text || '').replace(/\n+$/, '') + '\n\\end{' + (b.env || 'verbatim') + '}';
      case 'toc': return '\\' + (b.cmd || 'tableofcontents');
      case 'pb': return '\\' + (b.cmd || 'newpage');
      case 'appendix': return '\\appendix';
      case 'bib': return '\\begin{thebibliography}{' + (b.widest || '99') + '}\n' + b.items.map(it => '  \\bibitem' + (it.opt ? '[' + it.opt + ']' : '') + '{' + it.key + '} ' + inlineToTex(it.inl)).join('\n') + '\n\\end{thebibliography}';
    }
    return '';
  }
  function blocksToTex(blocks) {
    let out = '';
    blocks.forEach((b, k) => { if (k > 0) out += b.join ? '\n' : '\n\n'; out += blockToTex(b); });
    return out;
  }
  /* ---- 必要なパッケージを自動で追加 ---- */
  function walkDoc(doc, fnB, fnI) {
    const wi = runs => { for (const r of runs || []) { fnI(r); if (r.inl) wi(r.inl); } };
    const wb = bl => {
      for (const b of bl || []) {
        fnB(b);
        wi(b.inl); wi(b.caption); wi(b.opt && Array.isArray(b.opt) ? b.opt : null);
        if (b.items) for (const it of b.items) { wi(it.inl); wi(it.optInl); if (it.sub) wb([it.sub]); }
        if (b.rows) for (const r of b.rows) for (const c of r) wi(c);
        if (b.blocks) wb(b.blocks);
      }
    };
    wi(doc.title); wi(doc.author); wi(doc.date); wb(doc.blocks);
  }
  function autoPackages(doc, pre) {
    const need = []; const thms = new Set(); let proof = false;
    let fig = false, link = false, color = false, lst = false;
    walkDoc(doc, b => {
      if (b.t === 'box') { if (THM[b.env]) thms.add(b.env); if (b.env === 'proof') proof = true; }
      if (b.t === 'figure' || (b.t === 'raw' && /\\includegraphics/.test(b.tex))) fig = true;
      if (b.t === 'code' && b.env === 'lstlisting') lst = true;
    }, r => { if (r.t === 'link') link = true; if (r.color) color = true; });
    const has = name => new RegExp('\\\\usepackage(\\[[^\\]]*\\])?\\{[^}]*\\b' + name + '\\b').test(pre) || (name === 'graphicx' && /\\usepackage(\[[^\]]*\])?\{[^}]*\bgraphics\b/.test(pre));
    if ((thms.size || proof) && !has('amsthm')) need.push('\\usepackage{amsthm}');
    const plain = [...thms].filter(t => !THM_DEF_STYLE.has(t) && !new RegExp('\\\\newtheorem\\*?\\{' + t + '\\}').test(pre));
    const defs = [...thms].filter(t => THM_DEF_STYLE.has(t) && !new RegExp('\\\\newtheorem\\*?\\{' + t + '\\}').test(pre));
    for (const t of plain) need.push('\\newtheorem{' + t + '}{' + THM[t] + '}');
    if (defs.length) { need.push('\\theoremstyle{definition}'); for (const t of defs) need.push('\\newtheorem{' + t + '}{' + THM[t] + '}'); }
    if (fig && !has('graphicx')) need.unshift('\\usepackage{graphicx}');
    if (color && !has('xcolor') && !has('color')) need.unshift('\\usepackage{xcolor}');
    if (lst && !has('listings')) need.unshift('\\usepackage{listings}');
    if (link && !has('hyperref')) need.push('\\usepackage{hyperref}');
    return need;
  }
  /* ---- 文書クラス・余白の読み書き ---- */
  function getClass(pre) {
    const m = /\\documentclass(?:\[([^\]]*)\])?\{([^}]*)\}/.exec(pre || '');
    const opts = m && m[1] ? m[1].split(',').map(x => x.trim()).filter(Boolean) : [];
    const g = /\\usepackage\[([^\]]*)\]\{geometry\}/.exec(pre || '');
    const margin = g ? (/margin=([^,\]]+)/.exec(g[1]) || [])[1] || '' : '';
    const ls = /\\linespread\{([^}]*)\}/.exec(pre || '');
    return { cls: m ? m[2] : '', opts, margin, linespread: ls ? ls[1] : '' };
  }
  function setClass(pre, c) {
    const line = '\\documentclass' + (c.opts.length ? '[' + c.opts.join(',') + ']' : '') + '{' + c.cls + '}';
    if (/\\documentclass(\[[^\]]*\])?\{[^}]*\}/.test(pre)) pre = pre.replace(/\\documentclass(\[[^\]]*\])?\{[^}]*\}/, line);
    else pre = line + '\n' + pre;
    const gl = c.margin ? '\\usepackage[margin=' + c.margin + ']{geometry}' : '';
    if (/^.*\\usepackage(\[[^\]]*\])?\{geometry\}.*\n?/m.test(pre)) pre = pre.replace(/^.*\\usepackage(\[[^\]]*\])?\{geometry\}.*(\n|$)/m, gl ? gl + '\n' : '');
    else if (gl) pre = pre.replace(/\s*$/, '\n') + gl + '\n';
    const ll = c.linespread ? '\\linespread{' + c.linespread + '}' : '';
    if (/^.*\\linespread\{[^}]*\}.*\n?/m.test(pre)) pre = pre.replace(/^.*\\linespread\{[^}]*\}.*(\n|$)/m, ll ? ll + '\n' : '');
    else if (ll) pre = pre.replace(/\s*$/, '\n') + ll + '\n';
    return pre;
  }
  // 文書全体 → LaTeX。ranges: 各ブロックのソース上の位置
  function docToTex(doc) {
    let out = '';
    const ranges = [];
    const hasTitle = doc.title && doc.title.length;
    if (!doc.fragment) {
      let pre = (doc.preamble != null ? doc.preamble : DEFAULT_PRE).replace(/\s+$/, '');
      const need = autoPackages(doc, pre);
      if (need.length) pre += '\n' + need.join('\n');
      out += pre + '\n\n';
      if (hasTitle) out += '\\title{' + inlineToTex(doc.title) + '}\n';
      if (doc.author && doc.author.length) out += '\\author{' + inlineToTex(doc.author) + '}\n';
      if (hasTitle || (doc.date && doc.date.length)) out += '\\date{' + inlineToTex(doc.date || []) + '}\n';
      out += '\n\\begin{document}\n';
      if (hasTitle || doc.maketitle) out += '\\maketitle\n';
      out += '\n';
    }
    doc.blocks.forEach((b, k) => {
      const tex = blockToTex(b);
      if (k > 0) out += b.join ? '\n' : '\n\n';
      ranges.push({ start: out.length, end: out.length + tex.length });
      out += tex;
    });
    if (!doc.fragment) out += '\n\n\\end{document}\n' + (doc.tail || '').replace(/^\n+/, '');
    else out += '\n';
    return { tex: out, ranges };
  }

  /* ---------------- 入力（LaTeX → モデル） ---------------- */
  function pushText(out, s, marks) {
    const last = out[out.length - 1];
    if (last && last.t === 'text' && sameMarks(last, marks)) { last.s += s; return; }
    const r = { t: 'text', s };
    for (const k of MARKS) if (marks[k]) r[k] = marks[k];
    out.push(r);
  }
  function lastChar(out) { for (let k = out.length - 1; k >= 0; k--) { if (out[k].t === 'text' && out[k].s) return out[k].s[out[k].s.length - 1]; if (out[k].t !== 'text') return null; } return null; }
  function parseInline(ctx, a, b, marks, out) {
    const src = ctx.src; let i = a, buf = '';
    const flush = () => { if (buf) { pushText(out, buf, marks); buf = ''; } };
    while (i < b) {
      const r = ctx.regAt.get(i);
      if (r && r.end <= b) {
        flush();
        if (r.kind === 'inline') out.push({ t: 'math', tex: src.slice(r.cs, r.ce).trim() });
        else out.push({ t: 'raw', tex: src.slice(r.start, r.end) });
        i = r.end; continue;
      }
      const c = src[i];
      if (c === '%') { flush(); while (i < b && src[i] !== '\n') i++; i++; while (i < b && /[ \t]/.test(src[i])) i++; continue; }
      if (c === '\n' || c === '\r') {
        let j = i + 1; while (j < b && /[ \t\r]/.test(src[j])) j++;
        const prev = buf ? buf[buf.length - 1] : lastChar(out), next = src[j];
        if (!(prev && next && CJK.test(prev) && CJK.test(next)) && prev !== ' ') buf += ' ';
        i = j; continue;
      }
      if (c === '~') { buf += '\u00a0'; i++; continue; }
      if (c === '{' || c === '}') { i++; continue; }
      if (c === '\\') {
        const m = /^\\([a-zA-Z@]+\*?|.)/.exec(src.slice(i, i + 60));
        if (!m) { i++; continue; }
        const name = m[1]; const j = i + m[0].length;
        if (name.length === 1 && !/[a-zA-Z]/.test(name)) {
          if ('%&#$_{}'.includes(name)) { buf += name; i = j; continue; }
          if (name === ' ') { buf += ' '; i = j; continue; }
          if (name === '\\') {
            flush(); const o = T.readOpt(src, j); out.push({ t: 'br' }); i = o.end;
            while (i < b && /[ \t]/.test(src[i])) i++;
            if (src[i] === '\n' && !/^\n[ \t]*\n/.test(src.slice(i, i + 20))) { i++; while (i < b && /[ \t]/.test(src[i])) i++; }
            continue;
          }
          flush(); out.push({ t: 'raw', tex: m[0] }); i = j; continue;
        }
        if (name === 'textbf' || name === 'textit' || name === 'emph' || name === 'underline' || name === 'textsl') {
          const g = T.readArg(src, j); flush();
          const mk = Object.assign({}, marks);
          if (name === 'textbf') mk.b = true; else if (name === 'underline') mk.u = true; else mk.i = name === 'emph' ? 'emph' : name;
          parseInline(ctx, g.a, g.b, mk, out); i = g.end; continue;
        }
        if (/^(texttt|textsc|textsuperscript|textsubscript)$/.test(name)) {
          const g = T.readArg(src, j); flush();
          const mk = Object.assign({}, marks); mk[{ texttt: 'tt', textsc: 'sc', textsuperscript: 'sup', textsubscript: 'sub' }[name]] = true;
          parseInline(ctx, g.a, g.b, mk, out); i = g.end; continue;
        }
        if (name === 'textcolor') {
          const g1 = T.readArg(src, j); const g2 = T.readArg(src, g1.end);
          const c = src.slice(g1.a, g1.b).trim();
          if (/^[a-zA-Z!0-9]+$/.test(c) && g1.ok && g2.ok) { flush(); const mk = Object.assign({}, marks, { color: c }); parseInline(ctx, g2.a, g2.b, mk, out); i = g2.end; continue; }
        }
        if (name === 'url') { const g = T.readArg(src, j); flush(); const u = src.slice(g.a, g.b); out.push(Object.assign({ t: 'link', url: u, plain: true, inl: [{ t: 'text', s: u }] }, pick(marks))); i = g.end; continue; }
        if (name === 'href') { const g1 = T.readArg(src, j); const g2 = T.readArg(src, g1.end); flush(); const u = src.slice(g1.a, g1.b).replace(/\\([%#])/g, '$1'); out.push(Object.assign({ t: 'link', url: u, inl: trimRuns(parseInline(ctx, g2.a, g2.b, {}, [])) }, pick(marks))); i = g2.end; continue; }
        if (name === 'cite' || name === 'citep' || name === 'citet') {
          const o = T.readOpt(src, j); const g = T.readArg(src, o.end); flush();
          out.push({ t: 'cite', key: src.slice(g.a, g.b).trim(), opt: o.ok ? src.slice(o.a, o.b) : undefined }); i = g.end; continue;
        }
        if (name === 'footnote') { const g = T.readArg(src, j); flush(); out.push({ t: 'fn', tex: src.slice(g.a, g.b).trim() }); i = g.end; continue; }
        if (/^(ref|eqref|autoref|cref|Cref|pageref)$/.test(name)) {
          const g = T.readArg(src, j); flush(); out.push({ t: 'ref', cmd: name, key: src.slice(g.a, g.b).trim() }); i = g.end; continue;
        }
        if (name === 'textbackslash' || name === 'textasciitilde' || name === 'textasciicircum') {
          buf += name === 'textbackslash' ? '\\' : name === 'textasciitilde' ? '~' : '^'; i = j; if (src.startsWith('{}', i)) i += 2; continue;
        }
        if (name === '^' || name === '~') { buf += name; i = j; if (src.startsWith('{}', i)) i += 2; continue; }
        // 一般の命令: [..] {..} を引数ごと保持
        let e = j;
        for (; ;) {
          let k = e; while (k < b && /[ \t]/.test(src[k])) k++;
          if (src[k] === '[' && name !== 'item') { e = T.matchBrace(src, k, '[', ']') + 1; continue; }
          if (src[k] === '{') { e = T.matchBrace(src, k, '{', '}') + 1; continue; }
          break;
        }
        flush(); out.push({ t: 'raw', tex: src.slice(i, e) }); i = e;
        if (src.startsWith('{}', i)) i += 2;
        continue;
      }
      buf += c; i++;
    }
    flush();
    return out;
  }
  function pick(m) { const o = {}; for (const k of MARKS) if (m[k]) o[k] = m[k]; return o; }
  function trimRuns(runs) {
    while (runs.length && runs[0].t === 'text' && !runs[0].s.replace(/^[ \t]+/, '')) runs.shift();
    if (runs.length && runs[0].t === 'text') runs[0].s = runs[0].s.replace(/^[ \t]+/, '');
    while (runs.length && runs[runs.length - 1].t === 'text' && !runs[runs.length - 1].s.replace(/[ \t]+$/, '')) runs.pop();
    if (runs.length && runs[runs.length - 1].t === 'text') runs[runs.length - 1].s = runs[runs.length - 1].s.replace(/[ \t]+$/, '');
    while (runs.length && runs[runs.length - 1].t === 'br') runs.pop();
    return runs;
  }
  function mkCtx(src) { const regions = T.scanMath(src); return { src, regAt: new Map(regions.map(r => [r.start, r])) }; }
  function inlineFromTex(s) { return trimRuns(parseInline(mkCtx(s), 0, s.length, {}, [])); }

  function eqFromRegion(src, r, join) {
    let content = src.slice(r.cs, r.ce);
    const e = { t: 'eq', join };
    if (r.kind === 'display') { e.mode = 'display'; e.tex = content.trim(); if (r.delim === '$$') e.delim = '$$'; return e; }
    const env = r.env, base = env.replace(/\*$/, ''), star = env.endsWith('*');
    if (base === 'equation' || base === 'displaymath') {
      const m = /\\label\{([^}]*)\}/.exec(content);
      if (m) { e.label = m[1]; content = content.replace(/[ \t]*\\label\{[^}]*\}[ \t]*\n?/, ''); }
      e.tex = content.trim();
      if (base === 'equation' && !star) e.mode = 'equation';
      else { e.mode = 'display'; e.env = env; }
      return e;
    }
    if (base === 'align') { e.mode = 'align'; e.numbered = !star; e.tex = content.trim(); return e; }
    e.mode = 'env'; e.env = env; e.tex = content;
    return e;
  }
  function parseList(ctx, env, a, b) {
    const src = ctx.src;
    const items = []; const re = /\\(begin|end)\{[^}]*\}|\\item\b/g; let d = 0, m; re.lastIndex = a;
    while ((m = re.exec(src)) && m.index < b) {
      if (m[1] === 'begin') d++; else if (m[1] === 'end') d--;
      else if (d === 0) items.push(m.index);
    }
    const list = { t: 'list', ordered: env === 'enumerate', items: [] };
    if (env === 'description') list.desc = true;
    // \item より前に文字があるなら失敗（生のまま）
    if (items.length === 0 || src.slice(a, items[0]).replace(/%[^\n]*/g, '').trim()) return null;
    items.forEach((p, k) => {
      let s = p + 5; const e = k + 1 < items.length ? items[k + 1] : b;
      const it = { inl: [] };
      const o = T.readOpt(src, s); if (o.ok) { if (list.desc) it.optInl = inlineFromTex(src.slice(o.a, o.b)); else it.opt = src.slice(o.a, o.b); s = o.end; }
      const nest = /\\begin\{(itemize|enumerate|description)\}/g; nest.lastIndex = s;
      const nm = nest.exec(src);
      let inlEnd = e;
      if (nm && nm.index < e) {
        inlEnd = nm.index;
        const E = T.findEnd(src, nm.index + nm[0].length, nm[1]);
        it.sub = parseList(ctx, nm[1], nm.index + nm[0].length, E.a);
        const rest = src.slice(E.end, e).trim();
        if (!it.sub || rest) { it.sub = null; inlEnd = e; }
      }
      it.inl = trimRuns(parseInline(ctx, s, inlEnd, {}, []));
      list.items.push(it);
    });
    return list;
  }
  function parseTabular(src, a, b) { // a: \begin{tabular} の位置
    const m = /^\\begin\{tabular\}\s*(\[[^\]]*\])?\s*\{/.exec(src.slice(a, a + 80));
    if (!m) return null;
    const sb = a + m[0].length - 1; const se = T.matchBrace(src, sb, '{', '}');
    const spec = src.slice(sb + 1, se);
    const E = T.findEnd(src, se + 1, 'tabular');
    if (E.end > b) return null;
    const body = src.slice(se + 1, E.a);
    if (/\\multicolumn|\\multirow|\\cline/.test(body)) return null;
    const rows = []; const hlines = [];
    let parts = T.splitTop(body, /^\\\\(\[[^\]]*\])?/);
    for (let k = 0; k < parts.length; k++) {
      let s = parts[k];
      let hcount = 0;
      s = s.replace(/^(\s*\\(hline|toprule|midrule|bottomrule)\s*)+/, mm => { hcount++; return ''; });
      if (hcount) hlines.push(rows.length);
      if (!s.trim()) continue;
      rows.push(T.splitTop(s, /^&/).map(c => inlineFromTex(c.trim())));
    }
    return { spec, rows, hlines: [...new Set(hlines)], end: E.end };
  }
  function parseTable(ctx, env, start, innerA, innerB, end) {
    const src = ctx.src;
    if (env === 'tabular') { const t = parseTabular(src, start, end); if (!t || t.end !== end) return null; return { t: 'table', float: false, center: false, spec: t.spec, rows: t.rows, hlines: t.hlines }; }
    let inner = src.slice(innerA, innerB);
    const tbl = { t: 'table', float: env === 'table', center: env === 'center' };
    if (env === 'table') { const o = /^\s*\[([^\]]*)\]/.exec(inner); if (o) { tbl.placement = o[1]; inner = inner.slice(o[0].length); } }
    const offset = innerB - inner.length; // inner の src 上の開始位置
    // 中身をトークンに分けて確認
    let rest = inner, pos = 0;
    const tabAt = rest.search(/\\begin\{tabular\}/);
    if (tabAt < 0) return null;
    const t = parseTabular(src, offset + tabAt, innerB);
    if (!t) return null;
    const before = rest.slice(0, tabAt), after = rest.slice(t.end - offset);
    const scan = (s, where) => {
      let x = s.replace(/%[^\n]*/g, '');
      const cap = /\\caption\{/.exec(x);
      if (cap) {
        const ia = cap.index + cap[0].length - 1; const e = T.matchBrace(x, ia, '{', '}');
        tbl.caption = inlineFromTex(x.slice(ia + 1, e)); tbl.capBelow = where === 'after';
        x = x.slice(0, cap.index) + x.slice(e + 1);
      }
      const lb = /\\label\{([^}]*)\}/.exec(x); if (lb) { tbl.label = lb[1]; x = x.replace(lb[0], ''); }
      x = x.replace(/\\centering\b/, '');
      return x.trim();
    };
    if (scan(before, 'before') || scan(after, 'after')) return null;
    tbl.spec = t.spec; tbl.rows = t.rows; tbl.hlines = t.hlines;
    return tbl;
  }
  function parseBox(ctx, env, a, b, doc) {
    const src = ctx.src; const box = { t: 'box', env };
    let s = a;
    if (THM[env] || env === 'proof') { const o = T.readOpt(src, s); if (o.ok) { box.opt = inlineFromTex(src.slice(o.a, o.b)); s = o.end; } }
    const lm = /^[ \t]*\n?[ \t]*\\label\{([^}]*)\}/.exec(src.slice(s, s + 200));
    if (lm) { box.label = lm[1]; s += lm[0].length; }
    box.blocks = parseBlocks(ctx, s, b, doc).map(x => { delete x._s; delete x._e; return x; });
    return box;
  }
  function parseFigure(ctx, a, b) {
    const src = ctx.src; let s = a;
    const fig = { t: 'figure' };
    const o = T.readOpt(src, s); if (o.ok) { fig.placement = src.slice(o.a, o.b); s = o.end; }
    let x = src.slice(s, b).replace(/%[^\n]*/g, '');
    const ig = /\\includegraphics\s*(?:\[([^\]]*)\])?\s*\{([^}]*)\}/.exec(x);
    if (!ig) return null;
    fig.file = ig[2].trim(); if (ig[1] != null) fig.gopt = ig[1];
    const igAt = ig.index;
    x = x.slice(0, ig.index) + x.slice(ig.index + ig[0].length);
    const cap = /\\caption\{/.exec(x);
    if (cap) {
      const ia = cap.index + cap[0].length - 1; const e = T.matchBrace(x, ia, '{', '}');
      fig.caption = inlineFromTex(x.slice(ia + 1, e)); fig.capAbove = cap.index < igAt;
      x = x.slice(0, cap.index) + x.slice(e + 1);
    }
    const lb = /\\label\{([^}]*)\}/.exec(x); if (lb) { fig.label = lb[1]; x = x.replace(lb[0], ''); }
    x = x.replace(/\\centering\b/, '');
    if (x.trim()) return null;
    return fig;
  }
  function parseBib(ctx, a, b) {
    const src = ctx.src; const g = T.readArg(src, a);
    const bib = { t: 'bib', widest: src.slice(g.a, g.b), items: [] };
    const re = /\\bibitem\b/g; re.lastIndex = g.end; const pos = []; let m;
    while ((m = re.exec(src)) && m.index < b) pos.push(m.index);
    if (src.slice(g.end, pos[0] == null ? b : pos[0]).replace(/%[^\n]*/g, '').trim()) return null;
    pos.forEach((p, k) => {
      let s = p + 8; const e = k + 1 < pos.length ? pos[k + 1] : b;
      const it = {};
      const o = T.readOpt(src, s); if (o.ok) { it.opt = src.slice(o.a, o.b); s = o.end; }
      const kg = T.readArg(src, s); it.key = src.slice(kg.a, kg.b).trim();
      it.inl = trimRuns(parseInline(ctx, kg.end, e, {}, []));
      bib.items.push(it);
    });
    return bib;
  }
  function paraEnd(ctx, i, b) {
    const src = ctx.src; let j = i;
    while (j < b) {
      const r = ctx.regAt.get(j);
      if (r) { if (r.kind === 'inline') { j = r.end; continue; } return j; }
      const c = src[j];
      if (c === '%') { while (j < b && src[j] !== '\n') j++; continue; }
      if (c === '\n') {
        if (/^\n[ \t]*(\r?\n|$)/.test(src.slice(j, j + 40))) return j;
        let k = j + 1; while (k < b && /[ \t]/.test(src[k])) k++;
        if (k < b && (ctx.regAt.has(k) && ctx.regAt.get(k).kind !== 'inline')) return j;
        if (src[k] === '\\') { const m = /^\\([a-zA-Z]+)/.exec(src.slice(k, k + 30)); if (m && (HEAD[m[1]] || m[1] === 'begin' || m[1] === 'maketitle' || m[1] === 'end' || (!INLINE_CMDS.has(m[1]) && lineAlone(ctx, k, b)))) return j; }
        if (src[k] === '%') return j;
        j++; continue;
      }
      if (c === '\\') {
        const m = /^\\([a-zA-Z]+)/.exec(src.slice(j, j + 30));
        if (m && (HEAD[m[1]] || m[1] === 'begin' || m[1] === 'maketitle')) return j;
        j += m ? m[0].length : 2; continue;
      }
      j++;
    }
    return b;
  }
  // 命令（引数込み）が行に単独であるか → 生ブロック
  function cmdExtent(src, i, b) {
    const m = /^\\([a-zA-Z@]+\*?)/.exec(src.slice(i, i + 60)); if (!m) return i + 1;
    let e = i + m[0].length;
    for (; ;) {
      let k = e; while (k < b && /[ \t]/.test(src[k])) k++;
      if (src[k] === '[') { e = T.matchBrace(src, k, '[', ']') + 1; continue; }
      if (src[k] === '{') { e = T.matchBrace(src, k, '{', '}') + 1; continue; }
      break;
    }
    return e;
  }
  function lineAlone(ctx, i, b) {
    const src = ctx.src;
    const ls = src.lastIndexOf('\n', i - 1) + 1;
    if (src.slice(ls, i).trim()) return false;
    const e = cmdExtent(src, i, b);
    let k = e; while (k < b && /[ \t]/.test(src[k])) k++;
    return k >= b || src[k] === '\n' || src[k] === '%';
  }
  function parseBlocks(ctx, a, b, doc) {
    const src = ctx.src; const blocks = []; let i = a, gap = true;
    let marked = 0, lastStart = a;
    const mark = end => { for (let k = marked; k < blocks.length; k++) { blocks[k]._s = lastStart; blocks[k]._e = end; } marked = blocks.length; };
    while (i < b) {
      mark(i);
      let j = i, nl = 0;
      while (j < b && /\s/.test(src[j])) { if (src[j] === '\n') nl++; j++; }
      if (j >= b) break;
      if (nl >= 2) gap = true;
      i = j; lastStart = i;
      const c = src[i];
      if (c === '%') { let e = src.indexOf('\n', i); if (e < 0 || e > b) e = b; blocks.push({ t: 'raw', tex: src.slice(i, e), join: !gap }); gap = false; i = e; continue; }
      const r = ctx.regAt.get(i);
      if (r && r.kind !== 'inline') { blocks.push(eqFromRegion(src, r, !gap)); gap = false; i = r.end; continue; }
      if (c === '\\') {
        const m = /^\\([a-zA-Z]+)(\*?)/.exec(src.slice(i, i + 40));
        if (m) {
          const name = m[1], star = m[2]; const j2 = i + m[0].length;
          if (HEAD[name]) {
            const o = T.readOpt(src, j2); const g = T.readArg(src, o.end);
            const h = { t: 'h', level: HEAD[name], inl: trimRuns(parseInline(ctx, g.a, g.b, {}, [])), join: !gap };
            if (name !== ['', 'section', 'subsection', 'subsubsection'][HEAD[name]]) h.cmd = name;
            if (star) h.star = true;
            if (o.ok) h.short = src.slice(o.a, o.b);
            let e = g.end; const lm = /^[ \t]*\n?[ \t]*\\label\{([^}]*)\}/.exec(src.slice(e, e + 200));
            if (lm) { h.label = lm[1]; e += lm[0].length; }
            blocks.push(h); gap = false; i = e; continue;
          }
          if (name === 'maketitle') { doc.maketitle = true; i = j2; continue; }
          if ((name === 'tableofcontents' || name === 'listoffigures' || name === 'listoftables') && lineAlone(ctx, i, b)) { blocks.push({ t: 'toc', cmd: name, join: !gap }); gap = false; i = j2; continue; }
          if ((name === 'newpage' || name === 'clearpage' || name === 'cleardoublepage' || name === 'pagebreak') && lineAlone(ctx, i, b)) { blocks.push({ t: 'pb', cmd: name, join: !gap }); gap = false; i = j2; continue; }
          if (name === 'appendix' && lineAlone(ctx, i, b)) { blocks.push({ t: 'appendix', join: !gap }); gap = false; i = j2; continue; }
          if (name === 'begin') {
            const g = T.readArg(src, j2); const env = src.slice(g.a, g.b).trim();
            const E = T.findEnd(src, g.end, env);
            let blk = null;
            if (env === 'itemize' || env === 'enumerate' || env === 'description') blk = parseList(ctx, env, g.end, E.a);
            else if (env === 'table' || env === 'tabular') blk = parseTable(ctx, env, i, g.end, E.a, E.end);
            else if (env === 'center') blk = parseTable(ctx, env, i, g.end, E.a, E.end) || parseBox(ctx, env, g.end, E.a, doc);
            else if (BOX_ENVS.has(env)) blk = parseBox(ctx, env, g.end, E.a, doc);
            else if (env === 'figure') blk = parseFigure(ctx, g.end, E.a);
            else if (CODE_ENVS.has(env)) { let s0 = g.end; const o = env === 'lstlisting' ? T.readOpt(src, s0) : { ok: false }; if (o.ok) s0 = o.end; blk = { t: 'code', env, text: src.slice(s0, E.a).replace(/^[ \t]*\n/, '').replace(/\n[ \t]*$/, '') }; if (o.ok) blk.opt = src.slice(o.a, o.b); }
            else if (env === 'thebibliography') blk = parseBib(ctx, g.end, E.a);
            if (!blk) blk = { t: 'raw', tex: src.slice(i, E.end) };
            blk.join = !gap; blocks.push(blk); gap = false; i = E.end; continue;
          }
          if (!INLINE_CMDS.has(name) && lineAlone(ctx, i, b)) {
            const e = cmdExtent(src, i, b);
            blocks.push({ t: 'raw', tex: src.slice(i, e), join: !gap }); gap = false; i = e; continue;
          }
        }
      }
      const e = paraEnd(ctx, i, b);
      const inl = trimRuns(parseInline(ctx, i, e, {}, []));
      if (inl.length) { blocks.push({ t: 'p', inl, join: !gap }); gap = false; }
      i = e > i ? e : i + 1;
    }
    mark(Math.min(i, b));
    if (blocks.length) blocks[0].join = false;
    return blocks;
  }
  function texToDoc(src) {
    const ctx = mkCtx(src);
    const doc = { preamble: null, title: [], author: [], date: [], blocks: [], tail: '', fragment: false, maketitle: false };
    let a = 0, b = src.length;
    const bd = src.indexOf('\\begin{document}');
    if (bd >= 0) {
      let pre = src.slice(0, bd);
      for (const k of ['title', 'author', 'date']) {
        const re = new RegExp('^[ \\t]*\\\\' + k + '\\s*\\{', 'm');
        const m = re.exec(pre);
        if (m) {
          const ia = m.index + m[0].length - 1; const e = T.matchBrace(pre, ia, '{', '}');
          doc[k] = inlineFromTex(pre.slice(ia + 1, e));
          let end = e + 1; while (pre[end] === ' ' || pre[end] === '\t') end++; if (pre[end] === '\n') end++;
          pre = pre.slice(0, m.index) + pre.slice(end);
        }
      }
      doc.preamble = pre.replace(/\n{3,}/g, '\n\n');
      a = bd + '\\begin{document}'.length;
      const ed = src.indexOf('\\end{document}', a);
      if (ed >= 0) { b = ed; doc.tail = src.slice(ed + '\\end{document}'.length); }
    } else doc.fragment = true;
    doc.blocks = parseBlocks(ctx, a, b, doc);
    return doc;
  }
  function blankDoc() {
    return { preamble: DEFAULT_PRE, title: [], author: [], date: [{ t: 'raw', tex: '\\today' }], blocks: [{ t: 'p', inl: [] }], tail: '', fragment: false, maketitle: false };
  }
  return { texToDoc, docToTex, inlineToTex, inlineFromTex, blockToTex, blocksToTex, eqToTex, escText, DEFAULT_PRE, blankDoc, tableSpec, getClass, setClass, THM, BOX_ENVS, MARKS };
})();
if (typeof module !== 'undefined') module.exports = DocModel;

'use strict';
/* =====================================================================
 *  Wys : 文書モデル ⇄ 編集画面（contenteditable）の DOM
 * ===================================================================== */
const Wys = (() => {
  const T = TexDoc;
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  const uid = () => Math.random().toString(36).slice(2, 7);

  /* ---------- インライン要素 ---------- */
  function mathAtom(tex) {
    const s = el('span', 'im'); s.contentEditable = 'false'; s.dataset.tex = tex; s.title = 'クリックで数式を編集';
    try { s.appendChild(MathRender.renderLatex(tex, { display: false })); } catch (e) { s.textContent = '$' + tex + '$'; }
    return s;
  }
  function refAtom(key, cmd) {
    const s = el('span', 'rf', '??'); s.contentEditable = 'false'; s.dataset.key = key; s.dataset.cmd = cmd || 'ref'; return s;
  }
  function rawLabel(tex) {
    let m;
    if (tex === '\\today') { const d = new Date(); return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
    if (tex === '\\LaTeX' || tex === '\\LaTeX{}') return 'LaTeX';
    if (tex === '\\TeX') return 'TeX';
    if ((m = /^\\cite(\[[^\]]*\])?\{([^}]*)\}$/.exec(tex))) return '[' + m[2] + ']';
    if ((m = /^\\footnote\{([\s\S]*)\}$/.exec(tex))) return '※ ' + m[1].slice(0, 24);
    if ((m = /^\\(texttt|textsf|textrm|textsc|mbox|text)\{([\s\S]*)\}$/.exec(tex))) return m[2];
    if ((m = /^\\url\{([^}]*)\}$/.exec(tex))) return m[1];
    if ((m = /^\\label\{([^}]*)\}$/.exec(tex))) return '🏷 ' + m[1];
    return tex.length > 40 ? tex.slice(0, 38) + '…' : tex;
  }
  function rawAtom(tex) {
    const s = el('span', 'ri', rawLabel(tex)); s.contentEditable = 'false'; s.dataset.tex = tex; s.title = 'LaTeX: ' + tex + '\n（クリックで編集）';
    if (/^\\(texttt)/.test(tex)) s.classList.add('tt');
    if (/^\\(today|LaTeX|TeX)\b/.test(tex) || /^\\(textsf|textrm|textsc|mbox|text)\{/.test(tex)) s.classList.add('soft');
    return s;
  }
  const COLORS = { red: '#c62828', blue: '#1565c0', green: '#2e7d32', orange: '#e65100', purple: '#6a1b9a', gray: '#616161', brown: '#6d4c41', cyan: '#00838f', magenta: '#ad1457', black: '#111111' };
  const COLOR_BY_HEX = Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [v, k]));
  function colorCss(name) { const base = String(name).split('!')[0]; return COLORS[base] || base; }
  function markWrap(node, r) {
    const wrap = (tag, cls) => { const e = el(tag, cls); e.appendChild(node); node = e; };
    if (r.tt) wrap('code');
    if (r.sc) wrap('span', 'sc');
    if (r.sup) wrap('sup');
    if (r.sub) wrap('sub');
    if (r.u) wrap('u');
    if (r.i) { wrap('i'); if (r.i !== 'emph' && r.i !== true) node.dataset.cmd = r.i; }
    if (r.b) wrap('b');
    if (r.color) { wrap('span', 'clr'); node.dataset.color = r.color; node.style.color = colorCss(r.color); }
    return node;
  }
  function citeAtom(key, opt) { const c = el('span', 'ct', '[?]'); c.contentEditable = 'false'; c.dataset.key = key; if (opt) c.dataset.opt = opt; c.title = '文献: ' + key; return c; }
  function fnAtom(tex) { const f = el('span', 'fn', '*'); f.contentEditable = 'false'; f.dataset.tex = tex || ''; f.title = '脚注: ' + (tex || '') + '\n（クリックで編集）'; return f; }
  function linkEl(r) { const a = el('a'); a.href = r.url; a.title = r.url + '\n（Ctrl+クリックで開く）'; if (r.plain) a.dataset.plain = '1'; inlineToDom(r.inl && r.inl.length ? r.inl : [{ t: 'text', s: r.url }], a); return a; }
  function inlineToDom(runs, parent) {
    for (const r of runs || []) {
      if (r.t === 'text') parent.appendChild(markWrap(document.createTextNode(r.s), r));
      else if (r.t === 'link') parent.appendChild(markWrap(linkEl(r), r));
      else if (r.t === 'cite') parent.appendChild(citeAtom(r.key, r.opt));
      else if (r.t === 'fn') parent.appendChild(fnAtom(r.tex));
      else if (r.t === 'math') parent.appendChild(mathAtom(r.tex));
      else if (r.t === 'ref') parent.appendChild(refAtom(r.key, r.cmd));
      else if (r.t === 'raw') parent.appendChild(rawAtom(r.tex));
      else if (r.t === 'br') parent.appendChild(el('br'));
    }
    return parent;
  }

  /* ---------- 数式ブロック ---------- */
  const ROWED = /^(align|gather|multline|eqnarray|flalign|alignat)\*?$/;
  function eqBlock(b) {
    const d = el('div', 'eq'); d.contentEditable = 'false';
    for (const k of ['mode', 'tex', 'label', 'env', 'delim']) if (b[k] != null) d.dataset[k] = b[k];
    if (b.numbered === false) d.dataset.nonum = '1';
    if (b.join) d.dataset.join = '1';
    d.title = 'クリックで数式を編集';
    const body = el('div', 'eqbody');
    const env = b.env || '';
    const rowed = b.mode === 'align' || (b.mode === 'env' && ROWED.test(env));
    try {
      if (rowed) {
        const numbered = b.mode === 'align' ? b.numbered !== false : !env.endsWith('*');
        const centered = /^(gather|multline)/.test(env);
        const rows = T.splitTop(b.tex, /^\\\\(\[[^\]]*\])?/).filter((x, k, a) => !(k === a.length - 1 && !x.trim()));
        const cells = rows.map(r => centered ? [r] : T.splitTop(r, /^&/));
        const nc = Math.max(1, ...cells.map(c => c.length));
        const g = el('div', 'eqgrid'); g.style.gridTemplateColumns = `1fr repeat(${nc}, auto) 1fr`;
        rows.forEach((row, ri) => {
          g.appendChild(el('span'));
          for (let c = 0; c < nc; c++) {
            const cell = el('span', centered ? 'ac' : (c % 2 === 0 ? 'ar' : 'al'));
            if (cells[ri][c] != null) cell.appendChild(MathRender.renderLatex(cells[ri][c], { display: true }));
            g.appendChild(cell);
          }
          const no = el('span', 'eqno');
          const tag = /\\tag\*?\{([^}]*)\}/.exec(row), lb = /\\label\{([^}]*)\}/.exec(row);
          const sup = /\\(nonumber|notag)\b/.test(row) || (/^multline/.test(env) && ri !== rows.length - 1);
          if (tag) no.dataset.tag = tag[1]; else if (numbered && !sup) no.dataset.auto = '1';
          if (lb) no.dataset.label = lb[1];
          no.dataset.row = ri;
          g.appendChild(no);
        });
        body.appendChild(g);
        d.appendChild(body);
      } else {
        const inner = (b.tex || '').replace(/\\label\{[^}]*\}/g, '').replace(/\\tag\*?\{[^}]*\}/g, '');
        const tag = /\\tag\*?\{([^}]*)\}/.exec(b.tex || '');
        const pad = el('span', 'eqpad');
        body.appendChild(MathRender.renderLatex(inner, { display: true }));
        const no = el('span', 'eqno');
        if (tag) no.dataset.tag = tag[1]; else if (b.mode === 'equation') no.dataset.auto = '1';
        if (b.label) no.dataset.label = b.label;
        d.append(pad, body, no);
      }
    } catch (e) { d.appendChild(el('code', '', b.tex)); }
    if (!b.tex || !b.tex.trim()) d.classList.add('empty');
    return d;
  }
  function eqFromEl(d) {
    const b = { t: 'eq', mode: d.dataset.mode || 'display', tex: d.dataset.tex || '' };
    for (const k of ['label', 'env', 'delim']) if (d.dataset[k]) b[k] = d.dataset[k];
    if (b.mode === 'align') b.numbered = d.dataset.nonum !== '1';
    if (d.dataset.join) b.join = true;
    return b;
  }

  /* ---------- 表 ---------- */
  function tableBlock(t) {
    const d = el('div', 'tbl'); d.contentEditable = 'false';
    d.dataset.float = t.float ? '1' : ''; d.dataset.center = t.center ? '1' : '';
    if (t.placement != null) d.dataset.placement = t.placement;
    if (t.spec != null) d.dataset.spec = t.spec;
    if (t.label) d.dataset.label = t.label;
    if (t.capBelow) d.dataset.capBelow = '1';
    if (t.join) d.dataset.join = '1';
    const cap = el('div', 'cap'); cap.contentEditable = 'true'; cap.dataset.ph = '表のタイトル（キャプション）';
    inlineToDom(t.caption || [], cap);
    const tb = el('table'); const hl = new Set(t.hlines || []);
    const n = Math.max(1, ...t.rows.map(r => r.length));
    const aligns = (t.spec || '').replace(/[^lcr]/g, '');
    t.rows.forEach((row, k) => {
      const tr = el('tr'); if (hl.has(k)) tr.className = 'hl';
      for (let c = 0; c < n; c++) {
        const td = el('td'); td.contentEditable = 'true';
        const a = aligns[c]; if (a) td.style.textAlign = a === 'l' ? 'left' : a === 'r' ? 'right' : 'center';
        inlineToDom(row[c] || [], td);
        tr.appendChild(td);
      }
      tb.appendChild(tr);
    });
    if (hl.has(t.rows.length)) d.dataset.hlEnd = '1';
    if (t.float || (t.caption && t.caption.length)) { if (t.capBelow) d.append(tb, cap); else d.append(cap, tb); }
    else d.append(tb);
    if (/\|/.test(t.spec || '')) d.classList.add('vlines');
    return d;
  }
  function tableFromEl(d) {
    const t = { t: 'table', float: d.dataset.float === '1', center: d.dataset.center === '1', rows: [], hlines: [] };
    if (d.dataset.placement != null) t.placement = d.dataset.placement;
    if (d.dataset.spec) t.spec = d.dataset.spec;
    if (d.dataset.label) t.label = d.dataset.label;
    if (d.dataset.capBelow) t.capBelow = true;
    if (d.dataset.join) t.join = true;
    const cap = d.querySelector(':scope > .cap');
    if (cap) { const c = readInline(cap); if (c.length) t.caption = c; }
    [...d.querySelectorAll(':scope > table > tbody > tr, :scope > table > tr')].forEach((tr, k) => {
      if (tr.classList.contains('hl')) t.hlines.push(k);
      t.rows.push([...tr.children].map(td => readInline(td)));
    });
    if (d.dataset.hlEnd) t.hlines.push(t.rows.length);
    t.spec = DocModel.tableSpec(t);
    return t;
  }

  /* ---------- 生LaTeXブロック ---------- */
  function rawBlock(b) {
    const d = el('div', 'raw'); d.contentEditable = 'false'; d.dataset.tex = b.tex; if (b.join) d.dataset.join = '1';
    d.title = 'LaTeX のまま保持している部分（クリックで編集）';
    let label = 'LaTeX';
    const m = /^\\begin\{([^}]*)\}/.exec(b.tex);
    if (m) label = { figure: '図', abstract: '概要', quote: '引用', verbatim: 'コード', thebibliography: '参考文献' }[m[1]] || m[1];
    else if (/^%/.test(b.tex)) label = 'コメント';
    else if (/^\\(newpage|clearpage)/.test(b.tex)) label = '改ページ';
    else if (/^\\tableofcontents/.test(b.tex)) label = '目次';
    d.appendChild(el('span', 'rawtag', label));
    const fig = /\\includegraphics(\[[^\]]*\])?\{([^}]*)\}/.exec(b.tex);
    if (fig) d.appendChild(el('div', 'rawimg', '🖼 ' + fig[2]));
    const cap = /\\caption\{([^}]*)\}/.exec(b.tex);
    if (cap) d.appendChild(el('div', 'rawcap', cap[1]));
    if (!fig) d.appendChild(el('pre', '', b.tex));
    if (/^%/.test(b.tex)) d.classList.add('comment');
    d.appendChild(delBtn());
    return d;
  }

  /* ---------- 囲み（定理・概要・引用・中央揃え） ---------- */
  const BOXNAME = { abstract: '概要', quote: '引用', quotation: '引用', verse: '詩', center: '中央揃え', flushleft: '左揃え', flushright: '右揃え', proof: '証明', theorem: '定理', lemma: '補題', proposition: '命題', corollary: '系', definition: '定義', example: '例', remark: '注意' };
  function delBtn() { const b = el('button', 'bx-del', '×'); b.type = 'button'; b.contentEditable = 'false'; b.title = 'このブロックを削除'; b.tabIndex = -1; return b; }
  function boxBlock(b) {
    const d = el('div', 'box box-' + b.env); d.contentEditable = 'false'; d.dataset.env = b.env;
    if (b.label) d.dataset.label = b.label; if (b.join) d.dataset.join = '1';
    const head = el('div', 'boxhead');
    head.appendChild(el('span', 'boxname', BOXNAME[b.env] || b.env));
    if (DocModel.THM[b.env] || b.env === 'proof') {
      const opt = el('span', 'boxopt'); opt.contentEditable = 'true'; opt.dataset.ph = '（題名を書けます）';
      inlineToDom(b.opt || [], opt); head.appendChild(opt);
    }
    head.appendChild(delBtn());
    const body = el('div', 'boxbody'); body.contentEditable = 'true';
    const blocks = b.blocks && b.blocks.length ? b.blocks : [{ t: 'p', inl: [] }];
    body.append(...blocks.map(blockToDom));
    d.append(head, body);
    if (b.env === 'proof') d.appendChild(el('span', 'qed', '□'));
    return d;
  }
  function boxFromEl(d) {
    const b = { t: 'box', env: d.dataset.env };
    if (d.dataset.label) b.label = d.dataset.label; if (d.dataset.join) b.join = true;
    const opt = d.querySelector(':scope > .boxhead > .boxopt'); if (opt) { const o = trim(readInline(opt)); if (o.length) b.opt = o; }
    b.blocks = readBlocks(d.querySelector(':scope > .boxbody'));
    return b;
  }
  /* ---------- 図 ---------- */
  const images = new Map(); // ファイル名 → dataURL（このブラウザ内のみ）
  const WIDTHS = ['0.3', '0.4', '0.5', '0.6', '0.7', '0.8', '0.9', '1'];
  function figBlock(f) {
    const d = el('div', 'fig'); d.contentEditable = 'false';
    d.dataset.file = f.file || 'figure.png';
    if (f.gopt != null) d.dataset.gopt = f.gopt;
    if (f.placement) d.dataset.placement = f.placement;
    if (f.label) d.dataset.label = f.label;
    if (f.capAbove) d.dataset.capAbove = '1';
    if (f.join) d.dataset.join = '1';
    const img = el('div', 'figimg'); img.title = 'クリックで画像を選ぶ（プレビュー用）';
    const url = images.get(d.dataset.file);
    const wm = /width=([0-9.]+)\\(linewidth|textwidth|columnwidth)/.exec(f.gopt || '');
    const frac = wm ? parseFloat(wm[1]) : (f.gopt ? null : 0.6);
    if (url) { const im = el('img'); im.src = url; im.alt = d.dataset.file; img.appendChild(im); }
    else img.appendChild(el('span', 'figph', '🖼 ' + d.dataset.file + '\nクリックして画像を選ぶと、ここに表示されます'));
    img.style.width = Math.round((frac || 0.6) * 100) + '%';
    const ctl = el('div', 'figctl');
    const fileIn = el('input', 'figfile'); fileIn.value = d.dataset.file; fileIn.spellcheck = false; fileIn.title = 'LaTeX で読み込む画像ファイル名（.tex と同じフォルダからの相対パス）';
    const wSel = el('select', 'figw');
    for (const w of WIDTHS) { const o = el('option', '', Math.round(w * 100) + '%'); o.value = w; wSel.appendChild(o); }
    if (frac == null) { const o = el('option', '', 'そのまま'); o.value = ''; wSel.appendChild(o); wSel.value = ''; }
    else wSel.value = WIDTHS.includes(String(frac)) ? String(frac) : (() => { const o = el('option', '', Math.round(frac * 100) + '%'); o.value = String(frac); wSel.appendChild(o); return String(frac); })();
    ctl.append(el('span', '', 'ファイル'), fileIn, el('span', '', '幅'), wSel, delBtn());
    const cap = el('div', 'cap'); cap.contentEditable = 'true'; cap.dataset.ph = '図のタイトル（キャプション）';
    inlineToDom(f.caption || [], cap);
    d.append(img, cap, ctl);
    return d;
  }
  function figFromEl(d) {
    const f = { t: 'figure', file: (d.querySelector('.figfile') || {}).value || d.dataset.file || 'figure.png' };
    const w = (d.querySelector('.figw') || {}).value;
    const old = d.dataset.gopt;
    if (w) f.gopt = (old && /width=[^,]*/.test(old)) ? old.replace(/width=[^,]*/, 'width=' + w + '\\linewidth') : 'width=' + w + '\\linewidth';
    else if (old != null) f.gopt = old;
    if (d.dataset.placement) f.placement = d.dataset.placement;
    if (d.dataset.label) f.label = d.dataset.label;
    if (d.dataset.capAbove) f.capAbove = true;
    if (d.dataset.join) f.join = true;
    const c = trim(readInline(d.querySelector(':scope > .cap'))); if (c.length) f.caption = c;
    return f;
  }
  /* ---------- コード・目次・改ページ・付録・参考文献 ---------- */
  function codeBlock(b) {
    const d = el('div', 'codeb'); d.contentEditable = 'false'; d.dataset.env = b.env || 'verbatim'; if (b.opt) d.dataset.opt = b.opt; if (b.join) d.dataset.join = '1';
    const head = el('div', 'boxhead'); head.append(el('span', 'boxname', 'コード（そのまま表示）'), delBtn());
    const pre = el('pre', 'code'); try { pre.contentEditable = 'plaintext-only'; } catch (e) { pre.contentEditable = 'true'; }
    if (pre.contentEditable !== 'plaintext-only') pre.contentEditable = 'true';
    pre.textContent = b.text || ''; pre.spellcheck = false;
    d.append(head, pre); return d;
  }
  function simpleBlock(cls, text, data) {
    const d = el('div', cls); d.contentEditable = 'false';
    for (const k in data || {}) if (data[k] != null) d.dataset[k] = data[k];
    d.appendChild(el('span', 'sbtext', text)); d.appendChild(delBtn()); return d;
  }
  function bibBlock(b) {
    const d = el('div', 'bib'); d.contentEditable = 'false'; d.dataset.widest = b.widest || '99'; if (b.join) d.dataset.join = '1';
    const head = el('div', 'boxhead'); head.append(el('span', 'bibtitle', '参考文献'), delBtn());
    const ol = el('ol', 'biblist');
    for (const it of b.items) ol.appendChild(bibItem(it));
    const add = el('button', 'bib-add', '＋ 文献を追加'); add.type = 'button';
    d.append(head, ol, add); return d;
  }
  function bibItem(it) {
    const li = el('li');
    const k = el('span', 'bibkey', it.key); k.contentEditable = 'false'; k.title = '引用キー（クリックで変更）'; if (it.opt) k.dataset.opt = it.opt;
    const t = el('span', 'bibtext'); t.contentEditable = 'true'; t.dataset.ph = '著者，題名，出版社，年'; inlineToDom(it.inl || [], t);
    li.append(k, t); return li;
  }
  function bibFromEl(d) {
    const b = { t: 'bib', widest: d.dataset.widest || '99', items: [] }; if (d.dataset.join) b.join = true;
    d.querySelectorAll(':scope > ol > li').forEach(li => { const k = li.querySelector('.bibkey'); const it = { key: k.textContent.trim(), inl: trim(readInline(li.querySelector('.bibtext'))) }; if (k.dataset.opt) it.opt = k.dataset.opt; b.items.push(it); });
    return b;
  }

  /* ---------- 描画 ---------- */
  function blockToDom(b) {
    switch (b.t) {
      case 'p': { const p = el('p'); if (b.join) p.dataset.join = '1'; inlineToDom(b.inl, p); if (!p.firstChild) p.appendChild(el('br')); return p; }
      case 'h': {
        const h = el(['h2', 'h2', 'h3', 'h4'][b.level] || 'h2');
        if (b.label) h.dataset.label = b.label; if (b.star) h.dataset.star = '1'; if (b.cmd) h.dataset.cmd = b.cmd; if (b.short != null) h.dataset.short = b.short;
        inlineToDom(b.inl, h); if (!h.firstChild) h.appendChild(el('br')); return h;
      }
      case 'list': return listToDom(b);
      case 'eq': return eqBlock(b);
      case 'table': return tableBlock(b);
      case 'raw': return rawBlock(b);
      case 'box': return boxBlock(b);
      case 'figure': return figBlock(b);
      case 'code': return codeBlock(b);
      case 'toc': return simpleBlock('toc', { tableofcontents: '目次', listoffigures: '図目次', listoftables: '表目次' }[b.cmd || 'tableofcontents'], { cmd: b.cmd, join: b.join ? '1' : null });
      case 'pb': return simpleBlock('pb', '改ページ', { cmd: b.cmd, join: b.join ? '1' : null });
      case 'appendix': return simpleBlock('appx', '付録（ここから後の見出しは A, B, … になります）', { join: b.join ? '1' : null });
      case 'bib': return bibBlock(b);
    }
    return el('p');
  }
  function listToDom(l) {
    const u = el(l.ordered ? 'ol' : 'ul'); if (l.join) u.dataset.join = '1';
    if (l.desc) u.className = 'desc';
    for (const it of l.items) {
      const li = el('li'); if (it.opt != null) li.dataset.opt = it.opt;
      if (l.desc) { const dt = el('b', 'dt'); inlineToDom(it.optInl && it.optInl.length ? it.optInl : [{ t: 'text', s: '用語' }], dt); li.appendChild(dt); li.appendChild(document.createTextNode(' ')); }
      inlineToDom(it.inl, li); if (!li.firstChild) li.appendChild(el('br'));
      if (it.sub) li.appendChild(listToDom(it.sub));
      u.appendChild(li);
    }
    return u;
  }
  function render(doc, page) {
    const body = page.querySelector('#wys');
    const tb = page.querySelector('.titleblock');
    tb.hidden = !!doc.fragment;
    for (const k of ['title', 'author', 'date']) { const f = tb.querySelector(`[data-f="${k}"]`); f.replaceChildren(); inlineToDom(doc[k] || [], f); }
    body.replaceChildren(...doc.blocks.map(blockToDom));
    // 最後が段落でなければ、続けて書けるよう空の段落を置く（LaTeX には出力されない）
    if (!body.lastElementChild || body.lastElementChild.tagName !== 'P') body.appendChild(blockToDom({ t: 'p', inl: [] }));
  }

  /* ---------- 読み取り ---------- */
  function readInline(node, marks, out) {
    marks = marks || {}; out = out || [];
    const push = s => {
      s = s.replace(/​/g, '');
      if (!s) return;
      const last = out[out.length - 1];
      if (last && last.t === 'text' && DocModel.MARKS.every(k => (last[k] || false) === (marks[k] || false))) { last.s += s; return; }
      out.push(Object.assign({ t: 'text', s }, pickMarks(marks)));
    };
    for (const n of node.childNodes) {
      if (n.nodeType === 3) { push(n.data.replace(/\n/g, ' ')); continue; }
      if (n.nodeType !== 1) continue;
      const tag = n.tagName;
      if (n.classList.contains('im')) { out.push({ t: 'math', tex: n.dataset.tex || '' }); continue; }
      if (n.classList.contains('rf')) { out.push({ t: 'ref', key: n.dataset.key, cmd: n.dataset.cmd || 'ref' }); continue; }
      if (n.classList.contains('ri')) { out.push({ t: 'raw', tex: n.dataset.tex || '' }); continue; }
      if (n.classList.contains('ct')) { const c = { t: 'cite', key: n.dataset.key }; if (n.dataset.opt) c.opt = n.dataset.opt; out.push(c); continue; }
      if (n.classList.contains('fn')) { out.push({ t: 'fn', tex: n.dataset.tex || '' }); continue; }
      if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || n.classList.contains('dt')) continue;
      if (tag === 'A') { const r = Object.assign({ t: 'link', url: n.getAttribute('href') || '', inl: trim(readInline(n)) }, pickMarks(marks)); if (n.dataset.plain && DocModel.inlineToTex(r.inl) === DocModel.escText(r.url)) r.plain = true; out.push(r); continue; }
      if (tag === 'BR') { if (n.nextSibling || (n.parentNode !== node)) out.push({ t: 'br' }); continue; }
      if (tag === 'UL' || tag === 'OL') continue;
      if (n.classList.contains('eq') || n.classList.contains('tbl') || n.classList.contains('raw')) continue;
      const m = Object.assign({}, marks);
      const fw = n.style && n.style.fontWeight, fs = n.style && n.style.fontStyle, td = n.style && n.style.textDecoration;
      if (tag === 'B' || tag === 'STRONG' || fw === 'bold' || +fw >= 600) m.b = true;
      if (tag === 'I' || tag === 'EM' || fs === 'italic') m.i = n.dataset.cmd || 'emph';
      if (tag === 'U' || (td && td.includes('underline'))) m.u = true;
      if (tag === 'CODE' || tag === 'TT' || tag === 'KBD') m.tt = true;
      if (n.classList.contains('sc')) m.sc = true;
      if (tag === 'SUP') m.sup = true;
      if (tag === 'SUB') m.sub = true;
      if (n.dataset && n.dataset.color) m.color = n.dataset.color;
      else if (tag === 'FONT' && n.getAttribute('color')) { const hx = n.getAttribute('color').toLowerCase(); m.color = COLOR_BY_HEX[hx] || 'black'; }
      readInline(n, m, out);
    }
    return out;
  }
  function pickMarks(m) { const o = {}; for (const k of DocModel.MARKS) if (m[k]) o[k] = m[k]; return o; }
  function trim(runs) {
    while (runs.length && runs[runs.length - 1].t === 'br') runs.pop();
    if (runs.length && runs[0].t === 'text') { runs[0].s = runs[0].s.replace(/^[\s]+/, ''); if (!runs[0].s) runs.shift(); }
    if (runs.length && runs[runs.length - 1].t === 'text') { const l = runs[runs.length - 1]; l.s = l.s.replace(/[\s]+$/, ''); if (!l.s) runs.pop(); }
    return runs;
  }
  function readList(u) {
    const l = { t: 'list', ordered: u.tagName === 'OL', items: [] };
    if (u.dataset.join) l.join = true;
    if (u.classList.contains('desc')) l.desc = true;
    for (const c of u.children) {
      if (c.tagName === 'LI') {
        const it = { inl: trim(readInline(c)) };
        if (l.desc) { const dt = c.querySelector(':scope > .dt'); it.optInl = dt ? trim(readInline(dt)) : []; }
        if (c.dataset.opt != null) it.opt = c.dataset.opt;
        const sub = c.querySelector(':scope > ul, :scope > ol');
        if (sub) it.sub = readList(sub);
        l.items.push(it);
      } else if (c.tagName === 'UL' || c.tagName === 'OL') {
        const sub = readList(c);
        const prev = l.items[l.items.length - 1];
        if (prev) { if (prev.sub) prev.sub.items.push(...sub.items); else prev.sub = sub; }
        else l.items.push(...sub.items);
      }
    }
    return l;
  }
  function readBlocks(body) {
    const blocks = [];
    let loose = null; // ルート直下の文字など
    const flushLoose = () => { if (loose) { const inl = trim(loose); if (inl.length) blocks.push({ t: 'p', inl }); loose = null; } };
    for (const n of body.childNodes) {
      if (n.nodeType === 3) { if (n.data.replace(/​/g, '').trim()) { loose = loose || []; readInline({ childNodes: [n] }, {}, loose); } continue; }
      if (n.nodeType !== 1) continue;
      const tag = n.tagName, cl = n.classList;
      if (cl.contains('eq')) { flushLoose(); blocks.push(eqFromEl(n)); continue; }
      if (cl.contains('tbl')) { flushLoose(); blocks.push(tableFromEl(n)); continue; }
      if (cl.contains('box')) { flushLoose(); blocks.push(boxFromEl(n)); continue; }
      if (cl.contains('fig')) { flushLoose(); blocks.push(figFromEl(n)); continue; }
      if (cl.contains('codeb')) { flushLoose(); const b = { t: 'code', env: n.dataset.env, text: n.querySelector('pre').innerText.replace(/\n$/, '') }; if (n.dataset.opt) b.opt = n.dataset.opt; if (n.dataset.join) b.join = true; blocks.push(b); continue; }
      if (cl.contains('toc')) { flushLoose(); blocks.push({ t: 'toc', cmd: n.dataset.cmd || 'tableofcontents', join: !!n.dataset.join }); continue; }
      if (cl.contains('pb')) { flushLoose(); blocks.push({ t: 'pb', cmd: n.dataset.cmd || 'newpage', join: !!n.dataset.join }); continue; }
      if (cl.contains('appx')) { flushLoose(); blocks.push({ t: 'appendix', join: !!n.dataset.join }); continue; }
      if (cl.contains('bib')) { flushLoose(); blocks.push(bibFromEl(n)); continue; }
      if (cl.contains('raw')) { flushLoose(); const b = { t: 'raw', tex: n.dataset.tex || '' }; if (n.dataset.join) b.join = true; blocks.push(b); continue; }
      if (tag === 'UL' || tag === 'OL') { flushLoose(); const l = readList(n); if (l.items.length) blocks.push(l); continue; }
      if (/^H[1-6]$/.test(tag)) {
        flushLoose();
        const level = tag === 'H1' || tag === 'H2' ? 1 : tag === 'H3' ? 2 : 3;
        const h = { t: 'h', level, inl: trim(readInline(n)) };
        if (n.dataset.label) h.label = n.dataset.label; if (n.dataset.star) h.star = true; if (n.dataset.cmd) h.cmd = n.dataset.cmd; if (n.dataset.short != null) h.short = n.dataset.short;
        if (h.inl.length) blocks.push(h);
        continue;
      }
      if (tag === 'P' || tag === 'DIV' || tag === 'BLOCKQUOTE' || tag === 'PRE') {
        flushLoose();
        // 段落の中に入り込んだブロック（貼り付け等）も拾う
        if (n.querySelector('.eq, .tbl, .raw, .box, .fig, .codeb, ul, ol')) { blocks.push(...readBlocks(n)); continue; }
        const inl = trim(readInline(n));
        if (inl.length) { const p = { t: 'p', inl }; if (n.dataset.join) p.join = true; blocks.push(p); }
        continue;
      }
      // インライン要素がルート直下に
      loose = loose || []; readInline({ childNodes: [n] }, {}, loose);
    }
    flushLoose();
    return blocks;
  }
  function read(page) {
    const tb = page.querySelector('.titleblock');
    const doc = { blocks: readBlocks(page.querySelector('#wys')) };
    for (const k of ['title', 'author', 'date']) doc[k] = trim(readInline(tb.querySelector(`[data-f="${k}"]`)));
    return doc;
  }

  /* ---------- 番号・参照 ---------- */
  function decorate(page) {
    const labels = {};
    let n = 0;
    page.querySelectorAll('#wys .eqno').forEach(e => {
      if (e.dataset.tag) { e.textContent = '(' + e.dataset.tag + ')'; if (e.dataset.label) labels[e.dataset.label] = e.dataset.tag; }
      else if (e.dataset.auto) { n++; e.textContent = '(' + n + ')'; if (e.dataset.label) labels[e.dataset.label] = String(n); }
      else e.textContent = '';
    });
    // 見出し（付録以降は A, B, …）
    const c = [0, 0, 0]; let appx = false; const heads = [];
    for (const h of page.querySelectorAll('#wys > h2, #wys > h3, #wys > h4, #wys > .appx')) {
      if (h.classList.contains('appx')) { appx = true; c[0] = c[1] = c[2] = 0; continue; }
      const lv = { H2: 1, H3: 2, H4: 3 }[h.tagName];
      if (h.dataset.star || h.dataset.cmd === 'paragraph') { h.dataset.num = ''; heads.push({ lv, num: '', text: h.textContent }); continue; }
      c[lv - 1]++; for (let k = lv; k < 3; k++) c[k] = 0;
      const parts = c.slice(0, lv).map((x, k) => k === 0 && appx ? String.fromCharCode(64 + x) : String(x));
      const num = parts.join('.'); h.dataset.num = num;
      if (h.dataset.label) labels[h.dataset.label] = num;
      heads.push({ lv, num, text: h.textContent });
    }
    // 表・図（図は figure と生の figure を通し番号で）
    let tn = 0;
    page.querySelectorAll('#wys .tbl').forEach(t => {
      const cap = t.querySelector(':scope > .cap');
      if (cap) { tn++; cap.dataset.num = '表' + tn + '　'; if (t.dataset.label) labels[t.dataset.label] = String(tn); }
    });
    let fn = 0; const figs = [];
    page.querySelectorAll('#wys .fig, #wys .raw').forEach(r => {
      if (r.classList.contains('fig')) { fn++; const cap = r.querySelector(':scope > .cap'); cap.dataset.num = '図' + fn + '　'; if (r.dataset.label) labels[r.dataset.label] = String(fn); figs.push({ n: fn, text: cap.textContent }); return; }
      if (/\\begin\{figure\}/.test(r.dataset.tex || '')) { fn++; const lb = /\\label\{([^}]*)\}/.exec(r.dataset.tex); if (lb) labels[lb[1]] = String(fn); const t = r.querySelector('.rawtag'); if (t) t.textContent = '図' + fn; }
    });
    // 定理などの番号（種類ごと）
    const tc = {};
    page.querySelectorAll('#wys .box').forEach(b => {
      const env = b.dataset.env; const nm = b.querySelector(':scope > .boxhead > .boxname');
      if (DocModel.THM[env]) { tc[env] = (tc[env] || 0) + 1; nm.textContent = DocModel.THM[env] + ' ' + tc[env]; if (b.dataset.label) labels[b.dataset.label] = String(tc[env]); }
    });
    // 脚注・文献
    let fnn = 0; page.querySelectorAll('#wys .fn, .titleblock .fn').forEach(f => { fnn++; f.textContent = String(fnn); });
    const bibKeys = []; page.querySelectorAll('#wys .bib .bibkey').forEach(k => bibKeys.push(k.textContent.trim()));
    page.querySelectorAll('.ct').forEach(ct => {
      const keys = ct.dataset.key.split(',').map(x => x.trim());
      const nums = keys.map(k => bibKeys.indexOf(k) + 1);
      ct.textContent = '[' + nums.map((x, k) => x || keys[k] + '?').join(', ') + (ct.dataset.opt ? ', ' + ct.dataset.opt : '') + ']';
      ct.classList.toggle('bad', nums.some(x => !x));
      ct.title = nums.some(x => !x) ? '参考文献リストに「' + keys.filter((k, i) => !nums[i]).join(', ') + '」がありません' : '文献: ' + ct.dataset.key;
    });
    // 目次
    page.querySelectorAll('#wys .toc').forEach(t => {
      const cmd = t.dataset.cmd || 'tableofcontents';
      let list = t.querySelector('.toclist'); if (!list) { list = el('div', 'toclist'); t.appendChild(list); }
      list.replaceChildren();
      if (cmd === 'tableofcontents') for (const h of heads) { const d = el('div', 'tocl tocl' + h.lv, (h.num ? h.num + '　' : '') + h.text); list.appendChild(d); }
      else if (cmd === 'listoffigures') for (const f of figs) list.appendChild(el('div', 'tocl', '図' + f.n + '　' + f.text));
      else page.querySelectorAll('#wys .tbl > .cap').forEach(cp => list.appendChild(el('div', 'tocl', (cp.dataset.num || '') + cp.textContent)));
      if (!list.firstChild) list.appendChild(el('div', 'tocl muted', '（まだ項目がありません）'));
    });
    page.querySelectorAll('.rf').forEach(r => {
      const v = labels[r.dataset.key]; const paren = r.dataset.cmd === 'eqref';
      r.textContent = v ? (paren ? '(' + v + ')' : v) : (paren ? '(??)' : '??');
      r.classList.toggle('bad', !v);
      r.title = v ? '参照: ' + r.dataset.key : 'ラベル「' + r.dataset.key + '」が見つかりません';
    });
    return labels;
  }

  // 選択範囲（DOM 断片）→ LaTeX
  function fragmentToTex(container) {
    const blocks = readBlocks(container);
    if (blocks.length === 1 && blocks[0].t === 'p') return DocModel.inlineToTex(blocks[0].inl);
    return DocModel.docToTex({ fragment: true, blocks }).tex.trim();
  }
  return { render, read, readInline, readBlocks, decorate, blockToDom, inlineToDom, mathAtom, refAtom, rawAtom, citeAtom, fnAtom, linkEl, eqBlock, eqFromEl, tableBlock, tableFromEl, rawBlock, boxBlock, figBlock, codeBlock, bibBlock, bibItem, fragmentToTex, uid, el, images, COLORS, BOXNAME };
})();

'use strict';
/* =====================================================================
 *  App : Word風編集 ⇄ LaTeX の同時編集
 * ===================================================================== */
(() => {
  const $ = s => document.querySelector(s);
  // 保存先はプロジェクトごと（assets/latex/projects.js）。設定はすべてのプロジェクトで共通
  const P = window.LWProjects;
  const PID = new URLSearchParams(location.search).get('id');
  if (!PID || !P.find(PID)) { location.replace('index.html'); return; }
  const store = {
    get() { return P.load(PID); },
    set(v) { const ok = P.save(PID, { src: v.src, name: v.name }); P.saveSettings(v.settings); return ok; }
  };
  const saved = store.get() || {};
  const settings = Object.assign({ autoWords: true, keyboard: true, welcome: true, view: 'split', dollarInTex: false }, P.settings());

  /* ---------------- テンプレート ---------------- */
  const SAMPLE = String.raw`\documentclass[a4paper,11pt]{ltjsarticle}
\usepackage{amsmath,amssymb}
\usepackage{bm}

\title{実験レポート：単振り子の周期}
\author{山田 太郎}
\date{\today}

\begin{document}
\maketitle

\section{目的}
単振り子の周期 $T$ が振り子の長さ $l$ にどう依存するかを調べ，重力加速度 $g$ を求める．

\section{理論}
振れ角 $\theta$ が十分小さいとき，運動方程式は
\begin{equation}\label{eq:motion}
  \frac{d^2\theta}{dt^2} = -\frac{g}{l}\theta
\end{equation}
となる．式\eqref{eq:motion}の解は $\theta(t) = \theta_0 \cos(\omega t)$ であり，周期は
\begin{equation}\label{eq:period}
  T = 2\pi\sqrt{\frac{l}{g}}
\end{equation}
で与えられる．

\section{結果}
測定値を表\ref{tab:data}に示す．
\begin{table}[h]
  \centering
  \caption{振り子の長さと周期}
  \label{tab:data}
  \begin{tabular}{c|c}
    \hline
    $l$ [m] & $T$ [s] \\
    \hline
    0.50 & 1.42 \\
    1.00 & 2.01 \\
    \hline
  \end{tabular}
\end{table}

式\eqref{eq:period}を変形すると
\begin{align}
  g &= \frac{4\pi^2 l}{T^2} \\
  &\approx 9.77\ \mathrm{m/s^2}
\end{align}
を得る．

\section{考察}
\begin{itemize}
  \item 誤差の主な原因は振れ角の近似 $\sin\theta \approx \theta$ である．
  \item 空気抵抗による減衰は無視できた．
\end{itemize}

\end{document}
`;
  const BLANK = String.raw`\documentclass[a4paper,11pt]{ltjsarticle}
\usepackage{amsmath,amssymb}
\usepackage{bm}

\title{}
\author{}
\date{\today}

\begin{document}
\maketitle

\section{はじめに}


\end{document}
`;

  /* ---------------- 要素 ---------------- */
  const page = $('#page'), wys = $('#wys'), ta = $('#src'), hl = $('#hl');
  const docName = $('#docName');
  docName.value = saved.name || 'report';
  let meta = { preamble: null, tail: '', fragment: false, maketitle: true };
  let ranges = [];          // 各ブロックの LaTeX 上の位置
  let lastLabels = {};

  document.execCommand('defaultParagraphSeparator', false, 'p');
  document.execCommand('styleWithCSS', false, false);

  let toastT = 0;
  function toast(msg, ms) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms || 2400); }

  /* =================================================================
   *  同期
   * ================================================================= */
  let suppressTex = false;
  function loadTex(tex, keepTa) {
    const doc = DocModel.texToDoc(tex);
    meta = { preamble: doc.preamble, tail: doc.tail, fragment: doc.fragment, maketitle: doc.maketitle };
    if (typeof hist !== 'undefined' && hist.undo && wys.firstChild) hist.push();
    Wys.render(doc, page);
    ranges = doc.blocks.map(b => ({ start: b._s, end: b._e }));
    if (!keepTa) { ta.value = tex; }
    lastLabels = Wys.decorate(page);
    refreshHighlight();
    updateCounts();
  }
  // 編集画面 → LaTeX
  let wysT = 0;
  function scheduleFromWys() { clearTimeout(wysT); wysT = setTimeout(syncFromWys, 120); markDirty(); }
  function syncFromWys() {
    clearTimeout(wysT);
    ensureBody();
    const d = Wys.read(page);
    const doc = Object.assign({}, meta, d);
    const out = DocModel.docToTex(doc);
    ranges = out.ranges;
    if (ta.value !== out.tex) {
      const st = ta.scrollTop;
      ta.value = out.tex;
      ta.scrollTop = st;
    }
    lastLabels = Wys.decorate(page);
    refreshHighlight();
    updateCounts();
    scheduleSave();
  }
  // LaTeX → 編集画面
  let texT = 0;
  function scheduleFromTex() { clearTimeout(texT); texT = setTimeout(() => { loadTex(ta.value, true); scheduleSave(); }, 350); markDirty(); refreshHighlight(); }
  function ensureBody() { if (!wys.firstElementChild) { const p = document.createElement('p'); p.appendChild(document.createElement('br')); wys.appendChild(p); } }

  /* ---------------- LaTeX 欄 ---------------- */
  let regions = [], activeRange = null;
  function hlSlice(src, a, b, cur) {
    const regs = regions.filter(r => r.start >= a && r.end <= b).map(r => Object.assign({}, r, { start: r.start - a, end: r.end - a, _o: r }));
    const c = cur ? regs.find(r => r._o === cur) : null;
    return TexDoc.highlight(src.slice(a, b), regs, c).replace(/\n$/, '');
  }
  function refreshHighlight() {
    const src = ta.value;
    regions = TexDoc.scanMath(src);
    const cur = document.activeElement === ta ? TexDoc.regionAt(regions, ta.selectionStart) : null;
    let html;
    const r = activeRange;
    if (r && r.end <= src.length && r.start >= 0 && !regions.some(g => (g.start < r.start && g.end > r.start) || (g.start < r.end && g.end > r.end))) {
      html = hlSlice(src, 0, r.start, cur) + '<span class="hl-blk" id="hlBlk">' + hlSlice(src, r.start, r.end, cur) + '</span>' + hlSlice(src, r.end, src.length, cur) + '\n';
    } else html = TexDoc.highlight(src, regions, cur);
    hl.innerHTML = html;
    hl.scrollTop = ta.scrollTop;
    $('#stEdit').hidden = !cur;
  }
  ta.addEventListener('scroll', () => { hl.scrollTop = ta.scrollTop; });
  ta.addEventListener('input', () => { activeRange = null; scheduleFromTex(); });
  // LaTeX 側のカーソル → 編集画面の該当ブロック
  function syncCaretFromTex() {
    refreshHighlight();
    const pos = ta.selectionStart;
    const k = ranges.findIndex(r => r && pos >= r.start && pos <= r.end);
    wys.querySelectorAll('.sync').forEach(e => e.classList.remove('sync'));
    const blk = k >= 0 ? wys.children[k] : null;
    if (blk) {
      blk.classList.add('sync');
      const pr = $('#pscroll').getBoundingClientRect(), br = blk.getBoundingClientRect();
      if (br.top < pr.top || br.bottom > pr.bottom) $('#pscroll').scrollBy({ top: br.top - pr.top - pr.height * .3, behavior: 'smooth' });
    }
    const before = ta.value.slice(0, pos);
    $('#stPos').textContent = `${before.split('\n').length} 行`;
  }
  ['keyup', 'click', 'focus'].forEach(ev => ta.addEventListener(ev, syncCaretFromTex));
  ta.addEventListener('blur', () => { wys.querySelectorAll('.sync').forEach(e => e.classList.remove('sync')); });
  ta.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === 'm' || e.key === 'M')) {
      e.preventDefault();
      const r = TexDoc.regionAt(regions, ta.selectionStart);
      if (r) editTexRegion(r); else openTexInsert(e.shiftKey ? 'display' : 'inline');
    }
    if (e.key === 'Tab' && !mod) { e.preventDefault(); document.execCommand('insertText', false, '  '); }
  });
  $('#stEdit').addEventListener('mousedown', e => e.preventDefault());
  $('#stEdit').addEventListener('click', () => { const r = TexDoc.regionAt(regions, ta.selectionStart); if (r) editTexRegion(r); });
  function taReplace(a, b, text) {
    ta.focus(); ta.setSelectionRange(a, b);
    let ok = false; try { ok = document.execCommand('insertText', false, text); } catch (e) { }
    if (!ok) ta.setRangeText(text, a, b, 'end');
    scheduleFromTex();
  }
  function editTexRegion(r) {
    const content = ta.value.slice(r.cs, r.ce);
    let mode = r.kind === 'inline' ? 'inline' : 'display', label = '', tex = content.trim(), numbered = true;
    if (r.kind === 'env') {
      const base = r.env.replace(/\*$/, '');
      if (base === 'equation') mode = r.env.endsWith('*') ? 'display' : 'equation';
      else if (base === 'align') { mode = 'align'; numbered = !r.env.endsWith('*'); }
      const m = /\\label\{([^}]*)\}/.exec(tex); if (m && mode !== 'align') { label = m[1]; tex = tex.replace(m[0], '').trim(); }
    }
    openMath({
      latex: tex, mode, label, numbered, editing: true, onOk: res => {
        if (!res.latex) { taReplace(r.start, r.end, ''); return; }
        const text = res.mode === 'inline' ? '$' + res.latex + '$' : DocModel.eqToTex({ mode: res.mode, tex: res.latex, label: res.label, numbered: res.numbered });
        taReplace(r.start, r.end, text);
      }, onCancel: () => ta.focus()
    });
  }
  function openTexInsert(mode) {
    const a = ta.selectionStart, b = ta.selectionEnd;
    openMath({
      latex: '', mode, onOk: res => {
        if (!res.latex) { ta.focus(); return; }
        let text = res.mode === 'inline' ? '$' + res.latex + '$' : DocModel.eqToTex({ mode: res.mode, tex: res.latex, label: res.label, numbered: res.numbered });
        if (res.mode !== 'inline') { if (a > 0 && ta.value[a - 1] !== '\n') text = '\n' + text; if (ta.value[b] && ta.value[b] !== '\n') text += '\n'; }
        taReplace(a, b, text);
      }, onCancel: () => ta.focus()
    });
  }

  /* =================================================================
   *  編集画面
   * ================================================================= */
  page.addEventListener('input', e => {
    const t = e.target;
    if (t.classList && t.classList.contains('figfile')) { t.setAttribute('value', t.value); t.closest('.fig').dataset.file = t.value; }
    page.querySelectorAll('.boxbody').forEach(b => { if (!b.firstElementChild) { const p = document.createElement('p'); p.innerHTML = '<br>'; b.appendChild(p); } });
    scheduleFromWys();
  });
  page.addEventListener('change', e => {
    const t = e.target;
    if (t.classList && t.classList.contains('figw')) {
      hist.push();
      [...t.options].forEach(o => o.toggleAttribute('selected', o.value === t.value));
      const img = t.closest('.fig').querySelector('.figimg'); if (t.value) img.style.width = Math.round(t.value * 100) + '%';
      syncFromWys();
    }
  });
  // 選択位置
  let savedRange = null;
  function saveRange() { const s = getSelection(); if (s.rangeCount && page.contains(s.anchorNode)) savedRange = s.getRangeAt(0).cloneRange(); return savedRange; }
  function restoreRange(r) {
    r = r || savedRange; if (!r) return false;
    const host = hostOf(r.startContainer) || wys;
    if (document.activeElement !== host) host.focus({ preventScroll: true });
    const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true;
  }
  function hostOf(node) { while (node && node !== page) { if (node.nodeType === 1 && node.isContentEditable && node.getAttribute('contenteditable') === 'true') return node; node = node.parentNode; } return null; }
  const isBlockHost = n => n === wys || (n && n.nodeType === 1 && n.classList.contains('boxbody'));
  function blockHost(node) { while (node && node !== page) { if (isBlockHost(node)) return node; node = node.parentNode; } return null; }
  function topBlock(node) { const h = blockHost(node); if (!h) return null; while (node && node.parentNode !== h) node = node.parentNode; return node && node.parentNode === h ? node : null; }
  function topLevel(node) { while (node && node.parentNode !== wys) node = node.parentNode; return node && node.parentNode === wys ? node : null; }
  function caretContext() {
    const s = getSelection(); if (!s.rangeCount) return {};
    const n = s.anchorNode; if (!page.contains(n)) return {};
    const host = hostOf(n);
    const el = n.nodeType === 1 ? n : n.parentElement;
    const inMain = isBlockHost(host);
    return { host, inMain, block: inMain ? topBlock(n) : null, td: el && el.closest('td'), title: host && host.dataset.f, link: el && el.closest('#page a'), heading: el && el.closest('#wys h2, #wys h3, #wys h4') };
  }
  function html(node) { return node.outerHTML; }
  function exec(cmd, val) { document.execCommand(cmd, false, val); }
  function focusEnd(elm) { const r = document.createRange(); r.selectNodeContents(elm); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  function setCaret(node, off) { const r = document.createRange(); r.setStart(node, off); r.collapse(true); restoreRange(r); }
  function isEmptyBlock(b) { return !b.textContent.replace(/[\u200b\s]/g, '') && !b.querySelector('.im,.rf,.ri'); }
  // インライン要素をカーソル位置へ（取り消し履歴は自前）
  function insertInline(nodes, range) {
    range = range || (getSelection().rangeCount ? getSelection().getRangeAt(0) : null);
    if (!range) return;
    hist.push();
    range.deleteContents();
    let last = null;
    for (const n of nodes) { range.insertNode(n); range.setStartAfter(n); range.collapse(true); last = n; }
    if (last && last.nodeType === 1 && last.contentEditable === 'false' && (!last.nextSibling || (last.nextSibling.nodeType === 1 && last.nextSibling.tagName === 'BR'))) {
      const z = document.createTextNode('\u200b'); last.after(z); setCaret(z, 1);
    } else if (last) { const r = document.createRange(); r.setStartAfter(last); r.collapse(true); restoreRange(r); }
    syncFromWys();
  }
  // ブロックをカーソル位置へ（段落を分割）
  function insertBlocks(els, range) {
    range = range || (getSelection().rangeCount ? getSelection().getRangeAt(0) : null);
    hist.push();
    let blk = range ? topBlock(range.startContainer) : null;
    let after = null;
    if (!blk) { wys.append(...els); after = document.createElement('p'); after.dataset.join = '1'; after.innerHTML = '<br>'; els[els.length - 1].after(after); }
    else if (blk.tagName === 'UL' || blk.tagName === 'OL' || blk.contentEditable === 'false') { blk.after(...els); }
    else if ((() => { const pre = document.createRange(); pre.selectNodeContents(blk); pre.setEnd(range.startContainer, range.startOffset); const f = pre.cloneContents(); return !f.textContent.replace(/[\u200b\s]/g, '') && !f.querySelector || (!f.textContent.replace(/[\u200b\s]/g, '') && !f.querySelector('.im,.rf,.ri,.ct,.fn')); })() && !isEmptyBlock(blk)) {
      // 段落・見出しの先頭なら、その前に入れる
      blk.before(...els);
      after = blk;
    }
    else {
      range.deleteContents();
      const tailR = document.createRange(); tailR.setStart(range.startContainer, range.startOffset); tailR.setEndAfter(blk.lastChild || blk);
      const tail = tailR.extractContents();
      const tailBlk = document.createElement('p'); tailBlk.appendChild(tail.firstChild && tail.firstChild.nodeType === 1 && tail.firstChild.tagName === blk.tagName ? (() => { const f = document.createDocumentFragment(); while (tail.firstChild.firstChild) f.appendChild(tail.firstChild.firstChild); return f; })() : tail);
      if (isEmptyBlock(blk)) { blk.replaceWith(...els); }
      else blk.after(...els);
      if (!isEmptyBlock(tailBlk)) { tailBlk.dataset.join = '1'; els[els.length - 1].after(tailBlk); after = tailBlk; }
    }
    if (!after) { const nx = els[els.length - 1].nextElementSibling; if (nx && nx.tagName === 'P' && isEmptyBlock(nx)) after = nx; else { after = document.createElement('p'); after.dataset.join = '1'; after.innerHTML = '<br>'; els[els.length - 1].after(after); } }
    setCaret(after, 0);
    syncFromWys();
    return after;
  }
  /* ---------------- 取り消し履歴（自前） ---------------- */
  const hist = {
    undo: [], redo: [], lastT: 0,
    snap() {
      let caret = null;
      const s = getSelection();
      if (s.rangeCount && wys.contains(s.anchorNode)) { const r = document.createRange(); r.setStart(wys, 0); r.setEnd(s.anchorNode, s.anchorOffset); caret = r.toString().length; }
      return { html: wys.innerHTML, title: [...page.querySelectorAll('.titleblock [data-f]')].map(f => f.innerHTML), caret };
    },
    push() { this.undo.push(this.snap()); if (this.undo.length > 200) this.undo.shift(); this.redo = []; this.lastT = Date.now(); },
    typed() { if (Date.now() - this.lastT > 900) this.push(); this.lastT = Date.now(); },
    apply(st) {
      wys.innerHTML = st.html;
      page.querySelectorAll('.titleblock [data-f]').forEach((f, k) => f.innerHTML = st.title[k]);
      if (st.caret != null) {
        let left = st.caret; const w = document.createTreeWalker(wys, NodeFilter.SHOW_TEXT); let n, done = false;
        while ((n = w.nextNode())) {
          if (n.parentElement.closest('[contenteditable="false"]')) { if (left <= n.data.length) { const a = n.parentElement.closest('[contenteditable="false"]'); const r = document.createRange(); r.setStartAfter(a); r.collapse(true); restoreRange(r); done = true; break; } left -= n.data.length; continue; }
          if (left <= n.data.length) { setCaret(n, left); done = true; break; }
          left -= n.data.length;
        }
        if (!done) { wys.focus(); focusEnd(wys); }
      }
      syncFromWys();
    },
    doUndo() { if (!this.undo.length) { toast('これ以上戻せません'); return; } this.redo.push(this.snap()); this.apply(this.undo.pop()); this.lastT = 0; },
    doRedo() { if (!this.redo.length) return; this.undo.push(this.snap()); this.apply(this.redo.pop()); this.lastT = 0; }
  };
  page.addEventListener('beforeinput', e => {
    if (e.inputType === 'historyUndo') { e.preventDefault(); hist.doUndo(); return; }
    if (e.inputType === 'historyRedo') { e.preventDefault(); hist.doRedo(); return; }
    if (e.inputType.startsWith('insertText') || e.inputType.startsWith('insertComposition')) hist.typed(); else hist.push();
  });

  // 数式の挿入
  function insertMath(res, range) {
    restoreRange(range);
    const ctx = caretContext();
    if (!res.latex) return;
    if (res.mode === 'inline' || !ctx.inMain) insertInline([Wys.mathAtom(res.latex)], getSelection().getRangeAt(0));
    else {
      const b = { t: 'eq', mode: res.mode, tex: res.latex, label: res.label || undefined, numbered: res.numbered, join: true };
      if (res.mode === 'equation' && !b.label) b.label = 'eq:' + Wys.uid();
      insertBlocks([Wys.eqBlock(b)], getSelection().getRangeAt(0));
    }
  }
  function replaceNode(node, rep) {
    hist.push();
    const nodes = rep == null || rep === '' ? [] : (Array.isArray(rep) ? rep : [rep]);
    const parent = node.parentNode;
    if (!nodes.length) {
      if (node.classList.contains('eq') || node.classList.contains('raw') || node.classList.contains('tbl')) { const nx = node.nextElementSibling || node.previousElementSibling; node.remove(); ensureBody(); const t = nx || wys.firstElementChild; wys.focus(); if (t) focusEnd(t); }
      else { const r = document.createRange(); r.setStartBefore(node); r.collapse(true); node.remove(); restoreRange(r); }
    } else {
      node.replaceWith(...nodes);
      const last = nodes[nodes.length - 1];
      const r = document.createRange(); r.setStartAfter(last); r.collapse(true); restoreRange(r);
    }
    syncFromWys();
  }
  function editAtom(atom) {
    const s = getSelection(); const r = document.createRange(); r.selectNode(atom); s.removeAllRanges(); s.addRange(r);
    openMath({
      latex: atom.dataset.tex, mode: 'inline', editing: true, allowBlock: !!topBlock(atom),
      onOk: res => {
        if (!res.latex) return replaceNode(atom, '');
        if (res.mode === 'inline') return replaceNode(atom, Wys.mathAtom(res.latex));
        const b = { t: 'eq', mode: res.mode, tex: res.latex, label: res.label || (res.mode === 'equation' ? 'eq:' + Wys.uid() : undefined), numbered: res.numbered, join: true };
        // 段落の途中なら分割して別行に
        const r = document.createRange(); r.selectNode(atom); hist.push(); atom.remove(); restoreRange(r);
        insertBlocks([Wys.eqBlock(b)], getSelection().getRangeAt(0));
      }, onCancel: () => { }
    });
  }
  function editEq(blk) {
    const b = Wys.eqFromEl(blk);
    let mode = b.mode === 'env' ? 'display' : b.mode;
    openMath({
      latex: b.tex, mode, label: b.label || '', numbered: b.numbered !== false, editing: true, allowBlock: true, keepEnv: b.mode === 'env' ? b.env : null,
      onOk: res => {
        if (!res.latex) return replaceNode(blk, '');
        if (res.mode === 'inline') { const p = document.createElement('p'); p.dataset.join = '1'; p.appendChild(Wys.mathAtom(res.latex)); return replaceNode(blk, p); }
        const nb = { t: 'eq', mode: res.mode, tex: res.latex, label: res.label || undefined, numbered: res.numbered, join: b.join };
        if (b.mode === 'env' && res.mode === 'display' && b.env) { nb.mode = 'env'; nb.env = b.env; }
        if (b.mode === res.mode && b.env && res.mode === 'display') nb.env = b.env;
        if (b.delim && res.mode === 'display') nb.delim = b.delim;
        if (res.mode === 'equation' && !nb.label) nb.label = 'eq:' + Wys.uid();
        replaceNode(blk, Wys.eqBlock(nb));
      }, onCancel: () => { }
    });
  }
  // クリック
  page.addEventListener('click', e => {
    const del = e.target.closest('.bx-del');
    if (del) { e.preventDefault(); const blk = del.closest('.box, .fig, .codeb, .toc, .pb, .appx, .bib, .raw, .tbl'); if (blk) { replaceNode(blk, ''); toast('削除しました（Ctrl+Z で元に戻せます）'); } return; }
    const fnA = e.target.closest('.fn'); if (fnA) { e.preventDefault(); editFootnote(fnA); return; }
    const bk = e.target.closest('.bibkey'); if (bk) { e.preventDefault(); renameBibKey(bk); return; }
    const ba = e.target.closest('.bib-add'); if (ba) { e.preventDefault(); addBibItem(ba.closest('.bib')); return; }
    const fi = e.target.closest('.figimg'); if (fi) { e.preventDefault(); pickImage(fi.closest('.fig')); return; }
    const ct = e.target.closest('.ct'); if (ct) { e.preventDefault(); const r = document.createRange(); r.selectNode(ct); restoreRange(r); return; }
    const atom = e.target.closest('.im');
    if (atom && page.contains(atom)) { e.preventDefault(); editAtom(atom); return; }
    const eq = e.target.closest('.eq');
    if (eq) { e.preventDefault(); editEq(eq); return; }
    const ri = e.target.closest('.ri, .raw');
    if (ri) { e.preventDefault(); editRaw(ri); return; }
  });
  // キー操作
  page.addEventListener('keydown', e => {
    if (e.isComposing || e.keyCode === 229) return;
    const mod = e.ctrlKey || e.metaKey;
    const ctx = caretContext();
    if ((e.key === '$' && !mod && !e.altKey) || (mod && !e.altKey && (e.key === 'm' || e.key === 'M'))) {
      e.preventDefault();
      const r = saveRange();
      const sel = getSelection().toString();
      openMath({ latex: '', mode: mod && e.shiftKey ? 'display' : 'inline', allowBlock: ctx.inMain, initialPaste: sel, onOk: res => insertMath(res, r), onCancel: () => restoreRange(r) });
      return;
    }
    if (ctx.title && e.key === 'Enter') { e.preventDefault(); const f = page.querySelector('.titleblock [data-f="' + ({ title: 'author', author: 'date', date: 'x' }[ctx.title]) + '"]'); if (f) { f.focus(); focusEnd(f); } else toMainEnd(); return; }
    const capEl = (() => { const n = getSelection().anchorNode; const el = n && (n.nodeType === 1 ? n : n.parentElement); return el && el.closest('.cap'); })();
    if (capEl && (e.key === 'Tab' || e.key === 'Enter')) { e.preventDefault(); const td = capEl.parentElement.querySelector('td'); if (td) { td.focus(); focusEnd(td); } return; }
    if (ctx.td && e.key === 'Enter') { e.preventDefault(); if (ctx.td) { const tr = ctx.td.parentElement; const next = tr.nextElementSibling; const td = next ? next.children[ctx.td.cellIndex] : null; if (td) { td.focus(); focusEnd(td); } else { tableOp('addRow'); } } return; }
    if (e.key === 'Tab') {
      if (ctx.td) { e.preventDefault(); const tds = [...ctx.td.closest('table').querySelectorAll('td')]; const k = tds.indexOf(ctx.td) + (e.shiftKey ? -1 : 1); if (tds[k]) { tds[k].focus(); focusEnd(tds[k]); } else if (!e.shiftKey) tableOp('addRow'); return; }
      const li = ctx.block && ['UL', 'OL'].includes(ctx.block.tagName);
      e.preventDefault();
      if (li) exec(e.shiftKey ? 'outdent' : 'indent');
      return;
    }
    if (mod && !e.altKey && e.key.toLowerCase() === 'u') { e.preventDefault(); hist.push(); exec('underline'); }
    if (mod && !e.altKey && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? hist.doRedo() : hist.doUndo(); return; }
    if (mod && !e.altKey && e.key.toLowerCase() === 'y') { e.preventDefault(); hist.doRedo(); return; }
    if (mod && !e.altKey && (e.key.toLowerCase() === 'b' || e.key.toLowerCase() === 'i')) hist.push();
    // 見出しの先頭で Backspace → 本文に戻す（Word と同じ）
    if (e.key === 'Backspace' && ctx.block && /^H[234]$/.test(ctx.block.tagName)) {
      const s = getSelection(); const r = s.getRangeAt(0);
      const pre = document.createRange(); pre.selectNodeContents(ctx.block); pre.setEnd(r.startContainer, r.startOffset);
      if (s.isCollapsed && !pre.toString()) { e.preventDefault(); exec('formatBlock', 'p'); }
    }
  });
  // オートフォーマット（# 見出し、- 箇条書き、1. 番号）
  page.addEventListener('input', e => {
    if (e.inputType !== 'insertText' || (e.data !== ' ' && e.data !== '\u3000')) return;
    const ctx = caretContext(); const blk = ctx.block;
    if (!blk || blk.tagName !== 'P') return;
    const text = blk.textContent.replace(/\u200b/g, '');
    const m = /^(#{1,3}|[-*・]|1[.．]|１[.．])[\s\u00a0\u3000]/.exec(text);
    if (!m) return;
    const s = getSelection(); const r = s.getRangeAt(0);
    const pre = document.createRange(); pre.selectNodeContents(blk); pre.setEnd(r.startContainer, r.startOffset);
    if (pre.toString().replace(/\u200b/g, '').length !== m[0].length) return;
    hist.push(); restoreRange(pre); exec('delete');
    const mk = m[1];
    if (mk[0] === '#') exec('formatBlock', ['h2', 'h3', 'h4'][mk.length - 1]);
    else if (/^[-*・]$/.test(mk)) exec('insertUnorderedList');
    else exec('insertOrderedList');
    scheduleFromWys();
  });
  // 貼り付け：LaTeX は解釈、それ以外はプレーンテキスト
  page.addEventListener('paste', e => {
    const t = (e.clipboardData || window.clipboardData).getData('text/plain');
    if (!t) return;
    e.preventDefault();
    const ctx = caretContext();
    if (/\\[a-zA-Z]|\$/.test(t)) {
      const doc = DocModel.texToDoc(t);
      const blocks = doc.blocks;
      if (blocks.length === 1 && blocks[0].t === 'p' || !ctx.inMain) {
        const span = document.createElement('span');
        for (const b of blocks) Wys.inlineToDom(b.inl || [{ t: 'raw', tex: DocModel.blockToTex(b) }], span);
        insertInline([...span.childNodes]);
      } else insertBlocks(blocks.map(b => Wys.blockToDom(b)));
    } else { hist.push(); exec('insertText', t); syncFromWys(); }
  });
  // コピー：プレーンテキストとして LaTeX を渡す
  page.addEventListener('copy', e => {
    const s = getSelection(); if (!s.rangeCount || s.isCollapsed) return;
    const div = document.createElement('div'); div.appendChild(s.getRangeAt(0).cloneContents());
    const hasBlocks = div.querySelector('p,h2,h3,h4,ul,ol,.eq,.tbl,.raw');
    let tex;
    if (hasBlocks) tex = Wys.fragmentToTex(div);
    else tex = DocModel.inlineToTex(Wys.readInline(div));
    e.clipboardData.setData('text/plain', tex);
    e.clipboardData.setData('text/html', div.innerHTML);
    e.preventDefault();
  });
  page.addEventListener('cut', e => { setTimeout(syncFromWys, 0); });

  // 編集画面のカーソル → LaTeX の該当箇所
  document.addEventListener('selectionchange', () => {
    const s = getSelection();
    if (!s.rangeCount || !page.contains(s.anchorNode)) return;
    updateToolbar();
    const blk = topLevel(s.anchorNode);
    const k = blk ? [...wys.children].indexOf(blk) : -1;
    const r = k >= 0 ? ranges[k] : null;
    if (r && (!activeRange || activeRange.start !== r.start || activeRange.end !== r.end)) {
      activeRange = r; refreshHighlight();
      const m = $('#hlBlk');
      if (m && settings.view === 'split') {
        const top = m.offsetTop, bot = top + m.offsetHeight;
        if (top < ta.scrollTop + 20 || bot > ta.scrollTop + ta.clientHeight - 20) { ta.scrollTop = Math.max(0, top - ta.clientHeight * .3); hl.scrollTop = ta.scrollTop; }
      }
    }
  });

  /* ---------------- ツールバー ---------------- */
  const styleSel = $('#styleSel');
  function updateToolbar() {
    const ctx = caretContext();
    for (const [id, cmd] of [['tbB', 'bold'], ['tbI', 'italic'], ['tbU', 'underline']]) { let on = false; try { on = document.queryCommandState(cmd); } catch (e) { } $('#' + id).classList.toggle('on', on); }
    const b = ctx.block;
    let v = 'p';
    if (b) { if (b.tagName === 'H2') v = 'h2'; else if (b.tagName === 'H3') v = 'h3'; else if (b.tagName === 'H4') v = 'h4'; else if (b.tagName === 'UL') v = 'ul'; else if (b.tagName === 'OL') v = 'ol'; }
    styleSel.value = ['ul', 'ol'].includes(v) ? 'p' : v;
    styleSel.disabled = !ctx.inMain;
    $('#tbUl').classList.toggle('on', v === 'ul'); $('#tbOl').classList.toggle('on', v === 'ol');
    $('#tblGroup').hidden = !ctx.td;
  }
  function keepFocus(btn) { btn.addEventListener('mousedown', e => e.preventDefault()); }
  document.querySelectorAll('.toolbar button').forEach(keepFocus);
  function needCaret() { const s = getSelection(); if (s.rangeCount && page.contains(s.anchorNode)) return true; ensureBody(); const last = wys.lastElementChild; wys.focus(); focusEnd(last); return true; }
  styleSel.addEventListener('change', () => {
    restoreRange(); hist.push();
    const v = styleSel.value; const ctx = caretContext();
    if (ctx.block && ['UL', 'OL'].includes(ctx.block.tagName)) exec(ctx.block.tagName === 'UL' ? 'insertUnorderedList' : 'insertOrderedList');
    exec('formatBlock', v);
    syncFromWys();
  });
  styleSel.addEventListener('mousedown', () => saveRange());
  styleSel.addEventListener('focus', () => saveRange());
  const TB = {
    undo: () => hist.doUndo(), redo: () => hist.doRedo(),
    bold: () => { needCaret(); hist.push(); exec('bold'); syncFromWys(); }, italic: () => { needCaret(); hist.push(); exec('italic'); syncFromWys(); }, underline: () => { needCaret(); hist.push(); exec('underline'); syncFromWys(); },
    ul: () => { needCaret(); hist.push(); exec('insertUnorderedList'); syncFromWys(); }, ol: () => { needCaret(); hist.push(); exec('insertOrderedList'); syncFromWys(); },
    mInline: () => mathFromToolbar('inline'), mDisplay: () => mathFromToolbar('display'), mEquation: () => mathFromToolbar('equation'), mAlign: () => mathFromToolbar('align'),
    table: () => insertTable(), figure: () => insertFigure(), raw: () => insertRawBlock(''), ref: btn => openRefPicker(btn), footnote: () => insertFootnote(),
    addRow: () => tableOp('addRow'), addCol: () => tableOp('addCol'), delRow: () => tableOp('delRow'), delCol: () => tableOp('delCol'), delTable: () => tableOp('delTable')
  };
  document.querySelectorAll('[data-tb]').forEach(b => b.addEventListener('click', () => { const f = TB[b.dataset.tb]; if (f) f(b); }));
  function mathFromToolbar(mode) {
    needCaret();
    const ctx = caretContext(); const r = saveRange();
    if (!ctx.inMain && mode !== 'inline') mode = 'inline';
    openMath({ latex: '', mode, allowBlock: ctx.inMain, initialPaste: getSelection().toString(), onOk: res => insertMath(res, r), onCancel: () => restoreRange(r) });
  }
  function insertTable() {
    needCaret(); if (!caretContext().inMain) toMainEnd();
    const t = { t: 'table', float: true, placement: 'h', spec: 'ccc', label: 'tab:' + Wys.uid(), caption: [], rows: [[[], [], []], [[], [], []], [[], [], []]], hlines: [0, 1, 3] };
    const tb = Wys.tableBlock(t);
    insertBlocks([tb]);
    const cap = tb.querySelector('.cap'); cap.focus(); focusEnd(cap);
  }
  function tableOp(op) {
    const ctx = caretContext(); const td = ctx.td; if (!td) return;
    const tbl = td.closest('.tbl'); const table = td.closest('table'); const tr = td.parentElement;
    const ci = td.cellIndex, rows = [...table.rows];
    hist.push();
    const mkTd = (al) => { const c = document.createElement('td'); c.contentEditable = 'true'; if (al) c.style.textAlign = al; return c; };
    let focus = null;
    if (op === 'addRow') { const nr = document.createElement('tr'); for (const c of tr.children) nr.appendChild(mkTd(c.style.textAlign)); tr.after(nr); focus = nr.children[0]; if (tr === rows[rows.length - 1] && tbl.dataset.hlEnd) { } }
    if (op === 'addCol') { for (const r of rows) { const c = mkTd(r.children[ci] && r.children[ci].style.textAlign); r.children[ci] ? r.children[ci].after(c) : r.appendChild(c); } focus = tr.children[ci + 1]; addSpecCol(tbl, ci); }
    if (op === 'delRow') { if (rows.length <= 1) return; const nx = tr.nextElementSibling || tr.previousElementSibling; tr.remove(); focus = nx.children[Math.min(ci, nx.children.length - 1)]; }
    if (op === 'delCol') { if (tr.children.length <= 1) return; for (const r of rows) if (r.children[ci]) r.children[ci].remove(); focus = tr.children[Math.min(ci, tr.children.length - 1)]; delSpecCol(tbl, ci); }
    if (op === 'delTable') { tbl.remove(); syncFromWys(); toast('表を削除しました'); return; }
    syncFromWys();
    if (focus) { focus.focus(); focusEnd(focus); }
  }
  function specCols(spec) { return (spec || '').replace(/[^lcr]/g, '').split(''); }
  function addSpecCol(tbl, ci) { const s = tbl.dataset.spec || ''; if (!/^[lcr|\s]*$/.test(s)) return; const cols = specCols(s); cols.splice(ci + 1, 0, 'c'); tbl.dataset.spec = s.includes('|') ? cols.join('|') : cols.join(''); }
  function delSpecCol(tbl, ci) { const s = tbl.dataset.spec || ''; if (!/^[lcr|\s]*$/.test(s)) return; const cols = specCols(s); cols.splice(ci, 1); tbl.dataset.spec = s.includes('|') ? cols.join('|') : cols.join(''); }
  function insertFootnote() {
    needCaret(); const r = saveRange();
    textDialog('脚注を入れる', '', '脚注の文（数式は $…$ で書けます）', text => { restoreRange(r); if (text.trim()) insertInline([Wys.fnAtom(textToTex(text.trim()))], getSelection().getRangeAt(0)); });
  }
  function editFootnote(f) {
    textDialog('脚注を編集', texToText(f.dataset.tex), '脚注の文（数式は $…$ で書けます）。空にすると削除します。', text => {
      if (!text.trim()) return replaceNode(f, '');
      hist.push(); f.dataset.tex = textToTex(text.trim()); f.title = '脚注: ' + text.trim(); syncFromWys();
    });
  }

  /* ---------------- 生 LaTeX（ブロック／インライン） ---------------- */
  function toMainEnd() { ensureBody(); const last = wys.lastElementChild; wys.focus(); if (isEmptyBlock(last) && last.tagName === 'P') setCaret(last, 0); else focusEnd(last); }
  function insertRawBlock(tex) {
    needCaret(); let ctx = caretContext();
    if (tex && !ctx.inMain) { toMainEnd(); ctx = caretContext(); }
    const r = saveRange();
    const go = t => { if (!t.trim()) return; restoreRange(r); if (ctx.inMain) insertBlocks([Wys.rawBlock({ t: 'raw', tex: t })], getSelection().getRangeAt(0)); else insertInline([Wys.rawAtom(t)], getSelection().getRangeAt(0)); };
    if (tex) { go(tex); toast('図はLaTeXのまま保持されます。クリックするとファイル名などを編集できます'); }
    else rawDialog('LaTeX を直接入力', '', 'この部分はLaTeXのまま出力されます（例: \\newpage, \\tableofcontents）', go);
  }
  function editRaw(node) {
    const isBlock = node.classList.contains('raw');
    let tex = node.dataset.tex;
    let label = 'LaTeX のまま保持している部分';
    let fn = /^\\footnote\{([\s\S]*)\}$/.exec(tex);
    if (fn) { label = '脚注'; tex = fn[1]; }
    rawDialog(label, tex, isBlock ? 'このブロックは編集画面では表現できないため、LaTeX のまま保持しています。' : '', t => {
      if (fn) t = t.trim() ? '\\footnote{' + t.trim() + '}' : '';
      if (!t.trim()) { replaceNode(node, ''); return; }
      replaceNode(node, isBlock ? Wys.rawBlock({ t: 'raw', tex: t, join: !!node.dataset.join }) : Wys.rawAtom(t));
    }, true);
  }

  /* ---------------- 参照 ---------------- */
  function openRefPicker(btn) {
    needCaret(); const r = saveRange();
    const pop = $('#pop'); pop.replaceChildren();
    const items = [];
    wys.querySelectorAll(':scope > h2, :scope > h3, :scope > h4').forEach(h => { if (h.dataset.num) items.push({ kind: '節', num: h.dataset.num, text: h.textContent, el: h, cmd: 'ref' }); });
    wys.querySelectorAll('.eqno').forEach(no => { if (no.textContent) items.push({ kind: '式', num: no.textContent, el: no, eq: no.closest('.eq'), cmd: 'eqref' }); });
    wys.querySelectorAll('.tbl').forEach(t => { const cap = t.querySelector('.cap'); if (cap && cap.dataset.num) items.push({ kind: '表', num: cap.dataset.num.trim().replace(/^表/, ''), text: cap.textContent, el: t, cmd: 'ref' }); });
    wys.querySelectorAll('.fig').forEach(f => { const cap = f.querySelector(':scope > .cap'); items.push({ kind: '図', num: (cap.dataset.num || '').trim().replace(/^図/, ''), text: cap.textContent || f.dataset.file, el: f, cmd: 'ref' }); });
    wys.querySelectorAll('.box').forEach(b => { if (DocModel.THM[b.dataset.env]) { const nm = b.querySelector('.boxname').textContent; items.push({ kind: nm.split(' ')[0], num: nm.split(' ')[1] || '', text: b.querySelector('.boxbody').textContent, el: b, cmd: 'ref' }); } });
    if (!items.length) pop.appendChild(Object.assign(document.createElement('div'), { className: 'empty', textContent: '参照できる式・節・表がまだありません。番号付きの数式や見出しを作ると、ここから参照できます。' }));
    for (const it of items) {
      const b = document.createElement('button');
      b.appendChild(Object.assign(document.createElement('span'), { className: 'n', textContent: it.kind + ' ' + it.num }));
      const d = document.createElement('span'); d.className = 'k';
      if (it.eq) { const row = +it.el.dataset.row || 0; d.appendChild(MathRender.renderLatex(rowTex(it.eq, row), { display: false })); }
      else d.textContent = (it.text || '').slice(0, 40);
      b.appendChild(d);
      b.addEventListener('mousedown', e => e.preventDefault());
      b.addEventListener('click', () => {
        pop.hidden = true;
        const key = ensureLabel(it);
        restoreRange(r);
        insertInline([Wys.refAtom(key, it.cmd)], getSelection().getRangeAt(0));
      });
      pop.appendChild(b);
    }
    showPop(pop, btn);
  }
  function showPop(pop, btn) {
    let rr = btn && btn.getBoundingClientRect ? btn.getBoundingClientRect() : null;
    const s = getSelection();
    if ((!rr || btn.closest && btn.closest('.menu')) && s.rangeCount && page.contains(s.anchorNode)) { const cr = s.getRangeAt(0).getBoundingClientRect(); if (cr.width || cr.height) rr = cr; }
    if (!rr) rr = { left: 200, bottom: 120 };
    pop.style.left = Math.max(8, Math.min(rr.left, window.innerWidth - 340)) + 'px'; pop.style.top = Math.min(rr.bottom + 6, window.innerHeight - 200) + 'px';
    pop.hidden = false;
    setTimeout(() => document.addEventListener('mousedown', function h(ev) { if (!pop.contains(ev.target)) { pop.hidden = true; document.removeEventListener('mousedown', h); } }), 0);
  }
  function rowTex(eq, row) {
    const b = Wys.eqFromEl(eq);
    const rows = TexDoc.splitTop(b.tex, /^\\\\(\[[^\]]*\])?/);
    return (rows[row] || b.tex).replace(/\\label\{[^}]*\}|\\nonumber|\\notag|&/g, '');
  }
  function ensureLabel(it) {
    if (it.eq) {
      if (it.el.dataset.label) return it.el.dataset.label;
      const key = 'eq:' + Wys.uid();
      const b = Wys.eqFromEl(it.eq);
      if (b.mode === 'equation') b.label = key;
      else {
        const rows = TexDoc.splitTop(b.tex, /^\\\\(\[[^\]]*\])?/);
        const k = +it.el.dataset.row || 0; rows[k] = rows[k].replace(/\s*$/, '') + ' \\label{' + key + '}';
        b.tex = rows.map((x, i) => i < rows.length - 1 ? x.replace(/\s+$/, '') + ' \\\\\n' : x).join('').trim();
      }
      it.eq.replaceWith(Wys.eqBlock(b));
      return key;
    }
    if (it.el.dataset.label) return it.el.dataset.label;
    const key = ({ 表: 'tab:', 図: 'fig:', 節: 'sec:' }[it.kind] || 'thm:') + Wys.uid();
    it.el.dataset.label = key;
    return key;
  }

  /* =================================================================
   *  LaTeX の機能（挿入・書式・表・文書設定）とメニュー
   * ================================================================= */
  function mk(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  // 1行・複数行テキストの入力ダイアログ
  function textDialog(title, value, note, onSave, multiline) {
    const w = mk('div');
    if (note) w.appendChild(mk('p', 'note', note));
    const t = mk(multiline === false ? 'input' : 'textarea', 'rawedit small'); t.value = value || ''; t.spellcheck = false;
    w.appendChild(t);
    t.addEventListener('keydown', e => { if (e.key === 'Enter' && (multiline === false || e.ctrlKey || e.metaKey)) { e.preventDefault(); hideModal(); onSave(t.value); } });
    showModal(title, w, [{ label: 'キャンセル' }, { label: '決定', primary: true, fn: () => onSave(t.value) }]);
  }
  // 項目つきフォーム
  function formDialog(title, fields, onSave, note, extraBtns) {
    const w = mk('div', 'form');
    if (note) w.appendChild(mk('p', 'note', note));
    const inputs = {};
    for (const f of fields) {
      const row = mk('label', 'frow' + (f.type === 'check' ? ' check' : ''));
      let inp;
      if (f.type === 'select') { inp = mk('select'); for (const [v, l] of f.options) { const o = mk('option', '', l); o.value = v; inp.appendChild(o); } inp.value = f.value; }
      else if (f.type === 'check') { inp = mk('input'); inp.type = 'checkbox'; inp.checked = !!f.value; }
      else if (f.type === 'area') { inp = mk('textarea', 'rawedit'); inp.value = f.value || ''; inp.spellcheck = false; }
      else { inp = mk('input'); inp.value = f.value || ''; inp.spellcheck = false; if (f.ph) inp.placeholder = f.ph; }
      if (f.type === 'check') row.append(inp, mk('span', '', f.label));
      else row.append(mk('span', 'flabel', f.label), inp);
      if (f.hint) row.appendChild(mk('small', 'fhint', f.hint));
      inputs[f.key] = inp; w.appendChild(row);
      if (f.type !== 'area' && f.type !== 'check') inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); hideModal(); onSave(collect()); } });
    }
    const collect = () => Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, i.type === 'checkbox' ? i.checked : i.value]));
    showModal(title, w, [...(extraBtns || []).map(b => Object.assign({}, b, { fn: () => b.fn(collect()) })), { label: 'キャンセル' }, { label: '決定', primary: true, fn: () => onSave(collect()) }]);
    const first = w.querySelector('input:not([type=checkbox]), textarea, select'); if (first) first.focus();
  }

  // 「文字＋$数式$」の入力 ⇄ LaTeX（脚注用）
  function textToTex(t) { return t.split(/(\$[^$]*\$)/).map((seg, k) => k % 2 ? seg : seg.replace(/[&%#_{}]/g, c => '\\' + c).replace(/\^/g, '\\^{}').replace(/~/g, '\\textasciitilde{}')).join(''); }
  function texToText(t) { return (t || '').split(/(\$[^$]*\$)/).map((seg, k) => k % 2 ? seg : seg.replace(/\\\^\{\}/g, '^').replace(/\\textasciitilde\{\}/g, '~').replace(/\\([&%#_{}])/g, '$1')).join(''); }
  /* ---------- 文字の書式 ---------- */
  function unwrapEl(e) { const p = e.parentNode; if (!p) return; while (e.firstChild) p.insertBefore(e.firstChild, e); p.removeChild(e); }
  function hasSel() { const s = getSelection(); return s.rangeCount && !s.isCollapsed && page.contains(s.anchorNode); }
  function wrapSelection(make, selector) {
    if (!hasSel()) { toast('先に文字を選択してください'); return; }
    hist.push();
    const s = getSelection(), r = s.getRangeAt(0);
    let anc = r.commonAncestorContainer; anc = anc.nodeType === 1 ? anc : anc.parentElement;
    const hit = anc.closest(selector);
    if (hit && page.contains(hit) && hit.contentEditable !== 'false') { unwrapEl(hit); syncFromWys(); return; }
    const w = make(); w.appendChild(r.extractContents()); r.insertNode(w);
    w.querySelectorAll(selector).forEach(unwrapEl);
    const nr = document.createRange(); nr.selectNodeContents(w); s.removeAllRanges(); s.addRange(nr);
    syncFromWys();
  }
  const fmt = {
    tt: () => wrapSelection(() => mk('code'), 'code'),
    sc: () => wrapSelection(() => mk('span', 'sc'), '.sc'),
    sup: () => { needCaret(); hist.push(); exec('superscript'); syncFromWys(); },
    sub: () => { needCaret(); hist.push(); exec('subscript'); syncFromWys(); },
    color: name => {
      if (!hasSel()) { toast('先に文字を選択してください'); return; }
      if (name === 'black') { hist.push(); const r = getSelection().getRangeAt(0); let anc = r.commonAncestorContainer; anc = anc.nodeType === 1 ? anc : anc.parentElement; const c = anc.closest('.clr'); if (c) unwrapEl(c); anc.querySelectorAll && anc.querySelectorAll('.clr').forEach(x => { if (r.intersectsNode(x)) unwrapEl(x); }); syncFromWys(); return; }
      hist.push();
      const s = getSelection(), r = s.getRangeAt(0);
      const w = mk('span', 'clr'); w.dataset.color = name; w.style.color = Wys.COLORS[name];
      w.appendChild(r.extractContents()); r.insertNode(w); w.querySelectorAll('.clr').forEach(unwrapEl);
      const nr = document.createRange(); nr.selectNodeContents(w); s.removeAllRanges(); s.addRange(nr);
      syncFromWys();
    },
    clear: () => {
      if (!hasSel()) { toast('書式を消す文字を選択してください'); return; }
      hist.push();
      const r = getSelection().getRangeAt(0);
      exec('removeFormat');
      let anc = r.commonAncestorContainer; anc = anc.nodeType === 1 ? anc : anc.parentElement;
      const blk = topBlock(anc) || anc;
      [...blk.querySelectorAll('code, .sc, .clr, b, i, u, sup, sub, strong, em')].forEach(x => { if (r.intersectsNode(x)) unwrapEl(x); });
      syncFromWys();
    }
  };
  function setHeading(tag) {
    needCaret(); restoreRange(); hist.push();
    const ctx = caretContext();
    if (!ctx.inMain) return;
    if (ctx.block && ['UL', 'OL'].includes(ctx.block.tagName)) exec(ctx.block.tagName === 'UL' ? 'insertUnorderedList' : 'insertOrderedList');
    exec('formatBlock', tag);
    syncFromWys();
  }
  function toggleHeadingNumber() {
    const h = caretContext().heading;
    if (!h) { toast('見出しの中にカーソルを置いてください'); return; }
    hist.push();
    if (h.dataset.star) delete h.dataset.star; else h.dataset.star = '1';
    syncFromWys();
    toast(h.dataset.star ? 'この見出しは番号なしになりました（\\section*）' : 'この見出しに番号を付けました');
  }

  /* ---------- リンク ---------- */
  function linkDialog() {
    needCaret();
    const ctx = caretContext(); const r = saveRange();
    const a = ctx.link;
    const selText = hasSel() ? getSelection().toString() : '';
    formDialog(a ? 'リンクを編集' : 'リンクを入れる', [
      { key: 'url', label: 'URL', value: a ? a.getAttribute('href') : (/^https?:\/\//.test(selText) ? selText : 'https://'), ph: 'https://…' },
      { key: 'text', label: '表示する文字', value: a ? a.textContent : selText, ph: '空なら URL をそのまま表示' }
    ], v => {
      const url = v.url.trim(); if (!url || url === 'https://') return;
      restoreRange(r);
      if (a) { hist.push(); a.setAttribute('href', url); if (v.text.trim() && v.text !== a.textContent) a.textContent = v.text; if (!v.text.trim() || v.text === url) { a.textContent = url; a.dataset.plain = '1'; } else delete a.dataset.plain; syncFromWys(); return; }
      const el = Wys.linkEl({ url, inl: [{ t: 'text', s: v.text.trim() || url }], plain: !v.text.trim() || v.text.trim() === url });
      insertInline([el], getSelection().getRangeAt(0));
    }, 'LaTeX では \\href / \\url になります（hyperref パッケージは自動で追加されます）。', a ? [{ label: 'リンクを外す', danger: true, left: true, fn: () => { hist.push(); unwrapEl(a); syncFromWys(); } }] : null);
  }

  /* ---------- 参考文献・引用 ---------- */
  function bibEl() { return wys.querySelector('.bib'); }
  function insertBib(focus) {
    let b = bibEl();
    if (!b) {
      b = Wys.bibBlock({ t: 'bib', widest: '99', items: [{ key: 'ref1', inl: [] }] });
      hist.push();
      const last = wys.lastElementChild;
      if (last && last.tagName === 'P' && isEmptyBlock(last)) last.before(b); else wys.appendChild(b);
      syncFromWys();
    }
    b.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (focus !== false) { const t = b.querySelector('li:last-child .bibtext'); if (t) { t.focus(); focusEnd(t); } }
    return b;
  }
  function addBibItem(b) {
    hist.push();
    const keys = [...b.querySelectorAll('.bibkey')].map(k => k.textContent);
    let n = keys.length + 1; while (keys.includes('ref' + n)) n++;
    const li = Wys.bibItem({ key: 'ref' + n, inl: [] });
    b.querySelector('ol').appendChild(li);
    const t = li.querySelector('.bibtext'); t.focus(); focusEnd(t);
    syncFromWys();
  }
  function renameBibKey(k) {
    textDialog('引用キーを変更', k.textContent, '本文の引用（\\cite）で使う短い名前です。英数字がおすすめ（例: knuth1984）。空にするとこの文献を削除します。', v => {
      const nv = v.trim().replace(/[\s,{}]/g, '');
      hist.push();
      if (!nv) { k.closest('li').remove(); syncFromWys(); return; }
      const old = k.textContent; k.textContent = nv;
      page.querySelectorAll('.ct').forEach(ct => { ct.dataset.key = ct.dataset.key.split(',').map(x => x.trim() === old ? nv : x.trim()).join(','); });
      syncFromWys();
    }, false);
  }
  function openCitePicker(btn) {
    needCaret(); const r = saveRange();
    const pop = $('#pop'); pop.replaceChildren();
    const b = bibEl();
    const items = b ? [...b.querySelectorAll('li')] : [];
    items.forEach((li, k) => {
      const key = li.querySelector('.bibkey').textContent;
      const bt = mk('button'); bt.append(mk('span', 'n', '[' + (k + 1) + ']'), mk('span', 'k', key + '　' + li.querySelector('.bibtext').textContent.slice(0, 40)));
      bt.addEventListener('mousedown', e => e.preventDefault());
      bt.addEventListener('click', () => { pop.hidden = true; restoreRange(r); insertInline([Wys.citeAtom(key)], getSelection().getRangeAt(0)); });
      pop.appendChild(bt);
    });
    const add = mk('button', 'addnew'); add.append(mk('span', 'n', '＋'), mk('span', 'k', b ? '新しい文献を追加して引用' : '参考文献リストを作って引用'));
    add.addEventListener('mousedown', e => e.preventDefault());
    add.addEventListener('click', () => {
      pop.hidden = true;
      const keys = b ? [...b.querySelectorAll('.bibkey')].map(k => k.textContent) : [];
      let n = keys.length + 1; while (keys.includes('ref' + n)) n++;
      formDialog('文献を追加して引用', [
        { key: 'text', label: '文献の情報', value: '', ph: '著者，『題名』，出版社，年．' },
        { key: 'key', label: '引用キー（英数字）', value: 'ref' + n, hint: '本文の \\cite{…} で使う短い名前です。' }
      ], v => {
        const key = (v.key || '').trim().replace(/[\s,{}]/g, '') || 'ref' + n;
        hist.push();
        let bb = bibEl();
        if (!bb) { bb = Wys.bibBlock({ t: 'bib', widest: '99', items: [] }); const last = wys.lastElementChild; if (last && last.tagName === 'P' && isEmptyBlock(last)) last.before(bb); else wys.appendChild(bb); }
        bb.querySelector('ol').appendChild(Wys.bibItem({ key, inl: DocModel.inlineFromTex(v.text || '') }));
        restoreRange(r); insertInline([Wys.citeAtom(key)], getSelection().getRangeAt(0));
        toast('参考文献リスト（文書の最後）に追加しました');
      }, '文書の最後の「参考文献」に追加され、本文には番号 [1] などが入ります。');
    });
    pop.appendChild(add);
    showPop(pop, btn);
  }

  /* ---------- ブロックの挿入 ---------- */
  function intoMain() { needCaret(); if (!caretContext().inMain) toMainEnd(); return getSelection().rangeCount ? getSelection().getRangeAt(0) : null; }
  function insertBox(env) {
    const r = intoMain();
    const blocks = [{ t: 'p', inl: [] }];
    const b = Wys.boxBlock({ t: 'box', env, blocks, label: DocModel.THM[env] ? undefined : undefined });
    if (env === 'abstract' && !wys.querySelector('.box-abstract')) { hist.push(); wys.insertBefore(b, wys.firstChild); syncFromWys(); }
    else insertBlocks([b], r);
    const p = b.querySelector('.boxbody p'); if (p) setCaret(p, 0);
  }
  function insertCode() { const r = intoMain(); const b = Wys.codeBlock({ env: 'verbatim', text: '' }); insertBlocks([b], r); const pre = b.querySelector('pre'); pre.focus(); }
  function insertSimple(t, cmd) { const r = intoMain(); insertBlocks([Wys.blockToDom({ t, cmd })], r); }
  function insertFigure() {
    const r = intoMain();
    const f = Wys.figBlock({ t: 'figure', file: 'figure.png', gopt: 'width=0.6\\linewidth', label: 'fig:' + Wys.uid(), placement: 'htbp' });
    insertBlocks([f], r);
    const cap = f.querySelector('.cap'); cap.focus(); focusEnd(cap);
    pickImage(f);
  }
  function insertList(kind) {
    needCaret(); const ctx = caretContext();
    if (kind === 'desc') { const r = intoMain(); const l = Wys.blockToDom({ t: 'list', desc: true, items: [{ optInl: [{ t: 'text', s: '用語' }], inl: [] }] }); insertBlocks([l], r); const li = l.querySelector('li'); focusEnd(li); return; }
    hist.push(); exec(kind === 'ol' ? 'insertOrderedList' : 'insertUnorderedList'); syncFromWys();
  }

  /* ---------- 図の画像（このブラウザ内にだけ保存） ---------- */
  const imgDB = {
    db: null,
    open() { return new Promise(res => { try { const q = indexedDB.open('texnote-img', 1); q.onupgradeneeded = () => q.result.createObjectStore('img'); q.onsuccess = () => { this.db = q.result; res(this.db); }; q.onerror = () => res(null); } catch (e) { res(null); } }); },
    async put(k, v) { try { const db = this.db || await this.open(); if (!db) return; db.transaction('img', 'readwrite').objectStore('img').put(v, k); } catch (e) { } },
    async all() { try { const db = this.db || await this.open(); if (!db) return []; return await new Promise(res => { const out = []; const c = db.transaction('img').objectStore('img').openCursor(); c.onsuccess = () => { const cur = c.result; if (cur) { out.push([cur.key, cur.value]); cur.continue(); } else res(out); }; c.onerror = () => res(out); }); } catch (e) { return []; } }
  };
  function pickImage(fig) {
    const inp = mk('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.addEventListener('change', () => {
      const f = inp.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        const name = f.name.replace(/\s+/g, '_');
        Wys.images.set(name, rd.result); imgDB.put(name, rd.result);
        hist.push();
        const fi = fig.querySelector('.figfile'); fi.value = name; fi.setAttribute('value', name); fig.dataset.file = name;
        const box = fig.querySelector('.figimg'); box.replaceChildren(); const im = mk('img'); im.src = rd.result; im.alt = name; box.appendChild(im);
        syncFromWys();
        toast('LaTeX でコンパイルするときは「' + name + '」を .tex と同じフォルダに置いてください', 5000);
      };
      rd.readAsDataURL(f);
    });
    inp.click();
  }

  /* ---------- 表の書式 ---------- */
  function tableCtx() { const td = caretContext().td; if (!td) { toast('表のセルにカーソルを置いてください'); return null; } return { td, tbl: td.closest('.tbl'), table: td.closest('table'), tr: td.parentElement, ci: td.cellIndex }; }
  function specArr(tbl) { const s = (tbl.dataset.spec || '').trim(); return { cols: s.replace(/[^lcr]/g, '').split(''), bars: s.includes('|'), outer: s.startsWith('|'), simple: /^[lcr|\s]*$/.test(s) }; }
  function writeSpec(tbl, cols, bars, outer) { tbl.dataset.spec = bars ? (outer ? '|' : '') + cols.join('|') + (outer ? '|' : '') : cols.join(''); tbl.classList.toggle('vlines', bars); }
  function tableFmt(op, arg) {
    const c = tableCtx(); if (!c) return;
    const { tbl, table, tr, ci } = c; const rows = [...table.rows];
    hist.push();
    const sp = specArr(tbl);
    while (sp.cols.length < tr.children.length) sp.cols.push('c');
    if (op === 'align') {
      if (!sp.simple) { toast('この表の列指定は複雑なため変更できません（LaTeX 欄で編集してください）'); return; }
      sp.cols[ci] = arg; writeSpec(tbl, sp.cols, sp.bars, sp.outer);
      for (const r of rows) if (r.children[ci]) r.children[ci].style.textAlign = arg === 'l' ? 'left' : arg === 'r' ? 'right' : 'center';
    }
    if (op === 'vlines') { if (!sp.simple) { toast('この表の列指定は複雑なため変更できません'); return; } writeSpec(tbl, sp.cols, !sp.bars, false); }
    if (op === 'hline') {
      const k = rows.indexOf(tr);
      if (k === rows.length - 1) { if (tbl.dataset.hlEnd) delete tbl.dataset.hlEnd; else tbl.dataset.hlEnd = '1'; }
      else rows[k + 1].classList.toggle('hl');
    }
    if (op === 'hlineTop') rows[rows.indexOf(tr)].classList.toggle('hl');
    if (op === 'addRowAbove') { const nr = document.createElement('tr'); for (const cell of tr.children) { const t = document.createElement('td'); t.contentEditable = 'true'; t.style.textAlign = cell.style.textAlign; nr.appendChild(t); } tr.before(nr); if (tr.classList.contains('hl')) { tr.classList.remove('hl'); nr.classList.add('hl'); } }
    if (op === 'addColLeft') { for (const r of rows) { const t = document.createElement('td'); t.contentEditable = 'true'; t.style.textAlign = 'center'; (r.children[ci] ? r.children[ci].before(t) : r.appendChild(t)); } if (sp.simple) { sp.cols.splice(ci, 0, 'c'); writeSpec(tbl, sp.cols, sp.bars, sp.outer); } }
    if (op === 'caption') { let cap = tbl.querySelector(':scope > .cap'); if (!cap) { cap = mk('div', 'cap'); cap.contentEditable = 'true'; cap.dataset.ph = '表のタイトル（キャプション）'; tbl.prepend(cap); tbl.dataset.float = '1'; } cap.focus(); }
    syncFromWys();
  }

  /* ---------- 文書の設定 ---------- */
  function docSettings() {
    if (meta.fragment) { toast('「本文だけ」の文書には文書の設定がありません（新規作成で通常の文書を選んでください）'); return; }
    const pre = meta.preamble != null ? meta.preamble : DocModel.DEFAULT_PRE;
    const c = DocModel.getClass(pre);
    const jl = c.cls === 'jlreq';
    const paper = (c.opts.find(o => /paper$|^paper=/.test(o)) || 'a4paper').replace(/^paper=(\w+)$/, '$1paper');
    const size = (c.opts.find(o => /^(fontsize=)?\d+(\.\d+)?pt$/.test(o)) || '10pt').replace(/^fontsize=/, '');
    const two = c.opts.includes('twocolumn');
    const known = o => /paper$|^paper=|^(fontsize=)?\d+(\.\d+)?pt$|^twocolumn$|^onecolumn$/.test(o);
    const others = c.opts.filter(o => !known(o));
    formDialog('文書の設定', [
      { key: 'cls', label: '文書の種類', type: 'select', value: c.cls || 'ltjsarticle', options: [['ltjsarticle', 'レポート・論文（ltjsarticle, LuaLaTeX）'], ['ltjsreport', '章のある長い文書（ltjsreport）'], ['jlreq', '日本語組版ルール準拠（jlreq）'], ['jsarticle', 'レポート（jsarticle, upLaTeX/pLaTeX）'], ['article', '英語の文書（article）'], ['report', '英語・章あり（report）'], ...(['ltjsarticle', 'ltjsreport', 'jlreq', 'jsarticle', 'article', 'report'].includes(c.cls) || !c.cls ? [] : [[c.cls, c.cls + '（いまの設定）']])] },
      { key: 'paper', label: '用紙', type: 'select', value: paper, options: [['a4paper', 'A4'], ['b5paper', 'B5'], ['a5paper', 'A5'], ['letterpaper', 'レター']] },
      { key: 'size', label: '文字の大きさ', type: 'select', value: size, options: [['9pt', '9pt'], ['10pt', '10pt（標準）'], ['11pt', '11pt'], ['12pt', '12pt']] },
      { key: 'margin', label: '余白', type: 'select', value: c.margin || '', options: [['', '文書の種類の標準'], ['15mm', '狭い（15mm）'], ['20mm', 'やや狭い（20mm）'], ['25mm', '普通（25mm）'], ['30mm', '広い（30mm）'], ...(['', '15mm', '20mm', '25mm', '30mm'].includes(c.margin) ? [] : [[c.margin, c.margin]])] },
      { key: 'ls', label: '行間', type: 'select', value: c.linespread || '', options: [['', '標準'], ['1.1', '少し広く'], ['1.25', '広く'], ['1.5', 'かなり広く'], ...(['', '1.1', '1.25', '1.5'].includes(c.linespread) ? [] : [[c.linespread, c.linespread]])] },
      { key: 'two', label: '2段組にする', type: 'check', value: two },
      { key: 'pre', label: 'プリアンブル（上級者向け・直接編集）', type: 'area', value: pre, hint: '上の設定を変えると、この内容の該当行が書き換わります。' }
    ], v => {
      let p = v.pre;
      const isJl = v.cls === 'jlreq';
      const opts = [isJl ? 'paper=' + v.paper.replace(/paper$/, '') : v.paper, isJl ? 'fontsize=' + v.size : v.size, ...(v.two ? ['twocolumn'] : []), ...others];
      p = DocModel.setClass(p, { cls: v.cls, opts, margin: v.margin, linespread: v.ls });
      meta.preamble = p;
      syncFromWys();
      toast('文書の設定を反映しました（プレビューは簡易表示です）');
    }, 'ここで選んだ内容は LaTeX の \\documentclass やパッケージとして書き出されます。');
  }

  /* ---------- 記号 ---------- */
  const SYMBOLS = [['§', '節記号'], ['¶', '段落記号'], ['©', '著作権'], ['®', '登録商標'], ['™', '商標'], ['°', '度'], ['℃', 'セルシウス度'], ['±', 'プラスマイナス'], ['×', 'かける'], ['÷', 'わる'], ['→', '矢印'], ['←', '矢印'], ['⇒', '二重矢印'], ['…', '三点リーダ'], ['※', '米印'], ['〒', '郵便'], ['µ', 'マイクロ'], ['Å', 'オングストローム'], ['‰', 'パーミル'], ['†', 'ダガー'], ['‡', '二重ダガー']];
  function insertText(t) { needCaret(); hist.push(); exec('insertText', t); syncFromWys(); }

  /* =================================================================
   *  メニューバー
   * ================================================================= */
  const inTable = () => !!caretContext().td;
  const COLOR_NAMES = { black: '黒（色を外す）', red: '赤', blue: '青', green: '緑', orange: 'オレンジ', purple: '紫', gray: 'グレー', brown: '茶', cyan: 'シアン', magenta: 'マゼンタ' };
  const MENUS = [
    { label: 'ファイル', items: [
      { label: '新規作成…', act: () => $('#btnNew').click() },
      { label: '開く…', hint: '.tex', act: () => $('#fileOpen').click() },
      '-',
      { label: 'LaTeX をコピー', act: () => $('#btnCopy').click() },
      { label: '保存（.tex.txt）', act: () => $('#btnDownload').click(), show: () => !!downloads },
      { label: 'HTML で書き出し（印刷・PDF 用）', act: () => $('#btnExport').click(), show: () => !!downloads },
      '-',
      { label: '文書の設定…', hint: '用紙・余白・文書クラス', act: docSettings }
    ] },
    { label: '編集', items: [
      { label: '元に戻す', key: 'Ctrl+Z', act: () => hist.doUndo() },
      { label: 'やり直し', key: 'Ctrl+Y', act: () => hist.doRedo() },
      '-',
      { label: 'すべて選択', key: 'Ctrl+A', act: () => { wys.focus(); const r = document.createRange(); r.selectNodeContents(wys); restoreRange(r); } },
      '-',
      { label: '入力の設定…', hint: '自動変換・画面キーボード', act: () => $('#btnSettings').click() }
    ] },
    { label: '挿入', items: [
      { label: '数式（文中）', key: '$', act: () => mathFromToolbar('inline') },
      { label: '数式（別行）', key: 'Ctrl+Shift+M', act: () => mathFromToolbar('display') },
      { label: '数式（番号付き）', act: () => mathFromToolbar('equation') },
      { label: '数式（複数行をそろえる）', act: () => mathFromToolbar('align') },
      '-',
      { label: '表', act: () => insertTable() },
      { label: '図', act: () => insertFigure() },
      { label: 'コード（そのまま表示）', act: insertCode },
      '-',
      { label: '脚注…', act: insertFootnote },
      { label: 'リンク…', key: 'Ctrl+K', act: linkDialog },
      { label: '記号', sub: SYMBOLS.map(([c, n]) => ({ label: c + '　' + n, act: () => insertText(c) })) },
      '-',
      { label: '定理・定義など', sub: [...Object.entries(DocModel.THM).map(([k, v]) => ({ label: v + '（' + k + '）', act: () => insertBox(k) })), '-', { label: '証明（proof）', act: () => insertBox('proof') }] },
      { label: '囲み・配置', sub: [{ label: '概要（abstract）', act: () => insertBox('abstract') }, { label: '引用（quote）', act: () => insertBox('quote') }, { label: '中央揃え（center）', act: () => insertBox('center') }, { label: '右揃え（flushright）', act: () => insertBox('flushright') }] },
      { label: 'リスト', sub: [{ label: '箇条書き', hint: '- と Space', act: () => insertList('ul') }, { label: '番号付き', hint: '1. と Space', act: () => insertList('ol') }, { label: '用語と説明（description）', act: () => insertList('desc') }] },
      '-',
      { label: '目次', act: () => insertSimple('toc', 'tableofcontents') },
      { label: '図目次・表目次', sub: [{ label: '図目次', act: () => insertSimple('toc', 'listoffigures') }, { label: '表目次', act: () => insertSimple('toc', 'listoftables') }] },
      { label: '改ページ', act: () => insertSimple('pb', 'newpage') },
      { label: '付録の開始', hint: '以降の見出しが A, B…', act: () => insertSimple('appendix') },
      '-',
      { label: 'LaTeX を直接書く…', act: () => insertRawBlock('') }
    ] },
    { label: '書式', items: [
      { label: '本文', act: () => setHeading('p') },
      { label: '見出し 1', hint: '# と Space', act: () => setHeading('h2') },
      { label: '見出し 2', hint: '## と Space', act: () => setHeading('h3') },
      { label: '見出し 3', hint: '### と Space', act: () => setHeading('h4') },
      { label: '見出しに番号を付けない', check: () => { const h = caretContext().heading; return !!(h && h.dataset.star); }, enabled: () => !!caretContext().heading, act: toggleHeadingNumber },
      '-',
      { label: '太字', key: 'Ctrl+B', act: () => TB.bold() },
      { label: '斜体（強調）', key: 'Ctrl+I', act: () => TB.italic() },
      { label: '下線', key: 'Ctrl+U', act: () => TB.underline() },
      { label: '等幅（タイプライター体）', act: fmt.tt },
      { label: 'スモールキャピタル', act: fmt.sc },
      { label: '上付き文字', act: fmt.sup },
      { label: '下付き文字', act: fmt.sub },
      { label: '文字の色', sub: Object.entries(COLOR_NAMES).map(([k, v]) => ({ label: v, swatch: Wys.COLORS[k], act: () => fmt.color(k) })) },
      '-',
      { label: '書式をクリア', act: fmt.clear }
    ] },
    { label: '表', items: [
      { label: '表を挿入', act: () => insertTable() },
      '-',
      { label: '上に行を追加', enabled: inTable, act: () => tableFmt('addRowAbove') },
      { label: '下に行を追加', enabled: inTable, act: () => tableOp('addRow') },
      { label: '左に列を追加', enabled: inTable, act: () => tableFmt('addColLeft') },
      { label: '右に列を追加', enabled: inTable, act: () => tableOp('addCol') },
      { label: '行を削除', enabled: inTable, act: () => tableOp('delRow') },
      { label: '列を削除', enabled: inTable, act: () => tableOp('delCol') },
      '-',
      { label: '列の文字揃え', enabled: inTable, sub: [{ label: '左揃え', act: () => tableFmt('align', 'l') }, { label: '中央揃え', act: () => tableFmt('align', 'c') }, { label: '右揃え', act: () => tableFmt('align', 'r') }] },
      { label: '縦の罫線', enabled: inTable, check: () => { const td = caretContext().td; return !!(td && td.closest('.tbl').classList.contains('vlines')); }, act: () => tableFmt('vlines') },
      { label: 'この行の上に横線', enabled: inTable, act: () => tableFmt('hlineTop') },
      { label: 'この行の下に横線', enabled: inTable, act: () => tableFmt('hline') },
      { label: 'キャプションを付ける', enabled: inTable, act: () => tableFmt('caption') },
      '-',
      { label: '表を削除', enabled: inTable, act: () => tableOp('delTable') }
    ] },
    { label: '参照', items: [
      { label: '式・節・図・表を参照…', act: btn => openRefPicker(btn) },
      { label: '文献を引用…', act: btn => openCitePicker(btn) },
      '-',
      { label: '参考文献リスト', hint: bibEl ? '文書の最後' : '', act: () => insertBib() }
    ] },
    { label: '表示', items: [
      { label: '編集画面だけ', check: () => settings.view === 'edit', act: () => setView('edit') },
      { label: '編集画面と LaTeX', check: () => settings.view === 'split', act: () => setView('split') },
      { label: 'LaTeX だけ', check: () => settings.view === 'tex', act: () => setView('tex') },
      '-',
      { label: '数式パネルの画面キーボード', check: () => settings.keyboard, act: () => { settings.keyboard = !settings.keyboard; scheduleSave(); } },
      { label: '単語を記号に自動変換（alpha→α）', check: () => settings.autoWords, act: () => { settings.autoWords = !settings.autoWords; field.setAutoWords(settings.autoWords); scheduleSave(); } }
    ] },
    { label: 'ヘルプ', items: [
      { label: '使い方', act: () => showHelp() },
      { label: '対応している LaTeX の機能', act: () => showFeatures() }
    ] }
  ];
  const menubar = $('#menubar');
  let openMenu = null;
  function closeMenus() { document.querySelectorAll('.menu').forEach(m => m.remove()); menubar.querySelectorAll('.on').forEach(b => b.classList.remove('on')); openMenu = null; }
  function buildMenu(items, x, y, sub) {
    const m = mk('div', 'menu' + (sub ? ' sub' : '')); m.setAttribute('role', 'menu');
    for (const it of items) {
      if (it === '-') { m.appendChild(mk('div', 'msep')); continue; }
      if (it.show && !it.show()) continue;
      const b = mk('button', 'mi'); b.setAttribute('role', 'menuitem');
      const en = it.enabled ? it.enabled() : true;
      if (!en) b.disabled = true;
      const chk = it.check ? it.check() : false;
      b.appendChild(mk('span', 'mchk', chk ? '✓' : ''));
      if (it.swatch) { const sw = mk('span', 'msw'); sw.style.background = it.swatch; b.appendChild(sw); }
      b.appendChild(mk('span', 'mlabel', it.label));
      if (it.hint) b.appendChild(mk('span', 'mhint', it.hint));
      if (it.key) b.appendChild(mk('span', 'mkey', it.key));
      if (it.sub) b.appendChild(mk('span', 'marr', '▸'));
      b.addEventListener('mousedown', e => e.preventDefault());
      if (it.sub) {
        const openSub = () => {
          m.querySelectorAll(':scope > .mi.subopen').forEach(x => x.classList.remove('subopen'));
          document.querySelectorAll('.menu.sub').forEach(s => { if (s.dataset.parent === String(items.indexOf(it)) || !sub) s.remove(); });
          b.classList.add('subopen');
          const r = b.getBoundingClientRect();
          const sm = buildMenu(it.sub, r.right - 2, r.top - 5, true); sm.dataset.parent = String(items.indexOf(it));
        };
        b.addEventListener('mouseenter', () => { if (!b.disabled) openSub(); });
        b.addEventListener('click', () => { if (!b.disabled) openSub(); });
      } else {
        b.addEventListener('mouseenter', () => { if (!sub) { document.querySelectorAll('.menu.sub').forEach(s => s.remove()); m.querySelectorAll('.subopen').forEach(x => x.classList.remove('subopen')); } });
        b.addEventListener('click', () => { const anchor = openMenu; closeMenus(); it.act(anchor); });
      }
      m.appendChild(b);
    }
    document.body.appendChild(m);
    const w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.max(4, Math.min(x, window.innerWidth - w - 4)) + 'px';
    m.style.top = Math.max(4, Math.min(y, window.innerHeight - h - 4)) + 'px';
    if (sub && x + w > window.innerWidth) m.style.left = Math.max(4, x - w - 200) + 'px';
    return m;
  }
  MENUS.forEach(def => {
    const b = mk('button', 'mb', def.label); b.type = 'button';
    b.addEventListener('mousedown', e => { e.preventDefault(); if (!getSelection().rangeCount || !page.contains(getSelection().anchorNode)) { } else saveRange(); });
    const open = () => { closeMenus(); b.classList.add('on'); openMenu = b; const r = b.getBoundingClientRect(); buildMenu(def.items, r.left, r.bottom + 2); };
    b.addEventListener('click', () => { if (openMenu === b) closeMenus(); else open(); });
    b.addEventListener('mouseenter', () => { if (openMenu && openMenu !== b) open(); });
    menubar.appendChild(b);
  });
  document.addEventListener('mousedown', e => { if (openMenu && !e.target.closest('.menu') && !e.target.closest('#menubar')) closeMenus(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && openMenu) { closeMenus(); e.preventDefault(); } });
  window.addEventListener('resize', closeMenus);
  // ショートカット
  page.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); linkDialog(); }
  });

  function showFeatures() {
    const w = mk('div', 'help');
    const rows = [
      ['見出し（番号あり・なし）', '\\section, \\subsection, \\subsubsection, \\section*'],
      ['文字の書式', '\\textbf, \\emph, \\underline, \\texttt, \\textsc, \\textsuperscript, \\textsubscript, \\textcolor'],
      ['リスト', 'itemize, enumerate, description（入れ子も可）'],
      ['数式', '$…$, \\[…\\], equation, align（番号・ラベル・参照）'],
      ['表', 'table + tabular（キャプション・ラベル・罫線・列揃え）'],
      ['図', 'figure + \\includegraphics（幅・キャプション・ラベル）'],
      ['定理など', 'theorem, lemma, proposition, corollary, definition, example, remark, proof（amsthm を自動追加）'],
      ['囲み', 'abstract, quote, center, flushright'],
      ['参照・引用', '\\ref, \\eqref, \\cite, thebibliography, \\footnote, \\href, \\url'],
      ['文書全体', '\\maketitle, \\tableofcontents, \\listoffigures, \\listoftables, \\newpage, \\appendix'],
      ['文書の設定', '\\documentclass のオプション、geometry の余白、\\linespread'],
      ['それ以外', '「LaTeX ブロック」としてそのまま保持（クリックで編集）']
    ];
    const t = mk('table');
    for (const [a, b] of rows) { const tr = mk('tr'); tr.append(mk('td', '', a), Object.assign(mk('td'), { innerHTML: '<code>' + b.replace(/</g, '&lt;') + '</code>' })); t.appendChild(tr); }
    w.append(mk('p', '', '編集画面で直接扱える LaTeX の機能です。必要なパッケージ（amsthm, graphicx, hyperref, xcolor など）は自動で追加されます。'), t);
    showModal('対応している LaTeX の機能', w, null, true);
  }
  // 起動時：保存してある画像を読み込む
  imgDB.all().then(list => { if (!list.length) return; for (const [k, v] of list) Wys.images.set(k, v); if (wys.querySelector('.fig')) loadTex(ta.value, true); });

  /* =================================================================
   *  数式パネル
   * ================================================================= */
  const mp = $('#mp');
  const MODES = { inline: { label: '文中', hint: '$…$' }, display: { label: '別行', hint: '\\[…\\]' }, equation: { label: '番号付き', hint: '(1)' }, align: { label: '複数行そろえ', hint: 'align' } };
  let panel = {};
  const field = new MathField($('#mpField'), {
    autoWords: settings.autoWords,
    onChange: latex => { const inp = $('#mpTex'); if (document.activeElement !== inp) { inp.value = latex; inp.classList.remove('bad'); } },
    onSuggest: list => renderSuggest(list),
    onContext: c => renderHint(c),
    onEnter: (e, withMod) => {
      if (withMod) { confirmPanel(); return true; }
      if (field.ed.matInfo()) { field.ed.save(); field.ed.matStep('row'); field.update(); return true; }
      if (panel.mode === 'align' && !e.shiftKey) { field.key('newline'); return true; }
      if (e.shiftKey && panel.allowBlock) { field.key('newline'); setMode('align'); return true; }
      confirmPanel(); return true;
    },
    onEscape: () => cancelPanel()
  });
  $('#mpField').querySelector('.mf-view').dataset.placeholder = '例: 1/2 → 分数　x^2 → 指数　sqrt( → √　alpha → α';
  const segMode = $('#mpMode');
  for (const [k, v] of Object.entries(MODES)) {
    const b = document.createElement('button'); b.dataset.mode = k; b.innerHTML = v.label + `<small>${v.hint}</small>`;
    b.addEventListener('mousedown', e => e.preventDefault());
    b.addEventListener('click', () => { if (!b.disabled) { setMode(k); field.focus(); } });
    segMode.appendChild(b);
  }
  function setMode(m) {
    panel.mode = m;
    segMode.querySelectorAll('button').forEach(b => { b.classList.toggle('on', b.dataset.mode === m); b.disabled = !panel.allowBlock && b.dataset.mode !== 'inline'; b.title = b.disabled ? '表やタイトルの中では文中の数式だけ使えます' : ''; });
    $('#mpLabelWrap').hidden = true;
    $('#mpNumWrap').hidden = m !== 'align';
    $('#mpOk').innerHTML = (panel.editing ? '更新' : '挿入') + ' <kbd>' + (m === 'align' ? 'Ctrl+Enter' : 'Enter') + '</kbd>';
  }
  $('#mpNum').addEventListener('change', e => { panel.numbered = e.target.checked; });
  function openMath(o) {
    panel = Object.assign({ mode: 'inline', label: '', numbered: true, allowBlock: true }, o);
    $('#mpNum').checked = panel.numbered !== false;
    field.ed.hist = []; field.ed.future = [];
    field.ed.setLatex((o.latex || '').trim());
    if (o.initialPaste) field.ed.paste(o.initialPaste);
    setMode(panel.mode);
    $('#mpTitle').textContent = o.editing ? '数式を編集' : '数式を入力';
    $('#kb').hidden = !settings.keyboard;
    syncInputMode();
    mp.hidden = false;
    field.focus(); field.update();
  }
  function cancelPanel() { mp.hidden = true; if (panel.onCancel) panel.onCancel(); }
  function confirmPanel() {
    const latex = field.getLatex();
    mp.hidden = true;
    const res = { latex, mode: panel.mode, label: panel.label || '', numbered: panel.mode === 'align' ? $('#mpNum').checked : true };
    if (panel.onOk) panel.onOk(res);
  }
  $('#mpOk').addEventListener('click', confirmPanel);
  $('#mpCancel').addEventListener('click', cancelPanel);
  mp.addEventListener('mousedown', e => { if (e.target === mp) { e.preventDefault(); confirmPanel(); } });
  $('#mpTex').addEventListener('input', e => { try { field.ed.save(); field.ed.setLatex(e.target.value); field.update(); e.target.classList.remove('bad'); } catch (err) { e.target.classList.add('bad'); } });
  $('#mpTex').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); confirmPanel(); } if (e.key === 'Escape') { e.preventDefault(); cancelPanel(); } });
  $('#mpTexCopy').addEventListener('click', () => copyText(field.getLatex(), 'LaTeX をコピーしました'));
  function renderSuggest(list) {
    const box = $('#mpSugg'); box.replaceChildren();
    list.forEach((s, k) => {
      const b = document.createElement('button'); b.className = 'chip' + (k === 0 ? ' first' : '');
      if (s.kind === 'sym') { const m = document.createElement('span'); m.className = 'm'; m.textContent = s.show; b.appendChild(m); }
      b.appendChild(Object.assign(document.createElement('span'), { textContent: s.kind === 'sym' ? s.w : s.show }));
      b.addEventListener('mousedown', e => { e.preventDefault(); field.ed.applySuggestion(s); field.update(); });
      box.appendChild(b);
    });
  }
  const HINT = {
    root: '<b>/</b> 分数　<b>^</b> 指数　<b>_</b> 添字　<b>sqrt(</b> ルート　<b>alpha</b> → α　<b>&lt;=</b> → ≤　<b>"…"</b> 文字',
    num: '分子を入力中 — <b>↓</b> か <b>→</b> で分母へ', den: '分母を入力中 — <b>→</b> か <b>Space</b> で分数の外へ',
    sup: '指数を入力中 — <b>→</b> か <b>Space</b> で抜ける', sub: '添字を入力中 — <b>→</b>、<b>Space</b>、<b>+ − =</b> などで抜ける',
    sqrt: 'ルートの中 — <b>→</b> か <b>Space</b> で外へ', radicand: 'ルートの中 — <b>←</b> で根の指数へ、<b>→</b> で外へ', index: '根の指数 — <b>→</b> で中身へ',
    paren: '括弧の中 — <b>)</b> で閉じる', text: '文字を入力中 — <b>"</b> で数式に戻る', acc: '<b>→</b> か <b>Space</b> で外へ', style: '<b>→</b> か <b>Space</b> で外へ',
    cmd: '命令の引数 — <b>}</b> で閉じる', binom: '<b>↓↑</b> で上下を移動', esc: 'LaTeX命令を入力中 — <b>Space</b> か <b>{</b> で確定、候補は <b>Tab</b>'
  };
  function renderHint(c) {
    const h = $('#mpHint');
    let s = c.esc ? HINT.esc : (HINT[c.where] || HINT.root);
    if (field.ed.matInfo()) s = '行列 — <b>Tab</b>/<b>&amp;</b> 次のセル　<b>Enter</b> 次の行 <button class="mini" data-mat="addRow">＋行</button><button class="mini" data-mat="addCol">＋列</button><button class="mini" data-mat="delRow">−行</button><button class="mini" data-mat="delCol">−列</button>';
    else if (panel.mode === 'align' && c.where === 'root') s = '複数行 — <b>Enter</b> で改行、<b>&amp;</b> でそろえる位置（例: <b>&amp;=</b>）。確定は <b>Ctrl+Enter</b>';
    h.innerHTML = s;
    h.querySelectorAll('[data-mat]').forEach(b => b.addEventListener('mousedown', e => { e.preventDefault(); field.ed.matOp(b.dataset.mat); field.update(); }));
  }
    const sq = '\\square';
  const K = (label, act, o) => Object.assign({ label, act }, o || {});
  const KB = {
    '基本': [
      K('x', ['type', 'x']), K('y', ['type', 'y']), K('n', ['type', 'n']),
      K('x^2', ['type', '^2'], { tex: 'x^2', after: 'right' }), K('x^{' + sq + '}', ['struct', 'sup'], { tex: 1, title: '指数  ^' }), K('x_{' + sq + '}', ['struct', 'sub'], { tex: 1, title: '添字  _' }),
      K('\\frac{' + sq + '}{' + sq + '}', ['struct', 'frac'], { tex: 1, title: '分数  /' }), K('\\sqrt{' + sq + '}', ['struct', 'sqrt'], { tex: 1, title: 'sqrt(' }),
      K('\\sqrt[n]{' + sq + '}', ['struct', 'nroot'], { tex: 1, title: 'nroot(' }), K('(' + sq + ')', ['struct', 'paren'], { tex: 1 }), K('|' + sq + '|', ['struct', 'abs'], { tex: 1, title: '|' }),
      K('+', ['type', '+']), K('−', ['type', '-']), K('×', ['sym', 'times']), K('⋅', ['type', '*'], { title: '*' }), K('÷', ['sym', 'div']), K('=', ['type', '=']),
      K('<', ['type', '<']), K('>', ['type', '>']), K('≤', ['sym', 'leq'], { title: '<=' }), K('≥', ['sym', 'geq'], { title: '>=' }), K('≠', ['sym', 'neq'], { title: '!=' }), K('±', ['sym', 'pm'], { title: '+-' }),
      K('π', ['sym', 'pi'], { title: 'pi' }), K('e', ['type', 'e']), K('i', ['type', 'i']), K('∞', ['sym', 'infty'], { title: 'inf' }), K('°', ['sym', '#deg'], { title: 'deg' }), K('′', ['type', "'"]), K('!', ['type', '!']), K(',', ['type', ',']),
      ...'7894561230.'.split('').map(d => K(d, ['type', d])),
      K('←', ['key', 'left'], { nav: 1 }), K('→', ['key', 'right'], { nav: 1 }), K('↑', ['key', 'up'], { nav: 1 }), K('↓', ['key', 'down'], { nav: 1 }), K('⌫', ['key', 'backspace'], { nav: 1 }), K('改行', ['key', 'newline'], { nav: 1, ui: 1, title: '複数行（align）用' })
    ],
    '関数': [
      ...['sin', 'cos', 'tan', 'ln', 'log', 'exp'].map(f => K(f, ['fn', f], { ui: 0 })),
      K('\\log_{' + sq + '}', ['latex', '\\log_{}'], { tex: 1, title: 'log_' }), K('\\sin^{-1}', ['latex', '\\sin^{-1}'], { tex: 1 }), K('\\arctan', ['fn', 'arctan'], { tex: 1 }),
      K('\\lim_{x\\to ' + sq + '}', ['struct', 'lim'], { tex: 1, title: 'lim_' }), K('\\sum_{' + sq + '}^{' + sq + '}', ['struct', 'sum'], { tex: 1, title: 'sum_' }), K('\\prod_{' + sq + '}^{' + sq + '}', ['struct', 'prod'], { tex: 1 }),
      K('\\int_{' + sq + '}^{' + sq + '}', ['struct', 'int'], { tex: 1, title: 'int_' }), K('\\int', ['sym', 'int'], { tex: 1 }), K('\\oint', ['sym', 'oint'], { tex: 1 }), K('\\iint', ['sym', 'iint'], { tex: 1 }),
      K('\\frac{d}{dx}', ['struct', 'deriv'], { tex: 1 }), K('\\frac{\\partial}{\\partial x}', ['struct', 'pderiv'], { tex: 1 }), K('∂', ['sym', 'partial']), K('∇', ['sym', 'nabla']), K('dx', ['type', 'dx'], { ui: 0 }),
      K('\\max', ['fn', 'max'], { tex: 1 }), K('\\min', ['fn', 'min'], { tex: 1 }), K('\\lfloor ' + sq + '\\rfloor', ['struct', 'floor'], { tex: 1 }), K('\\lceil ' + sq + '\\rceil', ['struct', 'ceil'], { tex: 1 }),
      K('\\binom{n}{k}', ['struct', 'binom'], { tex: 1 }), K('n!', ['type', '!']), K('\\langle ' + sq + '\\rangle', ['struct', 'angle'], { tex: 1 }), K('\\|' + sq + '\\|', ['struct', 'norm'], { tex: 1 })
    ],
    'αβγ': [
      ...['alpha', 'beta', 'gamma', 'delta', 'varepsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'pi', 'rho', 'sigma', 'tau', 'upsilon', 'varphi', 'phi', 'chi', 'psi', 'omega', 'vartheta', 'epsilon'].map(g => K(MathCore.SYM[g].v, ['sym', g], { title: g })),
      ...['Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Upsilon', 'Phi', 'Psi', 'Omega'].map(g => K(MathCore.SYM[g].v, ['sym', g], { title: g }))
    ],
    '記号': [
      ...['in', 'notin', 'subset', 'subseteq', 'supset', 'cup', 'cap', 'setminus', 'emptyset', 'forall', 'exists', 'neg', 'wedge', 'vee', 'Rightarrow', 'Leftrightarrow', 'to', 'leftarrow', 'mapsto', 'approx', 'equiv', 'sim', 'simeq', 'propto', 'll', 'gg', 'perp', 'parallel', 'angle', 'triangle', 'cdots', 'ldots', 'vdots', 'ddots', 'therefore', 'because', 'hbar', 'ell', 'times', 'circ', 'otimes', 'oplus', 'mp'].map(g => K(MathCore.SYM[g].v, ['sym', g], { title: g })),
      ...['R', 'N', 'Z', 'Q', 'C'].map(c => K('\\mathbb{' + c + '}', ['latex', '\\mathbb{' + c + '}'], { tex: 1 }))
    ],
    '構造': [
      K('\\begin{pmatrix}' + sq + '&' + sq + '\\\\' + sq + '&' + sq + '\\end{pmatrix}', ['struct', 'pmatrix'], { tex: 1, wide: 1, title: '行列 ( )' }),
      K('\\begin{bmatrix}' + sq + '&' + sq + '\\\\' + sq + '&' + sq + '\\end{bmatrix}', ['struct', 'bmatrix'], { tex: 1, wide: 1, title: '行列 [ ]' }),
      K('\\begin{vmatrix}' + sq + '&' + sq + '\\\\' + sq + '&' + sq + '\\end{vmatrix}', ['struct', 'vmatrix'], { tex: 1, wide: 1, title: '行列式' }),
      K('3×3', ['struct', 'pmatrix', { rows: 3, cols: 3 }], { ui: 1 }),
      K('\\begin{cases}' + sq + '&' + sq + '\\\\' + sq + '&' + sq + '\\end{cases}', ['struct', 'cases'], { tex: 1, wide: 1, title: '場合分け' }),
      K('\\vec{v}', ['struct', 'vec'], { tex: 1 }), K('\\overline{z}', ['struct', 'overline'], { tex: 1 }), K('\\hat{x}', ['struct', 'hat'], { tex: 1 }),
      K('\\dot{x}', ['struct', 'dot'], { tex: 1 }), K('\\ddot{x}', ['struct', 'ddot'], { tex: 1 }), K('\\tilde{x}', ['struct', 'tilde'], { tex: 1 }),
      K('\\mathbf{A}', ['struct', 'mathbf'], { tex: 1, title: '太字（直立）' }), K('\\boldsymbol{\\alpha}', ['struct', 'boldsymbol'], { tex: 1, title: '太字（斜体）' }),
      K('\\mathbb{R}', ['struct', 'mathbb'], { tex: 1 }), K('\\mathcal{L}', ['struct', 'mathcal'], { tex: 1 }), K('\\mathrm{d}', ['struct', 'mathrm'], { tex: 1, title: '直立（単位など）' }),
      K('文字', ['struct', 'text'], { ui: 1, title: '"' }), K('\\overbrace{abc}', ['struct', 'overbrace'], { tex: 1 }), K('\\underbrace{abc}', ['struct', 'underbrace'], { tex: 1 }),
      K('&amp;', ['type', '&'], { ui: 1, html: 1, title: 'そろえ位置（align）' }), K('改行', ['key', 'newline'], { ui: 1, nav: 1 }), K('空白', ['latex', '\\quad'], { ui: 1 })
    ]
  };

  let kbTab = '基本';
  function renderKb() {
    const tabs = $('#kbTabs'); tabs.replaceChildren();
    for (const name of Object.keys(KB)) {
      const b = document.createElement('button'); b.textContent = name; b.classList.toggle('on', name === kbTab);
      b.addEventListener('mousedown', e => { e.preventDefault(); kbTab = name; renderKb(); });
      tabs.appendChild(b);
    }
    const keys = $('#kbKeys'); keys.replaceChildren();
    for (const k of KB[kbTab]) {
      const b = document.createElement('button');
      b.className = 'key' + (k.nav ? ' nav' : '') + (k.ui ? ' ui' : '') + (k.wide ? ' wide' : '');
      if (k.tex) { try { b.appendChild(MathRender.renderLatex(k.tex === 1 ? k.label : k.tex, { display: true })); } catch (e) { b.textContent = k.label; } }
      else if (k.html) b.innerHTML = k.label; else b.textContent = k.label;
      if (k.title) b.title = k.title;
      b.addEventListener('mousedown', e => e.preventDefault());
      b.addEventListener('click', () => { field.act(k.act); if (k.after) field.key(k.after); field.focus(); });
      keys.appendChild(b);
    }
  }
  renderKb();
  function syncInputMode() {
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (coarse && settings.keyboard) field.input.setAttribute('inputmode', 'none'); else field.input.removeAttribute('inputmode');
  }
  $('#kbToggle').addEventListener('mousedown', e => e.preventDefault());
  $('#kbToggle').addEventListener('click', () => { settings.keyboard = !settings.keyboard; $('#kb').hidden = !settings.keyboard; syncInputMode(); scheduleSave(); field.input.blur(); field.focus(); });

  /* =================================================================
   *  ダイアログ・入出力
   * ================================================================= */
  const modal = $('#modal');
  function showModal(title, bodyNode, buttons, wide) {
    const card = modal.querySelector('.modal-card'); card.replaceChildren(); card.classList.toggle('wide', !!wide);
    const h = document.createElement('div'); h.className = 'modal-h';
    h.appendChild(Object.assign(document.createElement('h3'), { textContent: title }));
    const x = Object.assign(document.createElement('button'), { className: 'btn ghost icon', textContent: '✕', title: '閉じる' }); x.addEventListener('click', hideModal); h.appendChild(x);
    const b = document.createElement('div'); b.className = 'modal-b'; b.appendChild(bodyNode);
    card.append(h, b);
    if (buttons && buttons.length) {
      const f = document.createElement('div'); f.className = 'modal-f';
      for (const bt of buttons) { const e = Object.assign(document.createElement('button'), { className: 'btn' + (bt.primary ? ' primary' : '') + (bt.danger ? ' danger' : ''), textContent: bt.label }); if (bt.left) e.style.marginRight = 'auto'; e.addEventListener('click', () => { if (bt.keep) { bt.fn && bt.fn(); return; } hideModal(); bt.fn && bt.fn(); }); f.appendChild(e); }
      card.appendChild(f);
    }
    modal.hidden = false;
    const first = card.querySelector('textarea') || card.querySelector('.modal-f .primary') || x; first.focus();
  }
  function hideModal() { modal.hidden = true; }
  modal.addEventListener('mousedown', e => { if (e.target === modal) hideModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) { hideModal(); e.preventDefault(); } });
  function rawDialog(title, tex, note, onSave, canDelete) {
    const w = document.createElement('div');
    if (note) w.appendChild(Object.assign(document.createElement('p'), { className: 'note', textContent: note }));
    const t = document.createElement('textarea'); t.className = 'rawedit'; t.value = tex; t.spellcheck = false; w.appendChild(t);
    t.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); hideModal(); onSave(t.value); } });
    const btns = [{ label: 'キャンセル' }, { label: '保存', primary: true, fn: () => onSave(t.value) }];
    if (canDelete) btns.unshift({ label: '削除', danger: true, left: true, fn: () => onSave('') });
    showModal(title, w, btns);
  }
  function confirmBox(title, msg, okLabel, fn) { showModal(title, Object.assign(document.createElement('p'), { textContent: msg }), [{ label: 'キャンセル' }, { label: okLabel, primary: true, fn }]); }

  function copyText(text, msg) {
    const done = () => toast(msg || 'コピーしました');
    const fallback = () => { const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { } t.remove(); ok ? done() : toast('コピーできませんでした。LaTeX 欄を選択して Ctrl+C でコピーしてください'); };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
  }
  $('#btnCopy').addEventListener('click', () => { syncFromWys(); copyText(ta.value, 'LaTeX をコピーしました（.tex に貼り付けて使えます）'); });
  function openFile(f) {
    const r = new FileReader();
    r.onload = () => confirmBox('ファイルを開く', `「${f.name}」を開きます。いまの内容は置き換わります。`, '開く', () => {
      loadTex(String(r.result)); docName.value = f.name.replace(/(\.tex)?(\.txt)?$/i, '') || 'report'; scheduleSave(); toast('開きました: ' + f.name);
    });
    r.readAsText(f);
  }
  $('#fileOpen').addEventListener('change', e => { const f = e.target.files[0]; if (f) openFile(f); e.target.value = ''; });
  for (const z of [page, ta]) {
    z.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
    z.addEventListener('drop', e => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f && /\.(tex|txt)$/i.test(f.name)) { e.preventDefault(); openFile(f); } });
  }
  let downloads = null;
  if (window.claude && typeof window.claude.use === 'function') {
    window.claude.use('downloads').then(d => { downloads = d; if (d) { $('#btnDownload').hidden = false; $('#btnExport').hidden = false; } }).catch(() => { });
  }
  async function saveFile(filename, data, okMsg) {
    if (!downloads) return;
    try { await downloads.save({ filename, data }); toast(okMsg); }
    catch (e) { if (e && e.code === 'declined') return; toast('保存できませんでした（' + ((e && e.code) || 'error') + '）。コピーをお使いください'); }
  }
  $('#btnDownload').addEventListener('click', () => { syncFromWys(); saveFile((docName.value || 'report') + '.tex.txt', ta.value, '保存しました。拡張子の .txt を外すと .tex として使えます'); });
  $('#btnExport').addEventListener('click', () => saveFile((docName.value || 'report') + '.html', exportHtml(), 'HTML を保存しました。ブラウザで開いて印刷すると PDF にできます'));
  function exportHtml() {
    const css = [...document.styleSheets].map(s => { try { return [...s.cssRules].map(r => r.cssText).join('\n'); } catch (e) { return ''; } }).join('\n');
    const fonts = document.querySelector('link[href*="fonts.googleapis"]');
    const clone = page.cloneNode(true);
    clone.querySelectorAll('[contenteditable]').forEach(e => e.removeAttribute('contenteditable'));
    clone.querySelectorAll('.sync').forEach(e => e.classList.remove('sync'));
    return '<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + docName.value.replace(/</g, '&lt;') + '</title>' + (fonts ? fonts.outerHTML : '') +
      '<style>' + css + '\nbody{overflow:auto;display:block;background:#ecebe6}.page{margin:24px auto}.titleblock [data-f]:empty{display:none}@media print{body{background:#fff}.page{margin:0;box-shadow:none}}</style></head><body>' + clone.outerHTML + '</body></html>';
  }
  $('#btnNew').addEventListener('click', () => {
    const d = document.createElement('div'); d.className = 'tpl';
    for (const [t, s, src] of [['白紙のレポート', 'タイトル・見出し1つだけ', BLANK], ['サンプル（実験レポート）', '数式・表・参照・箇条書きの例', SAMPLE], ['本文だけ（断片）', '既存の .tex に貼り付ける部分を書く', '\\section{見出し}\n本文\n']]) {
      const b = document.createElement('button'); b.innerHTML = '<b></b><span></span>'; b.querySelector('b').textContent = t; b.querySelector('span').textContent = s;
      b.addEventListener('click', () => { hideModal(); loadTex(src); scheduleSave(); toast('新しい文書を作りました'); const f = page.querySelector('[data-f="title"]'); if (f && !f.textContent && !meta.fragment) { f.focus(); } });
      d.appendChild(b);
    }
    const note = Object.assign(document.createElement('p'), { className: 'note', textContent: 'いまの内容は置き換わります。必要なら先に「LaTeXをコピー」で控えてください。' });
    const w = document.createElement('div'); w.append(d, note);
    showModal('新規作成', w);
  });
  $('#btnSettings').addEventListener('click', () => {
    const w = document.createElement('div');
    for (const [k, t, s] of [['autoWords', '単語を記号に自動変換', 'alpha → α、pi → π、inf → ∞ など（GeoGebra と同じ）。直後の Backspace で元に戻せます。'], ['keyboard', '数式パネルに画面キーボードを表示', 'マウスやタッチで記号・構造を入れられます。']]) {
      const l = document.createElement('label'); l.className = 'opt';
      const c = Object.assign(document.createElement('input'), { type: 'checkbox', checked: !!settings[k] });
      c.addEventListener('change', () => { settings[k] = c.checked; if (k === 'autoWords') field.setAutoWords(c.checked); scheduleSave(); });
      const dd = document.createElement('div'); dd.innerHTML = '<b></b><span></span>'; dd.querySelector('b').textContent = t; dd.querySelector('span').textContent = s;
      l.append(c, dd); w.appendChild(l);
    }
    const h = Object.assign(document.createElement('h4'), { textContent: 'プリアンブル（文書クラス・パッケージ）', className: 'opt-h' });
    const pre = document.createElement('textarea'); pre.className = 'rawedit'; pre.value = meta.fragment ? '' : (meta.preamble || DocModel.DEFAULT_PRE); pre.spellcheck = false; pre.disabled = meta.fragment;
    const n = Object.assign(document.createElement('p'), { className: 'note', textContent: meta.fragment ? '本文だけ（断片）の文書にはプリアンブルがありません。' : '\\documentclass や \\usepackage を変更できます。日本語は ltjsarticle（LuaLaTeX）を想定しています。' });
    w.append(h, n, pre);
    showModal('設定', w, [{ label: '閉じる', primary: true, fn: () => { if (!meta.fragment && pre.value !== meta.preamble) { meta.preamble = pre.value; syncFromWys(); } } }]);
  });
  $('#btnHelp').addEventListener('click', showHelp);
  function showHelp() {
    const w = document.createElement('div'); w.className = 'help';
    const sec = (title, rows, note) => {
      w.appendChild(Object.assign(document.createElement('h4'), { textContent: title }));
      if (note) { const p = document.createElement('p'); p.innerHTML = note; w.appendChild(p); }
      const t = document.createElement('table');
      for (const [keys, tex, desc] of rows) {
        const tr = document.createElement('tr');
        const a = document.createElement('td'); a.innerHTML = keys;
        const b = document.createElement('td'); b.className = 'r'; if (tex) b.appendChild(MathRender.renderLatex(tex, { display: true }));
        tr.append(a, b, Object.assign(document.createElement('td'), { textContent: desc || '' })); t.appendChild(tr);
      }
      w.appendChild(t);
    };
    sec('文書を書く（Word と同じ感覚）', [
      ['ふつうに入力', '', '段落。Enter で次の段落'],
      ['<code>#</code> <kbd>Space</kbd>', '', '見出し（## で小見出し、### でその下）'],
      ['<code>-</code> <kbd>Space</kbd> / <code>1.</code> <kbd>Space</kbd>', '', '箇条書き / 番号付きリスト（Tab で1段下げ）'],
      ['<kbd>Ctrl</kbd>+<kbd>B</kbd> <kbd>I</kbd> <kbd>U</kbd>', '', '太字・斜体（強調）・下線'],
      ['<kbd>$</kbd> または <kbd>Ctrl</kbd>+<kbd>M</kbd>', '', '数式を入れる（パネルで「別行」「番号付き」も選べる）'],
      ['数式をクリック', '', 'その数式を編集。中身を全部消して確定すると削除'],
      ['メニュー［挿入］', '', '定理・証明・図・脚注・リンク・目次・付録・コードなど'],
      ['メニュー［参照］', '', '式・節・図・表の番号や、参考文献の引用 [1] を入れる（ラベルは自動）'],
      ['メニュー［書式］', '', '見出し・太字・等幅・上付き/下付き・文字色など'],
      ['メニュー［ファイル］→ 文書の設定', '', '用紙・文字の大きさ・余白・2段組・文書クラス'],
      ['表', '', 'Tab で次のセル、最後のセルで Tab を押すと行が増える'],
    ], '左で書いた内容は、右の LaTeX 欄に自動で LaTeX として書き出されます。LaTeX を知らなくても完成した .tex が手に入ります。');
    sec('LaTeX と同時に編集', [
      ['右の LaTeX 欄を直接編集', '', '左の画面に自動で反映されます'],
      ['左でカーソルを動かす', '', '右の LaTeX の該当部分がハイライトされます（逆も同じ）'],
      ['編集画面で表現できないもの', '', '図や独自の環境などは「LaTeX ブロック」として保持（クリックで編集）'],
    ], '左を編集すると、右の LaTeX は整形し直されます（コメントの位置などが変わることがあります）。');
    sec('数式パネル（GeoGebra と同じ入力）', [
      ['<code>1/4+x</code>', '\\frac{1}{4+x}', '/ は直前のかたまりを分子にし、続きは分母へ'],
      ['<code>1/4</code> <kbd>→</kbd> <code>+x</code>', '\\frac{1}{4}+x', '→ か Space で枠から抜ける'],
      ['<code>x^2</code> <kbd>Space</kbd> <code>+1</code>', 'x^2+1', '指数は → / Space で抜ける'],
      ['<code>v_0+at</code>', 'v_0+at', '添字は + − = などで自動的に抜ける'],
      ['<code>sqrt(x</code>', '\\sqrt{x}', '関数名 + ( で構造に（nroot( abs( vec( …）'],
      ['<code>alpha</code> <code>pi</code> <code>inf</code>', '\\alpha\\ \\pi\\ \\infty', '名前で記号に（直後の Backspace で戻る）'],
      ['<code>&lt;=</code> <code>!=</code> <code>-&gt;</code>', '\\leq\\ \\neq\\ \\to', ''],
      ['<code>"速度"</code>', '\\text{速度}', '" で囲むと文字（日本語も可）'],
      ['<code>\\frac{a}{b}</code>', '\\frac{a}{b}', 'LaTeX 命令も直接打てる（Tab で補完）'],
    ]);
    showModal('使い方', w, null, true);
  }

  /* ---------------- 表示モード・分割 ---------------- */
  function setView(v) {
    settings.view = v;
    document.body.dataset.view = v;
    document.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('on', x.dataset.view === v));
    if (v === 'tex') { syncFromWys(); }
    scheduleSave();
  }
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  const gutter = $('#gutter'), split = $('#split');
  gutter.addEventListener('pointerdown', e => {
    gutter.setPointerCapture(e.pointerId); gutter.classList.add('drag');
    const move = ev => { const r = split.getBoundingClientRect(); const x = Math.min(Math.max(ev.clientX - r.left, 320), r.width - 260); split.style.setProperty('--left', x + 'px'); split.style.setProperty('--right', '1fr'); };
    const up = () => { gutter.classList.remove('drag'); gutter.removeEventListener('pointermove', move); gutter.removeEventListener('pointerup', up); };
    gutter.addEventListener('pointermove', move); gutter.addEventListener('pointerup', up);
  });

  /* ---------------- 保存・状態 ---------------- */
  let saveT = 0;
  function markDirty() { $('#stSave').textContent = '…'; }
  function scheduleSave() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      const ok = store.set({ src: ta.value, name: docName.value, settings });
      $('#stSave').textContent = ok ? '✓ このブラウザに自動保存' : '自動保存できません（コピーで保存してください）';
    }, 500);
  }
  docName.addEventListener('input', scheduleSave);
  function updateCounts() {
    const text = wys.innerText.replace(/\s/g, '');
    $('#stInfo').textContent = `${text.length} 文字・数式 ${regions.length} 個`;
  }
  if (settings.welcome) {
    const w = $('#welcome'); w.hidden = false;
    w.querySelector('.x').addEventListener('click', () => { w.hidden = true; settings.welcome = false; scheduleSave(); });
  }

  /* ---------------- 起動 ---------------- */
  const tpl = new URLSearchParams(location.search).get('tpl');
  const initial = saved.src != null ? saved.src : tpl === 'sample' ? SAMPLE : BLANK;
  if (saved.src == null) { docName.value = P.find(PID).name; history.replaceState(null, '', 'editor.html?id=' + encodeURIComponent(PID)); setTimeout(scheduleSave, 0); }
  loadTex(initial);
  setView(window.innerWidth <= 860 && settings.view === 'split' ? 'edit' : settings.view);
  $('#stSave').textContent = saved.src != null ? '✓ 前回の内容を復元しました' : '';
  window.__app = { field, openMath, syncFromWys, loadTex, ta, page, settings };
})();
