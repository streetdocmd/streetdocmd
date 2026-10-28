import re, pathlib
here = pathlib.Path(__file__).resolve().parent          # _source/provider
design = here.parents[1]                                 # streetdocmd-design
base = re.sub(r'@import url\([^)]*\);', '', (design / 'streetdocmd.css').read_text(encoding='utf-8'))
patient = (design / '_source' / 'patient' / 'patient.css').read_text(encoding='utf-8')
provider = (here / 'provider.css').read_text(encoding='utf-8')
src = (here / 'app.src.html').read_text(encoding='utf-8')
out = src.replace('/*BASE*/', '/* ---- StreetdocMD design system ---- */\n' + base)
out = out.replace('/*PATIENT*/', '/* ---- Shared app components ---- */\n' + patient)
out = out.replace('/*PROVIDER*/', '/* ---- Provider app ---- */\n' + provider)
(design / 'provider' / 'index.html').write_text(out, encoding='utf-8')
print('built provider', len(out))
