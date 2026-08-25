import { contextBridge, ipcRenderer } from 'electron'
import type { IpcChannel, IpcEventSchema, IpcRequest, IpcResponse } from '@shared/ipc'

function invoke<C extends IpcChannel>(channel: C, request: IpcRequest<C>): Promise<IpcResponse<C>> {
  return ipcRenderer.invoke(channel, request)
}

/**
 * The only surface the renderer can reach into main or the OS through.
 * Small and explicit on purpose: if a feature needs OS access, it gets a
 * named method here backed by a typed IPC channel in `src/shared/ipc.ts`,
 * never a raw Node or Electron API handed across the bridge.
 */
const api = {
  ping: (message: string) => invoke('app:ping', { message }),

  /** Opens Steam sign-in in the system browser. The renderer never builds
   * this URL or reaches network/shell APIs itself. */
  signInWithSteam: () => invoke('auth:sign-in-with-steam', {}),

  /** Pulls (and clears) any auth callback that arrived before this listener
   * existed — the cold-start case. Call once on mount alongside
   * onAuthCallback below. */
  getPendingAuthCallback: () => invoke('auth:get-pending-callback', {}),

  /** Subscribes to the session main pushes after a `gankr://auth-callback`
   * hand-off (see src/main/protocol.ts). Returns an unsubscribe function. */
  onAuthCallback: (callback: (payload: IpcEventSchema['auth:callback']) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: IpcEventSchema['auth:callback']): void =>
      callback(payload)
    ipcRenderer.on('auth:callback', listener)
    return () => {
      ipcRenderer.removeListener('auth:callback', listener)
    }
  },

  getVersion: () => invoke('app:get-version', {}),

  checkForUpdates: () => invoke('app:check-for-updates', {}),

  getUpdateStatus: () => invoke('update:get-status', {}),

  /** Subscribes to update status pushes from `src/main/updater.ts`. Returns
   * an unsubscribe function. */
  onUpdateStatusChanged: (callback: (payload: IpcEventSchema['update:status-changed']) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: IpcEventSchema['update:status-changed']
    ): void => callback(payload)
    ipcRenderer.on('update:status-changed', listener)
    return () => {
      ipcRenderer.removeListener('update:status-changed', listener)
    }
  }
}

export type GankrApi = typeof api

// contextIsolation is always on for this app (see src/main/window.ts), so
// contextBridge is always the right way to expose this API. Fail loudly
// instead of silently falling back to a raw `window` assignment, which
// would only mask a misconfigured BrowserWindow.
if (!process.contextIsolated) {
  throw new Error('Gankr requires contextIsolation to be enabled')
}

contextBridge.exposeInMainWorld('gankr', api)
