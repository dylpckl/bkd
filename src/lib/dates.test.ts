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
  it('counts partial days as a day', () => {
    expect(daysLeft(deadline, new Date('2026-10-28T12:00:00Z'))).toBe(3)
    expect(daysLeft(deadline, new Date('2026-11-01T00:00:00Z'))).toBe(0)
    expect(daysLeftLabel(deadline, new Date('2026-10-30T20:00:00Z'))).toBe(
      'Last day',
    )
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
