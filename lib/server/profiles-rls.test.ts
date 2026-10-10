import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createPlayer } from "./accounts";
import { createAdminClient } from "./supabase-admin";
import {
  createAnonClient,
  deleteAccounts,
  testPassword,
  testUsername,
} from "@/test/dev-accounts";

// Database rules for the profiles table, checked against dev: the trigger
// that creates profiles, row-level security and grants.
const created = new Set<string>();

afterAll(async () => {
  await deleteAccounts(created);
});

function testEmail() {
  return `${randomUUID()}@accounts.flex-idle.invalid`;
}

async function newPlayer() {
  const input = {
    username: testUsername(),
    password: testPassword(),
    name: "Test Player",
    country: "GB",
    city: "London",
  };
  const result = await createPlayer(input);
  if (!result.ok) throw new Error(result.error);
  created.add(result.value.id);
  return { ...input, id: result.value.id };
}

async function signedInAs(player: { username: string; password: string; id: string }) {
  const { data } = await createAdminClient().auth.admin.getUserById(player.id);
  const client = createAnonClient();
  const { error } = await client.auth.signInWithPassword({
    email: data.user!.email!,
    password: player.password,
  });
  if (error) throw error;
  return client;
}

describe("profile trigger", () => {
  it("never takes the role from user metadata", async () => {
    const username = testUsername();
    const { data, error } = await createAdminClient().auth.admin.createUser({
      email: testEmail(),
      password: testPassword(),
      email_confirm: true,
      app_metadata: { username, role: "admin" },
      user_metadata: { role: "admin" },
    });
    expect(error).toBeNull();
    created.add(data.user!.id);

    const profile = await createAdminClient()
      .from("profiles")
      .select("username, role")
      .eq("id", data.user!.id)
      .single();
    expect(profile.data).toEqual({ username, role: "player" });
  });

  it("uses the email's local part when no username is given, as for a dashboard-made admin", async () => {
    const username = testUsername();
    const { data, error } = await createAdminClient().auth.admin.createUser({
      email: `${username}@flex-idle.invalid`,
      password: testPassword(),
      email_confirm: true,
    });
    expect(error).toBeNull();
    created.add(data.user!.id);

    const profile = await createAdminClient()
      .from("profiles")
      .select("username, name, country, city, role")
      .eq("id", data.user!.id)
      .single();
    expect(profile.data).toEqual({
      username,
      name: null,
      country: null,
      city: null,
      role: "player",
    });
  });

  it("fails the whole sign-up when the username is taken, leaving no Auth user", async () => {
    const player = await newPlayer();
    const admin = createAdminClient().auth.admin;
    const email = testEmail();

    const duplicate = await admin.createUser({
      email,
      password: testPassword(),
      email_confirm: true,
      app_metadata: { username: player.username },
    });
    expect(duplicate.error).not.toBeNull();

    // If the failed attempt had left an Auth user, this email would be taken.
    const retry = await admin.createUser({
      email,
      password: testPassword(),
      email_confirm: true,
      app_metadata: { username: testUsername() },
    });
    expect(retry.error).toBeNull();
    created.add(retry.data.user!.id);
  });
});

describe("profiles access", () => {
  it("lets a signed-in player read only their own profile", async () => {
    const me = await newPlayer();
    await newPlayer();

    const client = await signedInAs(me);
    const { data, error } = await client.from("profiles").select("id, username");

    expect(error).toBeNull();
    expect(data).toEqual([{ id: me.id, username: me.username }]);
  });

  it("doesn't let a player change any profile, including their own role", async () => {
    const me = await newPlayer();
    const client = await signedInAs(me);

    const role = await client.from("profiles").update({ role: "admin" }).eq("id", me.id);
    const username = await client
      .from("profiles")
      .update({ username: testUsername() })
      .eq("id", me.id);
    const insert = await client
      .from("profiles")
      .insert({ id: randomUUID(), username: testUsername() });
    const remove = await client.from("profiles").delete().eq("id", me.id);

    expect(role.error?.code).toBe("42501");
    expect(username.error?.code).toBe("42501");
    expect(insert.error?.code).toBe("42501");
    expect(remove.error?.code).toBe("42501");

    const { data } = await createAdminClient()
      .from("profiles")
      .select("username, role")
      .eq("id", me.id)
      .single();
    expect(data).toEqual({ username: me.username, role: "player" });
  });

  it("hides profiles from visitors who aren't signed in", async () => {
    const { error } = await createAnonClient().from("profiles").select("id");

    expect(error?.code).toBe("42501");
  });
});

describe("public sign-up", () => {
  it("is turned off, so only an admin can create accounts", async () => {
    const { data, error } = await createAnonClient().auth.signUp({
      email: testEmail(),
      password: testPassword(),
    });
    if (data.user) created.add(data.user.id);

    expect(error).not.toBeNull();
    expect(data.user).toBeNull();
  });
});
