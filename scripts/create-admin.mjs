// Creates an admin account: `pnpm admin:create`. The app never makes
// admins, so this is how the first one (or any other) is made. It targets
// the project in .env.local (dev); add `-- --env-file <path>` to target
// another, such as a live env file kept on this machine. It runs the app's
// own createAdmin, so every rule a player's details must meet applies.
import "./ts-paths.mjs";
import { existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { text } from "node:stream/consumers";
import en from "../messages/en.json" with { type: "json" };

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const flag = args.indexOf("--env-file");
const envFile = flag === -1 ? ".env.local" : args[flag + 1];
if (!envFile || !existsSync(envFile)) {
  console.error(`No env file at ${envFile ?? "(missing path)"}.`);
  process.exit(1);
}
process.loadEnvFile(envFile);

const { createAdmin } = await import("../lib/server/accounts.ts");
const { COUNTRIES } = await import("../lib/accounts/locations.ts");
const { projectRef } = await import("../lib/supabase.ts");

// Piped answers (one per line) are read up front; a terminal is asked one
// question at a time, with the password hidden.
const piped = process.stdin.isTTY ? null : (await text(process.stdin)).split(/\r?\n/);

async function ask(question) {
  if (piped) {
    process.stdout.write(question + "\n");
    return (piped.shift() ?? "").trim();
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

async function askHidden(question) {
  if (piped) return ask(question);
  process.stdout.write(question);
  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.setEncoding("utf8");
  stdin.resume();
  return new Promise((resolve) => {
    let value = "";
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          stdin.off("data", onData);
          stdin.setRawMode(false);
          stdin.pause();
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u0003") process.exit(130); // Ctrl+C
        value = char === "\u007f" || char === "\b" ? value.slice(0, -1) : value + char;
      }
    };
    stdin.on("data", onData);
  });
}

const ref = projectRef();
console.log(`Creating an admin on ${ref} (from ${envFile}).`);

const username = await ask("Username: ");
const password = await askHidden("Password (at least 8 characters): ");
const name = await ask("Name: ");
const country = (await ask(`Country (${COUNTRIES.map((c) => c.code).join(", ")}): `)).toUpperCase();
const cities = COUNTRIES.find((c) => c.code === country)?.cities ?? [];
const city = await ask(cities.length ? `City (${cities.join(", ")}): ` : "City: ");

if ((await ask(`Create admin "${username}" on ${ref}? (y/N) `)).toLowerCase() !== "y") {
  console.log("Nothing created.");
  process.exit(0);
}

const result = await createAdmin({ username, password, name, country, city });
if (!result.ok) {
  console.error(en.errors[result.error] ?? result.error);
  process.exit(1);
}
console.log(`Admin "${username.trim().toLowerCase()}" created. Sign in at the site with that username.`);
