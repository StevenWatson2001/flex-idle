import { expect, test, type Page } from "@playwright/test";
import { createPlayer } from "@/lib/server/accounts";
import { deleteAccounts, testPassword, testUsername } from "@/test/dev-accounts";

// Earning Gold in a browser, against dev: a player clicks, signs out at
// once (so the last clicks have to be sent on the way out), finds the same
// Gold and stats after signing in again, then resets their progress.
const player = { username: testUsername(), password: testPassword(), id: "" };

test.beforeAll(async () => {
  const made = await createPlayer({ ...player, name: "Tester", country: "NZ", city: "Wellington" });
  if (!made.ok) throw new Error(made.error);
  player.id = made.value.id;
});

test.afterAll(async () => {
  await deleteAccounts([player.id]);
});

async function signIn(page: Page) {
  await page.goto("/");
  await page.getByLabel("Username", { exact: true }).fill(player.username);
  await page.getByLabel("Password", { exact: true }).fill(player.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page, "player didn't land on /play").toHaveURL("/play");
}

async function signOut(page: Page) {
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page, "sign out didn't return to sign in").toHaveURL("/");
}

test("earning and resetting Gold", async ({ page }) => {
  const gold = page.getByRole("group", { name: "Gold" });
  const stats = page.getByRole("table", { name: "Stats" });

  await test.step("player clicks for Gold and signs out straight away", async () => {
    await signIn(page);
    await expect.soft(gold, "a new player doesn't start with 0 Gold").toHaveText(/^Gold\s*0$/);

    const clickArea = page.getByRole("button", { name: "Click to earn Gold" });
    for (let i = 0; i < 5; i++) await clickArea.click();
    await expect.soft(gold, "clicks didn't show as Gold").toHaveText(/^Gold\s*5$/);

    await signOut(page);
  });

  await test.step("the Gold and stats are there after signing in again", async () => {
    await signIn(page);
    await expect.soft(gold, "Gold wasn't saved on the way out").toHaveText(/^Gold\s*5$/);

    await page.getByRole("link", { name: "Profile" }).click();
    await expect
      .soft(stats.getByRole("row"), "stats don't show this run's and all-time clicks and Gold")
      .toHaveText([/This run\s*All time/, /Clicks\s*5\s*5/, /Gold earned\s*5\s*5/]);
  });

  await test.step("player resets their progress", async () => {
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Reset progress" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Reset", exact: true }).click();
    await expect
      .soft(page.getByText("Progress reset."), "no confirmation that progress was reset")
      .toBeVisible();

    await page.getByRole("link", { name: "Play" }).click();
    await expect.soft(gold, "reset didn't clear Gold").toHaveText(/^Gold\s*0$/);

    await page.getByRole("link", { name: "Profile" }).click();
    await expect
      .soft(stats.getByRole("row"), "reset didn't clear the stats")
      .toHaveText([/This run\s*All time/, /Clicks\s*0\s*0/, /Gold earned\s*0\s*0/]);
  });
});
