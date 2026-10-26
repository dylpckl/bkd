// fetch() that retries the failures worth retrying: network errors, 429 and 5xx.
// Pure TypeScript (no Deno APIs) so the app's unit tests can import it.

export type RetryOptions = {
  /** Total attempts, including the first. */
  attempts?: number
  /** Delay before the first retry; each later retry waits three times longer. */
  baseDelayMs?: number
  fetch?: typeof fetch
  sleep?: (ms: number) => Promise<void>
}

const RETRYABLE = new Set([429, 500, 502, 503, 504])

export function isRetryable(status: number) {
  return RETRYABLE.has(status)
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Returns the first response that isn't retryable, or the last response once
 * attempts run out. Throws only if the final attempt fails at the network level.
 */
export async function fetchWithRetry(
  url: URL | string,
  {
    attempts = 3,
    baseDelayMs = 250,
    fetch: doFetch = fetch,
    sleep = wait,
  }: RetryOptions = {},
): Promise<Response> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      // 250ms, 750ms, … with up to 50% jitter so parallel requests spread out.
      const delay = baseDelayMs * 3 ** (i - 1)
      await sleep(delay + Math.random() * delay * 0.5)
    }
    try {
      const res = await doFetch(url)
      if (!isRetryable(res.status) || i === attempts - 1) return res
      await res.body?.cancel()
    } catch (e) {
      lastError = e
      if (i === attempts - 1) throw e
    }
  }
  throw lastError
}
