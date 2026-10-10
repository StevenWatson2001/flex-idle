import { afterAll, expect, it } from "vitest";
import { createPlayer, setPreferences, signInWithUsername } from "./accounts";
import { createAdminClient } from "./supabase-admin";
import { createAnonClient, deleteAccounts, testPassword, testUsername } from "@/test/dev-accounts";

// The preference rules the UI never attempts, checked against dev: players
// can't write their own preferences directly, and the server refuses
// values it doesn't know. The e2e flow covers saving them.
const created = new Set<string>();

afterAll(async () => {
  await deleteAccounts(created);
});

it("keeps preferences safe", async () => {
  const me = { username: testUsername(), password: testPassword() };
  const made = await createPlayer({ ...me, name: "Me", country: "NZ", city: "Wellington" });
  if (!made.ok) throw new Error(made.error);
  const meId = made.value.id;
  created.add(meId);

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

  const { data } = await createAdminClient()
    .from("profiles")
    .select("language, theme")
    .eq("id", meId)
    .single();
  expect.soft(data, "refused preferences were saved anyway").toEqual({ language: "en", theme: "dark" });
});
