const MESSAGES: Record<string, string> = {
  not_authenticated: 'Please sign in again.',
  not_allowed: "You don't have permission to do that.",
  not_a_member: "That person isn't in this club anymore.",
  owner_must_transfer: 'Transfer ownership to someone else before you leave.',
  use_transfer_ownership: 'Use "Transfer ownership" to make someone the owner.',
  use_leave_club: 'Use "Leave club" to remove yourself.',
  already_owner: "You're already the owner.",
  invalid_expiry: 'Pick an expiry date in the future.',
  invalid_max_uses: 'Max people must be a number from 1 to 500.',
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

/** Awaits a Supabase call and throws its error, so it can be used with useMutation. */
export async function must<T>(
  request: PromiseLike<{ data: T; error: unknown }>,
): Promise<T> {
  const { data, error } = await request
  if (error) throw error
  return data
}
