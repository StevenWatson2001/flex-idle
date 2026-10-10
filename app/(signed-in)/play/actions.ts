"use server";

import { saveClicks as saveClicksForPlayer } from "@/lib/server/db-write";
import { getCurrentAccount } from "@/lib/server/session";

// Sends a batch of clicks and returns the player's new Gold, or null if it
// wasn't saved. The count comes from the browser, so the server checks and
// caps it. It doesn't re-render the page; the click area shows the Gold.
export async function saveClicks(clicks: number): Promise<number | null> {
  const account = await getCurrentAccount();
  if (!account || account.role !== "player") return null;

  const result = await saveClicksForPlayer(account.id, clicks);
  return result.ok ? result.value.gold : null;
}
