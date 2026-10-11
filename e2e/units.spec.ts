import { expect, test, type Page } from "@playwright/test";
import { createPlayer } from "@/lib/server/accounts";
import { deleteAccounts, testPassword, testUsername } from "@/test/dev-accounts";

// Units and upgrades in a browser, against dev: a new player clicks enough
// to unlock and buy the first click upgrade, buys a Chicken, which unlocks
// Cattle, watches Gold grow on its own, then resets back to the start.
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

test("buying units and upgrades", async ({ page }) => {
  // 110 clicks and waiting for income take longer than the default 30 s.
  test.slow();
  const gold = page.getByRole("group", { name: "Gold" });
  const rates = page.getByRole("status", { name: "Earnings" });
  const panel = page.getByRole("complementary", { name: "Units, upgrades and blessings" });
  const units = panel.getByRole("list", { name: "Units for sale" });
  const available = panel.getByRole("list", { name: "Available upgrades" });
  const bought = panel.getByRole("list", { name: "Bought upgrades" });

  await test.step("a new player sees only the first unit", async () => {
    await signIn(page);
    await expect
      .soft(units.getByRole("listitem"), "a new player doesn't see just Chicken, none owned")
      .toHaveText([/^Chicken.*Owned 0/]);
  });

  await test.step("clicking unlocks the first click upgrade, which they buy", async () => {
    const clickArea = page.getByRole("button", { name: "Click to earn Gold" });
    for (let i = 0; i < 110; i++) await clickArea.click();

    await panel.getByRole("tab", { name: "Upgrades" }).click();
    const hands = available.getByRole("listitem", { name: "Calloused Hands" });
    await hands.getByRole("button", { name: /^Buy/ }).click();
    await expect.soft(rates, "Calloused Hands didn't make clicks worth 6").toHaveText(/^6 Gold per click/);

    await panel.getByRole("tab", { name: "Bought" }).click();
    await expect
      .soft(bought.getByRole("listitem"), "Calloused Hands isn't under Bought")
      .toHaveText([/^Calloused Hands/]);
  });

  await test.step("buying a Chicken unlocks Cattle and Gold grows by itself", async () => {
    await panel.getByRole("tab", { name: "Units" }).click();
    await units.getByRole("listitem", { name: "Chicken" }).getByRole("button", { name: /^Buy/ }).click();
    await expect
      .soft(units.getByRole("listitem"), "buying a Chicken didn't unlock Cattle")
      .toHaveText([/^Chicken.*Owned 1/, /^Cattle.*Owned 0/]);

    // 110 Gold − 100 − 10 leaves 0; one Chicken earns 0.2 a second.
    await expect.soft(gold, "Gold didn't grow without clicking").toHaveText(/^Gold\s*[1-9]/, { timeout: 15_000 });
  });

  await test.step("resetting progress takes away units and upgrades", async () => {
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Reset progress" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Reset", exact: true }).click();
    await expect.soft(page.getByText("Progress reset."), "no confirmation that progress was reset").toBeVisible();

    await page.getByRole("link", { name: "Play" }).click();
    await expect
      .soft(units.getByRole("listitem"), "reset didn't take away units")
      .toHaveText([/^Chicken.*Owned 0/]);
    await expect.soft(rates, "reset didn't take away Calloused Hands").toHaveText(/^1 Gold per click/);
  });
});
