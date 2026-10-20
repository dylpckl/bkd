import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { ConfirmDialog } from '#/components/confirm-dialog'
import { getSupabaseBrowserClient } from '#/lib/supabase/browser'
import { errorMessage, must } from '#/lib/errors'

export function LeaveClubButton({ clubId }: { clubId: string }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return (
    <>
      <Button
        variant="outline"
        className="text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        Leave club
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Leave this club?"
        description="You'll need a new invite link to rejoin. Your posts and reviews stay."
        confirmLabel="Leave club"
        destructive
        onConfirm={async () => {
          try {
            await must(
              getSupabaseBrowserClient().rpc('leave_club', {
                p_club_id: clubId,
              }),
            )
            await queryClient.invalidateQueries({ queryKey: ['clubs'] })
            navigate({ to: '/clubs' })
          } catch (e) {
            toast.error(errorMessage(e))
            throw e
          }
        }}
      />
    </>
  )
}
