import { execFile } from 'child_process'
import { promisify } from 'util'
import type { PlatformMatch } from './types'

const execFileAsync = promisify(execFile)

/**
 * Fast path: `tasklist` is a built-in Windows tool, no PowerShell/WMI
 * startup cost (~200-400ms each) that a poll running every few seconds can't
 * afford. CSV output's first quoted field is the image name, e.g.
 * `"cs2.exe","6424","Console","1","123,456 K"`.
 */
async function listProcessNamesWindows(): Promise<Set<string>> {
  const { stdout } = await execFileAsync('tasklist', ['/fo', 'csv', '/nh'])
  const names = new Set<string>()
  for (const line of stdout.split(/\r?\n/)) {
    const match = /^"([^"]+)"/.exec(line)
    if (match?.[1]) names.add(match[1].toLowerCase())
  }
  return names
}

/**
 * Slow fallback, only reached when a game-processes.json entry sets
 * `commandLineContains` on Windows — no seed entry does today, so this path
 * is documented but untested. `wmic` is deprecated on newer Windows 11
 * builds; whoever adds the first entry that needs this should verify `wmic`
 * still exists on their machine, or switch to `Get-CimInstance Win32_Process`
 * via PowerShell instead.
 */
async function listCommandLinesWindows(): Promise<string[]> {
  const { stdout } = await execFileAsync('wmic', ['process', 'get', 'CommandLine'])
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.toLowerCase())
}

export async function checkWindows(match: PlatformMatch): Promise<boolean> {
  const running = await listProcessNamesWindows()
  const nameHit = match.processNames.some((name) => running.has(name.toLowerCase()))
  if (nameHit) return true

  if (!match.commandLineContains?.length) return false

  const commandLines = await listCommandLinesWindows()
  return match.commandLineContains.some((needle) =>
    commandLines.some((line) => line.includes(needle.toLowerCase()))
  )
}

export async function isSteamRunningWindows(): Promise<boolean> {
  const running = await listProcessNamesWindows()
  return running.has('steam.exe')
}
