// The countries and cities a player can be from. A small sample for now;
// the dropdowns and server validation both read this list.
export const COUNTRIES = [
  { code: "US", cities: ["Nashville", "New York", "Seattle"] },
  { code: "NZ", cities: ["Wellington", "Auckland", "Christchurch"] },
  { code: "GB", cities: ["London", "Manchester", "Edinburgh"] },
  { code: "AU", cities: ["Sydney", "Melbourne", "Brisbane"] },
] as const;

export type Country = (typeof COUNTRIES)[number];

export function findCountry(code: string): Country | undefined {
  return COUNTRIES.find((country) => country.code === code);
}

// A country's name in the given language, e.g. "New Zealand" in English.
export function countryName(code: string, locale: string): string {
  return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
}

// The countries with their names in the given language, for the dropdowns.
export function localisedCountries(locale: string): { code: string; name: string; cities: readonly string[] }[] {
  return COUNTRIES.map((country) => ({ ...country, name: countryName(country.code, locale) }));
}

// "Wellington, New Zealand", or whatever is known when details are missing.
// City names aren't translated.
export function formatLocation(country: string | null, city: string | null, locale: string): string {
  return [city, country ? countryName(country, locale) : null].filter(Boolean).join(", ");
}
