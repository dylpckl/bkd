import { createServerClient } from '@supabase/ssr'
import { getCookies, setCookie } from '@tanstack/react-start/server'
import { createServerOnlyFn } from '@tanstack/react-start'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '#/lib/config'
import type { Database } from './database.types'

export const getSupabaseServerClient = createServerOnlyFn(() =>
  createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return Object.entries(getCookies()).map(([name, value]) => ({
          name,
          value,
        }))
      },
      setAll(cookies) {
        for (const { name, value, options } of cookies)
          setCookie(name, value, options)
      },
    },
  }),
)
