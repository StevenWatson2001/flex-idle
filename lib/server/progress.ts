import type { SupabaseClient } from "@supabase/supabase-js";
import {
  availableUpgrades,
  goldPerClick,
  incomePerSecond,
  unitIncomes,
  unlockedUnits,
  type Economy,
  type LocalText,
} from "@/lib/game/economy";
import type { FormulaState } from "@/lib/game/formula";
import { loadContent } from "./content";
import { createSessionClient } from "./session";

// Reads a player's progress. Pages read the signed-in player's as that
// player, so RLS means they can only ever be their own; db-write.ts reads
// with the secret key before it writes.

export type Stats = {
  runClicks: number;
  runGoldEarned: number;
  totalClicks: number;
  totalGoldEarned: number;
};

export async function getStats(playerId: string): Promise<Stats> {
  const { data, error } = await (await createSessionClient())
    .from("player_stats")
    .select("run_clicks, run_gold_earned, total_clicks, total_gold_earned")
    .eq("player_id", playerId)
    .single();
  if (error) throw new Error(`Couldn't read stats: ${error.message}`);
  return {
    runClicks: data.run_clicks,
    runGoldEarned: data.run_gold_earned,
    totalClicks: data.total_clicks,
    totalGoldEarned: data.total_gold_earned,
  };
}

// Everything the game maths needs about a player, plus the version a write
// passes back to prove it was priced from this progress.
export type PlayerProgress = {
  state: FormulaState;
  version: number;
  incomeSettledAt: string | null;
};

export async function readProgress(client: Pick<SupabaseClient, "from">, playerId: string): Promise<PlayerProgress> {
  const [gold, stats, units, upgrades] = await Promise.all([
    client.from("resources").select("amount").eq("player_id", playerId).eq("resource", "gold").single(),
    client
      .from("player_stats")
      .select(
        "run_clicks, run_click_gold, run_gold_earned, total_clicks, total_gold_earned, income_settled_at, progress_version",
      )
      .eq("player_id", playerId)
      .single(),
    client.from("player_units").select("unit_id, owned").eq("player_id", playerId),
    client.from("player_upgrades").select("upgrade_id").eq("player_id", playerId),
  ]);
  for (const { error } of [gold, stats, units, upgrades]) {
    if (error) throw new Error(`Couldn't read progress: ${error.message}`);
  }
  if (!gold.data || !stats.data || !units.data || !upgrades.data) throw new Error("Couldn't read progress");

  return {
    state: {
      stats: {
        gold: gold.data.amount,
        run_clicks: stats.data.run_clicks,
        run_click_gold: stats.data.run_click_gold,
        run_gold_earned: stats.data.run_gold_earned,
        total_clicks: stats.data.total_clicks,
        total_gold_earned: stats.data.total_gold_earned,
      },
      owned: Object.fromEntries(units.data.map((row) => [row.unit_id, row.owned])),
      bought: new Set(upgrades.data.map((row) => row.upgrade_id)),
    },
    version: stats.data.progress_version,
    incomeSettledAt: stats.data.income_settled_at,
  };
}

// What the Play page shows: Gold, earnings, and the shop, holding only
// what's unlocked or bought, in the player's language.
export type ShopUnit = {
  id: string;
  name: string;
  owned: number;
  baseCost: number;
  costGrowth: number;
  incomeEach: number;
};

export type ShopUpgrade = { id: string; name: string; description: string; cost: number };

export type GameSnapshot = {
  gold: number;
  goldPerClick: number;
  incomePerSecond: number;
  units: ShopUnit[];
  // Available upgrades, cheapest first.
  upgrades: ShopUpgrade[];
  bought: ShopUpgrade[];
};

export function toSnapshot(economy: Economy, progress: PlayerProgress, locale: string): GameSnapshot {
  const { state } = progress;
  const text = (t: LocalText) => (locale === "km" ? t.km : t.en);
  const incomes = unitIncomes(economy, state);
  const upgrade = (u: { id: string; name: LocalText; description: LocalText; cost: number }) => ({
    id: u.id,
    name: text(u.name),
    description: text(u.description),
    cost: u.cost,
  });

  return {
    gold: state.stats.gold,
    goldPerClick: goldPerClick(economy, state),
    incomePerSecond: incomePerSecond(economy, state),
    units: unlockedUnits(economy, state).map((u) => ({
      id: u.id,
      name: text(u.name),
      owned: state.owned[u.id] ?? 0,
      baseCost: u.baseCost,
      costGrowth: u.costGrowth,
      incomeEach: incomes[u.id],
    })),
    upgrades: availableUpgrades(economy, state)
      .map(upgrade)
      .sort((a, b) => a.cost - b.cost),
    bought: economy.upgrades.filter((u) => state.bought.has(u.def.id)).map((u) => upgrade(u.def)),
  };
}

// The signed-in player's snapshot, read as that player.
export async function getGameSnapshot(playerId: string, locale: string): Promise<GameSnapshot> {
  const [economy, progress] = await Promise.all([
    loadContent(playerId),
    readProgress(await createSessionClient(), playerId),
  ]);
  return toSnapshot(economy, progress, locale);
}
