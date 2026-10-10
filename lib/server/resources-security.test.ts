import { afterAll, expect, it } from "vitest";
import { createPlayer, signInWithUsername } from "./accounts";
import { saveClicks } from "./db-write";
import { createAdminClient } from "./supabase-admin";
import { createAnonClient, deleteAccounts, testPassword, testUsername } from "@/test/dev-accounts";

// The Gold and stats rules the UI never attempts, checked against dev:
// players read only their own rows and write none directly, the database
// functions are the server's alone, and the server refuses bad click
// counts and caps believable ones. The e2e flow covers the everyday paths.
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

it("keeps Gold and stats safe", async () => {
  const me = await newPlayer();
  const other = await newPlayer();

  // Reading, as the signed-in player and as no one.
  const client = createAnonClient();
  const signIn = await signInWithUsername(client, me.username, me.password);
  expect(signIn.ok, "player couldn't sign in").toBe(true);

  for (const table of ["resources", "player_stats"]) {
    const own = await client.from(table).select("player_id").eq("player_id", me.id);
    expect.soft(own.data?.length, `player can't read their own ${table}`).toBeGreaterThan(0);

    const others = await client.from(table).select("player_id").eq("player_id", other.id);
    expect.soft(others.data, `player can read another player's ${table}`).toEqual([]);

    const anon = await createAnonClient().from(table).select("player_id");
    expect.soft(anon.error?.code, `anon can read ${table}`).toBe("42501");
  }

  // Writing directly, as the player.
  const writes = {
    "update Gold": await client.from("resources").update({ amount: 1e9 }).eq("player_id", me.id),
    "insert a resource": await client.from("resources").insert({ player_id: me.id, resource: "gold" }),
    "delete Gold": await client.from("resources").delete().eq("player_id", me.id),
    "update stats": await client.from("player_stats").update({ total_clicks: 1e9 }).eq("player_id", me.id),
    "insert stats": await client.from("player_stats").insert({ player_id: me.id }),
    "delete stats": await client.from("player_stats").delete().eq("player_id", me.id),
    "call save_clicks": await client.rpc("save_clicks", {
      p_player: me.id,
      p_clicks: 1000,
      p_gold_per_click: 1e9,
      p_clicks_per_second: 1000,
      p_max_seconds: 1000,
    }),
    "call reset_progress": await client.rpc("reset_progress", { p_player: me.id }),
  };
  for (const [what, result] of Object.entries(writes)) {
    expect.soft(result.error?.code, `player could ${what}`).toBe("42501");
  }

  // The server refuses counts no browser would send.
  for (const clicks of [-1, 1.5, Number.NaN, 1001]) {
    expect.soft((await saveClicks(me.id, clicks)).ok, `saveClicks accepted ${clicks}`).toBe(false);
  }

  // It caps believable ones at 20 clicks a second, banking at most 10
  // seconds, so a burst gets 200 and an immediate second burst almost none.
  const first = await saveClicks(me.id, 1000);
  expect.soft(first.ok && first.value.gold, "first burst wasn't capped at 200 Gold").toBe(200);
  const second = await saveClicks(me.id, 1000);
  expect.soft(second.ok && second.value.gold, "second burst wasn't capped").toBeLessThan(220);

  const { data: stats } = await createAdminClient()
    .from("player_stats")
    .select("run_clicks")
    .eq("player_id", me.id)
    .single();
  expect.soft(stats?.run_clicks, "capped clicks were counted").toBeLessThan(220);
});
