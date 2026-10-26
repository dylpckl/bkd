// GET/POST { q } → { results: Book[] }. Proxies Google Books with the server-side key,
// falling back to Open Library when Google is down.
import { corsHeaders, json, rateLimited } from '../_shared/http.ts'
import { getUserId } from '../_shared/rest.ts'
import { UpstreamError, searchBooks } from '../_shared/books-source.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders })

  // Signed-in users only: the anon key alone must not spend our Google quota.
  const authorization = req.headers.get('Authorization')
  const userId = authorization ? await getUserId(authorization) : null
  if (!userId) return json({ error: 'not_authenticated' }, 401)
  if (rateLimited(userId)) return json({ error: 'rate_limited' }, 429)

  let q = new URL(req.url).searchParams.get('q') ?? ''
  if (req.method === 'POST') {
    try {
      q = String((await req.json()).q ?? '')
    } catch {
      return json({ error: 'bad_request' }, 400)
    }
  }
  q = q.trim().slice(0, 200)
  if (q.length < 2) return json({ results: [] })

  try {
    const results = await searchBooks(q)
    return json({ results }, 200, { 'Cache-Control': 'private, max-age=60' })
  } catch (e) {
    console.error(e)
    return json(
      {
        error:
          e instanceof UpstreamError ? 'search_unavailable' : 'server_error',
      },
      502,
    )
  }
})
