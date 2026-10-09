# AGENTS.md

Flex Idle: an idle game where an LLM generates many of the upgrades. It's a
practice project for Project Ascend's learning platform, so it uses that
platform's stack (`docs/architecture.md`) even where a simpler tool would
suit a game better. Steven decides; you implement approved plans.

## Workflow
1. Take the next slice from `docs/roadmap.md`. Ask questions until the
   behaviour is clear, then plan in plan mode and wait for approval.
2. On a branch `slice/<name>`: write the tests first, run them to show
   they fail, and commit them.
3. Implement until they pass without changing the tests. Then run the full
   suite, typecheck, lint and build.
4. Push and open a PR: what changed, how it was tested, what Steven should
   check.

## Always
- Work against dev only.
- Decide game state on the server; treat values from the browser as
  untrusted.
- In every migration that creates a table: enable RLS, add policies, and
  grant Data API access explicitly (new tables aren't exposed by default).
- Route LLM calls through the provider layer, server-side.

## Ask first
- Adding a dependency.
- Anything not covered by `docs/` or outside the current slice.
- Changing the stack because something seems a poor fit.

## Never
- Change the schema outside migrations, or edit an applied migration.
- Change or delete an existing test unless the approved plan says so.
- Put secrets in code, commits or logs, or secret keys in browser code or
  `NEXT_PUBLIC_` variables.
- Work around an action that settings block. Stop and tell Steven.
