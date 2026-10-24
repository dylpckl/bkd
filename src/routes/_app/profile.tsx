import { createFileRoute } from '@tanstack/react-router'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Avatar } from '#/components/avatar'
import {
  Panel,
  Screen,
  ScreenBody,
  ScreenHeader,
  SectionLabel,
} from '#/components/layout'
import { avatarSrc, myClubsQuery, profileQuery } from '#/lib/queries'
import { getSupabaseBrowserClient } from '#/lib/supabase/browser'
import { errorMessage, must } from '#/lib/errors'
import { DISPLAY_NAME_MAX } from '#/lib/limits'

export const Route = createFileRoute('/_app/profile')({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(profileQuery(context.user.id)),
      context.queryClient.ensureQueryData(myClubsQuery(context.user.id)),
    ]),
  head: () => ({ meta: [{ title: 'Profile' }] }),
  component: ProfilePage,
})

const sinceFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
})

function ProfilePage() {
  const { user } = Route.useRouteContext()
  const { data: profile } = useSuspenseQuery(profileQuery(user.id))
  const { data: clubs } = useSuspenseQuery(myClubsQuery(user.id))
  const queryClient = useQueryClient()
  const [name, setName] = useState(profile.display_name)
  const [pwOpen, setPwOpen] = useState(false)

  const hasPassword = user.providers.includes('email')
  const method =
    hasPassword && user.providers.includes('google')
      ? 'Google or password'
      : user.providers.includes('google')
        ? 'Google'
        : 'Email'

  const saveName = useMutation({
    mutationFn: () =>
      must(
        getSupabaseBrowserClient()
          .from('profiles')
          .update({ display_name: name.trim() })
          .eq('id', user.id),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['profile', user.id] })
      await queryClient.invalidateQueries({ queryKey: ['club'] })
      toast.success('Name saved')
    },
    onError: (e) => toast.error(errorMessage(e, "Couldn't save your name.")),
  })

  const signOut = async () => {
    await getSupabaseBrowserClient().auth.signOut()
    window.location.assign('/login')
  }

  return (
    <Screen>
      <ScreenHeader
        title="Profile"
        back={{ to: '/clubs' }}
        backLabel="Back to your clubs"
      />
      <ScreenBody className="gap-3">
        <div className="flex flex-col items-center gap-2 py-3 text-center">
          <Avatar
            id={user.id}
            name={profile.display_name}
            src={avatarSrc(profile)}
            size={80}
          />
          <h2 className="font-display text-2xl">{profile.display_name}</h2>
          <p className="text-muted-foreground text-[13px]">
            {clubs.length} {clubs.length === 1 ? 'club' : 'clubs'} · member
            since {sinceFmt.format(new Date(profile.created_at))}
          </p>
        </div>

        <SectionLabel className="mt-2">Account</SectionLabel>
        <Panel>
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim() && name.trim() !== profile.display_name)
                saveName.mutate()
            }}
          >
            <Label htmlFor="display-name">Display name</Label>
            <div className="flex gap-2">
              <Input
                id="display-name"
                required
                maxLength={DISPLAY_NAME_MAX}
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-describedby="name-hint"
              />
              {name.trim() !== profile.display_name && (
                <Button
                  type="submit"
                  variant="outline"
                  size="lg"
                  disabled={!name.trim() || saveName.isPending}
                >
                  Save
                </Button>
              )}
            </div>
            <p id="name-hint" className="text-muted-foreground text-[13px]">
              What your clubs see on posts, reviews and nominations.
            </p>
          </form>
          <div className="flex flex-col gap-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              readOnly
              value={user.email ?? ''}
              className="bg-muted"
            />
            <p className="text-muted-foreground text-[13px]">
              Signed in with {method}
            </p>
          </div>
          {hasPassword && (
            <Button variant="outline" onClick={() => setPwOpen(true)}>
              Change password
            </Button>
          )}
          <Button variant="outline" onClick={signOut}>
            Sign out
          </Button>
        </Panel>
      </ScreenBody>
      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
    </Screen>
  )
}

function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const change = useMutation({
    mutationFn: async () => {
      const { error } = await getSupabaseBrowserClient().auth.updateUser({
        password,
      })
      if (error) throw error
    },
    onSuccess: () => {
      onOpenChange(false)
      setPassword('')
      toast.success('Password changed')
    },
    onError: (e: { code?: string }) =>
      setFormError(
        e.code === 'weak_password'
          ? 'That password is too easy to guess. Try a longer one.'
          : e.code === 'same_password'
            ? 'That’s your current password. Pick a new one.'
            : "Couldn't change your password. Try again.",
      ),
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            setFormError(null)
            if (password.length < 8)
              return setFormError('Use at least 8 characters.')
            change.mutate()
          }}
        >
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>At least 8 characters.</DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="new-pw" className="mb-1.5">
              New password
            </Label>
            <Input
              id="new-pw"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {formError && (
            <p role="alert" className="text-destructive text-sm font-medium">
              {formError}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={change.isPending}>
              Save password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
