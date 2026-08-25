/**
 * Fixed, small vocabularies for region/language/mic/tone. Scoring (see
 * lobby-scoring.ts) needs comparable values, not freeform text that can't be
 * matched, so these are closed lists rather than user-entered strings.
 */

export const REGIONS = [
  'NA West',
  'NA East',
  'South America',
  'EU West',
  'EU East',
  'Asia',
  'Oceania'
] as const

export type Region = (typeof REGIONS)[number]

/**
 * A short adjacency chain, not a full graph: each region's "neighbouring"
 * penalty (see lobby-scoring.ts) applies only to the regions immediately
 * next to it geographically. Anything not listed here is "far".
 */
export const REGION_NEIGHBORS: Record<Region, Region[]> = {
  'NA West': ['NA East'],
  'NA East': ['NA West', 'South America'],
  'South America': ['NA East'],
  'EU West': ['EU East'],
  'EU East': ['EU West', 'Asia'],
  Asia: ['EU East', 'Oceania'],
  Oceania: ['Asia']
}

export const LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Portuguese',
  'Russian',
  'Polish',
  'Turkish',
  'Arabic',
  'Japanese',
  'Korean',
  'Chinese'
] as const

export type Language = (typeof LANGUAGES)[number]

export const MIC_OPTIONS = ['off', 'preferred', 'required'] as const

export const TONE_OPTIONS = ['casual', 'competitive'] as const
