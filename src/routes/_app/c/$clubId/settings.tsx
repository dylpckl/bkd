import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { useState } from 'react'
import { ChevronDown, Crown } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Avatar } from '#/components/avatar'
import { ConfirmDialog } from '#/components/confirm-dialog'
import { LeaveClubButton } from '#/components/leave-club'
import {
  FooterBar,
  Panel,
  Screen,
  ScreenBody,
  ScreenHeader,
  SectionLabel,
} from '#/components/layout'
import { InviteLinkField, useInviteActions } from '#/components/invite-link'
import { activeInviteQuery, clubQuery, membersQuery } from '#/lib/queries'
import type { ClubRole } from '#/lib/queries'
import { getSupabaseBrowserClient } from '#/lib/supabase/browser'
import { errorMessage, must } from '#/lib/errors'
import { inviteStatusLine } from '#/lib/invites'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/_app/c/$clubId/settings')({
  beforeLoad: async ({ context, params }) => {
    const club = await context.queryClient.ensureQueryData(
      clubQuery(params.clubId, context.user.id),
    )
    if (!club?.isAdmin) throw redirect({ to: '/c/$clubId', params })
  },
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(membersQuery(params.clubId)),
      context.queryClient.ensureQueryData(activeInviteQuery(params.clubId)),
    ]),
  head: () => ({ meta: [{ title: 'Club settings' }] }),
  component: SettingsPage,
})

const ROLE_LABEL: Record<ClubRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
}
const joinedFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
})

function SettingsPage() {
  const { clubId } = Route.useParams()
  const { user } = Route.useRouteContext()
  const { data: club } = useSuspenseQuery(clubQuery(clubId, user.id))
  const queryClient = useQueryClient()
  const [name, setName] = useState(club?.name ?? '')
  const [description, setDescription] = useState(club?.description ?? '')

  const save = useMutation({
    mutationFn: () =>
      must(
        getSupabaseBrowserClient()
          .from('clubs')
          .update({
            name: name.trim(),
            description: description.trim() || null,
          })
          .eq('id', clubId),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['club', clubId] })
      await queryClient.invalidateQueries({ queryKey: ['clubs'] })
      toast.success('Saved')
    },
    onError: (e) => toast.error(errorMessage(e, "Couldn't save. Try again.")),
  })

  if (!club) return null
  const dirty =
    name.trim() !== club.name ||
    (description.trim() || null) !== (club.description ?? null)

  return (
    <Screen>
      <ScreenHeader
        title="Club settings"
        back={{ to: '/c/$clubId', params: { clubId } }}
        backLabel="Back to club"
      />
      <ScreenBody className="gap-3">
        <form
          id="club-details"
          onSubmit={(e) => {
            e.preventDefault()
            if (dirty && name.trim()) save.mutate()
          }}
        >
          <Panel>
            <div>
              <Label htmlFor="cn" className="mb-1.5">
                Club name
              </Label>
              <Input
                id="cn"
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="cd" className="mb-1.5">
                Description{' '}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                id="cd"
                maxLength={500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </Panel>
        </form>

        <SectionLabel className="mt-2">Invite link</SectionLabel>
        <InviteSection clubId={clubId} clubName={club.name} />

        <MembersSection clubId={clubId} myId={user.id} myRole={club.role} />

        {club.role === 'owner' && (
          <OwnerSection clubId={clubId} clubName={club.name} myId={user.id} />
        )}
      </ScreenBody>
      <FooterBar>
        <Button
          type="submit"
          form="club-details"
          size="lg"
          disabled={!dirty || !name.trim() || save.isPending}
        >
          Save changes
        </Button>
      </FooterBar>
    </Screen>
  )
}

function InviteSection({
  clubId,
  clubName,
}: {
  clubId: string
  clubName: string
}) {
  const { data: invite } = useSuspenseQuery(activeInviteQuery(clubId))
  const queryClient = useQueryClient()
  const [newOpen, setNewOpen] = useState(false)
  const [revokeOpen, setRevokeOpen] = useState(false)
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['club', clubId, 'invite'] })

  return (
    <Panel>
      <span className="text-muted-foreground text-[13px]">
        Anyone with this link can join as a member.
      </span>
      {invite ? (
        <>
          <ActiveInvite token={invite.token} clubName={clubName} />
          <span
            className={cn(
              'text-[13px]',
              invite.usable
                ? 'text-muted-foreground'
                : 'text-destructive font-medium',
            )}
          >
            {inviteStatusLine(invite)}
            {!invite.usable && ' · make a new link'}
          </span>
        </>
      ) : (
        <span className="text-muted-foreground text-[13px]">
          No active link. Make one to invite people.
        </span>
      )}
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => setNewOpen(true)}
        >
          New link
        </Button>
        {invite && (
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive flex-1"
            onClick={() => setRevokeOpen(true)}
          >
            Revoke
          </Button>
        )}
      </div>
      <NewInviteDialog
        clubId={clubId}
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={refresh}
      />
      {invite && (
        <ConfirmDialog
          open={revokeOpen}
          onOpenChange={setRevokeOpen}
          title="Revoke this link?"
          description="People who already joined stay in the club. Nobody new can join with this link."
          confirmLabel="Revoke link"
          destructive
          onConfirm={async () => {
            try {
              await must(
                getSupabaseBrowserClient().rpc('revoke_invite', {
                  p_invite_id: invite.id,
                }),
              )
              await refresh()
            } catch (e) {
              toast.error(errorMessage(e))
              throw e
            }
          }}
        />
      )}
    </Panel>
  )
}

function ActiveInvite({
  token,
  clubName,
}: {
  token: string
  clubName: string
}) {
  const { url, copied, copy } = useInviteActions(token, clubName)
  return <InviteLinkField url={url} copied={copied} onCopy={copy} compact />
}

const EXPIRY_OPTIONS = [
  { value: '1', label: '1 day' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: 'never', label: 'Never' },
]

function NewInviteDialog({
  clubId,
  open,
  onOpenChange,
  onCreated,
}: {
  clubId: string
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreated: () => void
}) {
  const [expiry, setExpiry] = useState('7')
  const [maxUses, setMaxUses] = useState('20')

  const create = useMutation({
    mutationFn: () => {
      const uses = parseInt(maxUses, 10)
      return must(
        getSupabaseBrowserClient().rpc('create_invite', {
          p_club_id: clubId,
          p_expires_at:
            expiry === 'never'
              ? undefined
              : new Date(
                  Date.now() + Number(expiry) * 86_400_000,
                ).toISOString(),
          p_max_uses: Number.isFinite(uses) && uses > 0 ? uses : undefined,
        }),
      )
    },
    onSuccess: () => {
      onCreated()
      onOpenChange(false)
      toast.success('New link ready. The old one no longer works.')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            create.mutate()
          }}
        >
          <DialogHeader>
            <DialogTitle>New invite link</DialogTitle>
            <DialogDescription>
              The current link stops working when you make a new one.
            </DialogDescription>
          </DialogHeader>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-semibold">
              Expires after
            </legend>
            <div className="grid grid-cols-4 gap-2">
              {EXPIRY_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center justify-center rounded-lg border text-sm font-semibold has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50',
                    expiry === o.value
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-input bg-card',
                  )}
                >
                  <input
                    type="radio"
                    name="expiry"
                    value={o.value}
                    checked={expiry === o.value}
                    onChange={() => setExpiry(o.value)}
                    className="sr-only"
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <Label htmlFor="max-uses" className="mb-1.5">
              Max people{' '}
              <span className="text-muted-foreground font-normal">
                (leave empty for no limit)
              </span>
            </Label>
            <Input
              id="max-uses"
              type="number"
              inputMode="numeric"
              min={1}
              max={500}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              Make link
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type Member = {
  userId: string
  role: ClubRole
  joinedAt: string
  displayName: string
  avatarUrl: string | null
}

function MembersSection({
  clubId,
  myId,
  myRole,
}: {
  clubId: string
  myId: string
  myRole: ClubRole
}) {
  const { data: members } = useSuspenseQuery(membersQuery(clubId))
  const queryClient = useQueryClient()
  const [removing, setRemoving] = useState<Member | null>(null)
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['club', clubId] })

  const setRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: ClubRole }) =>
      must(
        getSupabaseBrowserClient().rpc('set_member_role', {
          p_club_id: clubId,
          p_user_id: userId,
          p_role: role,
        }),
      ),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  })

  // Mirrors the checks in set_member_role / remove_member.
  const canManage = (m: Member) =>
    m.userId !== myId &&
    m.role !== 'owner' &&
    (myRole === 'owner' || (myRole === 'admin' && m.role === 'member'))

  return (
    <>
      <SectionLabel className="mt-2">Members ({members.length})</SectionLabel>
      <Panel className="gap-0 px-3.5 py-1">
        <ul>
          {members.map((m) => (
            <li
              key={m.userId}
              className="flex min-h-14 items-center gap-3 border-b border-muted py-2 last:border-b-0"
            >
              <Avatar id={m.userId} name={m.displayName} src={m.avatarUrl} />
              <span className="flex min-w-0 flex-1 flex-col">
                <strong className="truncate text-sm">
                  {m.displayName}
                  {m.userId === myId && ' (you)'}
                </strong>
                <span className="text-muted-foreground text-[13px]">
                  {m.role === 'owner' ? 'Created' : 'Joined'}{' '}
                  {joinedFmt.format(new Date(m.joinedAt))}
                </span>
              </span>
              {canManage(m) ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-9 text-[13px]"
                      aria-label={`Change role for ${m.displayName}, currently ${ROLE_LABEL[m.role]}`}
                    >
                      {ROLE_LABEL[m.role]}
                      <ChevronDown aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {m.role === 'member' ? (
                      <DropdownMenuItem
                        onSelect={() =>
                          setRole.mutate({ userId: m.userId, role: 'admin' })
                        }
                      >
                        Make admin
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onSelect={() =>
                          setRole.mutate({ userId: m.userId, role: 'member' })
                        }
                      >
                        Make member
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setRemoving(m)}
                    >
                      Remove from club
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <span className="text-muted-foreground pr-2.5 text-[13px] font-semibold">
                  {ROLE_LABEL[m.role]}
                </span>
              )}
            </li>
          ))}
        </ul>
      </Panel>
      {myRole !== 'owner' && <LeaveClubButton clubId={clubId} />}

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove ${removing?.displayName ?? ''}?`}
        description="They lose access to the club. Their posts and reviews stay. You can invite them again later."
        confirmLabel="Remove"
        destructive
        onConfirm={async () => {
          if (!removing) return
          try {
            await must(
              getSupabaseBrowserClient().rpc('remove_member', {
                p_club_id: clubId,
                p_user_id: removing.userId,
              }),
            )
            await refresh()
          } catch (e) {
            toast.error(errorMessage(e))
            throw e
          }
        }}
      />
    </>
  )
}

function OwnerSection({
  clubId,
  clubName,
  myId,
}: {
  clubId: string
  clubName: string
  myId: string
}) {
  const { data: members } = useSuspenseQuery(membersQuery(clubId))
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [transferOpen, setTransferOpen] = useState(false)
  const [newOwner, setNewOwner] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const others = members.filter((m) => m.userId !== myId)

  return (
    <>
      <SectionLabel className="mt-2">Owner only</SectionLabel>
      <Panel>
        <Button
          variant="outline"
          onClick={() => setTransferOpen(true)}
          disabled={others.length === 0}
        >
          <Crown aria-hidden />
          Transfer ownership
        </Button>
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          Delete club
        </Button>
        {others.length === 0 && (
          <span className="text-muted-foreground text-[13px]">
            Invite someone before you can hand the club over.
          </span>
        )}
      </Panel>

      <ConfirmDialog
        open={transferOpen}
        onOpenChange={(o) => {
          setTransferOpen(o)
          if (!o) setNewOwner(null)
        }}
        title="Transfer ownership"
        description="The new owner can delete the club. You'll stay on as an admin."
        confirmLabel="Make owner"
        confirmDisabled={!newOwner}
        onConfirm={async () => {
          if (!newOwner) return
          try {
            await must(
              getSupabaseBrowserClient().rpc('transfer_ownership', {
                p_club_id: clubId,
                p_new_owner: newOwner,
              }),
            )
            await queryClient.invalidateQueries({ queryKey: ['club', clubId] })
            await queryClient.invalidateQueries({ queryKey: ['clubs'] })
          } catch (e) {
            toast.error(errorMessage(e))
            throw e
          }
        }}
      >
        <fieldset className="flex max-h-64 flex-col gap-1 overflow-auto">
          <legend className="sr-only">New owner</legend>
          {others.map((m) => (
            <label
              key={m.userId}
              className="hover:bg-muted flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2"
            >
              <input
                type="radio"
                name="owner"
                value={m.userId}
                checked={newOwner === m.userId}
                onChange={() => setNewOwner(m.userId)}
                className="accent-primary size-4"
              />
              <Avatar id={m.userId} name={m.displayName} src={m.avatarUrl} />
              <span className="text-sm font-semibold">{m.displayName}</span>
            </label>
          ))}
        </fieldset>
      </ConfirmDialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(o) => {
          setDeleteOpen(o)
          if (!o) setTyped('')
        }}
        title={`Delete ${clubName}?`}
        description="This deletes the club for everyone, with all its books, votes, posts and reviews. It can't be undone."
        confirmLabel="Delete club"
        destructive
        confirmDisabled={typed.trim() !== clubName.trim()}
        onConfirm={async () => {
          try {
            await must(
              getSupabaseBrowserClient().rpc('delete_club', {
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
      >
        <div>
          <Label htmlFor="confirm-name" className="mb-1.5">
            Type <strong>{clubName}</strong> to confirm
          </Label>
          <Input
            id="confirm-name"
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
        </div>
      </ConfirmDialog>
    </>
  )
}
