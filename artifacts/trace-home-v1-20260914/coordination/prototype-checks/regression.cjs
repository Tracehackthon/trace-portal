const { chromium } = require('C:/Users/HoSheil/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs/promises')
const path = require('node:path')
const assert = require('node:assert/strict')

const ORIGIN = 'http://127.0.0.1:4173'
const report = {
  task: 'trace-home-v1-prototype-20260914',
  target: ORIGIN,
  startedAt: new Date().toISOString(),
  browser: 'Chromium headless, fresh isolated contexts; no user profile',
  limits: ['Native candidate bridge is mocked, not real Electron IPC or Overlay mutation acceptance.', 'IME checks dispatch composition-aware DOM keyboard events, not a real OS IME session.', 'Refraction requested proves adapter/vendor mount, not that pixels were visually accepted.', 'No screenshots or service lifecycle changes; main Agent owns visual review and server.'],
  cases: [],
}
let browser

async function snapshot(page) {
  return page.evaluate(() => ({
    url: location.href,
    scene: document.querySelector('#home-scene')?.dataset.state ?? null,
    home: Boolean(document.querySelector('#home-scene')),
    discussion: Boolean(document.querySelector('.desktop-shell')),
    title: document.querySelector('#detail-title')?.textContent ?? document.querySelector('.workspace-header h1')?.textContent ?? null,
    utilityHidden: document.querySelector('#utility-panel')?.hidden ?? null,
    detailHidden: document.querySelector('#detail-card')?.hidden ?? null,
    capture: document.querySelector('#capture-input')?.value ?? null,
    detail: document.querySelector('#detail-input')?.value ?? null,
    visibleBubbles: [...document.querySelectorAll('[data-entry]')].filter(e => !e.hidden).map(e => ({ id: e.dataset.entry, title: e.querySelector('strong')?.textContent })),
    resultBadge: document.querySelector('[data-entry="result"] .result-badge')?.textContent ?? null,
    styles: [...document.querySelectorAll('link[rel="stylesheet"]')].map(e => e.href),
    refraction: [...document.querySelectorAll('[data-refraction]')].map(e => ({ entry: e.closest('[data-entry]')?.dataset.entry || (e.closest('#detail-card') ? 'detail' : null), state: e.dataset.refraction, visible: !e.closest('[hidden]') })),
  }))
}

async function runCase(id, operation, test, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1672, height: 941 }, reducedMotion: options.motion ? 'no-preference' : 'reduce' })
  const page = await context.newPage()
  page.setDefaultTimeout(6000)
  const item = { id, operation, startedAt: new Date().toISOString(), consoleErrors: [], consoleErrorEvents: [], consoleWarnings: [], pageErrors: [], failedRequests: [], httpErrors: [], evidence: {} }
  page.on('pageerror', e => item.pageErrors.push(e.message))
  page.on('console', m => {
    if (m.type() === 'error') { item.consoleErrors.push(m.text()); item.consoleErrorEvents.push({ text: m.text(), location: m.location() }) }
    if (m.type() === 'warning') item.consoleWarnings.push({ text: m.text(), location: m.location() })
  })
  page.on('requestfailed', r => item.failedRequests.push({ url: r.url(), error: r.failure()?.errorText }))
  page.on('response', r => { if (r.status() >= 400) item.httpErrors.push({ url: r.url(), status: r.status() }) })
  try {
    await test(page, item)
    await page.waitForTimeout(50)
    item.actual = await snapshot(page)
    assert.equal(item.pageErrors.length, 0, 'Uncaught page errors')
    const actionableHttp = item.httpErrors.filter(e => !e.url.endsWith('/favicon.ico'))
    assert.equal(actionableHttp.length, 0, 'HTTP resource errors')
    assert.equal(item.consoleErrorEvents.filter(e => !e.location.url?.endsWith('/favicon.ico')).length, 0, 'Browser console errors')
    item.status = 'passed'
  } catch (error) {
    item.status = 'failed'
    item.failure = error.message
    item.stack = error.stack
    try { item.actual = await snapshot(page) } catch {}
  } finally {
    item.finishedAt = new Date().toISOString()
    report.cases.push(item)
    console.log(JSON.stringify({ id, status: item.status, failure: item.failure, actual: item.actual, pageErrors: item.pageErrors }))
    await context.close()
    await fs.writeFile(path.join(__dirname, 'regression.json'), JSON.stringify(report, null, 2), 'utf8')
  }
}

async function go(page, query = '', expected = 'home') {
  await page.goto(`${ORIGIN}/${query}`, { waitUntil: 'domcontentloaded' })
  await page.locator(expected === 'home' ? '#home-scene' : '.desktop-shell').waitFor()
}
async function sceneIs(page, expected) {
  await page.waitForFunction(value => document.querySelector('#home-scene')?.dataset.state === value, expected)
}
async function openBubble(page, id) {
  await page.locator(`[data-entry="${id}"]`).click()
  await sceneIs(page, id === 'work' || id === 'practice' ? 'work' : 'thinking')
}

;(async () => {
  try {
    const previous = JSON.parse(await fs.readFile(path.join(__dirname, 'regression.json'), 'utf8'))
    const history = previous.previousRuns || []
    delete previous.previousRuns
    report.previousRuns = [...history, previous]
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    report.previousRuns = []
  }
  browser = await chromium.launch({ headless: true, executablePath: 'D:/AGeneral Workspace/xjch2026/wshuzhilv/.playwright-browsers/chromium-1234/chrome-win64/chrome.exe' })
  try {
    const routes = [
      ['', 'home'],
      ['?view=home&from=trace-native&observationId=old-id&text=legacy&source=x&status=y', 'home'],
      ['?view=discussion', 'discussion'],
      ['?from=trace-native', 'discussion'],
      ['?from=deepseek-harness', 'discussion'],
      ['?observationId=regression-id', 'discussion'],
      ['?observationId=', 'discussion'],
      ['?text=regression-text', 'discussion'],
      ['?text=', 'discussion'],
      ['?source=regression-source', 'discussion'],
      ['?status=待确认', 'discussion'],
      ['?source=&status=', 'discussion'],
    ]
    for (const [query, expected] of routes) {
      await runCase(`route:${query || '/'}`, `Navigate ${query || '/'}; expect ${expected}`, async (page, item) => {
        await go(page, query, expected)
        const s = await snapshot(page)
        assert.equal(s.home, expected === 'home')
        assert.equal(s.discussion, expected === 'discussion')
        assert.equal(s.styles.some(u => u.endsWith('/home.css')), expected === 'home')
        assert.equal(s.styles.some(u => u.endsWith('/style.css')), expected === 'discussion')
        item.evidence.route = expected
      })
    }

    await runCase('legacy:query-and-candidate-mock', 'Preserve query text/status/source; click candidate twice with mocked traceNative.reportCandidate', async (page, item) => {
      await page.addInitScript(() => { window.__candidatePayloads = []; window.traceNative = { reportCandidate: payload => window.__candidatePayloads.push(JSON.parse(JSON.stringify(payload))) } })
      const text = '中文 & + ? # <b data-legacy-probe>引用</b> "双引号"'
      const q = new URLSearchParams({ from: 'trace-native', observationId: 'regression-observation', text, source: 'regression-source', status: '待确认' })
      await go(page, `?${q}`, 'discussion')
      assert.equal(await page.locator('.workspace-header h1').textContent(), text)
      assert.equal(await page.locator('[data-legacy-probe]').count(), 0)
      assert.match(await page.locator('.eyebrow').first().textContent(), /待确认/)
      assert.match(await page.locator('.source-card').textContent(), /regression-source/)
      await page.locator('#candidate-button').click()
      await page.locator('#candidate-button').click()
      const actual = await page.evaluate(() => window.__candidatePayloads)
      assert.deepEqual(actual, [
        { type: 'trace.desktop.candidate', observationId: 'regression-observation', status: '候选中' },
        { type: 'trace.desktop.candidate', observationId: 'regression-observation', status: '待确认' },
      ])
      item.evidence = { actual, transport: 'mock traceNative callback; no Electron IPC and no real Overlay' }
    })

    await runCase('home:empty-submit', 'Empty and whitespace capture cannot submit, including Enter and direct form requestSubmit()', async page => {
      await go(page)
      const submit = page.locator('#capture-form [type="submit"]')
      assert.equal(await submit.isDisabled(), true)
      await page.locator('#capture-input').fill(' \n ')
      assert.equal(await submit.isDisabled(), true)
      await page.locator('#capture-input').press('Enter')
      await page.locator('#capture-form').evaluate(form => form.requestSubmit())
      await sceneIs(page, 'overview')
      assert.equal(await page.locator('#detail-card').isHidden(), true)
    })

    await runCase('home:refraction-vendor', 'Small overview bubbles mount refraction vendor; served .mjs has JavaScript MIME (not pixel acceptance)', async (page, item) => {
      const vendorResponses = []
      page.on('response', response => {
        if (response.url().endsWith('/src/vendor/shape-only.mjs')) vendorResponses.push({ url: response.url(), status: response.status(), contentType: response.headers()['content-type'] })
      })
      await go(page)
      await page.waitForFunction(() => {
        const surfaces = [...document.querySelectorAll('[data-entry]:not([hidden]) [data-refraction]')]
        return surfaces.length === 4 && surfaces.every(e => e.dataset.refraction === 'requested')
      }, null, { timeout: 10000 })
      item.evidence = { vendorResponses, materials: (await snapshot(page)).refraction, limitation: 'data-refraction=requested is adapter mount state, not browser painted-filter verification; large detail fallback is intentional.' }
      assert.equal(vendorResponses.length > 0, true, 'Vendor .mjs was not loaded by browser')
      assert.equal(vendorResponses.every(response => /(?:text|application)\/javascript/.test(response.contentType || '')), true, 'Vendor MIME is not JavaScript')
    })

    await runCase('home:capture-grow-work-return', 'Capture exact original, grow user insight, enter work, submit user result without automatic verification', async (page, item) => {
      await go(page)
      const original = '回归原文：这是我自己留下的一点。'
      const insight = '回归新理解：重新出现的现场比标签更重要。'
      const result = '回归真实结果：只完成一次试用，尚待再次验证。'
      await page.locator('#capture-input').fill(original)
      await page.locator('#capture-form [type="submit"]').click()
      await sceneIs(page, 'thinking')
      assert.equal(await page.locator('#detail-title').textContent(), original)
      assert.match(await page.locator('.detail-context').textContent(), new RegExp(original))
      assert.equal(await page.locator('#detail-form [type="submit"]').isDisabled(), true)
      await page.locator('#detail-input').fill('   ')
      assert.equal(await page.locator('#detail-form [type="submit"]').isDisabled(), true)
      await page.locator('#detail-input').fill(insight)
      await page.locator('#detail-form [type="submit"]').click()
      await sceneIs(page, 'growth')
      assert.equal(await page.locator('[data-entry="insight"] strong').textContent(), insight)
      await openBubble(page, 'work')
      assert.match(await page.locator('.detail-context').textContent(), new RegExp(insight))
      await page.locator('#detail-input').fill(result)
      await page.locator('#detail-form [type="submit"]').click()
      await sceneIs(page, 'return')
      assert.equal(await page.locator('[data-entry="result"] strong').textContent(), result)
      const badge = await page.locator('.result-badge').textContent()
      assert.match(badge, /待再判断/)
      assert.doesNotMatch(badge, /得到验证/)
      item.evidence = { original, insight, result, badge }
    })

    await runCase('home:search-empty-and-escape', 'Search matching text and an absent phrase; Escape closes utility and then detail', async page => {
      await go(page)
      await page.locator('[data-action="search"]').click()
      await page.locator('#home-search').fill('收藏')
      assert.equal(await page.locator('.search-result').count(), 1)
      await page.locator('#home-search').fill('绝无此条-regression-876543')
      assert.equal(await page.locator('.search-result').count(), 0)
      assert.match(await page.locator('.empty-search').textContent(), /没有找到/)
      await page.keyboard.press('Escape')
      assert.equal(await page.locator('#utility-panel').isHidden(), true)
      await openBubble(page, 'thought')
      await page.keyboard.press('Escape')
      await sceneIs(page, 'overview')
      assert.equal(await page.locator('#detail-card').isHidden(), true)
    })

    await runCase('home:rapid-switch-collapse', 'Animation-enabled DOM click burst thought→fresh→close→work→close; no stale callback or uncaught error', async (page, item) => {
      await go(page)
      const sequence = []
      for (const selector of ['[data-entry="thought"]', '[data-entry="fresh"]', '.scene-back', '[data-entry="work"]', '.scene-back']) {
        await page.locator(selector).evaluate(el => el.click())
        sequence.push({ selector, ...(await snapshot(page)) })
        await page.waitForTimeout(40)
      }
      await page.waitForTimeout(1300)
      await sceneIs(page, 'overview')
      assert.equal(await page.locator('#detail-card').isHidden(), true)
      assert.equal(await page.locator('#scene-bird').evaluate(el => el.classList.contains('flying')), false)
      item.evidence.sequence = sequence
      item.evidence.method = 'DOM click events bypassed stable-position waiting to intentionally interrupt active transitions'
    }, { motion: true })

    await runCase('home:ime-enter', 'Composition-aware Enter must not submit capture or detail; normal Enter after composition submits', async (page, item) => {
      await go(page)
      const original = '正在输入的中文'
      await page.locator('#capture-input').fill(original)
      await page.locator('#capture-input').dispatchEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 229, which: 229, isComposing: true, bubbles: true, cancelable: true })
      await sceneIs(page, 'overview')
      assert.equal(await page.locator('#capture-input').inputValue(), original)
      await page.locator('#capture-input').press('Enter')
      await sceneIs(page, 'thinking')
      await page.locator('#detail-input').fill('还在组合输入')
      await page.locator('#detail-input').dispatchEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 229, which: 229, isComposing: true, bubbles: true, cancelable: true })
      await sceneIs(page, 'thinking')
      assert.equal(await page.locator('#detail-input').inputValue(), '还在组合输入')
      item.evidence.method = 'Synthetic DOM KeyboardEvent.isComposing=true; not OS IME integration'
    })

    await runCase('home:literal-html', 'HTML-like original/insight/result remain literal text and create no probe elements', async page => {
      await go(page)
      const original = '<b data-capture-probe>原文</b> & "quotes"'
      const insight = '<i data-insight-probe>新理解</i>'
      const result = '<u data-result-probe>结果</u>'
      await page.locator('#capture-input').fill(original)
      await page.locator('#capture-input').press('Enter')
      await sceneIs(page, 'thinking')
      assert.equal(await page.locator('#detail-title').textContent(), original)
      assert.equal(await page.locator('[data-capture-probe]').count(), 0)
      await page.locator('#detail-input').fill(insight)
      await page.locator('#detail-input').press('Enter')
      await sceneIs(page, 'growth')
      assert.equal(await page.locator('[data-entry="insight"] strong').textContent(), insight)
      assert.equal(await page.locator('[data-insight-probe]').count(), 0)
      await openBubble(page, 'work')
      await page.locator('#detail-input').fill(result)
      await page.locator('#detail-input').press('Enter')
      await sceneIs(page, 'return')
      assert.equal(await page.locator('[data-entry="result"] strong').textContent(), result)
      assert.equal(await page.locator('[data-result-probe]').count(), 0)
    })

    await runCase('home:reopen-user-insight', 'After user creates an insight, clicking that insight must reopen that same user title, not a template title', async (page, item) => {
      await go(page)
      await openBubble(page, 'thought')
      const insight = '独立回归：这是用户刚形成的唯一新理解。'
      await page.locator('#detail-input').fill(insight)
      await page.locator('#detail-input').press('Enter')
      await sceneIs(page, 'growth')
      await openBubble(page, 'insight')
      const actual = await page.locator('#detail-title').textContent()
      item.evidence = { expected: insight, actual }
      assert.equal(actual, insight, 'Reopened user insight title was replaced by template content')
    })

    await runCase('home:entry-context-isolation', 'A captured thought must not become the original context of an unrelated existing fresh entry', async (page, item) => {
      await go(page)
      const original = '唯一用户捕获-上下文隔离-regression'
      await page.locator('#capture-input').fill(original)
      await page.locator('#capture-input').press('Enter')
      await sceneIs(page, 'thinking')
      await page.keyboard.press('Escape')
      await openBubble(page, 'fresh')
      const title = await page.locator('#detail-title').textContent()
      const context = await page.locator('.detail-context').textContent()
      await page.locator('#detail-card [data-action="source"]').click()
      const source = await page.locator('#utility-panel blockquote').textContent()
      item.evidence = { original, title, context, source }
      assert.equal(title, '想重新看，不先被旧理解带走')
      assert.equal(context.includes(original), false, 'Unrelated fresh entry inherited captured thought as its original context')
      assert.equal(source.includes(original), false, 'Unrelated fresh source viewer inherited captured thought text')
    })

    await runCase('home:draft-entry-isolation', 'Unsaved draft stays with its own entry instead of following every thinking-mode bubble', async (page, item) => {
      await go(page)
      await openBubble(page, 'thought')
      const draft = '只属于收藏问题的草稿-regression'
      await page.locator('#detail-input').fill(draft)
      await page.locator('[data-entry="fresh"]').evaluate(el => el.click())
      await sceneIs(page, 'thinking')
      const otherDraft = await page.locator('#detail-input').inputValue()
      item.evidence = { draft, otherDraft }
      assert.equal(otherDraft, '', 'Draft from thought appeared in unrelated fresh entry')
      await page.locator('[data-entry="thought"]').evaluate(el => el.click())
      assert.equal(await page.locator('#detail-input').inputValue(), draft, 'Original entry draft did not survive switching away and back')
    })
  } finally {
    report.finishedAt = new Date().toISOString()
    report.summary = { total: report.cases.length, passed: report.cases.filter(c => c.status === 'passed').length, failed: report.cases.filter(c => c.status === 'failed').length }
    await fs.writeFile(path.join(__dirname, 'regression.json'), JSON.stringify(report, null, 2), 'utf8')
    await browser?.close()
    console.log(JSON.stringify(report.summary))
    process.exitCode = report.summary.failed ? 1 : 0
  }
})().catch(async error => {
  report.fatal = { message: error.message, stack: error.stack }
  await fs.writeFile(path.join(__dirname, 'regression.json'), JSON.stringify(report, null, 2), 'utf8')
  console.error(error)
  await browser?.close()
  process.exitCode = 1
})
