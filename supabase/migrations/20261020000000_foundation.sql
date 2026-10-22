-- Phase 1: profiles, clubs, membership, roles, invites.

create extension if not exists pgcrypto with schema extensions;

create type public.club_role as enum ('owner', 'admin', 'member');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  avatar_url text check (avatar_url is null or (avatar_url ~* '^https://[^[:space:]]+$' and char_length(avatar_url) <= 2048)),
  avatar_path text,
  created_at timestamptz not null default now()
);

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.club_members (
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.club_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

create index club_members_user_id_idx on public.club_members (user_id);
-- Exactly one owner per club (the "at least one" half is kept by the RPCs).
create unique index club_members_one_owner_idx on public.club_members (club_id) where role = 'owner';

-- The spec stores only a token hash. Club settings has to show the same link again,
-- so the token itself is stored too, readable only by the club's admins (RLS below).
create table public.club_invites (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  token text not null unique,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  max_uses int check (max_uses is null or max_uses > 0),
  use_count int not null default 0,
  revoked_at timestamptz
);

create index club_invites_club_id_idx on public.club_invites (club_id);

-- ---------------------------------------------------------------------------
-- Helpers (security definer so policies can call them without recursion)
-- ---------------------------------------------------------------------------

create function public.club_role(p_club_id uuid)
returns public.club_role
language sql stable security definer set search_path = ''
as $$
  select role from public.club_members
  where club_id = p_club_id and user_id = (select auth.uid())
$$;

create function public.is_club_member(p_club_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.club_members
    where club_id = p_club_id and user_id = (select auth.uid())
  )
$$;

create function public.is_club_admin(p_club_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.club_members
    where club_id = p_club_id and user_id = (select auth.uid()) and role in ('owner', 'admin')
  )
$$;

create function public.shares_club_with(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.club_members mine
    join public.club_members theirs on theirs.club_id = mine.club_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_user_id
  )
$$;

create function public.new_invite_token()
returns text
language sql volatile set search_path = ''
as $$
  select translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_')
$$;

-- ---------------------------------------------------------------------------
-- New users get a profile. Email sign-up puts the name in display_name;
-- Google puts it in full_name / name.
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(btrim(split_part(new.email, '@', 1)), ''),
      'Reader'
    ), 60),
    -- Only https avatars are kept (Google's are); anything else is dropped.
    (select u from unnest(array[
        new.raw_user_meta_data ->> 'avatar_url',
        new.raw_user_meta_data ->> 'picture'
      ]) as u
      where u ~* '^https://[^[:space:]]+$' and char_length(u) <= 2048
      limit 1)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Deleting an account would cascade away its club_members rows and leave any club it
-- owns without an owner. Make the owner transfer or delete those clubs first.
create function public.prevent_owner_profile_delete()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.club_members where user_id = old.id and role = 'owner') then
    raise exception 'owner_has_clubs';
  end if;
  return old;
end;
$$;

create trigger profiles_prevent_owner_delete
  before delete on public.profiles
  for each row execute function public.prevent_owner_profile_delete();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.club_invites enable row level security;

revoke all on public.profiles, public.clubs, public.club_members, public.club_invites from anon;
revoke insert, update, delete on public.profiles, public.clubs, public.club_members, public.club_invites from authenticated;
grant update (display_name, avatar_url, avatar_path) on public.profiles to authenticated;
grant update (name, description) on public.clubs to authenticated;

create policy "profiles: read self and clubmates" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_club_with(id));

create policy "profiles: update self" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "clubs: members read" on public.clubs
  for select to authenticated
  using (public.is_club_member(id));

create policy "clubs: admins update" on public.clubs
  for update to authenticated
  using (public.is_club_admin(id))
  with check (public.is_club_admin(id));

create policy "club_members: members read" on public.club_members
  for select to authenticated
  using (public.is_club_member(club_id));

create policy "club_invites: admins read" on public.club_invites
  for select to authenticated
  using (public.is_club_admin(club_id));

-- ---------------------------------------------------------------------------
-- RPCs. Every write to clubs/membership/invites goes through one of these.
-- Expected failures raise with a short snake_case message the UI maps to copy.
-- ---------------------------------------------------------------------------

create function public.create_club(p_name text, p_description text default null)
returns table (club_id uuid, invite_token text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_club uuid;
  v_token text := public.new_invite_token();
  v_name text := btrim(coalesce(p_name, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if char_length(v_name) not between 1 and 80 then raise exception 'invalid_club_name'; end if;
  if char_length(v_description) > 500 then raise exception 'invalid_description'; end if;

  -- Serialize per user so concurrent calls can't slip past the cap.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  if (select count(*) from public.club_members where user_id = v_uid and role = 'owner') >= 10 then
    raise exception 'club_limit_reached';
  end if;

  insert into public.clubs (name, description, created_by)
  values (v_name, v_description, v_uid)
  returning id into v_club;

  insert into public.club_members (club_id, user_id, role) values (v_club, v_uid, 'owner');

  insert into public.club_invites (club_id, token, created_by, expires_at, max_uses)
  values (v_club, v_token, v_uid, now() + interval '7 days', 20);

  return query select v_club, v_token;
end;
$$;

create function public.create_invite(
  p_club_id uuid,
  p_expires_at timestamptz default null,
  p_max_uses int default null
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_token text := public.new_invite_token();
begin
  if not public.is_club_admin(p_club_id) then raise exception 'not_allowed'; end if;
  if p_expires_at is not null and p_expires_at <= now() then raise exception 'invalid_expiry'; end if;
  if p_max_uses is not null and p_max_uses not between 1 and 500 then raise exception 'invalid_max_uses'; end if;

  -- Settings shows one link at a time, so a new link replaces the old ones.
  update public.club_invites set revoked_at = now()
  where club_id = p_club_id and revoked_at is null;

  insert into public.club_invites (club_id, token, created_by, expires_at, max_uses)
  values (p_club_id, v_token, (select auth.uid()), p_expires_at, p_max_uses);

  return v_token;
end;
$$;

create function public.revoke_invite(p_invite_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_club uuid;
begin
  select club_id into v_club from public.club_invites where id = p_invite_id;
  if v_club is null or not public.is_club_admin(v_club) then raise exception 'not_allowed'; end if;
  update public.club_invites set revoked_at = now() where id = p_invite_id and revoked_at is null;
end;
$$;

create function public.invite_status(i public.club_invites)
returns text
language sql stable set search_path = ''
as $$
  select case
    when i.id is null then 'invalid'
    when i.revoked_at is not null then 'revoked'
    when i.expires_at is not null and i.expires_at <= now() then 'expired'
    when i.max_uses is not null and i.use_count >= i.max_uses then 'maxed'
    else 'valid'
  end
$$;

-- What the Join screen shows. Callable signed out, so it returns only what the
-- invite card needs.
create function public.invite_preview(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_invite public.club_invites;
  v_status text;
  v_is_member boolean;
  v_uid uuid := (select auth.uid());
begin
  select * into v_invite from public.club_invites where token = p_token;
  v_status := public.invite_status(v_invite);
  if v_status = 'invalid' then
    return jsonb_build_object('status', 'invalid');
  end if;

  v_is_member := v_uid is not null and exists (
    select 1 from public.club_members where club_id = v_invite.club_id and user_id = v_uid
  );
  -- A revoked, expired or used-up link reveals nothing about the club, except to
  -- people already in it (so they can still be sent to the club).
  if v_status <> 'valid' and not v_is_member then
    return jsonb_build_object('status', v_status, 'is_member', false);
  end if;

  return jsonb_build_object(
    'status', v_status,
    'is_member', v_is_member,
    'club', (
      select jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'description', c.description,
        'member_count', (select count(*) from public.club_members m where m.club_id = c.id)
      )
      from public.clubs c where c.id = v_invite.club_id
    ),
    'inviter', (select p.display_name from public.profiles p where p.id = v_invite.created_by),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id, 'display_name', x.display_name, 'avatar_url', x.avatar_url, 'avatar_path', x.avatar_path
      ))
      from (
        select p.id, p.display_name, p.avatar_url, p.avatar_path
        from public.club_members m join public.profiles p on p.id = m.user_id
        where m.club_id = v_invite.club_id
        order by m.joined_at
        limit 5
      ) x
    ), '[]'::jsonb)
  );
end;
$$;

create function public.accept_invite(p_token text)
returns table (status text, club_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_invite public.club_invites;
  v_status text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_invite from public.club_invites i where i.token = p_token for update;
  v_status := public.invite_status(v_invite);

  if v_invite.id is not null and exists (
    select 1 from public.club_members m where m.club_id = v_invite.club_id and m.user_id = v_uid
  ) then
    return query select 'already_member'::text, v_invite.club_id;
    return;
  end if;

  if v_status <> 'valid' then
    return query select v_status, null::uuid;
    return;
  end if;

  insert into public.club_members (club_id, user_id, role) values (v_invite.club_id, v_uid, 'member');
  update public.club_invites set use_count = use_count + 1 where id = v_invite.id;

  return query select 'joined'::text, v_invite.club_id;
end;
$$;

-- Owners can make anyone an admin or a member. Admins can promote members but
-- only the owner can demote an admin. Nobody changes the owner's role here.
create function public.set_member_role(p_club_id uuid, p_user_id uuid, p_role public.club_role)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_mine public.club_role := public.club_role(p_club_id);
  v_theirs public.club_role;
begin
  select role into v_theirs from public.club_members where club_id = p_club_id and user_id = p_user_id;
  if v_theirs is null then raise exception 'not_a_member'; end if;
  if p_role = 'owner' then raise exception 'use_transfer_ownership'; end if;
  if v_theirs = 'owner' then raise exception 'not_allowed'; end if;
  if v_mine is null or v_mine = 'member' then raise exception 'not_allowed'; end if;
  if v_mine = 'admin' and v_theirs = 'admin' then raise exception 'not_allowed'; end if;

  update public.club_members set role = p_role where club_id = p_club_id and user_id = p_user_id;
end;
$$;

-- Owners can remove anyone else; admins can remove members.
create function public.remove_member(p_club_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_mine public.club_role := public.club_role(p_club_id);
  v_theirs public.club_role;
begin
  select role into v_theirs from public.club_members where club_id = p_club_id and user_id = p_user_id;
  if v_theirs is null then raise exception 'not_a_member'; end if;
  if p_user_id = (select auth.uid()) then raise exception 'use_leave_club'; end if;
  if v_theirs = 'owner' then raise exception 'not_allowed'; end if;
  if v_mine is null or v_mine = 'member' then raise exception 'not_allowed'; end if;
  if v_mine = 'admin' and v_theirs = 'admin' then raise exception 'not_allowed'; end if;

  delete from public.club_members where club_id = p_club_id and user_id = p_user_id;
end;
$$;

create function public.leave_club(p_club_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_mine public.club_role := public.club_role(p_club_id);
begin
  if v_mine is null then raise exception 'not_a_member'; end if;
  if v_mine = 'owner' then raise exception 'owner_must_transfer'; end if;
  delete from public.club_members where club_id = p_club_id and user_id = (select auth.uid());
end;
$$;

create function public.transfer_ownership(p_club_id uuid, p_new_owner uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if public.club_role(p_club_id) is distinct from 'owner' then raise exception 'not_allowed'; end if;
  if p_new_owner = v_uid then raise exception 'already_owner'; end if;
  if not exists (select 1 from public.club_members where club_id = p_club_id and user_id = p_new_owner) then
    raise exception 'not_a_member';
  end if;

  update public.club_members set role = 'admin' where club_id = p_club_id and user_id = v_uid;
  update public.club_members set role = 'owner' where club_id = p_club_id and user_id = p_new_owner;
end;
$$;

create function public.delete_club(p_club_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if public.club_role(p_club_id) is distinct from 'owner' then raise exception 'not_allowed'; end if;
  delete from public.clubs where id = p_club_id;
end;
$$;

-- Functions are executable by PUBLIC by default; narrow that down.
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.club_role(uuid),
  public.is_club_member(uuid),
  public.is_club_admin(uuid),
  public.shares_club_with(uuid),
  public.create_club(text, text),
  public.create_invite(uuid, timestamptz, int),
  public.revoke_invite(uuid),
  public.accept_invite(text),
  public.set_member_role(uuid, uuid, public.club_role),
  public.remove_member(uuid, uuid),
  public.leave_club(uuid),
  public.transfer_ownership(uuid, uuid),
  public.delete_club(uuid)
to authenticated;
grant execute on function public.invite_preview(text) to anon, authenticated;
-- Lets club settings select `status:invite_status` on its invite, so the app shows
-- the same verdict accept_invite enforces (and uses the database clock).
grant execute on function public.invite_status(public.club_invites) to authenticated;
alter default privileges in schema public revoke execute on functions from public, anon;

-- ---------------------------------------------------------------------------
-- Avatars (Profile screen uploads them; used from phase 5)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars: users read their own folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: users write their own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: users update their own folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: users delete their own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
