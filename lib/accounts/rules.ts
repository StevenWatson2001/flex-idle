import { findCountry } from "./locations";

// Rules for account fields. Each validator returns the key of an error to
// show (translated under "errors" in messages/), or null when the value is
// fine. The server checks these on every write; values from the browser are
// never trusted.

export type FieldError =
  | "usernameFormat"
  | "passwordShort"
  | "passwordLong"
  | "nameLength"
  | "chooseCountry"
  | "chooseCity";

const USERNAME = /^[a-z0-9_]{3,20}$/;

// Usernames are case-insensitive: they are stored and looked up lowercase.
export function normaliseUsername(input: string): string {
  return input.trim().toLowerCase();
}

export function validateUsername(username: string): FieldError | null {
  return USERNAME.test(username) ? null : "usernameFormat";
}

export function validatePassword(password: string): FieldError | null {
  if (password.length < 8) return "passwordShort";
  // Auth hashes with bcrypt, which only uses the first 72 bytes.
  if (new TextEncoder().encode(password).length > 72) return "passwordLong";
  return null;
}

export function validateName(name: string): FieldError | null {
  const length = name.trim().length;
  return length >= 1 && length <= 50 ? null : "nameLength";
}

export function validateLocation(country: string, city: string): FieldError | null {
  const found = findCountry(country);
  if (!found) return "chooseCountry";
  if (!(found.cities as readonly string[]).includes(city)) return "chooseCity";
  return null;
}
