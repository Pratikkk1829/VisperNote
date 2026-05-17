const { app, BrowserWindow, ipcMain, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')
const { autoUpdater } = require('electron-updater')

// Configure autoUpdater
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true
autoUpdater.allowPrerelease = false
// Don't log to console to avoid noise
autoUpdater.logger = null

// Track whether the update check was user-initiated
let userInitiatedCheck = false

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
    // Only tell the renderer if the user explicitly asked
    if (userInitiatedCheck) {
      win.webContents.send('update-status', 'up-to-date')
    }
    userInitiatedCheck = false
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
    const isDev = !app.isPackaged

// In dev mode, Electron tries to write cache to the project dir which is often
// inside OneDrive/synced folders → "Access is denied". Fix: use a proper temp path.
if (isDev) {
  const os = require('os')
  app.setPath('userData', require('path').join(require('os').homedir(), 'AppData', 'Roaming', 'VisperNote-dev'))
}
    if (isDev) {
      // Dev mode — only tell renderer if user asked
      if (userInitiatedCheck) {
        win.webContents.send('update-status', 'dev-mode')
      }
    } else {
      // Prod mode — only show error if user explicitly checked
      // Silently swallow auto-startup errors (no GitHub release yet, offline, etc.)
      if (userInitiatedCheck) {
        // If error is about missing release/feed, treat as "up to date" not a hard error
        const msg = (err.message || '').toLowerCase()
        const noRelease = msg.includes('404') || msg.includes('cannot find') || 
                          msg.includes('no published') || msg.includes('latest.yml') ||
                          msg.includes('updates feed') || msg.includes('net::err')
        if (noRelease) {
          win.webContents.send('update-status', 'up-to-date')
        } else {
          win.webContents.send('update-status', 'error')
          win.webContents.send('update-error', err.message)
        }
      }
    }
    userInitiatedCheck = false
  })

  // IPC handlers
  ipcMain.on('check-for-update', () => {
    userInitiatedCheck = true
    try {
      autoUpdater.checkForUpdates()
    } catch (e) {
      if (userInitiatedCheck) {
        win.webContents.send('update-status', app.isPackaged ? 'error' : 'dev-mode')
      }
      userInitiatedCheck = false
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
const APP_PROTOCOL = 'vispernote'
let pendingDeepLink = null

function findDeepLink(argv = []) {
  return argv.find(arg => typeof arg === 'string' && arg.toLowerCase().startsWith(`${APP_PROTOCOL}://`))
}

function sendDeepLink(url) {
  if (!url) return
  pendingDeepLink = url
  if (mainWindow?.webContents) {
    mainWindow.show()
    mainWindow.focus()
    mainWindow.webContents.send('deep-link', url)
    pendingDeepLink = null
  }
}

// In dev mode, Electron tries to write cache to the project dir which is often
// inside OneDrive/synced folders → "Access is denied". Fix: use a proper temp path.
if (isDev) {
  const os = require('os')
  app.setPath('userData', require('path').join(require('os').homedir(), 'AppData', 'Roaming', 'VisperNote-dev'))
}

if (isDev) {
  app.setAsDefaultProtocolClient(APP_PROTOCOL, process.execPath, [path.resolve(process.argv[1] || '.')])
} else {
  app.setAsDefaultProtocolClient(APP_PROTOCOL)
}
pendingDeepLink = findDeepLink(process.argv) || pendingDeepLink

const singleInstanceLock = app.requestSingleInstanceLock()
if (!singleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    sendDeepLink(findDeepLink(argv))
  })
}

app.on('open-url', (event, url) => {
  event.preventDefault()
  sendDeepLink(url)
})

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
          setTimeout(() => tryLoad(retries - 1), 500)
        }
      })
    }
    tryLoad()
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'))
  }

  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.webContents.once('did-finish-load', () => {
    if (pendingDeepLink) sendDeepLink(pendingDeepLink)
  })

  // Setup auto-updater — run silently on startup (no popup on error)
  setupAutoUpdater(mainWindow)
  if (!isDev) {
    // Delay startup check so app fully loads first
    setTimeout(() => {
      userInitiatedCheck = false  // ensure silent
      try { autoUpdater.checkForUpdates() } catch {}
    }, 5000)
  }

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

if (singleInstanceLock) {
  app.whenReady().then(createWindow)
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
