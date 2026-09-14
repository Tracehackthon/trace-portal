const { chromium } = require('C:/Users/HoSheil/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs/promises')
const path = require('node:path')
;(async()=>{
  const out=__dirname
  const prefix=process.argv[2]||'first'
  const browser=await chromium.launch({headless:true,executablePath:'D:/AGeneral Workspace/xjch2026/wshuzhilv/.playwright-browsers/chromium-1234/chrome-win64/chrome.exe'})
  const ctx=await browser.newContext({viewport:{width:1672,height:941},deviceScaleFactor:1,reducedMotion:'reduce'})
  const page=await ctx.newPage(),errors=[],responses=[]
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('response',r=>{if(r.status()>=400)responses.push({url:r.url(),status:r.status()})})
  const summaries=[]
  try{
    for(const state of ['overview','thinking','growth','work','return']){
      await page.goto('http://127.0.0.1:4173/?state='+state,{waitUntil:'networkidle'})
      await page.evaluate(()=>document.fonts.ready)
      await page.waitForTimeout(450)
      await page.screenshot({path:path.join(out,`${prefix}-${state}.png`)})
      summaries.push({state,...await page.evaluate(()=>({scene:document.querySelector('.scene')?.dataset.state,visibleCards:[...document.querySelectorAll('[data-entry]')].filter(e=>!e.hidden).map(e=>e.dataset.entry),font:document.fonts.check('600 68px "Trace Home Serif"'),glass:[...document.querySelectorAll('[data-refraction]')].map(e=>e.dataset.refraction),overflow:[...document.querySelectorAll('.detail-card h2,.context-row p,.bubble-copy strong')].filter(e=>e.offsetWidth&&e.scrollWidth>e.clientWidth+1).map(e=>e.textContent)}))})
    }
    await page.setViewportSize({width:1440,height:900});await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});await page.screenshot({path:path.join(out,`${prefix}-1440.png`)})
    await page.setViewportSize({width:880,height:620});await page.goto('http://127.0.0.1:4173/?state=thinking',{waitUntil:'networkidle'});await page.screenshot({path:path.join(out,`${prefix}-880.png`)})
  }finally{await fs.writeFile(path.join(out,`${prefix}-render.json`),JSON.stringify({summaries,errors,responses},null,2));await browser.close()}
  console.log(JSON.stringify({summaries,errors,responses},null,2))
})().catch(e=>{console.error(e);process.exitCode=1})
