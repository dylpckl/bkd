import {
  Link,
  createFileRoute,
  notFound,
  useNavigate,
} from '@tanstack/react-router'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { ChevronLeft, Loader2, Plus, SlidersHorizontal } from 'lucide-react'
import { z } from 'zod'
import { Button } from '#/components/ui/button'
import { BallotList, useBallot } from '#/components/ballot'
import type { SaveState } from '#/components/ballot'
import { BookCover } from '#/components/book-cover'
import { BookDetails } from '#/components/book-details'
import { BookSearch } from '#/components/book-search'
import { Chip, FooterBar, Screen } from '#/components/layout'
import { Results } from '#/components/results'
import { ResponsiveSheet } from '#/components/responsive-sheet'
import {
  clubQuery,
  membersQuery,
  myBallotQuery,
  nominationsQuery,
  resultsQuery,
  roundQuery,
} from '#/lib/queries'
import type { Nomination, Round } from '#/lib/queries'
import { closesShort, formatDeadline } from '#/lib/dates'

const searchSchema = z.object({
  nominate: z.coerce.number().optional().catch(undefined),
  replace: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/_app/c/$clubId/votes/$roundId/')({
  validateSearch: searchSchema,
  loader: async ({ context, params }) => {
    const [round] = await Promise.all([
      context.queryClient.ensureQueryData(roundQuery(params.roundId)),
      context.queryClient.ensureQueryData(nominationsQuery(params.roundId)),
      context.queryClient.ensureQueryData(membersQuery(params.clubId)),
    ])
    if (!round || round.club_id !== params.clubId) throw notFound()
    if (round.status === 'open') {
      await context.queryClient.ensureQueryData(
        myBallotQuery(params.roundId, context.user.id),
      )
    } else if (round.status === 'closed') {
      await context.queryClient.ensureQueryData(resultsQuery(params.roundId))
    }
    return { number: round.number, closed: round.status === 'closed' }
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          {
            title: loaderData.closed
              ? `How book ${loaderData.number} was picked`
              : `Book ${loaderData.number}`,
          },
        ]
      : [],
  }),
  component: VotePage,
})

function VotePage() {
  const { clubId, roundId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { user } = Route.useRouteContext()
  const { data: club } = useSuspenseQuery(clubQuery(clubId, user.id))
  const { data: round } = useSuspenseQuery({
    ...roundQuery(roundId),
    // While votes are being counted, check back until the results land.
    refetchInterval: (q) => (q.state.data?.status === 'closing' ? 2000 : false),
  })
  const { data: nominations } = useSuspenseQuery(nominationsQuery(roundId))
  const { data: members } = useSuspenseQuery(membersQuery(clubId))
  const [viewing, setViewing] = useState<Nomination | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  if (!round || !club) return null

  const byId = new Map(members.map((m) => [m.userId, m]))
  const nameOf = (id: string | null) =>
    id ? (byId.get(id)?.displayName ?? 'a former member') : null
  const mine = nominations.filter((n) => n.isMine)
  const left = round.max_nominations_per_member - mine.length
  const open = round.status === 'open' && new Date(round.deadline) > new Date()
  const replacing = search.replace
    ? (mine.find((n) => n.id === search.replace) ?? null)
    : null
  const searchOpen =
    open && (search.nominate === 1 || !!replacing) && (left > 0 || !!replacing)

  const setSearchOpen = (o: boolean, replace?: string) =>
    navigate({ search: o ? { nominate: 1, replace } : {}, replace: !o })

  return (
    <Screen>
      <header className="flex items-center gap-2 px-4 pt-3.5 pb-2">
        <Link
          to="/c/$clubId"
          params={{ clubId }}
          aria-label="Back to club"
          className="-ml-2.5 inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="size-6" aria-hidden />
        </Link>
        <div className="flex flex-1 flex-col gap-1">
          <h1 className="font-display text-[26px]">
            {round.status === 'closed'
              ? `How book ${round.number} was picked`
              : `Book ${round.number}`}
          </h1>
          <span className="flex flex-wrap gap-1.5">
            {open ? (
              <Chip tone="amber">
                Closes {formatDeadline(round.deadline, round.timezone)}
              </Chip>
            ) : round.status === 'cancelled' ? (
              <Chip>Cancelled</Chip>
            ) : (
              <Chip>Voting closed</Chip>
            )}
            {open && saveState === 'saved' && <Chip tone="green">✓ Saved</Chip>}
            {open && saveState === 'saving' && <Chip tone="gray">Saving…</Chip>}
            {open && saveState === 'error' && (
              <Chip tone="amber">Not saved yet</Chip>
            )}
            {round.anonymous_nominators && open && <Chip>Anonymous</Chip>}
          </span>
        </div>
        {club.isAdmin && round.status === 'open' && (
          <Link
            to="/c/$clubId/votes/$roundId/manage"
            params={{ clubId, roundId }}
            aria-label="Manage voting"
            className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-foreground hover:bg-muted hover:text-foreground"
          >
            <SlidersHorizontal className="size-[22px]" aria-hidden />
          </Link>
        )}
      </header>

      <main className="flex flex-1 flex-col gap-2 px-4 pt-1 pb-48">
        {round.note && (
          <p className="bg-card rounded-xl border px-3.5 py-2.5 text-sm">
            <span className="text-muted-foreground font-semibold">
              {nameOf(round.created_by) ?? 'An admin'}:
            </span>{' '}
            {round.note}
          </p>
        )}
        {open ? (
          <OpenBallot
            round={round}
            userId={user.id}
            nominations={nominations}
            onOpen={setViewing}
            onSaveState={setSaveState}
            nominator={(n) => {
              const by = n.nominatedBy ? byId.get(n.nominatedBy) : undefined
              return by
                ? { id: by.userId, name: by.displayName, src: by.avatarUrl }
                : null
            }}
          />
        ) : round.status === 'closed' ? (
          <ClosedResults roundId={roundId} nominations={nominations} />
        ) : round.status === 'closing' || round.status === 'open' ? (
          <p
            className="text-muted-foreground flex items-center gap-2 py-6"
            role="status"
          >
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Voting has closed. Counting the votes…
          </p>
        ) : (
          <p className="text-muted-foreground py-6">
            This vote was cancelled. An admin can start a new one from the club
            page.
          </p>
        )}
      </main>

      {open && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-[rgba(250,250,249,.82)] backdrop-blur-md">
          <div className="pb-safe mx-auto flex w-full max-w-lg flex-col gap-2 px-4 pt-2.5">
            {mine.length === 0 ? (
              <>
                <Button size="lg" onClick={() => setSearchOpen(true)}>
                  <Plus className="size-5" aria-hidden />
                  Nominate a book
                </Button>
                <span className="text-muted-foreground text-center text-[13px]">
                  You haven't nominated yet · open until{' '}
                  {closesShort(round.deadline, round.timezone).replace(
                    'closes ',
                    '',
                  )}
                </span>
              </>
            ) : (
              <>
                {mine.map((n) => (
                  <div
                    key={n.id}
                    className="bg-card flex min-h-15 items-center gap-2.5 rounded-xl border border-dashed px-2.5 py-2"
                  >
                    <BookCover
                      title={n.book.title}
                      coverUrl={n.book.cover_url}
                      idKey={n.book.google_books_id}
                      width={30}
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-muted-foreground text-[10px] font-bold tracking-[0.08em] uppercase">
                        Your nomination
                      </span>
                      <strong className="truncate text-sm font-semibold">
                        {n.book.title}
                      </strong>
                      <span className="text-muted-foreground text-[13px]">
                        Not on your ballot
                      </span>
                    </span>
                    <Button
                      variant="outline"
                      onClick={() => setSearchOpen(true, n.id)}
                      aria-label={`Change your nomination, ${n.book.title}`}
                    >
                      Change
                    </Button>
                  </div>
                ))}
                {left > 0 && (
                  <Button
                    variant="ghost"
                    className="text-primary hover:text-primary-hover"
                    onClick={() => setSearchOpen(true)}
                  >
                    <Plus aria-hidden />
                    Nominate another ({left} left)
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {!open && (
        <FooterBar>
          <Button
            asChild
            size="lg"
            variant={round.status === 'closed' ? 'default' : 'outline'}
          >
            <Link to="/c/$clubId" params={{ clubId }}>
              Back to club
            </Link>
          </Button>
        </FooterBar>
      )}

      <BookSearch
        open={searchOpen}
        onOpenChange={(o) => setSearchOpen(o)}
        round={round}
        nominations={nominations}
        replacing={replacing}
        nameOf={nameOf}
      />

      {viewing && (
        <ResponsiveSheet
          open={!!viewing}
          onOpenChange={(o) => !o && setViewing(null)}
          title={viewing.book.title}
          description="Book details"
        >
          <BookDetails book={viewing.book} />
          <NominatorPitch
            nomination={viewing}
            name={viewing.isMine ? 'You' : nameOf(viewing.nominatedBy)}
          />
        </ResponsiveSheet>
      )}
    </Screen>
  )
}

function NominatorPitch({
  nomination,
  name,
}: {
  nomination: Nomination
  name: string | null
}) {
  return (
    <div className="bg-background rounded-xl border px-3.5 py-3">
      <p className="text-muted-foreground text-[13px] font-semibold">
        {name ? `Nominated by ${name}` : 'Nominated anonymously'}
      </p>
      {nomination.pitch && <p className="mt-1 text-sm">“{nomination.pitch}”</p>}
    </div>
  )
}

function OpenBallot({
  round,
  userId,
  nominations,
  onOpen,
  onSaveState,
  nominator,
}: {
  round: Round
  userId: string
  nominations: Nomination[]
  onOpen: (n: Nomination) => void
  onSaveState: (s: SaveState) => void
  nominator: (
    n: Nomination,
  ) => { id: string; name: string; src: string | null } | null
}) {
  const { data: ballot } = useSuspenseQuery(myBallotQuery(round.id, userId))
  const { rows, voted, saveState, isNew, commit } = useBallot(
    round.id,
    nominations,
    ballot,
  )
  useEffect(() => onSaveState(saveState), [saveState, onSaveState])
  const anonymous = round.anonymous_nominators

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground py-4 text-[13px]">
        {nominations.length === 0
          ? 'No books yet. Be the first to nominate one.'
          : 'Nothing to rank yet. Other members’ nominations show up here as they come in.'}
      </p>
    )
  }

  return (
    <>
      <p className="text-muted-foreground text-[13px]">
        {rows.length === 1
          ? 'One book to vote on so far. '
          : `${rows.length} books to rank. Drag to put them in your order. Your #1 counts first. If it’s knocked out, your vote moves to your #2, then #3, and so on. `}
        {!voted && rows.length > 1 && 'Your first move casts your vote.'}
      </p>
      <BallotList
        rows={rows}
        voted={voted}
        isNew={isNew}
        onReorder={commit}
        onOpen={onOpen}
        nominator={(n) => (anonymous ? null : nominator(n))}
      />
      {voted && (
        <p className="text-muted-foreground mt-1 text-center text-[13px]">
          Saved automatically · change it anytime until{' '}
          {formatDeadline(round.deadline, round.timezone)}
        </p>
      )}
    </>
  )
}

function ClosedResults({
  roundId,
  nominations,
}: {
  roundId: string
  nominations: Nomination[]
}) {
  const { data } = useQuery(resultsQuery(roundId))
  if (!data) return null
  return <Results tallies={data.tallies} nominations={nominations} />
}
