import { routeFor } from './home-model.js'
const route = routeFor(window.location.search)
const stylesheet = document.createElement('link')
stylesheet.rel = 'stylesheet'
stylesheet.href = new URL(route === 'home' ? './home.css' : './style.css', import.meta.url).href
const loaded = new Promise((resolve, reject) => { stylesheet.onload = resolve; stylesheet.onerror = reject })
document.head.append(stylesheet)
try {
  await loaded
  if (route === 'home') await import('./home.js')
  else {
    document.title = 'Trace · 深度讨论'
    await import('./discussion.js')
    const back = document.createElement('a')
    back.href = '?view=home'
    back.textContent = '← 返回首页'
    back.style.cssText = 'display:block;margin:0 8px 14px;color:#406c57;font:13px system-ui;text-decoration:none'
    document.querySelector('.sidebar .new-thread')?.before(back)
  }
} catch (error) {
  console.error(error)
  document.querySelector('#app').textContent = '页面资源未能加载，请刷新重试。'
}
