import { app } from 'electron'
import type { IpcEventSchema } from '@shared/ipc'

export const GANKR_PROTOCOL = 'gankr'

/**
 * Registers the `gankr://` protocol so Steam-auth callbacks (Phase 5) can
 * hand a session back to a running or freshly launched instance of the app.
 * Must be called before `app.whenReady()`.
 */
export function registerGankrProtocol(): void {
  if (process.defaultApp) {
    // Running unpackaged (`electron .` / dev server): Electron is the
    // executable, so the OS needs to be told to launch it with this
    // script's path as the argument the protocol invocation should replay.
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(GANKR_PROTOCOL, process.execPath, [
        process.argv[1] as string
      ])
    }
  } else {
    app.setAsDefaultProtocolClient(GANKR_PROTOCOL)
  }
}

/** Pulls the `gankr://...` URL out of a process argv list, if present. */
export function findProtocolUrl(argv: string[]): string | undefined {
  return argv.find((arg) => arg.startsWith(`${GANKR_PROTOCOL}://`))
}

/**
 * Pulls the access/refresh tokens out of a `gankr://auth-callback#...`
 * URL's fragment. Steam auth hands the session back this way (see
 * supabase/functions/steam-auth-callback) using a fragment rather than a
 * query string, so the tokens never land in a server access log along the
 * way. Returns undefined for any other `gankr://` URL, or a callback
 * missing either token.
 */
export function parseAuthCallbackUrl(url: string): IpcEventSchema['auth:callback'] | undefined {
  if (!url.startsWith(`${GANKR_PROTOCOL}://auth-callback`)) return undefined

  const hashIndex = url.indexOf('#')
  if (hashIndex === -1) return undefined

  const fragmentParams = new URLSearchParams(url.slice(hashIndex + 1))
  const accessToken = fragmentParams.get('access_token')
  const refreshToken = fragmentParams.get('refresh_token')
  if (!accessToken || !refreshToken) return undefined

  return { accessToken, refreshToken }
}
