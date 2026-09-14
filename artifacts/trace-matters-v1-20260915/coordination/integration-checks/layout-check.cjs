const {chromium}=require('C:/Users/HoSheil/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict')
;(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'D:/AGeneral Workspace/xjch2026/wshuzhilv/.playwright-browsers/chromium-1234/chrome-win64/chrome.exe'})
 const page=await browser.newPage({viewport:{width:1672,height:941},reducedMotion:'reduce'}),report={cases:[],errors:[]}
 page.on('pageerror',e=>report.errors.push(e.message))
 const load=async q=>{await page.goto('http://127.0.0.1:4173/?view=matters&'+q);await page.locator('.matters-shell').waitFor();await page.evaluate(()=>document.fonts.ready)}
 try{
  await load('matter=collection&step=deep&tab=comparison')
  const normal=await page.evaluate(()=>{const body=document.querySelector('.matters-deep-content').getBoundingClientRect(),footer=document.querySelector('.matters-deep-footer').getBoundingClientRect();return [...document.querySelectorAll('.matters-comparison-column p')].map(p=>({text:p.textContent,clientHeight:p.clientHeight,scrollHeight:p.scrollHeight,bottom:p.getBoundingClientRect().bottom,bodyBottom:body.bottom,footerTop:footer.top}))})
  assert.ok(normal.every(p=>p.scrollHeight<=p.clientHeight+1&&p.bottom<=p.bodyBottom+1&&p.bottom<=p.footerTop));report.cases.push({id:'reference-default-comparison-complete',status:'passed',normal})
  await page.setViewportSize({width:880,height:620})
  await load('matter=collection&step=deep&tab=comparison')
  const compact=await page.evaluate(()=>[...document.querySelectorAll('.matters-comparison-column p')].map(p=>{const before=p.scrollTop;p.scrollTop=p.scrollHeight;return {height:p.clientHeight,lineHeight:parseFloat(getComputedStyle(p).lineHeight),scrollHeight:p.scrollHeight,scrolled:p.scrollTop>before}}))
  assert.ok(compact.every(p=>Math.abs(p.height-p.lineHeight)<2&&p.scrolled));report.cases.push({id:'compact-column-full-line-and-scroll',status:'passed',compact})
  await load('matter=collection&step=reentry')
  const lobes=await page.evaluate(()=>[...document.querySelectorAll('.matters-lobe')].map(l=>{const p=l.querySelector('p'),a=l.querySelector('button'),r=l.getBoundingClientRect();return {name:l.className,height:p.clientHeight,line:parseFloat(getComputedStyle(p).lineHeight),sourceVisible:!a||a.getBoundingClientRect().bottom<=r.bottom+1}}))
  assert.ok(lobes.every(p=>p.sourceVisible&&Math.abs(p.height/p.line-Math.round(p.height/p.line))<.04));report.cases.push({id:'compact-lobes-whole-lines-fixed-links',status:'passed',lobes})
  await page.setViewportSize({width:1672,height:941});await load('matter=collection&step=deep&tab=stop')
  await page.locator('.matters-draft').fill('还需验证，个人表达是不是接续的必要条件');await page.locator('.matters-draft').press('Enter');await page.locator('.matters-branch-title').waitFor()
  const branch=await page.evaluate(()=>{const t=document.querySelector('.matters-branch-title'),s=document.querySelector('.matters-branch-subtitle'),b=document.querySelector('.matters-branch'),f=document.querySelector('[data-matter-id="fresh"]');const tr=t.getBoundingClientRect(),sr=s.getBoundingClientRect(),br=b.getBoundingClientRect(),fr=f.getBoundingClientRect();return {titleHeight:tr.height,lineHeight:parseFloat(getComputedStyle(t).lineHeight),titleBottom:tr.bottom,subtitleTop:sr.top,separated:br.right<=fr.left||br.left>=fr.right||br.top>=fr.bottom||br.bottom<=fr.top}})
  assert.ok(Math.abs(branch.titleHeight/branch.lineHeight-2)<.05&&branch.titleBottom<=branch.subtitleTop&&branch.separated);report.cases.push({id:'branch-two-complete-lines-no-overlap',status:'passed',branch})
 }catch(e){report.error=e.stack;process.exitCode=1}finally{await browser.close();await fs.writeFile(path.join(__dirname,'layout-check.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))}
})()
