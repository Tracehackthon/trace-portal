const { chromium } = require('C:/Users/HoSheil/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs/promises')
const path = require('node:path')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const ORIGIN = process.env.TRACE_TEST_ORIGIN || 'http://127.0.0.1:4173'
const OUT = path.join(__dirname, 'regression.json')
const TITLES = { collection: '收藏后为什么接不回来', work: '工作 UI 如何承接', fresh: '想重新看，不先被旧理解带走', handoff: '多 Agent 交接如何保留证据', ideas: '一些想法', team: '团队方法怎样从实践中修订' }
const INITIAL_STOP = '重新出现的理由，可能比分类更重要'
const report = {
  task: 'trace-matters-v1-20260915-integration', target: ORIGIN, startedAt: new Date().toISOString(),
  contextPackageSha256: 'BDF5906EC3208A9C254499C5082E5E689971A7547BCC9A1A303BA5F28FA45068',
  baselineHead: '2f4377864aa353dcecb3f60005d884b11486c84e',
  approvedIntegrationChanges: [{ path: '/src/matters/matters-model.mjs', priorArtifactSha256: '91203DA04BE09ECA19B3B47DA82EBB21462C16867FF7743B7B9EF38AF0C44184', integratedSha256: '3D9A248F129F23834DACD2070F3184FFADDE35870612B731CC18076E00FE0606', reason: 'Root-authorized RELATE guard requires sourceId to match a source belonging to the selected matter; original artifact retained.' }],
  environment: 'Headless Chromium; fresh isolated contexts; no user profile; default reduced-motion except interruption checks',
  browserOptions: { ignoredDefaultArgs: ['--disable-back-forward-cache'], reason: 'Permit BFCache; actual cache restoration must still be observed via pageshow.persisted.' },
  limitations: ['Native candidate transport is a traceNative callback mock, not Electron IPC/Overlay acceptance.', 'IME dispatch checks are synthetic composition events, not a real OS IME.', 'DOM/resource checks are not pixel, typography, refraction, or natural bird-flight acceptance.', 'This worker neither edits app/resources nor owns the server lifecycle.'],
  cases: [], previousRuns: [],
}
let browser
const write = () => fs.writeFile(OUT, JSON.stringify(report, null, 2), 'utf8')
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase()

async function snapshot(page) {
  return page.evaluate(() => {
    const visible = element => Boolean(element && !element.hidden && element.getBoundingClientRect().width && getComputedStyle(element).display !== 'none')
    const home = document.querySelector('#home-scene'), matters = document.querySelector('.matters-shell'), discussion = document.querySelector('.desktop-shell')
    return {
      url: location.href, title: document.title, documentMarker: window.__integrationDocument, lifecycle: window.__integrationLifecycle || [],
      home: visible(home), matters: visible(matters), discussion: visible(discussion),
      homeState: home?.dataset.state || null, mattersMode: matters?.dataset.mode || null,
      selectedTitle: document.querySelector('.matters-reentry')?.getAttribute('aria-label') || document.querySelector('.matters-breadcrumb')?.textContent || null,
      activeTab: document.querySelector('.matters-deep-tab[aria-current]')?.dataset.tab || null,
      query: document.querySelector('.matters-search-input')?.value ?? null,
      draft: document.querySelector('.matters-draft')?.value ?? null,
      notice: document.querySelector('.matters-notice')?.textContent || '',
      homeBubbles: [...document.querySelectorAll('#home-scene [data-entry]')].filter(visible).map(e => ({ id: e.dataset.entry, title: e.querySelector('strong')?.textContent, stop: e.querySelector('.bubble-subtitle')?.textContent, label: e.getAttribute('aria-label') })),
      mattersBubbles: [...document.querySelectorAll('.matters-bubble')].map(e => ({ id: e.dataset.matterId, title: e.querySelector('.matters-bubble-title')?.textContent, stop: e.querySelector('.matters-bubble-stop')?.textContent, changed: e.classList.contains('matters-bubble-changed') })),
      search: { counts: document.querySelector('.matters-search-counts')?.textContent || null, matters: document.querySelectorAll('.matters-search-matter').length, quotes: document.querySelectorAll('.matters-search-quote').length, sources: document.querySelectorAll('.matters-search-source').length },
      dialog: { open: Boolean(document.querySelector('.matters-material-dialog')?.open), title: document.querySelector('.matters-material-title')?.textContent || null, kind: document.querySelector('.matters-material-kind')?.textContent || null, owner: document.querySelector('.matters-material-owner')?.textContent || null, text: document.querySelector('.matters-material-excerpt')?.textContent || null },
      styles: [...document.querySelectorAll('link[rel=stylesheet]')].map(e => ({ href: e.href, disabled: e.disabled, media: e.media })),
      storage: { local: { ...localStorage }, session: { ...sessionStorage }, writes: window.__integrationStorageWrites || [] },
    }
  })
}

async function runCase(id, operation, fn, { motion = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1672, height: 941 }, reducedMotion: motion ? 'no-preference' : 'reduce' })
  await context.addInitScript(() => {
    window.__integrationDocument = crypto.randomUUID()
    window.__integrationLifecycle = []
    for (const type of ['pageshow', 'pagehide']) window.addEventListener(type, event => window.__integrationLifecycle.push({ type, persisted: event.persisted, documentMarker: window.__integrationDocument }))
    window.__integrationStorageWrites = []
    const set = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) { window.__integrationStorageWrites.push({ storage: this === localStorage ? 'localStorage' : 'sessionStorage', key, value }); return set.call(this, key, value) }
  })
  const page = await context.newPage(); page.setDefaultTimeout(7000)
  const item = { id, operation, startedAt: new Date().toISOString(), evidence: {}, consoleErrors: [], pageErrors: [], failedRequests: [], httpErrors: [], resourceResponses: [] }
  page.on('console', m => { if (m.type() === 'error') item.consoleErrors.push({ text: m.text(), location: m.location() }) })
  page.on('pageerror', e => item.pageErrors.push(e.message))
  page.on('requestfailed', r => item.failedRequests.push({ url: r.url(), failure: r.failure()?.errorText }))
  page.on('response', r => {
    if (r.status() >= 400) item.httpErrors.push({ url: r.url(), status: r.status() })
    if (/\.(?:mjs|css|woff2|png)(?:\?|$)/.test(r.url())) item.resourceResponses.push({ url: r.url(), status: r.status(), contentType: r.headers()['content-type'] })
  })
  try {
    await fn(page, item)
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(100)
    item.actual = await snapshot(page)
    assert.equal(item.pageErrors.length, 0, 'Uncaught page errors')
    assert.equal(item.consoleErrors.filter(e => !e.location.url?.endsWith('/favicon.ico')).length, 0, 'Console errors')
    assert.equal(item.httpErrors.filter(e => !e.url.endsWith('/favicon.ico')).length, 0, 'HTTP resource errors')
    assert.equal(item.actual.storage.writes.length, 0, 'App wrote to local/session storage')
    item.status = 'passed'
  } catch (error) {
    item.status = 'failed'; item.failure = error.message; item.stack = error.stack
    try { item.actual = await snapshot(page) } catch {}
  } finally {
    item.finishedAt = new Date().toISOString(); report.cases.push(item)
    console.log(JSON.stringify({ id, status: item.status, failure: item.failure, pageErrors: item.pageErrors }))
    await context.close(); await write()
  }
}

async function homeIs(page) { await page.locator('#home-scene:visible').waitFor(); assert.equal(await page.locator('.matters-shell:visible').count(), 0) }
async function mattersIs(page, mode) { await page.locator(`.matters-shell[data-mode="${mode}"]:visible`).waitFor(); assert.equal(await page.locator('#home-scene:visible').count(), 0) }
async function go(page, query = '', expected = 'home') {
  await page.goto(`${ORIGIN}/${query}`, { waitUntil: 'domcontentloaded' })
  if (expected === 'home') await homeIs(page)
  else if (expected === 'matters') await mattersIs(page, 'overview')
  else await page.locator('.desktop-shell:visible').waitFor()
}
async function allFromHome(page) { await page.locator('#home-scene [data-action="all"]').click(); await mattersIs(page, 'overview') }
async function openMatter(page, id = 'collection') { await page.locator(`.matters-bubble[data-matter-id="${id}"]`).click(); await mattersIs(page, 'reentry') }
async function deep(page, tab = 'comparison') {
  await page.locator('.matters-reentry-primary').click(); await mattersIs(page, 'deep')
  if (tab !== 'comparison') await page.locator(`.matters-deep-tab[data-tab="${tab}"]`).click()
}
async function saveJudgment(page, value) { await page.locator('.matters-draft').fill(value); await page.locator('.matters-submit').click(); await mattersIs(page, 'overview') }
async function toOverview(page) {
  const mode = await page.locator('.matters-shell').getAttribute('data-mode')
  if (mode === 'deep') { await page.locator('.matters-breadcrumb').click(); await mattersIs(page, 'reentry') }
  if (await page.locator('.matters-shell').getAttribute('data-mode') === 'reentry') await page.locator('.matters-back').click()
  if (await page.locator('.matters-shell').getAttribute('data-mode') === 'search') await page.locator('.matters-clear-search').click()
  await mattersIs(page, 'overview')
}

async function main() {
  try { const previous = JSON.parse(await fs.readFile(OUT, 'utf8')); const history = previous.previousRuns || []; delete previous.previousRuns; report.previousRuns = [...history, previous] } catch (error) { if (error.code !== 'ENOENT') throw error }
  browser = await chromium.launch({ headless: true, ignoreDefaultArgs: ['--disable-back-forward-cache'], executablePath: 'D:/AGeneral Workspace/xjch2026/wshuzhilv/.playwright-browsers/chromium-1234/chrome-win64/chrome.exe' })
  try {
    const routes = [
      ['', 'home'], ['?view=home&from=trace-native&observationId=legacy&text=x', 'home'], ['?view=matters', 'matters'], ['?view=matters&from=trace-native&text=legacy', 'matters'],
      ['?view=discussion', 'discussion'], ['?from=trace-native', 'discussion'], ['?from=deepseek-harness', 'discussion'],
      ['?observationId=regression-id', 'discussion'], ['?observationId=', 'discussion'], ['?text=regression-text', 'discussion'], ['?text=', 'discussion'], ['?source=regression-source', 'discussion'], ['?status=待确认', 'discussion'], ['?source=&status=', 'discussion'],
    ]
    for (const [query, expected] of routes) await runCase(`route:${query || '/'}`, `Navigate ${query || '/'}; expect ${expected}`, async (page, item) => {
      await go(page, query, expected); item.evidence.expected = expected
      const actual = await snapshot(page)
      assert.equal(actual[expected], true)
      assert.equal([actual.home, actual.matters, actual.discussion].filter(Boolean).length, 1)
    })

    await runCase('entry:all-is-same-document', 'Home 全部 enters matters; brand returns home without a new document', async (page, item) => {
      await go(page)
      const marker = await page.evaluate(() => window.__integrationDocument)
      await allFromHome(page)
      assert.equal(new URL(page.url()).searchParams.get('view'), 'matters')
      assert.equal(await page.locator('.matters-bubble').count(), 6)
      await page.locator('.matters-brand').click(); await homeIs(page)
      assert.equal(await page.evaluate(() => window.__integrationDocument), marker)
      item.evidence.documentMarker = marker
    })

    await runCase('continuity:save-home-reentry-refresh', 'Save a judgment, return home, reopen same matter, search same stop; reload resets session', async (page, item) => {
      await go(page); const marker = await page.evaluate(() => window.__integrationDocument)
      await allFromHome(page); await openMatter(page); await deep(page, 'stop')
      const judgment = '接入回归唯一停点：先观察真实使用，再判断个人表达的边界。'
      await saveJudgment(page, judgment)
      assert.match(await page.locator('[data-matter-id="collection"] .matters-bubble-stop').textContent(), new RegExp(judgment))
      await page.locator('.matters-brand').click(); await homeIs(page)
      const homeStop = await page.locator('#home-scene [data-entry="thought"]').textContent()
      item.evidence.homeStop = homeStop
      assert.equal(homeStop.includes(judgment), true, 'Home counterpart does not show the saved matter stop')
      await page.locator('#home-scene [data-entry="thought"]').click(); await mattersIs(page, 'reentry')
      assert.equal(await page.locator('.matters-reentry').getAttribute('aria-label'), TITLES.collection)
      assert.equal((await page.locator('.matters-reentry').textContent()).includes(judgment), true)
      await toOverview(page); await page.locator('.matters-search-input').fill('接入回归唯一停点')
      await mattersIs(page, 'search')
      assert.equal(await page.locator('.matters-search-matter').count(), 1)
      assert.equal(await page.locator('.matters-search-quote').count(), 1)
      assert.equal(await page.locator('.matters-search-source').count(), 0)
      assert.equal((await page.locator('.matters-search-matter').textContent()).includes(judgment), true)
      assert.equal(await page.evaluate(() => window.__integrationDocument), marker)
      item.evidence.judgment = judgment
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.locator('.matters-shell').waitFor()
      assert.notEqual(await page.evaluate(() => window.__integrationDocument), marker)
      await toOverview(page)
      const resetStop = await page.locator('[data-matter-id="collection"] .matters-bubble-stop').textContent()
      assert.equal(resetStop.includes(judgment), false)
      assert.equal(resetStop.includes(INITIAL_STOP), true)
      item.evidence.resetStop = resetStop
    })

    await runCase('search:counts-quote-source-owner-empty', 'Classified search counts are real; quote/source return to collection; absent query has no result', async (page, item) => {
      await go(page, '?view=matters', 'matters')
      await page.locator('.matters-search-input').fill('收藏 为什么接不回来'); await mattersIs(page, 'search')
      const counts = await page.locator('.matters-search-counts').textContent()
      assert.match(counts, /1 件事、2 句话、3 个现场/)
      assert.equal(await page.locator('.matters-search-matter').count(), 1)
      assert.equal(await page.locator('.matters-search-quote').count(), 2)
      assert.equal(await page.locator('.matters-search-source').count(), 3)
      await page.locator('.matters-search-quote').first().click(); await mattersIs(page, 'reentry')
      await page.locator('.matters-material-dialog[open]').waitFor()
      assert.equal(await page.locator('.matters-reentry').getAttribute('aria-label'), TITLES.collection)
      assert.match(await page.locator('.matters-material-owner').textContent(), /收藏后为什么接不回来/)
      assert.match(await page.locator('.matters-material-excerpt').textContent(), /如果只是保存了文章/)
      await page.keyboard.press('Escape'); assert.equal(await page.locator('.matters-material-dialog[open]').count(), 0); await mattersIs(page, 'reentry')
      await toOverview(page); await page.locator('.matters-search-input').fill('为什么收藏总会被遗忘'); await mattersIs(page, 'search')
      assert.equal(await page.locator('.matters-search-matter').count(), 0)
      assert.equal(await page.locator('.matters-search-source').count(), 1)
      await page.locator('.matters-search-source').click(); await mattersIs(page, 'reentry')
      assert.match(await page.locator('.matters-material-title').textContent(), /为什么收藏总会被遗忘/)
      assert.match(await page.locator('.matters-material-owner').textContent(), /收藏后为什么接不回来/)
      await page.locator('.matters-material-close').click(); await toOverview(page)
      await page.locator('.matters-search-input').fill('绝无此项-integration-123987'); await mattersIs(page, 'search')
      assert.equal(await page.locator('.matters-search-result').count(), 0)
      assert.match(await page.locator('.matters-search-counts').textContent(), /0 件事、0 句话、0 个现场/)
      assert.equal(await page.locator('.matters-empty-title').textContent(), '当前没有匹配结果')
      await page.locator('.matters-clear-search').click(); await mattersIs(page, 'overview')
      item.evidence.initialCounts = counts
    })

    await runCase('relation:challenge-is-not-adoption-rejection-keeps-source', 'Relating changes no judgment; rejected material remains inspectable and searchable', async (page, item) => {
      await go(page, '?view=matters', 'matters'); await openMatter(page); await deep(page)
      await page.getByRole('button', { name: '接为挑战', exact: true }).click()
      assert.equal(await page.getByRole('button', { name: '接为挑战', exact: true }).getAttribute('aria-pressed'), 'true')
      assert.match(await page.locator('.matters-notice').textContent(), /不表示采用/)
      await page.locator('[data-tab="stop"]').click()
      assert.equal(await page.locator('.matters-reading-copy').textContent(), INITIAL_STOP)
      await page.locator('[data-tab="comparison"]').click()
      await page.getByRole('button', { name: '这次无关', exact: true }).click()
      assert.equal(await page.getByRole('button', { name: '这次无关', exact: true }).getAttribute('aria-pressed'), 'true')
      assert.match(await page.locator('.matters-notice').textContent(), /原材料仍然保留/)
      await page.getByRole('button', { name: '查看原文', exact: true }).click()
      assert.match(await page.locator('.matters-material-title').textContent(), /新的对照/)
      item.evidence.preservedSource = await page.locator('.matters-material-excerpt').textContent()
      await page.locator('.matters-material-close').click(); await toOverview(page)
      assert.equal((await page.locator('[data-matter-id="collection"] .matters-bubble-stop').textContent()).includes(INITIAL_STOP), true)
      await page.locator('.matters-search-input').fill('重新进入的情境'); await mattersIs(page, 'search')
      assert.equal(await page.locator('.matters-search-source').count(), 1)
    })

    await runCase('drafts:cross-matter-and-fresh-isolation', 'Drafts survive same-document navigation without following unrelated matter or fresh context', async (page, item) => {
      await go(page, '?view=matters', 'matters'); await openMatter(page); await deep(page, 'stop')
      const draft = '只属于收藏问题的未提交草稿', freshDraft = '这次重新感受的独立草稿'
      await page.locator('.matters-draft').fill(draft); await toOverview(page)
      await openMatter(page, 'fresh'); await deep(page, 'stop')
      assert.equal(await page.locator('.matters-draft').inputValue(), '')
      await toOverview(page); await openMatter(page); await deep(page, 'stop')
      assert.equal(await page.locator('.matters-draft').inputValue(), draft)
      await toOverview(page); await openMatter(page)
      await page.getByRole('button', { name: '先不带回旧理解', exact: true }).click(); await mattersIs(page, 'deep')
      await page.locator('[data-tab="stop"]').click()
      assert.equal(await page.locator('.matters-draft').inputValue(), '')
      assert.equal(await page.locator('.matters-reading-copy').textContent(), '先写下此刻的感受')
      await page.locator('.matters-draft').fill(freshDraft)
      await page.locator('[data-tab="understanding"]').click()
      assert.equal(await page.locator('.matters-reading-copy').textContent(), '先写下此刻的感受')
      assert.equal(await page.locator('.matters-draft').inputValue(), '')
      await toOverview(page)
      assert.equal(await page.locator('.matters-bubble-changed').count(), 0, 'Navigation or drafts manufactured a change')
      await page.locator('.matters-brand').click(); await homeIs(page); await allFromHome(page)
      await openMatter(page); await deep(page, 'stop')
      assert.equal(await page.locator('.matters-draft').inputValue(), draft)
      item.evidence = { draft, freshDraft, contextLimit: 'DOM projection tested; pure model tests separately verify context excludes old judgments.' }
    })

    await runCase('input:empty-ime-html-literal', 'Whitespace does not save, IME Enter does not save, HTML-like submission remains literal', async (page, item) => {
      await go(page, '?view=matters', 'matters'); await openMatter(page); await deep(page, 'stop')
      assert.equal(await page.locator('.matters-submit').isDisabled(), true)
      await page.locator('.matters-draft').fill(' \n ')
      assert.equal(await page.locator('.matters-submit').isDisabled(), true)
      await page.locator('.matters-draft').press('Enter'); await mattersIs(page, 'deep')
      const payload = '<b data-integration-html-probe>用户原样表达</b> & "quotes"'
      await page.locator('.matters-draft').dispatchEvent('compositionstart')
      await page.locator('.matters-draft').fill(payload)
      await page.locator('.matters-draft').dispatchEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 229, isComposing: true, bubbles: true, cancelable: true })
      await mattersIs(page, 'deep'); assert.equal(await page.locator('.matters-draft').inputValue(), payload)
      await page.locator('.matters-draft').dispatchEvent('compositionend')
      await page.locator('.matters-draft').press('Enter'); await mattersIs(page, 'overview')
      assert.equal(await page.locator('[data-integration-html-probe]').count(), 0)
      assert.equal((await page.locator('[data-matter-id="collection"] .matters-bubble-stop').textContent()).includes(payload), true)
      await page.locator('.matters-brand').click(); await homeIs(page)
      assert.equal(await page.locator('[data-integration-html-probe]').count(), 0)
      assert.equal((await page.locator('#home-scene [data-entry="thought"]').textContent()).includes(payload), true)
      item.evidence = { payload, ime: 'Synthetic DOM composition events, not OS IME integration' }
    })

    await runCase('legacy:candidate-query-mock', 'Legacy native query retains original text/source/status and candidate payloads', async (page, item) => {
      await page.addInitScript(() => { window.__candidatePayloads = []; window.traceNative = { reportCandidate: payload => window.__candidatePayloads.push(JSON.parse(JSON.stringify(payload))) } })
      const original = '中文 & + # ? <b data-legacy-html-probe>原文</b>'
      const query = new URLSearchParams({ from: 'trace-native', observationId: 'matters-integration-observation', text: original, source: 'integration-source', status: '待确认' })
      await go(page, `?${query}`, 'discussion')
      assert.equal(await page.locator('.workspace-header h1').textContent(), original)
      assert.equal(await page.locator('[data-legacy-html-probe]').count(), 0)
      assert.match(await page.locator('.source-card').textContent(), /integration-source/)
      await page.locator('#candidate-button').click(); await page.locator('#candidate-button').click()
      const payloads = await page.evaluate(() => window.__candidatePayloads)
      assert.deepEqual(payloads, [{ type: 'trace.desktop.candidate', observationId: 'matters-integration-observation', status: '候选中' }, { type: 'trace.desktop.candidate', observationId: 'matters-integration-observation', status: '待确认' }])
      item.evidence = { payloads, transport: 'mock traceNative callback; not real Electron/Overlay' }
    })

    await runCase('history:back-forward-keeps-latest-data', 'Back/forward replay route/tab without rolling saved judgment back', async (page, item) => {
      await go(page); const marker = await page.evaluate(() => window.__integrationDocument)
      await allFromHome(page); await openMatter(page); await deep(page, 'stop')
      const judgment = 'history-regression：导航不能回滚新停点'
      await saveJudgment(page, judgment); await page.locator('.matters-brand').click(); await homeIs(page)
      const sequence = []
      await page.goBack(); await mattersIs(page, 'overview'); sequence.push(await snapshot(page))
      assert.equal((await page.locator('[data-matter-id="collection"] .matters-bubble-stop').textContent()).includes(judgment), true)
      await page.goBack(); await mattersIs(page, 'deep'); sequence.push(await snapshot(page))
      assert.equal(await page.locator('[aria-current="step"]').getAttribute('data-tab'), 'stop')
      assert.equal(await page.locator('.matters-reading-copy').textContent(), judgment)
      await page.goBack(); await mattersIs(page, 'deep'); sequence.push(await snapshot(page))
      assert.equal(await page.locator('[aria-current="step"]').getAttribute('data-tab'), 'comparison')
      await page.goBack(); await mattersIs(page, 'reentry'); sequence.push(await snapshot(page))
      assert.equal(new URL(page.url()).searchParams.get('matter'), 'collection')
      assert.equal((await page.locator('.matters-reentry').textContent()).includes(judgment), true)
      await page.goForward(); await mattersIs(page, 'deep')
      await page.goForward(); await mattersIs(page, 'deep')
      assert.equal(await page.locator('.matters-reading-copy').textContent(), judgment)
      assert.equal(await page.evaluate(() => window.__integrationDocument), marker)
      item.evidence = { sequence, judgment }
    })

    await runCase('navigation:repeat-capture-is-new-matter', 'Repeated SPA mounts produce only one capture; new input does not overwrite collection and remains findable', async (page, item) => {
      await go(page); const marker = await page.evaluate(() => window.__integrationDocument)
      for (let i = 0; i < 3; i++) { await allFromHome(page); await openMatter(page, 'work'); await deep(page, 'stop'); await page.locator('.matters-brand').click(); await homeIs(page) }
      const original = '全新输入-integration：不是收藏示例的改写'
      await page.locator('#capture-input').fill(original); await page.locator('#capture-form [type="submit"]').click()
      await mattersIs(page, 'reentry')
      const id = new URL(page.url()).searchParams.get('matter')
      assert.equal(id, 'capture-1', 'Repeated mounts duplicated capture handlers')
      assert.equal(await page.locator('.matters-reentry').getAttribute('aria-label'), original)
      await toOverview(page)
      assert.equal(await page.locator('.matters-bubble').count(), 6)
      assert.equal(await page.locator('[data-matter-id="capture-1"]').count(), 1)
      await page.locator('.matters-search-input').fill('收藏 为什么接不回来'); await mattersIs(page, 'search')
      assert.equal(await page.locator('.matters-search-matter').count(), 1)
      assert.equal((await page.locator('.matters-search-matter').textContent()).includes(INITIAL_STOP), true)
      await page.locator('.matters-search-input').fill('全新输入-integration'); await mattersIs(page, 'search')
      assert.equal(await page.locator('.matters-search-matter').count(), 1)
      assert.equal(await page.locator('.matters-search-quote').count(), 1)
      assert.equal(await page.locator('.matters-search-source').count(), 1)
      await page.locator('.matters-search-source').click(); await mattersIs(page, 'reentry')
      assert.equal(await page.locator('.matters-material-excerpt').textContent(), original)
      assert.equal((await page.locator('.matters-material-owner').textContent()).includes(original), true)
      await page.locator('.matters-material-close').click(); await page.locator('.matters-brand').click(); await homeIs(page)
      assert.equal(await page.locator('[data-entry="thought"]').getAttribute('data-matter-id'), 'capture-1')
      assert.equal(await page.locator('[data-entry="thought"] strong').textContent(), original)
      assert.equal(await page.evaluate(() => window.__integrationDocument), marker)
      item.evidence = { id, original, repeatedMounts: 3 }
    })

    await runCase('search:entry-focus-history-replace', 'Home search and Ctrl+K focus shared search; typing replaces history after initial search navigation', async (page, item) => {
      await go(page); await page.locator('#home-scene [data-action="search"]').click(); await mattersIs(page, 'overview')
      assert.equal(await page.locator('.matters-search-input').evaluate(e => e === document.activeElement), true)
      const before = await page.evaluate(() => history.length)
      await page.locator('.matters-search-input').fill('收藏'); await mattersIs(page, 'search')
      const first = await page.evaluate(() => history.length)
      await page.locator('.matters-search-input').fill('收藏 为什么接不回来')
      const second = await page.evaluate(() => history.length)
      assert.equal(first, before + 1); assert.equal(second, first)
      assert.equal(new URL(page.url()).searchParams.get('q'), '收藏 为什么接不回来')
      await page.locator('.matters-brand').click(); await homeIs(page)
      await page.keyboard.press('Control+k'); await mattersIs(page, 'overview')
      assert.equal(await page.locator('.matters-search-input').evaluate(e => e === document.activeElement), true)
      item.evidence = { before, first, second }
    })

    await runCase('resources:style-isolation-and-pinned-assets', 'Only route stylesheet is active; served environment/fonts/model match approved bytes', async (page, item) => {
      await go(page)
      async function activeStyles(expected) {
        const actual = await page.locator('link[data-desktop-style]').evaluateAll(nodes => nodes.filter(e => !e.disabled && e.media === 'all').map(e => e.dataset.desktopStyle))
        assert.deepEqual(actual, [expected]); return actual
      }
      await activeStyles('home'); await allFromHome(page); await activeStyles('matters')
      assert.equal(await page.locator('body').evaluate(e => e.classList.contains('home-page')), false)
      assert.equal(await page.locator('body').evaluate(e => e.classList.contains('matters-page')), true)
      await page.evaluate(() => document.fonts.ready)
      const assets = [
        ['/public/matters/environment.png', '185D0FA9FD1DA6C0C16FAD0B22830FAE275B0E9C7BB565A7564A2F2F9D731B89', 'image/png'],
        ['/public/matters/fonts/TraceMattersSerif-fixed.woff2', '6B1D904266F22E080E8A3C8B63DC5F8C9153001302A73D5A3F5EEE0A103070FE', 'font/woff2'],
        ['/public/matters/fonts/TraceMattersSans-fixed.woff2', '31F9766E8A7122291E2EC1D10E674ACDE07D2085D997AB8F6F64C794749DD085', 'font/woff2'],
        ['/src/matters/matters-model.mjs', '3D9A248F129F23834DACD2070F3184FFADDE35870612B731CC18076E00FE0606', 'javascript'],
      ]
      item.evidence.assets = []
      for (const [url, hash, mime] of assets) {
        const response = await page.request.get(`${ORIGIN}${url}`), bytes = await response.body()
        const actual = { url, status: response.status(), bytes: bytes.length, sha256: sha(bytes), contentType: response.headers()['content-type'] }
        item.evidence.assets.push(actual)
        assert.equal(actual.status, 200); assert.equal(actual.sha256, hash); assert.equal(actual.contentType.includes(mime), true)
      }
      await page.locator('.matters-brand').click(); await homeIs(page); await activeStyles('home')
      await allFromHome(page); await activeStyles('matters')
      assert.equal(await page.locator('.matters-shell').count(), 1)
    })

    await runCase('animation:interrupt-growth-return-home', 'Normal-motion entry growth can be interrupted and destroyed during navigation', async (page, item) => {
      await go(page); await allFromHome(page)
      await page.locator('[data-matter-id="collection"]').click(); await mattersIs(page, 'reentry')
      await page.keyboard.press('Escape'); await mattersIs(page, 'overview')
      await page.locator('[data-matter-id="work"]').click(); await mattersIs(page, 'reentry')
      await page.locator('.matters-brand').click(); await homeIs(page)
      await page.waitForTimeout(1100)
      assert.equal(await page.locator('.matters-growth,.matters-shell,.matters-material-dialog').count(), 0)
      await allFromHome(page); assert.equal(await page.locator('.matters-shell').count(), 1)
      assert.equal(await page.locator('.matters-bubble-changed').count(), 0)
      item.evidence.method = 'Normal motion; Esc during growth and brand return before scheduled completion'
    }, { motion: true })

    await runCase('deep-link:known-unknown-and-fresh', 'Explicit matter/step/tab/fresh URLs select the right entry; unknown ID is safe overview', async (page, item) => {
      await page.goto(`${ORIGIN}/?view=matters&matter=work&step=deep&tab=stop`); await mattersIs(page, 'deep')
      assert.match(await page.locator('.matters-breadcrumb').textContent(), /工作 UI 如何承接/)
      assert.equal(await page.locator('.matters-reading-copy').textContent(), '等待实际使用结果')
      await page.goto(`${ORIGIN}/?view=matters&matter=collection&step=deep&tab=understanding&context=fresh`); await mattersIs(page, 'deep')
      assert.equal(await page.locator('[aria-current="step"]').getAttribute('data-tab'), 'understanding')
      assert.equal(await page.locator('.matters-reading-copy').textContent(), '先写下此刻的感受')
      await page.goto(`${ORIGIN}/?view=matters&matter=does-not-exist&step=deep&tab=stop`); await mattersIs(page, 'overview')
      assert.equal(await page.locator('.matters-bubble-changed').count(), 0)
      item.evidence.unknownIdResult = 'overview, zero changed entries'
    })

    await runCase('understanding:explicit-save-keeps-old-stop', 'Saving own understanding changes the editor field without adopting comparison or overwriting current stop', async (page, item) => {
      await go(page, '?view=matters', 'matters'); await openMatter(page); await deep(page, 'understanding')
      const own = '本人明确保存的理解-integration：只在这个处境里成立。'
      await page.locator('.matters-draft').fill(own); await page.locator('.matters-submit').click(); await mattersIs(page, 'deep')
      assert.equal(await page.locator('.matters-reading-copy').textContent(), own)
      assert.match(await page.locator('.matters-notice').textContent(), /没有替你采用/)
      await page.locator('[data-tab="stop"]').click()
      assert.equal(await page.locator('.matters-reading-copy').textContent(), INITIAL_STOP)
      await toOverview(page); await page.locator('.matters-brand').click(); await homeIs(page); await allFromHome(page)
      await openMatter(page); await deep(page, 'understanding')
      assert.equal(await page.locator('.matters-reading-copy').textContent(), own)
      item.evidence.own = own
    })

    await runCase('preview:legacy-five-states-do-not-write-shared-matters', 'Explicit old homepage state preview stays usable and does not mutate shared matter fixtures', async (page, item) => {
      for (const mode of ['overview', 'thinking', 'growth', 'work', 'return']) {
        await go(page, `?view=home&state=${mode}`)
        assert.equal(await page.locator('#home-scene').getAttribute('data-state'), mode)
      }
      await go(page, '?view=home&state=overview')
      const example = '仅用于旧首页六态演示的输入-integration'
      await page.locator('#capture-input').fill(example); await page.locator('#capture-input').press('Enter')
      await page.locator('#home-scene[data-state="thinking"]').waitFor()
      assert.equal(await page.locator('#detail-title').textContent(), example)
      await page.locator('#detail-input').fill('只在演示中生长'); await page.locator('#detail-input').press('Enter')
      await page.locator('#home-scene[data-state="growth"]').waitFor()
      await allFromHome(page)
      assert.equal(await page.locator('[data-matter-id^="capture-"]').count(), 0)
      assert.equal(await page.locator('.matters-bubble-changed').count(), 0)
      assert.equal((await page.locator('[data-matter-id="collection"] .matters-bubble-stop').textContent()).includes(INITIAL_STOP), true)
      item.evidence.previewInput = example
    })

    await runCase('user-content:quote-provenance-label', 'A real user capture quote must not be relabeled as an example quote', async (page, item) => {
      await go(page)
      const original = '用户输入来源身份-integration'
      await page.locator('#capture-input').fill(original); await page.locator('#capture-input').press('Enter'); await mattersIs(page, 'reentry')
      await toOverview(page); await page.locator('.matters-search-input').fill(original); await mattersIs(page, 'search')
      await page.locator('.matters-search-quote').click(); await page.locator('.matters-material-dialog[open]').waitFor()
      const kind = await page.locator('.matters-material-kind').textContent(), excerpt = await page.locator('.matters-material-excerpt').textContent()
      item.evidence = { original, kind, excerpt }
      assert.equal(excerpt, original)
      assert.equal(kind.includes('示例'), false, 'User-authored quote mislabeled as an example')
    })

    await runCase('capture:no-source-cannot-be-challenge', 'A new capture with no comparison source offers no enabled challenge action', async (page, item) => {
      await go(page)
      await page.locator('#capture-input').fill('尚无对照的全新一点-integration'); await page.locator('#capture-input').press('Enter')
      await mattersIs(page, 'reentry'); await deep(page)
      assert.equal(await page.locator('.matters-comparison-title').textContent(), '还没有新的对照')
      const button = page.getByRole('button', { name: '接为挑战', exact: true })
      const actionable = await button.count() > 0 && await button.isEnabled()
      item.evidence.challengeActionable = actionable
      assert.equal(actionable, false, 'No comparison source exists, but challenge action is enabled')
      await toOverview(page)
      assert.equal(await page.locator('.matters-bubble-changed').count(), 0)
    })

    await runCase('legacy:return-restores-home-events', 'Full navigation to old discussion then browser Back restores usable home controls, recording actual BFCache', async (page, item) => {
      await go(page)
      const marker = await page.evaluate(() => window.__integrationDocument)
      await page.goto(`${ORIGIN}/?view=discussion`, { waitUntil: 'domcontentloaded' }); await page.locator('.desktop-shell').waitFor()
      await page.goBack({ waitUntil: 'commit' }); await homeIs(page)
      const restored = await snapshot(page)
      const bfcacheObserved = restored.documentMarker === marker && restored.lifecycle.some(event => event.type === 'pageshow' && event.persisted)
      item.evidence = { originalDocumentMarker: marker, restoredDocumentMarker: restored.documentMarker, bfcacheObserved, lifecycle: restored.lifecycle }
      await page.locator('#home-scene [data-action="all"]').click(); await mattersIs(page, 'overview')
      await page.locator('.matters-brand').click(); await homeIs(page)
      await page.locator('#capture-input').fill('从旧讨论返回后仍能留下一点-integration')
      await page.locator('#capture-input').press('Enter'); await mattersIs(page, 'reentry')
      assert.equal(new URL(page.url()).searchParams.get('matter'), 'capture-1')
    })
  } finally {
    report.finishedAt = new Date().toISOString()
    report.summary = { total: report.cases.length, passed: report.cases.filter(c => c.status === 'passed').length, failed: report.cases.filter(c => c.status === 'failed').length }
    await write(); await browser.close(); console.log(JSON.stringify(report.summary)); process.exitCode = report.summary.failed ? 1 : 0
  }
}
main().catch(async error => { report.fatal = { message: error.message, stack: error.stack }; await write(); await browser?.close(); console.error(error); process.exitCode = 1 })
