# Data model

The tables that exist, what each holds, and who can read or write it.
Migrations in `supabase/migrations/` are the source of truth; update this
file in the same PR as the migration.

## `public` schema

### `profiles`
Added in #3. One row per Supabase Auth user (`auth.users`), holding
everything about the account except the password, which only Auth keeps.

| Column       | Type          | Notes                                              |
| ------------ | ------------- | -------------------------------------------------- |
| `id`         | `uuid`        | Primary key; the Auth user's ID. Deleting the Auth user deletes the profile |
| `username`   | `text`        | Unique, `^[a-z0-9_]{3,20}$`. Stored lowercase; the app lowercases input |
| `name`       | `text`        | 1–50 characters, trimmed                           |
| `country`    | `text`        | Two-letter code, e.g. `NZ`                         |
| `city`       | `text`        | One of that country's cities in `lib/accounts/locations.ts` |
| `role`       | `text`        | `'player'` (default) or `'admin'`                  |
| `created_at` | `timestamptz` | When the account was made                          |
| `language`   | `text`        | Added in #8. UI language: `'en'` (default) or `'km'` |
| `theme`      | `text`        | Added in #8. UI theme: `'dark'` (default) or `'light'` |

- **Created by:** the trigger `create_profile_after_auth_user_insert` on
  `auth.users`, which calls `private.create_profile_for_new_user()`. It
  takes the username from the email's local part and always sets the role
  to `player`. `name`, `country` and `city` start empty: `createPlayer`
  fills them straight after. `createAdmin` (used only by
  `pnpm admin:create`) does the same, then sets the role to `admin`.
- **Read:** a signed-in user reads only their own row (RLS
  `(select auth.uid()) = id`). `anon` can't read it. The server reads all
  rows with the secret key.
- **Write:** only the server, with the secret key (`service_role`), and
  only `username`, `name`, `country`, `city`, `role`, `language` and
  `theme`. Players change their own language and theme through Settings,
  which the server checks against `lib/preferences.ts`. No one can insert
  or delete through the Data API.
- **Deleted by:** an admin deleting a player (never an admin) deletes the
  Auth user, and the profile goes with it.

### `health_check`
Added in #2. A permanent one-row table that `/api/health` reads to prove a
deploy can reach its database.

| Column   | Type       | Notes                                      |
| -------- | ---------- | ------------------------------------------ |
| `id`     | `smallint` | Primary key, always `1` (single row)       |
| `status` | `text`     | `'ok'`                                     |

- **Read:** anyone (`anon`, `authenticated`); RLS policy `using (true)`.
- **Write:** no one through the Data API. No write grants or policies, and
  `service_role` is limited to `select`. The row is inserted by the
  migration, so every environment gets it without seed data.

### `resources`
Added in #7. How much of each resource a player has: one row per player
per resource type.

| Column      | Type               | Notes                                          |
| ----------- | ------------------ | ---------------------------------------------- |
| `player_id` | `uuid`             | The profile's ID. Deleting the profile deletes the rows |
| `resource`  | `text`             | `'gold'`. Add new types (Favour) to the check   |
| `amount`    | `double precision` | 0 or more, never infinite                      |

Primary key `(player_id, resource)`.

### `player_stats`
Added in #7. One row per player: stats for the current run (reset by
Ascension, once it exists) and all-time.

| Column                       | Type               | Notes                               |
| ---------------------------- | ------------------ | ----------------------------------- |
| `player_id`                  | `uuid`             | Primary key; the profile's ID. Deleting the profile deletes the row |
| `run_clicks`                 | `bigint`           | Clicks accepted this run            |
| `run_gold_earned`            | `double precision` | Gold earned this run                |
| `total_clicks`               | `bigint`           | Clicks accepted, all-time           |
| `total_gold_earned`          | `double precision` | Gold earned, all-time               |
| `click_allowance_used_until` | `timestamptz`      | The click-rate cap's bookmark (see `sync_progress`). Null means a full allowance |
| `run_click_gold`             | `double precision` | Added in #16. Gold earned by clicking this run (click upgrades unlock on it) |
| `total_click_gold`           | `double precision` | Added in #16. Gold earned by clicking, all-time |
| `income_settled_at`          | `timestamptz`      | Added in #16. When units' income was last credited. Null means nothing is owed |
| `progress_version`           | `bigint`           | Added in #16. Goes up with every purchase and reset, so a write priced from older progress is refused |

For both tables:
- **Created by:** the trigger `create_progress_after_profile_insert` on
  `profiles` (`private.create_progress_for_new_profile()`), so every
  profile, admins included, has its rows. The #7 migration backfilled
  existing profiles.
- **Read:** a signed-in player reads only their own rows (RLS
  `(select auth.uid()) = player_id`). `anon` can't read them. The server
  reads them with the secret key too.
- **Write:** no one through the Data API: no role has insert, update or
  delete. Every change goes through the two functions below, which run as
  their owner (`security definer`) and only `service_role` can execute.
  The server calls them only from `lib/server/db-write.ts`.

### `units` and `upgrades`
Added in #16. The content: units players buy for income, and one-time
upgrades whose effects change it. Their logic is formulas the server
evaluates; `docs/content.md` explains the columns, the formula language and
how to add content.

`units`:

| Column        | Type               | Notes                                          |
| ------------- | ------------------ | ---------------------------------------------- |
| `id`          | `text`             | Primary key, `^[a-z][a-z0-9_]{0,39}$`. Never changes |
| `owner_id`    | `uuid`             | Null: everyone has it. A profile's ID: theirs alone (AI-made, later). Deleting the profile deletes it |
| `sort_order`  | `integer`          | Its place in the shop                          |
| `rarity`      | `text`             | `common` (default), `uncommon`, `rare`, `epic`, `legendary` |
| `name`        | `jsonb`            | `{"en": …, "km": …}`, both strings             |
| `base_cost`   | `double precision` | The first one's cost, over 0                   |
| `cost_growth` | `double precision` | Each one costs this × the one before, over 1   |
| `base_income` | `double precision` | Gold a second each, before upgrades            |
| `unlock`      | `text`             | Formula (≤ 500 characters); null means always  |

`upgrades` has the same `id`, `owner_id`, `sort_order`, `rarity`, `name`
and `unlock`, plus:

| Column        | Type               | Notes                                          |
| ------------- | ------------------ | ---------------------------------------------- |
| `description` | `jsonb`            | `{"en": …, "km": …}`, both strings             |
| `cost`        | `double precision` | Over 0                                         |
| `effects`     | `jsonb`            | A list of `{target, op, value}`                |

- **Created by:** migrations. #16 added 5 units and 18 upgrades.
- **Read:** only the server, with the secret key (`service_role` has
  `select`), and only rows with no owner or the player's own. RLS is on
  with no policies, so players can't read content directly, which keeps
  locked items hidden.
- **Write:** no one through the Data API.

### `player_units` and `player_upgrades`
Added in #16. What each player owns this run.

| Table             | Columns                                                       |
| ----------------- | ------------------------------------------------------------- |
| `player_units`    | `player_id`, `unit_id` (→ `units`), `owned` (`bigint`, over 0). Primary key `(player_id, unit_id)` |
| `player_upgrades` | `player_id`, `upgrade_id` (→ `upgrades`), `bought_at`. Primary key `(player_id, upgrade_id)` |

- **Created by:** `buy_unit` and `buy_upgrade`. Deleting the profile or the
  content deletes the rows.
- **Read:** a signed-in player reads only their own rows (RLS
  `(select auth.uid()) = player_id`). `anon` can't. The server reads them
  with the secret key too.
- **Write:** no one through the Data API; only the functions below.

## Functions

The server works out every price and rate (`lib/game/economy.ts`) and
passes them in. Each function that depends on what a player owns takes
`p_version`: it locks the stats row and raises `FI002` if
`progress_version` has changed since, and the server then re-reads and
retries. Before changing anything, each one credits units' income since
`income_settled_at` (at most `p_max_income_seconds`) at the rate passed in.
Gold and Gold-earned totals stop at 1e308.

- **`sync_progress(p_player, p_version, p_clicks, p_gold_per_click, p_income_per_second, p_clicks_per_second, p_max_click_seconds, p_max_income_seconds)`**
  (#16, replacing #7's `save_clicks`): the save every signed-in page makes
  every 2 s. It credits income, then adds a batch of clicks and returns the
  new Gold. It accepts at most `p_clicks_per_second` clicks for the time
  since `click_allowance_used_until`, banking at most `p_max_click_seconds`,
  and moves the bookmark on by the time the accepted clicks used.
- **`buy_unit(p_player, p_version, p_income_per_second, p_max_income_seconds, p_unit, p_count, p_cost)`**
  (#16): buys `p_count` of a unit the player can see for `p_cost`. It raises
  `FI001` if they can't afford it. Returns the Gold left.
- **`buy_upgrade(p_player, p_version, p_income_per_second, p_max_income_seconds, p_upgrade, p_cost)`**
  (#16): the same for an upgrade. Buying one twice raises `23505`.
- **`reset_progress(p_player)`** (#7, extended in #16): sets the player's
  resources and stats to zero, deletes their units and upgrades, clears
  `income_settled_at` and bumps `progress_version`. It leaves the click
  allowance alone.
