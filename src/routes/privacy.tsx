import { createFileRoute } from '@tanstack/react-router'
import { LogoMark } from '#/components/logo'
import { APP_NAME } from '#/lib/config'

export const Route = createFileRoute('/privacy')({
  head: () => ({ meta: [{ title: `Privacy · ${APP_NAME}` }] }),
  component: PrivacyPage,
})

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-xl">{title}</h2>
      {children}
    </section>
  )
}

function PrivacyPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-6 px-6 pt-10 pb-12">
      <LogoMark />
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[28px]">Privacy policy</h1>
        <p className="text-muted-foreground">Last updated October 24, 2026</p>
      </div>

      <p>
        {APP_NAME} is a small app for running a book club: nominate books, vote
        on the next one, and rate and discuss what you read. This page explains
        what it stores and who can see it.
      </p>

      <Section title="What we collect">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Account:</strong> your email address, display name and
            profile photo. If you sign in with Google, we receive your name,
            email and photo from Google. We never see your Google password and
            ask for no other Google data.
          </li>
          <li>
            <strong>Club activity:</strong> the clubs you belong to, books you
            nominate, your ranked votes, ratings, reviews and posts.
          </li>
          <li>
            <strong>Uploads:</strong> a profile photo, if you choose to add one.
          </li>
        </ul>
      </Section>

      <Section title="Who can see it">
        <p>
          Other members of a club you belong to can see your name, photo and
          reviews in that club. Nominations can be anonymous while a vote is
          open, and ballots are not shown to other members. Nobody outside your
          clubs can see your activity. We don&apos;t sell your data, show ads or
          track you across other sites.
        </p>
      </Section>

      <Section title="Services we use">
        <ul className="list-disc space-y-1 pl-5">
          <li>Supabase stores accounts and data and handles sign-in.</li>
          <li>Vercel hosts the website.</li>
          <li>
            Google Books supplies book details. Search terms you type are sent
            to it, without your identity.
          </li>
          <li>Google Sign-In, if you choose it.</li>
        </ul>
      </Section>

      <Section title="Cookies">
        <p>
          We use only the cookies needed to keep you signed in. There are no
          analytics or advertising cookies.
        </p>
      </Section>

      <Section title="Your choices">
        <p>
          You can edit your name and photo on your profile page and leave a club
          at any time. To have your account and its data deleted, ask the person
          who runs this site (see dylansmith.dev) and it will be removed.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If this policy changes, we will update the date at the top of this
          page.
        </p>
      </Section>
    </div>
  )
}
