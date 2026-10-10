import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getGold } from "@/lib/server/progress";
import { requireAccount } from "@/lib/server/session";
import { ClickArea } from "./click-area";
import { Currency } from "./currency";

// The game layout: the currencies, the main area the player clicks for
// Gold, and the side panel of units, upgrades and blessings (bought with
// Favour after ascending). Admins don't play.
export default async function PlayPage() {
  const account = await requireAccount();
  if (account.role === "admin") redirect("/admin");
  const t = await getTranslations();
  const gold = await getGold(account.id);

  return (
    <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-[1fr_28rem] gap-6 px-6 py-6">
      <h1 className="sr-only">{t("nav.play")}</h1>
      <ClickArea gold={gold}>
        {/* Favour arrives with Ascension. */}
        <Currency icon={<Sparkles />} name={t("game.favour")} amount="—" />
      </ClickArea>
      <aside aria-label={t("game.panel")} className="panel-frame rounded-lg bg-card/85 p-4">
        <Tabs defaultValue="units">
          <TabsList className="w-full">
            <TabsTrigger value="units">{t("game.units")}</TabsTrigger>
            <TabsTrigger value="upgrades">{t("game.upgrades")}</TabsTrigger>
            <TabsTrigger value="blessings">{t("game.blessings")}</TabsTrigger>
          </TabsList>
          <TabsContent value="units">
            <EmptyList>{t("game.unitsEmpty")}</EmptyList>
          </TabsContent>
          <TabsContent value="upgrades">
            <EmptyList>{t("game.upgradesEmpty")}</EmptyList>
          </TabsContent>
          <TabsContent value="blessings">
            <EmptyList>{t("game.blessingsEmpty")}</EmptyList>
          </TabsContent>
        </Tabs>
      </aside>
    </main>
  );
}

// Where a list's items will go, until there are some.
function EmptyList({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 rounded-md border border-dashed border-gold/50 px-4 py-10 text-center text-muted-foreground">
      {children}
    </p>
  );
}
