import { createFileRoute } from '@tanstack/react-router'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Avatar } from '#/components/avatar'
import {
  Panel,
  Screen,
  ScreenBody,
  ScreenHeader,
  SectionLabel,
} from '#/components/layout'
import {
  avatarSrc,
  myClubsQuery,
  profileQuery,
  profileStatsQuery,
} from '#/lib/queries'
import { resizeAvatar } from '#/lib/avatar'
import { formatRating } from '#/lib/history'
import { getSupabaseBrowserClient } from '#/lib/supabase/browser'
import { errorMessage, must } from '#/lib/errors'
import { DISPLAY_NAME_MAX } from '#/lib/limits'

export const Route = createFileRoute('/_app/profile')({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(profileQuery(context.user.id)),
      context.queryClient.ensureQueryData(myClubsQuery(context.user.id)),
      context.queryClient.fetchQuery(profileStatsQuery(context.user.id)),
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
  const { data: stats } = useSuspenseQuery(profileStatsQuery(user.id))
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
        title={<span className="sr-only">Profile</span>}
        back={{ to: '/clubs' }}
        backLabel="Back to your clubs"
      />
      <ScreenBody className="gap-3 pt-1">
        <div className="flex items-center gap-3.5 px-1 pb-2">
          <AvatarPicker
            userId={user.id}
            name={profile.display_name}
            src={avatarSrc(profile)}
            path={profile.avatar_path}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h1 className="font-display truncate text-[26px]">
              {profile.display_name}
            </h1>
            <p className="text-muted-foreground text-[13px]">
              {clubs.length} {clubs.length === 1 ? 'club' : 'clubs'} · member
              since {sinceFmt.format(new Date(profile.created_at))}
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-2">
          <Stat
            value={String(stats.booksRead)}
            label={stats.booksRead === 1 ? 'book read' : 'books read'}
          />
          <Stat
            value={String(stats.reviewCount)}
            label={stats.reviewCount === 1 ? 'review' : 'reviews'}
          />
          <Stat
            value={
              stats.average === null ? '–' : `★ ${formatRating(stats.average)}`
            }
            label="your avg"
          />
        </dl>

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
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={signOut}
          >
            Sign out
          </Button>
        </Panel>
      </ScreenBody>
      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
    </Screen>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div
      data-testid="stat"
      className="bg-card flex flex-col-reverse rounded-xl border px-3 py-2.5"
    >
      <dt className="text-muted-foreground text-[13px]">{label}</dt>
      <dd className="text-[clamp(16px,5.2vw,20px)] font-bold whitespace-nowrap">
        {value}
      </dd>
    </div>
  )
}

/** Tap the photo to upload one; with a photo already set, a menu offers Remove. */
function AvatarPicker({
  userId,
  name,
  src,
  path,
}: {
  userId: string
  name: string
  src: string | null
  path: string | null
}) {
  const queryClient = useQueryClient()
  const input = useRef<HTMLInputElement>(null)

  /** Points the profile at `next` (or nothing), then deletes the file it replaced. */
  const setPath = async (next: string | null) => {
    const supabase = getSupabaseBrowserClient()
    await must(
      supabase.from('profiles').update({ avatar_path: next }).eq('id', userId),
    )
    if (path) {
      // The profile has already moved on, so a failure here only leaves an
      // unreferenced file behind: log it rather than fail the change.
      const { error } = await supabase.storage.from('avatars').remove([path])
      if (error) console.error('Could not delete the old avatar', error)
    }
  }

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const supabase = getSupabaseBrowserClient()
      const blob = await resizeAvatar(file)
      const next = `${userId}/${Date.now()}.jpg`
      const { error } = await supabase.storage
        .from('avatars')
        .upload(next, blob, { contentType: 'image/jpeg' })
      if (error) throw error
      try {
        await setPath(next)
      } catch (e) {
        // The profile still points at the old photo: drop the new, orphaned file.
        const { error: cleanup } = await supabase.storage
          .from('avatars')
          .remove([next])
        if (cleanup) console.error('Could not clean up the new avatar', cleanup)
        throw e
      }
    },
    onSuccess: () => refresh(),
    onError: () => toast.error('Couldn�t use that photo. Try a JPEG or PNG.'),
  })
  const remove = useMutation({
    mutationFn: () => setPath(null),
    onSuccess: () => refresh(),
    onError: (e) => toast.error(errorMessage(e, "Couldn't remove your photo.")),
  })
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['profile', userId] })
    await queryClient.invalidateQueries({ queryKey: ['club'] })
  }
  const busy = upload.isPending || remove.isPending

  const face = (
    <span className="relative inline-flex">
      <Avatar id={userId} name={name} src={src} size={64} />
      <span
        aria-hidden
        className="bg-card text-foreground absolute -right-0.5 -bottom-0.5 inline-flex size-6 items-center justify-center rounded-full border border-input"
      >
        <Camera className="size-3.5" />
      </span>
    </span>
  )
  const trigger = 'shrink-0 rounded-full disabled:opacity-60'

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) upload.mutate(file)
        }}
      />
      {path ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Change profile photo"
              disabled={busy}
              className={trigger}
            >
              {face}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => input.current?.click()}>
              Upload a new photo
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => remove.mutate()}
            >
              Remove photo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <button
          type="button"
          aria-label="Add a profile photo"
          disabled={busy}
          onClick={() => input.current?.click()}
          className={trigger}
        >
          {face}
        </button>
      )}
    </>
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
