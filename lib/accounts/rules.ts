import { findCountry } from "./locations";

// Rules for account fields. Each validator returns an error message to show,
// or null when the value is fine. The server checks these on every write;
// values from the browser are never trusted.

const USERNAME = /^[a-z0-9_]{3,20}$/;

// Usernames are case-insensitive: they are stored and looked up lowercase.
export function normaliseUsername(input: string): string {
  return input.trim().toLowerCase();
}

export function validateUsername(username: string): string | null {
  return USERNAME.test(username)
    ? null
    : "Username must be 3–20 letters, digits or underscores.";
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  // Auth hashes with bcrypt, which only uses the first 72 bytes.
  if (new TextEncoder().encode(password).length > 72) {
    return "Password is too long.";
  }
  return null;
}

export function validateName(name: string): string | null {
  const length = name.trim().length;
  return length >= 1 && length <= 50 ? null : "Name must be 1–50 characters.";
}

export function validateLocation(country: string, city: string): string | null {
  const found = findCountry(country);
  if (!found) return "Choose a country.";
  if (!(found.cities as readonly string[]).includes(city)) return "Choose a city.";
  return null;
}
