import { app, Menu, Tray, nativeImage } from 'electron'
import { join } from 'path'
import { getMainWindow } from './window'

let tray: Tray | null = null

/**
 * Creates the tray icon that keeps the app alive after the window is
 * closed. The lobby heartbeat (Phase 8) has to keep running while the
 * window is hidden, so quitting only happens from here or Cmd/Ctrl+Q.
 */
export function createTray(onQuit: () => void): Tray {
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'tray-icon.png')
    : join(__dirname, '../../resources/tray-icon.png')

  const icon = nativeImage.createFromPath(iconPath)
  tray = new Tray(icon.isEmpty() ? icon : icon.resize({ width: 16, height: 16 }))
  tray.setToolTip('Gankr')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Gankr',
      click: () => {
        showMainWindow()
      }
    },
    { type: 'separator' },
    {
      label: 'Quit Gankr',
      click: () => {
        onQuit()
      }
    }
  ])
  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    showMainWindow()
  })

  return tray
}

function showMainWindow(): void {
  const window = getMainWindow()
  if (!window) return
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
}
