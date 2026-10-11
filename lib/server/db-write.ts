import {
  MAX_BANKED_SECONDS,
  MAX_CLICKS_PER_SAVE,
  MAX_CLICKS_PER_SECOND,
  MAX_INCOME_SECONDS,
} from "@/lib/game/clicks";
import {
  availableUpgrades,
  BUY_AMOUNTS,
  goldPerClick,
  incomePerSecond,
  maxAffordable,
  unitCost,
  unlockedUnits,
  type BuyAmount,
  type Economy,
} from "@/lib/game/economy";
import { loadContent } from "./content";
import { readProgress, type PlayerProgress } from "./progress";
import { createAdminClient } from "./supabase-admin";

// The only code that writes game data. Actions call these after checking
// the caller is the signed-in player; the values came from a browser, so
// they're checked again here. Prices and rates are worked out here from
// the player's progress and content; the database functions they call do
// the writes under a lock (see the #7 and #16 migrations). Errors are keys,
// translated under "errors" in messages/.

export type WriteError =
  | "badClicks"
  | "saveFailed"
  | "badAmount"
  | "unknownItem"
  | "locked"
  | "cantAfford"
  | "alreadyBought";

export type WriteResult<T = void> = { ok: true; value: T } | { ok: false; error: WriteError };

const fail = (error: WriteError) => ({ ok: false, error }) as const;

// Database error codes the functions raise on purpose.
const STALE = "FI002"; // Progress changed since the write was priced.
const CANT_AFFORD = "FI001";
const ALREADY_BOUGHT = "23505";

// How many times a write is priced again after another tab changed the
// player's progress first.
const ATTEMPTS = 3;

// Runs a write priced from the player's current progress. If the database
// says the progress changed in between, it reads it again and retries.
async function withProgress<T>(
  playerId: string,
  write: (economy: Economy, progress: PlayerProgress) => Promise<WriteResult<T> | "stale">,
): Promise<WriteResult<T>> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    let economy: Economy, progress: PlayerProgress;
    try {
      [economy, progress] = await Promise.all([loadContent(playerId), readProgress(createAdminClient(), playerId)]);
    } catch {
      return fail("saveFailed");
    }
    const result = await write(economy, progress);
    if (result !== "stale") return result;
  }
  return fail("saveFailed");
}

// The Gold the player will have once income is credited, as the database
// will work it out.
function goldNow(progress: PlayerProgress, income: number): number {
  const since = progress.incomeSettledAt ? (Date.now() - Date.parse(progress.incomeSettledAt)) / 1000 : 0;
  return progress.state.stats.gold + income * Math.min(Math.max(since, 0), MAX_INCOME_SECONDS);
}

// Saves a batch of clicks, capped at a believable rate, and credits units'
// income since the last save. Returns the player's new Gold.
export async function saveClicks(playerId: string, clicks: number): Promise<WriteResult<{ gold: number }>> {
  if (!Number.isInteger(clicks) || clicks < 0 || clicks > MAX_CLICKS_PER_SAVE) return fail("badClicks");

  return withProgress(playerId, async (economy, progress) => {
    const { data, error } = await createAdminClient().rpc("sync_progress", {
      p_player: playerId,
      p_version: progress.version,
      p_clicks: clicks,
      p_gold_per_click: goldPerClick(economy, progress.state),
      p_income_per_second: incomePerSecond(economy, progress.state),
      p_clicks_per_second: MAX_CLICKS_PER_SECOND,
      p_max_click_seconds: MAX_BANKED_SECONDS,
      p_max_income_seconds: MAX_INCOME_SECONDS,
    });
    if (error?.code === STALE) return "stale";
    if (error || typeof data !== "number") return fail("saveFailed");
    return { ok: true, value: { gold: data } };
  });
}

// Buys 1, 10, 100 or as many as the player can afford of an unlocked unit.
export async function buyUnit(playerId: string, unitId: string, amount: BuyAmount): Promise<WriteResult> {
  if (!BUY_AMOUNTS.includes(amount)) return fail("badAmount");

  return withProgress(playerId, async (economy, progress) => {
    const { state } = progress;
    const unit = economy.units.find((u) => u.def.id === unitId)?.def;
    if (!unit) return fail("unknownItem");
    if (!unlockedUnits(economy, state).includes(unit)) return fail("locked");

    const income = incomePerSecond(economy, state);
    const gold = goldNow(progress, income);
    const owned = state.owned[unit.id] ?? 0;
    const count = amount === "max" ? maxAffordable(unit, owned, gold) : amount;
    const cost = unitCost(unit, owned, count);
    if (count < 1 || !(cost <= gold)) return fail("cantAfford");

    const { error } = await createAdminClient().rpc("buy_unit", {
      p_player: playerId,
      p_version: progress.version,
      p_income_per_second: income,
      p_max_income_seconds: MAX_INCOME_SECONDS,
      p_unit: unit.id,
      p_count: count,
      p_cost: cost,
    });
    return result(error);
  });
}

// Buys an unlocked upgrade the player hasn't bought yet.
export async function buyUpgrade(playerId: string, upgradeId: string): Promise<WriteResult> {
  return withProgress(playerId, async (economy, progress) => {
    const { state } = progress;
    const upgrade = economy.upgrades.find((u) => u.def.id === upgradeId)?.def;
    if (!upgrade) return fail("unknownItem");
    if (state.bought.has(upgrade.id)) return fail("alreadyBought");
    if (!availableUpgrades(economy, state).includes(upgrade)) return fail("locked");

    const income = incomePerSecond(economy, state);
    if (!(upgrade.cost <= goldNow(progress, income))) return fail("cantAfford");

    const { error } = await createAdminClient().rpc("buy_upgrade", {
      p_player: playerId,
      p_version: progress.version,
      p_income_per_second: income,
      p_max_income_seconds: MAX_INCOME_SECONDS,
      p_upgrade: upgrade.id,
      p_cost: upgrade.cost,
    });
    return result(error);
  });
}

function result(error: { code: string } | null): WriteResult | "stale" {
  if (!error) return { ok: true, value: undefined };
  if (error.code === STALE) return "stale";
  if (error.code === CANT_AFFORD) return fail("cantAfford");
  if (error.code === ALREADY_BOUGHT) return fail("alreadyBought");
  return fail("saveFailed");
}

// Sets the player's resources, stats, units and upgrades back to nothing.
export async function resetProgress(playerId: string): Promise<WriteResult> {
  const { error } = await createAdminClient().rpc("reset_progress", { p_player: playerId });
  if (error) return fail("saveFailed");
  return { ok: true, value: undefined };
}
