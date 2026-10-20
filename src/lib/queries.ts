import { queryOptions } from '@tanstack/react-query'
import { getSupabase } from './supabase'
import type { Database } from './supabase'

export type ClubRole = Database['public']['Enums']['club_role']

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
            'role, joined_at, club:clubs!inner(id, name, description, created_at, members:club_members(count), rounds(id, number, status, deadline, timezone), club_books(status, book:books(title)))',
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
        openRound:
          r.club.rounds.find(
            (x) => x.status === 'open' || x.status === 'closing',
          ) ?? null,
        reading:
          r.club.club_books.find((b) => b.status === 'reading')?.book.title ??
          null,
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
          .select('id, token, expires_at, max_uses, use_count, created_at')
          .eq('club_id', clubId)
          .is('revoked_at', null)
          .order('created_at', { ascending: false })
          .limit(1),
      )
      const invite = rows.at(0)
      if (!invite) return null
      const expired =
        invite.expires_at !== null && new Date(invite.expires_at) <= new Date()
      const maxed =
        invite.max_uses !== null && invite.use_count >= invite.max_uses
      return { ...invite, usable: !expired && !maxed, expired, maxed }
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

export type Round = Omit<
  Database['public']['Tables']['rounds']['Row'],
  'close_claimed_at'
>

const ROUND_COLUMNS =
  'id, club_id, number, status, deadline, timezone, max_nominations_per_member, anonymous_nominators, note, winner_nomination_id, created_by, created_at, closed_at'

export const openRoundQuery = (clubId: string) =>
  queryOptions({
    queryKey: ['club', clubId, 'open-round'],
    queryFn: async () =>
      unwrapMaybe(
        await getSupabase()
          .from('rounds')
          .select(ROUND_COLUMNS)
          .eq('club_id', clubId)
          .in('status', ['open', 'closing'])
          .maybeSingle(),
      ),
  })

export const roundQuery = (roundId: string) =>
  queryOptions({
    queryKey: ['round', roundId],
    queryFn: async () =>
      unwrapMaybe(
        await getSupabase()
          .from('rounds')
          .select(ROUND_COLUMNS)
          .eq('id', roundId)
          .maybeSingle(),
      ),
  })

const BOOK_COLUMNS =
  'id, google_books_id, title, subtitle, authors, cover_url, isbn13, page_count, published_date, description, publisher, categories'

export const nominationsQuery = (roundId: string) =>
  queryOptions({
    queryKey: ['round', roundId, 'nominations'],
    queryFn: async () => {
      const rows = unwrap(
        await getSupabase()
          .from('nominations_public')
          .select(
            `id, round_id, nominated_by, is_mine, pitch, created_at, book:books!inner(${BOOK_COLUMNS})`,
          )
          .eq('round_id', roundId)
          .order('created_at'),
      )
      return rows.map((r) => ({
        id: r.id as string,
        nominatedBy: r.nominated_by,
        isMine: r.is_mine === true,
        pitch: r.pitch,
        createdAt: r.created_at as string,
        book: r.book,
      }))
    },
  })

export type Nomination = Awaited<
  ReturnType<NonNullable<ReturnType<typeof nominationsQuery>['queryFn']>>
>[number]

export const myBallotQuery = (roundId: string, userId: string) =>
  queryOptions({
    queryKey: ['round', roundId, 'ballot', userId],
    queryFn: async () => {
      const supabase = getSupabase()
      const [header, rankings] = await Promise.all([
        supabase
          .from('ballots')
          .select('first_cast_at')
          .eq('round_id', roundId)
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('ballot_rankings')
          .select('nomination_id, rank')
          .eq('round_id', roundId)
          .eq('user_id', userId)
          .order('rank'),
      ])
      const head = unwrapMaybe(header)
      const ranked = unwrap(rankings).map((r) => r.nomination_id)
      return head ? { firstCastAt: head.first_cast_at, ranking: ranked } : null
    },
  })

export const voteStatusQuery = (roundId: string) =>
  queryOptions({
    queryKey: ['round', roundId, 'vote-status'],
    queryFn: async () =>
      unwrap(
        await getSupabase().rpc('round_vote_status', { p_round_id: roundId }),
      ),
  })

export type IrvTallies = {
  method: 'single' | 'random' | 'irv'
  winner: string
  ballots: number
  counts: {
    votes: Record<string, number>
    exhausted: number
    eliminated?: string
    tiebreak?: string
  }[]
  finishingOrder: {
    id: string
    place: number
    finalVotes: number
    outcome: 'winner' | 'runner-up' | 'still-in' | 'knocked-out' | 'not-picked'
    knockedOutOrder?: number
    tiebreak?: 'previous' | 'appearances' | 'random'
  }[]
  seed: string
}

export const resultsQuery = (roundId: string) =>
  queryOptions({
    queryKey: ['round', roundId, 'results'],
    queryFn: async () => {
      const row = unwrapMaybe(
        await getSupabase()
          .from('round_results')
          .select('tallies, computed_at')
          .eq('round_id', roundId)
          .maybeSingle(),
      )
      return row
        ? {
            tallies: row.tallies as unknown as IrvTallies,
            computedAt: row.computed_at,
          }
        : null
    },
  })

export const currentBookQuery = (clubId: string) =>
  queryOptions({
    queryKey: ['club', clubId, 'current-book'],
    queryFn: async () =>
      unwrapMaybe(
        await getSupabase()
          .from('club_books')
          .select(
            `id, number, status, started_at, round_id, book:books!inner(${BOOK_COLUMNS})`,
          )
          .eq('club_id', clubId)
          .eq('status', 'reading')
          .maybeSingle(),
      ),
  })

export const clubBookQuery = (bookId: string) =>
  queryOptions({
    queryKey: ['club-book', bookId],
    queryFn: async () =>
      unwrapMaybe(
        await getSupabase()
          .from('club_books')
          .select(
            `id, club_id, number, status, discussion_mode, started_at, finished_at, round_id, book:books!inner(${BOOK_COLUMNS})`,
          )
          .eq('id', bookId)
          .maybeSingle(),
      ),
  })

export type ClubBook = NonNullable<
  Awaited<ReturnType<NonNullable<ReturnType<typeof clubBookQuery>['queryFn']>>>
>

export type BookSummary = {
  average: number | null
  review_count: number
  member_count: number
  finished_user_ids: string[]
  unlocked: boolean
  distribution: Record<string, number> | null
}

export const bookSummaryQuery = (bookId: string) =>
  queryOptions({
    queryKey: ['club-book', bookId, 'summary'],
    // Changes as other members post and finish. Loaders use fetchQuery, so this
    // means every visit gets fresh data (suspense raises staleTime to 1s otherwise).
    staleTime: 0,
    queryFn: async () =>
      unwrap(
        await getSupabase().rpc('club_book_summary', {
          p_club_book_id: bookId,
        }),
      ) as unknown as BookSummary,
  })

export const postsQuery = (bookId: string) =>
  queryOptions({
    queryKey: ['club-book', bookId, 'posts'],
    // Changes as other members post and finish. Loaders use fetchQuery, so this
    // means every visit gets fresh data (suspense raises staleTime to 1s otherwise).
    staleTime: 0,
    queryFn: async () =>
      unwrap(
        await getSupabase()
          .from('posts')
          .select('id, parent_id, author_id, body, created_at, edited_at')
          .eq('club_book_id', bookId)
          .order('created_at'),
      ),
  })

export type Post = Awaited<
  ReturnType<NonNullable<ReturnType<typeof postsQuery>['queryFn']>>
>[number]

export const reviewsQuery = (bookId: string) =>
  queryOptions({
    queryKey: ['club-book', bookId, 'reviews'],
    // Changes as other members post and finish. Loaders use fetchQuery, so this
    // means every visit gets fresh data (suspense raises staleTime to 1s otherwise).
    staleTime: 0,
    queryFn: async () =>
      unwrap(
        await getSupabase()
          .from('reviews')
          .select(
            'id, user_id, rating, body, goodreads_url, created_at, updated_at',
          )
          .eq('club_book_id', bookId)
          .order('created_at'),
      ),
  })

export type Review = Awaited<
  ReturnType<NonNullable<ReturnType<typeof reviewsQuery>['queryFn']>>
>[number]

/** The club book a closed round produced, for the results page's "Go to" button. */
export const roundClubBookQuery = (roundId: string) =>
  queryOptions({
    queryKey: ['round', roundId, 'club-book'],
    queryFn: async () =>
      unwrapMaybe(
        await getSupabase()
          .from('club_books')
          .select('id, book:books!inner(title)')
          .eq('round_id', roundId)
          .maybeSingle(),
      ),
  })
