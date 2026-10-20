import { useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { cn } from '#/lib/utils'
import { starsLabel } from '#/lib/goodreads'

const PATH =
  'M12 2.6l2.85 5.95 6.55.8-4.8 4.5 1.25 6.5L12 17.2l-5.85 3.15 1.25-6.5-4.8-4.5 6.55-.8z'

/** One star, filled from the left by `fill` (0–1). */
function Star({ size, fill }: { size: number; fill: number }) {
  return (
    <span
      className="relative inline-block shrink-0"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className="absolute inset-0"
      >
        <path d={PATH} fill="#E7E5E4" stroke="#D6D3D1" strokeWidth="1" />
      </svg>
      <span
        className="absolute inset-y-0 left-0 overflow-hidden"
        style={{ width: `${Math.round(fill * 100)}%` }}
      >
        <svg viewBox="0 0 24 24" width={size} height={size}>
          <path d={PATH} fill="#D97706" stroke="#B45309" strokeWidth="1" />
        </svg>
      </span>
    </span>
  )
}

/** Read-only stars for a 0–5 value (fractions allowed, e.g. an average of 4.1). */
export function StarDisplay({
  value,
  size = 16,
  className,
}: {
  value: number
  size?: number
  className?: string
}) {
  return (
    <span
      role="img"
      aria-label={`${value} out of 5 stars`}
      className={cn('inline-flex gap-px', className)}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} size={size} fill={Math.max(0, Math.min(1, value - i))} />
      ))}
    </span>
  )
}

/**
 * Five stars, each split into a left half (x.5) and a right half (whole star).
 * Every half is a real button; arrow keys step by half a star.
 */
export function StarInput({
  value,
  onChange,
  size = 52,
}: {
  value: number
  onChange: (halfStars: number) => void
  size?: number
}) {
  const group = useRef<HTMLDivElement>(null)
  const focus = (half: number) =>
    group.current
      ?.querySelector<HTMLButtonElement>(`[data-half="${half}"]`)
      ?.focus()
  const set = (half: number) => {
    const next = Math.max(1, Math.min(10, half))
    onChange(next)
    focus(next)
  }
  const onKeyDown = (e: KeyboardEvent) => {
    const current = value || 0
    const moves: Record<string, number> = {
      ArrowRight: current + 1,
      ArrowUp: current + 1,
      ArrowLeft: current - 1,
      ArrowDown: current - 1,
      Home: 1,
      End: 10,
    }
    if (e.key in moves) {
      e.preventDefault()
      set(moves[e.key])
    }
  }

  return (
    <div
      ref={group}
      role="radiogroup"
      aria-label="Rating"
      className="-ml-1 flex gap-1"
      onKeyDown={onKeyDown}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const low = star * 2 - 1
        const high = star * 2
        const fill = value >= high ? 1 : value === low ? 0.5 : 0
        return (
          <span
            key={star}
            className="relative inline-block"
            style={{ width: size, height: size }}
          >
            <Star size={size} fill={fill} />
            {[low, high].map((half) => (
              <button
                key={half}
                type="button"
                role="radio"
                data-half={half}
                aria-checked={value === half}
                aria-label={starsLabel(half)}
                // Roving focus: only the selected half (or the first, before rating) is in the tab order.
                tabIndex={value === half || (!value && half === 1) ? 0 : -1}
                onClick={() => set(half)}
                className={cn(
                  'focus-visible:outline-primary absolute top-0 h-full w-1/2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-1',
                  half === low ? 'left-0' : 'right-0',
                )}
              />
            ))}
          </span>
        )
      })}
    </div>
  )
}
