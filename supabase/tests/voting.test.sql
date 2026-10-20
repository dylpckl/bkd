-- Ballots, managing a vote, closing and results.
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000b1', 'v-admin@test.dev', '{"display_name":"Ava"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b2', 'v-mem@test.dev', '{"display_name":"Ben"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b3', 'v-mem2@test.dev', '{"display_name":"Cal"}', 'authenticated', 'authenticated');

create function pg_temp.as_user(p_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.as_role(p_role text) returns void language sql as $$
  select set_config('role', p_role, true), set_config('request.jwt.claims', json_build_object('role', p_role)::text, true);
$$;

create temp table t (club_id uuid, round_id uuid, n_admin uuid, n_ben uuid, n_cal uuid, club_book uuid) on commit drop;
grant all on t to authenticated, service_role;

insert into public.books (id, google_books_id, title) values
  ('30000000-0000-0000-0000-000000000001', 'v1', 'Alpha'),
  ('30000000-0000-0000-0000-000000000002', 'v2', 'Beta'),
  ('30000000-0000-0000-0000-000000000003', 'v3', 'Gamma'),
  ('30000000-0000-0000-0000-000000000004', 'v4', 'Delta');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
insert into t (club_id) select club_id from public.create_club('Voters');
select pg_temp.as_role('postgres');
insert into public.club_members (club_id, user_id)
select club_id, u from t, unnest(array['00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b3']::uuid[]) u;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
update t set round_id = public.start_round(club_id, current_date + 3, 'UTC', 2);
update t set n_admin = public.nominate(round_id, '30000000-0000-0000-0000-000000000001');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
update t set n_ben = public.nominate(round_id, '30000000-0000-0000-0000-000000000002');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b3');
update t set n_cal = public.nominate(round_id, '30000000-0000-0000-0000-000000000003');

-- Ballots.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select throws_ok($$ select public.save_ballot((select round_id from t), array[(select n_ben from t)]) $$,
  'cannot_rank_own_nomination', 'cannot rank your own nomination');
select lives_ok($$ select public.save_ballot((select round_id from t), array[(select n_cal from t), (select n_admin from t)]) $$, 'member saves a ballot');
select results_eq($$ select nomination_id from public.ballot_rankings order by rank $$,
  $$ select unnest(array[(select n_cal from t), (select n_admin from t)]) $$, 'ranking is stored in order');
select lives_ok($$ select public.save_ballot((select round_id from t), array[(select n_admin from t), (select n_cal from t), (select n_admin from t), gen_random_uuid()]) $$,
  'reordering with stale and repeated ids is fine');
select results_eq($$ select nomination_id from public.ballot_rankings order by rank $$,
  $$ select unnest(array[(select n_admin from t), (select n_cal from t)]) $$, 'reorder replaces the ranking, skipping unknowns');
select throws_ok($$ insert into public.ballot_rankings values ((select round_id from t), auth.uid(), (select n_cal from t), 9) $$,
  '42501', null, 'no direct writes to rankings');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b3');
select is_empty($$ select * from public.ballot_rankings $$, 'others'' ballots are not readable');
select is_empty($$ select * from public.ballots $$, 'others'' ballot headers are not readable');
select is((select count(*)::int from public.round_vote_status((select round_id from t)) where has_voted), 1, 'vote status shows who voted');
select is((select has_voted from public.round_vote_status((select round_id from t)) where user_id = '00000000-0000-0000-0000-0000000000b2'), true, 'Ben has voted');

-- Changing a nomination drops it from ballots that ranked it.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b3');
select lives_ok($$ select public.nominate((select round_id from t), '30000000-0000-0000-0000-000000000004', null, (select n_cal from t)) $$, 'Cal changes nomination');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select is((select count(*)::int from public.ballot_rankings), 1, 'the old book left Ben''s ballot');

-- Managing (admins only).
select throws_ok($$ select public.update_round((select round_id from t), current_date + 5) $$, 'not_allowed', 'members cannot manage the vote');
select throws_ok($$ select public.remove_nomination((select n_admin from t)) $$, 'not_allowed', 'members cannot remove nominations');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select lives_ok($$ select public.update_round((select round_id from t), current_date + 5, null, 3, true) $$, 'admin moves the deadline and raises picks');
select is((select max_nominations_per_member from public.rounds where id = (select round_id from t)), 3, 'picks raised');
select throws_ok($$ select public.update_round((select round_id from t), null, null, 1) $$, 'picks_cannot_decrease', 'picks cannot go back down');
select throws_ok($$ select public.update_round((select round_id from t), null, null, null, false) $$, 'anonymity_locked', 'anonymity stays on once people have nominated');
select throws_ok($$ select public.update_round((select round_id from t), current_date - 1) $$, 'deadline_in_past', 'deadline stays in the future');

-- Service-only functions are off limits to users.
select throws_ok($$ select public.claim_round_close((select round_id from t), true) $$, '42501', null, 'users cannot claim a close');
select throws_ok($$ select public.finalize_round((select round_id from t), '{}'::jsonb) $$, '42501', null, 'users cannot finalize');
select ok(public.can_close_round((select round_id from t)), 'admin can close early');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select ok(not public.can_close_round((select round_id from t)), 'member cannot close early');

-- Closing.
select pg_temp.as_role('service_role');
select is(public.claim_round_close((select round_id from t), false), null, 'not overdue: no claim without early');
select isnt(public.claim_round_close((select round_id from t), true), null, 'early claim succeeds');
select is(public.claim_round_close((select round_id from t), true), null, 'second claim is a no-op');
update t set club_book = public.finalize_round(round_id, jsonb_build_object('method', 'irv', 'winner', n_admin, 'seed', 'x'));
select is(public.finalize_round((select round_id from t), jsonb_build_object('method', 'irv', 'winner', (select n_admin from t), 'seed', 'x')),
  (select club_book from t), 'finalize is idempotent');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select is((select b.title from public.club_books cb join public.books b on b.id = cb.book_id), 'Alpha', 'winner became the club book');
select is((select tiebreak_seed from public.round_results), 'x', 'results are readable by members');

-- The next vote's winner finishes the current book.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
update t set round_id = public.start_round(club_id, current_date + 3, 'UTC');
select is((select number from public.rounds where id = (select round_id from t)), 2, 'next vote is Book 2');
update t set n_admin = public.nominate(round_id, '30000000-0000-0000-0000-000000000002');
select pg_temp.as_role('service_role');
select public.claim_round_close((select round_id from t), true);
select public.finalize_round((select round_id from t), jsonb_build_object('method', 'single', 'winner', (select n_admin from t), 'seed', 'y'));
select results_eq($$ select number, status::text from public.club_books where club_id = (select club_id from t) order by number $$,
  $$ values (1, 'finished'), (2, 'reading') $$, 'Book 1 finished when Book 2 was picked');

select * from finish();
rollback;
