import { queryOptions } from '@tanstack/react-query'
import { getSupabase } from './supabase'
import type { Database } from './supabase'

export type ClubRole = Database['public']['Enums']['club_role']

export const ROLE_LABEL: Record<ClubRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
}

type Result = { data: unknown; error: unknown }

function unwrap<TResult extends Result>(
  result: TResult,
): NonNullable<TResult['data']> {
  if (result.error) throw result.error
  return result.data as NonNullable<TResult['data']>
}

function unwrapMaybe<TResult extends Result>(result: TResult): TResult['data'] {
  if (result.error) throw result.error
  return result.data
}

export const profileQuery = (userId: string) =>
  queryOptions({
    queryKey: ['profile', userId],
    queryFn: async () =>
      unwrap(
        await getSupabase()
          .from('profiles')
          .select('id, display_name, avatar_url, avatar_path, created_at')
          .eq('id', userId)
          .single(),
      ),
  })

export const myClubsQuery = (userId: string) =>
  queryOptions({
    queryKey: ['clubs', 'mine', userId],
    queryFn: async () => {
      const rows = unwrap(
        await getSupabase()
          .from('club_members')
          .select(
            'role, joined_at, club:clubs!inner(id, name, description, created_at, members:club_members(count))',
          )
          .eq('user_id', userId)
          .order('joined_at', { ascending: false }),
      )
      return rows.map((r) => ({
        role: r.role,
        id: r.club.id,
        name: r.club.name,
        description: r.club.description,
        memberCount: r.club.members[0]?.count ?? 0,
      }))
    },
  })

export const clubQuery = (clubId: string, userId: string) =>
  queryOptions({
    queryKey: ['club', clubId, userId],
    queryFn: async () => {
      const supabase = getSupabase()
      const [club, me] = await Promise.all([
        supabase
          .from('clubs')
          .select('id, name, description, created_at')
          .eq('id', clubId)
          .maybeSingle(),
        supabase
          .from('club_members')
          .select('role')
          .eq('club_id', clubId)
          .eq('user_id', userId)
          .maybeSingle(),
      ])
      const clubRow = unwrapMaybe(club)
      const meRow = unwrapMaybe(me)
      if (!clubRow || !meRow) return null
      return { ...clubRow, role: meRow.role, isAdmin: meRow.role !== 'member' }
    },
  })

export const membersQuery = (clubId: string) =>
  queryOptions({
    queryKey: ['club', clubId, 'members'],
    queryFn: async () => {
      const rows = unwrap(
        await getSupabase()
          .from('club_members')
          .select(
            'user_id, role, joined_at, profile:profiles!inner(display_name, avatar_url, avatar_path)',
          )
          .eq('club_id', clubId)
          .order('joined_at'),
      )
      const rank: Record<ClubRole, number> = { owner: 0, admin: 1, member: 2 }
      return rows
        .map((r) => ({
          userId: r.user_id,
          role: r.role,
          joinedAt: r.joined_at,
          displayName: r.profile.display_name,
          avatarUrl: avatarSrc(r.profile),
        }))
        .sort((a, b) => rank[a.role] - rank[b.role])
    },
  })

export const activeInviteQuery = (clubId: string) =>
  queryOptions({
    queryKey: ['club', clubId, 'invite'],
    queryFn: async () => {
      const rows = unwrap(
        await getSupabase()
          .from('club_invites')
          // status comes from the same invite_status() that accept_invite enforces.
          .select(
            'id, token, expires_at, max_uses, use_count, created_at, status:invite_status',
          )
          .eq('club_id', clubId)
          .is('revoked_at', null)
          .order('created_at', { ascending: false })
          .limit(1),
      )
      const invite = rows.at(0)
      if (!invite) return null
      const status = invite.status as string
      return {
        ...invite,
        usable: status === 'valid',
        expired: status === 'expired',
        maxed: status === 'maxed',
      }
    },
  })

export type InvitePreview = {
  status: 'valid' | 'invalid' | 'revoked' | 'expired' | 'maxed'
  is_member?: boolean
  club?: {
    id: string
    name: string
    description: string | null
    member_count: number
  }
  inviter?: string | null
  members?: {
    id: string
    display_name: string
    avatar_url: string | null
    avatar_path: string | null
  }[]
}

export const invitePreviewQuery = (token: string) =>
  queryOptions({
    queryKey: ['invite-preview', token],
    queryFn: async () =>
      unwrap(
        await getSupabase().rpc('invite_preview', { p_token: token }),
      ) as unknown as InvitePreview,
  })

const STORAGE_PUBLIC = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/avatars/`

/** Uploaded photo first, then the one from Google, else null (initials). */
export function avatarSrc(p: {
  avatar_path: string | null
  avatar_url: string | null
}) {
  if (p.avatar_path) return STORAGE_PUBLIC + p.avatar_path
  return p.avatar_url
}
