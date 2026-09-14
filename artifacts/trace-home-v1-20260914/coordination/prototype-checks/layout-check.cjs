const { chromium }=require('C:/Users/HoSheil/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs=require('node:fs/promises'),path=require('node:path')
;(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'D:/AGeneral Workspace/xjch2026/wshuzhilv/.playwright-browsers/chromium-1234/chrome-win64/chrome.exe'})
  const results=[]
  try {
    for(const [width,height] of [[1672,941],[1440,900],[880,620]]) {
      const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'})
      for(const mode of ['overview','thinking','growth','work','return']) {
        await page.goto(`http://127.0.0.1:4173/?state=${mode}`)
        await page.locator('#home-scene').waitFor();await page.evaluate(()=>document.fonts.ready)
        const data=await page.evaluate(()=>({
          horizontalOverflow:[...document.querySelectorAll('[data-entry]:not([hidden]) strong')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent),
          detail:(()=>{const e=document.querySelector('.detail-context');return e&&!e.closest('[hidden]')?{height:e.clientHeight,scrollHeight:e.scrollHeight}:null})(),
          documentOverflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight
        }))
        results.push({width,height,mode,...data})
      }
      await page.close()
    }
  } finally { await browser.close() }
  const report={checkedAt:new Date().toISOString(),results,limits:['Small viewport uses a scaled desktop scene, not a mobile redesign. Long user text may scroll in detail; fixed card labels may ellipsize where recorded.']}
  await fs.writeFile(path.join(__dirname,'layout-check.json'),JSON.stringify(report,null,2),'utf8')
  console.log(JSON.stringify(report,null,2))
})().catch(e=>{console.error(e);process.exitCode=1})
