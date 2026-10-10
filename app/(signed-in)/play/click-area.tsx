"use client";

import { useEffect, useRef, useState } from "react";
import { Coins } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { GOLD_PER_CLICK, SAVE_INTERVAL_MS } from "@/lib/game/clicks";
import { formatAmount } from "@/lib/game/format";
import { saveClicks } from "./actions";
import { Currency } from "./currency";

// The Gold tile and the main area the player clicks. Clicks are counted
// here and sent in batches every couple of seconds, when the tab is hidden,
// and on leaving the page (so before signing out, which is on Settings).
// Server Actions run one at a time, so batches arrive in order. The tile
// shows the server's Gold plus the clicks not yet sent.
export function ClickArea({ gold: initialGold, children }: { gold: number; children: React.ReactNode }) {
  const t = useTranslations("game");
  const locale = useLocale();
  const [gold, setGold] = useState(initialGold);
  const [unsent, setUnsent] = useState(0);
  const unsentRef = useRef(0);

  useEffect(() => {
    function send() {
      const clicks = unsentRef.current;
      if (clicks === 0) return;
      unsentRef.current = 0;
      // Both updates in one callback, so the tile never counts a batch twice.
      void saveClicks(clicks).then(
        (saved) => {
          if (saved !== null) setGold(saved);
          setUnsent((count) => count - clicks);
        },
        () => setUnsent((count) => count - clicks),
      );
    }
    function sendIfHidden() {
      if (document.visibilityState === "hidden") send();
    }

    const interval = setInterval(send, SAVE_INTERVAL_MS);
    document.addEventListener("visibilitychange", sendIfHidden);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", sendIfHidden);
      send();
    };
  }, []);

  function click() {
    unsentRef.current += 1;
    setUnsent((count) => count + 1);
  }

  const shown = gold + unsent * GOLD_PER_CLICK;

  return (
    <div className="flex flex-col gap-6">
      <section aria-label={t("currencies")} className="grid grid-cols-2 gap-4">
        <Currency
          icon={<Coins />}
          name={t("gold")}
          amount={formatAmount(shown, locale)}
          title={new Intl.NumberFormat(locale).format(Math.floor(shown))}
        />
        {children}
      </section>
      <section aria-label={t("region")} className="panel-frame flex flex-1 rounded-lg bg-card/70 p-2">
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
      </section>
    </div>
  );
}
