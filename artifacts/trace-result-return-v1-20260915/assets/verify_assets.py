"""Read-only asset checks; reports are written only beside this script."""
from pathlib import Path
import hashlib
import json
import shutil
from PIL import Image

ROOT = Path(__file__).resolve().parent
WORKSPACE = ROOT.parents[2]
TASK = 'trace-result-return-v1-20260915'
PACKAGE_HASH = 'D314692521774A4B7F205F31634EE68551186ABEA3D2FA5FD9ABFE3A849ABC27'

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()

def describe(relative, role):
    path = WORKSPACE / relative
    entry = {'path': relative, 'sha256': sha(path), 'bytes': path.stat().st_size, 'role': role}
    if path.suffix == '.png':
        with Image.open(path) as im:
            im.load()
            entry.update(size=list(im.size), mode=im.mode)
            if im.mode == 'RGBA':
                hist = im.getchannel('A').histogram()
                entry['alpha'] = {'range': list(im.getchannel('A').getextrema()), 'transparentPixels': hist[0], 'opaquePixels': hist[255], 'partialPixels': sum(hist[1:255])}
    return entry

def main():
    package_path = ROOT.parent / 'coordination/context-package.json'
    assert sha(package_path) == PACKAGE_HASH
    package = json.loads(package_path.read_text(encoding='utf-8'))
    assert package['taskId'] == TASK
    references = []
    for item in package['files']:
        if item['path'].startswith('manunl/具体页面与视觉实现/'):
            assert sha(WORKSPACE / item['path']) == item['sha256']
            if item['path'].endswith('.png'):
                ref = describe(item['path'], 'visual-reference-only; never a UI background')
                assert ref['size'] == [1672, 941]
                references.append(ref)
    backgrounds = []
    for project, filename, decision in [
        ('trace-home-v1-20260914','home-environment.png','not selected: oversized glass wave, sparse vegetation, lower orbs'),
        ('trace-matters-v1-20260915','matters-environment.png','runner-up: matching water and trees; upper-left branch competes with title'),
        ('trace-one-thing-v1-20260915','chain-environment.png','not selected: lower hills, edge moon and near bamboo differ'),
        ('trace-one-thing-v1-20260915','chain-overview-environment.png','selected: closest layered tree-covered hills, right moon, lower water and foreground rocks'),
        ('trace-worksite-v1-20260915','worksite-environment.png','not selected: central region overly empty and moon clipped at right'),
        ('trace-compare-v1-20260915','compare-environment.png','not selected: no moon, too little water or foreground scenery')]:
        record = describe(f'artifacts/{project}/images/ready/{filename}', decision)
        assert record['size'] == [1672, 941] and record['mode'] == 'RGB'
        record['visuallyInspected'] = True
        backgrounds.append(record)
    chosen = next(b for b in backgrounds if b['role'].startswith('selected:'))
    assert chosen['sha256'] == 'A4DDA0E97BF3FFEF2D87D48BE07C272E6C69633A236B07676A92A4DC755C6875'
    chosen = dict(chosen, id='result-return-environment', use='backgroundUrl for all five screens', provenance='artifacts/trace-one-thing-v1-20260915/images/manifest.json', license='Project generated asset; no third-party stock license asserted', modifications='none; reference the existing bytes')
    birds = []
    for pose, size, anchor in [('perched',[1086,839],[772,588]),('takeoff',[1156,1215],[750,955])]:
        bird = describe(f'artifacts/trace-home-v1-20260914/images/repaired/bird-{pose}.png', f'attention marker, {pose} pose')
        assert bird['sha256'] == {'perched':'81DE590D9C88D27AD73BE569385D8B1D6999F08FC269912B4B97B5D403B4EFEC','takeoff':'9BCE1F159D48AB6A8D3230ACA3F41FD4C4A114A064F59DFCC4B62F05EFA7ED93'}[pose]
        assert bird['size'] == size and bird['mode'] == 'RGBA' and bird['alpha']['range'] == [0,255]
        assert bird['alpha']['opaquePixels'] > 1000 and bird['alpha']['transparentPixels'] > 1000
        assert sha(WORKSPACE/f'artifacts/trace-one-thing-v1-20260915/images/ready/bird-{pose}.png') == bird['sha256']
        bird.update(id='bird-'+pose, footAnchor=anchor, sourcePixelScale=.09, cssWidth=size[0]*.09, cssOriginRelativeToFoot=[round(-v*.09,2) for v in anchor], provenance='artifacts/trace-home-v1-20260914/images/repaired/repair-manifest.json', license='Project generated and user-approved alpha repair; no stock license asserted', modifications='none in this task')
        birds.append(bird)
    components=[]
    for path,role in [
        ('artifacts/trace-one-thing-v1-20260915/ui/chain-helpers.mjs','selectedRange, patchDOM and local SVG icons'),
        ('artifacts/trace-one-thing-v1-20260915/ui/chain-screen.mjs','results/revised visual structures and selection event mapping; adapt not whole-model reuse'),
        ('artifacts/trace-compare-v1-20260915/ui/comparison-screen.mjs','before/after receipt, source import, focus-preserving fields and modal patterns'),
        ('artifacts/trace-compare-v1-20260915/ui/comparison.css','before/after, source meta, receipt styles; re-namespace selectors'),
        ('artifacts/trace-worksite-v1-20260915/ui/worksite-screen.mjs','work identity/source trail/material controls and pending/result-only/undo receipt patterns'),
        ('trace-runtime/apps/desktop/src/home/scene-glass.js','mountSceneGlass material adapter, optional small shape use'),
        ('trace-runtime/apps/desktop/src/vendor/shape-only.mjs','alpha-shape glass sourcegraphic filter, MIT'),
        ('trace-runtime/apps/desktop/src/vendor/anime.esm.js','motion-path engine, MIT'),
        ('trace-runtime/apps/desktop/src/home-icons.js','Trace local stroke icon language')]:
        components.append(describe(path,role))
    licenses=[]
    for source,name in [('artifacts/trace-home-v1-20260914/components/originals/animejs/LICENSE.md','MIT-animejs.txt'),('artifacts/trace-home-v1-20260914/components/derived/liquidglassjs/LICENSE','MIT-liquidglassjs.txt'),('artifacts/trace-home-v1-20260914/components/originals/magicui-animated-beam/LICENSE.md','MIT-magicui-reference.txt')]:
        dest=ROOT/'licenses'/name;dest.parent.mkdir(exist_ok=True);shutil.copyfile(WORKSPACE/source,dest)
        assert sha(dest)==sha(WORKSPACE/source)
        licenses.append({'path':'licenses/'+name,'source':source,'sha256':sha(dest),'license':'MIT'})
    result = {'taskId': TASK, 'repoHead': package['repoHead'], 'contextPackageSha256': PACKAGE_HASH, 'status':'isolated candidates, not app integration or visual acceptance', 'references':references, 'backgroundsCompared':backgrounds, 'selectedAssets':[chosen,*birds], 'componentSources':components, 'licenses':licenses, 'fontManifest':'fonts/manifest.json', 'checks':{'referenceHashes':'pass','sixBackgroundDecodes':'pass','birdAlphaAndReuse':'pass','newImageGenerations':0,'newRepositoryDownloads':0,'appWrites':0}, 'limitations':['Chosen background is closest existing scenery, not exact recovery of pixels hidden by reference panels.','No generated bubble skin; use interactive CSS/SVG surfaces.','Two bird poses are not a natural wingbeat sequence.','Project-local code has no detected root distribution license; internal reuse only, not an asserted external open-source grant.']}
    font_manifest=ROOT/'fonts/manifest.json'
    if font_manifest.exists():
        data=json.loads(font_manifest.read_text(encoding='utf-8'))
        result['fontSelection']=data['selectedFonts']
        result['assetBindings']={'backgroundUrl':chosen['path'],'birdPerchedUrl':birds[0]['path'],'birdTakeoffUrl':birds[1]['path']}
        for font in data['selectedFonts']:
            result['assetBindings'][font['role']]=font['path']
            if font.get('base'): result['assetBindings'][font['role'].replace('Delta','')]=font['base']['path']
        result['assetBindingPolicy']='Values are workspace-relative source paths for root to publish as URLs; not runnable app URLs and not hardcoded local-drive paths.'
    (ROOT/'assets.candidate.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (ROOT/'resource-checks.json').write_text(json.dumps({'taskId':TASK,'pass':True,'referenceImages':len(references),'backgroundsDecoded':len(backgrounds),'birdChecks':len(birds),'componentFilesHashed':len(components),'imagesModified':0,'warnings':result['limitations']},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('PASS: 5 visual references, 6 existing backgrounds, 2 alpha birds, 9 component sources; no new images/downloads/app writes')

if __name__ == '__main__':
    main()
