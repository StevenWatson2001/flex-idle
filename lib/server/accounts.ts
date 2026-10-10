import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normaliseUsername,
  validateLocation,
  validateName,
  validatePassword,
  validateUsername,
} from "@/lib/accounts/rules";
import { createAdminClient } from "./supabase-admin";

// Account operations. Admin pages call these after checking the caller is
// an admin; every input is validated here, because it came from a browser.
// The username lives only in profiles; the Auth email is a placeholder no
// one sees, so a rename never touches Auth.

export type Result<T = void> = { ok: true; value: T } | { ok: false; error: string };

export type PlayerDetails = { name: string; country: string; city: string };

export type Player = PlayerDetails & {
  id: string;
  username: string;
  createdAt: string;
};

const WRONG_SIGN_IN = "Wrong username or password.";
const TAKEN = "That username is taken.";
const NO_SUCH_PLAYER = "No such player.";
const UNIQUE_VIOLATION = "23505";

function ok(): Result;
function ok<T>(value: T): Result<T>;
function ok<T>(value?: T): Result<T | undefined> {
  return { ok: true, value };
}

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function validateDetails(details: PlayerDetails): string | null {
  return validateName(details.name) ?? validateLocation(details.country, details.city);
}

async function usernameTaken(username: string): Promise<boolean> {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  return data !== null;
}

export async function createPlayer(
  input: PlayerDetails & { username: string; password: string },
): Promise<Result<{ id: string }>> {
  const username = normaliseUsername(input.username);
  const error =
    validateUsername(username) ?? validatePassword(input.password) ?? validateDetails(input);
  if (error) return fail(error);
  if (await usernameTaken(username)) return fail(TAKEN);

  // Auth writes app_metadata after inserting the user, so the profile
  // trigger only sees the email and takes the username from it. Give it a
  // random placeholder, then set the real fields on the new profile.
  const admin = createAdminClient();
  const placeholder = `new_${randomBytes(8).toString("hex")}`;
  const { data, error: authError } = await admin.auth.admin.createUser({
    email: `${placeholder}@accounts.flex-idle.invalid`,
    password: input.password,
    email_confirm: true,
  });
  if (authError) return fail("Couldn't create the player.");

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      username,
      name: input.name.trim(),
      country: input.country,
      city: input.city,
    })
    .eq("id", data.user.id);
  if (profileError) {
    // Don't leave a half-made account behind.
    await admin.auth.admin.deleteUser(data.user.id);
    return fail(profileError.code === UNIQUE_VIOLATION ? TAKEN : "Couldn't create the player.");
  }
  return ok({ id: data.user.id });
}

export async function listPlayers(): Promise<Player[]> {
  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("id, username, name, country, city, created_at")
    .eq("role", "player")
    .order("created_at");
  if (error) throw error;
  return data.map(toPlayer);
}

export async function getPlayer(id: string): Promise<Player | null> {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id, username, name, country, city, created_at")
    .eq("id", id)
    .eq("role", "player")
    .maybeSingle();
  return data ? toPlayer(data) : null;
}

function toPlayer(row: {
  id: string;
  username: string;
  name: string | null;
  country: string | null;
  city: string | null;
  created_at: string;
}): Player {
  return {
    id: row.id,
    username: row.username,
    name: row.name ?? "",
    country: row.country ?? "",
    city: row.city ?? "",
    createdAt: row.created_at,
  };
}

// Updates a player's profile row. The role filter means admins can't be
// edited here, and an unknown or admin id matches no row.
async function updatePlayerRow(
  id: string,
  changes: Partial<PlayerDetails & { username: string }>,
): Promise<Result> {
  const { data, error } = await createAdminClient()
    .from("profiles")
    .update(changes)
    .eq("id", id)
    .eq("role", "player")
    .select("id");
  if (error?.code === UNIQUE_VIOLATION) return fail(TAKEN);
  if (error || data.length === 0) return fail(NO_SUCH_PLAYER);
  return ok();
}

export async function renamePlayer(id: string, input: string): Promise<Result> {
  const username = normaliseUsername(input);
  const error = validateUsername(username);
  if (error) return fail(error);
  return updatePlayerRow(id, { username });
}

export async function updatePlayerDetails(id: string, details: PlayerDetails): Promise<Result> {
  const error = validateDetails(details);
  if (error) return fail(error);
  return updatePlayerRow(id, {
    name: details.name.trim(),
    country: details.country,
    city: details.city,
  });
}

export async function setPlayerPassword(id: string, password: string): Promise<Result> {
  const error = validatePassword(password);
  if (error) return fail(error);
  if (!(await getPlayer(id))) return fail(NO_SUCH_PLAYER);

  const { error: authError } = await createAdminClient().auth.admin.updateUserById(id, {
    password,
  });
  return authError ? fail("Couldn't set the password.") : ok();
}

// The placeholder email Auth knows this account by, or null if there's no
// such username.
export async function signInEmailFor(input: string): Promise<string | null> {
  const username = normaliseUsername(input);
  if (validateUsername(username)) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (!profile) return null;

  const { data } = await admin.auth.admin.getUserById(profile.id);
  return data.user?.email ?? null;
}

// Signs `client` in. Pass the session client so the session lands in the
// browser's cookies. Every failure gives the same message, so it doesn't
// reveal which usernames exist.
export async function signInWithUsername(
  client: SupabaseClient,
  username: string,
  password: string,
): Promise<Result> {
  const email = await signInEmailFor(username);
  if (!email) return fail(WRONG_SIGN_IN);

  const { error } = await client.auth.signInWithPassword({ email, password });
  return error ? fail(WRONG_SIGN_IN) : ok();
}
