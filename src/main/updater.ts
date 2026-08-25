import { autoUpdater } from 'electron-updater'
import { getMainWindow } from './window'
import type { UpdateStatus } from '@shared/ipc'

const RECHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

let currentStatus: UpdateStatus = { state: 'checking' }
let updateReadyToInstall = false
let recheckTimer: ReturnType<typeof setInterval> | null = null

function setStatus(status: UpdateStatus): void {
  currentStatus = status
  getMainWindow()?.webContents.send('update:status-changed', status)
}

export function getCurrentUpdateStatus(): UpdateStatus {
  return currentStatus
}

export function isUpdateReadyToInstall(): boolean {
  return updateReadyToInstall
}

/** Only invoked from the guarded `before-quit` handler in `src/main/index.ts`
 * — never on its own — so a downloaded update never interrupts someone who
 * is just closing the window to the tray. */
export function quitAndInstallUpdate(): void {
  autoUpdater.quitAndInstall(false, false)
}

export async function checkForUpdates(): Promise<{ triggered: boolean }> {
  try {
    await autoUpdater.checkForUpdates()
    return { triggered: true }
  } catch {
    // Errors are already surfaced through the 'error' event listener below,
    // which updates currentStatus and pushes it to the renderer.
    return { triggered: false }
  }
}

/**
 * Wires `electron-updater`'s autoUpdater to the app's typed IPC status
 * channel. Only ever called when `app.isPackaged` (see src/main/index.ts) —
 * in dev there is no `app-update.yml`, so there is nothing to check against.
 */
export function initUpdater(): void {
  autoUpdater.autoDownload = true
  // Install-on-quit is driven ourselves from index.ts's existing
  // isQuitting/before-quit flow, not by electron-updater's own undocumented
  // timing.
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('checking-for-update', () => {
    setStatus({ state: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    setStatus({ state: 'available', version: info.version })
  })

  autoUpdater.on('update-not-available', () => {
    setStatus({ state: 'not-available' })
  })

  autoUpdater.on('download-progress', (progress) => {
    setStatus({ state: 'downloading', percent: Math.round(progress.percent) })
  })

  autoUpdater.on('update-downloaded', (info) => {
    updateReadyToInstall = true
    setStatus({ state: 'downloaded', version: info.version })
  })

  autoUpdater.on('error', (error) => {
    setStatus({ state: 'error', message: error.message })
  })

  void checkForUpdates()
  recheckTimer = setInterval(() => {
    void checkForUpdates()
  }, RECHECK_INTERVAL_MS)
}

/** Exposed for symmetry/tests; not currently called — the app runs for the
 * process lifetime and never tears the updater down before quit. */
export function stopUpdateChecks(): void {
  if (recheckTimer) {
    clearInterval(recheckTimer)
    recheckTimer = null
  }
}
