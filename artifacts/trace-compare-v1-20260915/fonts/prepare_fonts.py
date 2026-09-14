"""Offline reproducible fixed-copy subsets. Writes only this fonts directory.

Use previously downloaded, pinned OFL originals; no network or installation.
"""
from pathlib import Path
import argparse
import hashlib
import json
import shutil
import sys

import fontTools
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent
WORKSPACE = ROOT.parents[2]
PRIOR = WORKSPACE / 'artifacts/trace-home-v1-20260914/fonts'
COPY = ROOT.parent / 'ui/copy.txt'
PACKAGE = ROOT.parent / 'coordination/context-package.json'
PACKAGE_HASH = 'B7417F6FD5E3F6FE1F699F5B9316BE15B8129DF8077EEC77D909679A9C5A61EC'
TASK = 'trace-compare-v1-20260915'
BASELINE = '2f4377864aa353dcecb3f60005d884b11486c84e'

def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest().upper()

def dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def names(font, key):
    return sorted({r.toUnicode() for r in font['name'].names if r.nameID == key})

def rename(font, family, source_hash):
    ps = family.replace(' ', '')
    table = font['name']
    style = table.getDebugName(17) or table.getDebugName(2) or 'Regular'
    ps_style = ''.join(c for c in style if c.isascii() and c.isalnum()) or 'Regular'
    replacements = {1: family, 3: f'{ps}-Fixed-{source_hash[:12]}', 4: f'{family} {style}',
                    6: f'{ps}-{ps_style}', 16: family, 25: ps}
    for record in list(table.names):
        if record.nameID in replacements:
            text = replacements[record.nameID]
        elif record.nameID not in {0, 7, 8, 9, 10, 11, 12, 13, 14}:
            text = record.toUnicode()
            for old in ('SourceHanSerifCN', 'Source Han Serif CN', 'SourceHanSerif', 'Source Han Serif', 'NotoSansSC', 'Noto Sans SC'):
                text = text.replace(old, family if ' ' in old else ps)
        else:
            continue
        record.string = text.encode(record.getEncoding())
    for key, value in replacements.items():
        table.setName(value, key, 3, 1, 0x409)
    font['head'].modified = font['head'].created
    font.recalcTimestamp = False

def inspect(path, required):
    font = TTFont(path, lazy=False, checkChecksums=2)
    cmap = font.getBestCmap()
    assert cmap
    missing = sorted(required - set(cmap))
    assert not missing, f'Missing glyphs: {missing}'
    _ = len(font['glyf'].glyphs)
    report = {'path': str(path.relative_to(ROOT)), 'sha256': sha(path), 'bytes': path.stat().st_size,
        'family': names(font, 1), 'fullName': names(font, 4), 'postscriptName': names(font, 6),
        'axes': [{'tag': a.axisTag, 'min': a.minValue, 'max': a.maxValue, 'default': a.defaultValue} for a in font['fvar'].axes],
        'cmapSize': len(cmap), 'requiredCodepoints': len(required), 'missingCodepoints': missing,
        'attribution': {str(n): names(font, n) for n in (0, 7, 8, 9, 13, 14)}}
    assert all('Source' not in s for key in ('family', 'fullName', 'postscriptName') for s in report[key])
    font.close()
    return report

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--verify-only', action='store_true')
    args = parser.parse_args()
    assert sha(PACKAGE) == PACKAGE_HASH
    package = json.loads(PACKAGE.read_text(encoding='utf-8'))
    assert package['taskId'] == TASK
    for ref in package['references']:
        assert sha(WORKSPACE / ref['path']) == ref['sha256']
    text = COPY.read_text(encoding='utf-8')
    # Newlines delimit copy. ASCII and shared quote/arrows/numeric glyphs support counters.
    required = {ord(c) for c in text if not c.isspace()} | set(range(0x20, 0x7f)) | {0xA0, 0x3000}
    required |= {ord(c) for c in '“”‘’「」【】（）《》—–·…←→↑↓✓×：；，。！？／'}
    if args.verify_only:
        manifest = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))
        assert sha(COPY) == manifest['copy']['sha256'], 'UI copy changed; rebuild subset'
        for original in manifest['originals']:
            assert sha(Path(original['absolutePath'])) == original['sha256']
        for derived in manifest['derived']:
            path = ROOT / derived['path']
            assert sha(path) == derived['sha256']
            actual = inspect(path, required)
            assert actual['attribution'] == derived['attribution']
        for license in manifest['licenses']:
            assert sha(ROOT / license['path']) == license['sha256']
        print(f'PASS: 2 font subsets cover {len(required)} fixed codepoints; references and original font hashes match')
        return
    prior = json.loads((PRIOR / 'manifest.json').read_text(encoding='utf-8'))
    specs = [('source-han-serif-cn', 'Trace Compare Serif', 'TraceCompareSerif-fixed.woff2', 'LICENSE.txt'),
             ('noto-sans-sc', 'Trace Compare Sans', 'TraceCompareSans-fixed.woff2', 'OFL.txt')]
    out = ROOT / 'derived'
    out.mkdir(parents=True, exist_ok=True)
    originals, derived, licenses, css = [], [], [], []
    (ROOT / 'copy-snapshot.txt').write_text(text, encoding='utf-8')
    for ident, family, filename, license_name in specs:
        source = next(e for e in prior['originals'] if e['id'] == ident)
        original = PRIOR / source['path']
        assert sha(original) == source['sha256']
        font = TTFont(original, lazy=False, recalcTimestamp=False)
        attribution = {str(n): names(font, n) for n in (0, 7, 8, 9, 13, 14)}
        assert not required - set(font.getBestCmap()), 'Requested glyph absent in full upstream font'
        options = subset.Options()
        options.name_IDs, options.name_languages = ['*'], ['*']
        options.name_legacy, options.notdef_glyph = True, True
        options.notdef_outline, options.recommended_glyphs = True, True
        options.layout_features, options.recalc_timestamp = ['*'], False
        sub = subset.Subsetter(options=options)
        sub.populate(unicodes=required)
        sub.subset(font)
        rename(font, family, source['sha256'])
        assert attribution == {str(n): names(font, n) for n in (0, 7, 8, 9, 13, 14)}
        font.flavor = 'woff2'
        destination = out / filename
        font.save(destination)
        font.close()
        entry = inspect(destination, required)
        assert entry['attribution'] == attribution
        derived.append(entry)
        originals.append({k: source[k] for k in ('id', 'sha256', 'source_url', 'repository', 'upstream_commit', 'git_blob_sha1', 'license', 'reserved_font_names')} | {'absolutePath': str(original)})
        licence_source = original.parent / license_name
        assert 'SIL OPEN FONT LICENSE Version 1.1' in licence_source.read_text(encoding='utf-8')
        licence_copy = out / ('OFL-' + ident + '.txt')
        shutil.copyfile(licence_source, licence_copy)
        licenses.append({'path': str(licence_copy.relative_to(ROOT)), 'sha256': sha(licence_copy), 'license': 'OFL-1.1'})
        weight = next(axis for axis in entry['axes'] if axis['tag'] == 'wght')
        css.append(f'@font-face {{\n  font-family: "{family}";\n  src: url("./{filename}") format("woff2");\n  font-weight: {weight["min"]:g} {weight["max"]:g};\n  font-style: normal;\n  font-display: swap;\n}}')
        print(f'BUILT {filename}: {entry["bytes"]} bytes / {len(required)} codepoints', flush=True)
    (out / 'font-face.css').write_text('\n\n'.join(css) + '\n', encoding='utf-8')
    dump(ROOT / 'manifest.json', {'taskId': TASK, 'gitBaseline': BASELINE, 'contextPackageSha256': PACKAGE_HASH,
        'tool': f'fontTools {fontTools.__version__}', 'networkRequests': 0, 'globalInstalls': 0,
        'copy': {'path': str(COPY), 'sha256': sha(COPY), 'requiredCodepoints': len(required)},
        'originals': originals, 'derived': derived, 'licenses': licenses,
        'validation': {'cmap': 'passed', 'renamedPrimaryNames': 'passed', 'attributionPreserved': 'passed',
            'browser': 'not run by assets worker', 'visualFontMatch': 'requires composed UI review'},
        'limitations': ['Fixed copy only; arbitrary user text uses system Chinese fallback.',
            'This task did not redownload or globally install fonts.', 'Exact image font identity unknown; selected pinned official fonts are visual approximations.']})

if __name__ == '__main__':
    main()
