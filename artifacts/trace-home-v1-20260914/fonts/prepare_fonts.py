"""Download pinned official fonts and build reproducible fixed-copy WOFF2 subsets.

Writes only beside this script. No installation, system font registration, or UI changes.
"""
from __future__ import annotations
import argparse
import base64
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import platform
import re
import sys
import urllib.request

import fontTools
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent
PACKAGE = ROOT.parent / 'coordination' / 'context-package.json'
PACKAGE_HASH = 'FEC12772D27033E54E9EDB811486DE7C749DB5AFF054BF1BA3DE06628DC00CD7'
TASK_ID = 'trace-home-v1-assets-20260914'
SOURCES = [
    {
        'id': 'source-han-serif-cn',
        'role': 'display and thought headings',
        'repository': 'https://github.com/adobe-fonts/source-han-serif',
        'commit': '7889f11bf31170b5d092a083b357c8c8130f89e0',
        'upstream_path': 'Variable/WOFF2/TTF/Subset/SourceHanSerifCN-VF.ttf.woff2',
        'filename': 'SourceHanSerifCN-VF.ttf.woff2',
        'expected_git_blob_sha1': '65a4d31a34ddda25b821b45288168e135b8ebc70',
        'expected_bytes': 11035128,
        'license_upstream_path': 'LICENSE.txt',
        'license_filename': 'LICENSE.txt',
        'reserved_font_names': ['Source'],
        'derived_family': 'Trace Home Serif',
        'derived_filename': 'TraceHomeSerif-fixed.woff2',
    },
    {
        'id': 'noto-sans-sc',
        'role': 'Chinese and Latin UI labels, controls, secondary text',
        'repository': 'https://github.com/google/fonts',
        'commit': 'a85815a42757630ce188fdad368c2dfc444d4773',
        'upstream_path': 'ofl/notosanssc/NotoSansSC[wght].ttf',
        'filename': 'NotoSansSC[wght].ttf',
        'expected_git_blob_sha1': 'fb0637bafbcd804fe32152370a1225990745b4bc',
        'expected_bytes': 17772300,
        'license_upstream_path': 'ofl/notosanssc/OFL.txt',
        'license_filename': 'OFL.txt',
        'reserved_font_names': ['Source'],
        'derived_family': 'Trace Home Sans',
        'derived_filename': 'TraceHomeSans-fixed.woff2',
    },
]

def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()

def blob_sha1(path: Path) -> str:
    data = path.read_bytes()
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()

def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()

def dump(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def raw_url(source: dict, upstream_path: str) -> str:
    repository = source['repository'].removeprefix('https://github.com/')
    return f"https://raw.githubusercontent.com/{repository}/{source['commit']}/{urllib.parse.quote(upstream_path, safe='/')}"

def fetch(source: dict, upstream_path: str, destination: Path, expected_blob: str | None = None) -> str:
    destination.parent.mkdir(parents=True, exist_ok=True)
    repository = source['repository'].removeprefix('https://github.com/')
    # The initial raw.githubusercontent.com transfer failed during TLS negotiation.
    # Official GitHub API is reachable; keep certificate verification enabled.
    api_url = f"https://api.github.com/repos/{repository}/contents/{urllib.parse.quote(upstream_path, safe='/')}?ref={source['commit']}"
    receipts_path = ROOT / 'download-receipts.json'
    receipts = json.loads(receipts_path.read_text(encoding='utf-8')) if receipts_path.exists() else {}
    if destination.exists():
        print(f'REUSE {relative(destination)} ({destination.stat().st_size} bytes)', flush=True)
        return receipts.get(relative(destination), {}).get('retrieved_via', api_url)
    temporary = destination.with_name(destination.name + '.part')
    accept = 'application/vnd.github.raw+json' if expected_blob else 'application/vnd.github+json'
    if expected_blob:
        expected_size = source['expected_bytes']
        position = temporary.stat().st_size if temporary.exists() else 0
        assert position <= expected_size, 'Existing partial file exceeds expected original size'
        # GitHub Contents raw media supports byte ranges. Small verified ranges avoid
        # repeating a 17 MB transfer when this environment truncates a long response.
        while position < expected_size:
            end = min(position + 4 * 1024 * 1024, expected_size) - 1
            request = urllib.request.Request(api_url, headers={
                'User-Agent': 'TraceAssetFontPreparation/1.0', 'Accept': accept,
                'Range': f'bytes={position}-{end}'})
            with urllib.request.urlopen(request, timeout=120) as response:
                assert response.status == 206 and response.headers.get('Content-Range') == f'bytes {position}-{end}/{expected_size}', 'Unexpected range response'
                start = position
                with temporary.open('ab') as output:
                    while chunk := response.read(1024 * 1024):
                        output.write(chunk)
                        position += len(chunk)
                assert position == end + 1, f'Truncated range {start}-{end}; rerun resumes validated-size partial file'
                print(f'TRANSFER {source["id"]}: {position}/{expected_size} bytes', flush=True)
    else:
        request = urllib.request.Request(api_url, headers={'User-Agent': 'TraceAssetFontPreparation/1.0', 'Accept': accept})
        with urllib.request.urlopen(request, timeout=120) as response:
            envelope = json.load(response)
            assert envelope.get('encoding') == 'base64' and envelope.get('content'), 'GitHub API did not provide file bytes'
            temporary.write_bytes(base64.b64decode(envelope['content']))
    if expected_blob:
        assert blob_sha1(temporary) == expected_blob, 'Incomplete or unexpected raw font; original not installed'
    temporary.replace(destination)
    receipts[relative(destination)] = {'retrieved_via': api_url, 'accept_header': accept,
                                       'sha256': sha256(destination), 'bytes': destination.stat().st_size}
    dump(receipts_path, receipts)
    print(f'DOWNLOADED {relative(destination)} ({destination.stat().st_size} bytes)', flush=True)
    return api_url

def names(font: TTFont, name_id: int) -> list[str]:
    return sorted({record.toUnicode() for record in font['name'].names if record.nameID == name_id})

def inspect_font(path: Path, required: set[int]) -> dict:
    font = TTFont(path, lazy=False, checkChecksums=2)
    cmap = font.getBestCmap()
    assert cmap, f'No Unicode cmap: {path}'
    assert all(cmap.get(cp) != '.notdef' for cp in required if cp in cmap)
    # Force the table most relevant to TrueType glyph validity to decompile.
    assert 'glyf' in font and 'loca' in font
    len(font['glyf'].glyphs)
    axes = [
        {'tag': axis.axisTag, 'min': axis.minValue, 'default': axis.defaultValue, 'max': axis.maxValue}
        for axis in font['fvar'].axes
    ] if 'fvar' in font else []
    missing = sorted(required - set(cmap))
    result = {
        'path': relative(path), 'bytes': path.stat().st_size, 'sha256': sha256(path),
        'sfnt_version_hex': font.sfntVersion.encode('latin1').hex(), 'flavor': font.flavor,
        'family_names': names(font, 1), 'typographic_family_names': names(font, 16),
        'full_names': names(font, 4), 'postscript_names': names(font, 6),
        'unique_ids': names(font, 3),
        'version_strings': names(font, 5), 'font_revision': font['head'].fontRevision,
        'copyright': names(font, 0), 'license_metadata': names(font, 13),
        'attribution_by_name_id': {str(n): names(font, n) for n in (0, 7, 8, 9, 13, 14)},
        'license_urls': names(font, 14), 'axes': axes,
        'default_os2_weight_class': font['OS/2'].usWeightClass,
        'unicode_cmap_size': len(cmap), 'glyph_count': font['maxp'].numGlyphs,
        'required_codepoint_count': len(required),
        'missing_required_codepoints': [f'U+{cp:04X}' for cp in missing],
        'chinese_basic_cjk_mapped_count': sum(0x4E00 <= cp <= 0x9FFF for cp in cmap),
        'validation': 'fontTools parsed metadata, cmap, variable axes and TrueType glyph table; not browser shaping or visual acceptance',
    }
    font.close()
    return result

def rename_subset(font: TTFont, family: str, original_sha: str) -> None:
    name_table = font['name']
    ps_family = family.replace(' ', '')
    default_style = name_table.getDebugName(17) or name_table.getDebugName(2) or 'Regular'
    ps_style = ''.join(c for c in default_style if c.isascii() and c.isalnum()) or 'Regular'
    # Preserve upstream copyright, trademark, authorship, licence and licence URL.
    # Preserve upstream subfamily/style names instead of mislabelling an ExtraLight default as Regular.
    replacement = {1: family, 3: f'{ps_family}-Fixed-{original_sha[:12]}',
                   4: f'{family} {default_style}', 6: f'{ps_family}-{ps_style}', 16: family, 25: ps_family}
    for record in list(name_table.names):
        if record.nameID in replacement:
            value = replacement[record.nameID]
        elif record.nameID not in {0, 7, 8, 9, 10, 11, 12, 13, 14} and any(
            phrase in record.toUnicode() for phrase in ('SourceHanSerif', 'Source Han Serif', 'NotoSansSC', 'Noto Sans SC')
        ):
            value = record.toUnicode()
            for phrase in ('SourceHanSerifCN', 'Source Han Serif CN', 'SourceHanSerif', 'Source Han Serif', 'NotoSansSC', 'Noto Sans SC'):
                value = value.replace(phrase, ps_family if ' ' not in phrase else family)
        else:
            continue
        record.string = value.encode(record.getEncoding())
    for name_id, value in replacement.items():
        name_table.setName(value, name_id, 3, 1, 0x409)
    font['head'].modified = font['head'].created
    font.recalcTimestamp = False

def build_subset(source: dict, original: Path, corpus: str) -> Path:
    font = TTFont(original, lazy=False, recalcTimestamp=False)
    prior_attribution = {n: names(font, n) for n in (0, 7, 8, 9, 13, 14)}
    options = subset.Options()
    options.name_IDs = ['*']
    options.name_languages = ['*']
    options.name_legacy = True
    options.layout_features = ['*']
    options.notdef_glyph = True
    options.notdef_outline = True
    options.recommended_glyphs = True
    options.recalc_timestamp = False
    processor = subset.Subsetter(options=options)
    processor.populate(text=corpus)
    processor.subset(font)
    rename_subset(font, source['derived_family'], sha256(original))
    assert {n: names(font, n) for n in prior_attribution} == prior_attribution, 'Attribution changed'
    font.flavor = 'woff2'
    target = ROOT / 'derived' / source['derived_filename']
    font.save(target)
    font.close()
    print(f'BUILT {relative(target)} ({target.stat().st_size} bytes)', flush=True)
    return target

def write_css(originals: list[dict], derived: list[dict]) -> None:
    def weight_range(entry: dict) -> str:
        axis = next(a for a in entry['axes'] if a['tag'] == 'wght')
        return f"{axis['min']:g} {axis['max']:g}"
    chunks = ['/* Local fixed-copy WOFF2 subsets. Keep upstream OFL files when redistributing. */']
    full_chunks = ['/* Optional full-font fallback. Include explicitly when dynamic text needs packaged Chinese coverage. */']
    for source, original, entry in zip(SOURCES, originals, derived):
        licence_source = ROOT / 'originals' / source['id'] / source['license_filename']
        licence_copy = ROOT / 'derived' / f"OFL-{source['id']}.txt"
        licence_copy.write_bytes(licence_source.read_bytes())
        chunks.append(f'''@font-face {{
  font-family: "{source['derived_family']}";
  src: url("./{source['derived_filename']}") format("woff2");
  font-style: normal;
  font-weight: {weight_range(entry)};
  font-display: swap;
}}''')
        fmt = 'woff2' if original['flavor'] == 'woff2' else 'truetype'
        full_chunks.append(f'''@font-face {{
  font-family: "{source['derived_family']} Full";
  src: url("../{original['path']}") format("{fmt}");
  font-style: normal;
  font-weight: {weight_range(original)};
  font-display: swap;
}}''')
    chunks.append('''/* Example role classes only; no body/reset or application selectors are changed.
   Full families are activated only by including font-face-full-fallback.css.
   Without it, missing dynamic characters use platform-dependent system fonts. */
.trace-font-display {
  font-family: "Trace Home Serif", "Trace Home Serif Full", "Noto Serif CJK SC", "Songti SC", SimSun, serif;
  font-weight: 600;
  font-synthesis: none;
}
.trace-font-ui {
  font-family: "Trace Home Sans", "Trace Home Sans Full", "Noto Sans CJK SC", "Microsoft YaHei", "PingFang SC", sans-serif;
  font-weight: 400;
  font-synthesis: none;
}
''')
    (ROOT / 'derived' / 'font-face.css').write_text('\n\n'.join(chunks) + '\n', encoding='utf-8')
    (ROOT / 'derived' / 'font-face-full-fallback.css').write_text('\n\n'.join(full_chunks) + '\n', encoding='utf-8')

def supporting_files() -> list[dict]:
    paths = [ROOT / name for name in ('fixed-copy.json', 'prepare_fonts.py', 'FONT-USAGE.md', 'download-receipts.json')]
    paths += sorted((ROOT / 'derived').glob('*.css')) + sorted((ROOT / 'derived').glob('OFL-*.txt'))
    return [{'path': relative(path), 'bytes': path.stat().st_size, 'sha256': sha256(path)} for path in paths if path.exists()]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--verify-only', action='store_true', help='Offline verification; no downloads or derived output writes')
    parser.add_argument('--reuse-derived', action='store_true', help='Resume interrupted preparation: reuse a derived font only after linkage, attribution, axes and coverage checks')
    args = parser.parse_args()
    assert sha256(PACKAGE) == PACKAGE_HASH, 'Context package identity mismatch'
    package = json.loads(PACKAGE.read_text(encoding='utf-8'))
    assert package['task_id'] == TASK_ID
    for reference in package['reference_images']:
        assert sha256(Path(reference['path'])) == reference['sha256'], reference['name']
    corpus_data = json.loads((ROOT / 'fixed-copy.json').read_text(encoding='utf-8'))
    corpus = '\n'.join(text for key, value in corpus_data.items() if key != 'description'
                       for text in (value if isinstance(value, list) else [value]))
    required = {ord(c) for c in corpus if not c.isspace()} | {0x20, 0xA0, 0x3000}
    # Newlines are transcription separators, not visible glyph requirements.
    corpus = ''.join(sorted((chr(cp) for cp in required), key=ord))
    if args.verify_only:
        manifest = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))
        assert sha256(ROOT / manifest['fixed_copy']['path']) == manifest['fixed_copy']['sha256'], 'Corpus changed; rebuild subsets'
        for entry in manifest.get('supporting_files', []):
            assert sha256(ROOT / entry['path']) == entry['sha256'], f'Supporting file changed: {entry["path"]}'
        for item in manifest['originals'] + manifest['derived'] + manifest['licenses']:
            target = ROOT / item['path']
            assert sha256(target) == item['sha256'], f'Hash mismatch: {item["path"]}'
            if item in manifest['licenses']:
                continue
            if item in manifest['originals']:
                # The build already parsed this exact original. Hash identity ties
                # that report to these bytes; avoid expensive repeated WOFF2 CJK decoding.
                assert item['required_codepoint_count'] == len(required) and not item['missing_required_codepoints']
                assert blob_sha1(target) == item['git_blob_sha1']
                print('HASH VERIFIED ORIGINAL (build parse report reused)', item['path'], item['bytes'])
                continue
            report = inspect_font(target, required)
            assert not report['missing_required_codepoints'], report
            assert not any('Source' in name for name in report['family_names'] + report['full_names'] + report['postscript_names']), 'Reserved primary name retained'
            print('VERIFIED', item['path'], report['bytes'], report['unicode_cmap_size'])
        print(f'OFFLINE VERIFIED: {len(required)} visible codepoints; 6 unchanged reference images; context package matched')
        return
    (ROOT / 'derived').mkdir(parents=True, exist_ok=True)
    originals, derived, licenses = [], [], []
    for source in SOURCES:
        original = ROOT / 'originals' / source['id'] / source['filename']
        license_path = original.parent / source['license_filename']
        url, license_url = raw_url(source, source['upstream_path']), raw_url(source, source['license_upstream_path'])
        font_retrieved_via = fetch(source, source['upstream_path'], original, source['expected_git_blob_sha1'])
        assert original.stat().st_size == source['expected_bytes'], 'Unexpected upstream font size'
        assert blob_sha1(original) == source['expected_git_blob_sha1'], 'Official Git blob identity mismatch'
        license_retrieved_via = fetch(source, source['license_upstream_path'], license_path)
        license_text = license_path.read_text(encoding='utf-8')
        assert 'SIL OPEN FONT LICENSE Version 1.1' in license_text
        assert sorted(re.findall(r"Reserved\s+Font\s+Name\s+'([^']+)'", license_text)) == sorted(source['reserved_font_names'])
        print(f'INSPECT ORIGINAL {source["id"]}', flush=True)
        entry = inspect_font(original, required)
        assert not entry['missing_required_codepoints'], entry
        entry.update({'id': source['id'], 'source_url': url, 'repository': source['repository'],
                      'retrieved_via': font_retrieved_via,
                      'upstream_commit': source['commit'], 'git_blob_sha1': blob_sha1(original),
                      'license': 'OFL-1.1', 'reserved_font_names': source['reserved_font_names'],
                      'note': 'Official original, byte-for-byte verified against pinned Git blob; no modification'})
        originals.append(entry)
        licenses.append({'path': relative(license_path), 'source_url': license_url,
                         'retrieved_via': license_retrieved_via,
                         'upstream_commit': source['commit'], 'bytes': license_path.stat().st_size,
                         'sha256': sha256(license_path), 'license': 'OFL-1.1'})
        target = ROOT / 'derived' / source['derived_filename']
        if not (args.reuse_derived and target.exists()):
            print(f'SUBSET {source["id"]}', flush=True)
            target = build_subset(source, original, corpus)
        else:
            print(f'REVALIDATE EXISTING SUBSET {source["id"]}', flush=True)
        report = inspect_font(target, required)
        assert not report['missing_required_codepoints'], report
        assert source['derived_family'] in report['family_names']
        assert report['attribution_by_name_id'] == entry['attribution_by_name_id']
        assert report['axes'] == entry['axes']
        assert any(entry['sha256'][:12] in identity for identity in report['unique_ids'])
        report.update({'derived_from': relative(original), 'original_sha256': sha256(original),
                       'license': 'OFL-1.1', 'modifications': 'Character subset, WOFF2 encoding, primary family/PS/instance names changed, deterministic head timestamp; upstream attribution retained',
                       'fixed_copy_source': 'fixed-copy.json', 'dynamic_content_coverage': 'Not guaranteed; use complete-font or system fallback'})
        derived.append(report)
    write_css(originals, derived)
    manifest = {
        'task_id': TASK_ID, 'context_package_sha256': PACKAGE_HASH,
        'git_baseline': package['baseline'], 'created_at_utc': datetime.now(timezone.utc).isoformat(),
        'scope': 'Asset preparation only; application and plugin unchanged',
        'reference_images': package['reference_images'],
        'tools': {'python': platform.python_version(), 'fonttools': fontTools.__version__,
                  'fonttools_location': str(Path(fontTools.__file__).resolve())},
        'fixed_copy': {'path': 'fixed-copy.json', 'sha256': sha256(ROOT / 'fixed-copy.json'),
                       'visible_codepoint_count': len(required),
                       'transcription': 'Manually read six supplied images; includes storyboard labels and ASCII/punctuation supplement'},
        'originals': originals, 'derived': derived, 'licenses': licenses,
        'supporting_files': supporting_files(),
        'validation': {'context_package_hash': 'passed', 'six_reference_hashes': 'passed',
                       'pinned_official_git_blob_identity': 'passed',
                       'font_metadata_and_true_type_table_parsing': 'passed',
                       'all_fixed_copy_codepoints': 'passed for both original and derived families',
                       'upstream_attribution_preservation': 'passed',
                       'browser_or_webview_rendering': 'not run', 'file_protocol_loading': 'not run',
                       'visual_typography_acceptance': 'not run', 'dynamic_text_coverage': 'not universal'},
        'download_history': [
            'Initial raw.githubusercontent.com download failed with TLS unexpected EOF before font bytes were written; switched to official GitHub API, with certificate verification enabled.',
            'Source Han Serif original and licence downloaded successfully through Git Blob/Contents JSON APIs.',
            'Noto Sans SC Git Blob JSON transfer was interrupted at 20,054,016 response bytes; incomplete response was not installed as an original.',
            'Noto Sans SC Contents API raw media response ended early at 13,830,638 bytes; its wrong Git blob hash was detected and it was removed from originals.',
            'An HTTP Range request returned 206 with exact Content-Range. Resumed the partial prefix via official Contents raw API, then checked the complete original against pinned Git blob SHA1. Subsequent downloads use bounded 4 MiB ranges.'
            ,'Noto licence Contents API request had transient TLS EOF; official Git Blob API retry succeeded and matched the pinned licence blob hash.'
        ],
        'limitations': [
            'Source Han Serif CN is upstream region-specific Chinese repertoire, not universal Unicode coverage.',
            'Fixed-copy WOFF2 subsets do not cover arbitrary future user content.',
            'A successful metadata check is not proof of browser shaping, fallback, line wrapping, or visual match.',
            'No system font installation, global dependency installation, service, or application integration was performed.'
        ]
    }
    dump(ROOT / 'manifest.json', manifest)
    print('MANIFEST', ROOT / 'manifest.json', flush=True)

if __name__ == '__main__':
    import urllib.parse
    sys.stdout.reconfigure(encoding='utf-8')
    main()
