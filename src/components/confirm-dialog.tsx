import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'
import { Button } from '#/components/ui/button'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  destructive?: boolean
  /** Extra fields (e.g. a typed confirmation). */
  children?: ReactNode
  confirmDisabled?: boolean
  /** Resolves to close the dialog; throws to keep it open. */
  onConfirm: () => Promise<unknown>
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  children,
  confirmDisabled,
  onConfirm,
}: Props) {
  const [busy, setBusy] = useState(false)
  return (
    <AlertDialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={busy || confirmDisabled}
            onClick={async () => {
              setBusy(true)
              try {
                await onConfirm()
                onOpenChange(false)
              } catch {
                // The caller shows the error; keep the dialog open.
              } finally {
                setBusy(false)
              }
            }}
          >
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
