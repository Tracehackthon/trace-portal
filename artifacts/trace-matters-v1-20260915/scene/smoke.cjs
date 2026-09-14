// Isolated browser: local asset whitelist fulfilled in memory, no listener or user profile.
const { chromium } = require('C:/Users/HoSheil/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '../../..');
const mappings = {
  '/scene/': __dirname,
  '/model/': path.join(__dirname, '../model'),
  '/fonts/': path.join(__dirname, '../fonts/derived'),
  '/images/': path.join(__dirname, '../images/ready'),
  '/home/': path.join(ROOT, 'trace-runtime/apps/desktop/public/home'),
  '/vendor/': path.join(ROOT, 'trace-runtime/apps/desktop/src/vendor'),
  '/adapter/': path.join(ROOT, 'trace-runtime/apps/desktop/src/home'),
};
const mime = { '.mjs':'text/javascript', '.js':'text/javascript', '.css':'text/css', '.html':'text/html', '.png':'image/png', '.woff2':'font/woff2' };
(async () => {
  const report = { testKind:'isolated scene, no app routing or Electron/preload check', baseline:'2f4377864aa353dcecb3f60005d884b11486c84e', contextPackageSha256:'BDF5906EC3208A9C254499C5082E5E689971A7547BCC9A1A303BA5F28FA45068', tests:[], errors:[], requests:[], measurements:[] };
  const browser = await chromium.launch({headless:true, executablePath:process.env.TRACE_TEST_CHROMIUM || 'D:/AGeneral Workspace/xjch2026/wshuzhilv/.playwright-browsers/chromium-1234/chrome-win64/chrome.exe'});
  const context = await browser.newContext({viewport:{width:1672,height:941},deviceScaleFactor:1,reducedMotion:'reduce'});
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    const prefix = Object.keys(mappings).find(item=>url.pathname.startsWith(item));
    if (url.hostname !== 'scene.test' || !prefix) { report.requests.push({url:url.href,blocked:true}); return route.abort(); }
    const base = path.resolve(mappings[prefix]);
    const target = path.resolve(base,decodeURIComponent(url.pathname.slice(prefix.length)));
    if (!target.startsWith(base+path.sep)) return route.abort();
    try { await route.fulfill({status:200,contentType:mime[path.extname(target)] || 'application/octet-stream',body:await fs.readFile(target)}); }
    catch(error) {report.requests.push({url:url.href,error:error.message});await route.fulfill({status:404,body:'not found'});}
  });
  const page = await context.newPage();
  page.on('pageerror',error=>report.errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
  async function check(name, fn) {try{await fn();report.tests.push({name,passed:true});}catch(error){report.tests.push({name,passed:false,error:error.message});throw error;}}
  async function snap(name) {
    await page.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:path.join(__dirname,`check-${name}.png`)});
    report.measurements.push({name,...await page.evaluate(()=>({mode:document.querySelector('.matters-shell').dataset.mode,overflow:[...document.querySelectorAll('.matters-bubble-heading,.matters-lobe,.matters-deep-content,.matters-search-result')].filter(el=>el.offsetWidth && (el.scrollWidth>el.clientWidth+2)).map(el=>({class:el.className,text:el.textContent.slice(0,60),client:el.clientWidth,scroll:el.scrollWidth})),fonts:document.fonts.status}))});
  }
  try {
    await page.goto('http://scene.test/scene/preview.html');
    await page.waitForFunction(()=>window.sceneTest);
    await check('six actual object buttons, initial no changes',async()=>{assert.equal(await page.locator('[data-matter-id]').count(),6);assert.equal(await page.evaluate(()=>sceneTest.state.matters.some(m=>m.changed)),false);});
    await snap('overview');
    await page.locator('[data-matter-id="collection"]').hover(); await snap('hover');
    await check('hover then click enters same object; reduced motion has no growth',async()=>{await page.locator('[data-matter-id="collection"]').click();assert.equal(await page.locator('.matters-shell').getAttribute('data-mode'),'reentry');assert.equal(await page.locator('.matters-growth').count(),0);});
    await snap('reentry');
    await check('original source dialog and Escape returns',async()=>{await page.getByRole('button',{name:'查看原现场',exact:true}).click();assert.equal(await page.locator('dialog[open]').count(),1);await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);});
    await page.getByRole('button',{name:'看看它改变了什么',exact:true}).click(); await snap('deep-comparison');
    await check('relation is explicit and does not change stop',async()=>{const before=await page.evaluate(()=>sceneTest.state.matters[0].lastStop);await page.getByRole('button',{name:'接为挑战',exact:true}).click();assert.equal(await page.evaluate(()=>sceneTest.state.matters[0].relation),'challenge');assert.equal(await page.evaluate(()=>sceneTest.state.matters[0].lastStop),before);});
    await check('draft remains focused and saves literal HTML-like input, branch uses latest stop',async()=>{const text='<b>收藏的新判断</b>';await page.getByRole('textbox',{name:'当前判断草稿'}).fill(text);assert.equal(await page.getByRole('textbox',{name:'当前判断草稿'}).inputValue(),text);await page.getByRole('button',{name:'保存当前判断，回到总览'}).click();assert.equal(await page.evaluate(()=>sceneTest.state.matters[0].lastStop),text);assert.equal(await page.locator('.matters-bubble b').count(),0);assert.equal(await page.locator('.matters-branch').count(),1);});
    await snap('changed');
    await check('search keeps input focus and real group counts, source points to same matter',async()=>{await page.getByRole('searchbox').fill('收藏');assert.equal(await page.locator('.matters-shell').getAttribute('data-mode'),'search');assert.equal(await page.evaluate(()=>document.activeElement.className),'matters-search-input');const counts=await page.evaluate(()=>({matters:sceneTest.state.matters.filter(m=>m.title.includes('收藏')).length}));assert.equal(counts.matters,1);});
    await snap('search');
    await check('source result opens local material and same object',async()=>{await page.locator('.matters-search-source').first().click();assert.equal(await page.locator('dialog[open]').count(),1);assert.equal(await page.evaluate(()=>sceneTest.state.selectedId),'collection');await page.keyboard.press('Escape');});
    await check('fresh suppresses historical judgment',async()=>{await page.getByRole('button',{name:'先不带回旧理解',exact:true}).click();assert.equal(await page.evaluate(()=>sceneTest.state.contextMode),'fresh');assert.equal(await page.locator('.matters-body').innerText().then(t=>t.includes('<b>收藏的新判断</b>')),false);});
    await snap('fresh');
    await check('draft isolation per matter, BACK no false change',async()=>{await page.getByRole('textbox',{name:'当前判断草稿'}).fill('本次新感受');await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.locator('[data-matter-id="work"]').click();await page.getByRole('button',{name:'从这里接着',exact:true}).click();assert.equal(await page.getByRole('textbox',{name:'当前判断草稿'}).inputValue(),'');assert.equal(await page.evaluate(()=>sceneTest.state.matters.find(m=>m.id==='work').changed),false);});
    await check('all four tabs are operable; understanding save does not replace history',async()=>{for(const tab of ['care','understanding','comparison','stop']){await page.locator(`[data-tab="${tab}"]`).click();assert.equal(await page.evaluate(()=>sceneTest.state.deepTab),tab);}await page.locator('[data-tab="understanding"]').click();await page.getByRole('textbox',{name:'我的理解草稿'}).fill('我明确保存的理解');await page.getByRole('button',{name:'保存我的理解',exact:true}).click();assert.equal(await page.evaluate(()=>sceneTest.state.matters.find(m=>m.id==='work').understanding),'我明确保存的理解');});
    await check('IME composition Enter does not submit; compositionend records draft',async()=>{await page.locator('[data-tab="stop"]').click();await page.getByRole('textbox',{name:'当前判断草稿'}).evaluate(input=>{input.focus();input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));input.value='输入法组合中的判断';input.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,isComposing:true}));});assert.equal(await page.evaluate(()=>sceneTest.state.mode),'deep');assert.equal(await page.evaluate(()=>sceneTest.state.matters.find(m=>m.id==='work').draft),'');await page.getByRole('textbox',{name:'当前判断草稿'}).evaluate(input=>input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})));assert.equal(await page.evaluate(()=>sceneTest.state.matters.find(m=>m.id==='work').draft),'输入法组合中的判断');});
    await page.setViewportSize({width:1440,height:900});await snap('1440-deep');
    await page.setViewportSize({width:880,height:620});await snap('880-deep');
    await page.evaluate(()=>sceneTest.action({type:'OVERVIEW'}));await snap('880-overview');
    await page.locator('[data-matter-id="collection"]').click();await snap('880-reentry');
    await page.setViewportSize({width:1672,height:941});
    await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>sceneTest.action({type:'OVERVIEW'}));
    await check('actual Anime entry is interruptible with Escape',async()=>{await page.locator('[data-matter-id="collection"]').click();assert.equal(await page.locator('.matters-growth').count(),1);await page.keyboard.press('Escape');assert.equal(await page.locator('.matters-growth').count(),0);assert.equal(await page.locator('.matters-shell').getAttribute('data-mode'),'overview');});
    await check('completed entry restores keyboard focus so Escape still goes back',async()=>{await page.locator('[data-matter-id="collection"]').click();await page.screenshot({path:path.join(__dirname,'check-growth.png')});await page.waitForFunction(()=>!document.querySelector('.matters-growth'));assert.equal(await page.evaluate(()=>document.querySelector('.matters-shell').contains(document.activeElement)),true);await page.keyboard.press('Escape');assert.equal(await page.locator('.matters-shell').getAttribute('data-mode'),'overview');});
    await check('destroy removes own root without page errors',async()=>{await page.evaluate(()=>sceneTest.screen.destroy());assert.equal(await page.locator('.matters-shell').count(),0);assert.deepEqual(report.errors,[]);});
    await check('no animation/material service still allows OPEN and CONTINUE',async()=>{await page.goto('http://scene.test/scene/preview.html?static=1');await page.waitForFunction(()=>window.sceneTest);await page.locator('[data-matter-id="collection"]').click();assert.equal(await page.locator('.matters-growth').count(),0);await page.getByRole('button',{name:'看看它改变了什么',exact:true}).click();assert.equal(await page.locator('.matters-shell').getAttribute('data-mode'),'deep');});
    await check('decorative glass service exception retains usable static bubble',async()=>{await page.goto('http://scene.test/scene/preview.html?static=1&glass-failure=1');await page.waitForFunction(()=>window.sceneTest);assert.equal(await page.locator('[data-matter-id="collection"] .matters-surface-svg').count(),1);await page.locator('[data-matter-id="collection"]').click();assert.equal(await page.locator('.matters-shell').getAttribute('data-mode'),'reentry');assert.deepEqual(report.errors,[]);});
    await check('existing real material adapter mounts small bubble and survives resize',async()=>{await page.goto('http://scene.test/scene/preview.html?glass=1');await page.waitForFunction(()=>document.querySelector('[data-refraction="requested"]'));await snap('real-glass-overview');await page.setViewportSize({width:880,height:620});await page.waitForFunction(()=>document.querySelector('[data-refraction="requested"]'));await snap('real-glass-880');assert.equal(await page.locator('[data-scene-glass="surface"]').count(),1);await page.locator('[data-matter-id="collection"]').click();await page.waitForFunction(()=>!document.querySelector('.matters-growth'));assert.equal(await page.locator('[data-scene-glass="surface"]').count(),0);assert.deepEqual(report.errors,[]);});
  } finally {await fs.writeFile(path.join(__dirname,'smoke-result.json'),JSON.stringify(report,null,2));await browser.close();}
  console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
