import { createClient } from '@supabase/supabase-js'
import type { Database } from '@shared/db-types'
import { SUPABASE_ANON_KEY, SUPABASE_PROJECT_URL } from '@shared/env'

/**
 * The renderer's only Supabase client. Built with the anon key, so every
 * read and write it makes is subject to RLS (see supabase/migrations) —
 * nothing privileged happens here. Session storage is handled internally
 * by supabase-js; the session itself arrives via `setSession` after the
 * Steam auth callback (see src/renderer/src/App.tsx).
 */
export const supabase = createClient<Database>(SUPABASE_PROJECT_URL, SUPABASE_ANON_KEY)
