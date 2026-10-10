import { expect, test, type Page } from "@playwright/test";
import { createAdminClient } from "@/lib/server/supabase-admin";
import {
  deleteAccountByUsername,
  deleteAccounts,
  makeAdmin,
  testPassword,
  testUsername,
} from "@/test/dev-accounts";

// The accounts journey in a browser, against dev: an admin creates and edits
// a player, then the player signs in. Every account is deleted afterwards.
const admin = { username: testUsername(), password: testPassword(), id: "" };
const player = {
  username: testUsername(),
  renamedTo: testUsername(),
  password: testPassword(),
  newPassword: testPassword(),
};

// The admin is made the way Steven makes one in the dashboard: an Auth user
// with no metadata, so the trigger takes the username from the email.
test.beforeAll(async () => {
  const { data, error } = await createAdminClient().auth.admin.createUser({
    email: `${admin.username}@flex-idle.invalid`,
    password: admin.password,
    email_confirm: true,
  });
  if (error) throw error;
  admin.id = data.user.id;
  await makeAdmin(admin.id);
});

test.afterAll(async () => {
  await deleteAccounts([admin.id]);
  await deleteAccountByUsername(player.username);
  await deleteAccountByUsername(player.renamedTo);
});

async function signIn(page: Page, username: string, password: string) {
  await page.goto("/");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("accounts journey", async ({ page }) => {
  let editUrl = "";

  await test.step("signed-out visitors are sent to sign in", async () => {
    for (const path of ["/profile", "/admin"]) {
      await page.goto(path);
      await expect.soft(page, `${path} didn't redirect to sign in`).toHaveURL("/");
    }
  });

  await test.step("admin creates a player in Nashville, typing the username in capitals", async () => {
    await signIn(page, admin.username, admin.password);
    await expect(page, "admin didn't land on /admin").toHaveURL("/admin");

    await page.getByLabel("Username", { exact: true }).fill(player.username.toUpperCase());
    await page.getByLabel("Password", { exact: true }).fill(player.password);
    await page.getByLabel("Name", { exact: true }).fill("Dolly");
    await page.getByLabel("Country").selectOption({ label: "United States" });
    await page.getByLabel("City").selectOption("Nashville");
    await page.getByRole("button", { name: "Create player" }).click();

    await expect(page.getByRole("heading", { name: "Edit player" }), "create didn't open the edit page").toBeVisible();
    editUrl = page.url();
    await expect
      .soft(page.getByLabel("Username", { exact: true }), "username wasn't stored lowercase")
      .toHaveValue(player.username);
    await expect.soft(page.getByLabel("City"), "city wasn't saved").toHaveValue("Nashville");
  });

  await test.step("admin renames the player, moves them to Wellington and sets a password", async () => {
    await page.getByLabel("Username", { exact: true }).fill(player.renamedTo);
    await page.getByRole("button", { name: "Change username" }).click();
    await expect.soft(page.getByText("Username changed."), "rename failed").toBeVisible();

    await page.getByLabel("Country").selectOption({ label: "New Zealand" });
    await expect
      .soft(page.getByLabel("City").locator("option", { hasText: "Nashville" }), "city list didn't follow the country")
      .toHaveCount(0);
    await page.getByLabel("City").selectOption("Wellington");
    await page.getByRole("button", { name: "Save details" }).click();
    await expect.soft(page.getByText("Details saved."), "details didn't save").toBeVisible();

    await page.getByLabel("New password").fill(player.newPassword);
    await page.getByRole("button", { name: "Set password" }).click();
    await expect.soft(page.getByText("Password set."), "password didn't set").toBeVisible();

    await page.goto("/admin");
    await expect
      .soft(page.getByRole("link", { name: player.renamedTo }), "player list doesn't show the new username")
      .toBeVisible();
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page, "sign out didn't return to sign in").toHaveURL("/");
  });

  await test.step("player signs in and sees only their own profile", async () => {
    await signIn(page, player.renamedTo, player.password);
    await expect.soft(page.getByText("Wrong username or password."), "old password still works").toBeVisible();

    await signIn(page, player.renamedTo.toUpperCase(), player.newPassword);
    await expect(page, "player couldn't sign in with a mixed-case username").toHaveURL("/play");
    await page.goto("/profile");
    await expect.soft(page.getByText("Dolly"), "profile doesn't show the name").toBeVisible();
    await expect.soft(page.getByText(player.renamedTo), "profile doesn't show the username").toBeVisible();
    await expect.soft(page.getByText("Wellington, New Zealand"), "profile doesn't show the location").toBeVisible();

    for (const path of ["/admin", new URL(editUrl).pathname]) {
      await page.goto(path);
      await expect
        .soft(page.getByText("This page could not be found."), `player could reach ${path}`)
        .toBeVisible();
    }
  });
});
