-- #7 Resource creation: each player's resources (Gold for now) and stats,
-- and the two functions the server changes them through. Players only read
-- their own rows; nothing writes the tables directly, so every change goes
-- through save_clicks or reset_progress, which only the server can call.

-- One row per player per resource. More resource types (Favour with
-- Ascension) get added to the check.
create table public.resources (
  player_id uuid not null references public.profiles (id) on delete cascade,
  resource text not null check (resource in ('gold')),
  amount double precision not null default 0 check (amount >= 0 and amount < 'infinity'),
  primary key (player_id, resource)
);

comment on table public.resources is
  'How much of each resource a player has. Players read their own rows; only save_clicks and reset_progress write.';

-- One row per player. "run" counts reset on Ascension; "total" counts are
-- all-time. Reset progress clears both.
create table public.player_stats (
  player_id uuid primary key references public.profiles (id) on delete cascade,
  run_clicks bigint not null default 0 check (run_clicks >= 0),
  run_gold_earned double precision not null default 0 check (run_gold_earned >= 0),
  total_clicks bigint not null default 0 check (total_clicks >= 0),
  total_gold_earned double precision not null default 0 check (total_gold_earned >= 0),
  -- The click-rate cap's bookmark: clicks are allowed for the time since
  -- this moment (at most p_max_seconds of it), and each accepted click
  -- moves it on. Null means a full allowance.
  click_allowance_used_until timestamptz
);

comment on table public.player_stats is
  'Each player''s stats, this run and all-time. Players read their own row; only save_clicks and reset_progress write.';

alter table public.resources enable row level security;
alter table public.player_stats enable row level security;

create policy "Players read their own resources"
  on public.resources
  for select
  to authenticated
  using ((select auth.uid()) = player_id);

create policy "Players read their own stats"
  on public.player_stats
  for select
  to authenticated
  using ((select auth.uid()) = player_id);

-- Data API access is explicit. Players and the server only read; the
-- functions below do every write as their owner.
revoke all on table public.resources, public.player_stats from anon, authenticated, service_role;
grant select on table public.resources, public.player_stats to authenticated, service_role;

-- Every profile gets its rows when it's made, so reads and writes never
-- have to create them. Existing profiles get them here.
create function private.create_progress_for_new_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.resources (player_id, resource) values (new.id, 'gold');
  insert into public.player_stats (player_id) values (new.id);
  return new;
end;
$$;

revoke all on function private.create_progress_for_new_profile() from public, anon, authenticated;

create trigger create_progress_after_profile_insert
  after insert on public.profiles
  for each row
  execute function private.create_progress_for_new_profile();

insert into public.resources (player_id, resource) select id, 'gold' from public.profiles;
insert into public.player_stats (player_id) select id from public.profiles;

-- Adds a batch of clicks and returns the player's new Gold. The browser's
-- count is untrusted, so it accepts at most p_clicks_per_second for the
-- time since the allowance was last used, banking at most p_max_seconds.
-- The numbers come from lib/game/clicks.ts. Locking the stats row stops
-- two tabs' batches racing.
create function public.save_clicks(
  p_player uuid,
  p_clicks integer,
  p_gold_per_click double precision,
  p_clicks_per_second integer,
  p_max_seconds integer
)
returns double precision
language plpgsql
security definer
set search_path = ''
as $$
declare
  used_until timestamptz;
  allowed_from timestamptz;
  accepted bigint;
  earned double precision;
  gold double precision;
begin
  if p_clicks < 0 or p_gold_per_click < 0 or p_gold_per_click = 'infinity'
    or p_clicks_per_second <= 0 or p_max_seconds <= 0 then
    raise exception 'save_clicks: invalid arguments' using errcode = 'check_violation';
  end if;

  select click_allowance_used_until into used_until
  from public.player_stats
  where player_id = p_player
  for update;
  if not found then
    raise exception 'save_clicks: no such player' using errcode = 'no_data_found';
  end if;

  allowed_from := greatest(
    coalesce(used_until, '-infinity'),
    now() - make_interval(secs => p_max_seconds)
  );
  accepted := least(
    p_clicks,
    floor(extract(epoch from now() - allowed_from) * p_clicks_per_second)
  );
  earned := accepted * p_gold_per_click;

  update public.resources
  set amount = amount + earned
  where player_id = p_player and resource = 'gold'
  returning amount into gold;

  update public.player_stats
  set run_clicks = run_clicks + accepted,
      total_clicks = total_clicks + accepted,
      run_gold_earned = run_gold_earned + earned,
      total_gold_earned = total_gold_earned + earned,
      click_allowance_used_until =
        allowed_from + make_interval(secs => accepted::double precision / p_clicks_per_second)
  where player_id = p_player;

  return gold;
end;
$$;

-- Sets the player's resources and stats back to zero. The click allowance
-- is left alone.
create function public.reset_progress(p_player uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.resources set amount = 0 where player_id = p_player;
  update public.player_stats
  set run_clicks = 0, total_clicks = 0, run_gold_earned = 0, total_gold_earned = 0
  where player_id = p_player;
end;
$$;

-- Only the server calls them, with the secret key.
revoke all on function public.save_clicks(uuid, integer, double precision, integer, integer)
  from public, anon, authenticated;
revoke all on function public.reset_progress(uuid) from public, anon, authenticated;
grant execute on function public.save_clicks(uuid, integer, double precision, integer, integer)
  to service_role;
grant execute on function public.reset_progress(uuid) to service_role;
