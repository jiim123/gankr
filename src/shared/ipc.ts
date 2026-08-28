/**
 * Single source of truth for the main <-> renderer IPC surface.
 *
 * Every channel is declared once here, as an entry in `IpcSchema`, mapping a
 * channel name to its request and response payload types. `src/main/ipc.ts`
 * registers the handlers against this schema and `src/preload/index.ts`
 * exposes a typed invoker built from the same schema, so a channel name or
 * a payload shape can never drift between the two sides of the boundary.
 *
 * No feature handlers exist yet (see CLAUDE.md phase plan) — `ping` is a
 * placeholder that proves the plumbing works end to end.
 */

import type { Enums } from './db-types'

/** The `notifications.type` enum, re-exported here so both sides of the IPC
 * boundary (and src/main/notifications.ts, which has no other reason to
 * import db-types) can reference it without reaching past @shared. */
export type NotificationType = Enums<'notification_type'>

export interface IpcSchema {
  'app:ping': {
    request: { message: string }
    response: { message: string; receivedAt: number }
  }

  /**
   * Kicks off Steam sign-in. Main builds the Steam OpenID URL and opens it
   * with `shell.openExternal` in the system browser — never an embedded
   * webview, which Steam flags as phishing. `openedUrl` is returned mainly
   * so the caller (and manual verification) can confirm the URL shape.
   */
  'auth:sign-in-with-steam': {
    request: Record<string, never>
    response: { openedUrl: string }
  }

  'app:get-version': {
    request: Record<string, never>
    response: { version: string }
  }

  /** Kicks off a manual update check. `triggered` is false only when the
   * check itself couldn't be started — a failed check still surfaces
   * through the `update:status-changed` push channel. */
  'app:check-for-updates': {
    request: Record<string, never>
    response: { triggered: boolean }
  }

  /** Pulls the current update status. Needed because the startup check
   * likely fires before Settings is ever opened, and the push channel alone
   * would leave Settings blank until the next status change. */
  'update:get-status': {
    request: Record<string, never>
    response: UpdateStatus
  }

  /** Pulls (and clears) any auth callback that arrived before the renderer
   * was ready to receive the `auth:callback` push — the cold-start case,
   * where the app was launched BY the gankr:// click itself. See
   * src/main/protocol.ts. */
  'auth:get-pending-callback': {
    request: Record<string, never>
    response: IpcEventSchema['auth:callback'] | null
  }

  /**
   * Asks main to consider showing a native OS notification for one item
   * from the renderer's unified notification feed. Main is the sole
   * authority on whether it actually appears — see
   * `shouldShowNative`/`maybeShowNativeNotification` in
   * src/main/notifications.ts — because only main knows the window's real
   * focus state. `shown: false` covers both "window is focused, in-app
   * toast already covers it" and "type is announcement, in-app only by
   * spec, regardless of focus".
   */
  'notifications:show-native': {
    request: {
      notificationId: string
      type: NotificationType
      title: string
      body: string
      lobbyId: string | null
    }
    response: { shown: boolean }
  }

  /** Sets the unread badge: a real number on Linux
   * (`app.setBadgeCount`), a static "unread" dot overlay on the taskbar
   * icon on Windows (no numbered-badge equivalent there — see
   * src/main/notifications.ts). `count <= 0` clears it on both platforms. */
  'notifications:set-badge-count': {
    request: { count: number }
    response: Record<string, never>
  }

  /**
   * Opens the per-member "Add on Steam" handoff (Phase 11). Main constructs
   * `steam://friends/add/<id>`, never the renderer — see
   * buildSteamAddFriendUrl() in src/main/steam-friend.ts, which validates
   * the id shape before returning anything to open. `opened: false` means
   * the id failed validation and nothing was opened.
   */
  'steam:open-add-friend': {
    request: { steamId64: string }
    response: { opened: boolean }
  }
}

/** The state of the background update checker, pushed over
 * `update:status-changed` and pulled via `update:get-status`. */
export type UpdateStatus =
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'not-available' }
  | { state: 'downloading'; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string }

export type IpcChannel = keyof IpcSchema

export type IpcRequest<C extends IpcChannel> = IpcSchema[C]['request']

export type IpcResponse<C extends IpcChannel> = IpcSchema[C]['response']

/** Every channel name, used by main to assert every handler got registered. */
export const IPC_CHANNELS: IpcChannel[] = [
  'app:ping',
  'auth:sign-in-with-steam',
  'app:get-version',
  'app:check-for-updates',
  'update:get-status',
  'auth:get-pending-callback',
  'notifications:show-native',
  'notifications:set-badge-count',
  'steam:open-add-friend'
]

/**
 * Main -> renderer push channels: unsolicited events that arrive from
 * outside a renderer-initiated `invoke`, so they don't fit `IpcSchema`
 * (request/response only). Kept as a small parallel shape rather than
 * distorting that one. Currently just the one channel: the OS hands a
 * `gankr://auth-callback#...` URL to main (see src/main/protocol.ts), and
 * main pushes the parsed tokens to the renderer from there.
 */
export interface IpcEventSchema {
  'auth:callback': { accessToken: string; refreshToken: string }

  /** Pushed whenever the background update checker's state changes — see
   * `src/main/updater.ts`. */
  'update:status-changed': UpdateStatus

  /** Pushed when the user clicks a native notification main showed on its
   * own initiative (see `maybeShowNativeNotification` in
   * src/main/notifications.ts). The renderer's notifications.ts uses this
   * to mark the item read and route to the right place, the same handling
   * a click inside NotificationBell's in-app panel gets. */
  'notifications:clicked': { notificationId: string; type: NotificationType; lobbyId: string | null }
}

export type IpcEventChannel = keyof IpcEventSchema
