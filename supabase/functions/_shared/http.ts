export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

export function json(
  body: unknown,
  status = 200,
  extra: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extra },
  })
}

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Best-effort per-user limiter: a fixed window held in this isolate's memory.
 * Limits: each edge isolate counts separately and resets when it is recycled,
 * so the real ceiling is (limit x live isolates). It blunts a single client
 * hammering Google Books quota; it is not a hard guarantee.
 */
const windows = new Map<string, { start: number; count: number }>()
export function rateLimited(
  userId: string,
  limit = 30,
  windowMs = 60_000,
  now = Date.now(),
) {
  if (windows.size > 5000)
    for (const [k, w] of windows)
      if (now - w.start >= windowMs) windows.delete(k)
  const w = windows.get(userId)
  if (!w || now - w.start >= windowMs) {
    windows.set(userId, { start: now, count: 1 })
    return false
  }
  w.count += 1
  return w.count > limit
}
