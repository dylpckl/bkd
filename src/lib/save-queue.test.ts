import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSaveQueue } from './save-queue'
import type { SaveState } from './save-queue'
import { isTransientError } from './errors'
import { seededOrder } from './shuffle'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('createSaveQueue', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('keeps one save in flight and finishes with the latest value', async () => {
    const calls: { value: string; d: ReturnType<typeof deferred> }[] = []
    const states: SaveState[] = []
    const q = createSaveQueue<string>({
      save: (value) => {
        const d = deferred()
        calls.push({ value, d })
        return d.promise
      },
      onState: (s) => states.push(s),
      debounceMs: 10,
    })

    q.submit('a')
    await vi.advanceTimersByTimeAsync(10)
    expect(calls.map((c) => c.value)).toEqual(['a'])

    // Newer changes while 'a' is in flight wait for it.
    q.submit('b')
    q.submit('c')
    await vi.advanceTimersByTimeAsync(10)
    expect(calls.map((c) => c.value)).toEqual(['a'])

    calls[0].d.resolve()
    await vi.advanceTimersByTimeAsync(0)
    // 'a' settling must not report Saved while 'c' is outstanding.
    expect(states.at(-1)).toBe('saving')
    expect(calls.map((c) => c.value)).toEqual(['a', 'c'])

    calls[1].d.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(states.at(-1)).toBe('saved')
  })

  it('does not report Saved while a change is still in the debounce', async () => {
    const states: SaveState[] = []
    const q = createSaveQueue<string>({
      save: () => Promise.resolve(),
      onState: (s) => states.push(s),
      debounceMs: 10,
    })
    q.submit('a')
    await vi.advanceTimersByTimeAsync(10)
    expect(states.at(-1)).toBe('saved')

    q.submit('b')
    expect(states.at(-1)).toBe('saving')
  })

  it('retries transient errors only', async () => {
    const save = vi
      .fn<(v: string) => Promise<void>>()
      .mockRejectedValueOnce({ message: 'Failed to fetch' })
      .mockResolvedValueOnce()
    const states: SaveState[] = []
    const q = createSaveQueue<string>({
      save,
      onState: (s) => states.push(s),
      shouldRetry: isTransientError,
      debounceMs: 1,
      retryDelayMs: 1,
    })
    q.submit('a')
    await vi.advanceTimersByTimeAsync(10)
    expect(save).toHaveBeenCalledTimes(2)
    expect(states.at(-1)).toBe('saved')

    save.mockReset()
    save.mockRejectedValue({ message: 'round_not_open', code: 'P0001' })
    q.submit('b')
    await vi.advanceTimersByTimeAsync(10)
    expect(save).toHaveBeenCalledTimes(1)
    expect(states.at(-1)).toBe('error')
  })

  it('flush sends the waiting value immediately', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const q = createSaveQueue<string>({
      save,
      onState: () => {},
      debounceMs: 10_000,
    })
    q.submit('a')
    q.flush()
    await vi.advanceTimersByTimeAsync(0)
    expect(save).toHaveBeenCalledWith('a')
  })
})

describe('isTransientError', () => {
  it('treats coded database errors as permanent', () => {
    expect(isTransientError({ message: 'round_not_open', code: 'P0001' })).toBe(
      false,
    )
    expect(isTransientError({ message: 'TypeError: Failed to fetch' })).toBe(
      true,
    )
    expect(isTransientError({ message: 'timeout', code: '57014' })).toBe(true)
  })
})

describe('seededOrder', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f']

  it('is stable for the same seed, whatever the input order', () => {
    const one = seededOrder(ids, 'user1:round1')
    expect(seededOrder([...ids].reverse(), 'user1:round1')).toEqual(one)
    expect([...one].sort()).toEqual(ids)
  })

  it('differs between users', () => {
    const orders = new Set(
      ['u1', 'u2', 'u3', 'u4', 'u5'].map((u) =>
        seededOrder(ids, `${u}:round1`).join(''),
      ),
    )
    expect(orders.size).toBeGreaterThan(1)
  })
})
