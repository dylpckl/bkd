import { describe, expect, it } from 'vitest'
import {
  formatRating,
  overallAverage,
  pickLine,
  readingDates,
  readingMonths,
  shortMonthYear,
  startYear,
} from './history'

const tz = 'UTC'
const finished = {
  status: 'finished' as const,
  started_at: '2026-08-30T12:00:00Z',
  finished_at: '2026-10-10T12:00:00Z',
}
const reading = {
  status: 'reading' as const,
  started_at: '2026-10-12T12:00:00Z',
  finished_at: null,
}

describe('readingDates', () => {
  it('shows the range for a finished book', () => {
    expect(readingDates(finished, tz)).toBe('Aug 30 – Oct 10')
  })
  it('shows "now" while reading', () => {
    expect(readingDates(reading, tz)).toBe('Oct 12 – now · reading')
  })
})

describe('readingMonths', () => {
  it('shows months', () => {
    expect(readingMonths(finished, tz)).toBe('Aug – Oct')
    expect(readingMonths(reading, tz)).toBe('Oct – now')
  })
  it('collapses a single month', () => {
    expect(
      readingMonths({ ...finished, started_at: '2026-10-01T12:00:00Z' }, tz),
    ).toBe('Oct')
  })
})

describe('pickLine', () => {
  const base = { round_id: 'r', nominee_count: 5, count_rounds: 1 }
  it('describes how the book was picked', () => {
    expect(pickLine({ ...base, pick_method: 'irv' })).toBe(
      'Picked from 5 · won outright',
    )
    expect(pickLine({ ...base, pick_method: 'irv', count_rounds: 3 })).toBe(
      'Picked from 5 · after 3 counts',
    )
    expect(pickLine({ ...base, pick_method: 'random' })).toBe(
      'Picked at random from 5',
    )
    expect(pickLine({ ...base, pick_method: 'single' })).toBe(
      'The only nomination',
    )
  })
  it('says nothing for a book added without a vote', () => {
    expect(pickLine({ ...base, round_id: null, pick_method: null })).toBeNull()
  })
})

describe('dates and averages', () => {
  it('formats years', () => {
    expect(startYear(finished, tz)).toBe('2026')
    expect(shortMonthYear('2025-01-15T00:00:00Z', tz)).toBe("Jan '25")
  })
  it('averages rated books only', () => {
    expect(
      overallAverage([{ average: 3.7 }, { average: null }, { average: 4.0 }]),
    ).toBe(3.9)
    expect(overallAverage([{ average: null }])).toBeNull()
    expect(formatRating(4)).toBe('4.0')
  })
})
