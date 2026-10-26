import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Loader2, Search } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { Command as CommandPrimitiveRoot } from 'cmdk'
import { toast } from 'sonner'
import {
  Command,
  CommandEmpty,
  CommandItem,
  CommandList,
} from '#/components/ui/command'
import { Button } from '#/components/ui/button'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { BookCover } from '#/components/book-cover'
import { BookDetails } from '#/components/book-details'
import { ResponsiveSheet } from '#/components/responsive-sheet'
import { useDebouncedValue } from '#/hooks/use-debounced-value'
import { authorLine, fromSearchResult, publishedYear } from '#/lib/books'
import type { BookInfo, SearchResult } from '#/lib/books'
import { errorMessage, invokeFunction } from '#/lib/errors'
import type { Nomination, Round } from '#/lib/queries'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  round: Round
  nominations: Nomination[]
  /** The viewer's nomination being swapped out, when they tapped Change. */
  replacing?: Nomination | null
  nameOf: (userId: string | null) => string | null
}

/**
 * ⌘K-style search over Google Books. Picking a result opens the details sheet,
 * where the member adds an optional pitch and confirms.
 */
export function BookSearch({
  open,
  onOpenChange,
  round,
  nominations,
  replacing,
  nameOf,
}: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<BookInfo | null>(null)
  const [pitch, setPitch] = useState('')
  const queryClient = useQueryClient()
  const q = useDebouncedValue(query.trim(), 300)

  const search = useQuery({
    queryKey: ['book-search', q],
    queryFn: () =>
      invokeFunction<{ results: SearchResult[] }>('search-books', { q }),
    enabled: open && q.length >= 2,
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
    // search-books already retries Google and falls back to Open Library, so a
    // failure here is final. Retrying in the browser too multiplied every
    // failed search into up to 12 upstream calls and used up the rate limit.
    retry: false,
  })

  const nominatedBy = new Map(
    nominations.map((n) => [n.book.google_books_id, n]),
  )
  const mine = nominations.filter((n) => n.isMine).length
  const left = round.max_nominations_per_member - mine

  const nominate = useMutation({
    // `replacing` goes in the variables: after the refetch it's gone from props.
    mutationFn: (vars: { book: BookInfo; replaceId: string | null }) =>
      invokeFunction<{ nomination_id: string }>('nominate', {
        round_id: round.id,
        google_books_id: vars.book.google_books_id,
        pitch: pitch.trim() || undefined,
        replace_nomination_id: vars.replaceId ?? undefined,
      }),
    onSuccess: (_, { book, replaceId }) => {
      toast.success(
        replaceId ? `Changed to ${book.title}` : `Nominated ${book.title}`,
      )
      setSelected(null)
      setPitch('')
      setQuery('')
      onOpenChange(false)
      void queryClient.invalidateQueries({ queryKey: ['round', round.id] })
      void queryClient.invalidateQueries({ queryKey: ['club', round.club_id] })
    },
    onError: (e) =>
      toast.error(errorMessage(e, "Couldn't nominate that book. Try again.")),
  })

  const results = (search.data?.results ?? []).map(fromSearchResult)
  const subtitle = replacing
    ? `Book ${round.number} · pick a book to replace ${replacing.book.title}`
    : `Book ${round.number} · you have ${left} ${left === 1 ? 'nomination' : 'nominations'} left · tap a book for details`

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/40" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="bg-background fixed inset-0 z-50 flex flex-col outline-none sm:inset-auto sm:top-[10dvh] sm:left-1/2 sm:h-[75dvh] sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:rounded-xl sm:border sm:shadow-lg"
        >
          <DialogPrimitive.Title className="sr-only">
            {replacing ? 'Change your nomination' : 'Nominate a book'}
          </DialogPrimitive.Title>
          <Command
            shouldFilter={false}
            label="Search books"
            className="bg-transparent"
          >
            <div className="flex flex-col gap-2.5 border-b pt-3.5 pr-3 pb-2.5 pl-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search
                    className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2"
                    aria-hidden
                  />
                  {/* cmdk's input wires up arrow-key navigation through the results. */}
                  <CommandInputBare value={query} onValueChange={setQuery} />
                  {search.isFetching && (
                    <Loader2
                      className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin"
                      aria-label="Searching"
                    />
                  )}
                </div>
                <DialogPrimitive.Close asChild>
                  <Button
                    variant="ghost"
                    className="text-primary hover:text-primary-hover px-2.5"
                  >
                    Cancel
                  </Button>
                </DialogPrimitive.Close>
              </div>
              <span className="text-muted-foreground text-[13px]">
                {subtitle}
              </span>
            </div>
            <CommandList className="max-h-none flex-1 px-1.5 py-2">
              {q.length >= 2 && !search.isFetching && search.isSuccess && (
                <CommandEmpty>
                  No books found. Try the title and author.
                </CommandEmpty>
              )}
              {search.isError && (
                <p
                  className="text-destructive px-3 py-6 text-center text-sm"
                  role="alert"
                >
                  {errorMessage(search.error)}
                </p>
              )}
              {q.length < 2 && (
                <p className="text-muted-foreground px-3 py-6 text-center text-sm">
                  Search by title, author or ISBN.
                </p>
              )}
              {results.map((book) => {
                const taken = nominatedBy.get(book.google_books_id)
                const takenBy =
                  taken && (taken.isMine ? 'you' : nameOf(taken.nominatedBy))
                return (
                  <CommandItem
                    key={book.google_books_id}
                    value={book.google_books_id}
                    disabled={!!taken}
                    onSelect={() => {
                      // Each book starts with an empty pitch.
                      setPitch('')
                      setSelected(book)
                    }}
                    className="min-h-17 gap-3 rounded-lg px-3 py-2.5"
                  >
                    <BookCover
                      title={book.title}
                      coverUrl={book.cover_url}
                      idKey={book.google_books_id}
                      width={34}
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <strong className="truncate text-[15px] font-semibold">
                        {book.title}
                      </strong>
                      <span className="text-muted-foreground truncate text-[13px]">
                        {authorLine(book.authors)}
                        {publishedYear(book.published_date) &&
                          ` · ${publishedYear(book.published_date)}`}
                      </span>
                      {taken && (
                        <span className="text-warning-foreground text-[13px] font-semibold">
                          {takenBy
                            ? `Already nominated by ${takenBy}`
                            : 'Already nominated'}
                        </span>
                      )}
                    </span>
                    <ChevronRight
                      className="size-[18px] text-stone-500"
                      aria-hidden
                    />
                  </CommandItem>
                )
              })}
              {results.length > 0 && (
                <p className="text-muted-foreground hidden py-2.5 text-center text-[13px] sm:block">
                  Results from Google Books · ↑ ↓ to move, ↵ to open
                </p>
              )}
            </CommandList>
          </Command>

          {selected && (
            <ResponsiveSheet
              open={!!selected}
              onOpenChange={(o) =>
                !o && !nominate.isPending && setSelected(null)
              }
              title={selected.title}
              description="Book details"
              footer={
                <>
                  <Button
                    size="lg"
                    onClick={() =>
                      nominate.mutate({
                        book: selected,
                        replaceId: replacing?.id ?? null,
                      })
                    }
                    disabled={nominate.isPending}
                  >
                    {replacing ? 'Nominate this instead' : 'Nominate this book'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="lg"
                    className="text-primary hover:text-primary-hover"
                    onClick={() => setSelected(null)}
                    disabled={nominate.isPending}
                  >
                    Not this one — back to results
                  </Button>
                </>
              }
            >
              <BookDetails book={selected} />
              <div>
                <Label htmlFor="pitch" className="mb-1.5">
                  Why this one?{' '}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </Label>
                <Textarea
                  id="pitch"
                  rows={2}
                  maxLength={280}
                  className="resize-none"
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value)}
                />
              </div>
            </ResponsiveSheet>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function CommandInputBare(props: {
  value: string
  onValueChange: (v: string) => void
}) {
  return (
    <CommandInputPrimitive
      {...props}
      autoFocus
      placeholder="Title, author or ISBN"
      className="border-primary bg-card h-12 w-full rounded-lg border-2 pr-9 pl-10 text-base outline-none"
    />
  )
}

// cmdk's raw input, without shadcn's wrapper (we draw our own search field).
const CommandInputPrimitive = CommandPrimitiveRoot.Input
