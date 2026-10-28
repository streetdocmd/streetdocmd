import re, pathlib
here = pathlib.Path(__file__).resolve().parent           # _source/admin
design = here.parents[1]                                  # streetdocmd-design
base = re.sub(r'@import url\([^)]*\);', '', (design / 'streetdocmd.css').read_text(encoding='utf-8'))
admin = (here / 'admin.css').read_text(encoding='utf-8')
src = (here / 'admin.src.html').read_text(encoding='utf-8')
out = src.replace('/*BASE*/', '/* ---- StreetdocMD design system ---- */\n' + base).replace('/*ADMIN*/', '/* ---- Admin console ---- */\n' + admin)
(design / 'admin' / 'index.html').write_text(out, encoding='utf-8')
print('built admin', len(out))
