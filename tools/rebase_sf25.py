"""SF25 の Next.js 静的書き出し（ルート / 前提）を、サブディレクトリ（例 /archive/sf25）で動くように書き換える。
使い方: python3 -I rebase_sf25.py <出力ディレクトリ> /archive/sf25
"""
import re, sys, pathlib, shutil

src, prefix = pathlib.Path(sys.argv[1]), sys.argv[2].rstrip('/')

# ルート直下のページ・アセット
SEGS = r'news|_next|icon|booths-icon|booths\.json|booth|map|stage|search-index\.json|search|info|nazo-images|slideshow|pamphlet\.pdf|img|sp|noise\.jpeg|favicon\.ico'
seg_re = re.compile(r'(?<=["\'`(=])/(' + SEGS + r')(?=[/"\'`?#)\\.]|$)')

# トップページへのリンク: href="/" / "href":"/" / \"href\":\"/\" / path:"/"
root_re = re.compile(r'((?:href|path|\\?"href\\?")\s*[:=]\s*\\?")/(?=\\?")')

# 企画カードの相対パス（企画詳細ページで壊れる元の不具合も直る）
icon_re = re.compile(r'"booths-icon/"')
icon_attr_re = re.compile(r'(?<=(?:src|ref)=")booths-icon/')

# エラー報告の送信先（Google Apps Script）は無効化
gas_re = re.compile(r'https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec')

# 直接開かれたら Aoristos の閲覧ページ（archive/view.html）の中で開き直すスクリプト
frame_tag = '<script src="/assets/archive-frame.js"></script>'

n = 0
for p in src.rglob('*'):
    if p.suffix not in ('.html', '.txt', '.js', '.css') or not p.is_file():
        continue
    t = p.read_text('utf-8')
    o = t
    t = seg_re.sub(lambda m: prefix + '/' + m.group(1), t)
    t = root_re.sub(lambda m: m.group(1) + prefix + '/', t)
    t = icon_re.sub('"' + prefix + '/booths-icon/"', t)
    t = icon_attr_re.sub(prefix + '/booths-icon/', t)
    t = gas_re.sub('about:blank', t)
    if p.suffix == '.html' and frame_tag not in t:
        t = t.replace('<head>', '<head>' + frame_tag, 1)
    if t != o:
        p.write_text(t, 'utf-8')
        n += 1

# 旧ドメイン（seikosf25.jp）を指す sitemap は不要
(src / 'sitemap.xml').unlink(missing_ok=True)

# クライアント遷移でトップに戻るとき、Next.js は <prefix>.txt を取りに行く
shutil.copyfile(src / 'index.txt', src.parent / (src.name + '.txt'))

print('rewritten files:', n)
