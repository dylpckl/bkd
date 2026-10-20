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

-- The Overdue Society's reading history: three finished books and one being read.
insert into public.books (id, google_books_id, title, authors, page_count) values
  ('20000000-0000-4000-8000-000000000001', 'seed-circe', 'Circe', '{Madeline Miller}', 393),
  ('20000000-0000-4000-8000-000000000002', 'seed-hyperion', 'Hyperion', '{Dan Simmons}', 482),
  ('20000000-0000-4000-8000-000000000003', 'seed-remains', 'The Remains of the Day', '{Kazuo Ishiguro}', 245),
  ('20000000-0000-4000-8000-000000000004', 'seed-piranesi', 'Piranesi', '{Susanna Clarke}', 272);

insert into public.club_books (id, club_id, book_id, number, status, started_at, finished_at) values
  ('21000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 1, 'finished', now() - interval '150 days', now() - interval '105 days'),
  ('21000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 2, 'finished', now() - interval '105 days', now() - interval '55 days'),
  ('21000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', 3, 'finished', now() - interval '55 days', now() - interval '9 days'),
  ('21000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000004', 4, 'reading', now() - interval '9 days', null);

-- Ratings are half-stars (8 = 4 stars). Dylan hasn't reviewed Piranesi yet.
insert into public.reviews (club_book_id, user_id, rating, body)
select ('21000000-0000-4000-8000-00000000000' || b)::uuid, ('00000000-0000-4000-8000-00000000000' || u)::uuid, rating, body
from (values
  (1, 1, 7, 'Loved the island chapters.'), (1, 2, 8, null), (1, 3, 6, null), (1, 6, 8, 'Gorgeous prose.'),
  (2, 1, 8, 'The Priest''s Tale!'), (2, 2, 9, null), (2, 4, 7, null), (2, 5, 8, null),
  (3, 1, 8, null), (3, 3, 7, 'Quietly devastating.'), (3, 5, 7, null), (3, 6, 8, null),
  (4, 2, 9, 'The House is beautiful.'), (4, 6, 8, null)
) as r (b, u, rating, body);

-- Lets pg_cron call close-round on the local stack. These are the fixed local
-- defaults of `supabase start`; production sets its own values in Vault.
select vault.create_secret('http://kong:8000/functions/v1/close-round', 'close_round_url');
select vault.create_secret(
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
  'close_round_key'
);
