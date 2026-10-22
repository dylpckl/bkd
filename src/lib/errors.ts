const MESSAGES: Record<string, string> = {
  not_authenticated: 'Please sign in again.',
  not_allowed: "You don't have permission to do that.",
  not_a_member: "That person isn't in this club anymore.",
  owner_must_transfer: 'Transfer ownership to someone else before you leave.',
  use_transfer_ownership: 'Use "Transfer ownership" to make someone the owner.',
  use_leave_club: 'Use "Leave club" to remove yourself.',
  already_owner: "You're already the owner.",
  invalid_expiry: 'Pick an expiry date in the future.',
  invalid_club_name: 'Club names need 1 to 80 characters.',
  invalid_description: 'Descriptions can be up to 500 characters.',
  club_limit_reached: "You've reached the limit of 10 clubs you can own.",
  owner_has_clubs:
    'Transfer or delete your clubs before deleting your account.',
  invalid_max_uses: 'Max people must be a number from 1 to 500.',
  round_not_open: 'Voting for this book has closed.',
  round_already_open: 'There’s already a vote open in this club.',
  deadline_in_past: 'Pick a closing date that hasn’t passed yet.',
  invalid_timezone:
    'Your device’s timezone wasn’t recognized. Try another browser.',
  nomination_limit_reached: 'You’ve used all your picks for this book.',
  already_nominated: 'Someone already nominated that book.',
  picks_cannot_decrease: 'Picks each can’t go down once people have nominated.',
  invalid_reply: 'That post was deleted, so your reply wasn’t sent.',
  anonymity_locked:
    'Anonymous voting can’t be turned off once people have nominated.',
  search_unavailable:
    'Book search isn’t available right now. Try again in a minute.',
  search_not_configured:
    'Book search isn�t set up yet. Ask the app owner to finish setup.',
  rate_limited: 'Too many searches. Wait a moment and try again.',
  bad_request: 'That request wasn�t valid. Check your input and try again.',
  invalid_input: 'That request wasn�t valid. Check your input and try again.',
  book_not_found: 'That book couldn’t be found. Try another result.',
}

/** Turns a Supabase/RPC error into copy for a toast or inline message. */
export function errorMessage(
  error: unknown,
  fallback = 'Something went wrong. Try again.',
) {
  const message = (error as { message?: string } | null)?.message
  if (message && message in MESSAGES) return MESSAGES[message]
  return fallback
}

/**
 * True for failures that may pass on their own (network drop, gateway or
 * timeout errors). Errors from our own rules (`round_not_open`, `not_allowed`)
 * carry a Postgres code and fail the same way every time.
 */
export function isTransientError(error: unknown) {
  const code = (error as { code?: string } | null)?.code
  if (!code) return true
  return /^(08|53|57|PGRST00[0-3])/.test(code)
}

/** Awaits a Supabase call and throws its error, so it can be used with useMutation. */
export async function must<T>(
  request: PromiseLike<{ data: T; error: unknown }>,
): Promise<T> {
  const { data, error } = await request
  if (error) throw error
  return data
}

/** Calls an edge function and throws `{ message: <error code> }` on failure. */
export async function invokeFunction<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { getSupabaseBrowserClient } = await import('./supabase/browser')
  const { data, error } = await getSupabaseBrowserClient().functions.invoke<T>(
    name,
    { body },
  )
  if (error) {
    let code = 'server_error'
    try {
      const context = (error as { context?: Response }).context
      code =
        ((await context?.json()) as { error?: string } | undefined)?.error ??
        code
    } catch {
      // Not JSON (network failure, boot error): keep the generic code.
    }
    throw { message: code }
  }
  return data as T
}
