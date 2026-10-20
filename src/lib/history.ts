// Copy for the History list and the club home carousel.

type Dated = {
  status: 'reading' | 'finished'
  started_at: string
  finished_at: string | null
}

type Picked = {
  round_id: string | null
  pick_method: string | null
  nominee_count: number
  count_rounds: number
}

const fmt = (opts: Intl.DateTimeFormatOptions, timeZone?: string) =>
  new Intl.DateTimeFormat('en-US', { ...opts, timeZone })

/** "Aug 30 – Oct 10", or "Oct 12 – now · reading". */
export function readingDates(b: Dated, timeZone?: string) {
  const day = fmt({ month: 'short', day: 'numeric' }, timeZone)
  const start = day.format(new Date(b.started_at))
  if (b.status === 'reading' || !b.finished_at)
    return `${start} – now · reading`
  return `${start} – ${day.format(new Date(b.finished_at))}`
}

/** "Sep – Oct", "Oct", or "Oct – now" for the carousel. */
export function readingMonths(b: Dated, timeZone?: string) {
  const month = fmt({ month: 'short' }, timeZone)
  const start = month.format(new Date(b.started_at))
  if (b.status === 'reading' || !b.finished_at) return `${start} – now`
  const end = month.format(new Date(b.finished_at))
  return start === end ? start : `${start} – ${end}`
}

/** "Picked from 5 · won outright", "Picked from 4 · after 3 counts"; null without a vote. */
export function pickLine(b: Picked) {
  if (!b.round_id || !b.pick_method) return null
  const n = b.nominee_count
  if (b.pick_method === 'single') return 'The only nomination'
  if (b.pick_method === 'random') return `Picked at random from ${n}`
  if (b.count_rounds <= 1) return `Picked from ${n} · won outright`
  return `Picked from ${n} · after ${b.count_rounds} counts`
}

/** The year a book was started, for the History section headings. */
export function startYear(b: Pick<Dated, 'started_at'>, timeZone?: string) {
  return fmt({ year: 'numeric' }, timeZone).format(new Date(b.started_at))
}

/** "Jan '25". */
export function shortMonthYear(iso: string, timeZone?: string) {
  const d = new Date(iso)
  const month = fmt({ month: 'short' }, timeZone).format(d)
  const year = fmt({ year: '2-digit' }, timeZone).format(d)
  return `${month} '${year}`
}

/** Mean of the books' averages, to one decimal; null when nothing is rated. */
export function overallAverage(books: { average: number | null }[]) {
  const rated = books.flatMap((b) => (b.average === null ? [] : [b.average]))
  if (rated.length === 0) return null
  return Math.round((rated.reduce((a, b) => a + b, 0) / rated.length) * 10) / 10
}

/** Ratings always show one decimal: "4.0", not "4". */
export function formatRating(n: number) {
  return n.toFixed(1)
}
