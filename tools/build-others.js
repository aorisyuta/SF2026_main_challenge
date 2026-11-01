#!/usr/bin/env node
/*
  tools/build-others.js — 「他の企画」の2ページを作る

  データ: assets/others-data.json（SF 公式サイト https://seikosf.jp の企画・ステージ・校内マップの情報をまとめ直したもの）
  出力  : others.html       概要（基本情報・1日の流れ・階ごと/種類別の図・ステージの時間割）
          others-list.html  企画一覧（校内マップ・検索・絞り込み。動きは assets/others.js）

  使い方: npm run build（generate-pages.js の後、build-site.js の前に実行される）
*/
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'others-data.json'), 'utf8'));
const OUT = path.join(ROOT, 'others.html');
const OUT_LIST = path.join(ROOT, 'others-list.html');
const LIST_PAGE = 'others-list.html';

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* 分類の表示順と色（style.css の --tag-* と対応） */
const TAGS = [
  ['飲食', 'food'], ['ゲーム', 'game'], ['展示', 'exhibit'], ['部誌販売・配布', 'zine'],
  ['販売', 'shop'], ['体験', 'try'], ['アトラクション', 'ride']
];
const tagKey = t => (TAGS.find(x => x[0] === t) || [, 'other'])[1];
const FLOOR_LABEL = { 1: '1F・グラウンド', 2: '2F', 3: '3F', 4: '4F', 5: '5F' };

const booths = data.booths;
const floors = [5, 4, 3, 2, 1];
const byFloor = f => booths.filter(b => b.floor === f);
const tagCount = TAGS.map(([t, k]) => ({ t, k, n: booths.filter(b => b.tags.includes(t)).length }));
const maxTag = Math.max(...tagCount.map(x => x.n));

/* ---------- 図1：1日の流れ ---------- */
function toMin(hm) { const [h, m] = hm.split(':').map(Number); return h * 60 + m; }
const DAYS = [
  { d: 1, label: '11/7（土）', who: '保護者のみ', open: '12:30', close: '16:00',
    marks: [['12:30', '開場'], ['15:00', '食品 受付終了'], ['15:30', '食品 販売終了'], ['16:00', '終了']] },
  { d: 2, label: '11/8（日）', who: 'ビジター券・卒業生・受験生', open: '9:00', close: '15:30',
    marks: [['9:00', '開場'], ['14:00', '食品 受付終了'], ['14:30', '食品 販売終了'], ['15:30', '終了']] }
];
const T0 = toMin('9:00'), T1 = toMin('16:00');
const pct = hm => ((toMin(hm) - T0) / (T1 - T0) * 100).toFixed(2);

function dayFlow() {
  const ticks = [];
  for (let h = 9; h <= 16; h++) ticks.push(`<span class="flow-tick" style="left:${pct(h + ':00')}%">${h}</span>`);
  const edge = (t, label) => {
    const x = Number(pct(t));
    const align = x < 6 ? ' is-left' : x > 94 ? ' is-right' : '';
    return `<span class="flow-mark${align}" style="left:${x}%"><b>${t}</b><i>${esc(label)}</i></span>`;
  };
  return `<div class="flow" role="img" aria-label="1日の流れ。11/7は12:30から16:00、食品は15:00受付終了・15:30販売終了。11/8は9:00から15:30、食品は14:00受付終了・14:30販売終了。">
${DAYS.map(day => {
    const [rec, sale] = [day.marks[1][0], day.marks[2][0]];
    return `      <div class="flow-row">
        <div class="flow-day"><strong>${day.label}</strong><small>${esc(day.who)}</small></div>
        <div>
          <div class="flow-track">
            <span class="flow-bar" style="left:${pct(day.open)}%;width:${(pct(day.close) - pct(day.open)).toFixed(2)}%"></span>
            <span class="flow-food" style="left:${pct(rec)}%;width:${(pct(sale) - pct(rec)).toFixed(2)}%"></span>
            ${edge(day.open, '開場')}
            ${edge(day.close, '終了')}
          </div>
          <p class="flow-note"><span class="flow-key"></span>食品：受付 <b>${rec}</b> まで・販売 <b>${sale}</b> まで</p>
        </div>
      </div>`;
  }).join('\n')}
      <div class="flow-row flow-axis" aria-hidden="true"><div class="flow-day"></div><div class="flow-track">${ticks.join('')}</div></div>
    </div>`;
}

/* ---------- 図2：建物図（階ごとの企画数） ---------- */
function building() {
  const max = Math.max(...floors.map(f => byFloor(f).length));
  return `<div class="bldg" role="list" aria-label="階ごとの企画数">
${floors.map(f => {
    const list = byFloor(f);
    const segs = TAGS.map(([t, k]) => ({ k, n: list.filter(b => b.tags[0] === t).length })).filter(x => x.n);
    const aor = list.find(b => b.aoristos);
    const places = [...new Set(list.map(b => b.outdoor ? 'グラウンド（屋外ブース）' : b.place.split('・')[0]))];
    const extra = f === 5 ? '講堂・第２体育館' : f === 4 ? '音楽室ステージあり' : '';
    return `      <a class="bldg-floor${aor ? ' has-aor' : ''}" role="listitem" href="${LIST_PAGE}?floor=${f}#map" aria-label="${FLOOR_LABEL[f]}：${list.length}企画。この階の地図と企画を見る">
        <span class="bldg-num">${f}F</span>
        <span class="bldg-body">
          <span class="bldg-bar" style="width:${(list.length / max * 100).toFixed(1)}%">${segs.map(s => `<span class="tag-${s.k}" style="flex:${s.n}"></span>`).join('')}</span>
          <span class="bldg-meta"><strong>${list.length}</strong> 企画${extra ? `<em>${extra}</em>` : ''}${aor ? '<em class="bldg-aor">Aoristos はここ（特別第３教室）</em>' : ''}</span>
          <span class="bldg-places">${esc(places.slice(0, 4).join('・'))}${places.length > 4 ? ' ほか' : ''}</span>
        </span>
      </a>`;
  }).join('\n')}
      <div class="bldg-ground" aria-hidden="true">グラウンド</div>
    </div>`;
}

/* ---------- 図3：種類別 ---------- */
function tagChart() {
  return `<ul class="tagchart">
${tagCount.map(x => `      <li><a class="tagchart-row" href="${LIST_PAGE}?tag=${encodeURIComponent(x.t)}#list">
        <span class="tagchart-label">${esc(x.t)}</span>
        <span class="tagchart-track"><span class="tagchart-bar tag-${x.k}" style="width:${(x.n / maxTag * 100).toFixed(1)}%"></span></span>
        <span class="tagchart-n">${x.n}</span>
      </a></li>`).join('\n')}
    </ul>`;
}

/* ---------- 図4：ステージ時間割 ---------- */
function stageDay(d) {
  const slots = data.stage.slots.filter(s => s.day === d);
  const start = d === 1 ? '12:00' : '9:00', end = '16:00';
  const s0 = toMin(start), s1 = toMin(end);
  const p = hm => ((toMin(hm) - s0) / (s1 - s0) * 100).toFixed(2);
  const ticks = [];
  for (let m = s0; m <= s1; m += 60) ticks.push(`<span style="left:${((m - s0) / (s1 - s0) * 100).toFixed(2)}%">${m / 60}:00</span>`);
  const venues = Object.keys(data.stage.venues);
  return `<div class="gantt" style="--hours:${(s1 - s0) / 60}" role="table" aria-label="${d === 1 ? '11/7（土）' : '11/8（日）'}のステージ">
        <div class="gantt-axis" aria-hidden="true"><div class="gantt-label"></div><div class="gantt-track">${ticks.join('')}</div></div>
${venues.map(v => `        <div class="gantt-row" role="row">
          <div class="gantt-label" role="rowheader">${esc(v)}<small>${esc(data.stage.venues[v])}</small></div>
          <div class="gantt-track">
${slots.filter(s => s.venue === v).map(s => `            <span class="gantt-item${toMin(s.end) - toMin(s.start) <= 15 ? ' is-short' : ''}" role="cell" style="left:${p(s.start)}%;width:${(p(s.end) - p(s.start)).toFixed(2)}%" title="${esc(s.start + '–' + s.end + ' ' + s.title)}"><b>${esc(s.title)}</b><i>${s.start}–${s.end}</i></span>`).join('\n')}
          </div>
        </div>`).join('\n')}
      </div>`;
}

function stageTable(d) {
  const slots = data.stage.slots.filter(s => s.day === d).slice().sort((x, y) => toMin(x.start) - toMin(y.start) || x.venue.localeCompare(y.venue));
  return `<ol class="tt-mini">
${slots.map(s => `        <li><span class="tt-mini-time">${s.start}–${s.end}</span><span class="tt-mini-venue v-${s.venue === '講堂' ? 'hall' : 'music'}">${esc(s.venue)}</span><span class="tt-mini-title">${esc(s.title)}</span></li>`).join('\n')}
      </ol>`;
}

function stageList() {
  const acts = data.stage.acts;
  return Object.keys(acts).map(name => {
    const times = data.stage.slots.filter(s => s.title === name)
      .map(s => `${s.day === 1 ? '7日' : '8日'} ${s.start}–${s.end}（${s.venue}）`);
    return `      <li class="act"><div class="act-head"><h4>${esc(name)}</h4><span>${esc(acts[name].org)}</span></div>
        <p>${esc(acts[name].desc)}</p><p class="act-time">${times.map(esc).join('<br>')}</p></li>`;
  }).join('\n');
}

/* ---------- いまのステージ（当日は現在時刻から others-top.js が書き換える） ---------- */
function stageNow() {
  const slots = data.stage.slots.map(s => ({ d: s.day, v: s.venue, s: s.start, e: s.end, t: s.title }));
  const first = data.stage.slots.filter(s => s.day === 1 && s.start === '12:30');
  return `<section class="ob-section ob-now" id="stageNow" aria-live="polite" data-slots="${esc(JSON.stringify(slots))}">
      <h2 class="ob-h2">いまのステージ</h2>
      <div class="ob-now-body" id="stageNowBody">
        <p class="ob-now-msg">最初のステージ：<b>11/7（土）12:30</b> ${first.map(s => `${esc(s.venue)}「${esc(s.title)}」`).join('・')}</p>
      </div>
      <p class="ob-now-link"><a class="more-link" href="#h-stage">時間割をすべて見る</a></p>
    </section>`;
}

/* ---------- 企画カード ---------- */
function card(b) {
  const search = [b.title, b.org, b.place, b.desc, b.kana || '', ...b.tags].join(' ');  // kana＝読み・別名（検索用、表示しない）
  return `        <li class="ob-card k-${tagKey(b.tags[0])}${b.aoristos ? ' is-aor' : ''}" data-floor="${b.floor}" data-yen="${b.yen && b.yen.length ? b.yen[0] : ''}" data-name="${esc(b.kana ? b.kana.split(' ')[0] : b.title)}" data-rooms="${esc(b.rooms.join('|'))}" data-tags="${esc(b.tags.join('|'))}" data-search="${esc(search)}">
          <div class="ob-top"><span class="ob-tag tag-${tagKey(b.tags[0])}">${esc(b.tags[0])}</span>${b.price ? `<span class="ob-price">${esc(b.price)}</span>` : '<span class="ob-price is-free">料金表示なし</span>'}</div>
          <h4 class="ob-title">${esc(b.title)}</h4>
          <p class="ob-org">${esc(b.org)}</p>
          <p class="ob-desc">${esc(b.desc)}</p>
          <p class="ob-place"><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M7 13s4.5-4.2 4.5-7.5a4.5 4.5 0 0 0-9 0C2.5 8.8 7 13 7 13Z"/><circle cx="7" cy="5.5" r="1.6"/></svg>${esc(b.floor + 'F ' + b.place)}</p>${b.tags.length > 1 ? `
          <p class="ob-subtags">${b.tags.slice(1).map(esc).join(' / ')}</p>` : ''}${b.aoristos ? `
          <p class="ob-link"><a class="more-link" href="${esc(b.link)}">Aoristos の企画を詳しく見る</a></p>` : ''}
        </li>`;
}

function boothList() {
  return floors.slice().reverse().map(f => `      <section class="ob-floor" data-floor-group="${f}" aria-labelledby="obf${f}">
        <h3 class="ob-floor-title" id="obf${f}">${FLOOR_LABEL[f]}<span>${byFloor(f).length} 企画</span></h3>
        <ul class="ob-grid">
${byFloor(f).map(card).join('\n')}
        </ul>
      </section>`).join('\n');
}

/* ---------- 校内マップ（公式の図面に、企画のある部屋を重ねる） ---------- */
function campusMap() {
  const roomBooths = id => booths.filter(b => b.rooms.includes(id));
  const STAGE = { mus: '音楽室ステージ', p1: '講堂ステージ' };
  return Object.keys(data.map.floors).map(Number).sort((a, b) => a - b).map(f => {
    const fl = data.map.floors[f];
    let [vx, vy, vw, vh] = fl.viewBox.split(' ').map(Number);
    const rooms = fl.rooms.map(r => {
      const bs = roomBooths(r.id);
      const aor = bs.some(b => b.aoristos);
      const cls = aor ? 'is-aor' : bs.length ? 'is-booth' : STAGE[r.id] ? 'is-stage' : '';
      if (!cls) return '';
      const label = bs.length ? `${r.name}：${bs.map(b => b.title).join('、')}` : STAGE[r.id] ? `${r.name}：${STAGE[r.id]}` : r.name;
      const attrs = bs.length ? ` tabindex="0" role="button" data-room="${r.id}" data-room-name="${esc(r.name)}"` : '';
      return `<path class="map-room ${cls}" d="${esc(r.d)}"${attrs}><title>${esc(label)}</title></path>`;
    }).join('');
    const pins = fl.rooms.filter(r => roomBooths(r.id).some(b => b.aoristos)).map(r =>
      `<g class="map-pin" transform="translate(${r.cx} ${r.cy - 64})"><rect x="-82" y="-26" width="164" height="40" rx="20"/><text y="2" text-anchor="middle">Aoristos はここ</text></g>`).join('');
    // 吹き出しが図の上にはみ出す階は、表示範囲を上に広げる
    fl.rooms.filter(r => roomBooths(r.id).some(b => b.aoristos)).forEach(r => {
      const top = r.cy - 100;
      if (top < vy) { vh += vy - top; vy = top; }
    });
    return `        <figure class="map-floor" data-map-floor="${f}"${f === 3 ? '' : ' hidden'}>
          <svg viewBox="${vx} ${vy} ${vw} ${vh}" role="img" aria-label="${f}F の校内マップ">
            <image href="${esc(fl.image)}" x="0" y="0" width="1500" height="1000"/>
            ${rooms}${pins}
          </svg>
        </figure>`;
  }).join('\n');
}

/* ---------- ページ ---------- */
function head(o) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${o.title}｜Aoristos — 星光 SF2026</title>
  <meta name="description" content="${esc(o.desc)}">
  <meta name="author" content="Aoristos">
  <meta name="theme-color" content="#ffffff">
  <link rel="icon" href="favicon.ico" sizes="any">
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
  <link rel="stylesheet" href="assets/style.css">
  <script>
    window.pageConfig = { currentPage: 'others', basePath: '' };
  </script>
  <script src="assets/config.js"></script>
  <script src="assets/sheet.js" defer></script>
  <script src="assets/header.js" defer></script>
  <script src="assets/script.js" defer></script>${o.scripts || ''}
</head>
<body>
<!-- このページは tools/build-others.js が assets/others-data.json から生成します。直接編集しないでください。 -->
`;
}

const SOURCE_NOTE = `<p class="ob-source">情報は <a href="${esc(data.source)}" target="_blank" rel="noopener noreferrer">SF 公式サイト</a> の内容（${esc(data.retrieved.replace(/-/g, '/'))} 時点）をもとに、Aoristos が見やすくまとめ直したものです。
      時間や内容は変わることがあります。最新の情報は SF 公式サイトでご確認ください。</p>`;

const html = `${head({
  scripts: '\n  <script src="assets/others-top.js" defer></script>',
  title: '他の企画',
  desc: `星光 SF2026（大阪星光学院 スクールフェア 2026）のほかの企画を、図でまとめました。入場・金券・食品の時間、1日の流れ、階ごと・種類ごとの企画数、講堂・音楽室のステージの時間割。全 ${booths.length} 企画の一覧と校内マップへも。`
})}
<main id="main" class="band-alt">
  <header class="page-hero ob-hero">
    <div class="container">
      <h1 class="page-title">他の企画</h1>
      <p class="page-lead">星光 SF2026 のほかの企画を、場所・種類・時間でまとめました。</p>
      <nav class="ob-quick" aria-label="このページの内容">
        <a class="ob-quick-main" href="${LIST_PAGE}"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4.5 4.5"/></svg>企画を探す<small>一覧・校内マップ・${booths.length} 企画</small></a>
        <a href="#h-stage">ステージの時間割</a>
        <a href="#h-basics">入場・お金・食べ物</a>
        <a href="#h-flow">1日の流れ</a>
      </nav>
    </div>
  </header>

  <div class="container ob-wrap">

    ${stageNow()}

    <section class="ob-section" aria-labelledby="h-basics">
      <h2 class="ob-h2" id="h-basics">まず知っておきたいこと</h2>
      <div class="ob-basics">
        <article class="ob-basic"><h3>入場</h3><dl>
          <div><dt>11/7（土）</dt><dd>保護者のみ（受付で保護者証を提示）</dd></div>
          <div><dt>11/8（日）</dt><dd>ビジター券をお持ちの方・卒業生・受験生のみ</dd></div></dl>
          <p>再入場できます（入場時のワッペンを見える位置に）。</p></article>
        <article class="ob-basic"><h3>お金（金券）</h3>
          <p class="ob-big">50円券 × 4枚 = <strong>200円</strong>／シート</p>
          <p>400円・1,000円単位で購入。払い戻し不可。売り場は <b>1F キャンパスプラザ</b> と <b>1F 保健室前</b>。</p>
          <p>現金が使えるのは <b>食堂</b> と <b>高校棟1F 売店</b> だけ。</p></article>
        <article class="ob-basic"><h3>食べ物</h3><dl>
          <div><dt>11/7（土）</dt><dd>受付 15:00 まで・販売 15:30 まで</dd></div>
          <div><dt>11/8（日）</dt><dd>受付 14:00 まで・販売 14:30 まで</dd></div></dl>
          <p>売り切れ次第終了。グラウンドで買った食品はグラウンド中央のテントで（校舎内へは持ち込み不可）。</p></article>
        <article class="ob-basic"><h3>食堂</h3><dl>
          <div><dt>食券販売</dt><dd>9:00〜</dd></div>
          <div><dt>営業</dt><dd>11:00〜14:00（入店は 13:30 まで）</dd></div></dl>
          <p>現金のみ・30分以内の利用・持ち込み不可。</p></article>
        <article class="ob-basic"><h3>持ち物</h3>
          <p><b>上履き・スリッパ</b>（校内は上履き）。</p>
          <p>パンフレットの謎解き企画用に <b>筆記用具</b> があると便利。</p></article>
        <article class="ob-basic"><h3>困ったとき</h3><dl>
          <div><dt>相談</dt><dd>中学棟2F 生徒会室／ビブス・青いパーカーの運営委員</dd></div>
          <div><dt>落とし物</dt><dd>2F 渡り廊下</dd></div>
          <div><dt>休憩所</dt><dd>高校棟2F 高１A・B教室</dd></div></dl></article>
      </div>
    </section>

    <section class="ob-section" aria-labelledby="h-flow">
      <h2 class="ob-h2" id="h-flow">1日の流れ</h2>
      ${dayFlow()}
    </section>

    <section class="ob-section ob-two" aria-labelledby="h-where">
      <div>
        <h2 class="ob-h2" id="h-where">どの階に何がある？</h2>
        <p class="ob-note">階を押すと、その階の校内マップと企画を表示します。色は企画の種類です。</p>
        ${building()}
      </div>
      <div>
        <h2 class="ob-h2" id="h-kind">種類別の企画数</h2>
        <p class="ob-note">押すと、その種類の企画を一覧で表示します（1つの企画が複数の種類を持つことがあります）。</p>
        ${tagChart()}
      </div>
    </section>

    <section class="ob-section" aria-labelledby="h-stage">
      <h2 class="ob-h2" id="h-stage">ステージの時間割</h2>
      <p class="ob-note">講堂（5F）は演目中は入れません。演目の合間に係の案内で入場してください。</p>
      <h3 class="ob-h3">11/7（土）</h3>
      <div class="gantt-wrap">
      ${stageDay(1)}
      </div>
      ${stageTable(1)}
      <h3 class="ob-h3">11/8（日）</h3>
      <div class="gantt-wrap">
      ${stageDay(2)}
      </div>
      ${stageTable(2)}
      <details class="ob-acts">
        <summary>出演者の紹介</summary>
        <ul class="acts">
${stageList()}
        </ul>
      </details>
    </section>

    <section class="ob-section ob-cta" aria-labelledby="h-cta">
      <div>
        <h2 class="ob-h2" id="h-cta">企画一覧と校内マップ</h2>
        <p class="ob-note">全 ${booths.length} 企画を、校内マップ・検索・階・種類で探せます。</p>
      </div>
      <a class="btn" href="${LIST_PAGE}">企画一覧と校内マップを見る</a>
    </section>

    ${SOURCE_NOTE}
  </div>
</main>

</body>
</html>
`;

const listHtml = `${head({
  title: '企画一覧・校内マップ（他の企画）',
  desc: `星光 SF2026（大阪星光学院 スクールフェア 2026）の全 ${booths.length} 企画を、校内マップ・検索・階・種類で探せる一覧。飲食・ゲーム・展示・アトラクションなど。`,
  scripts: '\n  <script src="assets/others.js" defer></script>'
})}
<main id="main" class="band-alt">
  <header class="page-hero ob-hero">
    <div class="container">
      <p class="eyebrow"><a href="others.html">他の企画</a></p>
      <h1 class="page-title">企画一覧</h1>
      <p class="page-lead">星光 SF2026 の全 ${booths.length} 企画を、校内マップと一覧で探せます。</p>
    </div>
  </header>

  <div class="container ob-wrap">
    <section class="ob-section ob-finder" id="list" aria-label="企画を探す">
      <div class="ob-toolbar" id="obToolbar">
        <div class="ob-toolbar-row">
          <label class="ob-searchbox">
            <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4.5 4.5"/></svg>
            <input class="ob-search" id="obSearch" type="search" placeholder="企画名・食べ物で探す" aria-label="企画を検索" autocomplete="off" enterkeyhint="search">
          </label>
          <button type="button" class="ob-filter-btn" id="obFilterBtn" aria-expanded="false" aria-controls="obPanel">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M6 10h8M9 15h2"/></svg><span>絞り込み</span><b id="obBadge" hidden>0</b>
          </button>
        </div>
        <div class="ob-panel" id="obPanel" hidden>
          <p class="ob-panel-label">階</p>
          <div class="ob-chips" id="obFloors" role="group" aria-label="階で絞り込む">
            <button type="button" class="chip is-active" data-floor="">すべて</button>
${[1, 2, 3, 4, 5].map(f => `            <button type="button" class="chip" data-floor="${f}">${f === 1 ? '1F・屋外' : f + 'F'} <small>${byFloor(f).length}</small></button>`).join('\n')}
          </div>
          <p class="ob-panel-label">種類</p>
          <div class="ob-chips" id="obTags" role="group" aria-label="種類で絞り込む">
            <button type="button" class="chip is-active" data-tag="">すべて</button>
${TAGS.map(([t, k]) => `            <button type="button" class="chip chip-${k}" data-tag="${esc(t)}"><span class="dot tag-${k}"></span>${esc(t)}</button>`).join('\n')}
          </div>
          <p class="ob-panel-label">並び順</p>
          <div class="ob-chips" id="obSorts" role="group" aria-label="並び順">
            <button type="button" class="chip is-active" data-sort="place">場所順</button>
            <button type="button" class="chip" data-sort="cheap">安い順</button>
            <button type="button" class="chip" data-sort="expensive">高い順</button>
            <button type="button" class="chip" data-sort="name">名前順</button>
          </div>
          <div class="ob-panel-foot">
            <button type="button" class="text-btn" id="obReset">条件をリセット</button>
            <button type="button" class="btn ob-apply" id="obApply"><span id="obApplyCount">${booths.length}</span> 件を表示</button>
          </div>
        </div>
        <div class="ob-status">
          <p class="ob-count" id="obCount" aria-live="polite">${booths.length} 企画</p>
          <ul class="ob-active" id="obActive" aria-label="選択中の条件"></ul>
          <button type="button" class="ob-collapse" id="obCollapse" aria-pressed="false" aria-controls="list">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4h10M3 8h10M3 12h10"/></svg><span>説明を閉じる</span>
          </button>
        </div>
      </div>

      <details class="ob-mapbox" id="map" open>
        <summary><span>校内マップ</span><small id="mapLabel">3F を表示中・階を選ぶと切り替わります</small></summary>
        <p class="map-hint">地図は横にスクロールできます。色の付いた部屋を押すと、その部屋の企画だけを表示します。</p>
        <div class="map-box" id="mapBox">
${campusMap()}
        </div>
        <ul class="map-legend" aria-label="凡例">
          <li><span class="lg lg-booth"></span>企画のある部屋（押せます）</li>
          <li><span class="lg lg-aor"></span>Aoristos（特別第３教室）</li>
          <li><span class="lg lg-stage"></span>ステージ（講堂・音楽室）</li>
          <li><span class="lg-yen" aria-hidden="true">¥</span>金券売り場</li>
        </ul>
        <p class="ob-map-note">図面：<a href="${esc(data.map.source)}" target="_blank" rel="noopener noreferrer">SF 公式サイトの校内マップ</a>（トイレ・AED の記号つき）</p>
      </details>

${boothList()}
      <ul class="ob-grid ob-flat" id="obFlat" hidden></ul>
      <div class="empty ob-empty" id="obEmpty" hidden><p>条件に合う企画がありません。</p><button type="button" class="btn btn-ghost" id="obReset2">条件をリセット</button></div>
    </section>

    ${SOURCE_NOTE}
  </div>
</main>

</body>
</html>
`;

function writeIfChanged(file, content) {
  const name = path.basename(file);
  const strip = t => t.replace(/<!-- site-meta:start -->[\s\S]*?<!-- site-meta:end -->\n\s*/, '').replace(/(assets\/[\w./-]+\.(?:css|js))\?v=[0-9a-f]+/g, '$1');
  if (fs.existsSync(file) && strip(fs.readFileSync(file, 'utf8')) === content) { console.log(name + ' は変更なし'); return; }
  fs.writeFileSync(file, content, 'utf8');
  console.log('生成・更新: ' + name);
}
writeIfChanged(OUT, html);
writeIfChanged(OUT_LIST, listHtml);

