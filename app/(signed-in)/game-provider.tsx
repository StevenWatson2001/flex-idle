"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MAX_INCOME_SECONDS, SAVE_INTERVAL_MS } from "@/lib/game/clicks";
import type { BuyAmount } from "@/lib/game/economy";
import type { GameSnapshot } from "@/lib/server/progress";
import { buyUnit, buyUpgrade, syncGame, type PurchaseResult } from "./game-actions";

// The player's game on every signed-in page, so units earn wherever they
// are. It saves every couple of seconds (clicks, if any, and income), when
// the tab is hidden, and when the click area unmounts (so before signing
// out, which is on Settings). Server Actions run one at a time, so saves
// and purchases arrive in order. Gold on screen is the server's Gold plus
// income since it arrived plus clicks not yet sent: display only, as the
// server decides what's earned.

type Game = {
  snapshot: GameSnapshot;
  // When the snapshot arrived (performance.now()), or null for "just now".
  at: number | null;
  unsent: number;
  click: () => void;
  flush: () => void;
  // Each returns an error message, or null once bought.
  buyUnit: (unitId: string, amount: BuyAmount) => Promise<string | null>;
  buyUpgrade: (upgradeId: string) => Promise<string | null>;
};

const GameContext = createContext<Game | null>(null);

export function useGame(): Game {
  const game = useContext(GameContext);
  if (!game) throw new Error("useGame needs a GameProvider");
  return game;
}

// Gold as it should look now, ticking up with income.
export function useLiveGold(): number {
  const { snapshot, at, unsent } = useGame();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const interval = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(interval);
  }, []);

  const seconds = at === null || now === null ? 0 : Math.min(Math.max((now - at) / 1000, 0), MAX_INCOME_SECONDS);
  return snapshot.gold + snapshot.incomePerSecond * seconds + unsent * snapshot.goldPerClick;
}

export function GameProvider({ initial, children }: { initial: GameSnapshot; children: React.ReactNode }) {
  const [state, setState] = useState<{ snapshot: GameSnapshot; at: number | null }>({ snapshot: initial, at: null });
  const [unsent, setUnsent] = useState(0);
  const unsentRef = useRef(0);

  // The layout re-renders with a fresh snapshot after Settings resets
  // progress; take it.
  const [lastInitial, setLastInitial] = useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setState({ snapshot: initial, at: null });
  }

  const arrived = useCallback((snapshot: GameSnapshot) => setState({ snapshot, at: performance.now() }), []);

  const send = useCallback(() => {
    const clicks = unsentRef.current;
    unsentRef.current = 0;
    // Both updates in one callback, so the tile never counts a batch twice.
    void syncGame(clicks).then(
      (snapshot) => {
        if (snapshot) arrived(snapshot);
        setUnsent((count) => count - clicks);
      },
      () => setUnsent((count) => count - clicks),
    );
  }, [arrived]);

  const flush = useCallback(() => {
    if (unsentRef.current > 0) send();
  }, [send]);

  useEffect(() => {
    function sendIfHidden() {
      if (document.visibilityState === "hidden") send();
    }
    // Save at once, which also starts income counting from now.
    send();
    const interval = setInterval(send, SAVE_INTERVAL_MS);
    document.addEventListener("visibilitychange", sendIfHidden);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", sendIfHidden);
      flush();
    };
  }, [send, flush]);

  const click = useCallback(() => {
    unsentRef.current += 1;
    setUnsent((count) => count + 1);
  }, []);

  // Clicks go first, so the server has the Gold the screen showed.
  const purchase = useCallback(
    async (buy: () => Promise<PurchaseResult>) => {
      flush();
      const result = await buy();
      if ("error" in result) return result.error;
      arrived(result.snapshot);
      return null;
    },
    [flush, arrived],
  );

  const game = useMemo<Game>(
    () => ({
      ...state,
      unsent,
      click,
      flush,
      buyUnit: (unitId, amount) => purchase(() => buyUnit(unitId, amount)),
      buyUpgrade: (upgradeId) => purchase(() => buyUpgrade(upgradeId)),
    }),
    [state, unsent, click, flush, purchase],
  );

  return <GameContext.Provider value={game}>{children}</GameContext.Provider>;
}
