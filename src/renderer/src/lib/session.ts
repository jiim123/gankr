import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface SessionState {
  session: Session | null
  loading: boolean
}

/**
 * Tracks the current supabase-js session: the initial load from persisted
 * storage, and every sign-in/sign-out/refresh after that. `loading` stays
 * true only for that first check, so callers can avoid a flash of the
 * signed-out state before it resolves.
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ session: null, loading: true })

  useEffect(() => {
    let cancelled = false

    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setState({ session: data.session, loading: false })
    })

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, loading: false })
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  return state
}
