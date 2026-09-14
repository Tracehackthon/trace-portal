// Explicit snapshot construction only. Writes only this worker's candidate manifest.
// Never edits, rebuilds, downloads or promotes source assets. verify-assets.mjs is read-only.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const outputDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(outputDir,'../../..');
const rel=p=>(path.isAbsolute(p)?path.relative(root,p):p).replaceAll('\\','/');
const read=p=>fs.readFileSync(path.resolve(root,p));
const json=p=>JSON.parse(read(p).toString('utf8').replace(/^\uFEFF/,''));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex').toUpperCase();
const snapshot=p=>{p=rel(p);const b=read(p);return {path:p,sha256:sha(b),bytes:b.length};};
const pkg='artifacts/trace-web-v1-integration-20260915/coordination/context-package.json';
const expectedPackage='918D75E6C80AAD8054B3F59B24810BED2CE261390AC4425CCA8E0481275C921E';
if(sha(read(pkg))!==expectedPackage)throw Error('Context package mismatch');
const cp=json(pkg),files=new Map(),assets=[];
function file(p,category='provenance-or-license'){p=rel(p);if(!files.has(p))files.set(p,{...snapshot(p),category});return p;}
const proof=p=>file(p);
file(pkg,'task-contract');file('artifacts/trace-web-v1-integration-20260915/coordination/CONTRACT.md','task-contract');
for(const b of cp.baselines.filter(b=>/\\(images|fonts)\\(manifest.json|ASSET-NOTES.md|FONT-USAGE.md)$/.test(b.path))){
  if(snapshot(b.path).sha256!==b.sha256.toUpperCase())throw Error(`Baseline drift: ${b.path}`);proof(b.path);
}
function authority(manifest,assetPath){
  const s=snapshot(assetPath),found=[];
  function visit(v,pointer=''){
    if(!v||typeof v!=='object')return;
    if(typeof v.sha256==='string'&&v.sha256.toUpperCase()===s.sha256&&typeof v.path==='string'){
      const p=rel(v.path);if(s.path===p||s.path.endsWith('/'+p))found.push(pointer);
    }
    for(const [k,c] of Object.entries(v))visit(c,pointer+'/'+k.replaceAll('~','~0').replaceAll('/','~1'));
  }
  visit(json(manifest));if(!found.length)throw Error(`No authoritative asset record: ${assetPath}`);
  return {manifest:proof(manifest),jsonPointer:found[0],declaredSha256:s.sha256};
}
function add(a){
  const s=snapshot(a.sourcePath);file(a.sourcePath,a.lifecycle);
  a={...a,sha256:s.sha256,bytes:s.bytes,status:'freeze-candidate-not-published',selectionBasis:'Effective delivery record and SHA256, never mtime.'};
  a.license.entries=a.license.entries.map(proof);assets.push(a);return a;
}
function png(p){const b=read(p);if(b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Invalid PNG');return {width:b.readUInt32BE(16),height:b.readUInt32BE(20),bitDepth:b[24],colorType:b[25]};}
const groups=[['home','trace-home-v1-20260914','Home'],['matters','trace-matters-v1-20260915','Matters'],['chain','trace-one-thing-v1-20260915','Chain'],['worksite','trace-worksite-v1-20260915','Worksite'],['compare','trace-compare-v1-20260915','Compare']];
const home='artifacts/trace-home-v1-20260914',src='trace-runtime/apps/desktop/src',pub='trace-runtime/apps/desktop/public';
const usage=paths=>({usedAtSnapshot:paths.length>0,evidenceLevel:'local source reference plus packaged byte equality; not new browser proof',paths:paths.map(p=>file(p,'app-packaged-copy'))});
const backgrounds=[
 ['home',groups[0][1],'home-environment.png','A-home-environment.png',['home:all'],'首页玉青玻璃山水；保留大球和前景两小球'],
 ['matters',groups[1][1],'matters-environment.png','A-matters-environment.png',['matters:all'],'森林、岩石、湖景；不能改用首页波峰'],
 ['chain.inner',groups[2][1],'chain-environment.png','inner-environment-generated-v1.png',['chain:02','chain:03','chain:04','chain:05','chain:07','chain:08','chain:10','chain:11'],'低丘、开阔水面、贴右月球、近景竹叶；01/09 的 Trace 承接面按需采样'],
 ['chain.overview',groups[2][1],'chain-overview-environment.png','overview-environment-generated-v1.png',['chain:06'],'收回总览：画内月球、横向丘陵、无近景竹叶'],
 ['worksite',groups[3][1],'worksite-environment.png','worksite-environment-generated-v1.png',['worksite:all'],'高留白工作现场，两侧低山与珍珠水面'],
 ['compare',groups[4][1],'compare-environment.png','compare-environment-generated-v1.png',['compare:all'],'近纸白水墨周边，03/04 阅读面不能套首页强滤镜'],
];
for(const [key,id,name,original,pages,purpose] of backgrounds){
 const base=`artifacts/${id}/images`,sourcePath=`${base}/ready/${name}`;
 add({key:`environment.${key}`,kind:'scene-background',sourcePath,lifecycle:'final-ready',pages,purpose,format:png(sourcePath),originalPaths:[file(`${base}/originals/${original}`,'generated-original')],transformation:'byte-identical copy of generated original; no image processing this task',authority:authority(`${base}/manifest.json`,sourcePath),license:{type:'project-generated-provenance-not-OSS-license',entries:[`${base}/ASSET-NOTES.md`,`${base}/manifest.json`],note:'保留既有生成来源；不杜撰图片 MIT/OFL 许可，不声称恢复隐藏原始像素。'},currentAppUsage:usage(['home','matters'].includes(key)?[`${pub}/${key}/environment.png`]:[])});
}
for(const [pose,original,anchor] of [['perched','B2-bird-perched-alpha-retry.png',[772,588]],['takeoff','C-bird-takeoff.png',[750,955]]]){
 const sourcePath=`${home}/images/repaired/bird-${pose}.png`;
 add({key:`bird.${pose}`,kind:'shared-bird-pose',sourcePath,lifecycle:'final-authorized-repair',pages:groups.map(g=>g[0]),purpose:`唯一共享鸟身份：${pose} 静态姿态`,format:png(sourcePath),footAnchor:anchor,scaleRule:'same source-pixel scale, not equal CSS width',originalPaths:[file(`${home}/images/originals/${original}`,'failed-transparent-bird-original')],transformation:'historical authorized alpha repair; no rerun or new editing',authority:authority(`${home}/images/manifest.json`,sourcePath),license:{type:'project-generated-authorized-repair-provenance-not-OSS-license',entries:[`${home}/images/ASSET-NOTES.md`,`${home}/images/repaired/repair-manifest.json`],note:'两静态姿态不是自然振翅；高倍下 1–2 源像素羽缘有修复估计。'},currentAppUsage:usage([`${pub}/home/bird-${pose}.png`])});
}
for(const f of json(`${home}/fonts/manifest.json`).originals){
 const role=f.id==='noto-sans-sc'?'sans':'serif',sourcePath=`${home}/fonts/${f.path}`;
 add({key:`font.original.${role}`,kind:'original-variable-font',sourcePath,lifecycle:'official-original',pages:groups.map(g=>g[0]),purpose:role==='sans'?'UI/黑体角色原件，动态中文完整 fallback 候选':'标题/引文/宋体角色原件，动态中文完整 fallback 候选',family:f.typographic_family_names?.[0]||f.family_names[0],axes:f.axes,upstream:{repository:f.repository,commit:f.upstream_commit,url:f.source_url,gitBlobSha1:f.git_blob_sha1,version:f.version_strings},originalPaths:[],transformation:'none; pinned official original',authority:authority(`${home}/fonts/manifest.json`,sourcePath),license:{type:'OFL-1.1',entries:[`${home}/fonts/originals/${role==='sans'?'noto-sans-sc/OFL.txt':'source-han-serif-cn/LICENSE.txt'}`,`${home}/fonts/FONT-USAGE.md`],reservedFontNames:f.reserved_font_names},currentAppUsage:usage([])});
}
for(const [page,id,name] of groups){
 const base=`artifacts/${id}/fonts`;
 for(const f of json(`${base}/manifest.json`).derived){
  const role=f.path.includes('Sans')?'sans':'serif',sourcePath=rel(`${base}/${f.path}`),original=assets.find(a=>a.key===`font.original.${role}`);
  add({key:`font.fixed.${page}.${role}`,kind:'page-fixed-copy-subset',sourcePath,lifecycle:'final-derived',pages:[page],purpose:page==='compare'?(role==='sans'?'主标题 Sans 700、UI/正文及修订后理解':'原表达、材料摘录及前后理解 Serif 引文'):(role==='sans'?'UI、输入、按钮、说明、元信息':'标题、节标题和该页指定的引文层次'),family:(f.family_names||f.family)[0],axes:f.axes,requiredCodepoints:f.required_codepoint_count||f.required_codepoints||f.requiredCodepoints,coverageEvidence:'Fixed-copy only; current cmap is independently inspected by audit-font-cmap.py; arbitrary dynamic Unicode not covered.',originalPaths:[original.sourcePath],transformation:'fixed-copy subset, WOFF2 encoding, renamed Trace family/PS/instances; upstream attribution preserved',authority:authority(`${base}/manifest.json`,sourcePath),license:{type:'OFL-1.1',entries:[`${base}/derived/OFL-${role==='sans'?'noto-sans-sc':'source-han-serif-cn'}.txt`,`${base}/FONT-USAGE.md`],reservedFontNames:['Source']},currentAppUsage:usage(['home','matters'].includes(page)?[`${pub}/${page}/fonts/Trace${name}${role==='sans'?'Sans':'Serif'}-fixed.woff2`]:[])});
 }
}
const cmp=`${home}/components`,cm=json(`${cmp}/manifest.json`);
for(const [key,p,licensePath,appPath,id] of [
 ['animation.anime','originals/animejs/dist/bundles/anime.esm.min.js','originals/animejs/LICENSE.md',`${src}/vendor/anime.esm.js`,'animejs'],
 ['material.glass-shape','derived/liquidglassjs/shape-only.mjs','derived/liquidglassjs/LICENSE',`${src}/vendor/shape-only.mjs`,'liquidglassjs'],
]){
 const c=cm.components.find(c=>c.id===id),sourcePath=`${cmp}/${p}`;
 add({key,kind:'existing-runtime-vendor',sourcePath,lifecycle:key.startsWith('animation')?'official-original':'final-derived',pages:groups.map(g=>g[0]),purpose:key.startsWith('animation')?'现用 Anime 服务，app 文件名虽无 min 但实际为上游压缩版':'既有 shape-only bundle，经 mountSceneGlass 注入，小面可用、大面降级',originalPaths:[],transformation:key.startsWith('animation')?'none; upstream minified ESM byte copy, not unminified file':'existing offline shape-only bundle; no rebuild',authority:authority(`${cmp}/manifest.json`,sourcePath),upstream:{repository:c.repo,commit:c.commit,version:c.version},license:{type:'MIT',entries:[`${cmp}/${licensePath}`,`${cmp}/INTEGRATION.md`]},currentAppUsage:usage([appPath])});
}
function walk(d){return fs.readdirSync(path.resolve(root,d),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[rel(path.join(d,e.name))]);}
for(const [page,id] of groups){
 const base=`artifacts/${id}`,ctx=`${base}/coordination/context-package.json`,refs=[];proof(ctx);
 function visit(v){if(!v||typeof v!=='object')return;if(typeof v.path==='string'&&v.path.includes('manunl')&&v.sha256){const p=rel(v.path);if(p.startsWith('manunl/具体页面与视觉实现/桌面端/')){if(snapshot(p).sha256!==v.sha256.toUpperCase())throw Error(`Reference drift: ${p}`);refs.push(file(p,p.endsWith('.png')?'visual-reference-original':'reference-metadata'));}}for(const c of Object.values(v))visit(c);}
 visit(json(ctx));for(const a of assets.filter(a=>a.kind==='scene-background'&&a.pages.some(p=>p.startsWith(page+':'))))a.visualReferencePaths=refs;
 for(const p of walk(base).filter(p=>/\.(png|woff2|ttf)$/i.test(p))){
  if(files.has(p))continue;
  const category=p.includes('/fonts/candidates/')||p.includes('/fonts/history/')?'superseded-font-subset':p.includes('/fonts/originals/')?'official-original-byte-copy':p.includes('/images/ready/')?'ready-byte-copy':p.includes('/images/originals/')?'failed-transparent-bird-original':p.includes('/images/repaired/')?(p.includes('/debug-')?'rejected-repair-diagnostic':'repair-proof-not-runtime-asset'):'test-screenshot-not-runtime-asset';
  file(p,category);
 }
 for(const p of walk(`${base}/fonts`).filter(p=>/OFL[^/]*\.txt$|\/LICENSE\.txt$|\/font-face[^/]*\.css$/.test(p)))proof(p);
}
for(const p of [`${cmp}/REFERENCE-ONLY.md`,`${cmp}/originals/codrops-shape-morph-reference-only/README.md`,`${cmp}/originals/magicui-animated-beam/LICENSE.md`,`${pub}/home/licenses/anime-LICENSE.md`,`${pub}/home/licenses/liquidglass-LICENSE.txt`,`${pub}/home/licenses/magicui-LICENSE.md`,`${pub}/home/licenses/OFL-noto-sans-sc.txt`,`${pub}/home/licenses/OFL-source-han-serif-cn.txt`,`${pub}/matters/licenses/OFL-noto-sans-sc.txt`,`${pub}/matters/licenses/OFL-source-han-serif-cn.txt`])proof(p);
const implementationPaths=[`${src}/home-icons.js`,`${src}/home/scene-glass.js`,`${src}/home.css`,`${src}/home.js`,`${src}/main.js`,`${src}/matters/matters.css`,`${src}/matters/matters-screen.mjs`,'artifacts/trace-one-thing-v1-20260915/ui/chain-screen.mjs','artifacts/trace-one-thing-v1-20260915/ui/chain-helpers.mjs','artifacts/trace-one-thing-v1-20260915/ui/chain.css','artifacts/trace-worksite-v1-20260915/ui/worksite-screen.mjs','artifacts/trace-worksite-v1-20260915/ui/worksite-icons.mjs','artifacts/trace-worksite-v1-20260915/ui/worksite.css','artifacts/trace-compare-v1-20260915/ui/comparison-screen.mjs','artifacts/trace-compare-v1-20260915/ui/comparison.css'];
const byHash=new Map();for(const f of files.values()){if(!byHash.has(f.sha256))byHash.set(f.sha256,[]);byHash.get(f.sha256).push(f.path);}
const sameByteGroups=[];
for(const a of assets){
 a.byteIdenticalPaths=(byHash.get(a.sha256)||[]).filter(p=>p!==a.sourcePath);
 if(a.byteIdenticalPaths.length)sameByteGroups.push({key:a.key,sha256:a.sha256,paths:[a.sourcePath,...a.byteIdenticalPaths]});
 for(const p of a.currentAppUsage.paths)if(snapshot(p).sha256!==a.sha256)throw Error(`App copy mismatch: ${p}`);
}
const manifest={schemaVersion:1,task:cp.task,status:'candidate-not-published',createdAt:new Date().toISOString(),workspaceRelativeRoot:'../../..',baseline:{head:cp.head,contextPackage:{path:pkg,sha256:expectedPackage},contractSha256:cp.contractSha256},scope:{owner:'web_asset_freeze',writesOnly:rel(outputDir),selectionPolicy:'Existing effective delivery candidates only. Never silently replace bytes, scene semantics or provenance. Publishing is a separate root/user decision.',noImageGeneration:true,noDownloads:true,noFontEdits:true,sourceOfTruth:'Page-specific original references, effective delivery notes, current bytes; never mtime.'},assets,files:[...files.values()].sort((a,b)=>a.path.localeCompare(b.path)),sameByteGroups,implementationSnapshots:implementationPaths.map(p=>({...snapshot(p),policy:p.startsWith('trace-runtime/')?'observe-only-root-may-integrate':'immutable-existing-module'})),exclusionPolicy:{'visual-reference-original':'原始视觉参考，不可当成整页运行资源','generated-original':'原始生成备份，ready 同字节；不移动/覆盖','failed-transparent-bird-original':'含真实棋盘格的 RGB 鸟，不能接入','superseded-font-subset':'旧 603/640 子集，不能覆盖最终 derived','test-screenshot-not-runtime-asset':'first/final/verified/acceptance/proof 只证明当时对应版本；不可当背景','repair-proof-not-runtime-asset':'alpha/full/深绿灰底检查图，不替代最终裁后 RGBA','rejected-repair-diagnostic':'中间/失败诊断，不提升为 ready'},validationLimits:['Hash/path/provenance checks only, not business or visual acceptance.','Current-app use is a dated static source and byte observation, not fresh browser proof.','No dynamic Unicode, font shaping, accessibility-device, desktop package or performance acceptance.','App implementation snapshots are observe-only because root owns integration.']};
fs.writeFileSync(path.join(outputDir,'approved-assets.candidate.json'),JSON.stringify(manifest,null,2)+'\n','utf8');
console.log(JSON.stringify({assets:assets.length,files:files.size,sameByteGroups:sameByteGroups.length,categories:[...files.values()].reduce((o,f)=>(o[f.category]=(o[f.category]||0)+1,o),{})},null,2));
