import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Locally, read dev's settings from .env.local. CI sets them directly.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

// End-to-end flows against a production build of the app, which talks to
// the dev database.
export default defineConfig({
  testDir: "./e2e",
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm build && pnpm start",
    url: "http://localhost:3000/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
