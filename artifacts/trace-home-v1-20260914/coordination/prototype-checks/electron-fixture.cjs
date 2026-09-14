const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const root = path.resolve(__dirname, '../../../../trace-runtime/plugins/trace-harness-plugin/lib/desktop')
app.setPath('userData', path.join(__dirname, 'electron-isolated-profile'))
global.candidateEvents = []
ipcMain.on('trace-native:discussion-candidate', (_event, payload) => global.candidateEvents.push(payload))
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1672, height: 941, useContentSize: true,
    webPreferences: { preload: path.join(root, 'discussion-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false } })
  global.fixtureWindow = win
  global.externalRequests = []
  win.webContents.session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => {
    global.externalRequests.push(details.url)
    callback({ cancel: true })
  })
  await win.loadFile(path.join(root, 'discussion/index.html'))
})
app.on('window-all-closed', () => app.quit())
