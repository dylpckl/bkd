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
  const body = text ? JSON.parse(text) : null
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
