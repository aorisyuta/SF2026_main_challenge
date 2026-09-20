/*
  blog.js — Aoristos / Osaka Seiko Gakuin SF 2026
  blog/blog-data.json から一覧・記事本文を組み立てる。

  エコ方針:
    - 記事データの取得は 1 ページにつき 1 回だけ
    - スタイルは style.css のクラスに寄せ、インライン style を出力しない
*/

(function () {
  'use strict';

  function dataUrl() {
    var basePath = (window.pageConfig && window.pageConfig.basePath) || '';
    return basePath + 'blog/blog-data.json';
  }

  function fetchPosts() {
    return fetch(dataUrl())
      .then(function (res) {
        if (!res.ok) throw new Error('blog-data.json の取得に失敗しました (' + res.status + ')');
        return res.json();
      })
      .then(function (posts) {
        // 新しい記事が先頭
        return posts.slice().sort(function (a, b) {
          return new Date(b.date) - new Date(a.date);
        });
      });
  }

  function showError(container, message) {
    if (!container) return;
    container.textContent = '';
    var p = document.createElement('p');
    p.className = 'no-results';
    p.textContent = message;
    container.appendChild(p);
  }

  /* ---------------------------------------------------------
     一覧ページ
  --------------------------------------------------------- */
  function renderPostList() {
    var list = document.querySelector('.blog-list');
    if (!list) return;

    var basePath = (window.pageConfig && window.pageConfig.basePath) || '';

    fetchPosts().then(function (posts) {
      var fragment = document.createDocumentFragment();

      posts.forEach(function (post) {
        var article = document.createElement('article');
        article.className = 'post-card';

        var h3 = document.createElement('h3');
        var link = document.createElement('a');
        link.href = basePath + 'blog/post.html?id=' + encodeURIComponent(post.id);
        link.textContent = post.title || '';
        h3.appendChild(link);

        var meta = document.createElement('p');
        meta.className = 'post-meta';
        meta.textContent = post.date + ' ・ ' + (post.author || '運営');

        var summary = document.createElement('p');
        summary.textContent = post.summary || '';

        var more = document.createElement('a');
        more.className = 'button';
        more.href = link.href;
        more.textContent = '続きを読む';

        article.appendChild(h3);
        article.appendChild(meta);
        article.appendChild(summary);
        article.appendChild(more);
        fragment.appendChild(article);
      });

      list.textContent = '';
      list.appendChild(fragment);
    }).catch(function (err) {
      console.error(err);
      showError(list, 'ブログ記事を読み込めませんでした。ローカル確認時は python -m http.server 8000 をお使いください。');
    });
  }

  /* ---------------------------------------------------------
     記事ページ
  --------------------------------------------------------- */
  function currentPostId() {
    var id = new URLSearchParams(window.location.search).get('id');
    if (id) return id;
    return window.location.pathname.split('/').pop().replace(/\.html$/, '');
  }

  function renderPost() {
    var article = document.querySelector('.post-article');
    if (!article) return;

    var postId = currentPostId();

    fetchPosts().then(function (posts) {
      var index = posts.findIndex(function (p) { return p.id === postId; });
      if (index === -1) {
        showError(article, '記事が見つかりませんでした。');
        return;
      }

      var post = posts[index];

      var h1 = document.createElement('h1');
      h1.textContent = post.title || '';

      var meta = document.createElement('p');
      meta.className = 'post-meta';
      meta.textContent = post.date + ' ・ ' + (post.author || '運営');

      var bodyWrap = document.createElement('div');
      bodyWrap.className = 'post-body';
      // content は運営が用意した記事HTML（blog-data.json）をそのまま使う
      bodyWrap.innerHTML = post.content || '';

      article.textContent = '';
      article.appendChild(h1);
      article.appendChild(meta);
      article.appendChild(bodyWrap);

      if (post.tags && post.tags.length) {
        var tagWrap = document.createElement('div');
        tagWrap.className = 'post-tags';
        var label = document.createElement('strong');
        label.textContent = 'タグ:';
        tagWrap.appendChild(label);
        post.tags.forEach(function (t) {
          var span = document.createElement('span');
          span.className = 'tag';
          span.textContent = t;
          tagWrap.appendChild(span);
        });
        article.appendChild(tagWrap);
      }

      document.title = (post.title || 'ブログ記事') + ' — SF 2026 ブログ';
      renderPostNavigation(article, posts, index);
    }).catch(function (err) {
      console.error(err);
      showError(article, 'この記事を読み込めませんでした。');
    });
  }

  function postNavLink(post, label, href) {
    var a = document.createElement('a');
    a.className = 'post-nav-link';
    a.href = href;

    var labelEl = document.createElement('div');
    labelEl.className = 'post-nav-label';
    labelEl.textContent = label;

    var titleEl = document.createElement('div');
    titleEl.className = 'post-nav-title';
    titleEl.textContent = post.title || '';

    var dateEl = document.createElement('div');
    dateEl.className = 'post-nav-date';
    dateEl.textContent = post.date || '';

    a.appendChild(labelEl);
    a.appendChild(titleEl);
    a.appendChild(dateEl);
    return a;
  }

  function renderPostNavigation(article, posts, index) {
    var basePath = (window.pageConfig && window.pageConfig.basePath) || '';
    var current = posts[index];
    var newer = index > 0 ? posts[index - 1] : null;
    var older = index < posts.length - 1 ? posts[index + 1] : null;

    var nav = document.createElement('nav');
    nav.className = 'post-navigation';
    nav.setAttribute('aria-label', '記事ナビゲーション');

    var backWrap = document.createElement('div');
    var back = document.createElement('a');
    back.className = 'button button-secondary';
    back.href = basePath + 'blog.html';
    back.textContent = '← ブログ一覧に戻る';
    backWrap.appendChild(back);
    nav.appendChild(backWrap);

    var links = document.createElement('div');
    links.className = 'post-nav-links';

    var prevCell = document.createElement('div');
    if (newer) prevCell.appendChild(postNavLink(newer, '← 新しい記事', 'post.html?id=' + encodeURIComponent(newer.id)));
    links.appendChild(prevCell);

    var nextCell = document.createElement('div');
    if (older) nextCell.appendChild(postNavLink(older, '古い記事 →', 'post.html?id=' + encodeURIComponent(older.id)));
    links.appendChild(nextCell);

    nav.appendChild(links);

    // 同じタグを持つ記事を最大3件
    var recommended = posts.filter(function (p) {
      if (p.id === current.id) return false;
      if (!current.tags || !p.tags) return false;
      return current.tags.some(function (t) { return p.tags.indexOf(t) !== -1; });
    }).slice(0, 3);

    if (recommended.length) {
      var h3 = document.createElement('h3');
      h3.textContent = 'おすすめの記事';
      nav.appendChild(h3);

      var grid = document.createElement('div');
      grid.className = 'recommended-grid';

      recommended.forEach(function (p) {
        var item = document.createElement('article');
        item.className = 'recommended-post';

        var h4 = document.createElement('h4');
        var a = document.createElement('a');
        a.href = 'post.html?id=' + encodeURIComponent(p.id);
        a.textContent = p.title || '';
        h4.appendChild(a);

        var date = document.createElement('p');
        date.className = 'post-nav-date';
        date.textContent = p.date || '';

        var summary = document.createElement('p');
        summary.textContent = p.summary || '';

        item.appendChild(h4);
        item.appendChild(date);
        item.appendChild(summary);
        grid.appendChild(item);
      });

      nav.appendChild(grid);
    }

    article.insertAdjacentElement('afterend', nav);
  }

  /* ---------------------------------------------------------
     起動（ページ種別は body のクラスで判定）
  --------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    if (document.querySelector('.blog-list')) renderPostList();
    else if (document.querySelector('.post-article')) renderPost();
  });
})();
