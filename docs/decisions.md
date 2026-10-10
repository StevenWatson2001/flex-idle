# Decisions

Things that break if a future chat doesn't know them. Keep it short.

- **Game numbers** are doubles (`double precision` in Postgres, `number`
  in TypeScript), good to about 1.8e308. Show them with `formatAmount`
  from `lib/game/format.ts`, never raw.
- **Clicks** reach the database only through `save_clicks`, which caps
  them; the cap's numbers live in `lib/game/clicks.ts` and are passed in.
  Game tables have no write grants at all: new game writes get a
  `security definer` function that only `service_role` can execute,
  called from `lib/server/db-write.ts`.
- **Usernames:** they live only in `profiles.username`, lowercase. The
  Auth email is a placeholder (`new_<random>@accounts.flex-idle.invalid`)
  that never changes, so sign-in looks the username up on the server.
  Don't derive anything from the email.
- **Profile trigger:** Auth writes `app_metadata` *after* inserting the
  user, so the trigger can't see it and takes the username from the
  email. `createPlayer` uses a placeholder email, then sets the real
  fields. Never take the role from metadata.
- **Public sign-up is off** in the dashboard (dev and live), along with
  email confirmation. If sign-up were on, anyone with the publishable key
  could create a player. The security test fails if it's on.
- **First admin:** run `pnpm admin:create`. It targets the project in
  `.env.local` (dev); for live, `pnpm admin:create -- --env-file <file>`
  with a gitignored `.env.*.local` file holding live's URL and secret key.
  The app itself never makes admins.
- **UI text** lives only in `messages/*.json`. `km.json` must have every
  key `en.json` has, which typecheck enforces. Account errors are keys
  translated by the action that shows them, not English strings.
- **Colours** come only from the theme tokens in `app/globals.css`. The
  theme comes from the profile and the root layout renders the `.dark`
  class on the server, so nothing follows the browser's setting.
- **next-intl without its plugin:** the plugin loads `@swc/core`, whose
  native binding fails a permissions check on Steven's machine, so
  `next.config.ts` sets the one alias it would (`next-intl/config`).
  Don't add the plugin back.
- **shadcn CLI:** `shadcn add` installs an unrelated npm package called
  `cn` and imports `cn` from it, and asks to overwrite our themed
  components. After adding one: point its import at `@/lib/utils`, remove
  the `cn` package, copy any `@custom-variant` it needs into
  `globals.css`, and never overwrite existing components.
- **Secret key:** `SUPABASE_SECRET_KEY` (server only) in `.env.local` and
  Vercel. CI reads it from the GitHub secret `DEV_SUPABASE_SECRET_KEY`.

- **Live migrations:** Supabase's GitHub integration applies them only on a
  merge to `main`. After merging a migration, confirm it reached live.
- **Grants:** new tables aren't exposed to the Data API automatically.
  Grant each role explicitly, including `service_role` for server writes.
  Error `42501` means a missing grant, not RLS.
- **Version pins:** keep ESLint on 9 and TypeScript on 6.0 until
  `eslint-config-next` and `typescript-eslint` support newer versions.
  Upgrading breaks lint.
- **Env vars:** Next.js bakes `NEXT_PUBLIC_` values in at build time, so
  redeploy on Vercel after changing them. CI reads the GitHub secrets
  `DEV_SUPABASE_URL` and `DEV_SUPABASE_PUBLISHABLE_KEY`; renaming them
  breaks CI.
- **Vercel previews** require a Vercel login, so `curl` gets a 302.
  Steven checks previews in his browser.
- **Firewall:** it fails closed, so production needs `ALLOWED_IPS` set
  before any deploy, or everyone (Steven included) gets a 404. It trusts
  `x-real-ip`, which only Vercel sets reliably; don't reuse it on another
  host. See `docs/firewall.md`.
- **Supabase is open to the internet** by choice. Its IP restrictions only
  cover direct Postgres connections, not the HTTPS API the app uses. No
  browser code uses the publishable key today (it isn't in the bundle), but
  it's designed to be public: RLS, grants and public sign-up being off are
  what protect the data.
