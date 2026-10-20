import { Link, createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { BookCover } from '#/components/book-cover'
import {
  Chip,
  Screen,
  ScreenBody,
  ScreenHeader,
  SectionLabel,
} from '#/components/layout'
import { clubHistoryQuery, clubQuery } from '#/lib/queries'
import type { HistoryBook } from '#/lib/queries'
import { authorLine } from '#/lib/books'
import {
  formatRating,
  overallAverage,
  pickLine,
  readingDates,
  shortMonthYear,
  startYear,
} from '#/lib/history'

export const Route = createFileRoute('/_app/c/$clubId/books/')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(clubHistoryQuery(params.clubId)),
  head: () => ({ meta: [{ title: 'All books' }] }),
  component: HistoryPage,
})

function HistoryPage() {
  const { clubId } = Route.useParams()
  const { user } = Route.useRouteContext()
  const { data: club } = useSuspenseQuery(clubQuery(clubId, user.id))
  const { data: books } = useSuspenseQuery(clubHistoryQuery(clubId))
  if (!club) return null

  const read = books.filter((b) => b.status === 'finished').length
  const average = overallAverage(books)
  const years = new Map<string, HistoryBook[]>()
  for (const b of books) {
    const y = startYear(b)
    years.set(y, [...(years.get(y) ?? []), b])
  }

  return (
    <Screen>
      <ScreenHeader
        title={<h1 className="font-display text-[26px]">All books</h1>}
        back={{ to: '/c/$clubId', params: { clubId } }}
        backLabel="Back to club"
      />
      <ScreenBody className="gap-2.5">
        <dl className="grid grid-cols-3 gap-2">
          <Stat
            value={String(read)}
            label={read === 1 ? 'book read' : 'books read'}
          />
          <Stat
            value={average === null ? '–' : `${formatRating(average)} ★`}
            label="avg rating"
          />
          <Stat value={shortMonthYear(club.created_at)} label="started" />
        </dl>

        {books.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No books yet. The first vote picks one.
          </p>
        ) : (
          [...years].map(([year, list]) => (
            <section key={year} className="flex flex-col gap-2.5">
              <SectionLabel className="mt-2">{year}</SectionLabel>
              <ul className="flex flex-col gap-2.5">
                {list.map((b) => (
                  <li key={b.id}>
                    <HistoryRow clubId={clubId} book={b} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </ScreenBody>
    </Screen>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-card flex flex-col-reverse rounded-xl border px-3 py-2.5">
      <dt className="text-muted-foreground text-[13px]">{label}</dt>
      <dd className="text-[clamp(16px,5.2vw,20px)] font-bold whitespace-nowrap">
        {value}
      </dd>
    </div>
  )
}

function HistoryRow({
  clubId,
  book: b,
}: {
  clubId: string
  book: HistoryBook
}) {
  const pick = pickLine(b)
  return (
    <Link
      to={
        b.status === 'finished'
          ? '/c/$clubId/books/$bookId/reviews'
          : '/c/$clubId/books/$bookId'
      }
      params={{ clubId, bookId: b.id }}
      className="bg-card text-foreground hover:text-foreground flex items-start gap-3 rounded-[14px] border p-3 hover:border-stone-400"
    >
      <BookCover
        title={b.title}
        coverUrl={b.cover_url}
        idKey={b.google_books_id}
        width={44}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <strong className="text-[15px]">{b.title}</strong>
        <span className="text-muted-foreground text-[13px]">
          {authorLine(b.authors)}
        </span>
        <span className="text-muted-foreground text-[13px]">
          {readingDates(b)}
        </span>
        {pick && (
          <span className="text-muted-foreground text-[13px]">{pick}</span>
        )}
      </span>
      {b.average !== null && (
        <Chip tone="green">
          <span aria-hidden>★</span>
          <span className="sr-only">Club average</span>{' '}
          {formatRating(b.average)}
        </Chip>
      )}
    </Link>
  )
}
