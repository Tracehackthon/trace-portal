// Read-only baseline observation. A new isolated browser context owns only its own in-memory inputs.
const {chromium}=require('C:/Users/HoSheil/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base=process.env.TRACE_EXPERIENCE_URL||'http://127.0.0.1:4173/';
const report={task:'trace-web-v1-integration-20260915',head:'2f4377864aa353dcecb3f60005d884b11486c84e',contextPackageSha256:'918D75E6C80AAD8054B3F59B24810BED2CE261390AC4425CCA8E0481275C921E',base,startedAt:new Date().toISOString(),observations:[],pageErrors:[],consoleErrors:[]};
const expected='F4E70518980645CBE9723035B5A34CB9A796B6E01C5BC8CB2EC5BE94BD0DD85A';
(async()=>{
  const served=await fetch(new URL('src/main.js',base));
  report.servedMainSha256=crypto.createHash('sha256').update(Buffer.from(await served.arrayBuffer())).digest('hex').toUpperCase();
  if(report.servedMainSha256!==expected)throw new Error('Served main.js differs from assigned baseline; do not diagnose a moving target.');
  const browser=await chromium.launch({headless:true,executablePath:'D:/AGeneral Workspace/xjch2026/wshuzhilv/.playwright-browsers/chromium-1234/chrome-win64/chrome.exe'});
  try {
    const context=await browser.newContext({viewport:{width:1672,height:941},reducedMotion:'reduce'});
    const page=await context.newPage();
    page.on('pageerror',e=>report.pageErrors.push(String(e)));
    page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text())});
    await page.goto(new URL('?view=home',base).href);
    const input='体验核验 20260915：按钮越少，第一次填写就越容易吗？';
    await page.locator('#capture-input').fill(input);
    await page.locator('#capture-form [type=submit]').click();
    await page.waitForURL('**/*matter=capture-1*');
    await page.locator('.matters-reentry-primary').waitFor();
    report.captureUrl=page.url();
    report.observations.push({id:'new-input-route',url:page.url(),route:await page.locator('#app').getAttribute('data-route'),originalTextVisible:(await page.locator('body').innerText()).includes(input)});
    await page.screenshot({path:path.join(__dirname,'baseline-new-input.png')});
    await page.getByRole('button',{name:'搜索',exact:true}).click();
    await page.getByRole('searchbox').fill('体验核验 20260915');
    await page.locator('.matters-search-quote').waitFor();
    report.searchUrl=page.url();
    await page.locator('.matters-search-quote').first().click();
    await page.getByRole('button',{name:'回到这件事',exact:true}).click();
    await page.keyboard.press('Escape');
    report.observations.push({id:'quote-ui-back',url:page.url(),query:await page.getByRole('searchbox').inputValue(),searchResultsVisible:await page.locator('.matters-search-results').count()});
    await page.screenshot({path:path.join(__dirname,'baseline-search-return.png')});
    const beforeAll=page.url();
    await page.getByRole('button',{name:'全部痕迹',exact:true}).click();
    report.observations.push({id:'all-traces',beforeUrl:beforeAll,afterUrl:page.url(),heading:await page.locator('h1').innerText(),traceIndexCount:await page.locator('.matters-search-results').count()});
    await page.getByRole('button',{name:'Trace，返回首页',exact:true}).click();
    await page.locator('[data-action=about]').click();
    report.observations.push({id:'profile',title:await page.locator('#utility-title').innerText(),content:await page.locator('#utility-panel').innerText()});
    await page.goto(report.captureUrl);
    await page.locator('.matters-hero').waitFor();
    report.observations.push({id:'reload-new-matter',url:page.url(),originalTextVisible:(await page.locator('body').innerText()).includes(input),unknownMatterWarning:/找不到|不存在|未找到/.test(await page.locator('body').innerText())});
    await page.screenshot({path:path.join(__dirname,'baseline-reload.png')});
    report.completed=true;
    await context.close();
  } finally {await browser.close();}
})().catch(error=>{report.error=String(error.stack||error);process.exitCode=1}).finally(()=>{
  report.finishedAt=new Date().toISOString();
  fs.writeFileSync(path.join(__dirname,'baseline-observations.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
});
