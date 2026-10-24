import { BookCover } from '#/components/book-cover'
import { Panel, SectionLabel } from '#/components/layout'
import { authorLine } from '#/lib/books'
import { cn } from '#/lib/utils'
import { finishNote } from '../../supabase/functions/_shared/irv.ts'
import type { IrvTallies, Nomination } from '#/lib/queries'

/** "How book 3 was picked": the winner card and one set of bars, the final standings. */
export function Results({
  tallies,
  nominations,
}: {
  tallies: IrvTallies
  nominations: Nomination[]
}) {
  const byId = new Map(nominations.map((n) => [n.id, n]))
  const winner = byId.get(tallies.winner)
  const total = Math.max(tallies.ballots, 1)
  const winnerVotes = tallies.finishingOrder[0]?.finalVotes ?? 0

  const summary =
    tallies.method === 'random'
      ? 'Picked at random, since nobody voted.'
      : tallies.method === 'single'
        ? 'The only book nominated, so it won automatically.'
        : tallies.counts.length === 1
          ? `Won outright with ${winnerVotes} of ${tallies.ballots} votes.`
          : `${winnerVotes} of ${tallies.ballots} votes once the others were knocked out.`

  return (
    <div className="flex flex-col gap-3.5">
      {winner && (
        <Panel className="border-primary border-2 p-[15px]">
          <div className="flex items-start gap-4">
            <BookCover
              title={winner.book.title}
              coverUrl={winner.book.cover_url}
              idKey={winner.book.google_books_id}
              width={72}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="bg-primary self-start rounded-full px-2.5 py-0.5 text-xs font-semibold text-white">
                Winner
              </span>
              <h2 className="font-display text-2xl">{winner.book.title}</h2>
              <span className="text-muted-foreground text-sm">
                {authorLine(winner.book.authors)}
              </span>
              <p className="text-sm">{summary}</p>
            </div>
          </div>
        </Panel>
      )}

      {tallies.method !== 'single' && (
        <>
          <div className="mt-1 flex items-baseline justify-between">
            <SectionLabel>Final standings</SectionLabel>
            <span className="text-muted-foreground text-[13px]">
              {tallies.ballots} {tallies.ballots === 1 ? 'ballot' : 'ballots'}
            </span>
          </div>
          <ol className="flex flex-col gap-2.5">
            {tallies.finishingOrder.map((f) => {
              const n = byId.get(f.id)
              const isWinner = f.outcome === 'winner'
              const pct = Math.round((f.finalVotes / total) * 100)
              return (
                <li
                  key={f.id}
                  className="bg-card flex items-start gap-3 rounded-xl border px-3 py-2.5"
                >
                  <span
                    className={cn(
                      'mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      isWinner
                        ? 'bg-primary text-white'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {f.place}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <strong
                        className={cn(
                          'truncate text-sm',
                          isWinner ? 'font-bold' : 'font-medium',
                        )}
                      >
                        {n?.book.title ?? 'Removed book'}
                      </strong>
                      <span className="shrink-0 text-sm font-semibold">
                        {f.finalVotes} {f.finalVotes === 1 ? 'vote' : 'votes'}
                      </span>
                    </div>
                    {tallies.method === 'irv' && (
                      <div
                        className="bg-muted h-2 overflow-hidden rounded-full"
                        aria-hidden
                      >
                        <div
                          className={cn(
                            'h-full rounded-full',
                            isWinner ? 'bg-primary' : 'bg-stone-400',
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                    <span className="text-muted-foreground text-[13px]">
                      {finishNote(f, tallies.method)}
                    </span>
                  </div>
                </li>
              )
            })}
          </ol>
          {tallies.method === 'irv' && (
            <p className="text-muted-foreground text-[13px]">
              Bars show each book's votes at the end. Books with the fewest
              votes were knocked out one at a time, and their votes moved to
              each voter's next choice until one book had more than half.
            </p>
          )}
        </>
      )}
    </div>
  )
}
