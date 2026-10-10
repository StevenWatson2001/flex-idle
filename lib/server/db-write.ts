import {
  GOLD_PER_CLICK,
  MAX_BANKED_SECONDS,
  MAX_CLICKS_PER_SAVE,
  MAX_CLICKS_PER_SECOND,
} from "@/lib/game/clicks";
import { createAdminClient } from "./supabase-admin";

// The only code that writes game data. Actions call these after checking
// the caller is the signed-in player; the values came from a browser, so
// they're checked again here. The database functions they call hold the
// rules that need a lock (see the #7 migration). Errors are keys,
// translated under "errors" in messages/.

export type WriteError = "badClicks" | "saveFailed";

export type WriteResult<T = void> = { ok: true; value: T } | { ok: false; error: WriteError };

// Adds a batch of clicks, capped at a believable rate, and returns the
// player's new Gold.
export async function saveClicks(playerId: string, clicks: number): Promise<WriteResult<{ gold: number }>> {
  if (!Number.isInteger(clicks) || clicks < 0 || clicks > MAX_CLICKS_PER_SAVE) {
    return { ok: false, error: "badClicks" };
  }

  const { data, error } = await createAdminClient().rpc("save_clicks", {
    p_player: playerId,
    p_clicks: clicks,
    p_gold_per_click: GOLD_PER_CLICK,
    p_clicks_per_second: MAX_CLICKS_PER_SECOND,
    p_max_seconds: MAX_BANKED_SECONDS,
  });
  if (error || typeof data !== "number") return { ok: false, error: "saveFailed" };
  return { ok: true, value: { gold: data } };
}

// Sets the player's resources and stats back to zero.
export async function resetProgress(playerId: string): Promise<WriteResult> {
  const { error } = await createAdminClient().rpc("reset_progress", { p_player: playerId });
  if (error) return { ok: false, error: "saveFailed" };
  return { ok: true, value: undefined };
}
