import { Link } from '@tanstack/react-router'
import { ChevronLeft, ExternalLink } from 'lucide-react'
import { BookCover } from '#/components/book-cover'
import { Chip } from '#/components/layout'
import { authorLine } from '#/lib/books'
import { goodreadsBookUrl } from '#/lib/goodreads'
import { cn } from '#/lib/utils'
import type { BookSummary, ClubBook } from '#/lib/queries'

/** Back to club, cover, title, progress, and the Discussion / Reviews tabs. */
export function BookHeader({
  clubId,
  clubBook,
  summary,
  tab,
}: {
  clubId: string
  clubBook: ClubBook
  summary: BookSummary
  tab: 'discussion' | 'reviews'
}) {
  const { book } = clubBook
  const finished = `${summary.finished_user_ids.length} of ${summary.member_count} finished`
  const tabClass = (on: boolean) =>
    cn(
      'flex min-h-[38px] items-center justify-center rounded-md text-sm font-semibold',
      on
        ? 'bg-card text-foreground hover:text-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground',
    )
  return (
    <>
      <header className="flex items-start gap-3 px-4 pt-4 pb-3">
        <Link
          to="/c/$clubId"
          params={{ clubId }}
          aria-label="Back to club"
          className="text-foreground hover:bg-muted hover:text-foreground -ml-2.5 inline-flex size-11 shrink-0 items-center justify-center rounded-lg"
        >
          <ChevronLeft className="size-6" aria-hidden />
        </Link>
        <BookCover
          title={book.title}
          coverUrl={book.cover_url}
          idKey={book.google_books_id}
          width={44}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h1 className="font-display text-2xl">{book.title}</h1>
          <span className="text-muted-foreground text-[13px]">
            {authorLine(book.authors)}
            {book.page_count ? ` · ${book.page_count} pages` : ''}
          </span>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Chip tone={clubBook.status === 'reading' ? 'green' : 'gray'}>
              {clubBook.status === 'reading'
                ? `Reading · ${finished}`
                : `Finished · Book ${clubBook.number}`}
            </Chip>
            <a
              href={goodreadsBookUrl(book)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-6 items-center gap-1 text-[13px] font-semibold"
            >
              Open on Goodreads
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </div>
        </div>
      </header>
      <nav
        aria-label="Book views"
        className="bg-muted mx-4 mb-2 grid grid-cols-2 rounded-lg p-[3px]"
      >
        <Link
          to="/c/$clubId/books/$bookId"
          params={{ clubId, bookId: clubBook.id }}
          className={tabClass(tab === 'discussion')}
          aria-current={tab === 'discussion' ? 'page' : undefined}
        >
          Discussion
        </Link>
        <Link
          to="/c/$clubId/books/$bookId/reviews"
          params={{ clubId, bookId: clubBook.id }}
          className={tabClass(tab === 'reviews')}
          aria-current={tab === 'reviews' ? 'page' : undefined}
        >
          Reviews
        </Link>
      </nav>
    </>
  )
}
