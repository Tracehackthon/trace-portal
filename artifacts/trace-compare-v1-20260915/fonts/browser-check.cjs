const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {createHash} = require('node:crypto');
const {chromium} = require('C:/Users/HoSheil/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const browser=await chromium.launch({headless:true,executablePath:'D:/AGeneral Workspace/xjch2026/wshuzhilv/.playwright-browsers/chromium-1234/chrome-win64/chrome.exe'});
  try {
    const page=await browser.newPage({viewport:{width:1220,height:890},deviceScaleFactor:1});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto(pathToFileURL(path.join(__dirname,'preview.html')).href);
    await page.evaluate(()=>document.fonts.ready);
    const proof=await page.evaluate(async()=>{
      await document.fonts.load('700 56px "Trace Compare Sans"','从这一处找');
      await document.fonts.load('600 32px "Trace Compare Serif"','收藏时必须留下自己的表达');
      return {fonts:[...document.fonts].map(f=>({family:f.family,status:f.status,weight:f.weight})),sansLoaded:document.fonts.check('700 56px "Trace Compare Sans"','从这一处找'),serifLoaded:document.fonts.check('600 32px "Trace Compare Serif"','收藏时必须留下自己的表达'),horizontalOverflow:document.documentElement.scrollWidth>innerWidth};
    });
    await page.screenshot({path:path.join(__dirname,'font-proof.png'),fullPage:true});
    const hash=file=>createHash('sha256').update(fs.readFileSync(path.join(__dirname,file))).digest('hex').toUpperCase();
    const result={taskId:'trace-compare-v1-20260915',protocol:'file:',isolatedHeadless:true,...proof,errors,screenshot:'font-proof.png',screenshotSha256:hash('font-proof.png'),fontHashes:{sans:hash('derived/TraceCompareSans-fixed.woff2'),serif:hash('derived/TraceCompareSerif-fixed.woff2')},scope:'Standalone font proof only; not comparison UI acceptance'};
    fs.writeFileSync(path.join(__dirname,'browser-check.json'),JSON.stringify(result,null,2)+'\n');
    if(errors.length || !proof.sansLoaded || !proof.serifLoaded || proof.horizontalOverflow)throw Error('Font browser proof failed');
    const manifestPath=path.join(__dirname,'manifest.json');
    const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
    manifest.validation.browser='passed isolated Chromium file:// proof; both exact local families loaded; zero console errors; no horizontal overflow';
    manifest.browserEvidence={path:'browser-check.json',sha256:hash('browser-check.json')};
    fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
    console.log(JSON.stringify(result,null,2));
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
