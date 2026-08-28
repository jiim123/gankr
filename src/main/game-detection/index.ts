import gameProcesses from '@shared/game-processes.json'
import type { GameProcessMap } from './types'
import { checkWindows, isSteamRunningWindows } from './windows'
import { checkLinux, isSteamRunningLinux } from './linux'

const GAME_PROCESSES = gameProcesses as GameProcessMap

/**
 * Runtime platform selection is a plain ternary, not an OS-abstraction
 * class/interface — there are exactly two branches this app will ever have
 * (CLAUDE.md: Windows and Linux only, never macOS), so a full strategy
 * pattern would be speculative for a solo-dev codebase that already prefers
 * "boring, obvious code."
 */
export async function isGameProcessRunning(appid: string): Promise<boolean> {
  const entry = GAME_PROCESSES[appid]
  if (!entry) return false

  const match = process.platform === 'win32' ? entry.windows : entry.linux
  return process.platform === 'win32' ? checkWindows(match) : checkLinux(match)
}

export async function isSteamRunning(): Promise<boolean> {
  return process.platform === 'win32' ? isSteamRunningWindows() : isSteamRunningLinux()
}
