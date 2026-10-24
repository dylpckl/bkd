import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '#/lib/config'
import type { Database } from './database.types'

let client: SupabaseClient<Database> | undefined

export function getSupabaseBrowserClient() {
  client ??= createBrowserClient<Database>(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
  )
  return client
}
