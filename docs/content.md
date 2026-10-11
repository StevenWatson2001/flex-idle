# Content: units and upgrades

How units and upgrades work, and how to add new ones. They're data in the
`units` and `upgrades` tables (see `data-model.md`), and their logic is
written as formulas, so new content needs no new code unless it needs a
new kind of effect.

## How they work
- **Units** cost `base_cost × cost_growth ^ owned` each and earn
  `base_income` Gold a second each, changed by upgrades. A player can buy
  ×1, ×10, ×100 or Max at once.
- **Upgrades** are bought once. Each has a list of **effects**.
- **Unlocks:** a unit or upgrade is in the shop while its `unlock` formula
  is true (null means always). Locked ones never reach the browser. Bought
  upgrades move to the Bought tab.
- **Earning:** units earn only while a signed-in page is open. Each save
  (every 2 s) credits at most 90 s of income (`MAX_INCOME_SECONDS`).
- **Ownership:** `owner_id` null means everyone has it (hand-made). A
  player's id means it's theirs alone (AI-made ones, from #17 on).
- **Rarity:** `common`, `uncommon`, `rare`, `epic` or `legendary`. All
  hand-made content is common.

The maths lives in `lib/game/economy.ts`, and the formula language in
`lib/game/formula.ts`.

## Effects
Each effect is `{ "target": …, "op": …, "value": "<formula>" }`.

| Target        | Changes                                 |
| ------------- | --------------------------------------- |
| `click`       | Gold per click (base 1)                 |
| `units`       | every unit's income                     |
| `unit:<id>`   | one unit's income                       |

`op` is `add` or `multiply`. A unit's income each is
`(base_income + adds) × its multipliers × every-unit multipliers`, and
Gold per click is `(1 + adds) × multipliers`. Order never matters. An
effect whose value is infinite or not a number is ignored. Rates stop at
1e300 and Gold at 1e308, so broken content can't overflow the game.

## Formulas
- Numbers, `+ - * / ^`, brackets.
- `< <= > >= == !=`, `and`, `or`, `not`, `true`, `false`. These give 1 or
  0, and 0 counts as false.
- `owned('unit_id')`, `bought('upgrade_id')`, `min(…)`, `max(…)`,
  `floor(x)`, `log10(x)`.
- Stats: `gold`, `run_clicks`, `run_click_gold`, `run_gold_earned`,
  `total_clicks`, `total_gold_earned`. "Run" stats reset on Ascension.
  `run_click_gold` is Gold earned by clicking.
- At most 500 characters. A name, unit or upgrade that doesn't exist is an
  error, so the content fails to load.

Example: "at 1,000 Archers, Archers earn nothing, but every unit gets +10% per
Archer":

```json
unlock:  "owned('archer') >= 1000"
effects: [{ "target": "unit:archer", "op": "multiply", "value": "0" },
          { "target": "units", "op": "multiply", "value": "1 + 0.1 * owned('archer')" }]
```

## Adding content
1. Create a migration: `pnpm supabase migration new <issue>-<name>`.
2. Insert the rows. Copy the seed rows in
   `supabase/migrations/*_16-units-and-upgrades.sql`:
   - `id`: lowercase letters, digits and `_`. It never changes, because
     players' rows point at it.
   - `sort_order`: where it sits in the shop (units by it; upgrades by cost).
   - `name` and `description`: `{"en": …, "km": …}`, both required.
3. To change numbers, `update` the rows in a new migration. Never edit an
   applied migration.
4. Run `pnpm test`. The database test loads all content on dev and fails if
   any formula is broken, after Steven runs `pnpm db:push`.
5. A new effect target or stat means code: add it to `lib/game/economy.ts` or
   `STATS` in `lib/game/formula.ts`, with a unit test, and to this file.

## Starter balance (#16)
Five units (Chicken 10 → Archer 250K), each with upgrades at 10 owned (×2,
base cost × 30), 25 (×2, × 600) and 100 (×4, × 10M), plus click upgrades
of +5, +50 and +500 that unlock at 100, 10K and 1M Gold from clicking.
Simulated, a first run reaches 1M Gold earned in about 30–40 minutes. The
25- and 100-tier upgrades are meant for later runs.
