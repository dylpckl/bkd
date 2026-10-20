import { useState } from 'react'
import { cn } from '#/lib/utils'
import { coverColor } from '#/lib/books'

/** The book's cover, or a colored stand-in with the title when there's no image. */
export function BookCover({
  title,
  coverUrl,
  idKey,
  width,
  className,
}: {
  title: string
  coverUrl: string | null
  idKey: string
  width: number
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const height = Math.round(width * 1.5)
  const shape =
    'shrink-0 rounded-[3px_6px_6px_3px] shadow-[inset_3px_0_0_rgba(0,0,0,.2)]'
  if (coverUrl && !failed) {
    return (
      <img
        src={coverUrl}
        alt=""
        width={width}
        height={height}
        loading="lazy"
        onError={() => setFailed(true)}
        style={{ width, height }}
        className={cn(shape, 'bg-muted object-cover', className)}
      />
    )
  }
  return (
    <div
      aria-hidden
      style={{
        width,
        height,
        background: coverColor(idKey),
        fontSize: Math.max(7, Math.round(width / 9)),
        padding: Math.max(4, width / 12),
      }}
      className={cn(
        shape,
        'flex items-end overflow-hidden leading-tight font-bold text-white',
        className,
      )}
    >
      <span className="line-clamp-4">{title}</span>
    </div>
  )
}
