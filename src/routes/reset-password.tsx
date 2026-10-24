import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { CircleCheck } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { LogoMark } from '#/components/logo'
import { Panel } from '#/components/layout'
import { getSupabaseBrowserClient } from '#/lib/supabase/browser'

// The reset email goes through /auth/callback, which signs the user in and sends them here.
export const Route = createFileRoute('/reset-password')({
  head: () => ({ meta: [{ title: 'Set a new password' }] }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { user } = Route.useRouteContext()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const mismatch = touched && confirm.length > 0 && confirm !== password

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (password.length < 8) return setFormError('Use at least 8 characters.')
    if (password !== confirm) return
    setBusy(true)
    setFormError(null)
    const { error } = await getSupabaseBrowserClient().auth.updateUser({
      password,
    })
    setBusy(false)
    if (!error) return setDone(true)
    if (error.code === 'weak_password')
      setFormError('That password is too easy to guess. Try a longer one.')
    else if (error.code === 'same_password')
      setFormError('Choose a password you haven’t used here before.')
    else
      setFormError(
        "We couldn't save your password. Request a new link and try again.",
      )
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-6 pt-10 pb-6">
      <LogoMark />
      {!user ? (
        <Panel>
          <h1 className="font-display text-[26px]">Link expired?</h1>
          <p className="text-muted-foreground">
            Reset links work once and expire after an hour. Request a new one
            and open it on this device.
          </p>
          <Button asChild size="lg">
            <Link to="/login">Request a new one</Link>
          </Button>
        </Panel>
      ) : done ? (
        <Panel>
          <span className="bg-primary-soft text-primary inline-flex size-10 items-center justify-center rounded-lg">
            <CircleCheck className="size-5" aria-hidden />
          </span>
          <h1 className="font-display text-[26px]">Password updated</h1>
          <p className="text-muted-foreground" role="status">
            You're signed in.
          </p>
          <Button asChild size="lg">
            <a href="/clubs">Go to your clubs</a>
          </Button>
        </Panel>
      ) : (
        <form className="flex flex-col gap-3.5" onSubmit={save}>
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-[30px]">Set a new password</h1>
            {user.email && (
              <p className="text-muted-foreground">For {user.email}</p>
            )}
          </div>
          <div>
            <Label htmlFor="pw" className="mb-1.5">
              New password
            </Label>
            <Input
              id="pw"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="pw-hint"
            />
            <p
              id="pw-hint"
              className="text-muted-foreground mt-1.5 text-[13px]"
            >
              At least 8 characters.
            </p>
          </div>
          <div>
            <Label htmlFor="pw2" className="mb-1.5">
              Confirm password
            </Label>
            <Input
              id="pw2"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={mismatch}
              aria-describedby={mismatch ? 'pw2-err' : undefined}
            />
            {mismatch && (
              <p
                id="pw2-err"
                className="text-destructive mt-1.5 text-[13px] font-medium"
              >
                Passwords don't match.
              </p>
            )}
          </div>
          {formError && (
            <p role="alert" className="text-destructive text-sm font-medium">
              {formError}
            </p>
          )}
          <Button type="submit" size="lg" disabled={busy}>
            Save password
          </Button>
          <p className="text-muted-foreground text-center text-[13px]">
            Link expired? <Link to="/login">Request a new one</Link>
          </p>
        </form>
      )}
    </div>
  )
}
