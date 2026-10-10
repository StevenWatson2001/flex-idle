-- #2 Walking skeleton: a permanent one-row table that /api/health reads to
-- prove the app can reach the database. Readable by anyone, writable by no
-- one through the Data API.

create table public.health_check (
  id smallint primary key default 1 check (id = 1),
  status text not null
);

comment on table public.health_check is
  'One row read by /api/health. Readable by anyone; written only by migrations.';

alter table public.health_check enable row level security;

create policy "Anyone can read health_check"
  on public.health_check
  for select
  to anon, authenticated
  using (true);

-- Data API access is explicit: drop any default privileges, then allow reads only.
-- service_role bypasses RLS, so it is limited to reads here too.
revoke all on table public.health_check from anon, authenticated, service_role;
grant select on table public.health_check to anon, authenticated, service_role;

insert into public.health_check (id, status) values (1, 'ok');
