/*
  config.js — Aoristos｜大阪星光学院 SF 2026 出展企画ページ
  サイト全体の設定はこのファイルだけを直せば全ページに反映されます。
*/
window.SF_CONFIG = {
  // 基本情報
  siteName: 'Aoristos',
  theme: '融合',
  eventName: '大阪星光学院 スクールフェア 2026',
  shortName: 'SF 2026',
  producer: 'Aoristos',
  venue: '大阪星光学院 中学校・高等学校',
  venueArea: '大阪市天王寺区',

  /*
    開催日（日本時間）。カウントダウンと「開催中」表示に使う。
    open / close は「開催中」の判定用。timeLabel が画面に出る表記。
  */
  days: [
    { date: '2026-11-07', label: '11月7日', weekday: '土', open: '12:00', close: '15:30', timeLabel: '午後のみ（15:30 頃まで）' },
    { date: '2026-11-08', label: '11月8日', weekday: '日', open: '09:00', close: '15:30', timeLabel: '9:00 〜 15:30 頃' }
  ],

  /*
    Google スプレッドシート（「ウェブに公開」→ CSV）の URL。
    ブログ記事・トップのお知らせ（部誌・Tシャツなど）・SNS リンクをここから読み込みます。
    列の意味は templates/site-data-template.csv と README を参照。
  */
  sheetCsvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTQTNNohrQfwDEAVKdKx7QTAiEto5i5QBed6jarVfxeDt_8QDwH7XH4Lgkq8yPLiHSiYsIe1ayLU7P-/pub?gid=0&single=true&output=csv',

  // シートの読み込み結果をブラウザに保持する時間（分）。通信量の節約用。
  sheetCacheMinutes: 3,

  /*
    トップのお知らせタイルの初期値。
    シートに type=news の行が1つもないとき（またはシートが読めないとき）にだけ表示されます。
    シートに news 行を書けば、そちらが優先されます。
    art: 'pdf' / 'tshirt' で内蔵のイラストを表示。
  */
  defaultNews: [
    {
      title: 'Aoristos 部誌、PDF 版 発売中。',
      text: 'SF 当日は、会場で冊子版も販売します。',
      url: 'projects/aoristos-bushi.html',
      linkLabel: '詳しく見る',
      art: 'pdf',
      style: 'light',
      pin: true
    },
    {
      title: 'Aoristos Tシャツ、発売中。',
      text: '購入方法はこのページでお知らせします。',
      url: '',
      linkLabel: '',
      art: 'tshirt',
      style: 'dark',
      pin: false
    }
  ],

  // シートが読めなかったときだけ使う SNS リンク（シートに type=link の行があればそちらが優先）
  fallbackLinks: []
};

// JS が動く環境の目印（スクロール演出などに使用）
document.documentElement.classList.add('js');
