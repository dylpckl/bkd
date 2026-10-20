import { createIsomorphicFn } from '@tanstack/react-start'
import type { User } from '@supabase/supabase-js'
import { getSupabaseBrowserClient } from './supabase/browser'
import { getSupabaseServerClient } from './supabase/server'

export type AuthUser = {
  id: string
  email: string | null
  /** Sign-in methods linked to the account, e.g. ['email', 'google']. */
  providers: string[]
}

function toAuthUser(user: User | null | undefined): AuthUser | null {
  if (!user) return null
  const providers = (user.identities ?? []).map((i) => i.provider)
  return { id: user.id, email: user.email ?? null, providers }
}

/**
 * The signed-in user. The server verifies the JWT with Supabase; in the browser
 * the local session is enough for routing, since RLS guards the data itself.
 */
export const getAuthUser = createIsomorphicFn()
  .server(async () => {
    const { data } = await getSupabaseServerClient().auth.getUser()
    return toAuthUser(data.user)
  })
  .client(async () => {
    const { data } = await getSupabaseBrowserClient().auth.getSession()
    return toAuthUser(data.session?.user)
  })

/** Only same-origin relative paths are allowed as a post-login destination. */
export function safeNext(next: unknown, fallback = '/clubs'): string {
  if (typeof next !== 'string') return fallback
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\'))
    return fallback
  return next
}
