// POST { round_id, google_books_id, pitch?, replace_nomination_id? } → { nomination_id }
// Fetches the book from Google or Open Library (so book data never comes from the client), caches it
// with the service role, then nominates as the signed-in user so every rule applies.
import { corsHeaders, json, rateLimited, UUID_RE } from '../_shared/http.ts'
import { asService, asUser, getUserId } from '../_shared/rest.ts'
import { UpstreamError, getBook } from '../_shared/books-source.ts'
import { toBookRow } from '../_shared/google-books.ts'

const KNOWN_ERRORS = new Set([
  'not_allowed',
  'round_not_open',
  'nomination_limit_reached',
  'already_nominated',
  'invalid_input',
])

// Postgres errors that mean the caller's input was bad, not that we broke:
// check_violation (23514, e.g. pitch too long) and invalid_text_representation
// (22P02, e.g. a malformed uuid).
const INPUT_ERROR_CODES = new Set(['23514', '22P02'])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authorization = req.headers.get('Authorization')
  if (!authorization) return json({ error: 'not_authenticated' }, 401)

  // The anon key is a valid bearer token too; require a real signed-in user.
  const userId = await getUserId(authorization)
  if (!userId) return json({ error: 'not_authenticated' }, 401)
  // Same best-effort per-user limit as search-books (see rateLimited's caveats).
  if (rateLimited(`nominate:${userId}`))
    return json({ error: 'rate_limited' }, 429)

  let body: {
    round_id?: unknown
    google_books_id?: unknown
    pitch?: unknown
    replace_nomination_id?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  if (
    typeof body.round_id !== 'string' ||
    !UUID_RE.test(body.round_id) ||
    typeof body.google_books_id !== 'string' ||
    !body.google_books_id ||
    body.google_books_id.length > 100
  )
    return json({ error: 'bad_request' }, 400)
  if (
    body.pitch != null &&
    (typeof body.pitch !== 'string' || body.pitch.length > 280)
  )
    return json({ error: 'invalid_input' }, 400)
  if (
    body.replace_nomination_id != null &&
    (typeof body.replace_nomination_id !== 'string' ||
      !UUID_RE.test(body.replace_nomination_id))
  )
    return json({ error: 'invalid_input' }, 400)
  const { round_id, google_books_id } = body

  const user = asUser(authorization)

  // Cheap membership check (RLS hides other clubs' rounds) before spending a Google request.
  const { data: rounds } = await user.get<{ status: string }[]>(
    `rounds?id=eq.${encodeURIComponent(round_id)}&select=status`,
  )
  const round = rounds?.[0]
  if (!round) return json({ error: 'not_allowed' }, 403)
  if (round.status !== 'open') return json({ error: 'round_not_open' }, 409)

  let cached: { id: string } | undefined
  try {
    const book = await getBook(google_books_id)
    if (!book) return json({ error: 'book_not_found' }, 404)
    const { data: cachedRows, error: cacheError } = await asService.upsert<
      { id: string }[]
    >('books', toBookRow(book), 'google_books_id')
    cached = cachedRows?.[0]
    if (cacheError || !cached) {
      console.error(cacheError)
      return json({ error: 'server_error' }, 500)
    }
  } catch (e) {
    console.error(e)
    if (!(e instanceof UpstreamError))
      return json({ error: 'server_error' }, 500)
    // The source is down. A book someone has nominated before is already saved,
    // so use that copy rather than fail.
    const { data: saved } = await user.get<{ id: string }[]>(
      `books?google_books_id=eq.${encodeURIComponent(google_books_id)}&select=id`,
    )
    cached = saved?.[0]
    if (!cached) return json({ error: 'search_unavailable' }, 502)
  }

  const { data: nominationId, error } = await user.rpc<string>('nominate', {
    p_round_id: round_id,
    p_book_id: cached.id,
    p_pitch: body.pitch ?? null,
    p_replace_id: body.replace_nomination_id ?? null,
  })
  if (error) {
    const code = KNOWN_ERRORS.has(error.message)
      ? error.message
      : error.code && INPUT_ERROR_CODES.has(error.code)
        ? 'invalid_input'
        : 'server_error'
    if (code === 'server_error') console.error(error)
    return json(
      { error: code },
      code === 'not_allowed'
        ? 403
        : code === 'invalid_input'
          ? 400
          : code === 'server_error'
            ? 500
            : 409,
    )
  }
  return json({ nomination_id: nominationId, book_id: cached.id })
})
