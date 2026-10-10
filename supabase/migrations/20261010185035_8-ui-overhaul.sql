-- #8 UI overhaul: each account's language and theme, chosen in Settings.
-- Existing accounts get the defaults. The lists of allowed values match
-- LANGUAGES and THEMES in lib/preferences.ts.

alter table public.profiles
  add column language text not null default 'en' check (language in ('en', 'km')),
  add column theme text not null default 'dark' check (theme in ('dark', 'light'));

comment on column public.profiles.language is 'UI language: en or km.';
comment on column public.profiles.theme is 'UI theme: dark or light.';

-- Players read both through their existing select grant (RLS limits them
-- to their own row). Only the server writes them, after checking the
-- values; players get no write grant.
grant update (language, theme) on table public.profiles to service_role;
