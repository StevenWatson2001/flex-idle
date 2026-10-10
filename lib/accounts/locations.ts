// The countries and cities a player can be from. A small sample for now;
// the dropdowns and server validation both read this list.
export const COUNTRIES = [
  { code: "US", name: "United States", cities: ["Nashville", "New York", "Seattle"] },
  { code: "NZ", name: "New Zealand", cities: ["Wellington", "Auckland", "Christchurch"] },
  { code: "GB", name: "United Kingdom", cities: ["London", "Manchester", "Edinburgh"] },
  { code: "AU", name: "Australia", cities: ["Sydney", "Melbourne", "Brisbane"] },
] as const;

export type Country = (typeof COUNTRIES)[number];

export function findCountry(code: string): Country | undefined {
  return COUNTRIES.find((country) => country.code === code);
}

// "Wellington, New Zealand", or whatever is known when details are missing.
export function formatLocation(country: string | null, city: string | null): string {
  const countryName = country ? (findCountry(country)?.name ?? country) : null;
  return [city, countryName].filter(Boolean).join(", ");
}
