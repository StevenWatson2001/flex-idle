-- #16 Units and upgrades: the content (units and upgrades, whose logic is
-- formulas the server evaluates; see docs/content.md), what each player
-- owns, and the functions the server changes progress through. The server
-- works out every price and rate in TypeScript and passes them in; these
-- functions lock the player's row, check those numbers were worked out from
-- the player's current progress, and do the writes.

-- Content ---------------------------------------------------------------

-- owner_id is null for the hand-made units everyone has; a player's id
-- for one that's theirs alone (AI-made, later). unlock is a formula; null
-- means always unlocked.
create table public.units (
  id text primary key check (id ~ '^[a-z][a-z0-9_]{0,39}$'),
  owner_id uuid references public.profiles (id) on delete cascade,
  sort_order integer not null,
  rarity text not null default 'common'
    check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  name jsonb not null
    check (jsonb_typeof(name -> 'en') = 'string' and jsonb_typeof(name -> 'km') = 'string'),
  base_cost double precision not null check (base_cost > 0 and base_cost < 'infinity'),
  cost_growth double precision not null check (cost_growth > 1 and cost_growth < 'infinity'),
  base_income double precision not null check (base_income >= 0 and base_income < 'infinity'),
  unlock text check (char_length(unlock) <= 500)
);

comment on table public.units is
  'Units players can buy. Only the server reads them, so locked ones stay hidden. See docs/content.md.';

-- effects is a list of {target, op, value}: see docs/content.md.
create table public.upgrades (
  id text primary key check (id ~ '^[a-z][a-z0-9_]{0,39}$'),
  owner_id uuid references public.profiles (id) on delete cascade,
  sort_order integer not null,
  rarity text not null default 'common'
    check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  name jsonb not null
    check (jsonb_typeof(name -> 'en') = 'string' and jsonb_typeof(name -> 'km') = 'string'),
  description jsonb not null
    check (jsonb_typeof(description -> 'en') = 'string' and jsonb_typeof(description -> 'km') = 'string'),
  cost double precision not null check (cost > 0 and cost < 'infinity'),
  unlock text check (char_length(unlock) <= 500),
  effects jsonb not null check (jsonb_typeof(effects) = 'array')
);

comment on table public.upgrades is
  'One-time upgrades players can buy. Only the server reads them, so locked ones stay hidden. See docs/content.md.';

create index units_owner_id_idx on public.units (owner_id);
create index upgrades_owner_id_idx on public.upgrades (owner_id);

-- RLS is on with no policies: players never read content directly. The
-- server reads it with the secret key and sends only what's unlocked.
alter table public.units enable row level security;
alter table public.upgrades enable row level security;

revoke all on table public.units, public.upgrades from anon, authenticated, service_role;
grant select on table public.units, public.upgrades to service_role;

-- What players own ----------------------------------------------------------

create table public.player_units (
  player_id uuid not null references public.profiles (id) on delete cascade,
  unit_id text not null references public.units (id) on delete cascade,
  owned bigint not null check (owned > 0),
  primary key (player_id, unit_id)
);

comment on table public.player_units is
  'How many of each unit a player owns this run. Players read their own rows; only buy_unit and reset_progress write.';

create table public.player_upgrades (
  player_id uuid not null references public.profiles (id) on delete cascade,
  upgrade_id text not null references public.upgrades (id) on delete cascade,
  bought_at timestamptz not null default now(),
  primary key (player_id, upgrade_id)
);

comment on table public.player_upgrades is
  'The upgrades a player has bought this run. Players read their own rows; only buy_upgrade and reset_progress write.';

create index player_units_unit_id_idx on public.player_units (unit_id);
create index player_upgrades_upgrade_id_idx on public.player_upgrades (upgrade_id);

alter table public.player_units enable row level security;
alter table public.player_upgrades enable row level security;

create policy "Players read their own units"
  on public.player_units
  for select
  to authenticated
  using ((select auth.uid()) = player_id);

create policy "Players read their own upgrades"
  on public.player_upgrades
  for select
  to authenticated
  using ((select auth.uid()) = player_id);

revoke all on table public.player_units, public.player_upgrades from anon, authenticated, service_role;
grant select on table public.player_units, public.player_upgrades to authenticated, service_role;

-- New stats -------------------------------------------------------------

-- run/total_click_gold: Gold earned by clicking (click upgrades unlock on
-- it). income_settled_at: when units' income was last credited; null means
-- never, so nothing is owed. progress_version: goes up with every purchase
-- and reset, so a write priced from older progress is refused.
alter table public.player_stats
  add column run_click_gold double precision not null default 0 check (run_click_gold >= 0),
  add column total_click_gold double precision not null default 0 check (total_click_gold >= 0),
  add column income_settled_at timestamptz,
  add column progress_version bigint not null default 0;

-- Helpers (private, called only by the functions below) -------------------

-- Locks the player's stats row and checks the caller's numbers were worked
-- out from the player's current progress (40001 if not, so the server
-- re-reads and works them out again).
create function private.lock_progress(p_player uuid, p_version bigint)
returns void
language plpgsql
set search_path = ''
as $$
declare
  current_version bigint;
begin
  select progress_version into current_version
  from public.player_stats
  where player_id = p_player
  for update;
  if not found then
    raise exception 'no such player' using errcode = 'no_data_found';
  end if;
  if current_version <> p_version then
    raise exception 'progress changed since it was priced' using errcode = 'serialization_failure';
  end if;
end;
$$;

-- Adds earned Gold to the player's Gold and their run and all-time totals,
-- and to the click totals if it came from clicking. Amounts stop at 1e308
-- rather than overflowing, which broken content could otherwise cause.
-- Returns the new Gold.
create function private.add_gold(p_player uuid, p_earned double precision, p_from_clicks boolean)
returns double precision
language plpgsql
set search_path = ''
as $$
declare
  top constant double precision := 1e308;
  gold double precision;
begin
  update public.resources
  set amount = least(amount + p_earned, top)
  where player_id = p_player and resource = 'gold'
  returning amount into gold;

  update public.player_stats
  set run_gold_earned = least(run_gold_earned + p_earned, top),
      total_gold_earned = least(total_gold_earned + p_earned, top),
      run_click_gold = case when p_from_clicks then least(run_click_gold + p_earned, top) else run_click_gold end,
      total_click_gold = case when p_from_clicks then least(total_click_gold + p_earned, top) else total_click_gold end
  where player_id = p_player;

  return gold;
end;
$$;

-- Credits units' income since it was last settled, counting at most
-- p_max_seconds of it so nothing is earned while the game is closed, and
-- moves the bookmark to now. Call it with the stats row locked.
create function private.settle_income(p_player uuid, p_income_per_second double precision, p_max_seconds integer)
returns void
language plpgsql
set search_path = ''
as $$
declare
  settled_at timestamptz;
  seconds double precision;
begin
  select income_settled_at into settled_at from public.player_stats where player_id = p_player;
  seconds := coalesce(least(greatest(extract(epoch from now() - settled_at)::double precision, 0), p_max_seconds), 0);
  perform private.add_gold(p_player, p_income_per_second * seconds, false);
  update public.player_stats set income_settled_at = now() where player_id = p_player;
end;
$$;

-- Takes p_cost Gold, or raises FI001 if the player hasn't got it. Returns
-- the Gold left.
create function private.spend_gold(p_player uuid, p_cost double precision)
returns double precision
language plpgsql
set search_path = ''
as $$
declare
  gold double precision;
begin
  update public.resources
  set amount = amount - p_cost
  where player_id = p_player and resource = 'gold' and amount >= p_cost
  returning amount into gold;
  if not found then
    raise exception 'not enough Gold' using errcode = 'FI001';
  end if;
  return gold;
end;
$$;

revoke all on function private.lock_progress(uuid, bigint) from public, anon, authenticated;
revoke all on function private.add_gold(uuid, double precision, boolean) from public, anon, authenticated;
revoke all on function private.settle_income(uuid, double precision, integer) from public, anon, authenticated;
revoke all on function private.spend_gold(uuid, double precision) from public, anon, authenticated;

-- The server's functions ----------------------------------------------------

-- The regular save, every couple of seconds while a signed-in page is open:
-- credits income, then adds a batch of clicks and returns the new Gold.
-- Clicks are capped as save_clicks did: at most p_clicks_per_second for the
-- time since the allowance was last used, banking at most
-- p_max_click_seconds. The numbers come from lib/game/clicks.ts and
-- lib/game/economy.ts.
create function public.sync_progress(
  p_player uuid,
  p_version bigint,
  p_clicks integer,
  p_gold_per_click double precision,
  p_income_per_second double precision,
  p_clicks_per_second integer,
  p_max_click_seconds integer,
  p_max_income_seconds integer
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
  gold double precision;
begin
  -- NaN sorts above infinity in Postgres, so "< 'infinity'" refuses it too.
  if p_clicks < 0 or not (p_gold_per_click >= 0 and p_gold_per_click < 'infinity')
    or not (p_income_per_second >= 0 and p_income_per_second < 'infinity')
    or p_clicks_per_second <= 0 or p_max_click_seconds <= 0 or p_max_income_seconds <= 0 then
    raise exception 'sync_progress: invalid arguments' using errcode = 'check_violation';
  end if;

  perform private.lock_progress(p_player, p_version);
  perform private.settle_income(p_player, p_income_per_second, p_max_income_seconds);

  select click_allowance_used_until into used_until from public.player_stats where player_id = p_player;
  allowed_from := greatest(
    coalesce(used_until, '-infinity'),
    now() - make_interval(secs => p_max_click_seconds)
  );
  accepted := least(
    p_clicks,
    floor(extract(epoch from now() - allowed_from) * p_clicks_per_second)
  );

  gold := private.add_gold(p_player, accepted * p_gold_per_click, true);
  update public.player_stats
  set run_clicks = run_clicks + accepted,
      total_clicks = total_clicks + accepted,
      click_allowance_used_until =
        allowed_from + make_interval(secs => accepted::double precision / p_clicks_per_second)
  where player_id = p_player;

  return gold;
end;
$$;

-- Buys p_count of a unit for p_cost, after crediting income at the rate
-- before the purchase. Returns the Gold left.
create function public.buy_unit(
  p_player uuid,
  p_version bigint,
  p_income_per_second double precision,
  p_max_income_seconds integer,
  p_unit text,
  p_count integer,
  p_cost double precision
)
returns double precision
language plpgsql
security definer
set search_path = ''
as $$
declare
  gold double precision;
begin
  if p_count < 1 or not (p_cost > 0 and p_cost < 'infinity')
    or not (p_income_per_second >= 0 and p_income_per_second < 'infinity') or p_max_income_seconds <= 0 then
    raise exception 'buy_unit: invalid arguments' using errcode = 'check_violation';
  end if;

  perform private.lock_progress(p_player, p_version);
  if not exists (
    select 1 from public.units where id = p_unit and (owner_id is null or owner_id = p_player)
  ) then
    raise exception 'buy_unit: no such unit' using errcode = 'no_data_found';
  end if;

  perform private.settle_income(p_player, p_income_per_second, p_max_income_seconds);
  gold := private.spend_gold(p_player, p_cost);

  insert into public.player_units (player_id, unit_id, owned)
  values (p_player, p_unit, p_count)
  on conflict (player_id, unit_id) do update set owned = public.player_units.owned + excluded.owned;

  update public.player_stats set progress_version = progress_version + 1 where player_id = p_player;
  return gold;
end;
$$;

-- Buys an upgrade for p_cost, after crediting income at the rate before
-- the purchase. Buying one twice is a unique violation (23505). Returns the
-- Gold left.
create function public.buy_upgrade(
  p_player uuid,
  p_version bigint,
  p_income_per_second double precision,
  p_max_income_seconds integer,
  p_upgrade text,
  p_cost double precision
)
returns double precision
language plpgsql
security definer
set search_path = ''
as $$
declare
  gold double precision;
begin
  if not (p_cost > 0 and p_cost < 'infinity')
    or not (p_income_per_second >= 0 and p_income_per_second < 'infinity') or p_max_income_seconds <= 0 then
    raise exception 'buy_upgrade: invalid arguments' using errcode = 'check_violation';
  end if;

  perform private.lock_progress(p_player, p_version);
  if not exists (
    select 1 from public.upgrades where id = p_upgrade and (owner_id is null or owner_id = p_player)
  ) then
    raise exception 'buy_upgrade: no such upgrade' using errcode = 'no_data_found';
  end if;

  perform private.settle_income(p_player, p_income_per_second, p_max_income_seconds);
  gold := private.spend_gold(p_player, p_cost);

  insert into public.player_upgrades (player_id, upgrade_id) values (p_player, p_upgrade);

  update public.player_stats set progress_version = progress_version + 1 where player_id = p_player;
  return gold;
end;
$$;

-- Sets the player back to nothing: no Gold, stats, units or upgrades. The
-- click allowance is left alone.
create or replace function public.reset_progress(p_player uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.resources set amount = 0 where player_id = p_player;
  update public.player_stats
  set run_clicks = 0, total_clicks = 0, run_gold_earned = 0, total_gold_earned = 0,
      run_click_gold = 0, total_click_gold = 0, income_settled_at = null,
      progress_version = progress_version + 1
  where player_id = p_player;
  delete from public.player_units where player_id = p_player;
  delete from public.player_upgrades where player_id = p_player;
end;
$$;

-- sync_progress replaces it.
drop function public.save_clicks(uuid, integer, double precision, integer, integer);

-- Only the server calls them, with the secret key. (reset_progress keeps
-- its grants from #7.)
revoke all on function public.sync_progress(uuid, bigint, integer, double precision, double precision, integer, integer, integer)
  from public, anon, authenticated;
revoke all on function public.buy_unit(uuid, bigint, double precision, integer, text, integer, double precision)
  from public, anon, authenticated;
revoke all on function public.buy_upgrade(uuid, bigint, double precision, integer, text, double precision)
  from public, anon, authenticated;
grant execute on function public.sync_progress(uuid, bigint, integer, double precision, double precision, integer, integer, integer)
  to service_role;
grant execute on function public.buy_unit(uuid, bigint, double precision, integer, text, integer, double precision)
  to service_role;
grant execute on function public.buy_upgrade(uuid, bigint, double precision, integer, text, double precision)
  to service_role;

-- The starter content -------------------------------------------------------
-- All Common. Balanced so a first run reaches 1M Gold earned in 30–40
-- minutes. Unit upgrades cost the unit's base cost × 30, × 600 and
-- × 10,000,000.

insert into public.units (id, sort_order, name, base_cost, cost_growth, base_income, unlock) values
  ('chicken', 1, '{"en": "Chicken", "km": "មាន់"}', 10, 1.3, 0.2, null),
  ('cattle', 2, '{"en": "Cattle", "km": "គោ"}', 120, 1.3, 1.5, 'owned(''chicken'') >= 1'),
  ('peasant', 3, '{"en": "Peasant", "km": "ពលករ"}', 1400, 1.3, 10, 'owned(''cattle'') >= 1'),
  ('farmer', 4, '{"en": "Farmer", "km": "កសិករ"}', 18000, 1.3, 70, 'owned(''peasant'') >= 1'),
  ('archer', 5, '{"en": "Archer", "km": "អ្នកបាញ់ធ្នូ"}', 250000, 1.3, 500, 'owned(''farmer'') >= 1');

insert into public.upgrades (id, sort_order, name, description, cost, unlock, effects) values
  ('calloused_hands', 1,
    '{"en": "Calloused Hands", "km": "ដៃរដុប"}',
    '{"en": "+5 Gold per click.", "km": "+៥ មាសក្នុងមួយចុច។"}',
    100, 'run_click_gold >= 100',
    '[{"target": "click", "op": "add", "value": "5"}]'),
  ('lucky_horseshoe', 2,
    '{"en": "Lucky Horseshoe", "km": "ដែកក្រចកសេះសំណាង"}',
    '{"en": "+50 Gold per click.", "km": "+៥០ មាសក្នុងមួយចុច។"}',
    5000, 'run_click_gold >= 10000',
    '[{"target": "click", "op": "add", "value": "50"}]'),
  ('gilded_gloves', 3,
    '{"en": "Gilded Gloves", "km": "ស្រោមដៃស្រោបមាស"}',
    '{"en": "+500 Gold per click.", "km": "+៥០០ មាសក្នុងមួយចុច។"}',
    500000, 'run_click_gold >= 1000000',
    '[{"target": "click", "op": "add", "value": "500"}]'),

  ('corn_feed', 4,
    '{"en": "Corn Feed", "km": "ចំណីពោត"}',
    '{"en": "Chickens earn twice as much.", "km": "មាន់រកមាសបានទ្វេដង។"}',
    300, 'owned(''chicken'') >= 10',
    '[{"target": "unit:chicken", "op": "multiply", "value": "2"}]'),
  ('bigger_coop', 5,
    '{"en": "Bigger Coop", "km": "ទ្រុងមាន់ធំជាងមុន"}',
    '{"en": "Chickens earn twice as much.", "km": "មាន់រកមាសបានទ្វេដង។"}',
    6000, 'owned(''chicken'') >= 25',
    '[{"target": "unit:chicken", "op": "multiply", "value": "2"}]'),
  ('golden_eggs', 6,
    '{"en": "Golden Eggs", "km": "ពងមាស"}',
    '{"en": "Chickens earn four times as much.", "km": "មាន់រកមាសបានបួនដង។"}',
    100000000, 'owned(''chicken'') >= 100',
    '[{"target": "unit:chicken", "op": "multiply", "value": "4"}]'),

  ('fresh_pasture', 7,
    '{"en": "Fresh Pasture", "km": "វាលស្មៅខៀវខ្ចី"}',
    '{"en": "Cattle earn twice as much.", "km": "គោរកមាសបានទ្វេដង។"}',
    3600, 'owned(''cattle'') >= 10',
    '[{"target": "unit:cattle", "op": "multiply", "value": "2"}]'),
  ('sturdy_barn', 8,
    '{"en": "Sturdy Barn", "km": "ក្រោលរឹងមាំ"}',
    '{"en": "Cattle earn twice as much.", "km": "គោរកមាសបានទ្វេដង។"}',
    72000, 'owned(''cattle'') >= 25',
    '[{"target": "unit:cattle", "op": "multiply", "value": "2"}]'),
  ('prize_bulls', 9,
    '{"en": "Prize Bulls", "km": "គោឈ្មោលល្បី"}',
    '{"en": "Cattle earn four times as much.", "km": "គោរកមាសបានបួនដង។"}',
    1200000000, 'owned(''cattle'') >= 100',
    '[{"target": "unit:cattle", "op": "multiply", "value": "4"}]'),

  ('straw_hats', 10,
    '{"en": "Straw Hats", "km": "មួកចំបើង"}',
    '{"en": "Peasants earn twice as much.", "km": "ពលកររកមាសបានទ្វេដង។"}',
    42000, 'owned(''peasant'') >= 10',
    '[{"target": "unit:peasant", "op": "multiply", "value": "2"}]'),
  ('village_well', 11,
    '{"en": "Village Well", "km": "អណ្តូងភូមិ"}',
    '{"en": "Peasants earn twice as much.", "km": "ពលកររកមាសបានទ្វេដង។"}',
    840000, 'owned(''peasant'') >= 25',
    '[{"target": "unit:peasant", "op": "multiply", "value": "2"}]'),
  ('harvest_festival', 12,
    '{"en": "Harvest Festival", "km": "បុណ្យច្រូតកាត់"}',
    '{"en": "Peasants earn four times as much.", "km": "ពលកររកមាសបានបួនដង។"}',
    14000000000, 'owned(''peasant'') >= 100',
    '[{"target": "unit:peasant", "op": "multiply", "value": "4"}]'),

  ('iron_ploughs', 13,
    '{"en": "Iron Ploughs", "km": "នង្គ័លដែក"}',
    '{"en": "Farmers earn twice as much.", "km": "កសិកររកមាសបានទ្វេដង។"}',
    540000, 'owned(''farmer'') >= 10',
    '[{"target": "unit:farmer", "op": "multiply", "value": "2"}]'),
  ('crop_rotation', 14,
    '{"en": "Crop Rotation", "km": "ការដាំដំណាំឆ្លាស់"}',
    '{"en": "Farmers earn twice as much.", "km": "កសិកររកមាសបានទ្វេដង។"}',
    10800000, 'owned(''farmer'') >= 25',
    '[{"target": "unit:farmer", "op": "multiply", "value": "2"}]'),
  ('fertile_fields', 15,
    '{"en": "Fertile Fields", "km": "វាលស្រែមានជីជាតិ"}',
    '{"en": "Farmers earn four times as much.", "km": "កសិកររកមាសបានបួនដង។"}',
    180000000000, 'owned(''farmer'') >= 100',
    '[{"target": "unit:farmer", "op": "multiply", "value": "4"}]'),

  ('yew_longbows', 16,
    '{"en": "Yew Longbows", "km": "ធ្នូវែង"}',
    '{"en": "Archers earn twice as much.", "km": "អ្នកបាញ់ធ្នូរកមាសបានទ្វេដង។"}',
    7500000, 'owned(''archer'') >= 10',
    '[{"target": "unit:archer", "op": "multiply", "value": "2"}]'),
  ('fletchers_hut', 17,
    '{"en": "Fletcher''s Hut", "km": "ខ្ទមធ្វើព្រួញ"}',
    '{"en": "Archers earn twice as much.", "km": "អ្នកបាញ់ធ្នូរកមាសបានទ្វេដង។"}',
    150000000, 'owned(''archer'') >= 25',
    '[{"target": "unit:archer", "op": "multiply", "value": "2"}]'),
  ('rain_of_arrows', 18,
    '{"en": "Rain of Arrows", "km": "ភ្លៀងព្រួញ"}',
    '{"en": "Archers earn four times as much.", "km": "អ្នកបាញ់ធ្នូរកមាសបានបួនដង។"}',
    2500000000000, 'owned(''archer'') >= 100',
    '[{"target": "unit:archer", "op": "multiply", "value": "4"}]');
