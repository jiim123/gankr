import { app } from 'electron'

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
