import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireAccount } from "@/lib/server/session";

// The game layout: the main area, where #7 adds money and clicking, and
// the side panel of units and upgrades. Admins don't play.
export default async function PlayPage() {
  const account = await requireAccount();
  if (account.role === "admin") redirect("/admin");
  const t = await getTranslations();

  return (
    <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-[1fr_24rem] gap-6 px-6 py-6">
      <h1 className="sr-only">{t("nav.play")}</h1>
      <section
        aria-label={t("game.region")}
        className="panel-frame flex min-h-[70vh] items-center justify-center rounded-lg bg-card/70 p-8"
      >
        <p className="max-w-sm text-center text-muted-foreground italic">{t("game.placeholder")}</p>
      </section>
      <aside aria-label={t("game.panel")} className="panel-frame rounded-lg bg-card/85 p-4">
        <Tabs defaultValue="units">
          <TabsList className="w-full">
            <TabsTrigger value="units">{t("game.units")}</TabsTrigger>
            <TabsTrigger value="upgrades">{t("game.upgrades")}</TabsTrigger>
          </TabsList>
          <TabsContent value="units">
            <EmptyList>{t("game.unitsEmpty")}</EmptyList>
          </TabsContent>
          <TabsContent value="upgrades">
            <EmptyList>{t("game.upgradesEmpty")}</EmptyList>
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
