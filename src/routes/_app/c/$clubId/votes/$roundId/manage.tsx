import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Switch } from '#/components/ui/switch'
import { Avatar } from '#/components/avatar'
import { BookCover } from '#/components/book-cover'
import { ConfirmDialog } from '#/components/confirm-dialog'
import {
  Chip,
  FooterBar,
  Panel,
  Screen,
  ScreenBody,
  ScreenHeader,
  SectionLabel,
} from '#/components/layout'
import {
  clubQuery,
  membersQuery,
  nominationsQuery,
  roundQuery,
  voteStatusQuery,
} from '#/lib/queries'
import type { Nomination } from '#/lib/queries'
import { getSupabaseBrowserClient } from '#/lib/supabase/browser'
import { errorMessage, invokeFunction, must } from '#/lib/errors'
import { daysLeftLabel, formatDeadline, toDateInput } from '#/lib/dates'

export const Route = createFileRoute('/_app/c/$clubId/votes/$roundId/manage')({
  beforeLoad: async ({ context, params }) => {
    const club = await context.queryClient.ensureQueryData(
      clubQuery(params.clubId, context.user.id),
    )
    const round = await context.queryClient.ensureQueryData(
      roundQuery(params.roundId),
    )
    if (
      !club?.isAdmin ||
      !round ||
      round.club_id !== params.clubId ||
      round.status !== 'open'
    ) {
      throw redirect({ to: '/c/$clubId/votes/$roundId', params })
    }
  },
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(nominationsQuery(params.roundId)),
      context.queryClient.ensureQueryData(membersQuery(params.clubId)),
      context.queryClient.ensureQueryData(voteStatusQuery(params.roundId)),
    ]),
  head: () => ({ meta: [{ title: 'Manage voting' }] }),
  component: ManageVotePage,
})

/** The date part of a deadline, in the vote's timezone, for the date input. */
function deadlineDate(iso: string, timeZone: string) {
  // en-CA formats dates as yyyy-mm-dd.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

function ManageVotePage() {
  const { clubId, roundId } = Route.useParams()
  const { data: round } = useSuspenseQuery(roundQuery(roundId))
  const { data: nominations } = useSuspenseQuery(nominationsQuery(roundId))
  const { data: members } = useSuspenseQuery(membersQuery(clubId))
  const { data: status } = useSuspenseQuery(voteStatusQuery(roundId))
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const initialDate = round ? deadlineDate(round.deadline, round.timezone) : ''
  const [date, setDate] = useState(initialDate)
  const [picks, setPicks] = useState(round?.max_nominations_per_member ?? 1)
  const [anonymous, setAnonymous] = useState(
    round?.anonymous_nominators ?? false,
  )
  const [removing, setRemoving] = useState<Nomination | null>(null)
  const [closing, setClosing] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['round', roundId] })
    await queryClient.invalidateQueries({ queryKey: ['club', clubId] })
    await queryClient.invalidateQueries({ queryKey: ['clubs'] })
  }

  const save = useMutation({
    mutationFn: () =>
      must(
        getSupabaseBrowserClient().rpc('update_round', {
          p_round_id: roundId,
          p_deadline_date: date !== initialDate ? date : undefined,
          p_max_nominations: picks,
          p_anonymous: anonymous,
        }),
      ),
    onSuccess: async () => {
      await refresh()
      toast.success('Saved')
    },
    onError: (e) => toast.error(errorMessage(e, "Couldn't save. Try again.")),
  })

  if (!round) return null
  const byId = new Map(members.map((m) => [m.userId, m]))
  const voted = status.filter((s) => s.has_voted).length
  const notVoted = status
    .filter((s) => !s.has_voted)
    .map((s) => byId.get(s.user_id))
    .filter((m) => !!m)
  const minPicks = nominations.length > 0 ? round.max_nominations_per_member : 1
  const dirty =
    date !== initialDate ||
    picks !== round.max_nominations_per_member ||
    anonymous !== round.anonymous_nominators

  return (
    <Screen>
      <ScreenHeader
        title={
          <div className="flex flex-col">
            <h1 className="font-display truncate text-[22px]">Manage voting</h1>
            <span className="text-muted-foreground text-[13px]">
              Book {round.number} · admins only
            </span>
          </div>
        }
        back={{ to: '/c/$clubId/votes/$roundId', params: { clubId, roundId } }}
        backLabel="Back to the ballot"
      />
      <form
        className="contents"
        onSubmit={(e) => {
          e.preventDefault()
          if (dirty) save.mutate()
        }}
      >
        <ScreenBody className="gap-3">
          <Panel>
            <div className="flex items-center justify-between">
              <Chip tone="amber">
                Open · {daysLeftLabel(round.deadline).toLowerCase()}
              </Chip>
              <span className="text-muted-foreground text-[13px]">
                Closes end of {formatDeadline(round.deadline, round.timezone)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-background flex flex-col rounded-lg px-3 py-2.5">
                <strong className="text-xl">{nominations.length}</strong>
                <span className="text-muted-foreground text-[13px]">
                  {nominations.length === 1 ? 'nomination' : 'nominations'}
                </span>
              </div>
              <div className="bg-background flex flex-col rounded-lg px-3 py-2.5">
                <strong className="text-xl">
                  {voted} of {status.length}
                </strong>
                <span className="text-muted-foreground text-[13px]">
                  have voted
                </span>
              </div>
            </div>
            {notVoted.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-[13px]">
                  Still to vote:
                </span>
                <div className="flex pl-1.5">
                  {notVoted.slice(0, 5).map((m) => (
                    <Avatar
                      key={m.userId}
                      id={m.userId}
                      name={m.displayName}
                      src={m.avatarUrl}
                      size={24}
                      className="-ml-1.5 border-2 border-card"
                    />
                  ))}
                </div>
                <span className="truncate text-[13px] font-medium">
                  {notVoted.map((m) => m.displayName).join(', ')}
                </span>
              </div>
            )}
          </Panel>

          <SectionLabel className="mt-2">Settings</SectionLabel>
          <Panel className="gap-4">
            <div>
              <Label htmlFor="closes" className="mb-1">
                Voting closes
              </Label>
              <p
                id="closes-hint"
                className="text-muted-foreground mb-1.5 text-[13px]"
              >
                Extend or shorten it. Everyone sees the new date.
              </p>
              <Input
                id="closes"
                type="date"
                required
                min={toDateInput(new Date())}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-describedby="closes-hint"
              />
            </div>
            <fieldset className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <legend className="text-sm font-semibold">Picks each</legend>
                <span className="text-muted-foreground text-[13px]">
                  Can only go up once people have nominated
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Fewer nominations each"
                  disabled={picks <= minPicks}
                  onClick={() => setPicks((p) => p - 1)}
                >
                  <Minus aria-hidden />
                </Button>
                <output
                  aria-live="polite"
                  className="min-w-6 text-center text-lg font-bold"
                >
                  {picks}
                </output>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="More nominations each"
                  disabled={picks >= 5}
                  onClick={() => setPicks((p) => p + 1)}
                >
                  <Plus aria-hidden />
                </Button>
              </div>
            </fieldset>
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span className="flex flex-col">
                <strong className="text-sm">Anonymous voting</strong>
                <span className="text-muted-foreground text-[13px]">
                  Hide who nominated each book until voting closes
                </span>
              </span>
              <Switch
                checked={anonymous}
                onCheckedChange={setAnonymous}
                aria-label="Anonymous voting"
              />
            </label>
          </Panel>

          <SectionLabel className="mt-2">Nominations</SectionLabel>
          {nominations.length === 0 ? (
            <p className="text-muted-foreground text-[13px]">
              No nominations yet.
            </p>
          ) : (
            <Panel className="gap-0 px-3.5 py-1">
              <ul>
                {nominations.map((n) => {
                  const by = n.isMine
                    ? 'you'
                    : n.nominatedBy
                      ? (byId.get(n.nominatedBy)?.displayName ??
                        'a former member')
                      : null
                  return (
                    <li
                      key={n.id}
                      className="flex min-h-14 items-center gap-3 border-b border-muted py-2 last:border-b-0"
                    >
                      <BookCover
                        title={n.book.title}
                        coverUrl={n.book.cover_url}
                        idKey={n.book.google_books_id}
                        width={26}
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <strong className="truncate text-sm">
                          {n.book.title}
                        </strong>
                        <span className="text-muted-foreground text-[13px]">
                          {by ? `by ${by}` : 'Nominated anonymously'}
                        </span>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setRemoving(n)}
                      >
                        Remove
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </Panel>
          )}

          <SectionLabel className="mt-2">End early</SectionLabel>
          <Panel>
            <Button
              type="button"
              variant="outline"
              onClick={() => setClosing(true)}
              disabled={nominations.length === 0}
            >
              Close voting now &amp; count votes
            </Button>
            <Button
              type="button"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setCancelling(true)}
            >
              Cancel this vote
            </Button>
            <span className="text-muted-foreground text-[13px]">
              Cancelling throws out all nominations and ballots for book{' '}
              {round.number}.
            </span>
          </Panel>
        </ScreenBody>
        <FooterBar>
          <Button type="submit" size="lg" disabled={!dirty || save.isPending}>
            Save changes
          </Button>
        </FooterBar>
      </form>

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove ${removing?.book.title ?? 'this book'}?`}
        description="It comes off everyone’s ballot. The person who nominated it can pick another book."
        confirmLabel="Remove"
        destructive
        onConfirm={async () => {
          if (!removing) return
          try {
            await must(
              getSupabaseBrowserClient().rpc('remove_nomination', {
                p_nomination_id: removing.id,
              }),
            )
            await refresh()
          } catch (e) {
            toast.error(errorMessage(e))
            throw e
          }
        }}
      />
      <ConfirmDialog
        open={closing}
        onOpenChange={setClosing}
        title="Close voting now?"
        description={`Votes are counted straight away and the winner becomes book ${round.number}. ${notVoted.length > 0 ? `${notVoted.length} ${notVoted.length === 1 ? 'person hasn’t' : 'people haven’t'} voted yet.` : 'Everyone has voted.'}`}
        confirmLabel="Close & count"
        onConfirm={async () => {
          try {
            await invokeFunction('close-round', { round_id: roundId })
            await refresh()
            navigate({
              to: '/c/$clubId/votes/$roundId',
              params: { clubId, roundId },
            })
          } catch (e) {
            toast.error(errorMessage(e, "Couldn't close the vote. Try again."))
            throw e
          }
        }}
      />
      <ConfirmDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={`Cancel book ${round.number}’s vote?`}
        description="All nominations and ballots are thrown out. You can start a new vote afterwards."
        confirmLabel="Cancel vote"
        destructive
        onConfirm={async () => {
          try {
            await must(
              getSupabaseBrowserClient().rpc('cancel_round', {
                p_round_id: roundId,
              }),
            )
            await refresh()
            navigate({ to: '/c/$clubId', params: { clubId } })
          } catch (e) {
            toast.error(errorMessage(e))
            throw e
          }
        }}
      />
    </Screen>
  )
}
