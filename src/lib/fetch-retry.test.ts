import { describe, expect, it, vi } from 'vitest'
import { fetchWithRetry } from '../../supabase/functions/_shared/fetch-retry.ts'

const res = (status: number) =>
  new Response(status === 200 ? '{}' : '', { status })

function setup(responses: (number | Error)[]) {
  const fetch = vi.fn(async () => {
    const next = responses.shift()
    if (next instanceof Error) throw next
    return res(next ?? 200)
  })
  const sleep = vi.fn(async (_ms: number) => {})
  return {
    fetch: fetch as unknown as typeof globalThis.fetch,
    sleep,
    calls: fetch,
  }
}

describe('fetchWithRetry', () => {
  it('returns the first good response without waiting', async () => {
    const { fetch, sleep, calls } = setup([200])
    expect(
      (await fetchWithRetry('https://x.test', { fetch, sleep })).status,
    ).toBe(200)
    expect(calls).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('retries 503s and network errors, then succeeds', async () => {
    const { fetch, sleep, calls } = setup([503, new TypeError('reset'), 200])
    expect(
      (await fetchWithRetry('https://x.test', { fetch, sleep })).status,
    ).toBe(200)
    expect(calls).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenCalledTimes(2)
  })

  it('backs off: the second wait is about three times the first', async () => {
    const { fetch, sleep } = setup([503, 503, 200])
    await fetchWithRetry('https://x.test', { fetch, sleep, baseDelayMs: 100 })
    const [first, second] = sleep.mock.calls.map((c) => c[0])
    expect(first).toBeGreaterThanOrEqual(100)
    expect(first).toBeLessThan(150)
    expect(second).toBeGreaterThanOrEqual(300)
    expect(second).toBeLessThan(450)
  })

  it('gives back the last response once attempts run out', async () => {
    const { fetch, sleep, calls } = setup([503, 429, 503])
    expect(
      (await fetchWithRetry('https://x.test', { fetch, sleep })).status,
    ).toBe(503)
    expect(calls).toHaveBeenCalledTimes(3)
  })

  it('does not retry a 404', async () => {
    const { fetch, sleep, calls } = setup([404])
    expect(
      (await fetchWithRetry('https://x.test', { fetch, sleep })).status,
    ).toBe(404)
    expect(calls).toHaveBeenCalledTimes(1)
  })

  it('throws when the last attempt fails at the network level', async () => {
    const { fetch, sleep } = setup([503, 503, new TypeError('offline')])
    await expect(
      fetchWithRetry('https://x.test', { fetch, sleep }),
    ).rejects.toThrow('offline')
  })
})
