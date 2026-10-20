import { Link, createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ExternalLink, Lock } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Avatar } from '#/components/avatar'
import { BookHeader } from '#/components/book-header'
import { FooterBar, Panel, Screen } from '#/components/layout'
import { StarDisplay } from '#/components/stars'
import {
  bookSummaryQuery,
  clubBookQuery,
  membersQuery,
  reviewsQuery,
} from '#/lib/queries'
import type { BookSummary } from '#/lib/queries'
import { starsLabel } from '#/lib/goodreads'

export const Route = createFileRoute('/_app/c/$clubId/books/$bookId/reviews')({
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(reviewsQuery(params.bookId)),
      context.queryClient.ensureQueryData(membersQuery(params.clubId)),
    ]),
  component: ReviewsPage,
})

function ReviewsPage() {
  const { clubId, bookId } = Route.useParams()
  const { user } = Route.useRouteContext()
  const { data: clubBook } = useSuspenseQuery(clubBookQuery(bookId))
  const { data: summary } = useSuspenseQuery(bookSummaryQuery(bookId))
  const { data: reviews } = useSuspenseQuery(reviewsQuery(bookId))
  const { data: members } = useSuspenseQuery(membersQuery(clubId))
  if (!clubBook) return null

  const byId = new Map(members.map((m) => [m.userId, m]))
  const mine = reviews.find((r) => r.user_id === user.id)
  const ordered = [
    ...(mine ? [mine] : []),
    ...reviews.filter((r) => r.user_id !== user.id),
  ]
  const finished = new Set(summary.finished_user_ids)
  const stillReading = members.filter((m) => !finished.has(m.userId))

  return (
    <Screen>
      <BookHeader
        clubId={clubId}
        clubBook={clubBook}
        summary={summary}
        tab="reviews"
      />
      <main className="flex flex-1 flex-col gap-3 px-4 pt-1 pb-6">
        <SummaryCard summary={summary} />

        {!summary.unlocked ? (
          <Panel className="items-start">
            <span className="bg-muted text-muted-foreground inline-flex size-10 items-center justify-center rounded-lg">
              <Lock className="size-5" aria-hidden />
            </span>
            <h2 className="font-display text-xl">
              Finish the book to see the reviews
            </h2>
            <p className="text-muted-foreground text-sm">
              Reviews stay hidden until you post your own, so you form your take
              before reading anyone else’s.
            </p>
          </Panel>
        ) : (
          ordered.map((r) => {
            const m = byId.get(r.user_id)
            const name =
              r.user_id === user.id
                ? `${m?.displayName ?? 'You'} (you)`
                : (m?.displayName ?? 'Former member')
            return (
              <article
                key={r.id}
                className="bg-card flex flex-col gap-2 rounded-[14px] border p-4"
              >
                <div className="flex items-center gap-2.5">
                  <Avatar
                    id={r.user_id}
                    name={m?.displayName ?? name}
                    src={m?.avatarUrl}
                  />
                  <strong className="flex-1 text-sm">{name}</strong>
                  <StarDisplay value={r.rating / 2} />
                  <span
                    className="w-7 text-right text-[13px] font-bold"
                    aria-hidden
                  >
                    {r.rating / 2}
                  </span>
                  <span className="sr-only">{starsLabel(r.rating)}</span>
                </div>
                {r.body && (
                  <p className="text-sm whitespace-pre-wrap">{r.body}</p>
                )}
                <div className="flex items-center gap-4">
                  {r.goodreads_url && (
                    <a
                      href={r.goodreads_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-6 items-center gap-1 text-[13px] font-semibold"
                    >
                      Also on Goodreads
                      <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  )}
                  {r.user_id === user.id && (
                    <Link
                      to="/c/$clubId/books/$bookId/review"
                      params={{ clubId, bookId }}
                      className="min-h-6 text-[13px] font-semibold"
                    >
                      Edit your review
                    </Link>
                  )}
                </div>
              </article>
            )
          })
        )}

        {stillReading.length > 0 && (
          <div className="rounded-[14px] border border-dashed p-4">
            <ul className="text-muted-foreground flex flex-col gap-1 text-[13px]">
              {stillReading.map((m) => (
                <li key={m.userId}>
                  {m.userId === user.id
                    ? 'You’re still reading.'
                    : `${m.displayName} is still reading.`}
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-1.5 text-[13px]">
              Reviews show up here as people finish.
            </p>
          </div>
        )}
      </main>
      {!mine && (
        <FooterBar>
          <Button asChild size="lg">
            <Link
              to="/c/$clubId/books/$bookId/review"
              params={{ clubId, bookId }}
            >
              Finished it? Post your review
            </Link>
          </Button>
        </FooterBar>
      )}
    </Screen>
  )
}

const BUCKETS = [
  { label: '5★', match: (r: number) => r === 10 },
  { label: '4½★', match: (r: number) => r === 9 },
  { label: '4★', match: (r: number) => r === 8 },
  { label: '3½★', match: (r: number) => r === 7 },
  { label: '≤3★', match: (r: number) => r <= 6 },
]

function SummaryCard({ summary }: { summary: BookSummary }) {
  const dist = summary.distribution
  const total = summary.review_count || 1
  const buckets = BUCKETS.map((b) => ({
    label: b.label,
    n: dist
      ? Object.entries(dist).reduce(
          (sum, [rating, n]) => (b.match(Number(rating)) ? sum + n : sum),
          0,
        )
      : 0,
  }))
  return (
    <Panel className="flex-row items-center gap-[18px]">
      <div className="flex min-w-[84px] flex-col items-center">
        <span className="font-display text-primary text-[44px]">
          {summary.average ?? '–'}
        </span>
        <StarDisplay value={summary.average ?? 0} size={14} />
        <span className="text-muted-foreground text-[13px]">
          {summary.average === null ? 'no reviews yet' : 'club avg'}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        {dist &&
          buckets.map((b) => (
            <div key={b.label} className="flex items-center gap-2">
              <span className="text-muted-foreground w-[34px] text-[13px]">
                {b.label}
              </span>
              <div
                className="bg-muted h-2 flex-1 overflow-hidden rounded-full"
                aria-hidden
              >
                <div
                  className="h-full rounded-full bg-[#4B7F61]"
                  style={{ width: `${Math.round((b.n / total) * 100)}%` }}
                />
              </div>
              <span className="w-3 text-right text-[13px]">{b.n}</span>
            </div>
          ))}
        <span className="text-muted-foreground text-[13px]">
          {summary.finished_user_ids.length} of {summary.member_count} finished
        </span>
      </div>
    </Panel>
  )
}
