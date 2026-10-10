import { existsSync } from "node:fs";

// Locally, tests read dev's settings from .env.local. CI sets them directly.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}
