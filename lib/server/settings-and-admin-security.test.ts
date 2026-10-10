import { afterAll, expect, it } from "vitest";
import {
  createAdmin,
  createPlayer,
  deletePlayer,
  setPreferences,
  signInWithUsername,
} from "./accounts";
import { createAdminClient } from "./supabase-admin";
import { createAnonClient, deleteAccounts, testPassword, testUsername } from "@/test/dev-accounts";

// The settings and admin-tool rules the UI never attempts, checked against
// dev: players can't write their own preferences directly, the server
// refuses values it doesn't know, the first-admin script makes a real
// admin, and admins can't be deleted. The e2e flow covers the everyday
// paths.
const created = new Set<string>();

afterAll(async () => {
  await deleteAccounts(created);
});

it("keeps settings and admin tools safe", async () => {
  const admin = createAdminClient();

  const me = { username: testUsername(), password: testPassword() };
  const made = await createPlayer({ ...me, name: "Me", country: "NZ", city: "Wellington" });
  if (!made.ok) throw new Error(made.error);
  const meId = made.value.id;
  created.add(meId);

  // Preferences.
  const client = createAnonClient();
  const signIn = await signInWithUsername(client, me.username, me.password);
  expect(signIn.ok, "player couldn't sign in").toBe(true);

  const writes = {
    language: await client.from("profiles").update({ language: "km" }).eq("id", meId),
    theme: await client.from("profiles").update({ theme: "light" }).eq("id", meId),
  };
  for (const [what, result] of Object.entries(writes)) {
    expect.soft(result.error?.code, `player could write their own ${what}`).toBe("42501");
  }

  const unknownLanguage = await setPreferences(meId, { language: "fr", theme: "light" });
  const unknownTheme = await setPreferences(meId, { language: "km", theme: "neon" });
  expect.soft(unknownLanguage.ok, "saved an unknown language").toBe(false);
  expect.soft(unknownTheme.ok, "saved an unknown theme").toBe(false);

  const { data } = await admin.from("profiles").select("language, theme").eq("id", meId).single();
  expect.soft(data, "refused preferences were saved anyway").toEqual({ language: "en", theme: "dark" });

  // The first-admin script's createAdmin, and deleting.
  const madeAdmin = await createAdmin({
    username: testUsername(),
    password: testPassword(),
    name: "Admin",
    country: "NZ",
    city: "Auckland",
  });
  if (!madeAdmin.ok) throw new Error(madeAdmin.error);
  const adminId = madeAdmin.value.id;
  created.add(adminId);

  const { data: adminProfile } = await admin.from("profiles").select("role").eq("id", adminId).single();
  expect.soft(adminProfile?.role, "createAdmin didn't make an admin").toBe("admin");

  expect.soft((await deletePlayer(adminId)).ok, "deletePlayer accepted an admin").toBe(false);
  const { data: adminUser } = await admin.auth.admin.getUserById(adminId);
  expect.soft(adminUser.user, "an admin was deleted").not.toBeNull();
});
