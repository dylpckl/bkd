-- RLS and RPC rules for clubs, membership and invites. Run with `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(47);

-- Test users: owner, admin, member, outsider.
insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.dev', '{"display_name":"Olive Owner"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'admin@test.dev', '{"full_name":"Ada Admin"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'member@test.dev', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000d', 'outsider@test.dev', '{"display_name":"Otto"}', 'authenticated', 'authenticated');

create function pg_temp.as_user(p_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.as_anon() returns void language sql as $$
  select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true);
$$;
create function pg_temp.as_postgres() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

-- Profiles come from the signup trigger, with names from metadata or the email.
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'Olive Owner', 'profile uses display_name');
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b'), 'Ada Admin', 'profile falls back to Google full_name');
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000c'), 'member', 'profile falls back to the email prefix');

-- Owner creates a club; gets the owner role and a 7-day, 20-use invite.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
create temp table t (club_id uuid, token text, new_token text) on commit drop;
grant all on t to authenticated, anon;
insert into t (club_id, token) select * from public.create_club('Overdue Society', 'Friends');
select is(public.club_role((select club_id from t)), 'owner'::public.club_role, 'creator is owner');
select is((select max_uses from public.club_invites where club_id = (select club_id from t)), 20, 'first invite allows 20 uses');
select ok((select expires_at between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour'
           from public.club_invites where club_id = (select club_id from t)), 'first invite expires in 7 days');

-- Signed-out preview works and leaks nothing about membership.
select pg_temp.as_anon();
select is(public.invite_preview((select token from t)) ->> 'status', 'valid', 'anon can preview a valid invite');
select is(public.invite_preview((select token from t)) -> 'club' ->> 'name', 'Overdue Society', 'preview shows the club name');
select is(public.invite_preview((select token from t)) ->> 'inviter', 'Olive Owner', 'preview shows who invited');
select is(public.invite_preview('nope') ->> 'status', 'invalid', 'unknown token is invalid');
select throws_ok($$ select * from public.accept_invite('x') $$, '42501', null, 'anon cannot accept invites');
select throws_ok($$ select * from public.clubs $$, '42501', null, 'anon has no access to clubs');

-- Others join through the invite.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select is((select status from public.accept_invite((select token from t))), 'joined', 'admin-to-be joins');
select is((select status from public.accept_invite((select token from t))), 'already_member', 'joining twice is a no-op');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select is((select status from public.accept_invite((select token from t))), 'joined', 'member joins');
select pg_temp.as_postgres();
select is((select use_count from public.club_invites where token = (select token from t)), 2, 'repeat join did not use up the invite');

-- Outsiders see nothing.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select is_empty($$ select * from public.clubs $$, 'outsider cannot read the club');
select is_empty($$ select * from public.club_members $$, 'outsider cannot read members');
select is_empty($$ select * from public.club_invites $$, 'outsider cannot read invites');
select is_empty($$ select * from public.profiles where id <> auth.uid() $$, 'outsider cannot read other profiles');
select throws_ok($$ select public.create_invite((select club_id from t)) $$, 'not_allowed', 'outsider cannot make invites');

-- Roles: owner promotes; admin can promote members but not demote admins.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select throws_ok($$ select public.set_member_role((select club_id from t), '00000000-0000-0000-0000-00000000000b', 'admin') $$,
  'not_allowed', 'members cannot change roles');
select is_empty($$ select * from public.club_invites $$, 'members cannot read invites');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.set_member_role((select club_id from t), '00000000-0000-0000-0000-00000000000b', 'admin') $$, 'owner makes an admin');
select throws_ok($$ select public.set_member_role((select club_id from t), '00000000-0000-0000-0000-00000000000b', 'owner') $$,
  'use_transfer_ownership', 'roles cannot be set to owner directly');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select throws_ok($$ select public.set_member_role((select club_id from t), '00000000-0000-0000-0000-00000000000a', 'member') $$,
  'not_allowed', 'admin cannot demote the owner');
select is((select count(*)::int from public.club_invites), 1, 'admins can read invites');

-- Club details: admins can edit, members cannot (RLS filters the update to zero rows).
select lives_ok($$ update public.clubs set name = 'The Overdue Society' where id = (select club_id from t) $$, 'admin renames the club');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
update public.clubs set name = 'Hacked' where id = (select club_id from t);
select is((select name from public.clubs where id = (select club_id from t)), 'The Overdue Society', 'member rename has no effect');
select throws_ok($$ insert into public.club_members (club_id, user_id) values ((select club_id from t), '00000000-0000-0000-0000-00000000000d') $$,
  '42501', null, 'members cannot add people directly');

-- New link revokes the old one.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
update t set new_token = public.create_invite(club_id, now() + interval '1 day', 1);
select isnt((select new_token from t), (select token from t), 'admin makes a new link');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select is((select status from public.accept_invite((select token from t))), 'revoked', 'old link is revoked');
select is(public.invite_preview((select token from t)) - 'is_member', '{"status":"revoked"}'::jsonb,
  'a revoked link reveals nothing but its status');
select pg_temp.as_anon();
select is(public.invite_preview((select token from t)) -> 'club', null, 'not to anonymous visitors either');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select is(public.invite_preview((select token from t)) -> 'club' ->> 'name', 'The Overdue Society', 'members still get the club from a dead link');
select throws_ok($$ select public.create_invite((select club_id from t), null, 0) $$, 'invalid_max_uses', 'max people of 0 is rejected');
select throws_ok($$ select public.create_invite((select club_id from t), null, 501) $$, 'invalid_max_uses', 'max people over 500 is rejected');
select is((select public.invite_status(i) from public.club_invites i where token = (select token from t)), 'revoked',
  'admins can read invite status from the database');

-- Expired and used-up links.
select pg_temp.as_postgres();
update public.club_invites set expires_at = now() - interval '1 minute' where revoked_at is null;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select is((select status from public.accept_invite((select new_token from t))), 'expired', 'expired link is refused');
select pg_temp.as_postgres();
update public.club_invites set expires_at = null, use_count = max_uses where revoked_at is null;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select is((select status from public.accept_invite((select new_token from t))), 'maxed', 'used-up link is refused');

-- Leaving, removing, transferring, deleting.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select throws_ok($$ select public.leave_club((select club_id from t)) $$, 'owner_must_transfer', 'owner cannot just leave');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select throws_ok($$ select public.delete_club((select club_id from t)) $$, 'not_allowed', 'admin cannot delete the club');
select lives_ok($$ select public.remove_member((select club_id from t), '00000000-0000-0000-0000-00000000000c') $$, 'admin removes a member');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.transfer_ownership((select club_id from t), '00000000-0000-0000-0000-00000000000b') $$, 'owner hands over the club');
select is(public.club_role((select club_id from t)), 'admin'::public.club_role, 'old owner becomes admin');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select lives_ok($$ select public.delete_club((select club_id from t)) $$, 'new owner deletes the club');
select pg_temp.as_postgres();
select is((select count(*)::int from public.club_members where club_id = (select club_id from t)), 0, 'deleting a club removes its members');

select * from finish();
rollback;
