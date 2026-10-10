import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type FieldError,
  normaliseUsername,
  validateLocation,
  validateName,
  validatePassword,
  validateUsername,
} from "@/lib/accounts/rules";
import { type Language, type Theme, isLanguage, isTheme } from "@/lib/preferences";
import { createAdminClient } from "./supabase-admin";

// Account operations. Admin pages call these after checking the caller is
// an admin; every input is validated here, because it came from a browser.
// The username lives only in profiles; the Auth email is a placeholder no
// one sees, so a rename never touches Auth. Errors are keys, translated
// under "errors" in messages/ by the action that shows them.

export type AccountError =
  | FieldError
  | "wrongSignIn"
  | "usernameTaken"
  | "noSuchPlayer"
  | "createFailed"
  | "passwordFailed"
  | "deleteFailed"
  | "unknownPreference"
  | "saveFailed";

export type Result<T = void> = { ok: true; value: T } | { ok: false; error: AccountError };

export type PlayerDetails = { name: string; country: string; city: string };

export type Player = PlayerDetails & {
  id: string;
  username: string;
  createdAt: string;
};

const UNIQUE_VIOLATION = "23505";

function ok(): Result;
function ok<T>(value: T): Result<T>;
function ok<T>(value?: T): Result<T | undefined> {
  return { ok: true, value };
}

function fail(error: AccountError): { ok: false; error: AccountError } {
  return { ok: false, error };
}

function validateDetails(details: PlayerDetails): FieldError | null {
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
  if (await usernameTaken(username)) return fail("usernameTaken");

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
  if (authError) return fail("createFailed");

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
    return fail(profileError.code === UNIQUE_VIOLATION ? "usernameTaken" : "createFailed");
  }
  return ok({ id: data.user.id });
}

// Creates an admin: a player, then promoted. Only the first-admin script
// (scripts/create-admin.mjs) calls this; the app never makes admins.
export async function createAdmin(
  input: PlayerDetails & { username: string; password: string },
): Promise<Result<{ id: string }>> {
  const made = await createPlayer(input);
  if (!made.ok) return made;

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ role: "admin" }).eq("id", made.value.id);
  if (error) {
    // Don't leave a player behind who was meant to be an admin.
    await admin.auth.admin.deleteUser(made.value.id);
    return fail("createFailed");
  }
  return made;
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
  if (error?.code === UNIQUE_VIOLATION) return fail("usernameTaken");
  if (error || data.length === 0) return fail("noSuchPlayer");
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
  if (!(await getPlayer(id))) return fail("noSuchPlayer");

  const { error: authError } = await createAdminClient().auth.admin.updateUserById(id, {
    password,
  });
  return authError ? fail("passwordFailed") : ok();
}

// Deletes a player's Auth user; their profile, and everything else that
// cascades from it, goes too. Admins can't be deleted here.
export async function deletePlayer(id: string): Promise<Result> {
  if (!(await getPlayer(id))) return fail("noSuchPlayer");

  const { error } = await createAdminClient().auth.admin.deleteUser(id);
  return error ? fail("deleteFailed") : ok();
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
  if (!email) return fail("wrongSignIn");

  const { error } = await client.auth.signInWithPassword({ email, password });
  return error ? fail("wrongSignIn") : ok();
}

// Saves an account's own language and theme, and returns them once
// checked. Any role may, so there's no role filter; the caller passes the
// signed-in account's id.
export async function setPreferences(
  id: string,
  preferences: { language: string; theme: string },
): Promise<Result<{ language: Language; theme: Theme }>> {
  const { language, theme } = preferences;
  if (!isLanguage(language) || !isTheme(theme)) return fail("unknownPreference");

  const { data, error } = await createAdminClient()
    .from("profiles")
    .update({ language, theme })
    .eq("id", id)
    .select("id");
  return error || data.length === 0 ? fail("saveFailed") : ok({ language, theme });
}
