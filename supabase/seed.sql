-- Local demo data, loaded by `supabase start` / `supabase db reset`.
-- Every account's password is "bookclub".
-- Sign in as dylan@example.com (owner of The Overdue Society).

do $$
declare
  people text[][] := array[
    ['00000000-0000-4000-8000-000000000001', 'dylan@example.com', 'Dylan'],
    ['00000000-0000-4000-8000-000000000002', 'jimmy@example.com', 'Jimmy'],
    ['00000000-0000-4000-8000-000000000003', 'adam@example.com', 'Adam'],
    ['00000000-0000-4000-8000-000000000004', 'giovanni@example.com', 'Giovanni'],
    ['00000000-0000-4000-8000-000000000005', 'brianna@example.com', 'Brianna'],
    ['00000000-0000-4000-8000-000000000006', 'priya@example.com', 'Priya']
  ];
  p text[];
begin
  foreach p slice 1 in array people loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', p[1]::uuid, 'authenticated', 'authenticated', p[2],
      extensions.crypt('bookclub', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('display_name', p[3]), now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), p[1]::uuid, p[1], 'email', jsonb_build_object('sub', p[1], 'email', p[2]), now(), now(), now());
  end loop;
end $$;

insert into public.clubs (id, name, description, created_by) values
  ('10000000-0000-4000-8000-000000000001', 'The Overdue Society', 'Friends who swear they''ll finish this one.', '00000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002', 'Sci-fi Sundays', null, '00000000-0000-4000-8000-000000000002');

insert into public.club_members (club_id, user_id, role) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'owner'),
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'admin'),
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', 'member'),
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', 'member'),
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', 'member'),
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000006', 'member'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'owner'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'member');

-- Open the Overdue Society invite at http://localhost:3000/join/demo-invite-overdue
insert into public.club_invites (club_id, token, created_by, expires_at, max_uses) values
  ('10000000-0000-4000-8000-000000000001', 'demo-invite-overdue', '00000000-0000-4000-8000-000000000001', now() + interval '30 days', 50);
