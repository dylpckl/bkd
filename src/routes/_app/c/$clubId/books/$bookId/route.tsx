import { Outlet, createFileRoute, notFound } from '@tanstack/react-router'
import { bookSummaryQuery, clubBookQuery } from '#/lib/queries'

export const Route = createFileRoute('/_app/c/$clubId/books/$bookId')({
  loader: async ({ context, params }) => {
    const [book] = await Promise.all([
      context.queryClient.ensureQueryData(clubBookQuery(params.bookId)),
      context.queryClient.ensureQueryData(bookSummaryQuery(params.bookId)),
    ])
    if (!book || book.club_id !== params.clubId) throw notFound()
    return { title: book.book.title }
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: loaderData.title }] : [],
  }),
  component: Outlet,
})
