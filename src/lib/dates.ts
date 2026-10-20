const DAY = 86_400_000

// Deadlines are 11:59 PM on a date in the timezone of the admin who set them, so
// they're shown in that timezone: everyone sees the date the admin picked.
const fmt = (opts: Intl.DateTimeFormatOptions, timeZone?: string) =>
  new Intl.DateTimeFormat('en-US', { ...opts, timeZone })

/** "Fri, Oct 24". */
export function formatDeadline(iso: string, timeZone?: string) {
  return fmt(
    { weekday: 'short', month: 'short', day: 'numeric' },
    timeZone,
  ).format(new Date(iso))
}

const dayKey = (d: Date, timeZone?: string) =>
  fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }, timeZone).format(d)

/** Whole days left, counting a partial day as one. 0 once it has passed. */
export function daysLeft(iso: string, now = new Date()) {
  const ms = new Date(iso).getTime() - now.getTime()
  return ms <= 0 ? 0 : Math.ceil(ms / DAY)
}

/** "closes Fri" this week, "closes Oct 30" further out, "closes today" on the day. */
export function closesShort(iso: string, timeZone?: string, now = new Date()) {
  const left = daysLeft(iso, now)
  if (left === 0) return 'closed'
  const d = new Date(iso)
  if (dayKey(d, timeZone) === dayKey(now, timeZone)) return 'closes today'
  if (left <= 6)
    return `closes ${fmt({ weekday: 'short' }, timeZone).format(d)}`
  return `closes ${fmt({ month: 'short', day: 'numeric' }, timeZone).format(d)}`
}

/** "3 days left", "1 day left", "Last day". */
export function daysLeftLabel(iso: string, now = new Date()) {
  const left = daysLeft(iso, now)
  if (left <= 1) return 'Last day'
  return `${left} days left`
}

/** yyyy-mm-dd for a local date, as <input type="date"> wants. */
export function toDateInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function addDays(d: Date, days: number) {
  const out = new Date(d)
  out.setDate(out.getDate() + days)
  return out
}

/** The viewer's IANA timezone, e.g. "America/New_York". */
export function localTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}
