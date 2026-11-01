/* 積分リール用の MathJax 設定（tex-svg.js より前に読み込む） */
window.MathJax = {
  tex: { inlineMath: [['$', '$']], displayMath: [['$$', '$$']] },
  svg: { fontCache: 'global' },
  options: { enableMenu: false },
  startup: {
    typeset: false,
    pageReady() { window.__mjOK = true; document.dispatchEvent(new Event('mj-ready')); return Promise.resolve(); }
  }
};
