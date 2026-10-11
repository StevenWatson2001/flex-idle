import { describe, expect, it } from "vitest";
import { compileFormula, type FormulaState } from "./formula";

// The formula language units and upgrades are written in: arithmetic,
// comparisons and logic over a player's stats, units and upgrades. Content
// referring to anything that doesn't exist must fail when it's loaded, not
// when a player meets it.
const known = { units: new Set(["chicken", "archer"]), upgrades: new Set(["corn_feed"]) };

const state: FormulaState = {
  stats: {
    gold: 50,
    run_clicks: 12,
    run_click_gold: 120,
    run_gold_earned: 900,
    total_clicks: 40,
    total_gold_earned: 5000,
  },
  owned: { chicken: 10 },
  bought: new Set(["corn_feed"]),
};

function run(source: string): number {
  return compileFormula(source, known)(state);
}

describe("formulas", () => {
  it("does arithmetic in the usual order", () => {
    expect.soft(run("1 + 2 * 3 ^ 2"), "* and ^ didn't bind tighter than +").toBe(19);
    expect.soft(run("(1 + 2) * 3"), "brackets were ignored").toBe(9);
    expect.soft(run("10 / 4 - 0.5"), "division or decimals are wrong").toBe(2);
    expect.soft(run("-2 ^ 2"), "unary minus bound tighter than ^").toBe(-4);
    expect.soft(run("2 ^ 3 ^ 2"), "^ isn't right-associative").toBe(512);
  });

  it("reads stats, units owned and upgrades bought", () => {
    expect.soft(run("run_click_gold >= 100"), "a stat comparison is wrong").toBe(1);
    expect.soft(run("owned('chicken') * 2 + owned('archer')"), "owned() is wrong").toBe(20);
    expect.soft(run("bought('corn_feed') and not (gold > 50)"), "bought(), and, not or > is wrong").toBe(1);
    expect.soft(run("owned('archer') >= 1 or total_clicks == 40"), "or or == is wrong").toBe(1);
    expect.soft(run("owned('chicken') != 10"), "!= is wrong").toBe(0);
  });

  it("has min, max, floor and log10", () => {
    expect.soft(run("min(3, 1, 2) + max(4, 5)"), "min or max is wrong").toBe(6);
    expect.soft(run("floor(2.7) + log10(1000)"), "floor or log10 is wrong").toBe(5);
  });

  it("refuses formulas that are broken or refer to things that don't exist", () => {
    for (const source of [
      "",
      "1 +",
      "2 3",
      "(1 + 2",
      "dragons + 1",
      "owned('dragon')",
      "bought('dragon')",
      "owned(chicken)",
      "'chicken'",
      "floor(1, 2)",
      "launch_missiles()",
      "1; drop table units",
      // Longer than any real formula: 501 characters.
      `${"1+".repeat(250)}1`,
    ]) {
      expect.soft(() => compileFormula(source, known), `accepted ${JSON.stringify(source.slice(0, 40))}`).toThrow();
    }
  });
});
