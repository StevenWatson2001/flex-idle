-- #3 Accounts: one profile per Auth user, holding the username, details and
-- role. Passwords stay in Supabase Auth. Profiles are created by a trigger
-- when an Auth user is created, so the two never get out of step.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Stored lowercase; the app lowercases whatever is typed.
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  -- Name, country and city are required by the app for every player. They
  -- are nullable only so a user added in the dashboard still gets a profile.
  name text check (name = btrim(name) and char_length(name) between 1 and 50),
  country text check (country ~ '^[A-Z]{2}$'),
  city text check (char_length(city) between 1 and 100),
  role text not null default 'player' check (role in ('player', 'admin')),
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per Auth user. Players read their own row; the server writes with the secret key.';

alter table public.profiles enable row level security;

create policy "Users read their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

-- Data API access is explicit: drop any default privileges, then grant only
-- what is needed. Players only read (RLS limits them to their own row). The
-- server reads all profiles and edits usernames, details and roles; it never
-- inserts or deletes, because the trigger inserts and deleting the Auth user
-- cascades.
revoke all on table public.profiles from anon, authenticated, service_role;
grant select on table public.profiles to authenticated;
grant select, update (username, name, country, city, role)
  on table public.profiles to service_role;

-- The trigger function lives in a schema the Data API doesn't expose, so it
-- can't be called as an RPC.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Creates the profile for a new Auth user. Values come from app_metadata,
-- which only the server (with the secret key) can set, never from
-- user_metadata. The role is never taken from metadata: every account
-- starts as a player. With no username in app_metadata (a user added in
-- the dashboard), the email's local part is used. If the insert fails, for
-- example on a taken username, the Auth user isn't created either.
create function private.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, name, country, city)
  values (
    new.id,
    lower(coalesce(new.raw_app_meta_data ->> 'username', split_part(new.email, '@', 1))),
    nullif(btrim(new.raw_app_meta_data ->> 'name'), ''),
    new.raw_app_meta_data ->> 'country',
    new.raw_app_meta_data ->> 'city'
  );
  return new;
end;
$$;

revoke all on function private.create_profile_for_new_user() from public, anon, authenticated;

create trigger create_profile_after_auth_user_insert
  after insert on auth.users
  for each row
  execute function private.create_profile_for_new_user();
