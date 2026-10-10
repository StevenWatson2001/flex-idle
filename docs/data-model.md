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
