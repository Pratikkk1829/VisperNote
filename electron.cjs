const { app, BrowserWindow, ipcMain, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')
const { autoUpdater } = require('electron-updater')

// Configure autoUpdater
autoUpdater.autoDownload = false  // Don't auto-download, let user confirm
autoUpdater.autoInstallOnAppQuit = true
autoUpdater.allowPrerelease = false

// ============== AUTO UPDATER SETUP ==============
function setupAutoUpdater(win) {
  autoUpdater.on('checking-for-update', () => {
    win.webContents.send('update-status', 'checking')
  })

  autoUpdater.on('update-available', (info) => {
    win.webContents.send('update-status', 'available')
    win.webContents.send('update-info', { version: info.version, releaseNotes: info.releaseNotes })
  })

  autoUpdater.on('update-not-available', () => {
    win.webContents.send('update-status', 'up-to-date')
  })

  autoUpdater.on('download-progress', (progress) => {
    win.webContents.send('update-progress', {
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    win.webContents.send('update-status', 'downloaded')
    win.webContents.send('update-ready', info.version)
  })

  autoUpdater.on('error', (err) => {
    // In dev mode, autoUpdater always errors — send a friendly status
    const isDev = !require('electron').app.isPackaged
    if (isDev) {
      win.webContents.send('update-status', 'dev-mode')
    } else {
      win.webContents.send('update-status', 'error')
      win.webContents.send('update-error', err.message)
    }
  })

  // IPC handlers
  ipcMain.on('check-for-update', () => {
    try { autoUpdater.checkForUpdates() } catch (e) {
      win.webContents.send('update-status', require('electron').app.isPackaged ? 'error' : 'dev-mode')
    }
  })

  ipcMain.on('download-update', () => {
    try { autoUpdater.downloadUpdate() } catch {}
  })

  ipcMain.on('quit-and-install', () => {
    autoUpdater.quitAndInstall()
  })
}

const isDev = !app.isPackaged

function getIcon() {
  const candidates = [
    path.join(__dirname, 'build/icon.ico'),
    path.join(__dirname, 'build/icon.png'),
    path.join(__dirname, 'public/assets/icon.png'),
    path.join(__dirname, 'src/assets/icon.png'),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return nativeImage.createFromPath(p)
  }
  return undefined
}

let mainWindow

function createWindow() {
  const icon = getIcon()

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    icon,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    backgroundColor: '#0f0f13',
    show: false,
  })

  if (icon) mainWindow.setIcon(icon)

  // ============== LOAD APP ==============
  if (isDev) {
    const tryLoad = (retries = 20) => {
      mainWindow.loadURL('http://localhost:5173').catch(() => {
        if (retries > 0) {
          console.log(`[electron] Vite not ready yet, retrying... (${retries} left)`)
          setTimeout(() => tryLoad(retries - 1), 500)
        } else {
          console.error('[electron] Could not connect to Vite dev server.')
        }
      })
    }
    tryLoad()
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => mainWindow.show())

  // Setup auto-updater
  setupAutoUpdater(mainWindow)

  // ============== KEYBOARD SHORTCUTS ==============
  const STEP = 0.1
  const MIN_ZOOM = 0.5
  const MAX_ZOOM = 2.0

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    const ctrl = input.control || input.meta
    if (!ctrl) return

    const key = input.key

    if (key === '[' || key === ']') {
      event.preventDefault()
      mainWindow.webContents.executeJavaScript(
        `window.dispatchEvent(new KeyboardEvent('keydown', { key: '${key}', ctrlKey: true, bubbles: true }))`
      )
      return
    }

    if (key === '-') {
      event.preventDefault()
      const current = mainWindow.webContents.getZoomFactor()
      mainWindow.webContents.setZoomFactor(Math.max(MIN_ZOOM, Math.round((current - STEP) * 10) / 10))
      return
    }

    if (key === '=') {
      event.preventDefault()
      const current = mainWindow.webContents.getZoomFactor()
      mainWindow.webContents.setZoomFactor(Math.min(MAX_ZOOM, Math.round((current + STEP) * 10) / 10))
      return
    }

    if (key === '0') {
      event.preventDefault()
      mainWindow.webContents.setZoomFactor(1.0)
      mainWindow.webContents.executeJavaScript(
        `window.dispatchEvent(new KeyboardEvent('keydown', { key: '0', ctrlKey: true, bubbles: true }))`
      )
      return
    }
  })

  ipcMain.on('window-minimize', () => mainWindow.minimize())
  ipcMain.on('window-maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize())
  ipcMain.on('window-close', () => mainWindow.close())
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
