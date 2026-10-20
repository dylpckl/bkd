import { Link, createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ChevronDown, Settings, UserPlus } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { AvatarStack } from '#/components/avatar'
import { LeaveClubButton } from '#/components/leave-club'
import { Panel, Screen, ScreenBody, SectionLabel } from '#/components/layout'
import { clubQuery, membersQuery } from '#/lib/queries'

export const Route = createFileRoute('/_app/c/$clubId/')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(membersQuery(params.clubId)),
  component: ClubHome,
})

function ClubHome() {
  const { clubId } = Route.useParams()
  const { user } = Route.useRouteContext()
  const { data: club } = useSuspenseQuery(clubQuery(clubId, user.id))
  const { data: members } = useSuspenseQuery(membersQuery(clubId))
  if (!club) return null

  return (
    <Screen>
      <header className="flex min-h-15 items-center gap-1 pt-3 pr-3 pb-1 pl-2">
        <Link
          to="/clubs"
          aria-label={`${club.name}, back to your clubs`}
          className="inline-flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-foreground hover:text-foreground"
        >
          <span className="font-display truncate text-[22px]">{club.name}</span>
          <ChevronDown className="size-[18px] shrink-0" aria-hidden />
        </Link>
        {club.isAdmin && (
          <Link
            to="/c/$clubId/settings"
            params={{ clubId }}
            aria-label="Club settings"
            className="inline-flex size-11 items-center justify-center rounded-lg text-foreground hover:bg-muted hover:text-foreground"
          >
            <Settings className="size-[22px]" aria-hidden />
          </Link>
        )}
      </header>
      <ScreenBody className="gap-3.5">
        {club.description && (
          <p className="text-muted-foreground -mt-1 px-1">{club.description}</p>
        )}

        <Panel className="border-dashed">
          <h2 className="font-display text-[22px]">No book yet</h2>
          <p className="text-muted-foreground">
            When an admin starts a vote for the first book, it shows up here for
            everyone to nominate and rank.
          </p>
        </Panel>

        <div className="mt-1.5 flex items-center justify-between">
          <SectionLabel>Members ({members.length})</SectionLabel>
        </div>
        <Panel>
          <AvatarStack
            people={members.map((m) => ({
              id: m.userId,
              name: m.displayName,
              src: m.avatarUrl,
            }))}
            max={8}
          />
          <p className="text-muted-foreground text-[13px]">
            {members
              .map((m) => (m.userId === user.id ? 'You' : m.displayName))
              .join(', ')}
          </p>
          {club.isAdmin ? (
            <Button asChild variant="outline">
              <Link to="/c/$clubId/invite" params={{ clubId }}>
                <UserPlus className="size-5" aria-hidden />
                Invite friends
              </Link>
            </Button>
          ) : (
            <LeaveClubButton clubId={clubId} />
          )}
        </Panel>
      </ScreenBody>
    </Screen>
  )
}
