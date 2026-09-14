const {chromium}=require('C:/Users/HoSheil/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs=require('node:fs/promises'),path=require('node:path')
;(async()=>{
  const prefix=process.argv[2]||'first'
  const browser=await chromium.launch({headless:true,executablePath:'D:/AGeneral Workspace/xjch2026/wshuzhilv/.playwright-browsers/chromium-1234/chrome-win64/chrome.exe'})
  const report={startedAt:new Date().toISOString(),errors:[],requests:[],screens:[]}
  const context=await browser.newContext({viewport:{width:1672,height:941},reducedMotion:'reduce'})
  const page=await context.newPage();page.setDefaultTimeout(10000)
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});page.on('requestfailed',r=>report.requests.push({url:r.url(),error:r.failure()?.errorText}))
  async function shot(name,url){
    if(url!==undefined){await page.goto('http://127.0.0.1:4173/'+url);await page.locator('[data-route]').waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(700)}
    await page.screenshot({path:path.join(__dirname,`${prefix}-${name}.png`)})
    report.screens.push({name,url:page.url(),...(await page.evaluate(()=>({viewport:[innerWidth,innerHeight],route:document.querySelector('#app').dataset.route,mode:document.querySelector('.matters-shell')?.dataset.mode,fonts:[...document.fonts].map(f=>({family:f.family,status:f.status})),overflow:document.documentElement.scrollWidth>innerWidth,materials:[...document.querySelectorAll('[data-refraction]')].map(e=>e.dataset.refraction)})))})
  }
  try{
    await shot('home','')
    await shot('overview','?view=matters')
    await page.locator('[data-matter-id="collection"]').hover();await shot('hover')
    await shot('reentry','?view=matters&matter=collection&step=reentry')
    await shot('comparison','?view=matters&matter=collection&step=deep&tab=comparison')
    await shot('search','?view=matters&q='+encodeURIComponent('收藏 为什么接不回来'))
    await page.goto('http://127.0.0.1:4173/?view=matters&matter=collection&step=deep&tab=stop');await page.locator('.matters-draft').fill('还需验证，个人表达是不是接续的必要条件');await page.locator('.matters-draft').press('Enter');await page.waitForTimeout(500);await shot('returned-focus');await page.evaluate(()=>document.activeElement?.blur());await page.mouse.move(70,800);await page.waitForTimeout(5000);await shot('returned')
    await page.setViewportSize({width:880,height:620});await shot('880-overview','?view=matters');await shot('880-reentry','?view=matters&matter=collection&step=reentry');await shot('880-comparison','?view=matters&matter=collection&step=deep&tab=comparison')
    await page.setViewportSize({width:1672,height:941});await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('http://127.0.0.1:4173/?view=matters');await page.locator('[data-matter-id="collection"]').click();await page.waitForTimeout(200);await shot('opening')
  }finally{await browser.close();await fs.writeFile(path.join(__dirname,`${prefix}-render.json`),JSON.stringify(report,null,2),'utf8');console.log(JSON.stringify(report,null,2))}
})().catch(e=>{console.error(e);process.exitCode=1})
