-- Posts, reviews, reveal rules and finishing.
begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000c1', 'r-admin@test.dev', '{"display_name":"Rae"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c2', 'r-mem@test.dev', '{"display_name":"Sam"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c3', 'r-out@test.dev', '{"display_name":"Tess"}', 'authenticated', 'authenticated');

create function pg_temp.as_user(p_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.as_postgres() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

create temp table t (club_id uuid, cb uuid, post uuid, reply uuid) on commit drop;
grant all on t to authenticated;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into t (club_id) select club_id from public.create_club('Readers');
select pg_temp.as_postgres();
insert into public.club_members (club_id, user_id) select club_id, '00000000-0000-0000-0000-0000000000c2' from t;
insert into public.books (id, google_books_id, title) values ('40000000-0000-0000-0000-000000000001', 'r1', 'Piranesi');
insert into public.club_books (club_id, book_id, number) select club_id, '40000000-0000-0000-0000-000000000001', 1 from t;
update t set cb = (select id from public.club_books where club_id = t.club_id);

-- Posts.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
select throws_ok($$ insert into public.posts (club_book_id, body, author_id) select cb, 'x', '00000000-0000-0000-0000-0000000000c1' from t $$,
  '42501', null, 'cannot post as someone else');
insert into public.posts (club_book_id, body) select cb, '  Loved the tides.  ' from t;
update t set post = (select id from public.posts where club_book_id = t.cb);
select is((select author_id from public.posts where id = (select post from t)), '00000000-0000-0000-0000-0000000000c2'::uuid, 'author is always the caller');
select is((select body from public.posts where id = (select post from t)), 'Loved the tides.', 'body is trimmed');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into public.posts (club_book_id, parent_id, body) select cb, post, 'Same!' from t;
update t set reply = (select id from public.posts where parent_id = t.post);
select isnt((select reply from t), null, 'replies work');
select throws_ok($$ insert into public.posts (club_book_id, parent_id, body) select cb, reply, 'Too deep' from t $$, 'invalid_reply', 'only one level of replies');
select throws_ok($$ insert into public.posts (club_book_id, body) select cb, '   ' from t $$, '23514', null, 'empty posts are rejected');
update public.posts set body = 'Hijacked' where id = (select post from t);
select is((select body from public.posts where id = (select post from t)), 'Loved the tides.', 'others cannot edit your post');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
update public.posts set body = 'Loved the tide tables.' where id = (select post from t);
select isnt((select edited_at from public.posts where id = (select post from t)), null, 'editing marks the post edited');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c3');
select is_empty($$ select * from public.posts $$, 'outsiders cannot read posts');
select throws_ok($$ insert into public.posts (club_book_id, body) select cb, 'hi' from t $$, '42501', null, 'outsiders cannot post');

-- A removed member can no longer edit or delete their own post.
select pg_temp.as_postgres();
delete from public.club_members where user_id = '00000000-0000-0000-0000-0000000000c2';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
update public.posts set body = 'Ghost edit' where id = (select post from t);
select pg_temp.as_postgres();
select is((select body from public.posts where id = (select post from t)), 'Loved the tide tables.', 'a former member cannot edit their post');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
delete from public.posts where id = (select post from t);
select pg_temp.as_postgres();
select isnt((select count(*)::int from public.posts where id = (select post from t)), 0, 'a former member cannot delete their post');
insert into public.club_members (club_id, user_id) select club_id, '00000000-0000-0000-0000-0000000000c2' from t;

-- Admins can delete any post; deleting a post removes its replies.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
delete from public.posts where id = (select post from t);
select is((select count(*)::int from public.posts where club_book_id = (select cb from t)), 0, 'admin deleted the post and its reply');

-- Reviews: hidden until you post yours.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
select throws_ok($$ select public.post_review((select cb from t), 11) $$, 'invalid_rating', 'rating is 1–10 half-stars');
select throws_ok($$ select public.post_review((select cb from t), 8, null, 'https://evil.example/x') $$, 'invalid_goodreads_url', 'only Goodreads links');
select throws_ok($$ select public.post_review((select cb from t), 8, null, 'https://www.goodreads.com/' || repeat('a', 500)) $$, 'invalid_goodreads_url', 'Goodreads links are capped at 500 characters');
select lives_ok($$ select public.post_review((select cb from t), 9, ' Quiet and strange. ', 'https://www.goodreads.com/review/show/1') $$, 'Sam posts a review');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select is_empty($$ select * from public.reviews $$, 'Rae cannot see reviews before posting hers');
select is((public.club_book_summary((select cb from t)) -> 'average'), 'null'::jsonb, 'the average is hidden while locked');
select is((public.club_book_summary((select cb from t)) -> 'review_count'), 'null'::jsonb, 'so is the review count');
select is((public.club_book_summary((select cb from t)) -> 'distribution'), 'null'::jsonb, 'and the breakdown');
select is(jsonb_array_length(public.club_book_summary((select cb from t)) -> 'finished_user_ids'), 1, 'and who has finished');
select is((select status::text from public.club_books where id = (select cb from t)), 'reading', 'still reading with one member left');

select lives_ok($$ select public.post_review((select cb from t), 6) $$, 'Rae posts hers');
select is((select count(*)::int from public.reviews), 2, 'now Rae sees both reviews');
select is((select status::text from public.club_books where id = (select cb from t)), 'finished', 'everyone has reviewed, so the book is finished');
select is((public.club_book_summary((select cb from t)) ->> 'review_count')::int, 2, 'unlocked members see the review count');
select is((public.club_book_summary((select cb from t)) ->> 'average')::numeric, 3.8, 'average is to one decimal (7.5 half-stars = 3.75 → 3.8)');
select lives_ok($$ select public.post_review((select cb from t), 7) $$, 'reviews can be edited');
select is((select rating from public.reviews where user_id = auth.uid()), 7::smallint, 'edit updated the rating');

-- Leaving: a former member's review doesn't count as finished, and the book
-- finishes when the last member still reading leaves.
select pg_temp.as_postgres();
insert into public.club_members (club_id, user_id) select club_id, '00000000-0000-0000-0000-0000000000c3' from t;
insert into public.club_books (club_id, book_id, number) select club_id, '40000000-0000-0000-0000-000000000001', 2 from t;
update t set cb = (select id from public.club_books where club_id = t.club_id and number = 2);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
select lives_ok($$ select public.post_review((select cb from t), 8) $$, 'Sam reviews book 2');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select lives_ok($$ select public.post_review((select cb from t), 8) $$, 'Rae reviews book 2; Tess is still reading');
select pg_temp.as_postgres();
delete from public.club_members where user_id = '00000000-0000-0000-0000-0000000000c2';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select is(jsonb_array_length(public.club_book_summary((select cb from t)) -> 'finished_user_ids'), 1, 'Sam left, so only Rae counts as finished');
select pg_temp.as_postgres();
delete from public.club_members where user_id = '00000000-0000-0000-0000-0000000000c3';
select is((select status::text from public.club_books where id = (select cb from t)), 'finished', 'Tess left, so everyone left has finished');

select * from finish();
rollback;
