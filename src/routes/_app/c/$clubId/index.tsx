import { Link, createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ChevronDown, Clock, Settings, UserPlus } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { AvatarStack } from '#/components/avatar'
import { LeaveClubButton } from '#/components/leave-club'
import {
  Chip,
  FooterBar,
  Panel,
  Screen,
  ScreenBody,
  SectionLabel,
} from '#/components/layout'
import {
  clubQuery,
  membersQuery,
  nominationsQuery,
  openRoundQuery,
} from '#/lib/queries'
import type { Round } from '#/lib/queries'
import { daysLeftLabel, formatDeadline } from '#/lib/dates'

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
  const { data: round } = useSuspenseQuery(openRoundQuery(clubId))
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

        {round ? (
          <OpenVoteCard clubId={clubId} round={round} />
        ) : (
          <Panel className="border-dashed">
            <h2 className="font-display text-[22px]">No vote open</h2>
            <p className="text-muted-foreground">
              {club.isAdmin
                ? 'Start a vote and everyone can nominate books, then rank them.'
                : 'When an admin starts a vote for the next book, it shows up here.'}
            </p>
          </Panel>
        )}

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
      {!round && club.isAdmin && (
        <FooterBar>
          <Button asChild size="lg">
            <Link to="/c/$clubId/votes/new" params={{ clubId }}>
              Pick the next book
            </Link>
          </Button>
        </FooterBar>
      )}
    </Screen>
  )
}

function OpenVoteCard({ clubId, round }: { clubId: string; round: Round }) {
  const { data: nominations } = useSuspenseQuery(nominationsQuery(round.id))
  return (
    <Panel className="border-primary border-2 p-[15px]">
      <div className="flex items-center justify-between">
        <Chip tone="amber">Voting open</Chip>
        <span className="text-muted-foreground text-[13px]">
          Book {round.number}
        </span>
      </div>
      <h2 className="font-display text-[26px]">Pick our next book</h2>
      <p className="text-muted-foreground flex items-center gap-1.5 text-[13px]">
        <Clock className="size-4" aria-hidden />
        Closes end of {formatDeadline(round.deadline, round.timezone)} —{' '}
        {daysLeftLabel(round.deadline).toLowerCase()}
      </p>
      <div className="bg-background flex flex-col rounded-lg px-3 py-2.5">
        <strong className="text-xl">{nominations.length}</strong>
        <span className="text-muted-foreground text-[13px]">
          {nominations.length === 1 ? 'book nominated' : 'books nominated'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button asChild variant="outline">
          <Link
            to="/c/$clubId/votes/$roundId"
            params={{ clubId, roundId: round.id }}
            search={{ nominate: 1 }}
          >
            Nominate
          </Link>
        </Button>
        <Button asChild>
          <Link
            to="/c/$clubId/votes/$roundId"
            params={{ clubId, roundId: round.id }}
          >
            See the books
          </Link>
        </Button>
      </div>
    </Panel>
  )
}
