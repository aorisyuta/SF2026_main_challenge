/*
  archive-frame.js — アーカイブされたサイト（archive/<site>/）の各ページの <head> 先頭で読み込む。
  閲覧ページ（archive/view.html）の外で直接開かれたら、閲覧ページの中で開き直す。
  （tools/rebase_sf25.py が取り込み時に差し込む）
*/
(function () {
  if (window.top !== window.self) return;
  var m = location.pathname.match(/^(.*\/archive\/)([a-z0-9-]+)(\/.*)?$/);
  if (!m) return;
  var q = 'site=' + encodeURIComponent(m[2]);
  var p = (m[3] || '/').replace(/\/index\.html$/, '/') + location.search + location.hash;
  if (p !== '/') q += '&path=' + encodeURIComponent(p);
  location.replace(m[1] + 'view.html?' + q);
})();
