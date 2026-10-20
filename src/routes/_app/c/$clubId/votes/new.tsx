import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import {
  queryOptions,
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
import {
  FooterBar,
  Panel,
  Screen,
  ScreenBody,
  ScreenHeader,
} from '#/components/layout'
import { clubQuery, openRoundQuery } from '#/lib/queries'
import { getSupabase } from '#/lib/supabase'
import { getSupabaseBrowserClient } from '#/lib/supabase/browser'
import { errorMessage, must } from '#/lib/errors'
import {
  addDays,
  formatDeadline,
  localTimezone,
  toDateInput,
} from '#/lib/dates'

// Picks each starts at the previous vote's value.
const lastPicksQuery = (clubId: string) =>
  queryOptions({
    queryKey: ['club', clubId, 'last-picks'],
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('rounds')
        .select('max_nominations_per_member')
        .eq('club_id', clubId)
        .neq('status', 'cancelled')
        .order('number', { ascending: false })
        .limit(1)
      if (error) throw error
      return data[0]?.max_nominations_per_member ?? 1
    },
  })

export const Route = createFileRoute('/_app/c/$clubId/votes/new')({
  beforeLoad: async ({ context, params }) => {
    const club = await context.queryClient.ensureQueryData(
      clubQuery(params.clubId, context.user.id),
    )
    if (!club?.isAdmin) throw redirect({ to: '/c/$clubId', params })
    const open = await context.queryClient.ensureQueryData(
      openRoundQuery(params.clubId),
    )
    if (open)
      throw redirect({
        to: '/c/$clubId/votes/$roundId',
        params: { ...params, roundId: open.id },
      })
  },
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(lastPicksQuery(params.clubId)),
  head: () => ({ meta: [{ title: 'Pick the next book' }] }),
  component: StartVotePage,
})

const MAX_PICKS = 5

function StartVotePage() {
  const { clubId } = Route.useParams()
  const { data: lastPicks } = useSuspenseQuery(lastPicksQuery(clubId))
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const today = new Date()
  const [date, setDate] = useState(() => toDateInput(addDays(today, 7)))
  const [picks, setPicks] = useState(lastPicks)
  const [note, setNote] = useState('')
  const [anonymous, setAnonymous] = useState(false)

  // End of the chosen day, in this device's timezone (the server does the same maths).
  const closes = date ? formatDeadline(`${date}T12:00:00`) : null

  const start = useMutation({
    mutationFn: () =>
      must(
        getSupabaseBrowserClient().rpc('start_round', {
          p_club_id: clubId,
          p_deadline_date: date,
          p_timezone: localTimezone(),
          p_max_nominations: picks,
          p_anonymous: anonymous,
          p_note: note.trim() || undefined,
        }),
      ),
    onSuccess: async (roundId) => {
      await queryClient.invalidateQueries({ queryKey: ['club', clubId] })
      await queryClient.invalidateQueries({ queryKey: ['clubs'] })
      navigate({
        to: '/c/$clubId/votes/$roundId',
        params: { clubId, roundId: roundId as string },
      })
    },
    onError: (e) =>
      toast.error(errorMessage(e, "Couldn't start the vote. Try again.")),
  })

  return (
    <Screen>
      <ScreenHeader
        title="Pick the next book"
        back={{ to: '/c/$clubId', params: { clubId } }}
        backLabel="Back to club"
      />
      <form
        className="contents"
        onSubmit={(e) => {
          e.preventDefault()
          if (date) start.mutate()
        }}
      >
        <ScreenBody className="gap-4 px-5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
            <div>
              <Label htmlFor="closes" className="mb-1.5">
                Voting closes
              </Label>
              <Input
                id="closes"
                type="date"
                required
                min={toDateInput(today)}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <fieldset>
              <legend className="mb-1.5 text-sm font-semibold">
                Picks each
              </legend>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Fewer nominations each"
                  disabled={picks <= 1}
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
                  disabled={picks >= MAX_PICKS}
                  onClick={() => setPicks((p) => p + 1)}
                >
                  <Plus aria-hidden />
                </Button>
              </div>
            </fieldset>
          </div>
          <div>
            <Label htmlFor="note" className="mb-1.5">
              Note to the club{' '}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Input
              id="note"
              maxLength={120}
              placeholder="Something short and spooky for October?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <Panel className="rounded-xl px-3.5 py-3">
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
          <ul className="text-muted-foreground flex flex-col gap-1.5 text-sm">
            <li>
              Everyone nominates{' '}
              {picks === 1 ? '1 book' : `up to ${picks} books`}, then ranks the
              others.
            </li>
            {closes && (
              <li>Nominating and voting both close at 11:59 PM on {closes}.</li>
            )}
          </ul>
        </ScreenBody>
        <FooterBar>
          <Button type="submit" size="lg" disabled={!date || start.isPending}>
            Start voting
          </Button>
        </FooterBar>
      </form>
    </Screen>
  )
}
