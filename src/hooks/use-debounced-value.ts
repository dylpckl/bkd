import { useEffect, useState } from 'react'

/** `value`, updated only after it has stopped changing for `ms` milliseconds. */
export function useDebouncedValue<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}
