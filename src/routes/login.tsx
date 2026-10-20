import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { Eye, EyeOff, Mail } from 'lucide-react'
import { z } from 'zod'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { LogoMark } from '#/components/logo'
import { Panel } from '#/components/layout'
import { getSupabaseBrowserClient } from '#/lib/supabase/browser'
import { safeNext } from '#/lib/auth'
import { cn } from '#/lib/utils'

const searchSchema = z.object({
  next: z.string().optional().catch(undefined),
  error: z.string().optional().catch(undefined),
  mode: z.enum(['signin', 'signup']).optional().catch(undefined),
})

export const Route = createFileRoute('/login')({
  validateSearch: searchSchema,
  beforeLoad: ({ context, search }) => {
    if (context.user) throw redirect({ href: safeNext(search.next) })
  },
  head: () => ({ meta: [{ title: 'Sign in' }] }),
  component: LoginPage,
})

type Mode = 'signin' | 'signup' | 'magic' | 'forgot' | 'sent'
type Sent = 'magic' | 'reset' | 'confirm'

const LINK_ERRORS: Record<string, string> = {
  link_expired:
    'That link has expired or was already used. Request a new one below.',
  link_invalid: "That link didn't work. Try signing in again.",
}

function callbackUrl(next: string) {
  const url = new URL('/auth/callback', window.location.origin)
  url.searchParams.set('next', next)
  return url.toString()
}

function LoginPage() {
  const {
    next: rawNext,
    error: linkError,
    mode: initialMode,
  } = Route.useSearch()
  const next = safeNext(rawNext)
  const [mode, setMode] = useState<Mode>(initialMode ?? 'signin')
  const [sent, setSent] = useState<Sent>('magic')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(
    linkError ? (LINK_ERRORS[linkError] ?? null) : null,
  )
  const [unconfirmed, setUnconfirmed] = useState(false)

  const supabase = getSupabaseBrowserClient()
  const go = (m: Mode) => {
    setMode(m)
    setFormError(null)
    setUnconfirmed(false)
  }
  const finishSent = (kind: Sent) => {
    setSent(kind)
    go('sent')
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setFormError(null)
    try {
      await fn()
    } catch {
      setFormError('Something went wrong. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const signIn = () =>
    run(async () => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (!error) {
        window.location.assign(next)
        return
      }
      if (error.code === 'email_not_confirmed') {
        setUnconfirmed(true)
        setFormError('Confirm your email first. Check your inbox for the link.')
      } else if (error.status === 429) {
        setFormError('Too many attempts. Wait a minute and try again.')
      } else {
        // Same message for "no account" and "wrong password", so the form doesn't reveal who has an account.
        setFormError('Email or password is incorrect.')
      }
    })

  const signUp = () =>
    run(async () => {
      if (password.length < 8) {
        setFormError('Use at least 8 characters for your password.')
        return
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name.trim() },
          emailRedirectTo: callbackUrl(next),
        },
      })
      if (error) {
        if (error.code === 'weak_password')
          setFormError('That password is too easy to guess. Try a longer one.')
        else if (
          error.code === 'user_already_exists' ||
          error.code === 'email_exists'
        )
          setFormError(
            'An account with this email already exists. Sign in instead.',
          )
        else if (error.status === 429)
          setFormError(
            'Too many emails sent. Wait a few minutes and try again.',
          )
        else
          setFormError(
            "We couldn't create your account. Check the details and try again.",
          )
        return
      }
      // With email confirmation on, Supabase answers an existing email with a user that has no identities.
      if (data.user && data.user.identities?.length === 0) {
        setFormError(
          'An account with this email already exists. Sign in instead.',
        )
        return
      }
      finishSent('confirm')
    })

  const resendConfirmation = () =>
    run(async () => {
      await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: callbackUrl(next) },
      })
      finishSent('confirm')
    })

  const sendMagic = () =>
    run(async () => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: callbackUrl(next) },
      })
      if (error) {
        setFormError(
          error.status === 429
            ? 'Too many emails sent. Wait a few minutes and try again.'
            : "We couldn't send the link. Check the email address.",
        )
        return
      }
      finishSent('magic')
    })

  const sendReset = () =>
    run(async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: callbackUrl('/reset-password'),
      })
      if (error) {
        setFormError(
          error.status === 429
            ? 'Too many emails sent. Wait a few minutes and try again.'
            : "We couldn't send the link. Check the email address.",
        )
        return
      }
      finishSent('reset')
    })

  const google = () =>
    run(async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: callbackUrl(next) },
      })
      if (error)
        setFormError(
          "Google sign-in isn't available right now. Use your email instead.",
        )
    })

  const sentText: Record<Sent, string> = {
    magic: `We sent a sign-in link to ${email}. It expires in 1 hour.`,
    reset: `We sent a password reset link to ${email}. It expires in 1 hour.`,
    confirm: `We sent a confirmation link to ${email}. Tap it to finish creating your account.`,
  }

  const errorBox = formError && (
    <p role="alert" className="text-destructive text-sm font-medium">
      {formError}
      {unconfirmed && (
        <>
          {' '}
          <button
            type="button"
            className="text-primary font-semibold underline"
            onClick={resendConfirmation}
            disabled={busy}
          >
            Resend confirmation
          </button>
        </>
      )}
    </p>
  )

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-6 pt-10 pb-6">
      <div className="flex flex-col gap-3">
        <LogoMark />
        <h1 className="font-display text-[30px]">
          Pick the next book together.
        </h1>
      </div>

      {(mode === 'signin' || mode === 'signup') && (
        <form
          className="flex flex-col gap-3.5"
          onSubmit={(e) => {
            e.preventDefault()
            mode === 'signin' ? signIn() : signUp()
          }}
        >
          <div
            role="tablist"
            aria-label="Account"
            className="bg-muted grid grid-cols-2 rounded-lg p-[3px]"
          >
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => go(m)}
                className={cn(
                  'min-h-10 rounded-md text-sm font-semibold',
                  mode === m
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground',
                )}
              >
                {m === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={google}
            disabled={busy}
          >
            <GoogleIcon />
            Continue with Google
          </Button>

          <div className="text-muted-foreground flex items-center gap-3 text-[13px]">
            <span className="bg-border h-px flex-1" />
            or with email
            <span className="bg-border h-px flex-1" />
          </div>

          {mode === 'signup' && (
            <Field id="name" label="Name">
              <Input
                id="name"
                autoComplete="name"
                placeholder="What your club calls you"
                required
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
          )}
          <Field id="email" label="Email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="mb-1.5">
                Password
              </Label>
              {mode === 'signin' && (
                <button
                  type="button"
                  className="text-primary mb-1.5 text-[13px] font-semibold"
                  onClick={() => go('forgot')}
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPw ? 'text' : 'password'}
                autoComplete={
                  mode === 'signup' ? 'new-password' : 'current-password'
                }
                required
                minLength={mode === 'signup' ? 8 : undefined}
                className="pr-12"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby={mode === 'signup' ? 'pw-hint' : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
                className="text-muted-foreground absolute top-0.5 right-0.5 inline-flex size-11 items-center justify-center rounded-md"
              >
                {showPw ? (
                  <EyeOff className="size-5" aria-hidden />
                ) : (
                  <Eye className="size-5" aria-hidden />
                )}
              </button>
            </div>
            {mode === 'signup' && (
              <p
                id="pw-hint"
                className="text-muted-foreground mt-1.5 text-[13px]"
              >
                At least 8 characters.
              </p>
            )}
          </div>

          {errorBox}

          <Button type="submit" size="lg" disabled={busy}>
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </Button>
          <Button type="button" variant="link" onClick={() => go('magic')}>
            Email me a sign-in link instead
          </Button>
        </form>
      )}

      {(mode === 'magic' || mode === 'forgot') && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            mode === 'magic' ? sendMagic() : sendReset()
          }}
        >
          <h2 className="font-display text-[22px]">
            {mode === 'magic' ? 'Sign in with a link' : 'Reset your password'}
          </h2>
          <p className="text-muted-foreground">
            {mode === 'magic'
              ? "No password needed. We'll email you a one-time link."
              : "Enter your email and we'll send a link to choose a new password."}
          </p>
          <Field id="email2" label="Email">
            <Input
              id="email2"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          {errorBox}
          <Button type="submit" size="lg" disabled={busy}>
            {mode === 'magic' ? 'Email me a link' : 'Send reset link'}
          </Button>
          <Button type="button" variant="link" onClick={() => go('signin')}>
            Back to sign in
          </Button>
        </form>
      )}

      {mode === 'sent' && (
        <Panel>
          <span className="bg-primary-soft text-primary inline-flex size-10 items-center justify-center rounded-lg">
            <Mail className="size-5" aria-hidden />
          </span>
          <h2 className="font-display text-[22px]">Check your inbox</h2>
          <p className="text-muted-foreground" role="status">
            {sentText[sent]}
          </p>
          <Button variant="outline" size="lg" onClick={() => go('signin')}>
            Back to sign in
          </Button>
        </Panel>
      )}

      <p className="text-muted-foreground mt-auto text-center text-[13px]">
        Got an invite link? Open it and you'll land in the club after signing
        in.
      </p>
    </div>
  )
}

function Field({
  id,
  label,
  children,
}: {
  id: string
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5">
        {label}
      </Label>
      {children}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.95 10.95 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"
      />
    </svg>
  )
}
