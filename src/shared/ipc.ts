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
  'auth:get-pending-callback'
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
}

export type IpcEventChannel = keyof IpcEventSchema
