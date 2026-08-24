import { ipcMain } from 'electron'
import { IPC_CHANNELS, type IpcChannel, type IpcRequest, type IpcResponse } from '@shared/ipc'

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
  })
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
