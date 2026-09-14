"""Offline extension from pinned local official originals. Writes only this fonts directory.

Reuses the prior, hash-verified fontTools subset/rename helpers; never calls their
download or main functions. No system installation and no application changes.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import platform
import shutil

ROOT = Path(__file__).resolve().parent
WORKSPACE = ROOT.parents[2]
OLD = ROOT.parent.parent / 'trace-home-v1-20260914' / 'fonts'
PACKAGE_SHA = 'BDF5906EC3208A9C254499C5082E5E689971A7547BCC9A1A303BA5F28FA45068'
HELPER_SHA = 'CD2A304643FC80C9C1B5501204AC694B925B13EDD4B098B4B0C1EAEEA0FFF1E4'
MANIFEST_SHA = 'C7478B60FC89DF5DB8FF15D4D5C6EF7BE52E6CEAF705CB864A41AAF29B817B63'

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()

def dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def strings(value):
    if isinstance(value, str): yield value
    elif isinstance(value, list):
        for item in value: yield from strings(item)
    elif isinstance(value, dict):
        for key, item in value.items():
            if key != 'description': yield from strings(item)

def main():
    args = argparse.ArgumentParser()
    args.add_argument('--verify-only', action='store_true')
    options = args.parse_args()
    package_path = ROOT.parent / 'coordination' / 'context-package.json'
    assert sha(package_path) == PACKAGE_SHA, 'Wrong context package'
    package = json.loads(package_path.read_text(encoding='utf-8'))
    for reference in package['references']:
        assert sha(WORKSPACE / reference['path']) == reference['sha256'], reference['path']
    assert sha(OLD / 'prepare_fonts.py') == HELPER_SHA, 'Old helper changed; review before rebuilding'
    assert sha(OLD / 'manifest.json') == MANIFEST_SHA, 'Original manifest changed'
    spec = importlib.util.spec_from_file_location('trace_prior_font_helpers', OLD / 'prepare_fonts.py')
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    helper.ROOT = ROOT  # Only the current output directory may be written by helper calls.
    old_manifest = json.loads((OLD / 'manifest.json').read_text(encoding='utf-8'))
    corpus_files = [ROOT / 'fixed-copy.json', ROOT.parent / 'model' / 'view-fixtures.json']
    corpus_inputs = [{'path': p.relative_to(WORKSPACE).as_posix(), 'sha256': sha(p)} for p in corpus_files]
    corpus = '\n'.join(value for path in corpus_files for value in strings(json.loads(path.read_text(encoding='utf-8'))))
    required = {ord(c) for c in corpus if not c.isspace()} | set(range(0x20, 0x7F)) | {0xA0, 0x3000}
    required_text = ''.join(chr(cp) for cp in sorted(required))
    sources = []
    for i, definition in enumerate(helper.SOURCES):
        entry = dict(definition)
        entry['derived_family'] = 'Trace Matters Serif' if i == 0 else 'Trace Matters Sans'
        entry['derived_filename'] = 'TraceMattersSerif-fixed.woff2' if i == 0 else 'TraceMattersSans-fixed.woff2'
        original = OLD / old_manifest['originals'][i]['path']
        assert sha(original) == old_manifest['originals'][i]['sha256'], 'Original font changed'
        license_path = OLD / old_manifest['licenses'][i]['path']
        assert sha(license_path) == old_manifest['licenses'][i]['sha256'], 'Original license changed'
        sources.append((entry, original, license_path, old_manifest['originals'][i], old_manifest['licenses'][i]))
    if options.verify_only:
        manifest = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))
        assert manifest['required_codepoint_count'] == len(required)
        for source in manifest['corpus_inputs']:
            assert sha(WORKSPACE / source['path']) == source['sha256'], 'Corpus input changed'
        for entry in manifest['derived']:
            path = ROOT / entry['path']
            assert sha(path) == entry['sha256'], 'Derived font changed'
            report = helper.inspect_font(path, required)
            assert not report['missing_required_codepoints']
            print('VERIFIED', entry['path'], report['bytes'], 'missing=0', flush=True)
        for entry in manifest['licenses']:
            assert sha(ROOT / entry['path']) == entry['sha256']
        for entry in manifest.get('supporting_files', []):
            assert sha(ROOT / entry['path']) == entry['sha256'], f"Supporting file changed: {entry['path']}"
        print('OFFLINE VERIFIED', len(required), 'required codepoints; 7 reference hashes; originals unchanged', flush=True)
        return
    (ROOT / 'derived').mkdir(parents=True, exist_ok=True)
    (ROOT / 'originals').mkdir(parents=True, exist_ok=True)
    reports, originals, licenses, css = [], [], [], []
    for entry, original, license_path, metadata, license_metadata in sources:
        target = helper.build_subset(entry, original, required_text)
        report = helper.inspect_font(target, required)
        assert not report['missing_required_codepoints'], report['missing_required_codepoints']
        assert not any('Source' in name for name in report['family_names'] + report['full_names'] + report['postscript_names'])
        assert report['attribution_by_name_id'] == metadata['attribution_by_name_id'], 'Attribution altered'
        report['derived_from_sha256'] = sha(original)
        reports.append(report)
        original_record = {**metadata, 'path': original.relative_to(WORKSPACE).as_posix(), 'metadata_validation': 'Full-font parse from previous preparation reused by exact SHA256; this run parses newly built subset.'}
        originals.append(original_record)
        destination = ROOT / 'derived' / f"OFL-{entry['id']}.txt"
        shutil.copyfile(license_path, destination)
        licenses.append({**license_metadata, 'path': destination.relative_to(ROOT).as_posix()})
        axis = next(axis for axis in report['axes'] if axis['tag'] == 'wght')
        css.append(f'''@font-face {{
  font-family: "{entry['derived_family']}";
  src: url("./{entry['derived_filename']}") format("woff2");
  font-weight: {axis['min']:g} {axis['max']:g};
  font-style: normal;
  font-display: swap;
}}''')
    for source in corpus_inputs:
        assert sha(WORKSPACE / source['path']) == source['sha256'], 'Corpus changed during build; rerun with stable inputs'
    (ROOT / 'derived' / 'font-face.css').write_text('/* Offline fixed-copy subsets; keep both OFL files when packaging. */\n' + '\n\n'.join(css) + '\n', encoding='utf-8')
    dump(ROOT / 'copy-codepoints.json', {'count': len(required), 'codepoints': [f'U+{cp:04X}' for cp in sorted(required)], 'characters': required_text})
    dump(ROOT / 'originals' / 'references.json', originals)
    manifest = {
        'task': 'trace-matters-v1-20260915', 'created_at_utc': datetime.now(timezone.utc).isoformat(),
        'context_package_sha256': PACKAGE_SHA, 'git_baseline': package['head'],
        'scope': 'New subsets only; reuse previous official originals in place; no download, installation, service or application change',
        'tools': {'python': platform.python_version(), 'fonttools': helper.fontTools.__version__, 'pinned_helper_sha256': HELPER_SHA},
        'required_codepoint_count': len(required),
        'corpus_inputs': corpus_inputs,
        'originals': originals, 'derived': reports, 'licenses': licenses,
        'reference_images': package['references'],
        'limitations': ['Fixed-copy subsets are not arbitrary dynamic Chinese coverage; system fallback remains required.', 'Metadata/cmap/glyph parse is not browser shaping or visual acceptance.', 'New derivatives renamed for OFL reserved-name compliance; original attribution preserved.', 'Full original font bytes remain in prior artifact fonts/originals; references.json does not embed them.'],
    }
    manifest['supporting_files'] = [{'path': name, 'bytes': (ROOT / name).stat().st_size, 'sha256': sha(ROOT / name)} for name in ['prepare_fonts.py', 'FONT-USAGE.md', 'fixed-copy.json', 'copy-codepoints.json', 'scene-copy-audit.json', 'derived/font-face.css', 'originals/references.json'] if (ROOT / name).exists()]
    dump(ROOT / 'manifest.json', manifest)
    print('BUILT AND VERIFIED', len(required), 'required codepoints; missing=0 for both families', flush=True)

if __name__ == '__main__':
    import sys
    sys.dont_write_bytecode = True
    sys.stdout.reconfigure(encoding='utf-8')
    main()
