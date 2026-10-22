export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Autosave that never has two saves in flight and never lets an older one land
 * after a newer one. `submit` debounces; whatever was submitted last is always
 * what gets sent next. The state is 'saving' while anything is waiting or in
 * flight, and only becomes 'saved' (or 'error') once nothing newer is pending.
 */
export function createSaveQueue<T>(options: {
  save: (value: T) => Promise<unknown>
  onState: (state: SaveState) => void
  onSaved?: () => void
  /** Whether a failure is worth another try (network blips, not "round closed"). */
  shouldRetry?: (error: unknown) => boolean
  debounceMs?: number
  retries?: number
  retryDelayMs?: number
}) {
  const {
    save,
    onState,
    onSaved,
    shouldRetry = () => false,
    debounceMs = 600,
    retries = 2,
    retryDelayMs = 500,
  } = options

  let latest: { value: T } | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let running = false

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  async function attempt(value: T) {
    for (let n = 0; ; n++) {
      try {
        await save(value)
        return true
      } catch (error) {
        if (n >= retries || !shouldRetry(error)) return false
        await sleep(retryDelayMs * (n + 1))
      }
    }
  }

  async function drain() {
    if (running) return
    running = true
    let ok = true
    while (latest) {
      const { value } = latest
      latest = null
      ok = await attempt(value)
      if (ok) onSaved?.()
    }
    running = false
    // A change made during the last await keeps us in the loop; one still in
    // the debounce wait is pending and will report its own result.
    if (!timer) onState(ok ? 'saved' : 'error')
  }

  function flush() {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
    if (latest) void drain()
  }

  return {
    submit(value: T) {
      latest = { value }
      onState('saving')
      clearTimeout(timer)
      timer = setTimeout(() => {
        timer = undefined
        void drain()
      }, debounceMs)
    },
    /** Sends whatever is waiting out the debounce right now. */
    flush,
  }
}
