"""Reuse a complete existing subset or create an offline renamed subset if needed."""
from pathlib import Path
import argparse
import hashlib
import json
import os
import shutil
import fontTools
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT=Path(__file__).resolve().parent
WORKSPACE=ROOT.parents[2]
OUT=ROOT/'fonts'
COPY=ROOT.parent/'ui/copy.json'
PRIOR=WORKSPACE/'artifacts/trace-home-v1-20260914/fonts'
PACKAGE_HASH='D314692521774A4B7F205F31634EE68551186ABEA3D2FA5FD9ABFE3A849ABC27'

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest().upper()
def names(font,key): return sorted({r.toUnicode() for r in font['name'].names if r.nameID==key})
def write(path,value): path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def strings(value):
    if isinstance(value,str): return [value]
    if isinstance(value,list): return [s for v in value for s in strings(v)]
    if isinstance(value,dict): return [s for v in value.values() for s in strings(v)]
    return []
def required():
    data=json.loads(COPY.read_text(encoding='utf-8'))
    text='\n'.join(s for k,v in data.items() if k not in ('taskId','scope') for s in strings(v))
    points={ord(c) for c in text if not c.isspace()}|set(range(0x20,0x7f))|{0xa0,0x3000}
    points|={ord(c) for c in '“”‘’「」【】（）《》—–·…←→↑↓✓×：；，。！？／'}
    return text,points
def inspect(path,points):
    font=TTFont(path,lazy=False,checkChecksums=2)
    cmap=font.getBestCmap()
    result={'path':str(path.relative_to(WORKSPACE)).replace('\\','/'),'sha256':sha(path),'bytes':path.stat().st_size,'family':names(font,1),'fullName':names(font,4),'postscriptName':names(font,6),'cmapSize':len(cmap),'requiredCodepoints':len(points),'missingCharacters':''.join(map(chr,sorted(points-set(cmap)))),'missingCodepoints':[f'U+{n:04X}' for n in sorted(points-set(cmap))],'attribution':{str(k):names(font,k) for k in (0,7,8,9,13,14)},'axes':[{'tag':a.axisTag,'min':a.minValue,'max':a.maxValue} for a in font['fvar'].axes]}
    font.close()
    return result
def rename(font,family,original_hash):
    ps=family.replace(' ',''); table=font['name']; style=table.getDebugName(17) or table.getDebugName(2) or 'Regular'
    psstyle=''.join(c for c in style if c.isascii() and c.isalnum()) or 'Regular'
    replacements={1:family,3:f'{ps}-Fixed-{original_hash[:12]}',4:f'{family} {style}',6:f'{ps}-{psstyle}',16:family,25:ps}
    for r in list(table.names):
        if r.nameID in replacements: text=replacements[r.nameID]
        elif r.nameID not in {0,7,8,9,10,11,12,13,14}:
            text=r.toUnicode()
            for old in ('SourceHanSerifCN','Source Han Serif CN','SourceHanSerif','Source Han Serif','NotoSansSC','Noto Sans SC'): text=text.replace(old,family if ' ' in old else ps)
        else: continue
        r.string=text.encode(r.getEncoding())
    for k,v in replacements.items(): table.setName(v,k,3,1,0x409)
    font['head'].modified=font['head'].created; font.recalcTimestamp=False
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--verify-only',action='store_true');args=parser.parse_args()
    assert sha(ROOT.parent/'coordination/context-package.json')==PACKAGE_HASH
    text,points=required()
    OUT.mkdir(exist_ok=True)
    if args.verify_only:
        manifest=json.loads((OUT/'manifest.json').read_text(encoding='utf-8'))
        assert sha(COPY)==manifest['copy']['sha256'],'UI copy changed; rerun preparation'
        for entry in manifest['selectedFonts']:
            path=WORKSPACE/entry['path']; actual=inspect(path,points)
            assert actual['sha256']==entry['sha256']
            assert actual['attribution']==entry['attribution']
            if entry.get('base'):
                base=WORKSPACE/entry['base']['path']; assert sha(base)==entry['base']['sha256']
                combined=set(TTFont(base).getBestCmap())|set(TTFont(path).getBestCmap())
                assert not points-combined
            else: assert not actual['missingCodepoints']
        for entry in manifest['originals']+manifest['licenses']:
            assert sha(WORKSPACE/entry['path'])==entry['sha256']
        print(f'PASS: fixed copy {len(points)} codepoints, original hashes, 2 selected fonts and 2 OFL files');return
    coverage=[]
    for name in ('trace-home-v1-20260914','trace-matters-v1-20260915','trace-one-thing-v1-20260915','trace-worksite-v1-20260915','trace-compare-v1-20260915'):
        for path in sorted((WORKSPACE/'artifacts'/name/'fonts/derived').glob('*.woff2')):
            coverage.append(inspect(path,points))
    write(OUT/'existing-coverage.json',{'copySha256':sha(COPY),'requiredCodepoints':len(points),'fonts':coverage})
    prior=json.loads((PRIOR/'manifest.json').read_text(encoding='utf-8'))
    chosen=[];originals=[];licenses=[];css=[]
    for ident,kind,lic in [('source-han-serif-cn','Serif','LICENSE.txt'),('noto-sans-sc','Sans','OFL.txt')]:
        src=next(v for v in prior['originals'] if v['id']==ident); original=PRIOR/src['path']; assert sha(original)==src['sha256']
        originals.append({k:src[k] for k in ('id','sha256','source_url','repository','upstream_commit','git_blob_sha1','license','reserved_font_names')}|{'path':str(original.relative_to(WORKSPACE)).replace('\\','/')})
        available=[e for e in coverage if kind in e['path'] and not e['missingCodepoints']]
        if available:
            entry=min(available,key=lambda e:e['bytes']);entry['decision']='reuse existing fully covered subset, no duplicate font generated'
        else:
            # Use one existing family, not five fallback families or a duplicate sixth set.
            base=min((e for e in coverage if kind in e['path']),key=lambda e:(len(e['missingCodepoints']),e['bytes']))
            delta_points={int(cp[2:],16) for cp in base['missingCodepoints']}
            font=TTFont(original,lazy=False,recalcTimestamp=False); attribution={str(k):names(font,k) for k in (0,7,8,9,13,14)}
            assert not delta_points-set(font.getBestCmap()), 'Requested character absent in upstream original'
            options=subset.Options();options.name_IDs=['*'];options.name_languages=['*'];options.name_legacy=True;options.notdef_glyph=True;options.notdef_outline=True;options.recommended_glyphs=True;options.layout_features=['*'];options.recalc_timestamp=False
            sub=subset.Subsetter(options=options);sub.populate(unicodes=delta_points);sub.subset(font)
            rename(font,'Trace Result Return '+kind+' Delta',src['sha256']);font.flavor='woff2';path=OUT/f'TraceResultReturn{kind}-delta.woff2';font.save(path);font.close()
            entry=inspect(path,delta_points);assert not entry['missingCodepoints'] and entry['attribution']==attribution
            assert all('Source' not in n for k in ('family','fullName','postscriptName') for n in entry[k])
            entry['base']={k:base[k] for k in ('path','sha256','bytes','family','cmapSize')}
            entry['deltaCodepoints']=[f'U+{cp:04X}' for cp in sorted(delta_points)]
            entry['deltaCharacters']=''.join(map(chr,sorted(delta_points)))
            entry['combinedFixedCopyMissing']=[]
            assert not points-(set(TTFont(WORKSPACE/base['path']).getBestCmap())|set(TTFont(path).getBestCmap()))
            entry['decision']='reuse closest existing subset plus only missing glyphs; no duplicate full font'
        entry['role']=('serifDeltaUrl' if kind=='Serif' else 'sansDeltaUrl') if entry.get('base') else ('serifUrl' if kind=='Serif' else 'sansUrl');chosen.append(entry)
        licence_source=original.parent/lic;assert 'SIL OPEN FONT LICENSE Version 1.1' in licence_source.read_text(encoding='utf-8')
        destination=OUT/f'OFL-{ident}.txt';shutil.copyfile(licence_source,destination);licenses.append({'path':str(destination.relative_to(WORKSPACE)).replace('\\','/'),'sha256':sha(destination),'license':'OFL-1.1'})
        relative=os.path.relpath(WORKSPACE/entry['path'],OUT).replace('\\','/')
        axis=next(a for a in entry['axes'] if a['tag']=='wght')
        if entry.get('base'):
            baserel=os.path.relpath(WORKSPACE/entry['base']['path'],OUT).replace('\\','/')
            css.append(f'@font-face {{ font-family: "Trace Result Return {kind}"; src: url("{baserel}") format("woff2"); font-weight: {axis["min"]:g} {axis["max"]:g}; font-style: normal; font-display: swap; }}')
        delta=' Delta' if entry.get('base') else ''
        css.append(f'@font-face {{ font-family: "Trace Result Return {kind}{delta}"; src: url("{relative}") format("woff2"); font-weight: {axis["min"]:g} {axis["max"]:g}; font-style: normal; font-display: swap; }}')
        print(f'{kind}: {entry["decision"]}; {entry["bytes"]} bytes; missing 0',flush=True)
    (OUT/'copy-snapshot.txt').write_text(text+'\n',encoding='utf-8');(OUT/'font-face.css').write_text('\n'.join(css)+'\n',encoding='utf-8')
    write(OUT/'manifest.json',{'taskId':'trace-result-return-v1-20260915','contextPackageSha256':PACKAGE_HASH,'copy':{'path':str(COPY.relative_to(WORKSPACE)).replace('\\','/'),'sha256':sha(COPY),'requiredCodepoints':len(points)},'tool':f'fontTools {fontTools.__version__}','networkRequests':0,'globalInstalls':0,'originals':originals,'selectedFonts':chosen,'licenses':licenses,'limitations':['Fixed UI/sample copy only; arbitrary user input uses system Chinese fallback.','Exact typeface in generated reference is unknown; these are same official font families previously selected for Trace.','cmap coverage does not prove shaping, browser loading or composed readability.'],'validation':{'cmap':'pass','sourceIntegrity':'pass','attribution':'pass','browser':'not run'},'history':['Initial full-subset preparation was interrupted before producing any font when root confirmed minimal delta strategy; no prior failed font promoted as ready.']})

if __name__=='__main__': main()
