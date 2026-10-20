import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

// Signed-in area. Everything under it can rely on context.user.
export const Route = createFileRoute('/_app')({
  beforeLoad: ({ context, location }) => {
    if (!context.user)
      throw redirect({ to: '/login', search: { next: location.href } })
    return { user: context.user }
  },
  component: Outlet,
})
