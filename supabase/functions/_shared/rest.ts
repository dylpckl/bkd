// Minimal PostgREST client, so functions have no npm dependencies.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

export type RestError = { message: string; code?: string; status: number }
type Result<T> = { data: T; error: null } | { data: null; error: RestError }

async function call<T>(
  path: string,
  init: RequestInit,
  headers: Record<string, string>,
): Promise<Result<T>> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
      ...(init.headers as Record<string, string>),
    },
  })
  const text = await res.text()
  let body: { message?: string; code?: string } | null = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    // Gateways can answer with HTML (e.g. a 502 page); fall back to the status text.
  }
  if (!res.ok)
    return {
      data: null,
      error: {
        message: body?.message ?? res.statusText,
        code: body?.code,
        status: res.status,
      },
    }
  return { data: body as T, error: null }
}

/** Requests made as the caller, so RLS and auth.uid() apply. */
export function asUser(authorization: string) {
  const headers = { apikey: ANON_KEY, Authorization: authorization }
  return {
    get: <T>(path: string) => call<T>(path, { method: 'GET' }, headers),
    rpc: <T>(fn: string, args: Record<string, unknown>) =>
      call<T>(
        `rpc/${fn}`,
        { method: 'POST', body: JSON.stringify(args) },
        headers,
      ),
  }
}

/** Service-role requests. Bypasses RLS; only for writes users can't make themselves. */
export const asService = {
  rpc: <T>(fn: string, args: Record<string, unknown>) =>
    call<T>(
      `rpc/${fn}`,
      { method: 'POST', body: JSON.stringify(args) },
      { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    ),
  upsert: <T>(
    table: string,
    row: Record<string, unknown>,
    onConflict: string,
  ) =>
    call<T>(
      `${table}?on_conflict=${onConflict}`,
      {
        method: 'POST',
        body: JSON.stringify(row),
        headers: {
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
      },
      { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    ),
}

/** Compares two strings without leaking where they differ: hash both, then XOR every byte. */
async function safeEqual(a: string, b: string) {
  const enc = new TextEncoder()
  const [x, y] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ])
  const xa = new Uint8Array(x)
  const ya = new Uint8Array(y)
  let diff = 0
  for (let i = 0; i < xa.length; i++) diff |= xa[i] ^ ya[i]
  return diff === 0
}

/**
 * True when the request carries the service-role key (pg_cron), not a user's JWT.
 * The Vault secret `close_round_key` must therefore be the legacy service_role JWT,
 * identical to this function's SUPABASE_SERVICE_ROLE_KEY. A new-style `sb_secret_...`
 * key is not accepted.
 */
export async function isServiceCall(authorization: string | null) {
  if (authorization === null) return false
  return safeEqual(authorization, `Bearer ${SERVICE_KEY}`)
}

/**
 * Verifies the bearer token belongs to a real signed-in user. The anon key is
 * itself a valid JWT, so the gateway lets anon-key-only callers through; asking
 * the auth server for the user rejects those (their token has no user).
 */
export async function getUserId(authorization: string): Promise<string | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, Authorization: authorization },
    })
    if (!res.ok) return null
    const user = (await res.json()) as { id?: string; is_anonymous?: boolean }
    return user.id && !user.is_anonymous ? user.id : null
  } catch {
    return null
  }
}
