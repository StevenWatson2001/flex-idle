import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireAccount } from "@/lib/server/session";
import { ClickArea } from "./click-area";
import { Currency } from "./currency";
import { Shop } from "./shop";

// The game layout: the currencies, the main area the player clicks for
// Gold, and the side panel of units, upgrades and blessings. The game
// itself comes from the provider in the signed-in layout. Admins don't play.
export default async function PlayPage() {
  const account = await requireAccount();
  if (account.role === "admin") redirect("/admin");
  const t = await getTranslations();

  return (
    <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-[1fr_28rem] gap-6 px-6 py-6">
      <h1 className="sr-only">{t("nav.play")}</h1>
      <ClickArea>
        {/* Favour arrives with Ascension. */}
        <Currency icon={<Sparkles />} name={t("game.favour")} amount="—" />
      </ClickArea>
      <Shop />
    </main>
  );
}
