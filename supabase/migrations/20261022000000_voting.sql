-- Phase 3: ballots, managing an open vote, closing with IRV, results, club books.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- Ballots. `ballots` is one row per member per round and remembers when the
-- ballot was first cast, which "New since you voted" needs; `ballot_rankings`
-- is the ranked list. Nobody can read anyone else's.
-- ---------------------------------------------------------------------------

create table public.ballots (
  round_id uuid not null references public.rounds (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  first_cast_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (round_id, user_id)
);

create table public.ballot_rankings (
  round_id uuid not null,
  user_id uuid not null,
  nomination_id uuid not null references public.nominations (id) on delete cascade,
  rank int not null check (rank > 0),
  primary key (round_id, user_id, nomination_id),
  unique (round_id, user_id, rank),
  foreign key (round_id, user_id) references public.ballots (round_id, user_id) on delete cascade
);

create index ballot_rankings_nomination_idx on public.ballot_rankings (nomination_id);

alter table public.ballots enable row level security;
alter table public.ballot_rankings enable row level security;
revoke all on public.ballots, public.ballot_rankings from anon;
revoke insert, update, delete on public.ballots, public.ballot_rankings from authenticated;

create policy "ballots: own only" on public.ballots
  for select to authenticated using (user_id = (select auth.uid()));
create policy "ballot_rankings: own only" on public.ballot_rankings
  for select to authenticated using (user_id = (select auth.uid()));

-- Every ranking must be for a nomination in that round, not your own, while the vote is open.
create function public.check_ballot_ranking()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_round public.rounds;
  v_nomination public.nominations;
begin
  select * into v_nomination from public.nominations where id = new.nomination_id;
  if v_nomination.round_id is distinct from new.round_id then raise exception 'invalid_ballot'; end if;
  if v_nomination.nominated_by = new.user_id then raise exception 'cannot_rank_own_nomination'; end if;

  select * into v_round from public.rounds where id = new.round_id;
  if v_round.status <> 'open' or v_round.deadline <= now() then raise exception 'round_not_open'; end if;
  return new;
end;
$$;

create trigger ballot_rankings_check
  before insert or update on public.ballot_rankings
  for each row execute function public.check_ballot_ranking();

-- Replaces the caller's whole ranking. Ids for nominations that no longer exist
-- (removed or changed since the page loaded) are skipped, so a stale page can't
-- fail the save; anything else invalid raises.
create function public.save_ballot(p_round_id uuid, p_nomination_ids uuid[])
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_round public.rounds;
  v_first timestamptz;
begin
  -- FOR SHARE waits out a close that's claiming the round right now, so a save
  -- either lands before the votes are read or fails; it can't be silently left out.
  select * into v_round from public.rounds where id = p_round_id for share;
  if v_round.id is null or not public.is_club_member(v_round.club_id) then raise exception 'not_allowed'; end if;
  if v_round.status <> 'open' or v_round.deadline <= now() then raise exception 'round_not_open'; end if;

  insert into public.ballots (round_id, user_id) values (p_round_id, v_uid)
  on conflict (round_id, user_id) do update set updated_at = now()
  returning first_cast_at into v_first;

  delete from public.ballot_rankings where round_id = p_round_id and user_id = v_uid;

  insert into public.ballot_rankings (round_id, user_id, nomination_id, rank)
  select p_round_id, v_uid, x.id, row_number() over (order by x.ord)
  from unnest(p_nomination_ids) with ordinality as x (id, ord)
  join public.nominations n on n.id = x.id and n.round_id = p_round_id
  -- first occurrence only
  where x.ord = (select min(y.ord) from unnest(p_nomination_ids) with ordinality as y (id, ord) where y.id = x.id);

  return v_first;
end;
$$;

-- Who has voted (never how). Members of the club only.
create function public.round_vote_status(p_round_id uuid)
returns table (user_id uuid, has_voted boolean)
language sql stable security definer set search_path = ''
as $$
  select m.user_id, exists (
    select 1 from public.ballot_rankings br where br.round_id = r.id and br.user_id = m.user_id
  )
  from public.rounds r
  join public.club_members m on m.club_id = r.club_id
  where r.id = p_round_id and public.is_club_member(r.club_id)
$$;

-- ---------------------------------------------------------------------------
-- Managing an open vote (admins)
-- ---------------------------------------------------------------------------

create function public.update_round(
  p_round_id uuid,
  p_deadline_date date default null,
  p_timezone text default null,
  p_max_nominations int default null,
  p_anonymous boolean default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_round public.rounds;
  v_tz text;
  v_deadline timestamptz;
begin
  select * into v_round from public.rounds where id = p_round_id for update;
  if v_round.id is null or not public.is_club_admin(v_round.club_id) then raise exception 'not_allowed'; end if;
  if v_round.status <> 'open' then raise exception 'round_not_open'; end if;
  -- People nominated expecting to stay anonymous until the vote closes.
  if v_round.anonymous_nominators and p_anonymous is false
     and exists (select 1 from public.nominations where round_id = p_round_id) then
    raise exception 'anonymity_locked';
  end if;

  v_tz := coalesce(p_timezone, v_round.timezone);
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = v_tz) then
    raise exception 'invalid_timezone';
  end if;
  if p_deadline_date is not null then
    v_deadline := (p_deadline_date + time '23:59:59') at time zone v_tz;
    if v_deadline <= now() then raise exception 'deadline_in_past'; end if;
  end if;

  update public.rounds set
    deadline = coalesce(v_deadline, deadline),
    timezone = case when v_deadline is null then timezone else v_tz end,
    max_nominations_per_member = coalesce(p_max_nominations, max_nominations_per_member),
    anonymous_nominators = coalesce(p_anonymous, anonymous_nominators)
  where id = p_round_id;
end;
$$;

create function public.remove_nomination(p_nomination_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_round public.rounds;
begin
  -- Lock the round row (as update_round/cancel_round do) so this can't interleave with a close
  -- claiming the round: the status check below is then still true when the delete runs.
  select r.* into v_round from public.rounds r join public.nominations n on n.round_id = r.id
  where n.id = p_nomination_id for update of r;
  if v_round.id is null or not public.is_club_admin(v_round.club_id) then raise exception 'not_allowed'; end if;
  if v_round.status <> 'open' then raise exception 'round_not_open'; end if;
  delete from public.nominations where id = p_nomination_id;
end;
$$;

create function public.cancel_round(p_round_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_round public.rounds;
begin
  select * into v_round from public.rounds where id = p_round_id for update;
  if v_round.id is null or not public.is_club_admin(v_round.club_id) then raise exception 'not_allowed'; end if;
  if v_round.status <> 'open' then raise exception 'round_not_open'; end if;
  update public.rounds set status = 'cancelled', closed_at = now() where id = p_round_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Club books and results
-- ---------------------------------------------------------------------------

create type public.discussion_mode as enum ('single', 'sections');
create type public.club_book_status as enum ('reading', 'finished');

create table public.club_books (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  book_id uuid not null references public.books (id),
  round_id uuid unique references public.rounds (id) on delete set null,
  number int not null,
  discussion_mode public.discussion_mode not null default 'single',
  status public.club_book_status not null default 'reading',
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index club_books_club_idx on public.club_books (club_id, number desc);

create table public.round_results (
  round_id uuid primary key references public.rounds (id) on delete cascade,
  tallies jsonb not null,
  tiebreak_seed text not null,
  computed_at timestamptz not null default now()
);

alter table public.club_books enable row level security;
alter table public.round_results enable row level security;
revoke all on public.club_books, public.round_results from anon;
revoke insert, update, delete on public.club_books, public.round_results from authenticated;

create policy "club_books: members read" on public.club_books
  for select to authenticated using (public.is_club_member(club_id));

create policy "round_results: members read" on public.round_results
  for select to authenticated
  using (exists (select 1 from public.rounds r where r.id = round_id and public.is_club_member(r.club_id)));

alter table public.rounds add column close_claimed_at timestamptz;
-- How many times a close was claimed; more than once means an earlier attempt never finalized.
alter table public.rounds add column close_attempts int not null default 0;

-- ---------------------------------------------------------------------------
-- Closing. The close-round edge function calls these with the service role:
--   1. claim_round_close: open → closing, returns what IRV needs
--   2. (runs IRV in TypeScript)
--   3. finalize_round: writes results, the winner and the club book
-- Both are idempotent. A claim older than 5 minutes is assumed dead and can be retaken
-- by the cron run; an admin's early close retakes one older than 1 minute.
-- ---------------------------------------------------------------------------

create function public.claim_round_close(p_round_id uuid, p_early boolean default false)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_round public.rounds;
begin
  update public.rounds set status = 'closing', close_claimed_at = now(), close_attempts = close_attempts + 1
  where id = p_round_id
    and (
      (status = 'open' and (p_early or deadline <= now()))
      or (status = 'closing' and close_claimed_at < now() - (case when p_early then interval '1 minute' else interval '5 minutes' end))
    )
  returning * into v_round;

  if v_round.id is null then return null; end if;

  -- Visible in the Postgres logs: finalizing keeps failing for this round.
  if v_round.close_attempts > 1 then
    raise warning 'round % close claimed % times without finalizing; check the close-round function logs',
      v_round.id, v_round.close_attempts;
  end if;

  return jsonb_build_object(
    'round_id', v_round.id,
    'nominations', coalesce((
      select jsonb_agg(n.id order by n.created_at) from public.nominations n where n.round_id = v_round.id
    ), '[]'::jsonb),
    'ballots', coalesce((
      select jsonb_agg(b.ranking)
      from (
        select jsonb_agg(br.nomination_id order by br.rank) as ranking
        from public.ballot_rankings br
        where br.round_id = v_round.id
        group by br.user_id
      ) b
    ), '[]'::jsonb)
  );
end;
$$;

create function public.finalize_round(p_round_id uuid, p_result jsonb)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_round public.rounds;
  v_winner uuid;
  v_book uuid;
  v_club_book uuid;
begin
  select * into v_round from public.rounds where id = p_round_id for update;
  if v_round.status = 'closed' then
    return (select id from public.club_books where round_id = p_round_id);
  end if;
  if v_round.status <> 'closing' then raise exception 'round_not_closing'; end if;

  if p_result ->> 'method' = 'cancelled' then
    update public.rounds set status = 'cancelled', closed_at = now() where id = p_round_id;
    return null;
  end if;

  v_winner := (p_result ->> 'winner')::uuid;
  select book_id into v_book from public.nominations where id = v_winner and round_id = p_round_id;
  if v_book is null then raise exception 'invalid_winner'; end if;

  insert into public.round_results (round_id, tallies, tiebreak_seed)
  values (p_round_id, p_result, p_result ->> 'seed')
  on conflict (round_id) do update set tallies = excluded.tallies, tiebreak_seed = excluded.tiebreak_seed, computed_at = now();

  update public.rounds set status = 'closed', closed_at = now(), winner_nomination_id = v_winner
  where id = p_round_id;

  -- Picking the next book finishes the current one.
  update public.club_books set status = 'finished', finished_at = now()
  where club_id = v_round.club_id and status = 'reading';

  insert into public.club_books (club_id, book_id, round_id, number)
  values (v_round.club_id, v_book, p_round_id, v_round.number)
  returning id into v_club_book;

  return v_club_book;
end;
$$;

-- Admins may close their club's vote early; the edge function checks this as the caller.
-- Status isn't checked here: closing an already-closed round is a harmless no-op.
create function public.can_close_round(p_round_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.rounds r
    where r.id = p_round_id and public.is_club_admin(r.club_id)
  )
$$;

-- Rounds the cron run should close now.
create function public.rounds_due_for_close()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.rounds
  where (status = 'open' and deadline <= now())
     or (status = 'closing' and close_claimed_at < now() - interval '5 minutes')
$$;

-- pg_cron → close-round. The URL and service key live in Vault (names below) so
-- they never appear in migrations. With either missing (and a round due) this raises, so the
-- cron run shows as failed in cron.job_run_details instead of passing silently.
create function public.request_round_closes()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text;
  v_key text;
begin
  if not exists (select 1 from public.rounds_due_for_close()) then return; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'close_round_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'close_round_key';
  if v_url is null or v_key is null then
    raise exception 'close-round is not configured: add close_round_url and close_round_key to Vault (rounds are waiting to close)';
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
end;
$$;

select cron.schedule('close-overdue-rounds', '*/5 * * * *', $$ select public.request_round_closes() $$);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke execute on function
  public.check_ballot_ranking(),
  public.save_ballot(uuid, uuid[]),
  public.round_vote_status(uuid),
  public.update_round(uuid, date, text, int, boolean),
  public.remove_nomination(uuid),
  public.cancel_round(uuid),
  public.claim_round_close(uuid, boolean),
  public.finalize_round(uuid, jsonb),
  public.can_close_round(uuid),
  public.rounds_due_for_close(),
  public.request_round_closes()
from public, anon, authenticated;

grant execute on function
  public.save_ballot(uuid, uuid[]),
  public.round_vote_status(uuid),
  public.update_round(uuid, date, text, int, boolean),
  public.remove_nomination(uuid),
  public.cancel_round(uuid),
  public.can_close_round(uuid)
to authenticated;

grant execute on function
  public.claim_round_close(uuid, boolean),
  public.finalize_round(uuid, jsonb),
  public.rounds_due_for_close()
to service_role;
