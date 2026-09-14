const { _electron: electron } = require('C:/Users/HoSheil/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs/promises')
const path = require('node:path')
const assert = require('node:assert/strict')
const report = { startedAt: new Date().toISOString(), cases: [], errors: [], warnings: [], limits: ['Hidden isolated Electron fixture with actual packaged preload, not the real Overlay consumer.', 'No full GPU performance benchmark or OS IME acceptance.'] }
let app
async function capture(name) {
  const base64=await app.evaluate(async()=> (await global.fixtureWindow.webContents.capturePage(undefined,{stayHidden:true})).toPNG().toString('base64'))
  await fs.writeFile(path.join(__dirname,name),Buffer.from(base64,'base64'))
}
async function run(id, fn) {
  try { report.cases.push({ id, status: 'passed', evidence: await fn() }) }
  catch(error) { report.cases.push({ id, status: 'failed', error: error.message }); throw error }
}
;(async () => {
  try { const previous=JSON.parse(await fs.readFile(path.join(__dirname,'native-check.json'),'utf8'));const history=previous.previousRuns||[];delete previous.previousRuns;report.previousRuns=[...history,previous] } catch(error) { if(error.code!=='ENOENT')throw error }
  const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE
  app = await electron.launch({ executablePath: path.resolve(__dirname, '../../../../trace-runtime/plugins/trace-harness-plugin/node_modules/electron/dist/electron.exe'), args: [path.join(__dirname, 'electron-fixture.cjs')], env })
  const page = await app.firstWindow()
  page.on('pageerror', e => report.errors.push(e.message))
  page.on('console', m => { if(m.type()==='error')report.errors.push(m.text()); if(m.type()==='warning')report.warnings.push(m.text()) })
  await page.locator('#home-scene').waitFor()
  const url = page.url().split('?')[0]
  await page.reload()
  await page.locator('#home-scene').waitFor()
  await run('offline-home-assets', async () => {
    await page.evaluate(() => document.fonts.ready)
    await page.waitForFunction(() => [...document.querySelectorAll('[data-entry]:not([hidden]) [data-refraction]')].every(e => e.dataset.refraction === 'requested'))
    const data = await page.evaluate(() => ({url:location.href,images:[...document.querySelectorAll('.scene-bird img')].map(e=>({src:e.src,loaded:e.complete&&e.naturalWidth>0})),fonts:[...document.fonts].map(f=>({family:f.family,status:f.status})),native:typeof window.traceNative?.reportCandidate,unsafeNode:typeof window.require, viewport:[innerWidth,innerHeight]}))
    assert.match(data.url,/^file:/);assert.ok(data.images.every(e=>e.loaded));assert.ok(data.fonts.every(f=>f.status==='loaded'));assert.equal(data.native,'function');assert.equal(data.unsafeNode,'undefined')
    await capture('native-overview.png')
    return data
  })
  for (const mode of ['thinking','work']) {
    await run(`detail-layout-${mode}`, async () => {
      await page.goto(`${url}?state=${mode}`)
      await page.locator('#detail-input').waitFor()
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(450)
      const data = await page.locator('.detail-context').evaluate(e=>({clientHeight:e.clientHeight,scrollHeight:e.scrollHeight,rows:[...e.children].map(r=>({bottom:r.getBoundingClientRect().bottom,visibleBottom:e.getBoundingClientRect().bottom,text:r.textContent}))}))
      assert.ok(data.scrollHeight<=data.clientHeight+1, `Static context clipped: ${JSON.stringify(data)}`)
      await capture(`native-${mode}.png`)
      return data
    })
  }
  await run('native-input-to-result', async () => {
    await page.goto(url);await page.locator('#capture-input').fill('本地文件中留下的一点')
    await page.locator('#capture-input').press('Enter');await page.locator('#detail-input').fill('本地文件中形成的新理解')
    await page.locator('#detail-input').press('Enter');await page.waitForFunction(()=>document.querySelector('#home-scene').dataset.state==='growth')
    await page.locator('[data-entry="work"]').click();await page.locator('#detail-input').fill('本地验证结果，尚未自动采用')
    await page.locator('#detail-input').press('Enter');await page.waitForFunction(()=>document.querySelector('#home-scene').dataset.state==='return')
    const data=await page.locator('[data-entry="result"]').textContent();assert.match(data,/本地验证结果，尚未自动采用/);assert.match(data,/待再判断/);return data
  })
  await run('actual-preload-candidate-ipc', async () => {
    await page.goto(`${url}?${new URLSearchParams({from:'trace-native',observationId:'native-fixture-observation',text:'真实 preload 桥验证',source:'隔离测试',status:'待确认'})}`)
    await page.locator('#candidate-button').click();await page.locator('#candidate-button').click()
    const data=await app.evaluate(()=>global.candidateEvents)
    assert.deepEqual(data,[{type:'trace.desktop.candidate',observationId:'native-fixture-observation',status:'候选中'},{type:'trace.desktop.candidate',observationId:'native-fixture-observation',status:'待确认'}])
    return {transport:'packaged preload → ipcRenderer.send → isolated fixture ipcMain listener',payloads:data}
  })
  await run('offline-and-clean-errors', async () => {
    const externalRequests=await app.evaluate(()=>global.externalRequests)
    assert.deepEqual(externalRequests,[]);assert.deepEqual(report.errors,[])
    return {externalRequests,pageErrors:report.errors,versions:await app.evaluate(()=>process.versions)}
  })
})().catch(error=>{report.fatal=error.stack;process.exitCode=1}).finally(async()=>{
  await app?.close()
  report.finishedAt=new Date().toISOString()
  report.summary={total:report.cases.length,passed:report.cases.filter(c=>c.status==='passed').length,failed:report.cases.filter(c=>c.status==='failed').length}
  await fs.writeFile(path.join(__dirname,'native-check.json'),JSON.stringify(report,null,2),'utf8')
  console.log(JSON.stringify(report,null,2))
})
