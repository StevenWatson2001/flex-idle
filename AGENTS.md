# AGENTS.md

Flex Idle: an idle game where an LLM generates many of the upgrades. It's a
practice project for Project Ascend's learning platform, so it uses that
platform's stack (`docs/architecture.md`) even where a simpler tool would
suit a game better. Steven decides; you implement approved plans.

## Workflow
1. Steven names the issue to work on, or asks you to create one. Read it
   with `gh issue view`, using `docs/roadmap.md` for context and
   `docs/vision.md` for where the game is heading; features should move
   toward it. Ask questions until the behaviour is clear, then plan in plan
   mode and wait for approval.
2. On a branch `slice/<name>`: write the tests first, run them to show
   they fail, and commit them.
3. Implement until they pass. Then run the full suite, typecheck, lint and
   build.
4. Push and open a PR: what changed, how it was tested, what Steven should
   check, and "Closes #<issue>".
5. Before calling the PR ready to merge, make sure a new chat could carry
   on from `docs/`, the issues and the code alone:
   - Small fixes go in this PR; bigger ones become issues.
   - Add to `docs/decisions.md` only what would break future work if
     unknown.
   - Confirm the roadmap with Steven. Next needs at least two slices with
     issues; draft any missing ones for his approval.

## Always
- Work against dev only.
- Decide game state on the server; treat values from the browser as
  untrusted.
- Change the schema only with a new migration
  (`supabase migration new <issue>-<name>`), one per slice. Every new
  table: enable RLS, add policies, and grant Data API access explicitly
  (new tables aren't exposed by default). Update `docs/data-model.md` in
  the same PR.
- Route LLM calls through `lib/server/ai.ts`.

## Tests
- Each slice gets at most two tests: one Playwright flow for its main
  journey, and one database test for the security rules the UI never
  attempts (RLS, grants, refusals). Add unit tests only for game maths
  and stats.
- Use the fewest checks that catch every bug: if one check already fails
  for a bug, drop any other that only catches the same bug.
- Use soft assertions with a message on every check, so one run shows
  everything that broke and where.

## Ask first
- Adding a dependency.
- Any migration that drops or renames a table or column.
- Anything not covered by `docs/` or outside the current slice.
- Changing the stack because something seems a poor fit.

## Never
- Edit a migration once it has been applied.
- Change or delete an existing test unless the approved plan says so.
- Put secrets in code, commits or logs, or secret keys in browser code or
  `NEXT_PUBLIC_` variables.
- Work around an action that settings block. Stop and tell Steven.

## Commands
- `pnpm install`: install dependencies.
- `pnpm dev`: run the app locally against dev (needs `.env.local`; see
  `.env.example`).
- `pnpm test`: run the tests (database tests use dev).
- `pnpm test:e2e`: build the app and run the Playwright flows against dev.
- `pnpm typecheck` · `pnpm lint` · `pnpm build`
- `pnpm supabase migration new <issue>-<name>`: create a migration.
- `pnpm db:push`: apply new migrations to dev (Steven runs it; add
  `-- --dry-run` to preview). It targets the project in `.env.local`, so
  it never touches live. Needs `pnpm supabase login` once per machine.
  Live gets migrations on merge.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
