import { createFileRoute } from '@tanstack/react-router'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { ArrowUp, MoreHorizontal, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Textarea } from '#/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Avatar } from '#/components/avatar'
import { BookHeader } from '#/components/book-header'
import { ConfirmDialog } from '#/components/confirm-dialog'
import { Screen } from '#/components/layout'
import {
  bookSummaryQuery,
  clubBookQuery,
  clubQuery,
  membersQuery,
  postsQuery,
} from '#/lib/queries'
import type { Post } from '#/lib/queries'
import { getSupabaseBrowserClient } from '#/lib/supabase/browser'
import { errorMessage, must } from '#/lib/errors'
import { timeAgo } from '#/lib/dates'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/_app/c/$clubId/books/$bookId/')({
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.fetchQuery(postsQuery(params.bookId)),
      context.queryClient.ensureQueryData(membersQuery(params.clubId)),
    ]),
  component: DiscussionPage,
})

type Member = { userId: string; displayName: string; avatarUrl: string | null }

function DiscussionPage() {
  const { clubId, bookId } = Route.useParams()
  const { user } = Route.useRouteContext()
  const { data: club } = useSuspenseQuery(clubQuery(clubId, user.id))
  const { data: clubBook } = useSuspenseQuery(clubBookQuery(bookId))
  const { data: summary } = useSuspenseQuery(bookSummaryQuery(bookId))
  // No realtime until phase 6: check for new posts every 20 seconds while the page is open.
  const { data: posts } = useSuspenseQuery({
    ...postsQuery(bookId),
    refetchInterval: 20_000,
  })
  const { data: members } = useSuspenseQuery(membersQuery(clubId))
  const [replyTo, setReplyTo] = useState<Post | null>(null)
  const composer = useRef<HTMLTextAreaElement>(null)
  if (!clubBook || !club) return null

  const byId = new Map<string, Member>(members.map((m) => [m.userId, m]))
  const topLevel = posts.filter((p) => !p.parent_id)
  const repliesTo = (id: string) => posts.filter((p) => p.parent_id === id)
  const startReply = (p: Post) => {
    setReplyTo(posts.find((x) => x.id === p.parent_id) ?? p)
    composer.current?.focus()
  }

  return (
    <Screen>
      <BookHeader
        clubId={clubId}
        clubBook={clubBook}
        summary={summary}
        tab="discussion"
      />
      {club.isAdmin && <DiscussionMode bookId={bookId} />}
      <main className="flex flex-1 flex-col gap-2.5 px-4 pt-1 pb-36">
        {topLevel.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No posts yet. Start the conversation below.
          </p>
        ) : (
          topLevel.map((p) => (
            <div key={p.id} className="flex flex-col gap-2">
              <PostCard
                post={p}
                author={byId.get(p.author_id)}
                userId={user.id}
                isAdmin={club.isAdmin}
                bookId={bookId}
                onReply={startReply}
                replyCount={repliesTo(p.id).length}
              />
              {repliesTo(p.id).map((r) => (
                <div key={r.id} className="ml-6">
                  <PostCard
                    post={r}
                    author={byId.get(r.author_id)}
                    userId={user.id}
                    isAdmin={club.isAdmin}
                    bookId={bookId}
                    onReply={startReply}
                  />
                </div>
              ))}
            </div>
          ))
        )}
      </main>
      <Composer
        bookId={bookId}
        replyTo={replyTo}
        replyName={
          replyTo
            ? (byId.get(replyTo.author_id)?.displayName ?? 'a former member')
            : null
        }
        onClearReply={() => setReplyTo(null)}
        inputRef={composer}
      />
    </Screen>
  )
}

function DiscussionMode({ bookId }: { bookId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="px-4 pb-1.5">
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-muted-foreground">
          This book: <strong className="text-foreground">One thread</strong> ·
          set by admins
        </span>
        <button
          type="button"
          className="text-primary min-h-8 font-semibold"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={`mode-${bookId}`}
        >
          {open ? 'Done' : 'Edit'}
        </button>
      </div>
      {open && (
        <div
          id={`mode-${bookId}`}
          className="bg-card mt-1.5 flex flex-col gap-2 rounded-[14px] border p-3"
        >
          <strong className="text-sm">Discussion style for this book</strong>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed="true"
              className="bg-foreground text-background min-h-10 rounded-full text-[13px] font-semibold"
            >
              One thread
            </button>
            <button
              type="button"
              aria-pressed="false"
              disabled
              className="text-muted-foreground min-h-10 rounded-full border border-input bg-card text-[13px] font-semibold opacity-60"
            >
              Sections
            </button>
          </div>
          <span className="text-muted-foreground text-[13px]">
            Sections by chapter, with spoiler protection, are coming soon.
          </span>
        </div>
      )}
    </div>
  )
}

function PostCard({
  post,
  author,
  userId,
  isAdmin,
  bookId,
  onReply,
  replyCount,
}: {
  post: Post
  author: Member | undefined
  userId: string
  isAdmin: boolean
  bookId: string
  onReply: (p: Post) => void
  replyCount?: number
}) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(post.body)
  const [deleting, setDeleting] = useState(false)
  const mine = post.author_id === userId
  const name = author?.displayName ?? 'Former member'
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['club-book', bookId, 'posts'] })

  const save = useMutation({
    mutationFn: () =>
      must(
        getSupabaseBrowserClient()
          .from('posts')
          .update({ body: draft })
          .eq('id', post.id),
      ),
    onSuccess: async () => {
      await refresh()
      setEditing(false)
    },
    onError: (e) => toast.error(errorMessage(e, "Couldn't save your edit.")),
  })

  return (
    <article className="bg-card flex flex-col gap-1.5 rounded-[14px] border px-3.5 py-3">
      <div className="flex items-center gap-2.5">
        <Avatar
          id={post.author_id}
          name={name}
          src={author?.avatarUrl}
          size={28}
        />
        <strong className="text-sm">{mine ? `${name} (you)` : name}</strong>
        <span className="text-muted-foreground text-[13px]">
          <time dateTime={post.created_at}>{timeAgo(post.created_at)}</time>
          {post.edited_at && ' · edited'}
        </span>
        {(mine || isAdmin) && !editing && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`More actions for ${name}'s post`}
                className="text-muted-foreground hover:bg-muted ml-auto inline-flex size-8 items-center justify-center rounded-md"
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {mine && (
                <DropdownMenuItem
                  onSelect={() => {
                    // Start from the latest text, which may have changed since mount.
                    setDraft(post.body)
                    setEditing(true)
                  }}
                >
                  Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setDeleting(true)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {editing ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (draft.trim()) save.mutate()
          }}
        >
          <Textarea
            aria-label="Edit your post"
            value={draft}
            maxLength={4000}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => (setEditing(false), setDraft(post.body))}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="outline"
              disabled={!draft.trim() || save.isPending}
            >
              Save
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm whitespace-pre-wrap">{post.body}</p>
      )}
      {!editing && (
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="text-muted-foreground min-h-8 text-[13px] font-semibold"
            onClick={() => onReply(post)}
          >
            Reply
          </button>
          {!!replyCount && (
            <span className="text-muted-foreground text-[13px]">
              {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
            </span>
          )}
        </div>
      )}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this post?"
        description={
          post.parent_id
            ? 'This can’t be undone.'
            : 'Any replies to it are deleted too. This can’t be undone.'
        }
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          try {
            await must(
              getSupabaseBrowserClient()
                .from('posts')
                .delete()
                .eq('id', post.id),
            )
            await refresh()
          } catch (e) {
            toast.error(errorMessage(e))
            throw e
          }
        }}
      />
    </article>
  )
}

function Composer({
  bookId,
  replyTo,
  replyName,
  onClearReply,
  inputRef,
}: {
  bookId: string
  replyTo: Post | null
  replyName: string | null
  onClearReply: () => void
  inputRef: React.RefObject<HTMLTextAreaElement | null>
}) {
  const queryClient = useQueryClient()
  const [body, setBody] = useState('')
  const send = useMutation({
    mutationFn: () =>
      must(
        getSupabaseBrowserClient()
          .from('posts')
          .insert({
            club_book_id: bookId,
            parent_id: replyTo?.id ?? null,
            body,
          }),
      ),
    onSuccess: async () => {
      setBody('')
      onClearReply()
      await queryClient.invalidateQueries({
        queryKey: ['club-book', bookId, 'posts'],
      })
    },
    onError: (e) => {
      toast.error(errorMessage(e, "Couldn't post. Try again."))
      if ((e as { message?: string }).message === 'invalid_reply') {
        // The post being replied to was deleted; drop it and show the thread as it is.
        onClearReply()
        void queryClient.invalidateQueries({
          queryKey: ['club-book', bookId, 'posts'],
        })
      }
    },
  })

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card">
      <form
        className="pb-safe mx-auto flex w-full max-w-lg flex-col gap-1.5 px-3 pt-2 sm:pb-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (body.trim() && !send.isPending) send.mutate()
        }}
      >
        {replyTo && (
          <div className="text-muted-foreground flex items-center gap-1 pl-1 text-[13px]">
            Replying to <strong className="text-foreground">{replyName}</strong>
            <button
              type="button"
              aria-label="Cancel reply"
              onClick={onClearReply}
              className="hover:bg-muted ml-1 inline-flex size-7 items-center justify-center rounded-md"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <label htmlFor="post-body" className="sr-only">
            {replyTo ? `Reply to ${replyName}` : 'Write a post'}
          </label>
          <Textarea
            id="post-body"
            ref={inputRef}
            rows={1}
            maxLength={4000}
            placeholder={replyTo ? 'Write a reply…' : 'Add to the discussion…'}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                e.currentTarget.form?.requestSubmit()
              }
            }}
            className={cn(
              'max-h-40 min-h-11 resize-none rounded-[22px] px-4 py-2.5 text-[15px]',
            )}
          />
          <Button
            type="submit"
            size="icon"
            className="rounded-full"
            aria-label={replyTo ? 'Post reply' : 'Post'}
            disabled={!body.trim() || send.isPending}
          >
            <ArrowUp className="size-5" aria-hidden />
          </Button>
        </div>
      </form>
    </div>
  )
}
