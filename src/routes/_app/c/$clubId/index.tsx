import { Link, createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ChevronDown, Clock, Settings, UserPlus } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { AvatarStack } from '#/components/avatar'
import { BookCover } from '#/components/book-cover'
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
  currentBookQuery,
  membersQuery,
  nominationsQuery,
  openRoundQuery,
  voteStatusQuery,
} from '#/lib/queries'
import type { Round } from '#/lib/queries'
import { authorLine } from '#/lib/books'
import { daysLeftLabel, formatDeadline } from '#/lib/dates'

export const Route = createFileRoute('/_app/c/$clubId/')({
  loader: async ({ context, params }) => {
    const [, round] = await Promise.all([
      context.queryClient.ensureQueryData(membersQuery(params.clubId)),
      context.queryClient.ensureQueryData(openRoundQuery(params.clubId)),
      context.queryClient.ensureQueryData(currentBookQuery(params.clubId)),
    ])
    if (round) {
      await Promise.all([
        context.queryClient.ensureQueryData(nominationsQuery(round.id)),
        context.queryClient.ensureQueryData(voteStatusQuery(round.id)),
      ])
    }
  },
  component: ClubHome,
})

function ClubHome() {
  const { clubId } = Route.useParams()
  const { user } = Route.useRouteContext()
  const { data: club } = useSuspenseQuery(clubQuery(clubId, user.id))
  const { data: members } = useSuspenseQuery(membersQuery(clubId))
  const { data: round } = useSuspenseQuery(openRoundQuery(clubId))
  const { data: current } = useSuspenseQuery(currentBookQuery(clubId))
  if (!club) return null

  return (
    <Screen>
      <header className="flex min-h-15 items-center gap-1 pt-3 pr-3 pb-1 pl-2">
        <Link
          to="/clubs"
          aria-label={`${club.name}, back to your clubs`}
          className="text-foreground hover:text-foreground inline-flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-2"
        >
          <span className="font-display truncate text-[22px]">{club.name}</span>
          <ChevronDown className="size-[18px] shrink-0" aria-hidden />
        </Link>
        {club.isAdmin && (
          <Link
            to="/c/$clubId/settings"
            params={{ clubId }}
            aria-label="Club settings"
            className="text-foreground hover:bg-muted hover:text-foreground inline-flex size-11 items-center justify-center rounded-lg"
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
          <OpenVoteCard clubId={clubId} round={round} userId={user.id} />
        ) : (
          !current && (
            <Panel className="border-dashed">
              <h2 className="font-display text-[22px]">No vote open</h2>
              <p className="text-muted-foreground">
                {club.isAdmin
                  ? 'Start a vote and everyone can nominate books, then rank them.'
                  : 'When an admin starts a vote for the next book, it shows up here.'}
              </p>
            </Panel>
          )
        )}

        {current && (
          <>
            <SectionLabel className="mt-1.5">Currently reading</SectionLabel>
            <Panel>
              <div className="flex items-start gap-3">
                <BookCover
                  title={current.book.title}
                  coverUrl={current.book.cover_url}
                  idKey={current.book.google_books_id}
                  width={56}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-muted-foreground text-[13px]">
                    Book {current.number}
                  </span>
                  <strong className="text-[17px]">{current.book.title}</strong>
                  <span className="text-muted-foreground text-[13px]">
                    {authorLine(current.book.authors)}
                  </span>
                </div>
              </div>
              {current.round_id && (
                <Button asChild variant="outline">
                  <Link
                    to="/c/$clubId/votes/$roundId"
                    params={{ clubId, roundId: current.round_id }}
                  >
                    How book {current.number} was picked
                  </Link>
                </Button>
              )}
            </Panel>
          </>
        )}

        <SectionLabel className="mt-1.5">
          Members ({members.length})
        </SectionLabel>
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

function OpenVoteCard({
  clubId,
  round,
  userId,
}: {
  clubId: string
  round: Round
  userId: string
}) {
  const { data: nominations } = useSuspenseQuery(nominationsQuery(round.id))
  const { data: status } = useSuspenseQuery(voteStatusQuery(round.id))
  const { data: members } = useSuspenseQuery(membersQuery(clubId))
  const byId = new Map(members.map((m) => [m.userId, m]))
  const voters = status
    .filter((s) => s.has_voted)
    .map((s) => byId.get(s.user_id))
    .filter((m) => !!m)
  const iVoted = status.some((s) => s.user_id === userId && s.has_voted)

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
        {daysLeftLabel(round.deadline, round.timezone).toLowerCase()}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-background flex flex-col rounded-lg px-3 py-2.5">
          <strong className="text-xl">{nominations.length}</strong>
          <span className="text-muted-foreground text-[13px]">
            {nominations.length === 1 ? 'book nominated' : 'books nominated'}
          </span>
        </div>
        <div className="bg-background flex flex-col rounded-lg px-3 py-2.5">
          <strong className="text-xl">
            {voters.length} of {status.length}
          </strong>
          <span className="text-muted-foreground text-[13px]">
            members voted
          </span>
        </div>
      </div>
      {voters.length > 0 && (
        <div className="flex items-center">
          <AvatarStack
            people={voters.map((m) => ({
              id: m.userId,
              name: m.displayName,
              src: m.avatarUrl,
            }))}
            size={28}
          />
          <span className="text-muted-foreground ml-2.5 text-[13px]">
            voted{iVoted ? ' · including you' : ' · you haven’t yet'}
          </span>
        </div>
      )}
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
            {iVoted ? 'Change ranking' : 'Rank books'}
          </Link>
        </Button>
      </div>
    </Panel>
  )
}
