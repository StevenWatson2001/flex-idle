"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BUY_AMOUNTS, maxAffordable, unitCost, type BuyAmount } from "@/lib/game/economy";
import { formatAmount, formatRate } from "@/lib/game/format";
import type { ShopUnit, ShopUpgrade } from "@/lib/server/progress";
import { useGame, useLiveGold } from "../game-provider";

// The side panel: units, upgrades (available and bought) and blessings
// (bought with Favour after ascending). It holds only what the server says
// is unlocked. Prices here are for show; the server works them out again.
export function Shop() {
  const t = useTranslations("game");
  const game = useGame();
  const gold = useLiveGold();
  const [amount, setAmount] = useState<BuyAmount>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy(purchase: () => Promise<string | null>) {
    setBusy(true);
    setError(await purchase());
    setBusy(false);
  }

  return (
    <aside aria-label={t("panel")} className="panel-frame rounded-lg bg-card/85 p-4">
      <Tabs defaultValue="units">
        <TabsList className="w-full">
          <TabsTrigger value="units">{t("units")}</TabsTrigger>
          <TabsTrigger value="upgrades">{t("upgrades")}</TabsTrigger>
          <TabsTrigger value="blessings">{t("blessings")}</TabsTrigger>
        </TabsList>

        {error && (
          <Alert variant="destructive" className="mt-3">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <TabsContent value="units" className="mt-3 grid gap-3">
          <div role="group" aria-label={t("buyAmount")} className="grid grid-cols-4 gap-2">
            {BUY_AMOUNTS.map((option) => (
              <Button
                key={option}
                size="sm"
                variant={option === amount ? "default" : "outline"}
                aria-pressed={option === amount}
                onClick={() => setAmount(option)}
              >
                {option === "max" ? t("max") : t("amount", { count: option })}
              </Button>
            ))}
          </div>
          <ul aria-label={t("unitsForSale")} className="grid gap-2">
            {game.snapshot.units.map((unit) => (
              <UnitRow
                key={unit.id}
                unit={unit}
                amount={amount}
                gold={gold}
                busy={busy}
                onBuy={(count) => buy(() => game.buyUnit(unit.id, count))}
              />
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="upgrades" className="mt-3">
          <Tabs defaultValue="available">
            <TabsList className="w-full">
              <TabsTrigger value="available">{t("available")}</TabsTrigger>
              <TabsTrigger value="bought">{t("bought")}</TabsTrigger>
            </TabsList>
            <TabsContent value="available" className="mt-3">
              {game.snapshot.upgrades.length === 0 ? (
                <EmptyList>{t("upgradesEmpty")}</EmptyList>
              ) : (
                <ul aria-label={t("availableUpgrades")} className="grid gap-2">
                  {game.snapshot.upgrades.map((upgrade) => (
                    <UpgradeRow
                      key={upgrade.id}
                      upgrade={upgrade}
                      gold={gold}
                      busy={busy}
                      onBuy={() => buy(() => game.buyUpgrade(upgrade.id))}
                    />
                  ))}
                </ul>
              )}
            </TabsContent>
            <TabsContent value="bought" className="mt-3">
              {game.snapshot.bought.length === 0 ? (
                <EmptyList>{t("boughtEmpty")}</EmptyList>
              ) : (
                <ul aria-label={t("boughtUpgrades")} className="grid gap-2">
                  {game.snapshot.bought.map((upgrade) => (
                    <UpgradeRow key={upgrade.id} upgrade={upgrade} />
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="blessings">
          <EmptyList>{t("blessingsEmpty")}</EmptyList>
        </TabsContent>
      </Tabs>
    </aside>
  );
}

function UnitRow({
  unit,
  amount,
  gold,
  busy,
  onBuy,
}: {
  unit: ShopUnit;
  amount: BuyAmount;
  gold: number;
  busy: boolean;
  onBuy: (amount: BuyAmount) => void;
}) {
  const t = useTranslations("game");
  const locale = useLocale();
  // Max shows the price of as many as Gold covers, or of one if none.
  const count = amount === "max" ? Math.max(1, maxAffordable(unit, unit.owned, gold)) : amount;
  const cost = unitCost(unit, unit.owned, count);
  const nameId = `unit-${unit.id}`;

  return (
    <li aria-labelledby={nameId} className={ROW}>
      <div className="min-w-0">
        <p id={nameId} className="font-heading text-base font-semibold tracking-wide text-heading">
          {unit.name}
        </p>
        <p className="text-sm text-muted-foreground tabular-nums">
          {t("owned", { count: unit.owned })}
          <span aria-hidden className="mx-1.5 text-gold">
            ·
          </span>
          {t("eachEarns", { amount: formatRate(unit.incomeEach, locale) })}
        </p>
      </div>
      <BuyButton cost={cost} disabled={busy || cost > gold} onClick={() => onBuy(amount)}>
        {t("buyCount", { count })}
      </BuyButton>
    </li>
  );
}

// An upgrade for sale (with onBuy) or already bought.
function UpgradeRow({
  upgrade,
  gold = 0,
  busy = false,
  onBuy,
}: {
  upgrade: ShopUpgrade;
  gold?: number;
  busy?: boolean;
  onBuy?: () => void;
}) {
  const t = useTranslations("game");
  const nameId = `upgrade-${upgrade.id}`;

  return (
    <li aria-labelledby={nameId} className={ROW}>
      <div className="min-w-0">
        <p id={nameId} className="font-heading text-base font-semibold tracking-wide text-heading">
          {upgrade.name}
        </p>
        <p className="text-sm text-muted-foreground">{upgrade.description}</p>
      </div>
      {onBuy && (
        <BuyButton cost={upgrade.cost} disabled={busy || upgrade.cost > gold} onClick={onBuy}>
          {t("buy")}
        </BuyButton>
      )}
    </li>
  );
}

const ROW = "flex items-center justify-between gap-4 rounded-md border border-gold/40 bg-background/40 px-4 py-3";

function BuyButton({
  cost,
  disabled,
  onClick,
  children,
}: {
  cost: number;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const t = useTranslations("game");
  const locale = useLocale();
  return (
    <Button disabled={disabled} onClick={onClick} className="h-auto min-w-28 flex-col gap-0 py-1.5">
      <span>{children}</span>
      <span className="text-xs font-normal tabular-nums">
        {/* Rounded up, so a price never looks affordable when it isn't. */}
        {t("cost", { amount: formatAmount(Math.ceil(cost), locale) })}
      </span>
    </Button>
  );
}

// Where a list's items will go, until there are some.
function EmptyList({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-gold/50 px-4 py-10 text-center text-muted-foreground">
      {children}
    </p>
  );
}
