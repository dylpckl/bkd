import { Link, createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { BookCheck, ChevronRight, ListOrdered, Plus } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Avatar, ClubMark } from '#/components/avatar'
import {
  Chip,
  FooterBar,
  Screen,
  ScreenBody,
  SectionLabel,
} from '#/components/layout'
import {
  ROLE_LABEL,
  avatarSrc,
  myClubsQuery,
  needsYouQuery,
  profileQuery,
} from '#/lib/queries'
import type { NeedsYouItem } from '#/lib/queries'
import { closesShort } from '#/lib/dates'
import { cn } from '#/lib/utils'
import type { ReactNode } from 'react'

export const Route = createFileRoute('/_app/clubs/')({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(myClubsQuery(context.user.id)),
      context.queryClient.ensureQueryData(profileQuery(context.user.id)),
      context.queryClient.fetchQuery(needsYouQuery(context.user.id)),
    ]),
  head: () => ({ meta: [{ title: 'Your clubs' }] }),
  component: ClubsPage,
})

function ClubsPage() {
  const { user } = Route.useRouteContext()
  const { data: clubs } = useSuspenseQuery(myClubsQuery(user.id))
  const { data: profile } = useSuspenseQuery(profileQuery(user.id))
  const { data: todos } = useSuspenseQuery(needsYouQuery(user.id))

  return (
    <Screen>
      <header className="flex min-h-16 items-center gap-1 pt-4 pr-3 pb-1 pl-5">
        <h1 className="font-display flex-1 text-[30px]">Your clubs</h1>
        <Link
          to="/profile"
          aria-label="Profile"
          className="inline-flex size-11 items-center justify-center rounded-lg hover:bg-muted"
        >
          <Avatar
            id={user.id}
            name={profile.display_name}
            src={avatarSrc(profile)}
            size={36}
          />
        </Link>
      </header>
      <ScreenBody className="pt-3">
        {clubs.length === 0 ? (
          <div className="flex flex-col gap-2 py-10 text-center">
            <h2 className="font-display text-xl">No clubs yet</h2>
            <p className="text-muted-foreground">
              Start one for your friends, or open the invite link someone sent
              you.
            </p>
          </div>
        ) : (
          <>
            {todos.length > 0 && (
              <>
                <SectionLabel>Needs you</SectionLabel>
                <ul className="flex flex-col gap-2.5">
                  {todos.map((t) => (
                    <li key={t.kind === 'vote' ? t.roundId : t.clubBookId}>
                      <TodoRow item={t} />
                    </li>
                  ))}
                </ul>
              </>
            )}
            <SectionLabel className={todos.length > 0 ? 'mt-2.5' : ''}>
              Clubs
            </SectionLabel>
            <ul className="flex flex-col gap-3">
              {clubs.map((club) => (
                <li key={club.id}>
                  <Link
                    to="/c/$clubId"
                    params={{ clubId: club.id }}
                    className="bg-card flex items-start gap-3 rounded-[14px] border p-4 text-foreground hover:border-stone-400 hover:text-foreground"
                  >
                    <ClubMark id={club.id} name={club.name} />
                    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <strong className="text-base">{club.name}</strong>
                      <span className="text-muted-foreground text-[13px]">
                        {club.memberCount}{' '}
                        {club.memberCount === 1 ? 'member' : 'members'} ·{' '}
                        {ROLE_LABEL[club.role]}
                      </span>
                      {club.openRound ? (
                        <Chip tone="amber">
                          Voting ·{' '}
                          {closesShort(
                            club.openRound.deadline,
                            club.openRound.timezone,
                          )}
                        </Chip>
                      ) : club.reading ? (
                        <Chip tone="green">Reading {club.reading}</Chip>
                      ) : (
                        <Chip>Between books</Chip>
                      )}
                    </span>
                    <ChevronRight
                      className="mt-3.5 size-5 text-stone-500"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-1 text-center text-[13px]">
              Joining a friend's club? Open the invite link they sent you.
            </p>
          </>
        )}
      </ScreenBody>
      <FooterBar>
        <Button asChild size="lg">
          <Link to="/clubs/new">
            <Plus className="size-5" aria-hidden />
            Create a club
          </Link>
        </Button>
      </FooterBar>
    </Screen>
  )
}

function TodoRow({ item: t }: { item: NeedsYouItem }) {
  const className =
    'bg-card text-foreground hover:text-foreground flex min-h-11 items-center gap-3 rounded-[14px] border px-3.5 py-3 hover:border-stone-400'
  const row = (
    icon: ReactNode,
    iconClass: string,
    title: string,
    meta: string,
  ) => (
    <>
      <span
        aria-hidden
        className={cn(
          'inline-flex size-9 shrink-0 items-center justify-center rounded-[10px]',
          iconClass,
        )}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <strong className="text-sm">{title}</strong>
        <span className="text-muted-foreground truncate text-[13px]">
          {t.clubName} · {meta}
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-stone-500" aria-hidden />
    </>
  )
  return t.kind === 'vote' ? (
    <Link
      to="/c/$clubId/votes/$roundId"
      params={{ clubId: t.clubId, roundId: t.roundId }}
      className={className}
    >
      {row(
        <ListOrdered className="size-5" />,
        'bg-warning-soft text-warning-foreground',
        'Rank your ballot',
        closesShort(t.deadline, t.timezone),
      )}
    </Link>
  ) : (
    <Link
      to="/c/$clubId/books/$bookId/review"
      params={{ clubId: t.clubId, bookId: t.clubBookId }}
      className={className}
    >
      {row(
        <BookCheck className="size-5" />,
        'bg-primary-soft text-primary',
        `Finished ${t.bookTitle}? Post your review`,
        `${t.finishedCount} of ${t.memberCount} finished`,
      )}
    </Link>
  )
}
