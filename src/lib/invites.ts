type InviteLimits = {
  expires_at: string | null
  max_uses: number | null
  use_count: number
}

const shortDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
})

function daysUntil(iso: string) {
  return Math.max(
    1,
    Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000),
  )
}

/** "Works for 7 days and up to 20 people." */
export function describeInvite(invite: InviteLimits) {
  const time = invite.expires_at
    ? `for ${daysUntil(invite.expires_at)} ${daysUntil(invite.expires_at) === 1 ? 'day' : 'days'}`
    : 'until you turn it off'
  const people = invite.max_uses ? ` and up to ${invite.max_uses} people` : ''
  return `Works ${time}${people}.`
}

/** "Expires Oct 27 · 2 of 10 uses" */
export function inviteStatusLine(
  invite: InviteLimits & { expired?: boolean; maxed?: boolean },
) {
  const parts: string[] = []
  if (invite.expires_at)
    parts.push(
      `${invite.expired ? 'Expired' : 'Expires'} ${shortDate.format(new Date(invite.expires_at))}`,
    )
  else parts.push('No expiry')
  parts.push(
    invite.max_uses
      ? `${invite.use_count} of ${invite.max_uses} uses`
      : `${invite.use_count} ${invite.use_count === 1 ? 'use' : 'uses'}`,
  )
  return parts.join(' · ')
}
