import { Link, createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { UserPlus } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { FooterBar, Panel, Screen, ScreenBody } from '#/components/layout'
import {
  InviteLinkField,
  ShareIcon,
  useInviteActions,
} from '#/components/invite-link'
import { activeInviteQuery, clubQuery } from '#/lib/queries'
import { describeInvite } from '#/lib/invites'

// Shown right after creating a club. The only exit is "Done, go to club".
export const Route = createFileRoute('/_app/c/$clubId/invite')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(activeInviteQuery(params.clubId)),
  head: () => ({ meta: [{ title: 'Invite friends' }] }),
  component: InviteFriendsPage,
})

function InviteFriendsPage() {
  const { clubId } = Route.useParams()
  const { user } = Route.useRouteContext()
  const { data: club } = useSuspenseQuery(clubQuery(clubId, user.id))
  const { data: invite } = useSuspenseQuery(activeInviteQuery(clubId))
  if (!club) return null

  return (
    <Screen>
      <ScreenBody className="gap-3 pt-10">
        <div className="flex flex-col gap-2.5 pt-1 pb-1.5">
          <span className="bg-primary-soft text-primary inline-flex size-12 items-center justify-center rounded-full">
            <UserPlus className="size-6" aria-hidden />
          </span>
          <h1 className="font-display text-[28px]">{club.name} is ready</h1>
          <p className="text-muted-foreground">
            Invite your friends. You can find this link again in club settings.
          </p>
        </div>
        {invite?.usable ? (
          <InviteCard
            token={invite.token}
            clubName={club.name}
            note={describeInvite(invite)}
          />
        ) : (
          <Panel>
            <p className="text-muted-foreground">
              {club.isAdmin
                ? 'There’s no active invite link. Make a new one in club settings.'
                : 'Only admins can invite people.'}
            </p>
          </Panel>
        )}
      </ScreenBody>
      <FooterBar>
        <Button
          asChild
          variant="ghost"
          size="lg"
          className="text-primary hover:text-primary-hover"
        >
          <Link to="/c/$clubId" params={{ clubId }}>
            Done, go to club
          </Link>
        </Button>
      </FooterBar>
    </Screen>
  )
}

function InviteCard({
  token,
  clubName,
  note,
}: {
  token: string
  clubName: string
  note: string
}) {
  const { url, copied, copy, share } = useInviteActions(token, clubName)
  return (
    <Panel>
      <strong>Share an invite link</strong>
      <InviteLinkField url={url} copied={copied} onCopy={copy} />
      <Button size="lg" className="min-h-13 text-base" onClick={share}>
        <ShareIcon className="size-5" aria-hidden />
        Share…
      </Button>
      <span className="text-muted-foreground text-[13px]">
        Opens your phone's share sheet (Messages, WhatsApp, group chat). {note}
      </span>
    </Panel>
  )
}
