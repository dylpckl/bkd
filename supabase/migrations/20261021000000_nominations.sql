-- Phase 2: books cache, rounds ("Book N" votes), nominations.

-- ---------------------------------------------------------------------------
-- Books: a cache of Google Books volumes. Written only by edge functions
-- (service role); readable by any signed-in user.
-- ---------------------------------------------------------------------------

create table public.books (
  id uuid primary key default gen_random_uuid(),
  google_books_id text not null unique,
  title text not null,
  subtitle text,
  authors text[] not null default '{}',
  cover_url text,
  isbn13 text,
  page_count int,
  published_date text,
  description text,
  publisher text,
  categories text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.books enable row level security;
revoke all on public.books from anon, authenticated;
grant select on public.books to authenticated;

create policy "books: signed-in users read" on public.books
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Rounds. The UI calls a round "Book N"; `number` is that N.
-- One deadline closes nominations and voting.
-- ---------------------------------------------------------------------------

create type public.round_status as enum ('open', 'closing', 'closed', 'cancelled');

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  number int not null check (number > 0),
  status public.round_status not null default 'open',
  deadline timestamptz not null,
  timezone text not null,
  max_nominations_per_member int not null default 1 check (max_nominations_per_member between 1 and 5),
  anonymous_nominators boolean not null default false,
  note text check (note is null or char_length(note) <= 500),
  winner_nomination_id uuid,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create unique index rounds_one_open_per_club_idx on public.rounds (club_id) where status in ('open', 'closing');
create unique index rounds_number_idx on public.rounds (club_id, number) where status <> 'cancelled';
create index rounds_club_status_idx on public.rounds (club_id, status);
create index rounds_open_deadline_idx on public.rounds (deadline) where status = 'open';

create table public.nominations (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  book_id uuid not null references public.books (id),
  nominated_by uuid not null references public.profiles (id) on delete cascade,
  pitch text check (pitch is null or char_length(pitch) <= 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round_id, book_id)
);

create index nominations_round_idx on public.nominations (round_id);
create index nominations_nominated_by_idx on public.nominations (nominated_by);

alter table public.rounds
  add constraint rounds_winner_fk foreign key (winner_nomination_id) references public.nominations (id) on delete set null;

-- ---------------------------------------------------------------------------
-- RLS. Rounds: members read, writes through RPCs. Nominations: no direct
-- access at all; reads go through nominations_public so anonymity is enforced
-- in the data layer.
-- ---------------------------------------------------------------------------

alter table public.rounds enable row level security;
alter table public.nominations enable row level security;
revoke all on public.rounds, public.nominations from anon, authenticated;
grant select on public.rounds to authenticated;

create policy "rounds: members read" on public.rounds
  for select to authenticated using (public.is_club_member(club_id));

-- Owned by postgres, so it reads nominations past RLS; membership is checked here.
-- On an anonymous round, nominated_by is null except on your own rows until the
-- round is closed (open, closing and cancelled rounds all stay hidden).
create view public.nominations_public
with (security_invoker = false, security_barrier = true)
as
select
  n.id,
  n.round_id,
  r.club_id,
  n.book_id,
  case
    when r.anonymous_nominators and r.status <> 'closed' and n.nominated_by <> (select auth.uid())
      then null
    else n.nominated_by
  end as nominated_by,
  n.nominated_by = (select auth.uid()) as is_mine,
  n.pitch,
  n.created_at,
  n.updated_at
from public.nominations n
join public.rounds r on r.id = n.round_id
where public.is_club_member(r.club_id);

revoke all on public.nominations_public from anon;
grant select on public.nominations_public to authenticated;

-- ---------------------------------------------------------------------------
-- Nomination rules, enforced on every insert/update regardless of caller.
-- ---------------------------------------------------------------------------

create function public.check_nomination()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_round public.rounds;
  v_count int;
begin
  -- Lock the round so concurrent nominations can't both slip under the limit.
  select * into v_round from public.rounds where id = new.round_id for update;
  if not found or v_round.status <> 'open' or v_round.deadline <= now() then
    raise exception 'round_not_open';
  end if;

  if tg_op = 'INSERT' then
    select count(*) into v_count from public.nominations
    where round_id = new.round_id and nominated_by = new.nominated_by;
    if v_count >= v_round.max_nominations_per_member then
      raise exception 'nomination_limit_reached';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger nominations_check
  before insert or update on public.nominations
  for each row execute function public.check_nomination();

-- Picks each can't go down once anyone has nominated.
create function public.check_round_update()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.max_nominations_per_member < old.max_nominations_per_member
     and exists (select 1 from public.nominations where round_id = new.id) then
    raise exception 'picks_cannot_decrease';
  end if;
  return new;
end;
$$;

create trigger rounds_check_update
  before update on public.rounds
  for each row execute function public.check_round_update();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- "Pick the next book". The deadline is 11:59 PM on the chosen date in the
-- admin's timezone.
create function public.start_round(
  p_club_id uuid,
  p_deadline_date date,
  p_timezone text,
  p_max_nominations int default null,
  p_anonymous boolean default false,
  p_note text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_deadline timestamptz;
  v_number int;
  v_max int;
  v_id uuid;
begin
  if not public.is_club_admin(p_club_id) then raise exception 'not_allowed'; end if;
  if p_max_nominations is not null and p_max_nominations not between 1 and 5 then
    raise exception 'invalid_input';
  end if;
  if p_note is not null and char_length(p_note) > 500 then raise exception 'invalid_input'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'invalid_timezone';
  end if;

  v_deadline := (p_deadline_date + time '23:59:59') at time zone p_timezone;
  if v_deadline <= now() then raise exception 'deadline_in_past'; end if;

  if exists (select 1 from public.rounds where club_id = p_club_id and status in ('open', 'closing')) then
    raise exception 'round_already_open';
  end if;

  select coalesce(max(number), 0) + 1 into v_number
  from public.rounds where club_id = p_club_id and status <> 'cancelled';

  v_max := coalesce(p_max_nominations, (
    select max_nominations_per_member from public.rounds
    where club_id = p_club_id and status <> 'cancelled'
    order by number desc limit 1
  ), 1);

  insert into public.rounds (club_id, number, deadline, timezone, max_nominations_per_member,
                             anonymous_nominators, note, created_by)
  values (p_club_id, v_number, v_deadline, p_timezone, v_max, coalesce(p_anonymous, false),
          nullif(btrim(coalesce(p_note, '')), ''), (select auth.uid()))
  returning id into v_id;

  return v_id;
exception
  when unique_violation then raise exception 'round_already_open';
end;
$$;

-- Called by the nominate edge function with the user's JWT, after it has
-- cached the book. With p_replace_id, swaps that nomination for the new book:
-- the old one is deleted (dropping it from every ballot) and the new one is
-- fresh, so people who already voted see it as "New since you voted".
create function public.nominate(
  p_round_id uuid,
  p_book_id uuid,
  p_pitch text default null,
  p_replace_id uuid default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_club uuid;
  v_id uuid;
begin
  select club_id into v_club from public.rounds where id = p_round_id;
  if v_club is null or not public.is_club_member(v_club) then raise exception 'not_allowed'; end if;
  if p_pitch is not null and char_length(p_pitch) > 280 then raise exception 'invalid_input'; end if;

  if p_replace_id is not null then
    delete from public.nominations
    where id = p_replace_id and round_id = p_round_id and nominated_by = v_uid;
    if not found then raise exception 'not_allowed'; end if;
  end if;

  insert into public.nominations (round_id, book_id, nominated_by, pitch)
  values (p_round_id, p_book_id, v_uid, nullif(btrim(coalesce(p_pitch, '')), ''))
  returning id into v_id;

  return v_id;
exception
  when unique_violation then raise exception 'already_nominated';
end;
$$;

-- Edit the pitch on your own nomination while the vote is open.
create function public.update_pitch(p_nomination_id uuid, p_pitch text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_pitch is not null and char_length(p_pitch) > 280 then raise exception 'invalid_input'; end if;
  update public.nominations
  set pitch = nullif(btrim(coalesce(p_pitch, '')), '')
  where id = p_nomination_id and nominated_by = (select auth.uid());
  if not found then raise exception 'not_allowed'; end if;
end;
$$;

revoke execute on function
  public.check_nomination(),
  public.check_round_update(),
  public.start_round(uuid, date, text, int, boolean, text),
  public.nominate(uuid, uuid, text, uuid),
  public.update_pitch(uuid, text)
from public, anon;
grant execute on function
  public.start_round(uuid, date, text, int, boolean, text),
  public.nominate(uuid, uuid, text, uuid),
  public.update_pitch(uuid, text)
to authenticated;
