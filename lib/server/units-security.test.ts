import { afterAll, expect, it } from "vitest";
import { createPlayer, signInWithUsername } from "./accounts";
import { loadContent } from "./content";
import { buyUnit, buyUpgrade, saveClicks } from "./db-write";
import { createAdminClient } from "./supabase-admin";
import { createAnonClient, deleteAccounts, testPassword, testUsername } from "@/test/dev-accounts";

// The unit and upgrade rules the UI never attempts, checked against dev:
// players read only their own units and upgrades and none of the content
// (so locked things stay hidden), write nothing directly, can't call the
// purchase functions, and the server refuses purchases the shop wouldn't
// offer. The e2e flow covers the everyday paths.
const created = new Set<string>();

afterAll(async () => {
  await deleteAccounts(created);
});

async function newPlayer(): Promise<{ id: string; username: string; password: string }> {
  const account = { username: testUsername(), password: testPassword() };
  const made = await createPlayer({ ...account, name: "Tester", country: "NZ", city: "Wellington" });
  if (!made.ok) throw new Error(made.error);
  created.add(made.value.id);
  return { ...account, id: made.value.id };
}

// 1000 clicks are capped at 200 Gold, which buys Calloused Hands (100) and
// a Chicken (10).
async function buyStarterKit(playerId: string): Promise<void> {
  const clicks = await saveClicks(playerId, 1000);
  const hands = await buyUpgrade(playerId, "calloused_hands");
  const chicken = await buyUnit(playerId, "chicken", 1);
  if (!clicks.ok || !hands.ok || !chicken.ok) throw new Error("couldn't buy the starter kit");
}

it("keeps units and upgrades safe", async () => {
  const me = await newPlayer();
  const other = await newPlayer();
  await buyStarterKit(me.id);
  await buyStarterKit(other.id);

  // Reading, as the signed-in player and as no one.
  const client = createAnonClient();
  const signIn = await signInWithUsername(client, me.username, me.password);
  expect(signIn.ok, "player couldn't sign in").toBe(true);

  for (const table of ["player_units", "player_upgrades"]) {
    const own = await client.from(table).select("player_id").eq("player_id", me.id);
    expect.soft(own.data?.length, `player can't read their own ${table}`).toBeGreaterThan(0);

    const others = await client.from(table).select("player_id").eq("player_id", other.id);
    expect.soft(others.data, `player can read another player's ${table}`).toEqual([]);

    const anon = await createAnonClient().from(table).select("player_id");
    expect.soft(anon.error?.code, `anon can read ${table}`).toBe("42501");
  }

  for (const table of ["units", "upgrades"]) {
    const content = await client.from(table).select("id");
    expect.soft(content.error?.code, `player can read the ${table} content, locked ones included`).toBe("42501");
  }

  // Writing directly, as the player.
  const writes = {
    "insert a unit": await client.from("player_units").insert({ player_id: me.id, unit_id: "archer", owned: 1 }),
    "update units": await client.from("player_units").update({ owned: 1e6 }).eq("player_id", me.id),
    "delete units": await client.from("player_units").delete().eq("player_id", me.id),
    "insert an upgrade": await client.from("player_upgrades").insert({ player_id: me.id, upgrade_id: "corn_feed" }),
    "delete upgrades": await client.from("player_upgrades").delete().eq("player_id", me.id),
    "add content": await client.from("units").insert({ id: "t_dragon" }),
    "call buy_unit": await client.rpc("buy_unit", {
      p_player: me.id,
      p_version: 0,
      p_income_per_second: 0,
      p_max_income_seconds: 90,
      p_unit: "archer",
      p_count: 1,
      p_cost: 0.01,
    }),
    "call buy_upgrade": await client.rpc("buy_upgrade", {
      p_player: me.id,
      p_version: 0,
      p_income_per_second: 0,
      p_max_income_seconds: 90,
      p_upgrade: "corn_feed",
      p_cost: 0.01,
    }),
  };
  for (const [what, result] of Object.entries(writes)) {
    expect.soft(result.error?.code, `player could ${what}`).toBe("42501");
  }

  // The server refuses purchases the shop wouldn't offer.
  const refusals = {
    "a locked unit": [await buyUnit(me.id, "archer", 1), "locked"],
    "a unit that doesn't exist": [await buyUnit(me.id, "t_dragon", 1), "unknownItem"],
    "more units than it can afford": [await buyUnit(me.id, "chicken", 100), "cantAfford"],
    "a count the shop doesn't offer": [await buyUnit(me.id, "chicken", 7 as 1), "badAmount"],
    "an upgrade twice": [await buyUpgrade(me.id, "calloused_hands"), "alreadyBought"],
    "a locked upgrade": [await buyUpgrade(me.id, "corn_feed"), "locked"],
    "an upgrade that doesn't exist": [await buyUpgrade(me.id, "t_dragon"), "unknownItem"],
  } as const;
  for (const [what, [result, error]] of Object.entries(refusals)) {
    expect.soft(result.ok ? "bought" : result.error, `server let a player buy ${what}`).toBe(error);
  }

  // A purchase priced from stale numbers (another tab bought first) is
  // refused by the database, so the server re-reads and prices it again.
  const stale = await createAdminClient().rpc("buy_unit", {
    p_player: me.id,
    p_version: -1,
    p_income_per_second: 0,
    p_max_income_seconds: 90,
    p_unit: "chicken",
    p_count: 1,
    p_cost: 0.01,
  });
  expect.soft(stale.error?.code, "a purchase with a stale version went through").toBe("FI002");

  // Every unit and upgrade on dev parses and refers only to real things.
  await expect.soft(loadContent(me.id), "the content on dev doesn't pass its checks").resolves.toBeDefined();
});
