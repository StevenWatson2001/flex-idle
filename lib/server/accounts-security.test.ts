import { randomUUID } from "node:crypto";
import { afterAll, expect, it } from "vitest";
import {
  createPlayer,
  listPlayers,
  renamePlayer,
  setPlayerPassword,
  signInWithUsername,
  updatePlayerDetails,
} from "./accounts";
import { createAdminClient } from "./supabase-admin";
import {
  createAnonClient,
  deleteAccounts,
  makeAdmin,
  testPassword,
  testUsername,
} from "@/test/dev-accounts";

// The account security rules the UI never attempts, checked against dev.
// The e2e flow covers the everyday paths. Soft assertions report every
// broken rule in one run.
const created = new Set<string>();

afterAll(async () => {
  await deleteAccounts(created);
});

it("keeps accounts secure", async () => {
  const admin = createAdminClient();

  // A player whose metadata claims to be an admin, made directly in Auth.
  // The trigger takes the username from the email.
  const me = { username: testUsername(), password: testPassword() };
  const { data: meUser, error: meError } = await admin.auth.admin.createUser({
    email: `${me.username}@accounts.flex-idle.invalid`,
    password: me.password,
    email_confirm: true,
    app_metadata: { role: "admin" },
    user_metadata: { role: "admin" },
  });
  if (meError) throw meError;
  const meId = meUser.user.id;
  created.add(meId);

  // An admin, made through the app.
  const adminAccount = { username: testUsername(), password: testPassword() };
  const made = await createPlayer({ ...adminAccount, name: "Admin", country: "US", city: "Nashville" });
  if (!made.ok) throw new Error(made.error);
  const adminId = made.value.id;
  created.add(adminId);
  await makeAdmin(adminId);

  const { data: meProfile } = await admin.from("profiles").select("role").eq("id", meId).single();
  expect.soft(meProfile?.role, "role was taken from metadata").toBe("player");

  // Row-level security and grants, as the signed-in player.
  const client = createAnonClient();
  const signIn = await signInWithUsername(client, me.username, me.password);
  expect(signIn.ok, "player couldn't sign in").toBe(true);

  const read = await client.from("profiles").select("id");
  expect.soft(read.data, "player could read a profile other than their own").toEqual([{ id: meId }]);

  const writes = {
    "update own role": await client.from("profiles").update({ role: "admin" }).eq("id", meId),
    "update own username": await client.from("profiles").update({ username: testUsername() }).eq("id", meId),
    "insert a profile": await client.from("profiles").insert({ id: randomUUID(), username: testUsername() }),
    "delete own profile": await client.from("profiles").delete().eq("id", meId),
  };
  for (const [what, result] of Object.entries(writes)) {
    expect.soft(result.error?.code, `player could ${what}`).toBe("42501");
  }

  const anonRead = await createAnonClient().from("profiles").select("id");
  expect.soft(anonRead.error?.code, "visitors could read profiles").toBe("42501");

  const signUp = await createAnonClient().auth.signUp({
    email: `${randomUUID()}@accounts.flex-idle.invalid`,
    password: testPassword(),
  });
  if (signUp.data.user) created.add(signUp.data.user.id);
  expect.soft(signUp.data.user, "public sign-up is on; turn it off in the dashboard").toBeNull();

  // Admin accounts are out of reach of the player operations.
  const adminEdits = {
    rename: await renamePlayer(adminId, testUsername()),
    "set password": await setPlayerPassword(adminId, testPassword()),
    "edit details": await updatePlayerDetails(adminId, { name: "Hijacked", country: "US", city: "Seattle" }),
  };
  for (const [what, result] of Object.entries(adminEdits)) {
    expect.soft(result.ok, `could ${what} an admin`).toBe(false);
  }
  const { data: adminProfile } = await admin.from("profiles").select("username, name").eq("id", adminId).single();
  expect.soft(adminProfile, "admin profile changed").toEqual({ username: adminAccount.username, name: "Admin" });
  expect.soft((await listPlayers()).map((p) => p.id), "admins are listed as players").not.toContain(adminId);

  // Taken usernames, in any case.
  const taken = await createPlayer({
    username: me.username.toUpperCase(),
    password: testPassword(),
    name: "Copycat",
    country: "US",
    city: "Seattle",
  });
  if (taken.ok) created.add(taken.value.id);
  expect.soft(taken.ok, "created a player with a taken username").toBe(false);
  expect.soft((await renamePlayer(meId, adminAccount.username)).ok, "renamed to a taken username").toBe(false);

  // Invalid input, one bad value per field.
  const valid = { username: testUsername(), password: testPassword(), name: "Someone", country: "US", city: "Nashville" };
  const invalid = {
    username: { ...valid, username: "no spaces allowed" },
    password: { ...valid, password: "short" },
    name: { ...valid, name: "  " },
    "city outside its country": { ...valid, city: "Wellington" },
    country: { ...valid, country: "FR", city: "Paris" },
  };
  for (const [field, input] of Object.entries(invalid)) {
    const result = await createPlayer(input);
    if (result.ok) created.add(result.value.id);
    expect.soft(result.ok, `accepted an invalid ${field}`).toBe(false);
  }
  const badDetails = await updatePlayerDetails(meId, { name: "Me", country: "US", city: "Wellington" });
  expect.soft(badDetails.ok, "saved a city outside its country").toBe(false);

  // Sign-in doesn't reveal which usernames exist.
  const wrongPassword = await signInWithUsername(createAnonClient(), me.username, "not-the-password");
  const unknownUser = await signInWithUsername(createAnonClient(), testUsername(), me.password);
  expect.soft(wrongPassword.ok, "signed in with a wrong password").toBe(false);
  expect.soft(unknownUser, "unknown usernames get a different error").toEqual(wrongPassword);
});
