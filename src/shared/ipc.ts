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
}

export type IpcChannel = keyof IpcSchema

export type IpcRequest<C extends IpcChannel> = IpcSchema[C]['request']

export type IpcResponse<C extends IpcChannel> = IpcSchema[C]['response']

/** Every channel name, used by main to assert every handler got registered. */
export const IPC_CHANNELS: IpcChannel[] = ['app:ping']
