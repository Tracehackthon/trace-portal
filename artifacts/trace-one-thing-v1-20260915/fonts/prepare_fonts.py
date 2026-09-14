"""Offline-only Trace Chain font subsets. Never edits upstream or application files.

Subset/name-preservation method adapted from this workspace's prior Trace Home
prepare_fonts.py; no network download, system installation, or font substitution.
"""
from pathlib import Path
import argparse
import hashlib
import json
import platform
import re
import shutil
import sys
from datetime import datetime, timezone
import fontTools
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent
TASK = ROOT.parent
WORKSPACE = TASK.parent.parent
PACKAGE = TASK / 'coordination/context-package.json'
PACKAGE_HASH = '5419BAC2804EB001F853B968060478429AA5AFCE08F1ACECEFA14F64E4B3E562'
HEAD = '2f4377864aa353dcecb3f60005d884b11486c84e'
PREVIOUS = WORKSPACE / 'artifacts/trace-home-v1-20260914/fonts'
REFDIR = WORKSPACE / 'manunl/具体页面与视觉实现/桌面端/一件事完整交互链路/Trace一件事连续页面_v1'
SPECS = [('source-han-serif-cn','SourceHanSerifCN-VF.ttf.woff2','LICENSE.txt','Trace Chain Serif','TraceChainSerif-fixed.woff2'),
         ('noto-sans-sc','NotoSansSC[wght].ttf','OFL.txt','Trace Chain Sans','TraceChainSans-fixed.woff2')]

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest().upper()
def dump(path, value): path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n', encoding='utf-8')
def names(font,n): return sorted({r.toUnicode() for r in font['name'].names if r.nameID==n})
def attribution(font): return {str(n): names(font,n) for n in (0,7,8,9,13,14)}
def rel(path): return str(path.relative_to(ROOT)).replace('\\','/')

def inspect(path,required):
    f = TTFont(path,lazy=False,checkChecksums=2)
    cmap=f.getBestCmap()
    assert cmap and 'glyf' in f and 'loca' in f
    len(f['glyf'].glyphs)
    axes=[{'tag':a.axisTag,'min':a.minValue,'default':a.defaultValue,'max':a.maxValue} for a in f['fvar'].axes]
    result={'path':rel(path),'bytes':path.stat().st_size,'sha256':sha(path),'family':names(f,1),'full_name':names(f,4),'postscript':names(f,6),'unique_ids':names(f,3),
            'axes':axes,'attribution':attribution(f),'version':names(f,5),'unicode_cmap_size':len(cmap),'glyph_count':f['maxp'].numGlyphs,
            'required_codepoints':len(required),'missing':[f'U+{c:04X}' for c in sorted(required-set(cmap))]}
    assert all(cmap.get(cp)!='.notdef' for cp in required if cp in cmap)
    f.close()
    return result

def rename(f,family,source_sha):
    table=f['name']; ps=family.replace(' ','')
    style=table.getDebugName(17) or table.getDebugName(2) or 'Regular'
    ps_style=''.join(c for c in style if c.isascii() and c.isalnum()) or 'Regular'
    updates={1:family,3:f'{ps}-Fixed-{source_sha[:12]}',4:f'{family} {style}',6:f'{ps}-{ps_style}',16:family,25:ps}
    for r in list(table.names):
        if r.nameID in updates: value=updates[r.nameID]
        elif r.nameID not in {0,7,8,9,10,11,12,13,14} and any(p in r.toUnicode() for p in ('SourceHanSerif','Source Han Serif','NotoSansSC','Noto Sans SC')):
            value=r.toUnicode()
            for p in ('SourceHanSerifCN','Source Han Serif CN','SourceHanSerif','Source Han Serif','NotoSansSC','Noto Sans SC'):
                value=value.replace(p,ps if ' ' not in p else family)
        else: continue
        r.string=value.encode(r.getEncoding())
    for n,value in updates.items(): table.setName(value,n,3,1,0x409)
    f['head'].modified=f['head'].created
    f.recalcTimestamp=False

def strings(value):
    if isinstance(value,str): return [value]
    if isinstance(value,list): return [s for v in value for s in strings(v)]
    if isinstance(value,dict): return [s for v in value.values() for s in strings(v)]
    return []

def corpus():
    inputs=[TASK/'ui/copy.txt', REFDIR/'看图说明.md']
    if (TASK/'model/sample-view.json').exists(): inputs.append(TASK/'model/sample-view.json')
    if (TASK/'model/fixed-copy.txt').exists(): inputs.append(TASK/'model/fixed-copy.txt')
    # Include reducer notices as fixed UI copy; ASCII source syntax is already in
    # the supplement, while its Chinese string literals add needed glyphs.
    if (TASK/'model/chain-model.mjs').exists(): inputs.append(TASK/'model/chain-model.mjs')
    texts=[]; snapshots=[]
    for path in inputs:
        data=path.read_bytes(); raw=data.decode('utf-8')
        snapshots.append({'path':str(path),'sha256':hashlib.sha256(data).hexdigest().upper()})
        texts += strings(json.loads(raw)) if path.suffix=='.json' else [raw]
    texts.append(''.join(chr(c) for c in range(32,127))+'\u00a0\u3000，。；：？！、“”‘’（）《》【】…—·←→↑↓')
    required={ord(c) for c in '\n'.join(texts) if not c.isspace()}|{0x20,0xA0,0x3000}
    return inputs,texts,required,snapshots

def main():
    args=argparse.ArgumentParser(); args.add_argument('--verify-only',action='store_true'); args.add_argument('--refresh-copy',action='store_true',help='Update copy snapshot only when existing font cmap already covers every current codepoint'); args=args.parse_args()
    assert sha(PACKAGE)==PACKAGE_HASH
    package=json.loads(PACKAGE.read_text(encoding='utf-8'))
    assert package['taskId']=='trace-one-thing-v1-20260915' and package['gitHead']==HEAD
    for r in package['referenceFiles']: assert sha(WORKSPACE/r['path']).lower()==r['sha256'].lower(),r['path']
    inputs,texts,required,snapshots=corpus()
    if args.verify_only or args.refresh_copy:
        m=json.loads((ROOT/'manifest.json').read_text(encoding='utf-8'))
        if not args.refresh_copy:
            assert snapshots==m['copy_inputs'], 'Copy changed; use --refresh-copy if glyphs covered, otherwise rebuild'
        assert sha(ROOT/'fixed-copy.txt')==m['fixed_copy']['sha256']
        for entry in m['originals']+m['derived']+m['licenses']:
            p=ROOT/entry['path']; assert sha(p)==entry['sha256'],str(p)
        reports=[]
        for entry in m['derived']:
            report=inspect(ROOT/entry['path'],required)
            assert not report['missing'], f'New copy needs rebuild: {report["missing"]}'
            assert report['attribution']==entry['attribution']
            assert not any('Source' in n for n in report['family']+report['full_name']+report['postscript'])
            reports.append({**entry,**report})
        assert snapshots==[{'path':str(p),'sha256':sha(p)} for p in inputs], 'Copy changed during verification; retry'
        if args.refresh_copy:
            (ROOT/'fixed-copy.txt').write_text('\n'.join(texts)+'\n',encoding='utf-8')
            m['copy_inputs']=snapshots
            m['fixed_copy']={'path':'fixed-copy.txt','sha256':sha(ROOT/'fixed-copy.txt'),'visible_codepoints':len(required)}
            m['derived']=reports
            m['history'].append('Copy snapshot refreshed after cmap verification; existing font bytes unchanged. '+datetime.now(timezone.utc).isoformat())
            dump(ROOT/'manifest.json',m)
        print(f'OFFLINE VERIFIED: {len(required)} codepoints, 2 subsets, 14 reference files, source/license hashes; copy unchanged')
        return
    original_manifest=json.loads((PREVIOUS/'manifest.json').read_text(encoding='utf-8'))
    (ROOT/'originals').mkdir(exist_ok=True);(ROOT/'derived').mkdir(exist_ok=True)
    shutil.copyfile(PREVIOUS/'manifest.json',ROOT/'originals/previous-font-provenance.json')
    (ROOT/'fixed-copy.txt').write_text('\n'.join(texts)+'\n',encoding='utf-8')
    originals=[];derived=[];licenses=[];css=[]
    for ident,file,license_file,family,target_name in SPECS:
        upstream=next(e for e in original_manifest['originals'] if e['id']==ident)
        lic=next(e for e in original_manifest['licenses'] if f'/{ident}/' in e['path'])
        op=ROOT/upstream['path'];lp=ROOT/lic['path'];op.parent.mkdir(parents=True,exist_ok=True)
        for entry,target in [(upstream,op),(lic,lp)]:
            src=PREVIOUS/entry['path'];assert sha(src)==entry['sha256'];shutil.copyfile(src,target);assert sha(target)==entry['sha256']
        b=op.read_bytes();assert hashlib.sha1(f'blob {len(b)}\0'.encode()+b).hexdigest()==upstream['git_blob_sha1']
        assert re.findall(r"Reserved\s+Font\s+Name\s+'([^']+)'",lp.read_text(encoding='utf-8'))==['Source']
        print('INSPECT ORIGINAL',ident,flush=True)
        src_report=inspect(op,required);assert not src_report['missing'],src_report['missing']
        originals.append({**src_report,'official_provenance':upstream,'note':'Byte-for-byte local reuse of pinned official original; no download this task'})
        f=TTFont(op,lazy=False,recalcTimestamp=False);before=attribution(f)
        options=subset.Options();options.name_IDs=['*'];options.name_languages=['*'];options.name_legacy=True;options.layout_features=['*'];options.notdef_glyph=True;options.notdef_outline=True;options.recommended_glyphs=True;options.recalc_timestamp=False
        processor=subset.Subsetter(options=options);processor.populate(unicodes=required);processor.subset(f)
        rename(f,family,sha(op));assert attribution(f)==before
        f.flavor='woff2';target=ROOT/'derived'/target_name;f.save(target);f.close()
        report=inspect(target,required);assert not report['missing'],report['missing'];assert report['attribution']==before and report['axes']==src_report['axes'];assert family in report['family']
        derived.append({**report,'derived_from':rel(op),'original_sha256':sha(op),'license':'OFL-1.1','changes':'Fixed copy subset; WOFF2 compression; Trace Chain family/full/PS/instance names; deterministic timestamp. Attribution/subfamily/version/variable axes retained.'})
        liccopy=ROOT/'derived'/f'OFL-{ident}.txt';shutil.copyfile(lp,liccopy)
        for p in [lp,liccopy]: licenses.append({'path':rel(p),'sha256':sha(p),'bytes':p.stat().st_size,'license':'OFL-1.1'})
        axis=report['axes'][0]
        css.append(f'@font-face {{\n  font-family: "{family}";\n  src: url("./{target_name}") format("woff2");\n  font-style: normal;\n  font-weight: {axis["min"]:g} {axis["max"]:g};\n  font-display: swap;\n}}')
        print('BUILT',rel(target),report['bytes'],flush=True)
    (ROOT/'derived/font-face.css').write_text('/* Fixed copy only. Keep both OFL notices. Dynamic text requires system fallback. */\n'+'\n\n'.join(css)+'\n',encoding='utf-8')
    m={'task_id':'trace-one-thing-v1-20260915','context_package_sha256':PACKAGE_HASH,'git_baseline':HEAD,'created_at_utc':datetime.now(timezone.utc).isoformat(),
       'scope':'Local fonts only; application unchanged','tools':{'python':platform.python_version(),'fonttools':fontTools.__version__},
       'copy_inputs':snapshots,
       'fixed_copy':{'path':'fixed-copy.txt','sha256':sha(ROOT/'fixed-copy.txt'),'visible_codepoints':len(required)},
       'originals':originals,'derived':derived,'licenses':licenses,
       'validation':{'context_and_references':'passed','original_pinned_git_blob_and_sha':'passed','font_parse_and_fixed_copy_cmap':'passed','attribution_and_variable_axes':'passed','browser_and_file_loading':'not run','visual_font_match':'candidate only; not exact font identification','dynamic_content':'system fallback; not universally covered'},
       'history':['Current task reused locally verified complete originals; no network requests or global installation. Historical download failures remain in originals/previous-font-provenance.json.'],
       'limits':['All glyph checks are structural; browser shaping, line breaks and actual file:// loading need integration verification.','The fixed subset is not universal Chinese coverage; new fixed copy requires rebuild and dynamic input uses system fallback.']}
    if (ROOT/'validation-history.json').exists():
        m['validation_history']=json.loads((ROOT/'validation-history.json').read_text(encoding='utf-8'))
    dump(ROOT/'manifest.json',m)
    print('DONE',len(required),'codepoints',flush=True)

if __name__=='__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
