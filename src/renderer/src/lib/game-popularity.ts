import { supabase } from './supabase'

export interface PopularGame {
  appid: string
  name: string
  ownerCount: number
}

export const POPULAR_GAMES_PAGE_SIZE = 50

/**
 * Ranks games by how many Gankr users own them, via public.game_popularity
 * (see its migration for why this aggregate is safe to expose even though
 * user_games itself is locked to the owning user). Paginated for "Load
 * more" — fetches one row past the page size to know if there's another
 * page without a separate count query.
 */
export async function loadPopularGames(offset: number): Promise<{ games: PopularGame[]; hasMore: boolean }> {
  const { data: popularity } = await supabase
    .from('game_popularity')
    .select('appid, owner_count')
    .order('owner_count', { ascending: false })
    .range(offset, offset + POPULAR_GAMES_PAGE_SIZE)

  const rows = (popularity ?? []).filter(
    (row): row is { appid: string; owner_count: number } => row.appid !== null && row.owner_count !== null
  )
  const hasMore = rows.length > POPULAR_GAMES_PAGE_SIZE
  const page = rows.slice(0, POPULAR_GAMES_PAGE_SIZE)

  const appids = page.map((row) => row.appid)
  const namesByAppid = new Map<string, string>()
  if (appids.length > 0) {
    const { data: gameRows } = await supabase.from('games').select('appid, name').in('appid', appids)
    for (const game of gameRows ?? []) namesByAppid.set(game.appid, game.name)
  }

  return {
    games: page.map((row) => ({
      appid: row.appid,
      name: namesByAppid.get(row.appid) ?? row.appid,
      ownerCount: row.owner_count
    })),
    hasMore
  }
}
