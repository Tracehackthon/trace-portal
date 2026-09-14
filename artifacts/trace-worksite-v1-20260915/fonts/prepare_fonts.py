"""Offline-only fixed-copy fonts. Writes only this task's fonts directory.

Reuse pinned, already downloaded OFL originals. No network or installation.
Re-run after ui/copy.txt changes; --verify-only performs no output writes.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
import fontTools
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent
WORKSPACE = ROOT.parents[2]
OLD = WORKSPACE / 'artifacts/trace-home-v1-20260914/fonts'
PACKAGE = ROOT.parent / 'coordination/context-package.json'
PACKAGE_HASH = 'DD9BDA87EDB138B15C3A3E9535BD78BF5E51934DA333A4175C251BF8F7078C06'
SOURCES = [
    dict(id='source-han-serif-cn', file='SourceHanSerifCN-VF.ttf.woff2', license='LICENSE.txt',
         sha256='556749BA783B148FA1F48644E8883E5B9351F01ABD0D1FAAD0BA24A21185E76A',
         blob='65a4d31a34ddda25b821b45288168e135b8ebc70',
         licenseHash='9FF5BB567E1B92C801FC1069E5FBF992FF8EFCCACB9DB94E5959A5B3BA9BB903',
         repository='https://github.com/adobe-fonts/source-han-serif',
         commit='7889f11bf31170b5d092a083b357c8c8130f89e0',
         upstream='Variable/WOFF2/TTF/Subset/SourceHanSerifCN-VF.ttf.woff2',
         family='Trace Worksite Serif', output='TraceWorksiteSerif-fixed.woff2'),
    dict(id='noto-sans-sc', file='NotoSansSC[wght].ttf', license='OFL.txt',
         sha256='A3041811A78C361B1DE50F953C805E0244951C21C5BD412F7232EF0D899AF0DA',
         blob='fb0637bafbcd804fe32152370a1225990745b4bc',
         licenseHash='1C05C68C34F9708415AADA51F17E1B0092D2CEA709BF4A94CD38114F9E73D7D9',
         repository='https://github.com/google/fonts', commit='a85815a42757630ce188fdad368c2dfc444d4773',
         upstream='ofl/notosanssc/NotoSansSC[wght].ttf',
         family='Trace Worksite Sans', output='TraceWorksiteSans-fixed.woff2'),
]

def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest().upper()

def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def names(font, key):
    return sorted({n.toUnicode() for n in font['name'].names if n.nameID == key})

def rename(font, family, source_hash):
    table = font['name']
    ps = family.replace(' ', '')
    style = table.getDebugName(17) or table.getDebugName(2) or 'Regular'
    ps_style = ''.join(c for c in style if c.isascii() and c.isalnum()) or 'Regular'
    replace = {1: family, 3: f'{ps}-Fixed-{source_hash[:12]}', 4: f'{family} {style}',
               6: f'{ps}-{ps_style}', 16: family, 25: ps}
    for item in list(table.names):
        text = item.toUnicode()
        if item.nameID in replace:
            text = replace[item.nameID]
        elif item.nameID not in {0, 7, 8, 9, 10, 11, 12, 13, 14}:
            for phrase in ('SourceHanSerifCN', 'Source Han Serif CN', 'SourceHanSerif', 'Source Han Serif', 'NotoSansSC', 'Noto Sans SC'):
                text = text.replace(phrase, family if ' ' in phrase else ps)
        else:
            continue
        item.string = text.encode(item.getEncoding())
    for key, text in replace.items():
        table.setName(text, key, 3, 1, 0x409)
    font['head'].modified = font['head'].created
    font.recalcTimestamp = False

def inspect(path, required):
    f = TTFont(path, lazy=False, checkChecksums=2)
    cmap = f.getBestCmap()
    assert cmap
    missing = sorted(cp for cp in required if cp not in cmap or cmap[cp] == '.notdef')
    assert not missing, [f'U+{cp:04X}' for cp in missing]
    assert 'glyf' in f and 'loca' in f
    len(f['glyf'].glyphs)
    report = {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path), 'bytes': path.stat().st_size,
              'family': names(f, 1), 'full_names': names(f, 4), 'postscript_names': names(f, 6),
              'version': names(f, 5), 'required_codepoints': len(required), 'missing_codepoints': [],
              'cmap_size': len(cmap), 'glyph_count': f['maxp'].numGlyphs,
              'axes': [{'tag': a.axisTag, 'min': a.minValue, 'default': a.defaultValue, 'max': a.maxValue} for a in f['fvar'].axes],
              'attribution': {str(k): names(f,k) for k in (0,7,8,9,13,14)}}
    f.close()
    return report

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--verify-only', action='store_true')
    args = parser.parse_args()
    assert sha(PACKAGE) == PACKAGE_HASH, 'Context package changed'
    pkg = json.loads(PACKAGE.read_text(encoding='utf-8'))
    for ref in pkg['references']:
        assert sha(WORKSPACE / ref['path']) == ref['sha256'], ref['path']
    copy = ROOT.parent / 'ui/copy.txt'
    copy_hash = sha(copy)
    corpus = copy.read_text(encoding='utf-8-sig')
    assert sha(copy) == copy_hash, 'UI copy changed while being read'
    required = {ord(c) for c in corpus if not c.isspace()} | set(range(32,127)) | {0xA0,0x3000}
    if args.verify_only:
        manifest = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))
        assert sha(copy) == manifest['copy']['sha256'], 'UI copy changed; rebuild required'
        for entry in manifest['originals'] + manifest['derived'] + manifest['licenses']:
            assert sha(ROOT / entry['path']) == entry['sha256'], entry['path']
        for entry in manifest['derived']:
            checked = inspect(ROOT / entry['path'], required)
            assert checked['family'] == entry['family']
        print(f'VERIFIED: {len(required)} fixed-copy visible codepoints, both subsets, originals/licenses hashes, seven references, context package')
        return
    originals, derived, licenses, css = [], [], [], []
    for source in SOURCES:
        folder = ROOT / 'originals' / source['id']
        folder.mkdir(parents=True, exist_ok=True)
        for filename in (source['file'], source['license']):
            src = OLD / 'originals' / source['id'] / filename
            dst = folder / filename
            expected = source['sha256'] if filename == source['file'] else source['licenseHash']
            assert sha(src) == expected, f'Old original changed: {src}'
            if not dst.exists():
                shutil.copyfile(src, dst)
            assert sha(dst) == expected
        original = folder / source['file']
        raw = original.read_bytes()
        assert hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest() == source['blob']
        license_path = folder / source['license']
        assert 'SIL OPEN FONT LICENSE Version 1.1' in license_path.read_text(encoding='utf-8')
        report = inspect(original, required)
        report.update({'repository': source['repository'], 'commit': source['commit'], 'upstream_path': source['upstream'],
                       'git_blob_sha1': source['blob'], 'reused_from': str(OLD / 'originals' / source['id'] / source['file']), 'license': 'OFL-1.1'})
        originals.append(report)
        f = TTFont(original, lazy=False, recalcTimestamp=False)
        attribution = {k:names(f,k) for k in (0,7,8,9,13,14)}
        options = subset.Options()
        options.name_IDs = ['*']; options.name_languages = ['*']; options.name_legacy = True
        options.layout_features = ['*']; options.notdef_glyph = True; options.notdef_outline = True
        options.recommended_glyphs = True; options.recalc_timestamp = False
        processor = subset.Subsetter(options=options)
        processor.populate(unicodes=required)
        processor.subset(f)
        rename(f, source['family'], source['sha256'])
        assert {k:names(f,k) for k in attribution} == attribution, 'Attribution changed'
        f.flavor = 'woff2'
        output = ROOT / 'derived' / source['output']
        f.save(output); f.close()
        report = inspect(output, required)
        assert report['family'] == [source['family']]
        assert not any('Source' in s for s in report['family']+report['full_names']+report['postscript_names'])
        report.update({'derived_from': original.relative_to(ROOT).as_posix(), 'original_sha256': source['sha256'],
                       'license': 'OFL-1.1', 'modifications': 'Fixed-copy character subset; WOFF2 encoding; renamed family/PS/instance names; deterministic head timestamp; attribution retained'})
        derived.append(report)
        license_copy = ROOT / 'derived' / f"OFL-{source['id']}.txt"
        shutil.copyfile(license_path, license_copy)
        for p in (license_path, license_copy):
            licenses.append({'path': p.relative_to(ROOT).as_posix(), 'sha256': sha(p), 'bytes': p.stat().st_size, 'license': 'OFL-1.1'})
        axis = next(a for a in report['axes'] if a['tag']=='wght')
        css.append('@font-face {\n  font-family: "'+source['family']+'";\n  src: url("./'+source['output']+'") format("woff2");\n  font-weight: '+f"{axis['min']:g} {axis['max']:g}"+';\n  font-style: normal;\n  font-display: swap;\n}')
        print('BUILT', source['output'], report['bytes'], 'bytes', len(required), 'codepoints')
    assert sha(copy) == copy_hash, 'UI copy changed during build; rerun before accepting outputs'
    (ROOT/'derived/font-face.css').write_text('\n\n'.join(css)+'\n', encoding='utf-8')
    (ROOT/'fixed-copy-snapshot.txt').write_text(corpus, encoding='utf-8')
    write_json(ROOT/'manifest.json', {
        'taskId': pkg['taskId'], 'head': pkg['head'], 'context_package_sha256': PACKAGE_HASH,
        'built_at': datetime.now(timezone.utc).isoformat(), 'fontTools': fontTools.__version__,
        'copy': {'path':'../ui/copy.txt','sha256':copy_hash,'visible_codepoints_with_ascii_spaces':len(required)},
        'originals': originals, 'derived': derived, 'licenses':licenses,
        'validation': {'reference_hashes':'passed seven','original_official_git_blob_identity':'passed both',
                       'fixed_copy_cmap_glyf_parsing':'passed both','attribution_preserved':'passed both',
                       'browser_shaping':'not run','file_protocol_loading':'not run','visual_typography_acceptance':'not run'},
        'limits': ['Fixed copy only, not arbitrary user Chinese or Unicode', 'Dynamic content must use system fallback',
                   'No global font/dependency installation; no new download; no app integration',
                   'Original font assets include upstream regional Chinese repertoire, not all Unicode']})

if __name__ == '__main__':
    main()
