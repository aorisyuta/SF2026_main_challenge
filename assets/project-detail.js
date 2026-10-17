/*
  project-detail.js — 企画ページ（projects/<id>.html）の本文を
  assets/projects-details.json から組み立てる。ファイル名が企画 ID。
*/
(function () {
  'use strict';

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function specRow(label, value) {
    var row = el('div', 'spec-row');
    row.appendChild(el('dt', null, label));
    row.appendChild(el('dd', null, value));
    return row;
  }

  function render(p, root) {
    document.title = p.title + ' — 企画 | 大阪星光学院 SF 2026';
    var cat = window.SFProjects ? window.SFProjects.categoryClass(p.category) : '';

    var hero = el('header', 'page-hero page-hero-left');
    var inner = el('div', 'container');
    if (p.category) inner.appendChild(el('p', 'eyebrow ' + cat, p.category));
    inner.appendChild(el('h1', 'page-title', p.title));
    if (p.description) inner.appendChild(el('p', 'page-lead', p.description));
    hero.appendChild(inner);

    var body = el('div', 'container detail-body');

    if (p.thumb) {
      var fig = el('figure', 'detail-figure');
      var img = el('img');
      img.src = '../' + p.thumb;
      img.alt = '';
      img.decoding = 'async';
      img.addEventListener('error', function () { fig.remove(); });
      fig.appendChild(img);
      body.appendChild(fig);
    }

    if (p.fullDescription) {
      var about = el('section', 'detail-about');
      about.appendChild(el('h2', 'section-title-sm', 'この企画について'));
      about.appendChild(el('p', null, p.fullDescription));
      body.appendChild(about);
    }

    var specs = el('section', 'detail-specs');
    specs.appendChild(el('h2', 'section-title-sm', '開催情報'));
    var dl = el('dl', 'spec-list');
    if (p.location) dl.appendChild(specRow('場所', p.location));
    if (p.schedule) dl.appendChild(specRow('時間', p.schedule));
    if (p.duration) dl.appendChild(specRow('所要時間', p.duration));
    (p.details || []).forEach(function (d) { dl.appendChild(specRow(d.label, d.content)); });
    specs.appendChild(dl);
    body.appendChild(specs);

    var back = el('p', 'detail-back');
    var a = el('a', 'more-link more-back', '企画一覧へ戻る');
    a.href = '../projects.html';
    back.appendChild(a);
    body.appendChild(back);

    root.textContent = '';
    root.appendChild(hero);
    root.appendChild(body);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var root = document.getElementById('projectDetail');
    if (!root) return;
    var id = location.pathname.split('/').pop().replace(/\.html$/, '');

    fetch('../assets/projects-details.json').then(function (res) {
      if (!res.ok) throw new Error('projects-details.json の取得に失敗しました (' + res.status + ')');
      return res.json();
    }).then(function (data) {
      var p = (data.projects || []).filter(function (x) { return x.id === id; })[0];
      if (!p) throw new Error('企画が見つかりません: ' + id);
      render(p, root);
    }).catch(function (err) {
      console.error(err);
      var c = root.querySelector('.container') || root;
      c.insertAdjacentHTML('beforeend', '<p class="empty">詳しい情報を読み込めませんでした。<a href="../projects.html">企画一覧</a>からお探しください。</p>');
    });
  });
})();
