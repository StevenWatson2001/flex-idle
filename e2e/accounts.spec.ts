import { expect, test, type Page } from "@playwright/test";
import { createAdminClient } from "@/lib/server/supabase-admin";
import {
  deleteAccountByUsername,
  deleteAccounts,
  makeAdmin,
  testPassword,
  testUsername,
} from "@/test/dev-accounts";

// The whole accounts flow in a browser: an admin creates and edits a player,
// then the player signs in. Runs against dev; every account is deleted after.
test.describe.configure({ mode: "serial" });

const admin = { username: testUsername(), password: testPassword(), id: "" };
const player = {
  username: testUsername(),
  renamedTo: testUsername(),
  password: testPassword(),
  newPassword: testPassword(),
};

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

test("an admin creates and edits a player", async ({ page }) => {
  await signIn(page, admin.username, admin.password);
  await expect(page).toHaveURL("/admin");
  await expect(page.getByRole("heading", { name: "Players" })).toBeVisible();

  // Create the player in Nashville, US.
  await page.getByLabel("Username", { exact: true }).fill(player.username);
  await page.getByLabel("Password", { exact: true }).fill(player.password);
  await page.getByLabel("Name", { exact: true }).fill("Dolly");
  await page.getByLabel("Country").selectOption({ label: "United States" });
  await page.getByLabel("City").selectOption("Nashville");
  await page.getByRole("button", { name: "Create player" }).click();

  // Creating a player opens their edit page.
  await expect(page.getByRole("heading", { name: "Edit player" })).toBeVisible();
  await expect(page.getByLabel("Username", { exact: true })).toHaveValue(player.username);
  await expect(page.getByLabel("City")).toHaveValue("Nashville");

  // Rename them.
  await page.getByLabel("Username", { exact: true }).fill(player.renamedTo);
  await page.getByRole("button", { name: "Change username" }).click();
  await expect(page.getByText("Username changed.")).toBeVisible();

  // Move them to Wellington, NZ. The city list follows the country.
  await page.getByLabel("Country").selectOption({ label: "New Zealand" });
  await expect(page.getByLabel("City").locator("option", { hasText: "Nashville" })).toHaveCount(0);
  await page.getByLabel("City").selectOption("Wellington");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Details saved.")).toBeVisible();

  // Set a new password.
  await page.getByLabel("New password").fill(player.newPassword);
  await page.getByRole("button", { name: "Set password" }).click();
  await expect(page.getByText("Password set.")).toBeVisible();

  // The list shows the renamed player.
  await page.goto("/admin");
  await expect(page.getByRole("link", { name: player.renamedTo })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
});

test("the player signs in and sees only their profile", async ({ page }) => {
  // The old password no longer works.
  await signIn(page, player.renamedTo, player.password);
  await expect(page.getByText("Wrong username or password.")).toBeVisible();

  // Usernames are case-insensitive.
  await signIn(page, player.renamedTo.toUpperCase(), player.newPassword);
  await expect(page).toHaveURL("/profile");
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
  await expect(page.getByText("Dolly")).toBeVisible();
  await expect(page.getByText(player.renamedTo)).toBeVisible();
  await expect(page.getByText("Wellington, New Zealand")).toBeVisible();

  // Players can't reach the admin screens.
  await page.goto("/admin");
  await expect(page.getByText("This page could not be found.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Players" })).toHaveCount(0);
});

test("signed-out visitors are sent to sign in", async ({ page }) => {
  for (const path of ["/profile", "/admin", "/admin/players/00000000-0000-0000-0000-000000000000"]) {
    await page.goto(path);
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  }
});
