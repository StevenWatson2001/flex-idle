"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, Swords, UserRound, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = { play: Swords, players: Users, profile: UserRound, settings: Settings };

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

// The section tabs in the header. The current section is filled gold, so
// it's always clear where you are and where else you can go.
export function NavLinks({ label, items }: { label: string; items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label={label}>
      <ul className="flex gap-2">
        {items.map((item) => {
          const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = ICONS[item.icon];
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md border px-4 py-2 font-heading text-sm font-semibold tracking-wide transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  current
                    ? "border-gold bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_2px_6px_rgb(0_0_0/0.35)]"
                    : "border-gold/50 text-foreground hover:border-gold hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon aria-hidden className="size-4" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
