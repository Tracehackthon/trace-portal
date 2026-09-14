/** Isolated font-only fixture. No app/4173/user-browser interaction. */
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('C:/Users/HoSheil/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=__dirname;
const workspace=path.resolve(root,'../../..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'fonts/manifest.json'),'utf8'));
const copy=JSON.parse(fs.readFileSync(path.join(root,'../ui/copy.json'),'utf8'));
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const routes=new Map();
let css='';
for(const item of manifest.selectedFonts){
  const kind=item.role==='serifDeltaUrl'?'Serif':'Sans';
  const min=kind==='Serif'?250:100;
  for(const [suffix,file,family] of [['base',item.base.path,`Trace Result Return ${kind}`],['delta',item.path,`Trace Result Return ${kind} Delta`]]){
    const url=`/${kind}-${suffix}.woff2`;routes.set(url,path.join(workspace,file));
    css+=`@font-face{font-family:'${family}';src:url('${url}') format('woff2');font-weight:${min} 900;font-display:swap;}`;
  }
}
const delta=manifest.selectedFonts[0].deltaCharacters;
const html=`<!doctype html><meta charset="utf-8"><title>Trace result return font coverage proof</title><style>${css}
*{box-sizing:border-box}body{margin:0;padding:45px;background:#f7f9f7;color:#143c35}h1{margin:8px 0 18px;font-size:48px;line-height:1.35}.serif{font-family:'Trace Result Return Serif Delta','Trace Result Return Serif',serif}.sans{font-family:'Trace Result Return Sans Delta','Trace Result Return Sans',sans-serif}section{background:#fff;border:1px solid #c5d4ce;padding:22px;margin:18px 0}p{font-size:23px;line-height:1.65;margin:10px 0}small{font:15px sans-serif;color:#5e736b}.probe{font-size:27px;font-weight:550}.sample{font-size:22px}</style>
<small>字体独立加载与字形来源检查 · 不是最终 UI 验收</small><h1 class="serif">结果回来 · 只改这一次分清的地方</h1>
<section><small>Base: 已有 Chain 字体 · Glyph source probe</small><p id="base-serif" class="serif probe">结果回来，原来的理解。</p><p id="base-sans" class="sans probe">结果回来，原来的理解。</p></section>
<section><small>Delta: ${delta.length} 个追加字形 · Same upstream font families</small><p id="delta-serif" class="serif probe">${escape(delta)}</p><p id="delta-sans" class="sans probe">${escape(delta)}</p></section>
<section><p class="serif sample">${escape(copy.demo[11])}</p><p class="sans sample">${escape(copy.revision.join(' · '))}</p></section>`;
async function main(){
  let browser;const errors=[];const responses=[];
  const server=http.createServer((req,res)=>{
    if(req.url==='/'){res.writeHead(200,{'content-type':'text/html;charset=utf-8'});res.end(html);return;}
    if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}
    if(routes.has(req.url)){res.writeHead(200,{'content-type':'font/woff2'});fs.createReadStream(routes.get(req.url)).pipe(res);return;}
    res.writeHead(404);res.end();
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  try{
    browser=await chromium.launch({executablePath:'D:/AGeneral Workspace/xjch2026/wshuzhilv/.playwright-browsers/chromium-1234/chrome-win64/chrome.exe',headless:true});
    const page=await browser.newPage({viewport:{width:1450,height:1120},deviceScaleFactor:1,reducedMotion:'reduce'});
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)responses.push({url:r.url(),status:r.status()});});
    await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'networkidle'});
    await page.evaluate(()=>document.fonts.ready);
    const fontFaces=await page.evaluate(()=>[...document.fonts].map(f=>({family:f.family,status:f.status,weight:f.weight})));
    const cdp=await page.context().newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');
    const {root:doc}=await cdp.send('DOM.getDocument');const probes={};
    for(const id of ['base-serif','base-sans','delta-serif','delta-sans']){
      const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:doc.nodeId,selector:'#'+id});
      probes[id]=(await cdp.send('CSS.getPlatformFontsForNode',{nodeId})).fonts;
    }
    const expected={ 'base-serif':'TraceChainSerif','base-sans':'TraceChainSans','delta-serif':'TraceResultReturnSerifDelta','delta-sans':'TraceResultReturnSansDelta'};
    const results=Object.entries(probes).map(([id,fonts])=>({id,pass:fonts.length===1 && fonts[0].isCustomFont && fonts[0].postScriptName.startsWith(expected[id]),fonts}));
    const pass=results.every(r=>r.pass)&&fontFaces.length===4&&fontFaces.every(f=>f.status==='loaded')&&errors.length===0&&responses.length===0;
    await page.screenshot({path:path.join(root,'fonts/font-proof.png'),fullPage:true});
    fs.writeFileSync(path.join(root,'fonts/browser-check.json'),JSON.stringify({taskId:manifest.taskId,copySha256:manifest.copy.sha256,fontHashes:manifest.selectedFonts.map(f=>({delta:f.sha256,base:f.base.sha256})),pass,isolatedPort:port,fixture:'font-only; local dynamic port; own headless browser',fontFaces,probes:results,errors,responses,limits:['Not final UI or app integration.','Only fixed corpus coverage is checked separately by cmap script.','Does not guarantee arbitrary dynamic text or all browsers.']},null,2)+'\n');
    if(!pass)throw new Error('Font browser proof failed; see browser-check.json');
    manifest.validation.browser='pass: isolated font fixture, 4 loaded faces and 4 CDP glyph-source probes; browser-check.json';
    fs.writeFileSync(path.join(root,'fonts/manifest.json'),JSON.stringify(manifest,null,2)+'\n');
    console.log('PASS: 4 fonts loaded, 4 CDP glyph-source checks, no console/page/network errors');
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1});
