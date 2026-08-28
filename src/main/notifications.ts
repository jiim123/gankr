import { app, Notification, nativeImage } from 'electron'
import { join } from 'path'
import { getMainWindow, restoreAndFocus } from './window'
import type { NotificationType } from '@shared/ipc'

/** Preloaded once in initNotifications() — the same small red dot used both
 * for the native OS notification's icon and, on Windows, as the taskbar
 * overlay icon. Loaded from disk lazily rather than at module scope so a
 * unit test importing this file doesn't touch the filesystem. */
let dotIcon: Electron.NativeImage | null = null

function resolveDotIconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'notification-dot.png')
    : join(__dirname, '../../resources/notification-dot.png')
}

/**
 * Window focused vs not is the one signal this whole delivery pipeline
 * routes on (see CLAUDE.md Phase 9). `isFocused()` alone covers both cases
 * that should get a native popup: hidden in the tray (no window to be
 * focused) and open-but-unfocused (some other window has focus) both read
 * as `false` here.
 */
export function shouldShowNative(): boolean {
  return !getMainWindow()?.isFocused()
}

export interface MaybeShowNativeNotificationRequest {
  notificationId: string
  type: NotificationType
  title: string
  body: string
  lobbyId: string | null
}

/**
 * The one authority on whether a native OS popup actually appears for a
 * given notification item. Returns `{shown:false}` for an `announcement`
 * unconditionally — spec: in-app only, never native, regardless of focus —
 * or whenever the window is focused, since the in-app toast already covers
 * that case. Otherwise constructs a real `Notification`, wiring its click to
 * restore/focus the window and push `notifications:clicked` so the renderer
 * can mark it read and navigate the same way an in-app click would.
 */
export function maybeShowNativeNotification(
  request: MaybeShowNativeNotificationRequest
): { shown: boolean } {
  if (request.type === 'announcement') return { shown: false }
  if (!shouldShowNative()) return { shown: false }
  if (!Notification.isSupported()) return { shown: false }

  const notification = new Notification({
    title: request.title,
    body: request.body,
    icon: dotIcon ?? undefined
  })

  notification.on('click', () => {
    const window = getMainWindow()
    if (window) restoreAndFocus(window)
    window?.webContents.send('notifications:clicked', {
      notificationId: request.notificationId,
      type: request.type,
      lobbyId: request.lobbyId
    })
  })

  notification.show()
  return { shown: true }
}

/**
 * Linux gets a real number via `app.setBadgeCount`. Windows has no
 * numbered-badge equivalent on the taskbar button — `setOverlayIcon` only
 * takes a static image, not a dynamically rendered count, and drawing a
 * numbered bitmap cross-platform is real extra scope Phase 9's spec doesn't
 * ask for. A static "unread" dot is the honest equivalent: it tells you
 * there's something, not how much. `count <= 0` clears it on both.
 */
export function setBadgeCount(count: number): void {
  if (process.platform === 'linux') {
    app.setBadgeCount(count > 0 ? count : 0)
    return
  }

  if (process.platform === 'win32') {
    const window = getMainWindow()
    if (!window) return
    if (count > 0 && dotIcon) {
      window.setOverlayIcon(dotIcon, 'Unread notifications')
    } else {
      window.setOverlayIcon(null, '')
    }
  }
}

/** Called unconditionally from src/main/index.ts (unlike the updater, this
 * is useful in dev too — there's no packaged-only dependency). Preloads the
 * dot icon so the first setBadgeCount/notification isn't waiting on disk. */
export function initNotifications(): void {
  const icon = nativeImage.createFromPath(resolveDotIconPath())
  dotIcon = icon.isEmpty() ? null : icon

  // Clear any stale overlay/badge left over from a previous run — a fresh
  // launch shouldn't show yesterday's unread indicator before the renderer
  // has had a chance to compute the real count.
  setBadgeCount(0)
}

// Windows dev-mode note: Action Center sometimes needs an AppUserModelID
// (set in src/main/index.ts) plus a Start Menu shortcut that only packaged
// builds get automatically from electron-builder. If toasts don't appear
// while running `npm start`/`npm run dev`, that's the likely reason — this
// module's logic is still exercised (see the IPC handler's return value),
// only the OS-level popup itself may be silent.
