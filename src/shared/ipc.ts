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
}

export type IpcChannel = keyof IpcSchema

export type IpcRequest<C extends IpcChannel> = IpcSchema[C]['request']

export type IpcResponse<C extends IpcChannel> = IpcSchema[C]['response']

/** Every channel name, used by main to assert every handler got registered. */
export const IPC_CHANNELS: IpcChannel[] = ['app:ping', 'auth:sign-in-with-steam']

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
}

export type IpcEventChannel = keyof IpcEventSchema
