// Isolated file:// font-loading check. No app / profile / network use.
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('C:/Users/HoSheil/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const crypto = require('node:crypto');
const root = __dirname;
const hash = name => crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex');
const samples = ['实现「从知乎留下一点」','附言可选，不阻挡保存','保存很轻，但回来时可能认不出当时为什么在意。','修改前 · 修改后 · 仅在你确认后更新「我的理解」。','这次参考　这次先试　这次不用　只留下结果','Trace / Codex · harness　0123456789'];
const escape = text => text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>工作现场字体独立检查</title><link rel="stylesheet" href="./derived/font-face.css"><style>
body{margin:0;padding:36px;background:#f4f8f5;color:#102a26;font:16px system-ui}section{margin:28px 0;border-top:1px solid #d5e3df;padding-top:15px}h1{font:20px system-ui}p{margin:12px 0;line-height:1.45}.serif{font-family:'Trace Worksite Serif',SimSun,serif;font-weight:600;font-size:31px}.sans{font-family:'Trace Worksite Sans','Microsoft YaHei',sans-serif;font-weight:400;font-size:23px}
</style><h1>工作现场字体 · 独立 file:// 检查（不是 app 验收）</h1><section class="serif">${samples.map(t=>`<p>${escape(t)}</p>`).join('')}</section><section class="sans">${samples.map(t=>`<p>${escape(t)}</p>`).join('')}</section></html>`;
fs.writeFileSync(path.join(root,'font-check.html'), html, 'utf8');
(async()=>{
  const browser = await chromium.launch({headless:true,executablePath:'D:/AGeneral Workspace/xjch2026/wshuzhilv/.playwright-browsers/chromium-1234/chrome-win64/chrome.exe'});
  const page = await browser.newPage({viewport:{width:1260,height:1020},deviceScaleFactor:1});
  const errors=[],requests=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text())});
  page.on('request',request=>requests.push(request.url()));
  await page.route(/^https?:/,route=>route.abort());
  try {
    await page.goto(pathToFileURL(path.join(root,'font-check.html')).href);
    const result=await page.evaluate(async()=>{
      const text='实现从知乎留下一点修改确认';
      await document.fonts.load('600 31px "Trace Worksite Serif"',text);
      await document.fonts.load('400 23px "Trace Worksite Sans"',text);
      await document.fonts.ready;
      return {faces:[...document.fonts].map(f=>({family:f.family,status:f.status,weight:f.weight})),serif:document.fonts.check('600 31px "Trace Worksite Serif"',text),sans:document.fonts.check('400 23px "Trace Worksite Sans"',text)};
    });
    if (!result.serif || !result.sans || result.faces.length!==2 || result.faces.some(f=>f.status!=='loaded') || errors.length) throw new Error(JSON.stringify({result,errors}));
    await page.screenshot({path:path.join(root,'font-check.png'),fullPage:true});
    const output={checkedAt:new Date().toISOString(),scope:'Isolated font sample on file://, not worksite UI or native integration',url:page.url(),...result,errors,requests,fontHashes:{serif:hash('derived/TraceWorksiteSerif-fixed.woff2'),sans:hash('derived/TraceWorksiteSans-fixed.woff2')},screenshot:'font-check.png'};
    fs.writeFileSync(path.join(root,'browser-check.json'),JSON.stringify(output,null,2)+'\n');
    const manifestPath=path.join(root,'manifest.json');
    const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
    manifest.validation.file_protocol_loading='passed isolated Chromium font sample; see browser-check.json for exact font hashes';
    manifest.validation.browser_shaping='sample rendered, not exhaustive shaping or app line-wrap acceptance';
    manifest.validation.visual_typography_acceptance='requires human/model inspection of font-check.png; not app acceptance';
    fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
    console.log(JSON.stringify({passed:true,faces:result.faces,errors,externalRequests:requests.filter(u=>/^https?:/.test(u)).length}));
  } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
