import { app, BrowserWindow, Menu } from 'electron'
import { createMainWindow, getMainWindow } from './window'
import { createTray } from './tray'
import { registerIpcHandlers } from './ipc'
import {
  registerGankrProtocol,
  findProtocolUrl,
  parseAuthCallbackUrl,
  setPendingAuthCallback
} from './protocol'
import { initUpdater, isUpdateReadyToInstall, quitAndInstallUpdate } from './updater'

// Must run before app is ready.
registerGankrProtocol()

let isQuitting = false
let installingUpdate = false

function quitApp(): void {
  isQuitting = true
  app.quit()
}

/** Handles a `gankr://...` callback URL, from either a cold start or a
 * second-instance hand-off. Always brings the window back to front — the
 * whole point of this hand-off is returning from the system browser to the
 * app. An `auth-callback` URL additionally carries a session, parsed here
 * and pushed to the renderer over the typed `auth:callback` event channel,
 * since this is unsolicited data arriving from an OS-level URL hand-off
 * rather than a renderer-initiated `invoke`. */
function handleProtocolUrl(url: string): void {
  // eslint-disable-next-line no-console
  console.log('[gankr-protocol] received', url)
  const window = getMainWindow()
  if (window) {
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  }

  const authCallback = parseAuthCallbackUrl(url)
  if (authCallback) {
    // Buffered regardless of whether the renderer is ready yet (see
    // protocol.ts) — the live push below still fires for the warm case
    // where a listener is already subscribed.
    setPendingAuthCallback(authCallback)
    window?.webContents.send('auth:callback', authCallback)
  }
}

// Windows/Linux only: a `gankr://` link launches a second process. Keep a
// single instance and forward the callback URL to it instead.
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const url = findProtocolUrl(argv)
    if (url) handleProtocolUrl(url)

    const window = getMainWindow()
    if (window) {
      if (window.isMinimized()) window.restore()
      window.show()
      window.focus()
    }
  })

  app.whenReady().then(() => {
    // A hidden application menu still keeps CmdOrCtrl+Q wired up as a quit
    // shortcut even with no visible menu bar.
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: 'File',
          submenu: [{ label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => quitApp() }]
        }
      ])
    )

    registerIpcHandlers()

    const window = createMainWindow()
    window.autoHideMenuBar = true

    // Closing the window hides it instead of quitting, so a live lobby's
    // heartbeat keeps running in the background. Only the tray menu or
    // CmdOrCtrl+Q actually quits.
    window.on('close', (event) => {
      if (isQuitting) return
      event.preventDefault()
      window.hide()
    })

    createTray(quitApp)

    if (app.isPackaged) initUpdater()

    const startupUrl = findProtocolUrl(process.argv)
    if (startupUrl) handleProtocolUrl(startupUrl)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow()
      } else {
        window.show()
      }
    })
  })
}

app.on('before-quit', (event) => {
  isQuitting = true
  if (isUpdateReadyToInstall() && !installingUpdate) {
    installingUpdate = true
    event.preventDefault()
    quitAndInstallUpdate()
  }
})

// Windows/Linux only: there is no dock, so there is nothing to keep alive
// when every window closes except the tray icon itself. Do not quit here —
// that is exactly the behaviour the tray exists to prevent.
app.on('window-all-closed', () => {
  // Intentionally a no-op.
})
