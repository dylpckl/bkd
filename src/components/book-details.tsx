import { useState } from 'react'
import { BookCover } from '#/components/book-cover'
import {
  authorLine,
  bookSourceLink,
  publishedYear,
  readingTime,
} from '#/lib/books'
import type { BookInfo } from '#/lib/books'

/** Cover, title, facts and description: the top of the book details sheet. */
export function BookDetails({ book }: { book: BookInfo }) {
  const [expanded, setExpanded] = useState(false)
  const year = publishedYear(book.published_date)
  const hours = readingTime(book.page_count)
  const link = bookSourceLink(book.google_books_id)
  const facts = [
    year && { value: year, label: 'published' },
    book.page_count && { value: String(book.page_count), label: 'pages' },
    hours && { value: hours, label: 'to read' },
  ].filter(Boolean) as { value: string; label: string }[]
  const edition = [book.publisher, book.isbn13 && `ISBN ${book.isbn13}`]
    .filter(Boolean)
    .join(' · ')
  const longDescription = (book.description?.length ?? 0) > 280

  return (
    <>
      <div className="flex items-start gap-4">
        <BookCover
          title={book.title}
          coverUrl={book.cover_url}
          idKey={book.google_books_id}
          width={96}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h2 className="font-display text-[22px]">{book.title}</h2>
          {book.subtitle && (
            <p className="text-muted-foreground -mt-1 text-sm">
              {book.subtitle}
            </p>
          )}
          <span className="text-muted-foreground">
            {authorLine(book.authors)}
          </span>
          {book.categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {book.categories.slice(0, 3).map((c) => (
                <span
                  key={c}
                  className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-semibold"
                >
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {facts.length > 0 && (
        <dl className="grid grid-cols-3 gap-2">
          {facts.map((f) => (
            <div
              key={f.label}
              className="bg-background flex flex-col rounded-lg border px-2.5 py-2"
            >
              <dd className="text-sm font-bold">{f.value}</dd>
              <dt className="text-muted-foreground text-[13px]">{f.label}</dt>
            </div>
          ))}
        </dl>
      )}
      <div>
        {book.description ? (
          <>
            <p
              className={
                expanded
                  ? 'text-sm whitespace-pre-line'
                  : 'line-clamp-4 text-sm whitespace-pre-line'
              }
            >
              {book.description}
            </p>
            {longDescription && (
              <button
                type="button"
                className="text-primary mt-1 text-[13px] font-semibold"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? 'Show less' : 'Read more'}
              </button>
            )}
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            No description available.
          </p>
        )}
        {(edition || link) && (
          <span className="text-muted-foreground mt-1.5 block text-[13px]">
            {edition}
            {edition && link && ' · '}
            {link && (
              <a href={link.href} target="_blank" rel="noreferrer">
                {link.label} ↗
              </a>
            )}
          </span>
        )}
      </div>
    </>
  )
}
