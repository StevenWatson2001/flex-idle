import { afterAll, describe, expect, it } from "vitest";
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

// These tests create real accounts on the dev database and delete them
// afterwards.
const created = new Set<string>();

afterAll(async () => {
  await deleteAccounts(created);
});

async function newPlayer(
  overrides: Partial<Parameters<typeof createPlayer>[0]> = {},
) {
  const input = {
    username: testUsername(),
    password: testPassword(),
    name: "Test Player",
    country: "US",
    city: "Nashville",
    ...overrides,
  };
  const result = await createPlayer(input);
  if (!result.ok) throw new Error(result.error);
  created.add(result.value.id);
  return { ...input, id: result.value.id };
}

async function profileOf(id: string) {
  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("username, name, country, city, role")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

async function canSignIn(username: string, password: string) {
  const result = await signInWithUsername(createAnonClient(), username, password);
  return result.ok;
}

describe("createPlayer", () => {
  it("creates a player profile with the username and details", async () => {
    const player = await newPlayer({ name: "Kiri", country: "NZ", city: "Wellington" });

    expect(await profileOf(player.id)).toEqual({
      username: player.username,
      name: "Kiri",
      country: "NZ",
      city: "Wellington",
      role: "player",
    });
  });

  it("stores the username lowercase, whatever case the admin typed", async () => {
    const username = testUsername();
    const player = await newPlayer({ username: ` ${username.toUpperCase()} ` });

    expect((await profileOf(player.id)).username).toBe(username);
  });

  it("rejects a username that is already taken, in any case", async () => {
    const player = await newPlayer();

    const result = await createPlayer({
      username: player.username.toUpperCase(),
      password: testPassword(),
      name: "Copycat",
      country: "US",
      city: "Seattle",
    });

    expect(result).toEqual({ ok: false, error: expect.any(String) });
  });

  it("rejects invalid input without creating anything", async () => {
    const valid = {
      username: testUsername(),
      password: testPassword(),
      name: "Someone",
      country: "US",
      city: "Nashville",
    };

    for (const bad of [
      { username: "no spaces allowed" },
      { password: "short" },
      { name: "  " },
      { country: "US", city: "Wellington" },
      { country: "FR", city: "Paris" },
    ]) {
      const result = await createPlayer({ ...valid, ...bad });
      expect(result.ok, JSON.stringify(bad)).toBe(false);
    }

    const { data } = await createAdminClient()
      .from("profiles")
      .select("id")
      .eq("username", valid.username);
    expect(data).toEqual([]);
  });
});

describe("signInWithUsername", () => {
  it("signs in with any capitalisation of the username", async () => {
    const player = await newPlayer();

    expect(await canSignIn(player.username, player.password)).toBe(true);
    expect(await canSignIn(player.username.toUpperCase(), player.password)).toBe(true);
    expect(await canSignIn(` ${player.username} `, player.password)).toBe(true);
  });

  it("gives the same error for a wrong password and an unknown username", async () => {
    const player = await newPlayer();

    const wrongPassword = await signInWithUsername(
      createAnonClient(),
      player.username,
      "not-the-password",
    );
    const unknownUser = await signInWithUsername(
      createAnonClient(),
      testUsername(),
      player.password,
    );

    expect(wrongPassword).toEqual({ ok: false, error: "Wrong username or password." });
    expect(unknownUser).toEqual(wrongPassword);
  });
});

describe("renamePlayer", () => {
  it("changes the username the player signs in with", async () => {
    const player = await newPlayer();
    const newName = testUsername();

    const result = await renamePlayer(player.id, newName.toUpperCase());

    expect(result).toEqual({ ok: true, value: undefined });
    expect((await profileOf(player.id)).username).toBe(newName);
    expect(await canSignIn(newName, player.password)).toBe(true);
    expect(await canSignIn(player.username, player.password)).toBe(false);
  });

  it("rejects a username that is taken or invalid", async () => {
    const first = await newPlayer();
    const second = await newPlayer();

    expect((await renamePlayer(second.id, first.username)).ok).toBe(false);
    expect((await renamePlayer(second.id, "x")).ok).toBe(false);
    expect((await profileOf(second.id)).username).toBe(second.username);
  });
});

describe("updatePlayerDetails", () => {
  it("changes the name, country and city", async () => {
    const player = await newPlayer();

    const result = await updatePlayerDetails(player.id, {
      name: "  Renamed  ",
      country: "NZ",
      city: "Wellington",
    });

    expect(result.ok).toBe(true);
    expect(await profileOf(player.id)).toMatchObject({
      name: "Renamed",
      country: "NZ",
      city: "Wellington",
    });
  });

  it("rejects a city that isn't in the country", async () => {
    const player = await newPlayer();

    const result = await updatePlayerDetails(player.id, {
      name: "Test Player",
      country: "US",
      city: "Wellington",
    });

    expect(result.ok).toBe(false);
    expect(await profileOf(player.id)).toMatchObject({ country: "US", city: "Nashville" });
  });
});

describe("setPlayerPassword", () => {
  it("replaces the password", async () => {
    const player = await newPlayer();
    const newPassword = testPassword();

    expect((await setPlayerPassword(player.id, newPassword)).ok).toBe(true);
    expect(await canSignIn(player.username, newPassword)).toBe(true);
    expect(await canSignIn(player.username, player.password)).toBe(false);
  });

  it("rejects a password under 8 characters", async () => {
    const player = await newPlayer();

    expect((await setPlayerPassword(player.id, "short")).ok).toBe(false);
    expect(await canSignIn(player.username, player.password)).toBe(true);
  });
});

describe("admin accounts", () => {
  it("can't be edited through the player operations", async () => {
    const admin = await newPlayer();
    await makeAdmin(admin.id);

    expect((await renamePlayer(admin.id, testUsername())).ok).toBe(false);
    expect((await setPlayerPassword(admin.id, testPassword())).ok).toBe(false);
    expect(
      (
        await updatePlayerDetails(admin.id, {
          name: "Hijacked",
          country: "US",
          city: "Seattle",
        })
      ).ok,
    ).toBe(false);
    expect(await profileOf(admin.id)).toMatchObject({
      username: admin.username,
      name: "Test Player",
      role: "admin",
    });
    expect(await canSignIn(admin.username, admin.password)).toBe(true);
  });

  it("aren't listed with the players", async () => {
    const admin = await newPlayer();
    await makeAdmin(admin.id);
    const player = await newPlayer();

    const ids = (await listPlayers()).map((p) => p.id);

    expect(ids).toContain(player.id);
    expect(ids).not.toContain(admin.id);
  });
});
