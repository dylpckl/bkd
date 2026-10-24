import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { Toaster } from '#/components/ui/sonner'
import { APP_NAME } from '#/lib/config'
import { getAuthUser } from '#/lib/auth'
import appCss from '../styles.css?url'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  beforeLoad: async () => ({ user: await getAuthUser() }),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      { name: 'theme-color', content: '#FAFAF9' },
      { title: APP_NAME },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: () => (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="font-display text-2xl">Page not found</h1>
      <p className="text-muted-foreground">
        That link doesn't go anywhere, or you're not in that club.
      </p>
      <a href="/clubs" className="font-semibold">
        Go to your clubs
      </a>
    </div>
  ),
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster position="top-center" />
        <Scripts />
      </body>
    </html>
  )
}
