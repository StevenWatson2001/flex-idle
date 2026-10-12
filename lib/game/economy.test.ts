import { describe, expect, it } from "vitest";
import type { FormulaState } from "./formula";
import {
  availableUpgrades,
  compileContent,
  goldPerClick,
  incomePerSecond,
  maxAffordable,
  unitCost,
  unitIncomes,
  unlockedUnits,
  type Content,
  type UnitDef,
  type UpgradeDef,
} from "./economy";

// The game maths: what units cost, what they earn, what clicks are worth
// and what's unlocked, all from content and a player's state.

function unit(id: string, baseCost: number, baseIncome: number, unlock: string | null): UnitDef {
  return {
    id,
    sortOrder: 0,
    rarity: "common",
    name: { en: id, km: id },
    baseCost,
    costGrowth: 1.3,
    baseIncome,
    unlock,
  };
}

function upgrade(id: string, unlock: string, effects: UpgradeDef["effects"]): UpgradeDef {
  return {
    id,
    sortOrder: 0,
    rarity: "common",
    name: { en: id, km: id },
    description: { en: id, km: id },
    cost: 100,
    unlock,
    effects,
  };
}

const content: Content = {
  units: [
    unit("chicken", 10, 0.2, null),
    unit("cattle", 120, 1.5, "owned('chicken') >= 1"),
    unit("archer", 250_000, 500, "owned('cattle') >= 1"),
  ],
  upgrades: [
    upgrade("corn_feed", "owned('chicken') >= 10", [{ target: "unit:chicken", op: "multiply", value: "2" }]),
    upgrade("bigger_coop", "owned('chicken') >= 25", [{ target: "unit:chicken", op: "multiply", value: "2" }]),
    upgrade("calloused_hands", "run_click_gold >= 100", [{ target: "click", op: "add", value: "5" }]),
    upgrade("lucky_horseshoe", "run_click_gold >= 10000", [{ target: "click", op: "add", value: "50" }]),
    // Steven's example: Archers stop earning, every unit gets +10% per Archer.
    upgrade("volley_doctrine", "owned('archer') >= 1000", [
      { target: "unit:archer", op: "multiply", value: "0" },
      { target: "units", op: "multiply", value: "1 + 0.1 * owned('archer')" },
    ]),
    upgrade("broken", "1", [{ target: "units", op: "multiply", value: "1 / 0" }]),
  ],
};

const economy = compileContent(content);

function state(owned: Record<string, number>, bought: string[], runClickGold = 0): FormulaState {
  return {
    stats: {
      gold: 0,
      run_clicks: 0,
      run_click_gold: runClickGold,
      run_gold_earned: 0,
      total_clicks: 0,
      total_gold_earned: 0,
    },
    owned,
    bought: new Set(bought),
  };
}

describe("unit costs", () => {
  const chicken = content.units[0];

  it("grow by ×1.3 for each one owned", () => {
    expect.soft(unitCost(chicken, 0, 1), "the first Chicken doesn't cost 10").toBe(10);
    expect.soft(unitCost(chicken, 9, 1), "the 10th Chicken doesn't cost 10 × 1.3^9").toBeCloseTo(106.045, 2);
    expect.soft(unitCost(chicken, 0, 10), "10 Chickens don't cost the sum of each").toBeCloseTo(426.195, 2);
  });

  it("buy as many as the Gold covers on Max", () => {
    expect.soft(maxAffordable(chicken, 0, 426.2), "Max didn't buy 10 with exactly enough").toBe(10);
    expect.soft(maxAffordable(chicken, 0, 426.1), "Max bought one it couldn't afford").toBe(9);
    expect.soft(maxAffordable(chicken, 5, 5), "Max bought one with too little Gold").toBe(0);
  });
});

describe("earnings", () => {
  it("multiplies a unit's income by each upgrade in turn", () => {
    const s = state({ chicken: 25, cattle: 2 }, ["corn_feed", "bigger_coop"]);
    expect.soft(unitIncomes(economy, s).chicken, "Chicken ×2 ×2 isn't ×4").toBeCloseTo(0.8);
    expect.soft(incomePerSecond(economy, s), "income isn't owned × income each").toBeCloseTo(25 * 0.8 + 2 * 1.5);
  });

  it("adds flat Gold per click", () => {
    const s = state({}, ["calloused_hands", "lucky_horseshoe"]);
    expect.soft(goldPerClick(economy, s), "clicks aren't worth 1 + 5 + 50").toBe(56);
  });

  it("runs effects written as formulas", () => {
    const s = state({ chicken: 10, archer: 1000 }, ["volley_doctrine"]);
    const incomes = unitIncomes(economy, s);
    expect.soft(incomes.archer, "Archers still earn").toBe(0);
    expect.soft(incomes.chicken, "Chickens didn't get +10% per Archer").toBeCloseTo(0.2 * 101);
  });

  it("ignores an effect that comes out as infinity", () => {
    const s = state({ chicken: 1 }, ["broken"]);
    expect.soft(incomePerSecond(economy, s), "a broken effect changed income").toBeCloseTo(0.2);
  });
});

describe("unlocks", () => {
  it("shows each unit once the one before it is bought", () => {
    const ids = (owned: Record<string, number>) => unlockedUnits(economy, state(owned, [])).map((u) => u.id);
    expect.soft(ids({}), "a new player doesn't see only Chicken").toEqual(["chicken"]);
    expect.soft(ids({ chicken: 1 }), "Cattle didn't unlock after a Chicken").toEqual(["chicken", "cattle"]);
  });

  it("shows upgrades whose condition is met and that aren't bought", () => {
    const s = state({ chicken: 10 }, ["corn_feed"], 150);
    const ids = availableUpgrades(economy, s).map((u) => u.id);
    expect.soft(ids, "available upgrades are wrong").toEqual(["calloused_hands", "broken"]);
  });
});

describe("content checks", () => {
  it("refuses content that refers to something missing or has a bad effect", () => {
    const bad: [string, Content][] = [
      ["an unknown unit in a target", { units: [], upgrades: [upgrade("x", "1", [{ target: "unit:dragon", op: "add", value: "1" }])] }],
      ["an unknown target", { units: [], upgrades: [upgrade("x", "1", [{ target: "favour" as "click", op: "add", value: "1" }])] }],
      ["an unknown op", { units: [], upgrades: [upgrade("x", "1", [{ target: "click", op: "pow" as "add", value: "1" }])] }],
      ["a broken formula", { units: [unit("a", 1, 1, "owned(")], upgrades: [] }],
    ];
    for (const [what, c] of bad) {
      expect.soft(() => compileContent(c), `accepted ${what}`).toThrow();
    }
  });
});
