"""Inspect local PNG identity/structure only. No pixel changes or image rewriting."""
from pathlib import Path
import hashlib,json,sys
from datetime import datetime,timezone
from PIL import Image

ROOT=Path(__file__).resolve().parent
TASK=ROOT.parent
WS=TASK.parent.parent
PACKAGE_HASH='5419BAC2804EB001F853B968060478429AA5AFCE08F1ACECEFA14F64E4B3E562'
BASELINE='2f4377864aa353dcecb3f60005d884b11486c84e'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest().upper()
def inspect(p):
    with Image.open(p) as im:
        im.load();entry={'path':str(p),'bytes':p.stat().st_size,'sha256':sha(p),'format':im.format,'size':list(im.size),'mode':im.mode,'alpha':('A' in im.getbands())}
        if entry['alpha']:
            alpha=im.getchannel('A');hist=alpha.histogram();entry.update(alpha_extrema=list(alpha.getextrema()),transparent_pixels=hist[0],semtransparent_pixels=sum(hist[1:255]),opaque_pixels=hist[255],alpha_bbox=alpha.getbbox())
        return entry

assert sha(TASK/'coordination/context-package.json')==PACKAGE_HASH
package=json.loads((TASK/'coordination/context-package.json').read_text(encoding='utf-8'))
for ref in package['referenceFiles']:assert sha(WS/ref['path']).lower()==ref['sha256'].lower()
old=WS/'artifacts/trace-home-v1-20260914/images/repaired'
repair=json.loads((old/'repair-manifest.json').read_text(encoding='utf-8'))
generated=[('chain-environment.png','inner-environment-generated-v1.png','01-inner-background.txt','02-气泡展开-接着这里.png','exec-381c9dd8-362e-44e1-9e00-9af25859c12a.png'),
           ('chain-overview-environment.png','overview-environment-generated-v1.png','02-overview-background.txt','06-先放这里-收起后留下停点.png','exec-980d1997-ff54-4dd9-8946-066397df7295.png')]
entries=[]
for name,original,prompt,reference,generated_file in generated:
    p=ROOT/'ready'/name;o=ROOT/'originals'/original;r=inspect(p)
    assert r['size']==[1672,941] and r['mode']=='RGB' and sha(p)==sha(o)
    source=next(r for r in package['referenceFiles'] if r['path'].endswith(reference))
    r.update(asset_id=name.removesuffix('.png'),role='opaque environment; no UI',original_copy=str(o),original_sha256=sha(o),source_reference=source,
             generation={'tool':'built-in image_gen','model_version':'unknown; tool did not expose a version field','attempt':1,'status':'success_first_attempt',
                         'actual_saved_output':'C:/Users/HoSheil/.codex/generated_images/01a0a0c8-2c49-71a0-b3e6-c73918662c31/'+generated_file,
                         'prompt_path':str(ROOT/'prompts'/prompt),'prompt_sha256':sha(ROOT/'prompts'/prompt),'prompt':(ROOT/'prompts'/prompt).read_text(encoding='utf-8')},
             transformations='No crop, resize, repaint, or alpha repair; ready copy is byte-identical to generated output',
             visual_review={'status':'passed_asset_review','observed':'No visible UI/text/logo/bird/colored nodes/artificial connector curves; reference edge composition retained; generated filled-in area is approximate, not pixel-identical recovery'},
             license_note='Project generated asset from user-provided visual reference; no third-party stock/source-repository license asserted')
    entries.append(r)
for name,anchor in [('bird-perched.png',[772,588]),('bird-takeoff.png',[750,955])]:
    p=ROOT/'ready'/name;source=old/name;r=inspect(p)
    prior=next(e for e in repair['outputs'] if e['asset_id']==name.removesuffix('.png'))
    assert sha(p)==sha(source)==prior['sha256'].upper()
    assert r['alpha'] and r['alpha_extrema']==[0,255]
    r.update(asset_id=name.removesuffix('.png'),role='bird pose, genuine RGBA',source_path=str(source),source_sha256=sha(source),
             provenance_manifest=str(old/'repair-manifest.json'),provenance_manifest_sha256=sha(old/'repair-manifest.json'),
             foot_anchor_xy=anchor,scale_rule='One common source-pixel scale, not equal CSS widths',
             transformations='None this task. Byte-for-byte reuse of prior user-authorized transparent-channel repair.',
             authorization_boundary='Prior user script approval limited to these two existing bird images; no new image script edit performed.',
             limitations=prior['limitations'],visual_review={'status':'previous matte review re-read and small-size-check image personally viewed; no UI animation acceptance'})
    entries.append(r)
manifest={'task_id':'trace-one-thing-v1-20260915','context_package_sha256':PACKAGE_HASH,'git_baseline':BASELINE,'verified_at_utc':datetime.now(timezone.utc).isoformat(),
          'scope':'images only; app, other task outputs, original reference PNGs unchanged',
          'assets':entries,
          'reuse_decisions':[
              {'path':str(WS/'artifacts/trace-matters-v1-20260915/images/ready/matters-environment.png'),'sha256':sha(WS/'artifacts/trace-matters-v1-20260915/images/ready/matters-environment.png'),'decision':'not selected','reason':'Denser mid-to-upper mountains and inward moon differ from 02 low side hills/edge moon/bamboo framing.'},
              {'path':str(WS/'artifacts/trace-home-v1-20260914/images/ready/home-environment.png'),'sha256':sha(WS/'artifacts/trace-home-v1-20260914/images/ready/home-environment.png'),'decision':'not selected','reason':'Tall right glass wave, two small foreground spheres, and less arborized low landscape differ from new 02 and 06.'},
              {'decision':'second overview background justified','reason':'06 has central layered ridges, an inward moon and no close bamboo. Inner 02 background would change the collapsed overview framing.'}],
          'history':['All eleven supplied reference PNGs and the look-at-image guide personally inspected before production.','Inner background built-in generation: first attempt succeeded; copied unchanged into workspace and inspected.','Overview background built-in generation: first attempt succeeded; copied unchanged into workspace and inspected.','No additional glass/editor/button raster assets were generated; these remain code-renderable.','No bird generation or repair rerun this task. Prior transparent generation failures/repair diagnostics remain in the linked prior provenance.'],
          'validation':{'context_and_14_reference_hashes':'passed','PNG_decode_and_dimensions':'passed','RGB_background':'passed','bird_real_alpha':'passed','ready_equals_original_or_source':'passed','browser_or_native_UI':'not run by assets worker','pixel_exact_reconstruction':'not claimed'}}
(ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
sys.stdout.reconfigure(encoding='utf-8')
print(json.dumps({'checked':len(entries),'assets':[{'id':e['asset_id'],'sha256':e['sha256'],'size':e['size'],'mode':e['mode']} for e in entries]},ensure_ascii=False,indent=2))
