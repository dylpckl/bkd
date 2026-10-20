import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useSuspenseQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { AvatarStack } from '#/components/avatar'
import { FooterBar, Panel, Screen } from '#/components/layout'
import { LogoMark } from '#/components/logo'
import { avatarSrc, invitePreviewQuery } from '#/lib/queries'
import { getSupabaseBrowserClient } from '#/lib/supabase/browser'
import { errorMessage, must } from '#/lib/errors'

export const Route = createFileRoute('/join/$token')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(invitePreviewQuery(params.token)),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.club
          ? `Join ${loaderData.club.name}`
          : 'Join a club',
      },
    ],
  }),
  component: JoinPage,
})

const DEAD: Partial<Record<string, { title: string; body: string }>> = {
  invalid: {
    title: "This invite link doesn't work",
    body: 'Check you copied the whole link, or ask for a new one.',
  },
  revoked: {
    title: 'This invite link was turned off',
    body: 'Ask someone in the club to send you a new link.',
  },
  expired: {
    title: 'This invite link has expired',
    body: 'Ask someone in the club to send you a new link.',
  },
  maxed: {
    title: 'This invite link is used up',
    body: 'It reached its limit of people. Ask for a new link.',
  },
}

function JoinPage() {
  const { token } = Route.useParams()
  const { user } = Route.useRouteContext()
  const { data: invite } = useSuspenseQuery(invitePreviewQuery(token))
  const navigate = useNavigate()
  const here = `/join/${token}`

  const join = useMutation({
    mutationFn: async () => {
      const rows = await must(
        getSupabaseBrowserClient().rpc('accept_invite', { p_token: token }),
      )
      const result = rows?.[0]
      if (!result) throw { message: 'server_error' }
      return result
    },
    onSuccess: (result) => {
      if (
        result.club_id &&
        (result.status === 'joined' || result.status === 'already_member')
      ) {
        window.location.assign(`/c/${result.club_id}`)
      } else {
        toast.error(DEAD[result.status]?.title ?? "Couldn't join the club.")
      }
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const switchAccount = async () => {
    await getSupabaseBrowserClient().auth.signOut()
    window.location.assign(`/login?next=${encodeURIComponent(here)}`)
  }

  if (invite.club && invite.is_member) {
    return (
      <Message
        title={`You're already in ${invite.club.name}`}
        body="Pick up where you left off."
      >
        <Button asChild size="lg">
          <Link to="/c/$clubId" params={{ clubId: invite.club.id }}>
            Go to club
          </Link>
        </Button>
      </Message>
    )
  }

  if (invite.status !== 'valid' || !invite.club) {
    const copy = DEAD[invite.status] ?? {
      title: "This invite link doesn't work",
      body: 'Ask for a new one.',
    }
    return (
      <Message title={copy.title} body={copy.body}>
        <Button asChild variant="outline" size="lg">
          <Link to={user ? '/clubs' : '/login'}>
            {user ? 'Go to your clubs' : 'Sign in'}
          </Link>
        </Button>
      </Message>
    )
  }

  const { club } = invite
  const people = (invite.members ?? []).map((m) => ({
    id: m.id,
    name: m.display_name,
    src: avatarSrc(m),
  }))

  return (
    <Screen>
      <main className="flex flex-1 flex-col justify-center px-5 py-8">
        <Panel>
          <span className="text-muted-foreground text-[13px] font-semibold tracking-[0.06em] uppercase">
            You're invited to
          </span>
          <h1 className="font-display text-[32px]">{club.name}</h1>
          {club.description && (
            <p className="text-foreground">{club.description}</p>
          )}
          <p className="text-muted-foreground">
            {invite.inviter ? `${invite.inviter} invited you · ` : ''}
            {club.member_count} {club.member_count === 1 ? 'member' : 'members'}
          </p>
          {people.length > 0 && <AvatarStack people={people} />}
        </Panel>
      </main>
      <FooterBar>
        {user ? (
          <>
            <Button
              size="lg"
              onClick={() => join.mutate()}
              disabled={join.isPending}
            >
              Join club
            </Button>
            <p className="text-muted-foreground text-center text-[13px]">
              Signed in as {user.email} ·{' '}
              <button
                type="button"
                className="text-primary font-semibold"
                onClick={switchAccount}
              >
                Switch account
              </button>
            </p>
          </>
        ) : (
          <>
            <Button
              size="lg"
              onClick={() => navigate({ to: '/login', search: { next: here } })}
            >
              Sign in to join
            </Button>
            <Button
              variant="link"
              onClick={() =>
                navigate({
                  to: '/login',
                  search: { next: here, mode: 'signup' },
                })
              }
            >
              New here? Create an account
            </Button>
          </>
        )}
      </FooterBar>
    </Screen>
  )
}

function Message({
  title,
  body,
  children,
}: {
  title: string
  body: string
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-6">
      <LogoMark />
      <h1 className="font-display text-[28px]">{title}</h1>
      <p className="text-muted-foreground">{body}</p>
      {children}
    </div>
  )
}
