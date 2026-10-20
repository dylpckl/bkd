// GET/POST { q } → { results: Book[] }. Proxies Google Books with the server-side key.
import { corsHeaders, json } from '../_shared/http.ts'
import { UpstreamError, searchBooks } from '../_shared/books-source.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders })

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
