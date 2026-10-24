-- Phase 5: books read, Needs you, profile stats. Read-only RPCs over existing tables.

-- Every book a club has read or is reading, newest first, with what the History
-- list and the club home carousel show: dates, the average rating and how it
-- was picked. The average and review count follow the reviews unlock rule
-- (can_read_reviews): null while the book is being read until the caller has
-- posted their own review.
create function public.club_history(p_club_id uuid)
returns table (
  id uuid,
  number int,
  status public.club_book_status,
  started_at timestamptz,
  finished_at timestamptz,
  round_id uuid,
  google_books_id text,
  title text,
  authors text[],
  cover_url text,
  average numeric,
  review_count int,
  nominee_count int,
  pick_method text,
  count_rounds int
)
language sql stable security definer set search_path = ''
as $$
  select
    cb.id, cb.number, cb.status, cb.started_at, cb.finished_at, cb.round_id,
    b.google_books_id, b.title, b.authors, b.cover_url,
    case when unlocked.ok then
      (select round(avg(r.rating) / 2.0, 1) from public.reviews r where r.club_book_id = cb.id)
    end,
    case when unlocked.ok then
      (select count(*)::int from public.reviews r where r.club_book_id = cb.id)
    end,
    (select count(*)::int from public.nominations n where n.round_id = cb.round_id),
    rr.tallies ->> 'method',
    coalesce(jsonb_array_length(rr.tallies -> 'counts'), 0)
  from public.club_books cb
  join public.books b on b.id = cb.book_id
  left join public.round_results rr on rr.round_id = cb.round_id
  cross join lateral (select coalesce(public.can_read_reviews(cb.id), false) as ok) unlocked
  where cb.club_id = p_club_id and public.is_club_member(p_club_id)
  order by cb.number desc, cb.started_at desc
$$;

-- What's waiting on the caller across all their clubs:
--   'vote'   an open vote with something to rank and no ballot from you yet
--   'review' the book a club is reading, which you haven't reviewed
create function public.needs_you()
returns table (
  kind text,
  club_id uuid,
  club_name text,
  round_id uuid,
  club_book_id uuid,
  book_title text,
  deadline timestamptz,
  timezone text,
  finished_count int,
  member_count int
)
language sql stable security definer set search_path = ''
as $$
  with mine as (
    select m.club_id, c.name from public.club_members m
    join public.clubs c on c.id = m.club_id
    where m.user_id = (select auth.uid())
  )
  select 'vote', mine.club_id, mine.name, r.id, null::uuid, null::text, r.deadline, r.timezone, null::int, null::int
  from mine
  join public.rounds r on r.club_id = mine.club_id and r.status = 'open' and r.deadline > now()
  where exists (
      select 1 from public.nominations n
      where n.round_id = r.id and n.nominated_by <> (select auth.uid())
    )
    and not exists (
      select 1 from public.ballot_rankings br
      where br.round_id = r.id and br.user_id = (select auth.uid())
    )
  union all
  select 'review', mine.club_id, mine.name, null, cb.id, b.title, null, null,
    (select count(*)::int from public.reviews rv
       join public.club_members m on m.club_id = cb.club_id and m.user_id = rv.user_id
       where rv.club_book_id = cb.id),
    (select count(*)::int from public.club_members m where m.club_id = cb.club_id)
  from mine
  join public.club_books cb on cb.club_id = mine.club_id and cb.status = 'reading'
  join public.books b on b.id = cb.book_id
  where not exists (
    select 1 from public.reviews rv where rv.club_book_id = cb.id and rv.user_id = (select auth.uid())
  )
  order by 1 desc, 2
$$;

-- The caller's numbers for Profile. A book counts as read once you've reviewed
-- it: finishing alone doesn't count, since a member who joined mid-book or
-- skipped it hasn't read it.
create function public.profile_stats()
returns table (books_read int, review_count int, average numeric)
language sql stable security definer set search_path = ''
as $$
  select
    (select count(*)::int from public.club_books cb
     where exists (select 1 from public.reviews r where r.club_book_id = cb.id and r.user_id = (select auth.uid()))),
    (select count(*)::int from public.reviews r where r.user_id = (select auth.uid())),
    (select round(avg(r.rating) / 2.0, 1) from public.reviews r where r.user_id = (select auth.uid()))
$$;

revoke execute on function
  public.club_history(uuid),
  public.needs_you(),
  public.profile_stats()
from public, anon;

grant execute on function
  public.club_history(uuid),
  public.needs_you(),
  public.profile_stats()
to authenticated;
