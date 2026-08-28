/**
 * One appid's known process signature, split per-OS because the matching
 * rules genuinely differ per platform (CLAUDE.md: Windows matches by name,
 * Linux natives match by name too but Proton/Wine games only show a generic
 * process and have to be matched by command line instead). A flat
 * cross-platform process-name list can't express "no native Linux build, so
 * this appid is command-line-only there" — see Apex Legends/Destiny 2 in
 * game-processes.json.
 */
export interface PlatformMatch {
  /** Exact process/image names to match (case-insensitive). Checked first —
   * this is the fast, common path. */
  processNames: string[]
  /** Only checked when processNames finds nothing. On Windows this is a
   * documented but currently-unused escape hatch (no seed entry needs it).
   * On Linux it's the real case for Proton/Wine games, whose visible process
   * name is a generic loader regardless of the actual game. */
  commandLineContains?: string[]
  /** Whether this entry has been confirmed against a real launch, or is an
   * educated guess. See game-processes.json's own top-level comment. */
  verified: boolean
  /** Human-readable provenance — JSON has no comment syntax, this is it. */
  source: string
}

export interface GameProcessEntry {
  name: string
  windows: PlatformMatch
  linux: PlatformMatch
}

export type GameProcessMap = Record<string, GameProcessEntry>
