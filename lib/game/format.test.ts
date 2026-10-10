import { expect, it } from "vitest";
import { formatAmount } from "./format";

// Big numbers stay readable: in full up to 999,999, then with a suffix,
// then in scientific notation past the last suffix.
it("formats amounts", () => {
  const cases: [number, string][] = [
    [0, "0"],
    [999_999, "999,999"],
    [1_234_567, "1.23 M"],
    [999_999_999, "1.00 B"],
    [1.5e33, "1.50 Dc"],
    [1e36, "1.00e36"],
  ];
  for (const [amount, expected] of cases) {
    expect.soft(formatAmount(amount, "en"), `${amount} formatted wrongly`).toBe(expected);
  }
});
