import { cn } from '#/lib/utils'
import { colorFor, initials } from '#/lib/initials'

type Props = {
  id: string
  name: string
  src?: string | null
  size?: number
  className?: string
  /** Decorative avatars sit next to the person's name, so screen readers skip them. */
  decorative?: boolean
  /** Accessible name when not decorative; defaults to `name`. */
  label?: string
}

export function Avatar({
  id,
  name,
  src,
  size = 32,
  className,
  decorative = true,
  label,
}: Props) {
  const style = {
    width: size,
    height: size,
    fontSize: Math.max(10, Math.round(size * 0.36)),
  }
  const a11y = decorative
    ? { 'aria-hidden': true as const }
    : { role: 'img', 'aria-label': label ?? name }
  if (src) {
    return (
      <img
        src={src}
        alt={decorative ? '' : (label ?? name)}
        style={style}
        className={cn('shrink-0 rounded-full object-cover', className)}
        referrerPolicy="no-referrer"
      />
    )
  }
  return (
    <span
      {...a11y}
      style={{ ...style, background: colorFor(id) }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white',
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}

export function AvatarStack({
  people,
  max = 6,
  size = 32,
}: {
  people: { id: string; name: string; src?: string | null }[]
  max?: number
  size?: number
}) {
  return (
    <div className="flex items-center pl-2">
      {people.slice(0, max).map((p) => (
        <Avatar
          key={p.id}
          id={p.id}
          name={p.name}
          src={p.src}
          size={size}
          className="-ml-2 border-2 border-card"
        />
      ))}
    </div>
  )
}

export function ClubMark({
  id,
  name,
  size = 48,
}: {
  id: string
  name: string
  size?: number
}) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        background: colorFor(id),
        fontSize: Math.round(size / 3),
      }}
      className="font-display inline-flex shrink-0 items-center justify-center rounded-xl text-white"
    >
      {initials(name, { skipArticles: true })}
    </span>
  )
}
