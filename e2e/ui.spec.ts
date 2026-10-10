import { expect, test, type Page } from "@playwright/test";
import { createPlayer } from "@/lib/server/accounts";
import { deleteAccounts, makeAdmin, testPassword, testUsername } from "@/test/dev-accounts";

// The game layout, Settings and admin tools in a browser, against dev: a
// player finds their way around, switches to Khmer and the Light theme, and
// finds both kept after signing in again. Admins stay in their own area,
// where they can delete a player.
const player = { username: testUsername(), password: testPassword(), id: "" };
const admin = { username: testUsername(), password: testPassword(), id: "" };

test.beforeAll(async () => {
  for (const account of [player, admin]) {
    const made = await createPlayer({ ...account, name: "Tester", country: "NZ", city: "Wellington" });
    if (!made.ok) throw new Error(made.error);
    account.id = made.value.id;
  }
  await makeAdmin(admin.id);
});

test.afterAll(async () => {
  await deleteAccounts([player.id, admin.id]);
});

async function signIn(page: Page, username: string, password: string) {
  await page.goto("/");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("game layout and settings journey", async ({ page }) => {
  const html = page.locator("html");
  const navLinks = page.getByRole("navigation").getByRole("link");

  await test.step("player lands on the game layout in the Dark theme", async () => {
    await signIn(page, player.username, player.password);
    await expect(page, "player didn't land on /play").toHaveURL("/play");

    await expect.soft(html, "Dark isn't the default theme").toHaveClass(/\bdark\b/);
    await expect.soft(navLinks, "player nav is wrong").toHaveText(["Play", "Profile", "Settings"]);
    await expect
      .soft(page.getByRole("link", { name: "Play" }), "Play isn't marked as the current section")
      .toHaveAttribute("aria-current", "page");
    await expect.soft(page.getByRole("region", { name: "Game" }), "no game area").toBeVisible();
    await expect
      .soft(page.getByRole("region", { name: "Currencies" }), "currency bar doesn't show Gold and Favour")
      .toHaveText(/Gold.*Favour/);

    await expect
      .soft(page.getByText("Units you can buy will appear here."), "Units tab has no empty state")
      .toBeVisible();
    await page.getByRole("tab", { name: "Upgrades" }).click();
    await expect
      .soft(page.getByText("Upgrades you can buy will appear here."), "Upgrades tab has no empty state")
      .toBeVisible();
    await page.getByRole("tab", { name: "Blessings" }).click();
    await expect
      .soft(
        page.getByText("Blessings the gods grant when you ascend will appear here."),
        "Blessings tab has no empty state",
      )
      .toBeVisible();
  });

  await test.step("player switches to Khmer and the Light theme", async () => {
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByLabel("Language").selectOption("km");
    await page.getByLabel("Theme").selectOption("light");
    await page.getByRole("button", { name: "Save preferences" }).click();

    await expect.soft(html, "page isn't marked as Khmer").toHaveAttribute("lang", "km");
    await expect.soft(html, "Light theme didn't apply").not.toHaveClass(/\bdark\b/);
    await expect
      .soft(navLinks, "nav wasn't translated")
      .toHaveText(["លេង", "ប្រវត្តិរូប", "ការកំណត់"]);
  });

  await test.step("both choices are kept after signing in again", async () => {
    await page.getByRole("button", { name: "ចាកចេញ" }).click();
    await expect(page, "sign out didn't return to sign in").toHaveURL("/");

    await signIn(page, player.username, player.password);
    await expect(page, "player didn't land on /play again").toHaveURL("/play");
    await expect.soft(html, "Khmer wasn't saved").toHaveAttribute("lang", "km");
    await expect.soft(html, "Light theme wasn't saved").not.toHaveClass(/\bdark\b/);

    await page.getByRole("link", { name: "ការកំណត់" }).click();
    await page.getByRole("button", { name: "ចាកចេញ" }).click();
    await expect(page, "second sign out didn't return to sign in").toHaveURL("/");
  });

  await test.step("admins stay in the admin area", async () => {
    await signIn(page, admin.username, admin.password);
    await expect(page, "admin didn't land on /admin").toHaveURL("/admin");
    await expect.soft(navLinks, "admin nav is wrong").toHaveText(["Players", "Profile", "Settings"]);

    await page.goto("/play");
    await expect.soft(page, "admin could open the game").toHaveURL("/admin");
  });

  await test.step("admin deletes the player", async () => {
    await page.goto("/admin");
    await page.getByRole("link", { name: player.username }).click();
    await page.getByRole("button", { name: "Delete player" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();

    await expect(page, "delete didn't return to the player list").toHaveURL("/admin");
    await expect
      .soft(page.getByRole("link", { name: player.username }), "deleted player is still listed")
      .toHaveCount(0);
  });
});
