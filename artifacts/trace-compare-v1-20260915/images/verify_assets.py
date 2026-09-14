"""Read-only asset checks except for this directory's self-check.json report."""
from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parent
WORKSPACE = ROOT.parents[2]

def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest().upper()

def main():
    manifest = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))
    package_path = ROOT.parent / 'coordination/context-package.json'
    assert sha(package_path) == manifest['contextPackageSha256']
    package = json.loads(package_path.read_text(encoding='utf-8'))
    checks = []
    for ref in package['references']:
        assert sha(WORKSPACE / ref['path']) == ref['sha256']
    checks.append({'name': 'context and five reference/provenance hashes', 'ok': True})
    for item in manifest['assets']:
        path = ROOT / item['path']
        assert sha(path) == item['sha256']
        assert sha(Path(item['sourcePath'])) == item['sourceSha256'] == item['sha256']
        with Image.open(path) as image:
            image.load()
            assert list(image.size) == item['size']
            assert image.mode == item['mode']
            if image.mode == 'RGBA':
                assert list(image.getchannel('A').getextrema()) == [0,255]
        checks.append({'name': item['id'] + ' decode, dimensions, hash, source identity and alpha', 'ok': True})
    generated = ROOT / 'originals/compare-environment-generated-v1.png'
    assert sha(generated) == manifest['assets'][0]['sha256']
    checks.append({'name': 'generated original equals ready background', 'ok': True})
    assert sha(ROOT / 'prompts/01-compare-environment.txt') == manifest['generation']['promptSha256']
    checks.append({'name': 'exact prompt saved', 'ok': True})
    result = {'taskId': manifest['taskId'], 'checks': checks, 'passed': len(checks), 'failed': 0,
              'visualReview': 'manual asset review recorded separately; no automated OCR or pixel-perfect claim',
              'UIIntegration': 'not run by assets worker'}
    (ROOT / 'self-check.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'PASS {len(checks)}/{len(checks)} image checks')

if __name__ == '__main__':
    main()
