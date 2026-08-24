import { contextBridge, ipcRenderer } from 'electron'
import type { IpcChannel, IpcRequest, IpcResponse } from '@shared/ipc'

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
  ping: (message: string) => invoke('app:ping', { message })
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
