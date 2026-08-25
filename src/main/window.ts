import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from './util'

let mainWindow: BrowserWindow | null = null

function resolveIconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(__dirname, '../../resources/icon.png')
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

/**
 * Creates the single application window. Closing it hides it instead of
 * quitting (see `src/main/index.ts`), because the app has to keep the
 * lobby heartbeat alive while the window is out of sight in the tray.
 */
export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    frame: true,
    icon: resolveIconPath(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  window.setMenuBarVisibility(false)

  window.on('ready-to-show', () => {
    window.show()
  })

  if (is.dev) {
    // Renderer console.log/error only goes to that window's own DevTools,
    // not this process's stdout — mirror it here so a solo dev running via
    // `npm start`/`npm run dev` sees renderer-side errors without having to
    // remember to open DevTools every time.
    window.webContents.on('console-message', (_event, level, message) => {
      // eslint-disable-next-line no-console
      console.log(`[renderer:${level}]`, message)
    })
  }

  // Never let the window navigate to or open an external destination
  // in-place; hand it to the system browser instead.
  window.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow = window
  window.on('closed', () => {
    mainWindow = null
  })

  return window
}
