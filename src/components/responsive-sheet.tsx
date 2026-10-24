import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from '#/components/ui/drawer'
import { useMediaQuery } from '#/hooks/use-media-query'

/** A bottom sheet on phones and a dialog on wider screens. */
export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Screen-reader title; the visible heading lives in children. */
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}) {
  const desktop = useMediaQuery('(min-width: 640px)')
  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[85dvh] flex-col gap-0 p-0 sm:max-w-lg">
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            {description ?? title}
          </DialogDescription>
          <div className="flex flex-1 flex-col gap-3.5 overflow-auto px-6 pt-6 pb-3">
            {children}
          </div>
          {footer && (
            <div className="flex flex-col gap-1 border-t px-6 pt-3 pb-5">
              {footer}
            </div>
          )}
        </DialogContent>
      </Dialog>
    )
  }
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88dvh]">
        <DrawerTitle className="sr-only">{title}</DrawerTitle>
        <DrawerDescription className="sr-only">
          {description ?? title}
        </DrawerDescription>
        <div className="flex flex-1 flex-col gap-3.5 overflow-auto px-5 pt-2 pb-3">
          {children}
        </div>
        {footer && (
          <div className="pb-safe flex flex-col gap-1 border-t px-5 pt-2.5">
            {footer}
          </div>
        )}
      </DrawerContent>
    </Drawer>
  )
}
