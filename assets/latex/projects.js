/*
  LaTeXライター — プロジェクトの保存（このブラウザの localStorage）
    aoristos-latex:projects   プロジェクトの一覧 [{ id, name, created, updated }]
    aoristos-latex:p:<id>     各プロジェクトの中身 { src, name }
    aoristos-latex:settings   エディタの設定（全プロジェクト共通）
  以前の単体版（TeXノート：texnote.v2 / texnote.v1）の内容があれば、最初に 1 つのプロジェクトとして取り込む。
*/
(function () {
  'use strict';
  var K_LIST = 'aoristos-latex:projects', K_P = 'aoristos-latex:p:', K_SET = 'aoristos-latex:settings';

  function read(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function list() { return read(K_LIST, []); }
  function setList(a) { return write(K_LIST, a); }
  function find(id) { return list().filter(function (p) { return p.id === id; })[0] || null; }

  function create(name, data) {
    var id = newId(), now = Date.now();
    var a = list(); a.unshift({ id: id, name: name || '無題のプロジェクト', created: now, updated: now }); setList(a);
    if (data) write(K_P + id, data);
    return id;
  }
  function load(id) { return read(K_P + id, null); }
  function save(id, data) {
    var ok = write(K_P + id, data);
    var a = list(), now = Date.now();
    a.forEach(function (p) { if (p.id === id) { p.updated = now; if (data.name) p.name = data.name; } });
    a.sort(function (x, y) { return y.updated - x.updated; });
    setList(a);
    return ok;
  }
  function rename(id, name) {
    var a = list(); a.forEach(function (p) { if (p.id === id) p.name = name; }); setList(a);
    var d = load(id); if (d) { d.name = name; write(K_P + id, d); }
  }
  function remove(id) {
    setList(list().filter(function (p) { return p.id !== id; }));
    try { localStorage.removeItem(K_P + id); } catch (e) {}
  }
  function duplicate(id) {
    var p = find(id); if (!p) return null;
    var d = load(id) || {};
    var name = p.name + ' のコピー';
    return create(name, { src: d.src, name: name });
  }
  function settings() { return read(K_SET, {}); }
  function saveSettings(s) { if (s) write(K_SET, s); }

  // 以前の単体版の内容を取り込む（1 回だけ）
  (function migrate() {
    if (read('aoristos-latex:migrated', false)) return;
    var old = read('texnote.v2', null) || read('texnote.v1', null);
    if (old && old.src) {
      create(old.name || '以前の文書', { src: old.src, name: old.name || '以前の文書' });
      if (old.settings) saveSettings(old.settings);
    }
    write('aoristos-latex:migrated', true);
  })();

  window.LWProjects = { list: list, find: find, create: create, load: load, save: save, rename: rename, remove: remove, duplicate: duplicate, settings: settings, saveSettings: saveSettings };
})();
