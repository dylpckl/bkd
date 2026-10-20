import { Link, createFileRoute } from '@tanstack/react-router'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { useState } from 'react'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { BookCover } from '#/components/book-cover'
import {
  FooterBar,
  Panel,
  Screen,
  ScreenBody,
  ScreenHeader,
} from '#/components/layout'
import { StarInput } from '#/components/stars'
import { clubBookQuery, reviewsQuery } from '#/lib/queries'
import { authorLine } from '#/lib/books'
import { goodreadsBookUrl, goodreadsStars, starsLabel } from '#/lib/goodreads'
import { getSupabaseBrowserClient } from '#/lib/supabase/browser'
import { errorMessage, must } from '#/lib/errors'

export const Route = createFileRoute('/_app/c/$clubId/books/$bookId/review')({
  loader: ({ context, params }) =>
    // Fresh, so a review posted on another device opens as an edit.
    context.queryClient.fetchQuery(reviewsQuery(params.bookId)),
  head: () => ({ meta: [{ title: 'Your review' }] }),
  component: ReviewPage,
})

function ReviewPage() {
  const { clubId, bookId } = Route.useParams()
  const { user } = Route.useRouteContext()
  const { data: clubBook } = useSuspenseQuery(clubBookQuery(bookId))
  const { data: reviews } = useSuspenseQuery(reviewsQuery(bookId))
  const existing = reviews.find((r) => r.user_id === user.id)
  const queryClient = useQueryClient()

  const [rating, setRating] = useState(existing?.rating ?? 0)
  const [body, setBody] = useState(existing?.body ?? '')
  const [goodreadsUrl, setGoodreadsUrl] = useState(
    existing?.goodreads_url ?? '',
  )
  const [posted, setPosted] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)

  const post = useMutation({
    mutationFn: () =>
      must(
        getSupabaseBrowserClient().rpc('post_review', {
          p_club_book_id: bookId,
          p_rating: rating,
          p_body: body.trim() || undefined,
          p_goodreads_url: goodreadsUrl.trim() || undefined,
        }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['club-book', bookId] })
      await queryClient.invalidateQueries({ queryKey: ['club', clubId] })
      await queryClient.invalidateQueries({ queryKey: ['clubs'] })
      setPosted(true)
      window.scrollTo({ top: 0 })
    },
    onError: (e: { message?: string }) => {
      if (e.message === 'invalid_goodreads_url')
        setUrlError('Paste a link that starts with https://www.goodreads.com/')
      else toast.error(errorMessage(e, "Couldn't post your review. Try again."))
    },
  })

  if (!clubBook) return null
  const { book } = clubBook
  const gr = goodreadsStars(rating || 1)
  const grLabel = `${gr} ${gr === 1 ? 'star' : 'stars'}`

  const copyAndOpen = () => {
    // Open first, inside the click, so pop-up blockers allow it.
    window.open(goodreadsBookUrl(book), '_blank', 'noopener,noreferrer')
    if (body.trim()) {
      navigator.clipboard.writeText(body.trim()).then(
        () => toast.success('Review copied. Paste it on Goodreads.'),
        () =>
          toast.error(
            'Couldn’t copy your review. Copy it from the box yourself.',
          ),
      )
    }
  }

  return (
    <Screen>
      <ScreenHeader
        title={
          posted
            ? 'Thanks for your review'
            : existing
              ? 'Edit your review'
              : 'Finished it?'
        }
        back={{ to: '/c/$clubId/books/$bookId', params: { clubId, bookId } }}
        backLabel="Back to the book"
      />
      <ScreenBody className="gap-4 px-5">
        <div className="flex items-center gap-3">
          <BookCover
            title={book.title}
            coverUrl={book.cover_url}
            idKey={book.google_books_id}
            width={40}
          />
          <div className="flex flex-col">
            <strong>{book.title}</strong>
            <span className="text-muted-foreground text-[13px]">
              {authorLine(book.authors)}
            </span>
          </div>
        </div>

        {posted ? (
          <>
            <Panel className="border-[#C6DCCD] bg-primary-soft">
              <strong className="text-primary" role="status">
                You finished {book.title} · {starsLabel(rating)}
              </strong>
              <span className="text-sm">
                Club reviews are unlocked for you.
              </span>
            </Panel>
            <Panel>
              <strong>Also reviewing on Goodreads?</strong>
              <span className="text-muted-foreground text-[13px]">
                {body.trim()
                  ? `We’ll copy your review and open the book on Goodreads. Paste it there and pick ${grLabel}.`
                  : `We’ll open the book on Goodreads. Pick ${grLabel} there.`}
              </span>
              <Button variant="outline" onClick={copyAndOpen}>
                <Copy aria-hidden />
                {body.trim()
                  ? 'Copy review & open Goodreads'
                  : 'Open Goodreads'}
              </Button>
            </Panel>
            <Button
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => setPosted(false)}
            >
              Edit review
            </Button>
          </>
        ) : (
          <form
            id="review-form"
            className="flex flex-col gap-[18px]"
            onSubmit={(e) => {
              e.preventDefault()
              setUrlError(null)
              if (rating) post.mutate()
            }}
          >
            <fieldset>
              <legend className="mb-1.5 text-sm font-semibold">Rating</legend>
              <StarInput value={rating} onChange={setRating} />
              <div className="mt-1.5 flex items-center justify-between">
                <strong className="text-[17px]" aria-live="polite">
                  {rating ? starsLabel(rating) : 'Pick a rating'}
                </strong>
                <span className="text-muted-foreground text-[13px]">
                  Tap the left half for a half star
                </span>
              </div>
              {rating > 0 && rating % 2 === 1 && (
                <span className="text-muted-foreground mt-1 block text-[13px]">
                  Goodreads only takes whole stars, so this becomes {grLabel}{' '}
                  there.
                </span>
              )}
            </fieldset>
            <div>
              <Label htmlFor="body" className="mb-1.5">
                Review{' '}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="body"
                rows={5}
                maxLength={10000}
                className="resize-none"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="gr" className="mb-1.5">
                Goodreads review link{' '}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                id="gr"
                type="url"
                inputMode="url"
                placeholder="https://www.goodreads.com/review/show/…"
                value={goodreadsUrl}
                onChange={(e) => setGoodreadsUrl(e.target.value)}
                aria-invalid={!!urlError}
                aria-describedby={urlError ? 'gr-error' : undefined}
              />
              {urlError && (
                <p
                  id="gr-error"
                  className="text-destructive mt-1.5 text-[13px] font-medium"
                >
                  {urlError}
                </p>
              )}
            </div>
            {!existing && (
              <p className="text-muted-foreground text-[13px]">
                Posting marks you as finished. That unlocks everyone else’s
                reviews, no matter where the rest of the club is.
              </p>
            )}
          </form>
        )}
      </ScreenBody>
      <FooterBar>
        {posted ? (
          <Button asChild size="lg">
            <Link
              to="/c/$clubId/books/$bookId/reviews"
              params={{ clubId, bookId }}
            >
              See club reviews
            </Link>
          </Button>
        ) : (
          <Button
            type="submit"
            form="review-form"
            size="lg"
            disabled={!rating || post.isPending}
          >
            {existing ? 'Save changes' : 'Finish & post review'}
          </Button>
        )}
      </FooterBar>
    </Screen>
  )
}
