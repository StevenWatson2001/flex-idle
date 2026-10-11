import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { getGameSnapshot } from "@/lib/server/progress";
import { homePath, requireAccount } from "@/lib/server/session";
import { GameProvider } from "./game-provider";
import { NavLinks, type NavItem } from "./nav-links";

// Every signed-in page: the header with the brand and the section tabs,
// then the page. Players get the game, which runs on every page so units
// keep earning; admins get the admin area instead.
export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  const account = await requireAccount();
  const t = await getTranslations();
  const snapshot = account.role === "player" ? await getGameSnapshot(account.id, await getLocale()) : null;

  const items: NavItem[] = [
    account.role === "admin"
      ? { href: "/admin", label: t("nav.players"), icon: "players" }
      : { href: "/play", label: t("nav.play"), icon: "play" },
    { href: "/profile", label: t("nav.profile"), icon: "profile" },
    { href: "/settings", label: t("nav.settings"), icon: "settings" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b-2 border-gold bg-card/85 shadow-[0_4px_18px_rgb(0_0_0/0.35)] backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-6 py-3">
          <Link
            href={homePath(account)}
            className="font-heading text-2xl font-bold tracking-[0.2em] whitespace-nowrap text-heading"
          >
            {t("app.name")}
          </Link>
          <NavLinks label={t("nav.label")} items={items} />
        </div>
      </header>
      {snapshot ? <GameProvider initial={snapshot}>{children}</GameProvider> : children}
    </div>
  );
}
