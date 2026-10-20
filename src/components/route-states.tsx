import { useRouter } from '@tanstack/react-router'
import { useQueryErrorResetBoundary } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import { Screen } from '#/components/layout'

/** Shown while a slow route loads: the rough shape of a screen. */
export function RoutePending() {
  return (
    <Screen>
      <div
        role="status"
        aria-label="Loading"
        className="flex flex-col gap-3 px-4 pt-5"
      >
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-36 w-full rounded-[14px]" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-24 w-full rounded-[14px]" />
        <Skeleton className="h-24 w-full rounded-[14px]" />
      </div>
    </Screen>
  )
}

/** A failed load (usually the network): say so and offer a retry. */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  const queryReset = useQueryErrorResetBoundary()
  useEffect(() => queryReset.reset(), [queryReset])
  useEffect(() => console.error(error), [error])

  return (
    <Screen className="items-center justify-center gap-3 px-6 text-center">
      <h1 className="font-display text-2xl">Something went wrong</h1>
      <p className="text-muted-foreground">
        We couldn’t load this page. Check your connection and try again.
      </p>
      <Button
        onClick={() => {
          reset()
          void router.invalidate()
        }}
      >
        Try again
      </Button>
      <a href="/clubs" className="text-[13px] font-semibold">
        Go to your clubs
      </a>
    </Screen>
  )
}
