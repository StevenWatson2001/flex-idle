// The languages and themes a player can choose in Settings. The database
// allows the same values (profiles.language and profiles.theme), so a new
// one needs a migration as well as an entry here.

export const LANGUAGES = ["en", "km"] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = "en";

// Each language's name in its own script, so anyone can find theirs.
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  km: "ខ្មែរ",
};

export const THEMES = ["dark", "light"] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = "dark";

export function isLanguage(value: string): value is Language {
  return (LANGUAGES as readonly string[]).includes(value);
}

export function isTheme(value: string): value is Theme {
  return (THEMES as readonly string[]).includes(value);
}

// The first supported language in an Accept-Language header, for visitors
// who haven't signed in. "km-KH;q=0.9" counts as km.
export function languageFromHeader(header: string | null): Language {
  const preferred = (header ?? "")
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { language: tag.split("-")[0].toLowerCase(), q: q === undefined ? 1 : Number(q) };
    })
    .filter((entry) => entry.q > 0)
    .sort((a, b) => b.q - a.q);
  return preferred.map((entry) => entry.language).find(isLanguage) ?? DEFAULT_LANGUAGE;
}
