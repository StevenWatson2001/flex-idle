import { compileContent, type Content, type Economy } from "@/lib/game/economy";
import { createAdminClient } from "./supabase-admin";

// The units and upgrades a player can have: the hand-made ones everyone
// has plus any that are theirs alone. Only the server reads content, with
// the secret key, so locked things never reach a browser. Every formula is
// checked as it loads, so broken content fails here, loudly.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function loadContent(playerId: string): Promise<Economy> {
  // The id goes into a filter string, so make sure it's only an id.
  if (!UUID.test(playerId)) throw new Error("Not a player id");
  const visible = `owner_id.is.null,owner_id.eq.${playerId}`;
  const admin = createAdminClient();

  const [units, upgrades] = await Promise.all([
    admin
      .from("units")
      .select("id, sort_order, rarity, name, base_cost, cost_growth, base_income, unlock")
      .or(visible),
    admin
      .from("upgrades")
      .select("id, sort_order, rarity, name, description, cost, unlock, effects")
      .or(visible),
  ]);
  if (units.error) throw new Error(`Couldn't read units: ${units.error.message}`);
  if (upgrades.error) throw new Error(`Couldn't read upgrades: ${upgrades.error.message}`);

  const content: Content = {
    units: units.data.map((row) => ({
      id: row.id,
      sortOrder: row.sort_order,
      rarity: row.rarity,
      name: row.name,
      baseCost: row.base_cost,
      costGrowth: row.cost_growth,
      baseIncome: row.base_income,
      unlock: row.unlock,
    })),
    upgrades: upgrades.data.map((row) => ({
      id: row.id,
      sortOrder: row.sort_order,
      rarity: row.rarity,
      name: row.name,
      description: row.description,
      cost: row.cost,
      unlock: row.unlock,
      effects: row.effects,
    })),
  };
  return compileContent(content);
}
