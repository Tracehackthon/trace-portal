"""Read-only image checks, writes this task's asset manifest only. No image transforms."""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent
WORKSPACE = ROOT.parents[2]
PACKAGE_HASH = 'DD9BDA87EDB138B15C3A3E9535BD78BF5E51934DA333A4175C251BF8F7078C06'

def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest().upper()

def info(path):
    with Image.open(path) as im:
        im.verify()
    with Image.open(path) as im:
        im.load()
        data = {'path':str(path),'sha256':sha(path),'bytes':path.stat().st_size,
                'size':list(im.size),'mode':im.mode,'format':im.format}
        if 'A' in im.getbands():
            alpha = im.getchannel('A'); hist = alpha.histogram()
            data.update({'alpha_extrema':list(alpha.getextrema()),'alpha_bbox':list(alpha.getbbox()),
                         'transparent_pixels':hist[0],'opaque_pixels':hist[255],
                         'semitransparent_pixels':sum(hist[1:255])})
        return data

package_path = ROOT.parent/'coordination/context-package.json'
assert sha(package_path) == PACKAGE_HASH
pkg = json.loads(package_path.read_text(encoding='utf-8'))
refs=[]
for ref in pkg['references']:
    path = WORKSPACE/ref['path']
    actual=sha(path); assert actual==ref['sha256']
    refs.append({'path':ref['path'],'sha256':actual,'match':True})
generated = Path('C:/Users/HoSheil/.codex/generated_images/01a0a0d2-a390-7673-b7da-5548534b597c/exec-a127d700-75ed-4813-884e-dec43720fc46.png')
original = ROOT/'originals/worksite-environment-generated-v1.png'
ready = ROOT/'ready/worksite-environment.png'
assert sha(generated)==sha(original)==sha(ready)
background=info(ready)
assert background['size']==[1672,941] and background['mode']=='RGB'
background.update({'id':'worksite-environment','type':'generated_clean_environment',
                   'source':info(generated),'preserved_original':info(original),
                   'postprocessing':'none; ready is byte-identical copy, no crop/resize/alpha repair',
                   'visual_review':'passed: high-key central whitespace, two-side mountain framing, upper-right cropped moon, no visible UI/text/cards/nodes/lines/bird',
                   'pixel_exact_to_reference':False})
repair_file=WORKSPACE/'artifacts/trace-home-v1-20260914/images/repaired/repair-manifest.json'
repair=json.loads(repair_file.read_text(encoding='utf-8'))
birds=[]
for name in ('bird-perched','bird-takeoff'):
    source=next(a for a in repair['outputs'] if a['asset_id']==name)
    copied=ROOT/f'ready/{name}.png'
    old=Path(source['path'])
    assert sha(copied)==sha(old)==source['sha256'].upper()
    entry=info(copied)
    assert entry['mode']=='RGBA' and entry['alpha_extrema']==[0,255]
    assert entry['transparent_pixels']>0 and entry['opaque_pixels']>0
    entry.update({'id':name,'type':'reused_authorized_alpha_repair',
                  'reused_from':str(old),'reused_sha256':sha(old),
                  'generation_source':source['source_path'],'generation_source_sha256':source['source_sha256'],
                  'prior_repair_manifest':str(repair_file),'prior_repair_manifest_sha256':sha(repair_file),
                  'foot_anchor':source['foot_anchor_cropped_xy'],'common_source_pixel_scale':0.09,
                  'postprocessing_this_task':'none; byte-identical copy',
                  'visual_review':'previous dark/gray small-size check inspected; repaired black/teal/white bird suitable for small worksite focal marker',
                  'limits':'Two poses, not physically continuous flapping. Prior repair has 1–2px edge uncertainty at high magnification; no new repair authorized or performed.'})
    birds.append(entry)
alternatives=[
    ('trace-home-v1-20260914/images/ready/home-environment.png','rejected: middle mountain mass and extra spheres conflict with high whitespace worksite'),
    ('trace-matters-v1-20260915/images/ready/matters-environment.png','rejected: dense mountain texture and upper-left foliage'),
    ('trace-one-thing-v1-20260915/images/ready/chain-environment.png','rejected: foreground lower-right leaves and upper-left branch, inner-lake composition differs'),
    ('trace-one-thing-v1-20260915/images/ready/chain-overview-environment.png','rejected: denser centered mountain mass and upper-left foliage')]
data={
    'taskId':pkg['taskId'],'head':pkg['head'],'context_package_sha256':PACKAGE_HASH,
    'checkedAt':datetime.now(timezone.utc).isoformat(),'owner':'worksite_assets',
    'reference_verification':refs,'reference_images_visually_seen':[r['path'] for r in refs if r['path'].endswith('.png')],
    'alternative_comparison':[{'path':str(WORKSPACE/'artifacts'/p),'sha256':sha(WORKSPACE/'artifacts'/p),'visual_assessment':note} for p,note in alternatives],
    'production':{'tool':'built-in image_gen','model_id':None,'model_identity_status':'tool did not expose model ID; no latest/version claim',
                  'calls':1,'failed_calls':0,'targeted_retries':0,'generated_backgrounds':1,
                  'prompt_path':'prompt-v1.txt','prompt_sha256':sha(ROOT/'prompt-v1.txt'),
                  'edit_input':refs[0],
                  'second_background':'not generated: five states share same spatial direction; minor terrain differences do not justify a second environment'},
    'assets':[background]+birds,
    'rights_and_attribution':{'environment':'Generated project visual from user-provided reference. No third-party component license assigned; preserve generation provenance.',
                              'birds':'Reused project-generated assets, earlier user-authorized local alpha repair; preserve original and repair provenance.',
                              'third_party_image_downloads':0},
    'validation':{'png_decode':'passed all three','reference_hashes':'passed seven','copy_hash_identity':'passed all three',
                  'true_bird_alpha':'passed both','visual_asset_inspection':'passed, static asset level only',
                  'new_image_transforms':'none','new_transparent_generation':'none',
                  'browser_loading':'not run by assets owner','ui_readability_overlay':'not run by assets owner',
                  'app_or_native_integration':'not performed'},
    'limitations':['Background is a generated reconstruction, not pixel-exact removal.',
                   'Acceptance is asset-level, not screenshot parity or interaction acceptance.',
                   'Bird scale should remain consistent across poses; do not give both equal CSS widths.',
                   'Original references and all older task assets remain unchanged.']}
(ROOT/'manifest.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('PASS: seven references; RGB 1672x941 clean environment identity; two RGBA birds identity and alpha; manifest written')
