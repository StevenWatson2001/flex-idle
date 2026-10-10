import { redirect } from "next/navigation";
import { Coins, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireAccount } from "@/lib/server/session";

// The game layout: the currencies, the main area where #7 adds clicking,
// and the side panel of units, upgrades and blessings (bought with Favour
// after ascending). Admins don't play.
export default async function PlayPage() {
  const account = await requireAccount();
  if (account.role === "admin") redirect("/admin");
  const t = await getTranslations();

  return (
    <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-[1fr_28rem] gap-6 px-6 py-6">
      <h1 className="sr-only">{t("nav.play")}</h1>
      <div className="flex flex-col gap-6">
        <section aria-label={t("game.currencies")} className="grid grid-cols-2 gap-4">
          <Currency icon={<Coins />} name={t("game.gold")} />
          <Currency icon={<Sparkles />} name={t("game.favour")} />
        </section>
        <section
          aria-label={t("game.region")}
          className="panel-frame flex flex-1 items-center justify-center rounded-lg bg-card/70 p-8"
        >
          <p className="max-w-sm text-center text-muted-foreground italic">{t("game.placeholder")}</p>
        </section>
      </div>
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

// A currency's tile. Amounts arrive with #7 (Gold) and Ascension (Favour).
function Currency({ icon, name }: { icon: React.ReactNode; name: string }) {
  return (
    <div className="panel-frame flex items-center gap-4 rounded-lg bg-card/85 px-5 py-4">
      <span aria-hidden className="text-gold [&_svg]:size-7">
        {icon}
      </span>
      <div>
        <p className="font-heading text-sm font-semibold tracking-wide text-heading">{name}</p>
        <p className="font-heading text-2xl font-bold tabular-nums">—</p>
      </div>
    </div>
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
