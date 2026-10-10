import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/server/supabase-admin";

// Helpers for tests that create real accounts on dev. Every test account's
// username starts with "t_" so leftovers are easy to spot.

export function testUsername(): string {
  return `t_${randomBytes(6).toString("hex")}`;
}

export function testPassword(): string {
  return randomBytes(12).toString("base64url");
}

// A fresh client with the publishable key and no saved session, like a
// browser that hasn't signed in.
export function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function makeAdmin(id: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteAccounts(ids: Iterable<string>): Promise<void> {
  const admin = createAdminClient();
  for (const id of ids) {
    await admin.auth.admin.deleteUser(id);
  }
}

export async function deleteAccountByUsername(username: string): Promise<void> {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (data) await deleteAccounts([data.id]);
}
