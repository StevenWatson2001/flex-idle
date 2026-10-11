"use server";

import { getLocale, getTranslations } from "next-intl/server";
import type { BuyAmount } from "@/lib/game/economy";
import { buyUnit as buyUnitForPlayer, buyUpgrade as buyUpgradeForPlayer, saveClicks } from "@/lib/server/db-write";
import { getGameSnapshot, type GameSnapshot } from "@/lib/server/progress";
import { getCurrentAccount } from "@/lib/server/session";

// The game's actions, called by the game provider on every signed-in page.
// Everything they're given comes from a browser, so the server checks it.
// None re-render the page; each returns the player's new snapshot.

export type PurchaseResult = { snapshot: GameSnapshot } | { error: string };

// The regular save: a batch of clicks (maybe none) plus units' income
// since the last save. Returns the new snapshot, or null if it wasn't saved.
export async function syncGame(clicks: number): Promise<GameSnapshot | null> {
  const account = await getCurrentAccount();
  if (!account || account.role !== "player") return null;

  const result = await saveClicks(account.id, clicks);
  if (!result.ok) return null;
  return getGameSnapshot(account.id, await getLocale());
}

export async function buyUnit(unitId: string, amount: BuyAmount): Promise<PurchaseResult> {
  return purchase((playerId) => buyUnitForPlayer(playerId, String(unitId), amount));
}

export async function buyUpgrade(upgradeId: string): Promise<PurchaseResult> {
  return purchase((playerId) => buyUpgradeForPlayer(playerId, String(upgradeId)));
}

async function purchase(
  buy: (playerId: string) => ReturnType<typeof buyUpgradeForPlayer>,
): Promise<PurchaseResult> {
  const t = await getTranslations("errors");
  const account = await getCurrentAccount();
  if (!account) return { error: t("signedOut") };
  if (account.role !== "player") return { error: t("playersOnly") };

  const result = await buy(account.id);
  if (!result.ok) return { error: t(result.error) };
  return { snapshot: await getGameSnapshot(account.id, await getLocale()) };
}
