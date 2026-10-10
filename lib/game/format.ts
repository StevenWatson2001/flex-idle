// Big numbers for display: in full up to 999,999, then two decimals and a
// suffix (1.23 M), then scientific notation (1.23e36) past the last suffix.
// The suffixes are the same in every language.

const SUFFIXES = ["M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];

export function formatAmount(amount: number, locale: string): string {
  const whole = Math.floor(amount);
  if (whole < 1e6) return new Intl.NumberFormat(locale).format(whole);

  // The exponent after rounding to 3 significant figures, so 999,999,999
  // becomes 1.00 B rather than 1000.00 M.
  const [mantissa, exponentText] = whole.toExponential(2).split("e");
  const exponent = Number(exponentText);
  const tier = Math.floor(exponent / 3);
  const suffix = SUFFIXES[tier - 2];
  if (!suffix) return `${mantissa}e${exponent}`;

  const scaled = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(whole / 1000 ** tier);
  return `${scaled} ${suffix}`;
}
