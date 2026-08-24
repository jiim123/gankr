/**
 * Public Supabase config, safe to bundle into any process. The anon key is
 * designed to be handed to untrusted clients — every table it can reach is
 * behind RLS (see supabase/migrations) — so it is not a secret the way the
 * service role key or the Steam Web API key are. Those two never appear in
 * this codebase; they live only as Edge Function secrets and in the
 * gitignored .env.
 *
 * Values are read from `VITE_`-prefixed .env entries. electron-vite exposes
 * that exact prefix to all three builds (main, preload, renderer) — see the
 * envPrefix defaults in electron-vite itself — which is what lets one
 * module serve every side of the app instead of duplicating the constants
 * per process.
 */

declare global {
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_PROJECT_URL: string
    readonly VITE_SUPABASE_ANON_KEY: string
  }
}

type RequiredEnvKey = 'VITE_SUPABASE_PROJECT_URL' | 'VITE_SUPABASE_ANON_KEY'

function requireEnv(name: RequiredEnvKey): string {
  const value = import.meta.env[name]
  if (!value) {
    throw new Error(`Missing required env var ${name}. Check .env at the repo root.`)
  }
  return value
}

export const SUPABASE_PROJECT_URL = requireEnv('VITE_SUPABASE_PROJECT_URL')
export const SUPABASE_ANON_KEY = requireEnv('VITE_SUPABASE_ANON_KEY')
