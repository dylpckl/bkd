import { createIsomorphicFn } from '@tanstack/react-start'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseBrowserClient } from './browser'
import { getSupabaseServerClient } from './server'
import type { Database } from './database.types'

export type Supabase = SupabaseClient<Database>
export type { Database } from './database.types'

/** The request's cookie-backed client on the server, the shared browser client in the browser. */
export const getSupabase = createIsomorphicFn()
  .server((): Supabase => getSupabaseServerClient())
  .client((): Supabase => getSupabaseBrowserClient())
