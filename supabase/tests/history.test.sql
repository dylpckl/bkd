-- Club history, Needs you and profile stats.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000d1', 'h-admin@test.dev', '{"display_name":"Uma"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d2', 'h-mem@test.dev', '{"display_name":"Vic"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d3', 'h-out@test.dev', '{"display_name":"Wes"}', 'authenticated', 'authenticated');

create function pg_temp.as_user(p_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.as_postgres() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

create temp table t (club_id uuid, done uuid, reading uuid, round_id uuid) on commit drop;
grant all on t to authenticated;

insert into public.books (id, google_books_id, title, authors) values
  ('50000000-0000-0000-0000-000000000001', 'h1', 'Circe', '{Madeline Miller}'),
  ('50000000-0000-0000-0000-000000000002', 'h2', 'Hyperion', '{Dan Simmons}'),
  ('50000000-0000-0000-0000-000000000003', 'h3', 'Piranesi', '{Susanna Clarke}');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
insert into t (club_id) select club_id from public.create_club('Historians');
select pg_temp.as_postgres();
insert into public.club_members (club_id, user_id) select club_id, '00000000-0000-0000-0000-0000000000d2' from t;
insert into public.club_books (club_id, book_id, number, status, started_at, finished_at)
select club_id, '50000000-0000-0000-0000-000000000001', 1, 'finished', now() - interval '60 days', now() - interval '20 days' from t;
insert into public.club_books (club_id, book_id, number, started_at)
select club_id, '50000000-0000-0000-0000-000000000002', 2, now() - interval '20 days' from t;
update t set done = (select id from public.club_books where club_id = t.club_id and number = 1),
             reading = (select id from public.club_books where club_id = t.club_id and number = 2);
-- Members joined before book 1 finished.
update public.club_members set joined_at = now() - interval '90 days' where club_id = (select club_id from t);
insert into public.reviews (club_book_id, user_id, rating)
select done, '00000000-0000-0000-0000-0000000000d2', 8 from t;

-- History.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d3');
select is_empty($$ select * from public.club_history((select club_id from t)) $$, 'outsiders see no history');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d2');
select is((select array_agg(title order by number desc) from public.club_history((select club_id from t))),
  array['Hyperion', 'Circe'], 'members see every club book, newest first');
select is((select average from public.club_history((select club_id from t)) where number = 1), 4.0, 'with the average rating');

-- Strict reveal: the book being read hides its rating until Vic posts a review.
select is((select average from public.club_history((select club_id from t)) where number = 2), null, 'no average on the book being read before you review it');
select is((select review_count from public.club_history((select club_id from t)) where number = 2), null, 'and no review count');

-- Needs you: the book being read needs a review from both members.
select is((select count(*)::int from public.needs_you() where kind = 'review'), 1, 'Vic has a review to post');
select is((select book_title from public.needs_you() where kind = 'review'), 'Hyperion', 'for the book being read');

-- An open vote needs a ballot once there's something to rank.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
update t set round_id = public.start_round(club_id, current_date + 3, 'UTC');
select is((select count(*)::int from public.needs_you() where kind = 'vote'), 0, 'nothing to rank yet');
select public.nominate((select round_id from t), '50000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.needs_you() where kind = 'vote'), 0, 'your own nomination is not something to rank');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d2');
select is((select count(*)::int from public.needs_you() where kind = 'vote'), 1, 'Vic has a ballot to rank');
select public.save_ballot((select round_id from t), array(select id from public.nominations_public where round_id = (select round_id from t)));
select is((select count(*)::int from public.needs_you() where kind = 'vote'), 0, 'and not once it is cast');
select public.post_review((select reading from t), 9);
select is((select count(*)::int from public.needs_you() where kind = 'review'), 0, 'or once the review is posted');
select is((select average from public.club_history((select club_id from t)) where number = 2), 4.5, 'posting your review unlocks the average');
select is((select review_count from public.club_history((select club_id from t)) where number = 2), 1, 'and the review count');

-- Profile stats.
select is((select books_read from public.profile_stats()), 2, 'Vic has read both books');
select is((select average from public.profile_stats()), 4.3, 'Vic averages 4.25 stars, shown as 4.3');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select is((select average from public.club_history((select club_id from t)) where number = 2), null, 'Uma has not reviewed the book being read: still locked');
select is((select average from public.club_history((select club_id from t)) where number = 1), 4.0, 'but the finished book shows its average without a review');
select is((select books_read from public.profile_stats()), 0, 'Uma was a member for the finished book but never reviewed it, so has not read it');

select * from finish();
rollback;
