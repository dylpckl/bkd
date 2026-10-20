import {
  Link,
  createFileRoute,
  notFound,
  useNavigate,
} from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { ChevronLeft, Plus } from 'lucide-react'
import { z } from 'zod'
import { Button } from '#/components/ui/button'
import { Avatar } from '#/components/avatar'
import { BookCover } from '#/components/book-cover'
import { BookDetails } from '#/components/book-details'
import { BookSearch } from '#/components/book-search'
import { Chip, Screen } from '#/components/layout'
import { ResponsiveSheet } from '#/components/responsive-sheet'
import {
  clubQuery,
  membersQuery,
  nominationsQuery,
  roundQuery,
} from '#/lib/queries'
import type { Nomination } from '#/lib/queries'
import { authorLine } from '#/lib/books'
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
    return { number: round.number }
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `Book ${loaderData.number}` }] : [],
  }),
  component: VotePage,
})

function VotePage() {
  const { clubId, roundId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { user } = Route.useRouteContext()
  const { data: club } = useSuspenseQuery(clubQuery(clubId, user.id))
  const { data: round } = useSuspenseQuery(roundQuery(roundId))
  const { data: nominations } = useSuspenseQuery(nominationsQuery(roundId))
  const { data: members } = useSuspenseQuery(membersQuery(clubId))
  const [viewing, setViewing] = useState<Nomination | null>(null)
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
          <h1 className="font-display text-[26px]">Book {round.number}</h1>
          <span className="flex flex-wrap gap-1.5">
            {open ? (
              <Chip tone="amber">
                Closes {formatDeadline(round.deadline, round.timezone)}
              </Chip>
            ) : (
              <Chip>Voting closed</Chip>
            )}
            {round.anonymous_nominators && open && <Chip>Anonymous</Chip>}
          </span>
        </div>
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
        <p className="text-muted-foreground text-[13px]">
          {nominations.length === 0
            ? 'No books yet. Be the first to nominate one.'
            : `${nominations.length} ${nominations.length === 1 ? 'book' : 'books'} nominated so far. Tap one for details.`}
        </p>
        <ul className="flex flex-col gap-2">
          {/* Your own nominations live in the footer; you can't rank them. */}
          {nominations
            .filter((n) => !n.isMine || !open)
            .map((n) => {
              const by = n.nominatedBy ? byId.get(n.nominatedBy) : undefined
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => setViewing(n)}
                    className="bg-card flex min-h-15 w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left hover:border-stone-400"
                  >
                    <BookCover
                      title={n.book.title}
                      coverUrl={n.book.cover_url}
                      idKey={n.book.google_books_id}
                      width={30}
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      {n.isMine && (
                        <span className="text-muted-foreground text-[10px] font-bold tracking-[0.08em] uppercase">
                          Your nomination
                        </span>
                      )}
                      <strong className="truncate text-sm font-semibold">
                        {n.book.title}
                      </strong>
                      <span className="text-muted-foreground truncate text-[13px]">
                        {authorLine(n.book.authors)}
                      </span>
                    </span>
                    {by && (
                      <span title={`Nominated by ${by.displayName}`}>
                        <Avatar
                          id={by.userId}
                          name={by.displayName}
                          src={by.avatarUrl}
                          size={28}
                          decorative={false}
                        />
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
        </ul>
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
