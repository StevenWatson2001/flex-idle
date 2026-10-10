import { expect, test } from "@playwright/test";

// The firewall, against the build that acts as live (port 3001, see
// playwright.config.ts). Vercel puts the visitor's IP in x-real-ip, so the
// test sets that header to play visitors from different addresses.
const live = "http://localhost:3001";
const allowedIp = "203.0.113.10";

test.describe("an allowed IP", () => {
  test.use({ baseURL: live, extraHTTPHeaders: { "x-real-ip": allowedIp } });

  test("reaches the game", async ({ page }) => {
    await page.goto("/");
    await expect
      .soft(page.getByRole("button", { name: "Sign in" }), "allowed IP didn't get the sign-in page")
      .toBeVisible();
  });
});

test("other IPs get a bare 404 everywhere", async ({ request }) => {
  const otherIp = await request.get(`${live}/`, { headers: { "x-real-ip": "198.51.100.7" } });
  expect.soft(otherIp.status(), "an IP not on the list wasn't blocked").toBe(404);

  // Covers both a request with no IP and a path outside the session matcher.
  const noIp = await request.get(`${live}/api/health`);
  expect.soft(noIp.status(), "a request with no IP reached /api/health").toBe(404);
});
