import { Link, createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ChevronRight, Plus } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Avatar, ClubMark } from '#/components/avatar'
import {
  Chip,
  FooterBar,
  Screen,
  ScreenBody,
  SectionLabel,
} from '#/components/layout'
import { avatarSrc, myClubsQuery, profileQuery } from '#/lib/queries'
import { closesShort } from '#/lib/dates'

const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', member: 'Member' } as const

export const Route = createFileRoute('/_app/clubs/')({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(myClubsQuery(context.user.id)),
      context.queryClient.ensureQueryData(profileQuery(context.user.id)),
    ]),
  head: () => ({ meta: [{ title: 'Your clubs' }] }),
  component: ClubsPage,
})

function ClubsPage() {
  const { user } = Route.useRouteContext()
  const { data: clubs } = useSuspenseQuery(myClubsQuery(user.id))
  const { data: profile } = useSuspenseQuery(profileQuery(user.id))

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
            <SectionLabel>Clubs</SectionLabel>
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
