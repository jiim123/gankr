import { app, ipcMain, shell } from 'electron'
import { IPC_CHANNELS, type IpcChannel, type IpcRequest, type IpcResponse } from '@shared/ipc'
import { buildSteamOpenIdUrl } from './auth'
import { buildSteamAddFriendUrl } from './steam-friend'
import { buildSteamLaunchUrl } from './steam-launch'
import { isGameProcessRunning, isSteamRunning } from './game-detection'
import { checkForUpdates, getCurrentUpdateStatus } from './updater'
import { takePendingAuthCallback } from './protocol'
import { maybeShowNativeNotification, setBadgeCount } from './notifications'

type Handler<C extends IpcChannel> = (
  request: IpcRequest<C>
) => IpcResponse<C> | Promise<IpcResponse<C>>

type HandlerMap = { [C in IpcChannel]: Handler<C> }

/**
 * Every IPC handler the app has. No feature handlers exist yet — `app:ping`
 * is a placeholder proving the typed request/response plumbing works end to
 * end from renderer to main and back.
 */
const handlers: HandlerMap = {
  'app:ping': (request) => ({
    message: request.message,
    receivedAt: Date.now()
  }),

  'auth:sign-in-with-steam': () => {
    const url = buildSteamOpenIdUrl()
    // eslint-disable-next-line no-console
    console.log('[auth] opening steam openid url in system browser', url)
    void shell.openExternal(url)
    return { openedUrl: url }
  },

  'app:get-version': () => ({ version: app.getVersion() }),

  'app:check-for-updates': async () => await checkForUpdates(),

  'update:get-status': () => getCurrentUpdateStatus(),

  'auth:get-pending-callback': () => takePendingAuthCallback(),

  'notifications:show-native': (request) => maybeShowNativeNotification(request),

  'notifications:set-badge-count': (request) => {
    setBadgeCount(request.count)
    return {}
  },

  'steam:open-add-friend': (request) => {
    const url = buildSteamAddFriendUrl(request.steamId64)
    if (!url) return { opened: false }
    void shell.openExternal(url)
    return { opened: true }
  },

  'game:is-process-running': async (request) => ({
    running: await isGameProcessRunning(request.appid)
  }),

  'game:launch': (request) => {
    const url = buildSteamLaunchUrl(request.appid)
    if (!url) return { opened: false }
    void shell.openExternal(url)
    return { opened: true }
  },

  'steam:is-running': async () => ({ running: await isSteamRunning() }),

  'game:log-manual-override': (request) => {
    // eslint-disable-next-line no-console
    console.info('[launch] manual override used', request)
    return {}
  }
}

/** Registers every declared IPC channel. Throws if the schema and the
 * handler map ever drift, so a missing handler fails loudly at startup
 * instead of silently at call time. */
export function registerIpcHandlers(): void {
  for (const channel of IPC_CHANNELS) {
    const handler = handlers[channel]
    if (!handler) {
      throw new Error(`No IPC handler registered for channel "${channel}"`)
    }
    // `handler` is typed per-channel but this loop is iterating the whole
    // union, so TS can't narrow `request` to match; the runtime channel
    // dispatch is what actually keeps them paired up.
    ipcMain.handle(channel, (_event, request) => handler(request as never))
  }
}
