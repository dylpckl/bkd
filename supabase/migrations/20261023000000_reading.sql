-- Phase 4: discussion posts, reviews with reveal rules, finishing.

-- ---------------------------------------------------------------------------
-- Posts. One thread per club book for now (sections arrive in phase 6, so
-- section_id stays null). One level of replies.
-- ---------------------------------------------------------------------------

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  club_book_id uuid not null references public.club_books (id) on delete cascade,
  section_id uuid,
  parent_id uuid references public.posts (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index posts_club_book_idx on public.posts (club_book_id, created_at);
create index posts_parent_idx on public.posts (parent_id);

create function public.club_book_club(p_club_book_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select club_id from public.club_books where id = p_club_book_id
$$;

-- Replies must point at a top-level post on the same book.
create function public.check_post()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_parent public.posts;
begin
  if tg_op = 'INSERT' then
    -- Signed-in users always post as themselves (they can't write author_id either);
    -- admin tooling such as the seed may set it.
    if (select auth.uid()) is not null then
      new.author_id := (select auth.uid());
      new.created_at := now();
      new.edited_at := null;
    end if;
    if new.parent_id is not null then
      select * into v_parent from public.posts where id = new.parent_id;
      if v_parent.id is null or v_parent.club_book_id <> new.club_book_id or v_parent.parent_id is not null then
        raise exception 'invalid_reply';
      end if;
    end if;
  else
    if new.body is distinct from old.body then new.edited_at := now(); end if;
  end if;
  new.body := btrim(new.body);
  return new;
end;
$$;

create trigger posts_check
  before insert or update on public.posts
  for each row execute function public.check_post();

alter table public.posts enable row level security;
revoke all on public.posts from anon;
revoke insert, update, delete on public.posts from authenticated;
grant insert (club_book_id, parent_id, body) on public.posts to authenticated;
grant update (body) on public.posts to authenticated;
grant delete on public.posts to authenticated;

create policy "posts: members read" on public.posts
  for select to authenticated
  using (public.is_club_member(public.club_book_club(club_book_id)));

create policy "posts: members write their own" on public.posts
  for insert to authenticated
  with check (public.is_club_member(public.club_book_club(club_book_id)));

create policy "posts: authors edit" on public.posts
  for update to authenticated
  using (author_id = (select auth.uid()) and public.is_club_member(public.club_book_club(club_book_id)))
  with check (author_id = (select auth.uid()) and public.is_club_member(public.club_book_club(club_book_id)));

create policy "posts: authors and admins delete" on public.posts
  for delete to authenticated
  using (
    (author_id = (select auth.uid()) and public.is_club_member(public.club_book_club(club_book_id)))
    or public.is_club_admin(public.club_book_club(club_book_id))
  );

-- ---------------------------------------------------------------------------
-- Reviews. Rating is half-stars, 1–10 (9 = 4.5 stars). Posting one marks you
-- finished, which unlocks everyone else's reviews for you.
-- ---------------------------------------------------------------------------

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  club_book_id uuid not null references public.club_books (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 10),
  body text check (body is null or char_length(body) <= 10000),
  goodreads_url text check (
    goodreads_url is null
    or (char_length(goodreads_url) <= 500 and goodreads_url ~* '^https://(www\.)?goodreads\.com/')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_book_id, user_id)
);

create index reviews_club_book_idx on public.reviews (club_book_id);

alter table public.reviews enable row level security;
revoke all on public.reviews from anon;
revoke insert, update, delete on public.reviews from authenticated;

-- Your own; everyone's once you've posted yours; everyone's once the book is finished.
create function public.can_read_reviews(p_club_book_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_club_member(cb.club_id) and (
    cb.status = 'finished'
    or exists (select 1 from public.reviews r where r.club_book_id = cb.id and r.user_id = (select auth.uid()))
  )
  from public.club_books cb where cb.id = p_club_book_id
$$;

create policy "reviews: own, or unlocked" on public.reviews
  for select to authenticated
  using (user_id = (select auth.uid()) or coalesce(public.can_read_reviews(club_book_id), false));

-- Everyone who's in the club now has reviewed the book being read: it's done.
create function public.finish_if_all_reviewed(p_club_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.club_books cb set status = 'finished', finished_at = now()
  where cb.club_id = p_club_id and cb.status = 'reading'
    and exists (select 1 from public.club_members m where m.club_id = cb.club_id)
    and not exists (
      select 1 from public.club_members m
      where m.club_id = cb.club_id
        and not exists (select 1 from public.reviews r where r.club_book_id = cb.id and r.user_id = m.user_id)
    )
$$;

create function public.post_review(
  p_club_book_id uuid,
  p_rating int,
  p_body text default null,
  p_goodreads_url text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_club uuid := public.club_book_club(p_club_book_id);
  v_id uuid;
begin
  if v_club is null or not public.is_club_member(v_club) then raise exception 'not_allowed'; end if;
  if p_rating is null or p_rating not between 1 and 10 then raise exception 'invalid_rating'; end if;
  if p_goodreads_url is not null and btrim(p_goodreads_url) <> ''
     and btrim(p_goodreads_url) !~* '^https://(www\.)?goodreads\.com/' then
    raise exception 'invalid_goodreads_url';
  end if;
  if char_length(btrim(coalesce(p_goodreads_url, ''))) > 500 then raise exception 'invalid_goodreads_url'; end if;

  insert into public.reviews (club_book_id, user_id, rating, body, goodreads_url)
  values (p_club_book_id, v_uid, p_rating, nullif(btrim(coalesce(p_body, '')), ''), nullif(btrim(coalesce(p_goodreads_url, '')), ''))
  on conflict (club_book_id, user_id) do update set
    rating = excluded.rating,
    body = excluded.body,
    goodreads_url = excluded.goodreads_url,
    updated_at = now()
  returning id into v_id;

  perform public.finish_if_all_reviewed(v_club);
  return v_id;
end;
$$;

-- When the last member still reading leaves, everyone left has finished.
create function public.on_member_left()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.finish_if_all_reviewed(old.club_id);
  return null;
end;
$$;

create trigger club_members_finish_books
  after delete on public.club_members
  for each row execute function public.on_member_left();

-- What every member may see about a book's reviews before unlocking: only who
-- has finished. The average, count and rating breakdown (any of which can give
-- away a lone reviewer's rating) are null until the caller is unlocked.
create function public.club_book_summary(p_club_book_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select case when public.is_club_member(cb.club_id) then jsonb_build_object(
    'average', case when coalesce(public.can_read_reviews(cb.id), false)
      then (select round(avg(r.rating) / 2.0, 1) from public.reviews r where r.club_book_id = cb.id) end,
    'review_count', case when coalesce(public.can_read_reviews(cb.id), false)
      then (select count(*) from public.reviews r where r.club_book_id = cb.id) end,
    'member_count', (select count(*) from public.club_members m where m.club_id = cb.club_id),
    -- Current members only, so "4 of 6 finished" adds up after people leave.
    'finished_user_ids', coalesce((
      select jsonb_agg(r.user_id order by r.created_at)
      from public.reviews r
      join public.club_members m on m.club_id = cb.club_id and m.user_id = r.user_id
      where r.club_book_id = cb.id
    ), '[]'::jsonb),
    'unlocked', coalesce(public.can_read_reviews(cb.id), false),
    'distribution', case when coalesce(public.can_read_reviews(cb.id), false) then coalesce((
      select jsonb_object_agg(rating, n) from (
        select r.rating, count(*) as n from public.reviews r where r.club_book_id = cb.id group by r.rating
      ) d
    ), '{}'::jsonb) end
  ) end
  from public.club_books cb where cb.id = p_club_book_id
$$;

-- Discussion style is per book. Sections arrive in phase 6.
create function public.set_discussion_mode(p_club_book_id uuid, p_mode public.discussion_mode)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_club_admin(public.club_book_club(p_club_book_id)) then raise exception 'not_allowed'; end if;
  update public.club_books set discussion_mode = p_mode where id = p_club_book_id;
end;
$$;

revoke execute on function
  public.club_book_club(uuid),
  public.check_post(),
  public.finish_if_all_reviewed(uuid),
  public.on_member_left(),
  public.can_read_reviews(uuid),
  public.post_review(uuid, int, text, text),
  public.club_book_summary(uuid),
  public.set_discussion_mode(uuid, public.discussion_mode)
from public, anon, authenticated;

-- club_book_club and can_read_reviews stay executable by authenticated: RLS
-- policies on posts and reviews call them as the invoking role.
grant execute on function
  public.club_book_club(uuid),
  public.can_read_reviews(uuid),
  public.post_review(uuid, int, text, text),
  public.club_book_summary(uuid),
  public.set_discussion_mode(uuid, public.discussion_mode)
to authenticated;
