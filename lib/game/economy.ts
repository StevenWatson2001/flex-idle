import { GOLD_PER_CLICK } from "./clicks";
import { compileFormula, FormulaError, truthy, type Formula, type FormulaState, type KnownIds } from "./formula";

// The game maths: what units cost and earn, what a click is worth, and
// what's unlocked, worked out from the content (units and upgrades, see
// docs/content.md) and a player's state. The server decides with these;
// the browser uses the cost maths only to show prices.

export const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"] as const;
export type Rarity = (typeof RARITIES)[number];

// The amounts the shop sells units in.
export const BUY_AMOUNTS = [1, 10, 100, "max"] as const;
export type BuyAmount = (typeof BUY_AMOUNTS)[number];

// The most units one purchase can buy, so Max stays a sensible number.
const MAX_BUY = 1_000_000;

// Rates stop here rather than reaching infinity, which broken content could.
const MAX_RATE = 1e300;

export type LocalText = { en: string; km: string };

export type UnitDef = {
  id: string;
  sortOrder: number;
  rarity: Rarity;
  name: LocalText;
  baseCost: number;
  costGrowth: number;
  baseIncome: number;
  // A formula; null means always unlocked.
  unlock: string | null;
};

// What an upgrade changes: Gold per click, every unit's income, or one
// unit's income ("unit:<id>"), by adding or multiplying a formula's value.
export type Effect = {
  target: "click" | "units" | `unit:${string}`;
  op: "add" | "multiply";
  value: string;
};

export type UpgradeDef = {
  id: string;
  sortOrder: number;
  rarity: Rarity;
  name: LocalText;
  description: LocalText;
  cost: number;
  unlock: string | null;
  effects: Effect[];
};

export type Content = { units: UnitDef[]; upgrades: UpgradeDef[] };

type CompiledEffect = { target: string; op: "add" | "multiply"; value: Formula };

// Content with every formula compiled and checked.
export type Economy = {
  units: { def: UnitDef; unlock: Formula | null }[];
  upgrades: { def: UpgradeDef; unlock: Formula | null; effects: CompiledEffect[] }[];
};

// Compiles and checks content, throwing on anything that refers to a unit,
// upgrade, stat, target or op that doesn't exist.
export function compileContent(content: Content): Economy {
  const known: KnownIds = {
    units: new Set(content.units.map((u) => u.id)),
    upgrades: new Set(content.upgrades.map((u) => u.id)),
  };
  const compile = (source: string | null, where: string) => {
    if (source === null) return null;
    try {
      return compileFormula(source, known);
    } catch (error) {
      throw new FormulaError(`${where}: ${(error as Error).message}`);
    }
  };
  const bySortOrder = <T extends { sortOrder: number }>(items: T[]) =>
    [...items].sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    units: bySortOrder(content.units).map((def) => ({ def, unlock: compile(def.unlock, `unit ${def.id}`) })),
    upgrades: bySortOrder(content.upgrades).map((def) => ({
      def,
      unlock: compile(def.unlock, `upgrade ${def.id}`),
      effects: def.effects.map((effect, i) => {
        const where = `upgrade ${def.id} effect ${i + 1}`;
        const unitId = effect.target.startsWith("unit:") ? effect.target.slice(5) : null;
        if (unitId === null ? effect.target !== "click" && effect.target !== "units" : !known.units.has(unitId)) {
          throw new FormulaError(`${where}: unknown target "${effect.target}"`);
        }
        if (effect.op !== "add" && effect.op !== "multiply") {
          throw new FormulaError(`${where}: unknown op "${effect.op}"`);
        }
        return { target: effect.target, op: effect.op, value: compile(effect.value, where)! };
      }),
    })),
  };
}

// A finite, non-negative rate.
function rate(value: number): number {
  if (Number.isNaN(value) || value <= 0) return 0;
  return Math.min(value, MAX_RATE);
}

type Modifier = { add: number; multiply: number };

// What the player's bought upgrades add to and multiply each target by.
// An effect that comes out as NaN or infinity is ignored.
function modifiers(economy: Economy, state: FormulaState): Map<string, Modifier> {
  const result = new Map<string, Modifier>();
  for (const upgrade of economy.upgrades) {
    if (!state.bought.has(upgrade.def.id)) continue;
    for (const effect of upgrade.effects) {
      const value = effect.value(state);
      if (!Number.isFinite(value)) continue;
      const modifier = result.get(effect.target) ?? { add: 0, multiply: 1 };
      if (effect.op === "add") modifier.add += value;
      else modifier.multiply *= value;
      result.set(effect.target, modifier);
    }
  }
  return result;
}

const NONE: Modifier = { add: 0, multiply: 1 };

export function goldPerClick(economy: Economy, state: FormulaState): number {
  const click = modifiers(economy, state).get("click") ?? NONE;
  return rate((GOLD_PER_CLICK + click.add) * click.multiply);
}

// Each unit's income, per unit owned, in Gold a second.
export function unitIncomes(economy: Economy, state: FormulaState): Record<string, number> {
  const all = modifiers(economy, state);
  const units = all.get("units") ?? NONE;
  const incomes: Record<string, number> = {};
  for (const { def } of economy.units) {
    const own = all.get(`unit:${def.id}`) ?? NONE;
    incomes[def.id] = rate((def.baseIncome + own.add + units.add) * own.multiply * units.multiply);
  }
  return incomes;
}

export function incomePerSecond(economy: Economy, state: FormulaState): number {
  const incomes = unitIncomes(economy, state);
  return rate(economy.units.reduce((sum, { def }) => sum + (state.owned[def.id] ?? 0) * incomes[def.id], 0));
}

// What the next `count` units cost with `owned` already owned: each costs
// costGrowth times the one before.
export function unitCost(unit: Pick<UnitDef, "baseCost" | "costGrowth">, owned: number, count: number): number {
  const g = unit.costGrowth;
  return (unit.baseCost * g ** owned * (g ** count - 1)) / (g - 1);
}

// How many units `gold` buys at once.
export function maxAffordable(unit: Pick<UnitDef, "baseCost" | "costGrowth">, owned: number, gold: number): number {
  const g = unit.costGrowth;
  const first = unit.baseCost * g ** owned;
  if (!(gold >= first)) return 0;
  let count = Math.min(MAX_BUY, Math.floor(Math.log((gold * (g - 1)) / first + 1) / Math.log(g)));
  // The logarithm can land one either side of the true answer.
  while (count > 0 && unitCost(unit, owned, count) > gold) count--;
  while (count < MAX_BUY && unitCost(unit, owned, count + 1) <= gold) count++;
  return count;
}

const isUnlocked = (unlock: Formula | null, state: FormulaState) => unlock === null || truthy(unlock(state));

export function unlockedUnits(economy: Economy, state: FormulaState): UnitDef[] {
  return economy.units.filter((u) => isUnlocked(u.unlock, state)).map((u) => u.def);
}

// Upgrades the player can buy now: unlocked and not yet bought.
export function availableUpgrades(economy: Economy, state: FormulaState): UpgradeDef[] {
  return economy.upgrades
    .filter((u) => !state.bought.has(u.def.id) && isUnlocked(u.unlock, state))
    .map((u) => u.def);
}
