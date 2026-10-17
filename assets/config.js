/*
  config.js — 大阪星光学院 SF 2026 公式サイト
  サイト全体の設定はこのファイルだけを直せば全ページに反映されます。
*/
window.SF_CONFIG = {
  // 基本情報
  theme: '融合',
  themeRoman: 'YUGO',
  eventName: '大阪星光学院 スクールフェア 2026',
  shortName: 'SF 2026',
  producer: 'Aoristos',
  venue: '大阪星光学院 中学校・高等学校',
  venueArea: '大阪市天王寺区',

  // 開催日（カウントダウンと「開催中」表示に使う。時刻は日本時間）
  days: [
    { date: '2026-11-07', label: '11月7日', weekday: '土', open: '09:00', close: '16:00' },
    { date: '2026-11-08', label: '11月8日', weekday: '日', open: '09:00', close: '16:00' }
  ],

  /*
    Google スプレッドシート（「ウェブに公開」→ CSV）の URL。
    ブログ記事・トップのお知らせ（部誌発売中など）・SNS リンクをここから読み込みます。
    列の意味は templates/site-data-template.csv と README を参照。
  */
  sheetCsvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTQTNNohrQfwDEAVKdKx7QTAiEto5i5QBed6jarVfxeDt_8QDwH7XH4Lgkq8yPLiHSiYsIe1ayLU7P-/pub?gid=0&single=true&output=csv',

  // シートの読み込み結果をブラウザに保持する時間（分）。通信量の節約用。
  sheetCacheMinutes: 3,

  // シートが読めなかったときだけ使う SNS リンク（シートに type=link の行があればそちらが優先）
  fallbackLinks: []
};

// JS が動く環境の目印（スクロール演出などに使用）
document.documentElement.classList.add('js');
