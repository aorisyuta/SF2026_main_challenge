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
    トップのお知らせタイルの初期値。
    グッズのページと、各ページの右側・下部のグッズ枠に表示されます。
    art: 'pdf' / 'tshirt' で内蔵のイラストを表示。
    name / note は、ページの右側（広い画面）・下部に出る「グッズ」枠での短い名前と一言。
  */
  defaultNews: [
    {
      name: '部誌',
      note: 'PDF 版 発売中',
      title: 'Aoristos 部誌、PDF 版 発売中。',
      text: 'オンラインで PDF 版をお求めいただけます。',
      url: 'projects/aoristos-bushi.html',
      linkLabel: '詳しく見る',
      art: 'pdf',
      style: 'light',
      pin: true
    },
    {
      name: 'Tシャツ',
      note: '発売中',
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
    SNS リンク。フッターやトップに表示し、構造化データ（検索エンジン向け）にも使います。
  */
  fallbackLinks: [
    { title: 'X', text: '@Team_Aoristos', url: 'https://x.com/Team_Aoristos' },
    { title: 'Instagram', text: '@team_aoristos', url: 'https://www.instagram.com/team_aoristos/' }
  ],

  /*
    お知らせ記事（「お知らせ」ページとトップの「最新情報」に、日付の新しい順で並ぶ）。
    id（URL に使う英数字）・title・date（2026/11/11 の形）・tags・author・body（本文。## 見出し、空行で段落など）。
  */
  sitePosts: [
    {
      id: 'sf2026-view',
      title: 'SF2026 の運営に対する Aoristos 運営の見解について',
      date: '2026/11/11',
      tags: ['お知らせ', 'SF2026'],
      author: 'Aoristos 運営',
      text: '今年度の SF の運営について、来年度以降のよりよい SF のために、Aoristos としての見解をまとめました。',
      body: "SF2026「融合」が無事に開催できたのは、全体をまとめてくださった運営委員長と、現場を支えてくださった先生方のおかげです。心より感謝申し上げます。\n\n一方で、今年度の運営には課題もあったと考えています。来年度以降のよりよい SF のために、Aoristos としての見解を記します。\n\n## 1. 教室の引き継ぎについて\n\n準備日（金曜日の昼）から全団体に開放される予定だった特別第3教室で引き継ぎが行われず、話し合いでも解決しませんでした。最終的には運営委員長が別の空き教室を手配してくださり、事なきを得ました。教室の予約や引き継ぎのルールを、事前に明確にしていただきたいと考えます。\n\n## 2. ルールの周知と手続きについて\n\n昨年までは全体集会で事前にルールや周知事項が共有されていましたが、今年度は直前になってロイロノートでの提出が求められるなど、急な決定が続きました。部誌の回収や食品原材料の申請などで、各団体の負担が大きくなりました。来年度は、早めの周知と説明の場を設けていただけるようお願いします。\n\n## 3. 来場者を迎える行事として\n\nSF は、外部の方や受験生を迎える行事です。運営も含めた全員が、来場者の目線を意識した対応をとることが大切だと考えます。\n\n---\n\n本稿は公式サイトに掲載するものであるため、個人名を挙げることや強い表現は控えました。運営の中心メンバーの方々には、より強い言葉で、私たちの考えを直接お伝えしています。\n\n来年度の SF がよりよいものになるよう、これらの点を提案として運営に伝えていきます。"
    }
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
