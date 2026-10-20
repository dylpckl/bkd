import { Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import type { LinkProps } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

/** Full-height mobile column; widens a little on desktop. */
export function Screen({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'mx-auto flex min-h-dvh w-full max-w-lg flex-col',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function ScreenHeader({
  title,
  back,
  backLabel = 'Back',
  actions,
}: {
  title: ReactNode
  back?: LinkProps
  backLabel?: string
  actions?: ReactNode
}) {
  return (
    <header className="flex min-h-15 items-center gap-1 px-2 pt-3 pb-1">
      {back ? (
        <Link
          {...back}
          aria-label={backLabel}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="size-6" aria-hidden />
        </Link>
      ) : (
        <span className="w-3" />
      )}
      <div className="min-w-0 flex-1">
        {typeof title === 'string' ? (
          <h1 className="font-display truncate text-[22px]">{title}</h1>
        ) : (
          title
        )}
      </div>
      {actions}
    </header>
  )
}

export function ScreenBody({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <main
      className={cn('flex flex-1 flex-col gap-3 px-4 pt-2 pb-6', className)}
    >
      {children}
    </main>
  )
}

/** The screen's main action, pinned to the bottom of the viewport above the safe area. */
export function FooterBar({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <>
      <div className="h-28 shrink-0" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card">
        <div
          className={cn(
            'pb-safe mx-auto flex w-full max-w-lg flex-col gap-1.5 px-5 pt-3',
            className,
          )}
        >
          {children}
        </div>
      </div>
    </>
  )
}

export function SectionLabel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <h2
      className={cn(
        'text-muted-foreground text-xs font-bold tracking-[0.06em] uppercase',
        className,
      )}
    >
      {children}
    </h2>
  )
}

export function Panel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'bg-card flex flex-col gap-3 rounded-[14px] border p-4',
        className,
      )}
    >
      {children}
    </div>
  )
}

const CHIP = {
  amber: 'bg-warning-soft text-warning-foreground',
  green: 'bg-primary-soft text-primary',
  gray: 'bg-muted text-muted-foreground',
}

export function Chip({
  tone = 'gray',
  children,
}: {
  tone?: keyof typeof CHIP
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        CHIP[tone],
      )}
    >
      {children}
    </span>
  )
}
