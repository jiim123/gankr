import { readdir, readFile } from 'fs/promises'
import type { PlatformMatch } from './types'

/**
 * UNTESTED — no Linux hardware was available to verify any of this against a
 * real launch. Written directly from CLAUDE.md's documented /proc contract:
 * native games matched by process name (`/proc/<pid>/comm`), Proton/Wine
 * games matched by command line (`/proc/<pid>/cmdline`) since their visible
 * process name is a generic loader.
 *
 * Two known risks, called out here rather than only in chat:
 * - `/proc/<pid>/comm` truncates at 15 characters (TASK_COMM_LEN) — a long
 *   binary name could get cut and silently stop matching.
 * - Proton/Wine games commonly show `comm` as something generic like `wine`
 *   or a wineserver process regardless of the actual game, which is exactly
 *   why the Proton-only seed entries (Apex Legends, Destiny 2) use
 *   `commandLineContains`, not `processNames`, on Linux.
 */
async function listProcessesLinux(): Promise<{ names: Set<string>; commandLines: string[] }> {
  const names = new Set<string>()
  const commandLines: string[] = []

  const entries = await readdir('/proc')
  for (const entry of entries) {
    if (!/^\d+$/.test(entry)) continue
    try {
      const comm = (await readFile(`/proc/${entry}/comm`, 'utf8')).trim()
      if (comm) names.add(comm.toLowerCase())

      const cmdlineRaw = await readFile(`/proc/${entry}/cmdline`, 'utf8')
      const cmdline = cmdlineRaw.split('\0').filter(Boolean).join(' ')
      if (cmdline) commandLines.push(cmdline.toLowerCase())
    } catch {
      // PID exited mid-scan, or /proc/<pid> is permission-restricted —
      // expected and common, not an error worth surfacing.
    }
  }

  return { names, commandLines }
}

export async function checkLinux(match: PlatformMatch): Promise<boolean> {
  const { names, commandLines } = await listProcessesLinux()

  const nameHit = match.processNames.some((name) => names.has(name.toLowerCase()))
  if (nameHit) return true

  if (!match.commandLineContains?.length) return false

  return match.commandLineContains.some((needle) =>
    commandLines.some((line) => line.includes(needle.toLowerCase()))
  )
}

export async function isSteamRunningLinux(): Promise<boolean> {
  const { names } = await listProcessesLinux()
  return names.has('steam')
}
