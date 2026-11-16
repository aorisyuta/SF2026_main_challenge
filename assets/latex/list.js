/* LaTeXライター — プロジェクト一覧（latex/index.html） */
(function () {
  'use strict';
  var P = window.LWProjects;
  var list = document.getElementById('lwList'), empty = document.getElementById('lwEmpty');
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function when(t) {
    var d = new Date(t), now = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    var hm = p(d.getHours()) + ':' + p(d.getMinutes());
    if (d.toDateString() === now.toDateString()) return '今日 ' + hm;
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + hm;
  }
  function open(id, tpl) { location.href = 'editor.html?id=' + encodeURIComponent(id) + (tpl ? '&tpl=' + tpl : ''); }
  function render() {
    var a = P.list();
    empty.hidden = a.length > 0;
    list.innerHTML = a.map(function (p) {
      var d = P.load(p.id), src = (d && d.src) || '';
      var title = (src.match(/\\title\{([^}]*)\}/) || [])[1] || '';
      return '<li class="lw-item" data-id="' + esc(p.id) + '">' +
        '<a class="lw-open" href="editor.html?id=' + encodeURIComponent(p.id) + '">' +
          '<span class="lw-ic" aria-hidden="true">∑</span>' +
          '<span class="lw-body"><strong>' + esc(p.name) + '<small>.tex</small></strong>' +
          (title ? '<span class="lw-title">' + esc(title) + '</span>' : '') +
          '<span class="lw-meta">更新：' + when(p.updated) + '　' + src.length.toLocaleString() + ' 文字</span></span></a>' +
        '<span class="lw-ops">' +
          '<button type="button" data-op="rename">名前を変更</button>' +
          '<button type="button" data-op="dup">複製</button>' +
          '<button type="button" data-op="del" class="lw-del">削除</button>' +
        '</span></li>';
    }).join('');
  }
  list.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-op]'); if (!b) return;
    var id = b.closest('.lw-item').dataset.id, p = P.find(id); if (!p) return;
    if (b.dataset.op === 'rename') { var n = prompt('新しい名前', p.name); if (n && n.trim()) { P.rename(id, n.trim()); render(); } }
    else if (b.dataset.op === 'dup') { P.duplicate(id); render(); }
    else if (b.dataset.op === 'del') { if (confirm('「' + p.name + '」を削除します。元に戻せません。よろしいですか？')) { P.remove(id); render(); } }
  });
  document.getElementById('lwNewBlank').addEventListener('click', function () { open(P.create('report'), 'blank'); });
  document.getElementById('lwNewSample').addEventListener('click', function () { open(P.create('sample'), 'sample'); });
  document.getElementById('lwImport').addEventListener('change', function () {
    var f = this.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () { var name = f.name.replace(/(\.tex)?(\.txt)?$/i, '') || 'report'; open(P.create(name, { src: String(r.result), name: name })); };
    r.readAsText(f);
  });
  render();
  window.addEventListener('pageshow', render); // 戻るボタンで戻ったときも最新の一覧に
})();
