# Data model

The tables that exist, what each holds, and who can read or write it.
Migrations in `supabase/migrations/` are the source of truth; update this
file in the same PR as the migration.

## `public` schema

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
