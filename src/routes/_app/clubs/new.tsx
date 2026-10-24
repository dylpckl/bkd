import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  FooterBar,
  Screen,
  ScreenBody,
  ScreenHeader,
} from '#/components/layout'
import { getSupabaseBrowserClient } from '#/lib/supabase/browser'
import { initials } from '#/lib/initials'
import { errorMessage, must } from '#/lib/errors'
import { CLUB_DESCRIPTION_MAX, CLUB_NAME_MAX } from '#/lib/limits'

export const Route = createFileRoute('/_app/clubs/new')({
  head: () => ({ meta: [{ title: 'New club' }] }),
  component: NewClubPage,
})

function NewClubPage() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async () => {
      const rows = await must(
        getSupabaseBrowserClient().rpc('create_club', {
          p_name: name.trim(),
          p_description: description.trim() || undefined,
        }),
      )
      const created = rows?.[0]
      if (!created) throw { message: 'not_allowed' }
      return created
    },
    onSuccess: async ({ club_id }) => {
      await queryClient.invalidateQueries({ queryKey: ['clubs'] })
      navigate({ to: '/c/$clubId/invite', params: { clubId: club_id } })
    },
    onError: (e) =>
      toast.error(errorMessage(e, "Couldn't create the club. Try again.")),
  })

  return (
    <Screen>
      <ScreenHeader title="New club" back={{ to: '/clubs' }} />
      <form
        id="new-club"
        className="contents"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) create.mutate()
        }}
      >
        <ScreenBody>
          <div>
            <Label htmlFor="name" className="mb-1.5">
              Club name
            </Label>
            <Input
              id="name"
              required
              maxLength={CLUB_NAME_MAX}
              placeholder="e.g. The Overdue Society"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="desc" className="mb-1.5">
              Description{' '}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Input
              id="desc"
              maxLength={CLUB_DESCRIPTION_MAX}
              placeholder="A line about your club"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <Shelf name={name.trim()} description={description.trim()} />
        </ScreenBody>
        <FooterBar>
          <Button
            type="submit"
            size="lg"
            disabled={!name.trim() || create.isPending}
          >
            Create club
          </Button>
        </FooterBar>
      </form>
    </Screen>
  )
}

/** Live preview: the club as a book cover on a shelf, as in the mockup. */
function Shelf({ name, description }: { name: string; description: string }) {
  const titleSize = name.length > 24 ? 15 : name.length > 14 ? 18 : 21
  const spine = (
    w: number,
    h: number,
    bg: string,
    extra?: React.CSSProperties,
  ) => (
    <div
      className="rounded-t-[3px] shadow-[inset_-3px_0_0_rgba(0,0,0,.15)]"
      style={{ width: w, height: h, background: bg, ...extra }}
    >
      <i className="mx-1 mt-2.5 block h-[3px] rounded-sm bg-white/45" />
    </div>
  )
  return (
    <div
      aria-hidden
      className="bg-primary-soft relative flex min-h-[270px] flex-1 items-end justify-center overflow-hidden rounded-[18px]"
    >
      <div className="absolute inset-x-0 bottom-0 h-[22px] border-t-[3px] border-[#A9C9B4] bg-[#C6DCCD]" />
      <div className="relative mb-[22px] flex items-end gap-[5px]">
        {spine(22, 150, '#2F5D7C')}
        {spine(16, 120, '#B4532A')}
        {spine(26, 172, '#5B6B3A', {
          transform: 'rotate(-6deg)',
          transformOrigin: 'bottom right',
          marginRight: 6,
        })}
        <div className="bg-primary relative mx-1 flex h-[208px] w-[148px] flex-col items-center gap-2 rounded-[4px_8px_8px_4px] pt-4 pr-3.5 pb-3.5 pl-5 text-center text-white shadow-[inset_6px_0_0_rgba(0,0,0,.22),0_10px_20px_rgba(28,25,23,.18)]">
          <div className="pointer-events-none absolute inset-[8px_8px_8px_14px] rounded-[3px] border-[1.5px] border-white/35" />
          <div className="font-display mt-1.5 flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-[#F5C66B] text-[15px] text-[#F5C66B]">
            {name ? initials(name, { skipArticles: true }) : '?'}
          </div>
          <div className="flex w-full flex-1 flex-col justify-center gap-1.5">
            <div
              className="font-display [overflow-wrap:anywhere]"
              style={{ fontSize: titleSize, opacity: name ? 1 : 0.55 }}
            >
              {name || 'Your club name'}
            </div>
            {description && (
              <div className="line-clamp-3 text-[10px] leading-snug font-medium text-[#D6E7DC] italic">
                {description}
              </div>
            )}
          </div>
          <div className="text-[9px] font-bold tracking-[0.14em] text-[#F5C66B]">
            EST. {new Date().getFullYear()}
          </div>
        </div>
        {spine(20, 138, '#7A3E65')}
        {spine(24, 160, '#8A5A12')}
      </div>
    </div>
  )
}
