import { describe, expect, it } from 'vitest'
import { closesShort, daysLeft, daysLeftLabel, formatDeadline } from './dates'

// 11:59:59 PM Fri Oct 30 2026 in New York = 03:59:59 UTC Sat Oct 31.
const deadline = '2026-10-31T03:59:59Z'
const ny = 'America/New_York'

describe('deadlines', () => {
  it('shows the date in the vote timezone', () => {
    expect(formatDeadline(deadline, ny)).toBe('Fri, Oct 30')
    expect(formatDeadline(deadline, 'UTC')).toBe('Sat, Oct 31')
  })
  it('counts calendar days in the vote timezone', () => {
    const d = (iso: string) => daysLeft(deadline, ny, new Date(iso))
    expect(d('2026-10-28T12:00:00Z')).toBe(3) // Wed 8 AM NY: Wed, Thu, Fri
    expect(d('2026-10-30T20:00:00Z')).toBe(1) // Fri 4 PM NY
    expect(d('2026-10-31T04:00:00Z')).toBe(0) // past the deadline
    expect(daysLeftLabel(deadline, ny, new Date('2026-10-30T20:00:00Z'))).toBe(
      'Last day',
    )
    expect(daysLeftLabel(deadline, ny, new Date('2026-10-31T05:00:00Z'))).toBe(
      'Voting closed',
    )
  })
  it('does not count 24h blocks', () => {
    // Fri 1 AM NY is under 23 hours from the deadline but still the last day;
    // Thu 11:30 PM NY is 24.5h out and has 2 calendar days left.
    expect(daysLeft(deadline, ny, new Date('2026-10-30T05:00:00Z'))).toBe(1)
    expect(daysLeft(deadline, ny, new Date('2026-10-30T03:30:00Z'))).toBe(2)
    // Wed 11:59 PM NY: 48h out, but 3 calendar days (Wed, Thu, Fri).
    expect(daysLeft(deadline, ny, new Date('2026-10-29T03:59:59Z'))).toBe(3)
  })
  it('says closes today, a weekday, or a date', () => {
    expect(closesShort(deadline, ny, new Date('2026-10-30T15:00:00Z'))).toBe(
      'closes today',
    )
    expect(closesShort(deadline, ny, new Date('2026-10-27T15:00:00Z'))).toBe(
      'closes Fri',
    )
    expect(closesShort(deadline, ny, new Date('2026-10-20T15:00:00Z'))).toBe(
      'closes Oct 30',
    )
  })
})
