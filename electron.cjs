const { app, BrowserWindow, ipcMain } = require('electron')

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    backgroundColor: '#0f0f13',
    show: false,
  })

  win.loadURL('http://localhost:5173')
  win.once('ready-to-show', () => win.show())

  // Block Electron's built-in Ctrl+=/- zoom, then forward to React via executeJavaScript
  win.webContents.on('before-input-event', (event, input) => {
    if ((input.control || input.meta) && ['=', '+', '-', '0'].includes(input.key) && input.type === 'keyDown') {
      event.preventDefault()
      // Dispatch a custom event that GroupPage listens to
      win.webContents.executeJavaScript(
        `window.dispatchEvent(new KeyboardEvent('keydown', { key: '${input.key}', ctrlKey: true, bubbles: true }))`
      )
    }
  })

  // ── Window controls (minimize, maximize, close) ───────────────
  ipcMain.on('window-minimize', () => win.minimize())
  ipcMain.on('window-maximize', () => win.isMaximized() ? win.unmaximize() : win.maximize())
  ipcMain.on('window-close',    () => win.close())
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
