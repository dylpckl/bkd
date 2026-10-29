import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { Announcements, DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Avatar } from '#/components/avatar'
import { BookCover } from '#/components/book-cover'
import { authorLine } from '#/lib/books'
import { cn } from '#/lib/utils'
import { getSupabaseBrowserClient } from '#/lib/supabase/browser'
import { isTransientError, must } from '#/lib/errors'
import { createSaveQueue } from '#/lib/save-queue'
import type { SaveState } from '#/lib/save-queue'
import { seededOrder } from '#/lib/shuffle'
import type { Nomination } from '#/lib/queries'

export type { SaveState }

type Ballot = { firstCastAt: string; ranking: string[] } | null

/**
 * Ballot state: the ranked order of everyone else's nominations, autosaved on
 * every change. An untouched list isn't a vote; the first move casts it.
 */
export function useBallot(
  roundId: string,
  userId: string,
  nominations: Nomination[],
  ballot: Ballot,
) {
  const queryClient = useQueryClient()
  const rankable = useMemo(
    () => nominations.filter((n) => !n.isMine),
    [nominations],
  )
  const hasVoted = !!ballot && ballot.ranking.length > 0

  const initialOrder = () => {
    const ids = new Set(rankable.map((n) => n.id))
    const ranked = (ballot?.ranking ?? []).filter((id) => ids.has(id))
    // Books you haven't ranked start in an order that's fixed for you and this
    // vote but differs between people, so the first move doesn't cast a ballot
    // that favors whatever was nominated first.
    const rest = seededOrder(
      rankable.map((n) => n.id).filter((id) => !ranked.includes(id)),
      `${userId}:${roundId}`,
    )
    return [...ranked, ...rest]
  }
  const [order, setOrder] = useState<string[]>(initialOrder)
  const [voted, setVoted] = useState(hasVoted)
  const [saveState, setSaveState] = useState<SaveState>(
    hasVoted ? 'saved' : 'idle',
  )

  // Nominations come and go while the page is open: keep the order, drop removed
  // books, and add new ones at the bottom.
  useEffect(() => {
    setOrder((prev) => {
      const ids = rankable.map((n) => n.id)
      const kept = prev.filter((id) => ids.includes(id))
      const added = ids.filter((id) => !kept.includes(id))
      return added.length || kept.length !== prev.length
        ? [...kept, ...added]
        : prev
    })
  }, [rankable])

  // One save in flight at a time, always carrying the latest order; "Saved"
  // only shows once nothing newer is waiting.
  const queue = useMemo(
    () =>
      createSaveQueue<string[]>({
        save: (ids) =>
          must(
            getSupabaseBrowserClient().rpc('save_ballot', {
              p_round_id: roundId,
              p_nomination_ids: ids,
            }),
          ),
        onState: setSaveState,
        onSaved: () => {
          void queryClient.invalidateQueries({
            queryKey: ['round', roundId, 'vote-status'],
          })
          void queryClient.invalidateQueries({
            queryKey: ['round', roundId, 'ballot'],
          })
        },
        shouldRetry: isTransientError,
      }),
    [roundId, queryClient],
  )
  const commit = (next: string[]) => {
    setOrder(next)
    setVoted(true)
    queue.submit(next)
  }
  // Leaving the page sends what's still waiting out the debounce.
  useEffect(() => () => queue.flush(), [queue])

  const firstCastAt = ballot?.firstCastAt ?? null
  const isNew = (n: Nomination) =>
    voted &&
    !!firstCastAt &&
    !(ballot?.ranking ?? []).includes(n.id) &&
    new Date(n.createdAt) > new Date(firstCastAt)

  const byId = new Map(rankable.map((n) => [n.id, n]))
  const rows = order
    .map((id) => byId.get(id))
    .filter((n): n is Nomination => !!n)

  return {
    rows,
    voted,
    saveState,
    isNew,
    commit,
    retry: () => {
      queue.submit(order)
      queue.flush()
    },
  }
}

const CHOICE = ['1st choice', '2nd choice', '3rd choice']

export function BallotList({
  rows,
  voted,
  isNew,
  onReorder,
  onOpen,
  nominator,
}: {
  rows: Nomination[]
  voted: boolean
  isNew: (n: Nomination) => boolean
  onReorder: (ids: string[]) => void
  onOpen: (n: Nomination) => void
  nominator: (
    n: Nomination,
  ) => { id: string; name: string; src: string | null } | null
}) {
  // Mouse + Touch, not Pointer + Touch: on phones the pointer sensor claims the
  // touch first, then the browser cancels it to scroll, so dragging did nothing.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )
  const ids = rows.map((r) => r.id)
  const title = (id: unknown) =>
    rows.find((r) => r.id === id)?.book.title ?? 'Book'
  const pos = (id: unknown) => ids.indexOf(String(id)) + 1
  const n = rows.length

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Picked up ${title(active.id)}, ranked ${pos(active.id)} of ${n}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${title(active.id)} moved to position ${pos(over.id)} of ${n}.`
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${title(active.id)} dropped at position ${pos(over.id)} of ${n}. Your ballot saves automatically.`
        : undefined,
    onDragCancel: ({ active }) =>
      `Cancelled. ${title(active.id)} stays at position ${pos(active.id)}.`,
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    // Dropping a book back where it was still counts as casting the vote.
    onReorder(from === to ? ids : arrayMove(ids, from, to))
  }

  if (rows.length === 1 && !voted) {
    const only = rows[0]
    return (
      <div className="flex flex-col gap-2">
        <Row
          nomination={only}
          index={0}
          isNew={false}
          onOpen={onOpen}
          nominator={nominator(only)}
          static
        />
        <Button variant="outline" onClick={() => onReorder([only.id])}>
          Vote for this book
        </Button>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            'To change the order, press space or enter on the handle, move with the up and down arrow keys, then press space or enter to drop. Escape cancels.',
        },
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol
          className="flex flex-col gap-2 select-none"
          aria-label="Your ranked ballot"
        >
          {rows.map((r, i) => (
            <li key={r.id} className="contents">
              {i === 3 && (
                <div
                  aria-hidden
                  className="text-muted-foreground my-1 flex items-center gap-2 text-[11px] font-semibold tracking-[0.04em] before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border"
                >
                  BACKUPS
                </div>
              )}
              <Row
                nomination={r}
                index={i}
                isNew={isNew(r)}
                onOpen={onOpen}
                nominator={nominator(r)}
              />
            </li>
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  )
}

function Row({
  nomination: r,
  index,
  isNew,
  onOpen,
  nominator,
  static: isStatic = false,
}: {
  nomination: Nomination
  index: number
  isNew: boolean
  onOpen: (n: Nomination) => void
  nominator: { id: string; name: string; src: string | null } | null
  static?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: r.id,
    disabled: isStatic,
  })
  const top = index < 3
  const style = { transform: CSS.Transform.toString(transform), transition }

  // Lifting the finger after a drag that started on the book can land as a tap
  // and open its details; swallow that one click.
  const dragged = useRef(false)
  useEffect(() => {
    if (isDragging) dragged.current = true
  }, [isDragging])

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isStatic ? {} : listeners)}
      // Long-pressing the card is how a drag starts; don't let the phone open its
      // own long-press menu (copy text, save image) over it.
      onContextMenu={isStatic ? undefined : (e) => e.preventDefault()}
      // Each new press starts clean, so a drag from the handle (no stray tap) doesn't
      // eat the next real tap on the book.
      onPointerDown={() => {
        dragged.current = false
      }}
      className={cn(
        // The whole card is the drag target. Covers can't be dragged or long-pressed
        // on their own, and no text callout appears, so a press anywhere starts the drag.
        'bg-card relative flex min-h-15 touch-manipulation items-center gap-2.5 rounded-xl border px-2.5 py-2 select-none [-webkit-touch-callout:none] [&_img]:pointer-events-none',
        index === 0 &&
          !isStatic &&
          'border-primary bg-[#EEF6F0] border-2 px-[9px] py-[7px]',
        index > 0 && top && 'border-[#BFD8C7] bg-[#F6FAF7]',
        isDragging && 'z-10 shadow-lg ring-2 ring-primary/40',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full font-bold',
          top
            ? 'bg-primary size-[30px] text-sm text-white'
            : 'bg-muted text-muted-foreground size-[26px] text-[13px]',
        )}
      >
        {index + 1}
      </span>
      <button
        type="button"
        onClick={() => {
          if (dragged.current) {
            dragged.current = false
            return
          }
          onOpen(r)
        }}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
      >
        <BookCover
          title={r.book.title}
          coverUrl={r.book.cover_url}
          idKey={r.book.google_books_id}
          width={top ? 34 : 28}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          {top && !isStatic && (
            <span className="text-primary text-[10px] font-bold tracking-[0.08em] uppercase">
              {CHOICE[index]}
            </span>
          )}
          <strong
            className={cn(
              'truncate font-semibold',
              top ? 'text-[15px]' : 'text-sm',
            )}
          >
            {r.book.title}
          </strong>
          <span className="text-muted-foreground truncate text-[13px]">
            {authorLine(r.book.authors)}
          </span>
          {isNew && (
            <span className="mt-0.5 self-start rounded-full bg-[#DBEAFE] px-2.5 py-0.5 text-xs font-semibold text-[#1E40AF]">
              New since you voted
            </span>
          )}
        </span>
        <span className="sr-only">, details</span>
      </button>
      {nominator && (
        <span title={`Nominated by ${nominator.name}`}>
          <Avatar
            id={nominator.id}
            name={nominator.name}
            label={`Nominated by ${nominator.name}`}
            src={nominator.src}
            size={28}
            decorative={false}
            className="ring-2 ring-white"
          />
        </span>
      )}
      {!isStatic && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          aria-label={`Reorder ${r.book.title}, ranked ${index + 1}`}
          className="text-stone-400 -mr-1 inline-flex h-11 w-8 shrink-0 cursor-grab items-center justify-center rounded-md active:cursor-grabbing"
        >
          <GripVertical className="size-5" aria-hidden />
        </button>
      )}
    </div>
  )
}
