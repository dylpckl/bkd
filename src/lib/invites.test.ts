import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { describeInvite, inviteStatusLine } from './invites'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-20T12:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('describeInvite', () => {
  it('matches the Invite friends copy', () => {
    expect(
      describeInvite({
        expires_at: '2026-10-27T12:00:00Z',
        max_uses: 20,
        use_count: 0,
      }),
    ).toBe('Works for 7 days and up to 20 people.')
  })
  it('handles no limits', () => {
    expect(
      describeInvite({ expires_at: null, max_uses: null, use_count: 0 }),
    ).toBe('Works until you turn it off.')
  })
})

describe('inviteStatusLine', () => {
  it('shows expiry and uses', () => {
    expect(
      inviteStatusLine({
        expires_at: '2026-10-27T12:00:00Z',
        max_uses: 10,
        use_count: 2,
      }),
    ).toBe('Expires Oct 27 · 2 of 10 uses')
    expect(
      inviteStatusLine({ expires_at: null, max_uses: null, use_count: 1 }),
    ).toBe('No expiry · 1 use')
  })
})
