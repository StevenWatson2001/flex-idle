"use client";

import { useEffect } from "react";
import { Coins } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { formatAmount, formatRate } from "@/lib/game/format";
import { useGame, useLiveGold } from "../game-provider";
import { Currency } from "./currency";

// The Gold tile, the main area the player clicks, and what clicks and units
// earn. The game provider counts the clicks and saves them; leaving the
// page sends any still waiting (so before signing out, which is on
// Settings).
export function ClickArea({ children }: { children: React.ReactNode }) {
  const t = useTranslations("game");
  const locale = useLocale();
  const { snapshot, click, flush } = useGame();
  const gold = useLiveGold();

  useEffect(() => flush, [flush]);

  return (
    <div className="flex flex-col gap-6">
      <section aria-label={t("currencies")} className="grid grid-cols-2 gap-4">
        <Currency
          icon={<Coins />}
          name={t("gold")}
          amount={formatAmount(gold, locale)}
          title={new Intl.NumberFormat(locale).format(Math.floor(gold))}
        />
        {children}
      </section>
      <section aria-label={t("region")} className="panel-frame flex flex-1 flex-col rounded-lg bg-card/70 p-2">
        <button
          type="button"
          onClick={click}
          className="group flex flex-1 cursor-pointer flex-col items-center justify-center gap-4 rounded-md outline-none select-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          <span
            aria-hidden
            className="rounded-full border-2 border-gold bg-card p-8 text-gold shadow-[0_0_24px_rgb(0_0_0/0.35)] transition-transform duration-75 group-hover:scale-105 group-active:scale-95 [&_svg]:size-20"
          >
            <Coins />
          </span>
          <span className="font-heading text-lg font-semibold tracking-wide text-heading">{t("clickToEarn")}</span>
        </button>
        <p
          role="status"
          aria-label={t("earnings")}
          className="border-t border-gold/40 px-4 pt-3 pb-2 text-center font-heading text-sm font-semibold tracking-wide text-muted-foreground tabular-nums"
        >
          {t("perClick", { amount: formatRate(snapshot.goldPerClick, locale) })}
          <span aria-hidden className="mx-2 text-gold">
            ·
          </span>
          {t("perSecond", { amount: formatRate(snapshot.incomePerSecond, locale) })}
        </p>
      </section>
    </div>
  );
}
