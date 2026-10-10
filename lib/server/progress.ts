import { createSessionClient } from "./session";

// Reads the signed-in player's resources and stats as that player, so RLS
// means they can only ever be their own.

export type Stats = {
  runClicks: number;
  runGoldEarned: number;
  totalClicks: number;
  totalGoldEarned: number;
};

export async function getGold(playerId: string): Promise<number> {
  const { data, error } = await (await createSessionClient())
    .from("resources")
    .select("amount")
    .eq("player_id", playerId)
    .eq("resource", "gold")
    .single();
  if (error) throw new Error(`Couldn't read Gold: ${error.message}`);
  return data.amount;
}

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
