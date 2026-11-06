/*
  config.js — Aoristos｜大阪星光学院 SF2026 出展企画ページ
  サイト全体の設定はこのファイルだけを直せば全ページに反映されます。
*/
window.SF_CONFIG = {
  // 基本情報
  siteName: 'Aoristos',
  theme: '融合',
  eventName: '大阪星光学院 スクールフェア 2026',
  shortName: 'SF2026',
  producer: 'Aoristos',
  venue: '大阪星光学院 中学校・高等学校',
  venueArea: '大阪市天王寺区',
  venueStreet: '伶人町1-6',
  venuePostalCode: '543-0061',
  room: '高校棟3階 特別第3教室',

  // SF 公式サイト（フッターなどからリンク）
  officialUrl: 'https://seikosf.jp',

  /*
    本番の公開 URL（末尾の / なし）。例: 'https://example.com'
    canonical・OGP 画像・sitemap.xml・robots.txt に使います。
    変更したら `npm run build` を実行してから push してください。
    空欄のあいだは、絶対 URL が必要なタグ・ファイルは出力されません。
  */
  siteUrl: 'https://aoristos.net',

  /*
    開催日（日本時間）。カウントダウンと「開催中」表示に使う。
    open / close は「開催中」の判定用。timeLabel が画面に出る表記。
  */
  days: [
    { date: '2026-11-07', label: '11月7日', weekday: '土', open: '12:30', close: '16:00', timeLabel: '12:30 〜 16:00' },
    { date: '2026-11-08', label: '11月8日', weekday: '日', open: '09:00', close: '15:30', timeLabel: '9:00 〜 15:30' }
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

  /*
    SNS リンクの初期値。シートに type=link の行が1つもないとき（またはシートが読めないとき）に表示。
    シートに link 行を書けば、そちらが優先されます。構造化データ（検索エンジン向け）にも使います。
  */
  fallbackLinks: [
    { title: 'X', text: '@Team_Aoristos', url: 'https://x.com/Team_Aoristos' },
    { title: 'Instagram', text: '@team_aoristos', url: 'https://www.instagram.com/team_aoristos/' }
  ],

  // これまでの活動（外部サイト）
  pastActivitiesUrl: 'https://reabiz.jp/?page_id=208',

  /*
    SF2026 トップ（sf.html）の上部に載せる YouTube 動画。
    sfVideo.show を true にすると公開されます（false のあいだは表示されません）。
    公開前の確認は sf.html?video=preview で表示できます。
    id は動画 URL の「watch?v=」の後ろの部分。
  */
  sfVideo: {
    show: true,
    id: '-_S8f226zYQ',
    title: 'Aoristos SF2026 紹介動画'
  }
};

// JS が動く環境の目印（スクロール演出などに使用）
document.documentElement.classList.add('js');
