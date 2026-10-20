import { useEffect, useState } from 'react'

const matchesNow = (query: string) =>
  typeof window !== 'undefined' && window.matchMedia(query).matches

/**
 * Tracks a media query. Reads it synchronously on first render in the browser,
 * so components mounted on demand (sheets, dialogs) get the right answer
 * immediately instead of flashing the wrong layout. False during SSR.
 */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => matchesNow(query))
  useEffect(() => {
    const mql = window.matchMedia(query)
    const update = () => setMatches(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [query])
  return matches
}
