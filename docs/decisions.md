# Decisions

Things that break if a future chat doesn't know them. Keep it short.

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
