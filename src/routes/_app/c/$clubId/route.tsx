import { Outlet, createFileRoute, notFound } from '@tanstack/react-router'
import { clubQuery } from '#/lib/queries'

// Every club page needs the club and the viewer's role. Non-members get a 404,
// since RLS hides the club from them anyway.
export const Route = createFileRoute('/_app/c/$clubId')({
  loader: async ({ context, params }) => {
    const club = await context.queryClient.ensureQueryData(
      clubQuery(params.clubId, context.user.id),
    )
    if (!club) throw notFound()
    return { clubName: club.name }
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: loaderData.clubName }] : [],
  }),
  component: Outlet,
})
