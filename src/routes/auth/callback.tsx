import { createFileRoute } from '@tanstack/react-router'
import {
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
} from '@supabase/ssr'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '#/lib/config'
import { safeNext } from '#/lib/auth'
import type { Database } from '#/lib/supabase/database.types'

// Confirmation, magic-link, password-reset and Google sign-ins all land here with a
// PKCE code. Exchange it for a session cookie, then continue to `next`.
export const Route = createFileRoute('/auth/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const next = safeNext(url.searchParams.get('next'))
        const headers = new Headers()
        const redirectTo = (to: URL) => {
          headers.set('Location', to.toString())
          return new Response(null, { status: 303, headers })
        }
        const failed = (reason: string) => {
          const to = new URL('/login', url.origin)
          to.searchParams.set('error', reason)
          if (next !== '/clubs') to.searchParams.set('next', next)
          return redirectTo(to)
        }

        const code = url.searchParams.get('code')
        if (url.searchParams.get('error')) return failed('link_expired')
        if (!code) return failed('link_invalid')

        const supabase = createServerClient<Database>(
          SUPABASE_URL,
          SUPABASE_PUBLISHABLE_KEY,
          {
            cookies: {
              getAll: () =>
                parseCookieHeader(request.headers.get('Cookie') ?? '').map(
                  (c) => ({ name: c.name, value: c.value }),
                ),
              setAll: (cookies) => {
                for (const { name, value, options } of cookies) {
                  headers.append(
                    'Set-Cookie',
                    serializeCookieHeader(name, value, options),
                  )
                }
              },
            },
          },
        )
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) return failed('link_expired')
        return redirectTo(new URL(next, url.origin))
      },
    },
  },
})
