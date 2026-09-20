/*
  project-detail.js — Aoristos / Osaka Seiko Gakuin SF 2026
  assets/projects-details.json から企画ページの本文を組み立てる。
  ファイル名（例: electric.html）が企画 ID に対応する。
*/

(function () {
  'use strict';

  function projectIdFromUrl() {
    return window.location.pathname.split('/').pop().replace(/\.html$/, '') || 'index';
  }

  function detailItem(label, content) {
    var item = document.createElement('div');
    item.className = 'detail-item';
    var strong = document.createElement('strong');
    strong.textContent = label;
    var p = document.createElement('p');
    p.textContent = content;
    item.appendChild(strong);
    item.appendChild(p);
    return item;
  }

  function section(heading) {
    var sec = document.createElement('section');
    sec.className = 'project-detail-section';
    var h2 = document.createElement('h2');
    h2.textContent = heading;
    sec.appendChild(h2);
    return sec;
  }

  function render(project, container) {
    document.title = project.title + ' — SF 2026 企画紹介';

    var brandTitle = document.querySelector('.brand-title');
    if (brandTitle) brandTitle.textContent = project.title;
    var brandSub = document.querySelector('.brand-sub');
    if (brandSub) brandSub.textContent = project.description || '企画の詳しい情報';

    var hero = document.createElement('div');
    hero.className = 'project-hero';

    if (project.thumb) {
      var thumbWrap = document.createElement('div');
      thumbWrap.className = 'project-hero-thumb';
      var img = document.createElement('img');
      img.src = '../' + project.thumb;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.addEventListener('error', function () { thumbWrap.remove(); });
      thumbWrap.appendChild(img);
      hero.appendChild(thumbWrap);
    }

    var info = document.createElement('div');
    info.className = 'project-hero-info';
    var h1 = document.createElement('h1');
    h1.textContent = project.title;
    var lead = document.createElement('p');
    lead.className = 'muted';
    lead.textContent = project.description || '';
    info.appendChild(h1);
    info.appendChild(lead);
    hero.appendChild(info);

    container.textContent = '';
    container.appendChild(hero);

    if (project.fullDescription) {
      var descSection = section('詳しい説明');
      var p = document.createElement('p');
      p.textContent = project.fullDescription;
      descSection.appendChild(p);
      container.appendChild(descSection);
    }

    var infoSection = section('開催情報');
    if (project.location) infoSection.appendChild(detailItem('場所', project.location));
    if (project.schedule) infoSection.appendChild(detailItem('開催時間・回数', project.schedule));
    if (project.duration) infoSection.appendChild(detailItem('所要時間', project.duration));
    container.appendChild(infoSection);

    if (project.details && project.details.length) {
      var otherSection = section('その他のご案内');
      project.details.forEach(function (d) {
        otherSection.appendChild(detailItem(d.label, d.content));
      });
      container.appendChild(otherSection);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var container = document.getElementById('projectDetail');
    if (!container) return;

    var id = projectIdFromUrl();

    fetch('../assets/projects-details.json')
      .then(function (res) {
        if (!res.ok) throw new Error('projects-details.json の取得に失敗しました (' + res.status + ')');
        return res.json();
      })
      .then(function (data) {
        var project = (data.projects || []).find(function (p) { return p.id === id; });
        if (!project) throw new Error('企画が見つかりません: ' + id);
        render(project, container);
      })
      .catch(function (err) {
        console.error(err);
        container.innerHTML =
          '<p class="no-results">企画情報を読み込めませんでした。' +
          '<a href="../projects.html">企画一覧</a>からお探しください。</p>';
      });
  });
})();
