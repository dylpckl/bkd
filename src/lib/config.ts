// The app name is deferred. Renaming the app is a change to these two lines.
export const APP_NAME = 'Book Club'
export const APP_URL = (
  import.meta.env.VITE_APP_URL || 'http://localhost:3000'
).replace(/\/$/, '')

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
export const SUPABASE_PUBLISHABLE_KEY = import.meta.env
  .VITE_SUPABASE_PUBLISHABLE_KEY as string

export function inviteUrl(token: string) {
  return `${APP_URL}/join/${token}`
}
