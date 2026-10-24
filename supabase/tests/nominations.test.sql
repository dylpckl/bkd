-- Rounds and nominations: who can start votes, nomination rules, anonymity.
begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin2@test.dev', '{"display_name":"Ada"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a2', 'mem2@test.dev', '{"display_name":"Max"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a3', 'out2@test.dev', '{"display_name":"Otto"}', 'authenticated', 'authenticated');

create function pg_temp.as_user(p_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.as_postgres() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

create temp table t (club_id uuid, round_id uuid, mine uuid) on commit drop;
grant all on t to authenticated;

insert into public.books (id, google_books_id, title) values
  ('20000000-0000-0000-0000-000000000001', 'g1', 'Book One'),
  ('20000000-0000-0000-0000-000000000002', 'g2', 'Book Two'),
  ('20000000-0000-0000-0000-000000000003', 'g3', 'Book Three');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
insert into t (club_id) select club_id from public.create_club('Testers');
select pg_temp.as_postgres();
insert into public.club_members (club_id, user_id) select club_id, '00000000-0000-0000-0000-0000000000a2' from t;

-- Books: readable, not writable, by users.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select is((select count(*)::int from public.books where google_books_id in ('g1', 'g2', 'g3')), 3, 'users can read the book cache');
select throws_ok($$ insert into public.books (google_books_id, title) values ('x', 'Fake') $$, '42501', null, 'users cannot write books');

select is(
  (select array_agg(p order by p) from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p
   where has_table_privilege('authenticated', 'public.books', p)),
  array['SELECT'], 'authenticated has only select on books');
select is(
  (select array_agg(p order by p) from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p
   where has_table_privilege('authenticated', 'public.rounds', p)),
  array['SELECT'], 'authenticated has only select on rounds');

-- Starting a vote.
select throws_ok($$ select public.start_round((select club_id from t), current_date + 7, 'UTC') $$, 'not_allowed', 'members cannot start a vote');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.start_round((select club_id from t), current_date - 1, 'UTC') $$, 'deadline_in_past', 'deadline must be in the future');
select throws_ok($$ select public.start_round((select club_id from t), current_date + 7, 'Mars/Olympus') $$, 'invalid_timezone', 'timezone must be real');
select throws_ok($$ select public.start_round((select club_id from t), current_date + 7, 'UTC', 6) $$, 'invalid_input', 'picks each above 5 is rejected');
select throws_ok($$ select public.start_round((select club_id from t), current_date + 7, 'UTC', 0) $$, 'invalid_input', 'picks each below 1 is rejected');
select throws_ok($$ select public.start_round((select club_id from t), current_date + 7, 'UTC', 1, false, repeat('x', 501)) $$, 'invalid_input', 'notes over 500 characters are rejected');
update t set round_id = public.start_round(club_id, current_date + 7, 'America/New_York', null, true, '  Spooky?  ');
select is((select number from public.rounds where id = (select round_id from t)), 1, 'first vote is Book 1');
select is((select max_nominations_per_member from public.rounds where id = (select round_id from t)), 1, 'picks each defaults to 1');
select is((select note from public.rounds where id = (select round_id from t)), 'Spooky?', 'note is trimmed');
select is((select deadline from public.rounds where id = (select round_id from t)),
  ((current_date + 7) + time '23:59:59') at time zone 'America/New_York', 'deadline is 11:59 PM in the admin timezone');
select throws_ok($$ select public.start_round((select club_id from t), current_date + 7, 'UTC') $$, 'round_already_open', 'one open vote per club');

-- Nominating.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
update t set mine = public.nominate(round_id, '20000000-0000-0000-0000-000000000001', ' A good one ');
select is((select pitch from public.nominations_public where id = (select mine from t)), 'A good one', 'pitch is trimmed');
select throws_ok($$ select public.nominate((select round_id from t), '20000000-0000-0000-0000-000000000002') $$,
  'nomination_limit_reached', 'one nomination each by default');
select throws_ok($$ insert into public.nominations (round_id, book_id, nominated_by) values ((select round_id from t), '20000000-0000-0000-0000-000000000002', auth.uid()) $$,
  '42501', null, 'no direct inserts into nominations');
select throws_ok($$ select * from public.nominations $$, '42501', null, 'the base table is not readable');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.nominate((select round_id from t), '20000000-0000-0000-0000-000000000001') $$,
  'already_nominated', 'a book can be nominated once per round');
select lives_ok($$ select public.nominate((select round_id from t), '20000000-0000-0000-0000-000000000002') $$, 'admin nominates another book');

-- Anonymity: others' nominators are hidden while open; your own is visible.
select is((select count(*)::int from public.nominations_public where nominated_by is null), 1, 'other nominator hidden from admin');
select is((select count(*)::int from public.nominations_public where is_mine and nominated_by is not null), 1, 'own nominator visible');

-- Replacing your nomination swaps it in one step.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select lives_ok($$ select public.nominate((select round_id from t), '20000000-0000-0000-0000-000000000003', null, (select mine from t)) $$, 'member changes nomination');
select is((select count(*)::int from public.nominations_public where is_mine), 1, 'still one nomination after changing');
select is((select b.title from public.nominations_public n join public.books b on b.id = n.book_id where n.is_mine), 'Book Three', 'nomination now points at the new book');
select throws_ok($$ select public.nominate((select round_id from t), '20000000-0000-0000-0000-000000000001', null, (select id from public.nominations_public where not is_mine limit 1)) $$,
  'not_allowed', 'cannot replace someone else''s nomination');

-- Over-long pitches are an input error, not a server error.
select throws_ok($$ select public.nominate((select round_id from t), '20000000-0000-0000-0000-000000000001', repeat('x', 281), (select id from public.nominations_public where is_mine)) $$,
  'invalid_input', 'pitch over 280 characters is rejected');
select throws_ok($$ select public.update_pitch((select id from public.nominations_public where is_mine), repeat('x', 281)) $$,
  'invalid_input', 'edited pitch over 280 characters is rejected');

-- Outsiders see nothing; picks each can go up but not down.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select is_empty($$ select * from public.nominations_public $$, 'outsiders cannot see nominations');
select pg_temp.as_postgres();
select throws_ok($$ update public.rounds set max_nominations_per_member = 6 where id = (select round_id from t) $$, '23514', null, 'picks each stays within 1..5');
update public.rounds set max_nominations_per_member = 3 where id = (select round_id from t);
select throws_ok($$ update public.rounds set max_nominations_per_member = 2 where id = (select round_id from t) $$, 'picks_cannot_decrease', 'picks each cannot go down after nominations');

-- Nominators stay hidden on an anonymous round that was cancelled, and are
-- revealed only once it is closed.
select pg_temp.as_postgres();
select throws_ok($$ insert into public.nominations (round_id, book_id, nominated_by) values (gen_random_uuid(), '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2') $$,
  'round_not_open', 'a nomination for a missing round is rejected cleanly');
update public.rounds set status = 'cancelled' where id = (select round_id from t);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.nominations_public where nominated_by is null), 1, 'nominators stay hidden after cancellation');
select pg_temp.as_postgres();
update public.rounds set status = 'closed' where id = (select round_id from t);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.nominations_public where nominated_by is null), 0, 'nominators are revealed once the round is closed');

select * from finish();
rollback;
