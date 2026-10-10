// Applies new migrations to dev: `pnpm db:push` (add `-- --dry-run` to preview).
// The target comes from NEXT_PUBLIC_SUPABASE_URL in .env.local, which is
// always dev, so this never touches live whatever the CLI is linked to.
// Live gets migrations from Supabase's GitHub integration on merge.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

if (!existsSync(".env.local")) {
  console.error("No .env.local found. Copy .env.example and fill in dev's values.");
  process.exit(1);
}
process.loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url) {
  console.error("NEXT_PUBLIC_SUPABASE_URL is not set in .env.local.");
  process.exit(1);
}
const projectRef = new URL(url).hostname.split(".")[0];

// pnpm passes the "--" from `pnpm db:push -- --dry-run` through; the CLI
// would treat everything after it as positional, so drop it.
const args = process.argv.slice(2).filter((arg) => arg !== "--");

const cli = createRequire(import.meta.url).resolve("supabase/dist/supabase.js");
console.log(`Pushing migrations to dev (${projectRef})...`);
const result = spawnSync(
  process.execPath,
  [cli, "db", "push", "--project-ref", projectRef, ...args],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
