const {_electron:electron}=require('C:/Users/HoSheil/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict')
const report={startedAt:new Date().toISOString(),cases:[],errors:[],warnings:[],limits:['Hidden Electron fixture with real packaged preload and isolated IPC receiver, not actual Overlay mutation acceptance.','No full GPU/performance benchmark or OS IME acceptance.']}
let app,page
async function run(id,fn){try{report.cases.push({id,status:'passed',evidence:await fn()})}catch(e){report.cases.push({id,status:'failed',error:e.message});throw e}}
async function mode(value){await page.locator(`.matters-shell[data-mode="${value}"]`).waitFor()}
;(async()=>{
  try{const old=JSON.parse(await fs.readFile(path.join(__dirname,'native-check.json'),'utf8'));const history=old.previousRuns||[];delete old.previousRuns;report.previousRuns=[...history,old]}catch(e){if(e.code!=='ENOENT')throw e}
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE
  app=await electron.launch({executablePath:path.resolve(__dirname,'../../../../trace-runtime/plugins/trace-harness-plugin/node_modules/electron/dist/electron.exe'),args:[path.join(__dirname,'electron-fixture.cjs')],env})
  page=await app.firstWindow();page.setDefaultTimeout(10000)
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());if(m.type()==='warning')report.warnings.push(m.text())})
  await page.locator('#home-scene').waitFor();const url=page.url().split('?')[0]
  await page.reload();await page.locator('#home-scene').waitFor()
  await run('home-to-matters-offline-assets',async()=>{
    await page.evaluate(()=>window.__sameDocument='fixture')
    await page.locator('[data-action="all"]').click();await mode('overview');await page.evaluate(()=>document.fonts.ready)
    await page.waitForFunction(()=>document.querySelector('[data-refraction]')?.dataset.refraction==='requested')
    const data=await page.evaluate(()=>({url:location.href,sameDocument:window.__sameDocument,fonts:[...document.fonts].map(f=>({family:f.family,status:f.status})),images:[...document.images].map(i=>({src:i.src,loaded:i.complete&&i.naturalWidth>0})),native:typeof window.traceNative?.reportCandidate,node:typeof window.require}))
    assert.match(data.url,/^file:.*view=matters/);assert.equal(data.sameDocument,'fixture');assert.equal(data.native,'function');assert.equal(data.node,'undefined');assert.ok(data.images.every(i=>i.loaded));assert.ok(data.fonts.every(f=>f.status==='loaded'))
    const png=await app.evaluate(async()=> (await global.fixtureWindow.webContents.capturePage(undefined,{stayHidden:true})).toPNG().toString('base64'))
    await fs.writeFile(path.join(__dirname,'native-overview.png'),Buffer.from(png,'base64'));return data
  })
  await run('same-stop-roundtrip-file-history',async()=>{
    await page.locator('[data-matter-id="collection"]').click();await mode('reentry')
    await page.getByRole('button',{name:/看看它改变了什么/}).click();await mode('deep')
    await page.locator('.matters-draft').fill('原生文件里保留的最新停点');await page.locator('.matters-draft').press('Enter');await mode('overview')
    await page.locator('.matters-brand').click();await page.locator('#home-scene').waitFor()
    assert.match(await page.locator('[data-entry="thought"] .bubble-subtitle').textContent(),/原生文件里保留的最新停点/)
    await page.locator('[data-entry="thought"]').click();await mode('reentry')
    assert.match(await page.locator('.matters-lobe-stop').textContent(),/原生文件里保留的最新停点/)
    await page.goBack();await page.locator('#home-scene').waitFor();await page.goForward();await mode('reentry')
    assert.equal(await page.evaluate(()=>window.__sameDocument),'fixture')
    return {url:page.url(),stop:await page.locator('.matters-lobe-stop').textContent(),sameDocument:true}
  })
  await run('capture-without-overwriting-example',async()=>{
    await page.locator('.matters-brand').click();await page.locator('#capture-input').fill('真正来自首页的新输入')
    await page.locator('#capture-input').press('Enter');await mode('reentry')
    assert.match(page.url(),/matter=capture-1/)
    assert.match(await page.locator('.matters-lobe-care').textContent(),/真正来自首页的新输入/)
    await page.getByRole('button',{name:'搜索',exact:true}).click()
    await page.locator('.matters-search-input').fill('收藏 为什么接不回来');await mode('search')
    assert.match(await page.locator('.matters-search-counts').textContent(),/1/)
    return {capture:'capture-1',collectionStillSearchable:true}
  })
  await run('refresh-resets-and-deeplink',async()=>{
    await page.goto(`${url}?view=matters&matter=collection&step=deep&tab=stop`);await mode('deep')
    assert.doesNotMatch(await page.locator('.matters-reading-copy').textContent(),/原生文件里保留的最新停点/)
    return {mode:'deep',reset:true}
  })
  await run('legacy-real-preload-ipc',async()=>{
    await page.goto(`${url}?${new URLSearchParams({from:'trace-native',observationId:'matters-integration-native',text:'旧讨论入口仍可用',source:'隔离测试',status:'待确认'})}`)
    await page.locator('#candidate-button').click();await page.locator('#candidate-button').click()
    const data=await app.evaluate(()=>global.candidateEvents)
    assert.deepEqual(data,[{type:'trace.desktop.candidate',observationId:'matters-integration-native',status:'候选中'},{type:'trace.desktop.candidate',observationId:'matters-integration-native',status:'待确认'}]);return data
  })
  await run('no-external-requests-or-errors',async()=>{const requests=await app.evaluate(()=>global.externalRequests);assert.deepEqual(requests,[]);assert.deepEqual(report.errors,[]);return {requests,versions:await app.evaluate(()=>process.versions)}})
})().catch(e=>{report.fatal=e.stack;process.exitCode=1}).finally(async()=>{
  await app?.close();report.finishedAt=new Date().toISOString();report.summary={total:report.cases.length,passed:report.cases.filter(c=>c.status==='passed').length,failed:report.cases.filter(c=>c.status==='failed').length};await fs.writeFile(path.join(__dirname,'native-check.json'),JSON.stringify(report,null,2),'utf8');console.log(JSON.stringify(report,null,2))
})
